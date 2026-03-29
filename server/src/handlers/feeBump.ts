import StellarSdk, { Transaction } from "@stellar/stellar-sdk";
import { Config, FeePayerAccount, pickFeePayerAccount } from "../config";
import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { ApiKeyConfig } from "../middleware/apiKeys";
import { Tenant, syncTenantFromApiKey } from "../models/tenantStore";
import { recordSponsoredTransaction } from "../models/transactionLedger";
import { FeeBumpRequest, FeeBumpSchema, FeeBumpBatchRequest, FeeBumpBatchSchema } from "../schemas/feeBump";
import { checkTenantDailyQuota } from "../services/quota";
import { calculateFeeBumpFee } from "../utils/feeCalculator";
import { verifyXdrNetwork } from "../utils/networkVerification";
import { MockPriceOracle, validateSlippage } from "../utils/priceOracle";
import { priceService } from "../services/priceService";
import { transactionMilestoneService } from "../services/discordMilestones";
import { transactionStore } from "../workers/transactionStore";
import { prisma } from "../utils/db";
import { classifyTransactionCategory } from "../services/transactionCategorizer";
import { getFeeManager } from "../services/feeManager";
import { SponsorFactory } from "../sponsors/factory";
import { StellarFeeSponsor } from "../sponsors/stellar";

/**
 * @openapi
 * /fee-bump:
 *   post:
 *     summary: Wrap a transaction with a fee-bump envelope
 *     description: >
 *       Accepts a signed Stellar inner transaction XDR and returns a
 *       fee-bumped version signed by the Fluid fee-payer account.
 *       Optionally submits the transaction directly to Horizon.
 *     tags:
 *       - Fee Bump
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeeBumpRequest'
 *           examples:
 *             minimal:
 *               summary: Wrap only (no submission)
 *               value:
 *                 xdr: "AAAAAgAAAAB..."
 *                 submit: false
 *             submit:
 *               summary: Wrap and submit to Horizon
 *               value:
 *                 xdr: "AAAAAgAAAAB..."
 *                 submit: true
 *     responses:
 *       200:
 *         description: Fee-bumped transaction XDR (and hash if submitted).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeeBumpResponse'
 *             examples:
 *               ready:
 *                 summary: XDR ready for client submission
 *                 value:
 *                   xdr: "AAAABQAAAABf..."
 *                   status: ready
 *                   fee_payer: "GABC...XYZ"
 *               submitted:
 *                 summary: Submitted to Horizon
 *                 value:
 *                   xdr: "AAAABQAAAABf..."
 *                   status: submitted
 *                   hash: "a1b2c3..."
 *                   fee_payer: "GABC...XYZ"
 *       400:
 *         description: >
 *           Invalid request — bad XDR, unsigned transaction, wrong network,
 *           unsupported asset, or slippage exceeded.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidXdr:
 *                 summary: Malformed XDR
 *                 value:
 *                   error: "Invalid XDR: ..."
 *                   code: INVALID_XDR
 *               unsignedTx:
 *                 summary: Transaction not signed
 *                 value:
 *                   error: "Inner transaction must be signed before fee-bumping"
 *                   code: INVALID_XDR
 *       401:
 *         description: Missing API key.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingKey:
 *                 summary: No x-api-key header
 *                 value:
 *                   error: "Missing API key. Provide a valid x-api-key header to access this endpoint."
 *                   code: AUTH_FAILED
 *       403:
 *         description: Invalid/revoked API key or daily quota exceeded.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               quotaExceeded:
 *                 summary: Tier quota exhausted
 *                 value:
 *                   error: "Tier limit exceeded. Spend 1000000/500000 stroops..."
 *                   code: QUOTA_EXCEEDED
 *       500:
 *         description: Internal server error or Horizon submission failure.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               submissionFailed:
 *                 summary: Horizon rejected the transaction
 *                 value:
 *                   error: "Transaction submission failed: ..."
 *                   code: SUBMISSION_FAILED
 *
 * /fee-bump/batch:
 *   post:
 *     summary: Wrap multiple transactions in a single request
 *     description: >
 *       Accepts an array of signed inner transaction XDRs and returns
 *       fee-bumped versions for each, processed concurrently.
 *     tags:
 *       - Fee Bump
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeeBumpBatchRequest'
 *     responses:
 *       200:
 *         description: Array of fee-bump results, one per input XDR.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FeeBumpResponse'
 *       400:
 *         description: Validation error on one or more XDRs.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing API key.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// processFeeBump and legacy types removed in favor of StellarFeeSponsor

export async function feeBumpHandler(
  req: Request,
  res: Response,
  next: NextFunction,
  config: Config
): Promise<void> {
  try {
    const result = FeeBumpSchema.safeParse(req.body);

    if (!result.success) {
      console.warn(
        "Validation failed for fee-bump request:",
        result.error.format()
      );

      return next(
        new AppError(
          `Validation failed: ${JSON.stringify(result.error.format())}`,
          400,
          "INVALID_XDR"
        )
      );
    }

    const body: FeeBumpRequest = result.data;
    const chainId = body.chainId || "stellar";
    const sponsor = SponsorFactory.getSponsor(chainId as any);

    const apiKeyConfig = res.locals.apiKey as ApiKeyConfig | undefined;
    if (!apiKeyConfig) {
      res.status(500).json({
        error: "Missing tenant context for fee sponsorship",
      });
      return;
    }

    const tenant = syncTenantFromApiKey(apiKeyConfig);
    const feePayerAccount = pickFeePayerAccount(config);

    // Prepare chain-specific params
    let params: any = { ...body, config, tenant, feePayerAccount };
    
    // Stellar-specific validation (moved from handler to maintain compatibility check)
    if (chainId === "stellar") {
      if (!body.xdr) throw new AppError("Stellar requires xdr field", 400, "INVALID_XDR");
      
      const networkCheck = verifyXdrNetwork(body.xdr, config.networkPassphrase);
      if (!networkCheck.valid) {
        throw new AppError(networkCheck.errorMessage ?? "Network mismatch", 400, "NETWORK_MISMATCH");
      }

      // Whitelist check
      if (body.token) {
        const supportedAssets = config.supportedAssets ?? [];
        const isWhitelisted = supportedAssets.some((asset) => {
          const assetId = asset.issuer ? `${asset.code}:${asset.issuer}` : asset.code;
          return body.token === assetId;
        });

        if (!isWhitelisted) {
          throw new AppError(
            `Whitelisting failed: Asset "${body.token}" is not accepted for fee sponsorship.`,
            400,
            "UNSUPPORTED_ASSET",
          );
        }
      }
    }

    const response = await sponsor.buildSponsoredTx(params);

    res.json({
      xdr: chainId === "stellar" ? response.tx : undefined,
      tx: response.tx,
      status: response.status,
      hash: response.hash,
      fee_payer: response.feePayer,
    });
  } catch (error: any) {
    console.error("Error processing fee-bump request:", error);
    next(error);
  }
}

export async function feeBumpBatchHandler(
  req: Request,
  res: Response,
  next: NextFunction,
  config: Config
): Promise<void> {
  try {
    const parsedBody = FeeBumpBatchSchema.safeParse(req.body);

    if (!parsedBody.success) {
      console.warn(
        "Validation failed for fee-bump batch request:",
        parsedBody.error.format()
      );

      return next(
        new AppError(
          `Validation failed: ${JSON.stringify(parsedBody.error.format())}`,
          400,
          "INVALID_XDR"
        )
      );
    }

    const body: FeeBumpBatchRequest = parsedBody.data;

    const apiKeyConfig = res.locals.apiKey as ApiKeyConfig | undefined;
    if (!apiKeyConfig) {
      res.status(500).json({ error: "Missing tenant context for fee sponsorship" });
      return;
    }

    const tenant = syncTenantFromApiKey(apiKeyConfig);
    const feePayerAccount = pickFeePayerAccount(config);
    const stellarSponsor = new StellarFeeSponsor();
    
    const results = await Promise.all(
      body.xdrs.map((xdr) => 
        stellarSponsor.buildSponsoredTx({
          xdr,
          submit: body.submit ?? false,
          config,
          tenant,
          feePayerAccount
        })
      )
    );

    res.json(results);
  } catch (error: any) {
    console.error("Error processing fee-bump batch request:", error);
    next(error);
  }
}
