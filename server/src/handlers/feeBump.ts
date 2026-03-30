import StellarSdk from "@stellar/stellar-sdk"
import { NextFunction, Request, Response } from "express"

import { Config, pickFeePayerAccount } from "../config"
import { AppError } from "../errors/AppError"
import { ApiKeyConfig } from "../middleware/apiKeys"
import { syncTenantFromApiKey } from "../models/tenantStore"
import {
  FeeBumpBatchRequest,
  FeeBumpBatchSchema,
  FeeBumpRequest,
  FeeBumpSchema,
} from "../schemas/feeBump"
import { SponsorFactory } from "../sponsors/factory"
import { StellarFeeSponsor } from "../sponsors/stellar"
import { nativeSigner } from "../signing/native"
import { verifyXdrNetwork } from "../utils/networkVerification"

export async function feeBumpHandler(
  req: Request,
  res: Response,
  next: NextFunction,
  config: Config,
): Promise<void> {
  try {
    const result = FeeBumpSchema.safeParse(req.body)

    if (!result.success) {
      return next(
        new AppError(
          `Validation failed: ${JSON.stringify(result.error.format())}`,
          400,
          "INVALID_XDR",
        ),
      )
    }

    const body: FeeBumpRequest = result.data
    const chainId = body.chainId || "stellar"
    const sponsor = SponsorFactory.getSponsor(chainId as any)

    const apiKeyConfig = res.locals.apiKey as ApiKeyConfig | undefined
    if (!apiKeyConfig) {
      res.status(500).json({ error: "Missing tenant context for fee sponsorship" })
      return
    }

    const tenant = syncTenantFromApiKey(apiKeyConfig)
    const feePayerAccount = pickFeePayerAccount(config)
    let params: any = { ...body, config, tenant, feePayerAccount }

    if (chainId === "stellar") {
      if (!body.xdr) {
        throw new AppError("Stellar requires xdr field", 400, "INVALID_XDR")
      }

      const networkCheck = verifyXdrNetwork(body.xdr, config.networkPassphrase)
      if (!networkCheck.valid) {
        throw new AppError(
          networkCheck.errorMessage ?? "Network mismatch",
          400,
          "NETWORK_MISMATCH",
        )
      }

      let innerTransaction: any
      try {
        innerTransaction = StellarSdk.TransactionBuilder.fromXDR(
          body.xdr,
          config.networkPassphrase,
        ) as any
      } catch (error: any) {
        throw new AppError(`Invalid XDR: ${error.message}`, 400, "INVALID_XDR")
      }

      const isSoroban = innerTransaction.operations.some((op: any) =>
        ["invokeHostFunction", "extendFootprintTtl", "restoreFootprint"].includes(op.type),
      )

      if (isSoroban) {
        if (!config.stellarRpcUrl) {
          throw new AppError(
            "Soroban transaction requires STELLAR_RPC_URL for preflight simulation",
            400,
            "INVALID_XDR",
          )
        }

        try {
          const updatedXdr = await nativeSigner.preflightSoroban(
            config.stellarRpcUrl,
            body.xdr,
          )
          params = { ...params, xdr: updatedXdr }
        } catch (error: any) {
          throw new AppError(
            `Soroban simulation failed: ${error.message}. The transaction would fail on-chain or out of gas.`,
            400,
            "INVALID_XDR",
          )
        }
      }

      if (body.token) {
        const supportedAssets = config.supportedAssets ?? []
        const isWhitelisted = supportedAssets.some((asset) => {
          const assetId = asset.issuer ? `${asset.code}:${asset.issuer}` : asset.code
          return body.token === assetId
        })

        if (!isWhitelisted) {
          throw new AppError(
            `Whitelisting failed: Asset "${body.token}" is not accepted for fee sponsorship.`,
            400,
            "UNSUPPORTED_ASSET",
          )
        }
      }
    }

    const response = await sponsor.buildSponsoredTx(params)

    res.json({
      fee_payer: response.feePayer,
      hash: response.hash,
      status: response.status,
      tx: response.tx,
      xdr: chainId === "stellar" ? response.tx : undefined,
    })
  } catch (error: any) {
    console.error("Error processing fee-bump request:", error)
    next(error)
  }
}

export async function feeBumpBatchHandler(
  req: Request,
  res: Response,
  next: NextFunction,
  config: Config,
): Promise<void> {
  try {
    const parsedBody = FeeBumpBatchSchema.safeParse(req.body)

    if (!parsedBody.success) {
      return next(
        new AppError(
          `Validation failed: ${JSON.stringify(parsedBody.error.format())}`,
          400,
          "INVALID_XDR",
        ),
      )
    }

    const body: FeeBumpBatchRequest = parsedBody.data
    const apiKeyConfig = res.locals.apiKey as ApiKeyConfig | undefined
    if (!apiKeyConfig) {
      res.status(500).json({ error: "Missing tenant context for fee sponsorship" })
      return
    }

    const tenant = syncTenantFromApiKey(apiKeyConfig)
    const feePayerAccount = pickFeePayerAccount(config)
    const stellarSponsor = new StellarFeeSponsor()

    const results = await Promise.all(
      body.xdrs.map((xdr) =>
        stellarSponsor.buildSponsoredTx({
          config,
          feePayerAccount,
          submit: body.submit ?? false,
          tenant,
          xdr,
        }),
      ),
    )

    res.json(results)
  } catch (error: any) {
    console.error("Error processing fee-bump batch request:", error)
    next(error)
  }
}
