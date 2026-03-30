/**
 * Playground handler
 *
 * POST /playground/fee-bump
 *
 * A lightweight, unauthenticated proxy that lets browser-based playgrounds
 * try the fee-bump flow without needing a valid API key or database.
 *
 * - Decodes the inner XDR client-side (the browser component handles this)
 * - Wraps the transaction in a fee-bump using a dedicated playground keypair
 * - Submits (or returns ready XDR) against the public Testnet Horizon
 * - Returns the full request + response envelope for display
 *
 * Rate limited separately to 10 requests / minute / IP.
 * No database writes are made; this is purely a demonstration path.
 */

import StellarSdk, { Keypair, Transaction } from "@stellar/stellar-sdk";
import { Request, Response, NextFunction } from "express";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PLAYGROUND_HORIZON_URL =
  process.env.PLAYGROUND_HORIZON_URL ??
  "https://horizon-testnet.stellar.org";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

/** Maximum XDR string length accepted from the browser (10 KB). */
const MAX_XDR_LENGTH = 10_240;

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

export const PlaygroundSchema = z.object({
  xdr: z
    .string()
    .min(1, "xdr is required")
    .max(MAX_XDR_LENGTH, `xdr must be ≤ ${MAX_XDR_LENGTH} characters`),
  network: z.enum(["testnet", "mainnet"]).default("testnet"),
  /** Optional API key shown in the playground (recorded in response for display; not verified). */
  apiKey: z.string().optional(),
  /** Whether to submit the fee-bumped transaction to Horizon. */
  submit: z.boolean().default(true),
});

export type PlaygroundRequest = z.infer<typeof PlaygroundSchema>;

// ---------------------------------------------------------------------------
// Utility: decode XDR → structured operation list
// ---------------------------------------------------------------------------

export interface DecodedOperation {
  type: string;
  source?: string;
  [key: string]: unknown;
}

export interface DecodedTransaction {
  hash: string;
  fee: string;
  sequenceNumber: string;
  sourceAccount: string;
  operations: DecodedOperation[];
  signatures: number;
  memo: string;
}

export function decodeXdr(
  xdr: string,
  networkPassphrase: string
): DecodedTransaction {
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    xdr,
    networkPassphrase
  ) as Transaction;

  const ops: DecodedOperation[] = tx.operations.map((op) => {
    const { type, source, ...rest } = op as Record<string, unknown> & {
      type: string;
      source?: string;
    };
    return { type, source, ...rest };
  });

  let memoStr = "none";
  if (tx.memo && tx.memo.type !== "none") {
    memoStr = tx.memo.type;
    if ("value" in tx.memo && tx.memo.value) {
      memoStr += `:${tx.memo.value.toString()}`;
    }
  }

  return {
    hash: tx.hash().toString("hex"),
    fee: tx.fee,
    sequenceNumber: tx.sequence,
    sourceAccount: tx.source,
    operations: ops,
    signatures: tx.signatures.length,
    memo: memoStr,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function playgroundFeeBumpHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const receivedAt = new Date().toISOString();

  // 1. Validate request body
  const parsed = PlaygroundSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: "Validation failed",
      details: parsed.error.format(),
      receivedAt,
    });
    return;
  }

  const body: PlaygroundRequest = parsed.data;
  const networkPassphrase =
    body.network === "mainnet" ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;

  // -------------------------------------------------------------------------
  // 2. Decode & validate inner XDR
  // -------------------------------------------------------------------------
  let innerTx: Transaction;
  let decoded: DecodedTransaction;

  try {
    innerTx = StellarSdk.TransactionBuilder.fromXDR(
      body.xdr,
      networkPassphrase
    ) as Transaction;

    if ("innerTransaction" in innerTx) {
      res.status(400).json({
        ok: false,
        error: "Cannot fee-bump an already fee-bumped transaction",
        code: "ALREADY_FEE_BUMPED",
        receivedAt,
      });
      return;
    }

    if (!innerTx.signatures || innerTx.signatures.length === 0) {
      res.status(400).json({
        ok: false,
        error: "Inner transaction must be signed before fee-bumping",
        code: "UNSIGNED_TRANSACTION",
        receivedAt,
      });
      return;
    }

    decoded = decodeXdr(body.xdr, networkPassphrase);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({
      ok: false,
      error: `Invalid XDR: ${message}`,
      code: "INVALID_XDR",
      receivedAt,
    });
    return;
  }

  // -------------------------------------------------------------------------
  // 3. Build fee-bump transaction using a throw-away playground keypair.
  //    The keypair is regenerated every request — it is intentionally
  //    ephemeral because Testnet accounts are free via Friendbot.
  //
  //    For a production playground, you would load a funded Testnet keypair
  //    from PLAYGROUND_FEE_PAYER_SECRET.
  // -------------------------------------------------------------------------
  const playgroundSecret = process.env.PLAYGROUND_FEE_PAYER_SECRET;
  if (!playgroundSecret) {
    res.status(503).json({
      ok: false,
      error:
        "Playground fee payer not configured. Set PLAYGROUND_FEE_PAYER_SECRET in environment.",
      code: "PLAYGROUND_NOT_CONFIGURED",
      receivedAt,
    });
    return;
  }

  let feePayerKeypair: Keypair;
  try {
    feePayerKeypair = Keypair.fromSecret(playgroundSecret);
  } catch {
    res.status(503).json({
      ok: false,
      error: "Invalid PLAYGROUND_FEE_PAYER_SECRET",
      code: "PLAYGROUND_CONFIG_ERROR",
      receivedAt,
    });
    return;
  }

  // Build the fee-bump tx
  const BASE_FEE = 200; // 200 stroops — generous for playground
  let feeBumpXdr: string;
  let feeBumpHash: string;

  try {
    const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      feePayerKeypair,
      (BASE_FEE * (innerTx.operations.length || 1)).toString(),
      innerTx,
      networkPassphrase
    );
    feeBumpTx.sign(feePayerKeypair);
    feeBumpXdr = feeBumpTx.toXDR();
    feeBumpHash = feeBumpTx.hash().toString("hex");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    next(err);
    res.status(500).json({
      ok: false,
      error: `Failed to build fee-bump transaction: ${message}`,
      code: "FEE_BUMP_BUILD_FAILED",
      receivedAt,
    });
    return;
  }

  // -------------------------------------------------------------------------
  // 4. Optionally submit to Horizon (Testnet only for safety)
  // -------------------------------------------------------------------------
  let submissionResult: Record<string, unknown> | null = null;
  let submissionError: string | null = null;

  if (body.submit && body.network === "testnet") {
    const horizonUrl = PLAYGROUND_HORIZON_URL;
    try {
      const server = new StellarSdk.Horizon.Server(horizonUrl);
      const feeBumpTxObj = StellarSdk.TransactionBuilder.fromXDR(
        feeBumpXdr,
        networkPassphrase
      ) as unknown as Parameters<typeof server.submitTransaction>[0];
      const result = await server.submitTransaction(feeBumpTxObj);
      submissionResult = {
        hash: result.hash,
        ledger: result.ledger,
        envelope_xdr: result.envelope_xdr,
        result_xdr: result.result_xdr,
        result_meta_xdr: result.result_meta_xdr,
      };
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const horizonErr = err as {
          response?: { data?: unknown; status?: number };
        };
        submissionError = JSON.stringify(
          horizonErr.response?.data ?? String(err)
        );
      } else {
        submissionError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Build full request/response envelope for display
  // -------------------------------------------------------------------------
  const requestEnvelope = {
    method: "POST",
    url: `${PLAYGROUND_HORIZON_URL}/transactions`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Api-Key": body.apiKey ?? "sbx_playground_demo",
    },
    body: {
      tx: feeBumpXdr,
    },
  };

  const responseEnvelope = submissionResult
    ? { status: 200, data: submissionResult }
    : submissionError
      ? { status: 400, data: { error: submissionError } }
      : body.submit && body.network !== "testnet"
        ? {
            status: 200,
            data: {
              note: "Mainnet submission is disabled in the playground for safety. Fee-bumped XDR is returned ready-to-submit.",
            },
          }
        : { status: 200, data: { note: "Submission skipped (submit=false)" } };

  res.json({
    ok: true,
    receivedAt,
    network: body.network,
    decoded,
    feeBumpXdr,
    feeBumpHash,
    feePayer: feePayerKeypair.publicKey(),
    submitted: body.submit && body.network === "testnet",
    request: requestEnvelope,
    response: responseEnvelope,
  });
}
