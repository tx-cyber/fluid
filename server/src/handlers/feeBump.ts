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
import {
  getCrossChainSettlementService,
  SettlementExecutor,
} from "../services/crossChainSettlement";

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
export interface FeeBumpResponse {
  xdr: string;
  status: "ready" | "submitted" | "awaiting_evm_payment";
  hash?: string;
  fee_payer: string;
  settlement_id?: string;
  evm_payment?: {
    chain_id: number;
    token_address: string;
    amount: string;
    payer_address: string;
    recipient_address: string;
    confirmations_required: number;
  };
  submitted_via?: string;
  submission_attempts?: number;
}

interface PreparedFeeBump {
  innerTransaction: Transaction;
  feeAmount: number;
  category: string;
  innerTxHash: string;
}

async function maybeNotifyMilestones(): Promise<void> {
  try {
    await transactionMilestoneService.checkForMilestones();
  } catch (error) {
    console.error("Discord milestone check failed:", error);
  }
}

function parseInnerTransaction(xdr: string, config: Config): Transaction {
  let innerTransaction: Transaction;

  try {
    innerTransaction = StellarSdk.TransactionBuilder.fromXDR(
      xdr,
      config.networkPassphrase
    ) as Transaction;
  } catch (error: any) {
    throw new AppError(`Invalid XDR: ${error.message}`, 400, "INVALID_XDR");
  }

  if (!innerTransaction.signatures || innerTransaction.signatures.length === 0) {
    throw new AppError(
      "Inner transaction must be signed before fee-bumping",
      400,
      "UNSIGNED_TRANSACTION"
    );
  }

  if ("innerTransaction" in innerTransaction) {
    throw new AppError(
      "Cannot fee-bump an already fee-bumped transaction",
      400,
      "ALREADY_FEE_BUMPED"
    );
  }

  return innerTransaction;
}

function prepareFeeBump(xdr: string, config: Config): PreparedFeeBump {
  const innerTransaction = parseInnerTransaction(xdr, config);
  const dynamicFeeMultiplier =
    getFeeManager()?.getMultiplier() ?? config.feeMultiplier;
  const feeAmount = calculateFeeBumpFee(
    innerTransaction, // Pass the transaction object for Soroban check
    config.baseFee,
    dynamicFeeMultiplier
  );
  const category = classifyTransactionCategory(
    innerTransaction.operations as Array<{ type?: string }>
  );
  const innerTxHash = innerTransaction.hash().toString("hex");

  return {
    innerTransaction,
    feeAmount,
    category,
    innerTxHash,
  };
}

async function createPendingTransactionRecord(
  tenantId: string,
  prepared: PreparedFeeBump,
): Promise<{ id: string }> {
  return prisma.transaction.create({
    data: {
      innerTxHash: prepared.innerTxHash,
      tenantId,
      status: "PENDING",
      costStroops: prepared.feeAmount,
      category: prepared.category,
    },
  });
}

async function executePreparedFeeBump(
  xdr: string,
  submit: boolean,
  config: Config,
  tenantId: string,
  feePayerAccount: FeePayerAccount,
  transactionRecordId: string,
): Promise<FeeBumpResponse> {
  const innerTransaction = parseInnerTransaction(xdr, config);
  const dynamicFeeMultiplier =
    getFeeManager()?.getMultiplier() ?? config.feeMultiplier;
  const feeAmount = calculateFeeBumpFee(
    innerTransaction,
    config.baseFee,
    dynamicFeeMultiplier
  );

  try {
    const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      feePayerAccount.keypair,
      feeAmount.toString(),
      innerTransaction,
      config.networkPassphrase
    );

    feeBumpTx.sign(feePayerAccount.keypair);
    await recordSponsoredTransaction(tenantId, feeAmount);
    await maybeNotifyMilestones();

    const feeBumpXdr = feeBumpTx.toXDR();
    const feeBumpTxHash = feeBumpTx.hash().toString("hex");

    if (submit && config.horizonUrl) {
      const server = new StellarSdk.Horizon.Server(config.horizonUrl);

      try {
        const submissionResult = await server.submitTransaction(feeBumpTx);
        await transactionStore.addTransaction(submissionResult.hash, tenantId, "submitted");

        await prisma.transaction.update({
          where: { id: transactionRecordId },
          data: {
            status: "SUCCESS",
            txHash: submissionResult.hash,
          },
        });

        return {
          xdr: feeBumpXdr,
          status: "submitted",
          hash: submissionResult.hash,
          fee_payer: feePayerAccount.publicKey,
        };
      } catch (error: any) {
        console.error("Transaction submission failed:", error);

        await prisma.transaction.update({
          where: { id: transactionRecordId },
          data: {
            status: "FAILED",
          },
        });

        throw new AppError(
          `Transaction submission failed: ${error.message}`,
          500,
          "SUBMISSION_FAILED"
        );
      }
    }

    await prisma.transaction.update({
      where: { id: transactionRecordId },
      data: {
        status: "SUCCESS",
        txHash: feeBumpTxHash,
      },
    });

    return {
      xdr: feeBumpXdr,
      status: submit ? "submitted" : "ready",
      fee_payer: feePayerAccount.publicKey,
    };
  } catch (error: any) {
    await prisma.transaction.update({
      where: { id: transactionRecordId },
      data: {
        status: "FAILED",
      },
    });

    throw error;
  }
}

function createSettlementExecutor(config: Config): SettlementExecutor {
  return {
    async execute(input) {
      await executePreparedFeeBump(
        input.xdr,
        input.submit,
        config,
        input.tenantId,
        input.feePayerAccount,
        input.transactionId,
      );
    },
  };
}

async function processFeeBump(
  xdr: string,
  submit: boolean,
  config: Config,
  tenant: Tenant,
  feePayerAccount: FeePayerAccount
): Promise<FeeBumpResponse> {
  const prepared = prepareFeeBump(xdr, config);
  const quotaCheck = await checkTenantDailyQuota(tenant, prepared.feeAmount);
  if (!quotaCheck.allowed) {
    throw new AppError(
      `Tier limit exceeded. Spend ${quotaCheck.currentSpendStroops}/${quotaCheck.dailyQuotaStroops} stroops and transactions ${quotaCheck.currentTxCount}/${quotaCheck.txLimit} today.`,
      403,
      "QUOTA_EXCEEDED"
    );
  }
  const transactionRecord = await createPendingTransactionRecord(tenant.id, prepared);

  return executePreparedFeeBump(
    xdr,
    submit,
    config,
    tenant.id,
    feePayerAccount,
    transactionRecord.id,
  );
}

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

    // Validate XDR early so errors surface before touching the signer pool
    let parsedInner: Transaction;
    try {
      parsedInner = StellarSdk.TransactionBuilder.fromXDR(
        body.xdr,
        config.networkPassphrase
      ) as Transaction;
    } catch (err: any) {
      return next(new AppError(`Invalid XDR: ${err.message}`, 400, "INVALID_XDR"));
    }
    if ("innerTransaction" in parsedInner) {
      return next(new AppError("Cannot fee-bump an already fee-bumped transaction", 400, "ALREADY_FEE_BUMPED"));
    }

    // Verify the XDR was signed for the server's configured network
    const networkCheck = verifyXdrNetwork(body.xdr, config.networkPassphrase);
    if (!networkCheck.valid) {
      return next(new AppError(networkCheck.errorMessage ?? "Network mismatch", 400, "NETWORK_MISMATCH"));
    }

    // Check against token whitelist if a token is provided
    if (body.token) {
      const supportedAssets = config.supportedAssets ?? [];
      const isWhitelisted = supportedAssets.some((asset) => {
        const assetId = asset.issuer ? `${asset.code}:${asset.issuer}` : asset.code;
        return body.token === assetId;
      });

      if (!isWhitelisted) {
        console.warn(`Rejected fee-bump request for non-whitelisted asset: ${body.token}`);
        return next(
          new AppError(
            `Whitelisting failed: Asset "${body.token}" is not accepted for fee sponsorship.`,
            400,
            "UNSUPPORTED_ASSET",
          ),
        );
      }
      console.log(`Accepted whitelisted asset: ${body.token}`);

      // Slippage protection for token payments
      if (body.maxSlippage !== undefined) {
        const priceOracle = new MockPriceOracle();
        const requestTime = Date.now();
        try {
          const currentPrice = await priceOracle.getCurrentPrice(body.token);
          const historicalPrice = await priceOracle.getHistoricalPrice(body.token, requestTime - 120000);
          const slippageCheck = validateSlippage(historicalPrice, currentPrice, body.maxSlippage);
          if (!slippageCheck.valid) {
            return next(new AppError("Slippage too high: try increasing your fee payment", 400, "SLIPPAGE_TOO_HIGH"));
          }
        } catch (error: any) {
          return next(new AppError(`Failed to verify token price: ${error.message}`, 500, "INTERNAL_ERROR"));
        }
      }

      // Dynamic fee threshold validation using real-time oracle price
      try {
        const dynamicFeeMultiplier =
          getFeeManager()?.getMultiplier() ?? config.feeMultiplier;
        const feeAmount = calculateFeeBumpFee(
          parsedInner,
          config.baseFee,
          dynamicFeeMultiplier
        );
        const tokenCode = body.token.split(":")[0].toUpperCase();
        const xlmPriceUsd = await priceService.getTokenPriceUsd("XLM");
        const tokenPriceUsd = await priceService.getTokenPriceUsd(tokenCode);
        const requiredTokenAmount = priceService.calculateRequiredTokenAmount(
          feeAmount,
          xlmPriceUsd,
          tokenPriceUsd
        );

        console.log(
          `[PriceOracle] XLM/USD: ${xlmPriceUsd.toString()}, ` +
          `${tokenCode}/USD: ${tokenPriceUsd.toString()}, ` +
          `fee: ${feeAmount} stroops, ` +
          `required: ${requiredTokenAmount.toString()} ${tokenCode} ` +
          `(buffer: ${priceService.getSafetyBuffer()}x)`
        );
      } catch (error: any) {
        console.warn(`[PriceOracle] Price check failed (non-blocking): ${error.message}`);
      }
    }

    const apiKeyConfig = res.locals.apiKey as ApiKeyConfig | undefined;
    if (!apiKeyConfig) {
      res.status(500).json({
        error: "Missing tenant context for fee sponsorship",
      });
      return;
    }

    const tenant = syncTenantFromApiKey(apiKeyConfig);
    const feePayerAccount = pickFeePayerAccount(config);

    if (body.evmSettlement) {
      if (!config.evmSettlement?.enabled) {
        return next(
          new AppError(
            "EVM settlement is not enabled on this server.",
            400,
            "EVM_SETTLEMENT_DISABLED",
          ),
        );
      }

      if (body.evmSettlement.chainId !== config.evmSettlement.chainId) {
        return next(
          new AppError(
            `Unsupported EVM chain ${body.evmSettlement.chainId}. Expected chain ${config.evmSettlement.chainId}.`,
            400,
            "UNSUPPORTED_EVM_CHAIN",
          ),
        );
      }

      if (
        body.evmSettlement.tokenAddress.toLowerCase() !==
        config.evmSettlement.tokenAddress.toLowerCase()
      ) {
        return next(
          new AppError(
            "Unsupported EVM settlement token address.",
            400,
            "UNSUPPORTED_EVM_TOKEN",
          ),
        );
      }

      const prepared = prepareFeeBump(body.xdr, config);
      const quotaCheck = await checkTenantDailyQuota(tenant, prepared.feeAmount);
      if (!quotaCheck.allowed) {
        return next(
          new AppError(
            `Tier limit exceeded. Spend ${quotaCheck.currentSpendStroops}/${quotaCheck.dailyQuotaStroops} stroops and transactions ${quotaCheck.currentTxCount}/${quotaCheck.txLimit} today.`,
            403,
            "QUOTA_EXCEEDED",
          ),
        );
      }

      const transactionRecord = await createPendingTransactionRecord(
        tenant.id,
        prepared,
      );
      const settlementService = getCrossChainSettlementService(
        config,
        createSettlementExecutor(config),
      );
      const settlement = await settlementService.enqueuePendingSettlement({
        transactionId: transactionRecord.id,
        tenantId: tenant.id,
        xdr: body.xdr,
        submit: body.submit || false,
        sourceChainId: body.evmSettlement.chainId,
        sourceTokenAddress: body.evmSettlement.tokenAddress,
        sourceAmount: body.evmSettlement.amount,
        payerAddress: body.evmSettlement.payerAddress,
        recipientAddress: config.evmSettlement.receiverAddress,
        confirmationsRequired: config.evmSettlement.confirmationsRequired,
        feePayerPublicKey: feePayerAccount.publicKey,
      });
      settlementService.ensureStarted();

      res.json({
        xdr: body.xdr,
        status: "awaiting_evm_payment",
        fee_payer: feePayerAccount.publicKey,
        settlement_id: settlement.settlementId,
        evm_payment: {
          chain_id: config.evmSettlement.chainId,
          token_address: config.evmSettlement.tokenAddress,
          amount: body.evmSettlement.amount,
          payer_address: body.evmSettlement.payerAddress.toLowerCase(),
          recipient_address: config.evmSettlement.receiverAddress.toLowerCase(),
          confirmations_required: config.evmSettlement.confirmationsRequired,
        },
      } satisfies FeeBumpResponse);
      return;
    }

    const response = await processFeeBump(
      body.xdr,
      body.submit || false,
      config,
      tenant,
      feePayerAccount
    );

    res.json(response);
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
    const results: FeeBumpResponse[] = await Promise.all(
      body.xdrs.map((xdr) => processFeeBump(xdr, body.submit ?? false, config, tenant, feePayerAccount))
    );

    res.json(results);
  } catch (error: any) {
    console.error("Error processing fee-bump batch request:", error);
    next(error);
  }
}
