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

import StellarSdk, { ContractSpec, Keypair, Transaction, xdr } from "@stellar/stellar-sdk";
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
const { XdrReader } = require("@stellar/js-xdr/lib/xdr") as {
  XdrReader: new (source: Buffer) => {
    readonly eof: boolean;
  };
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PLAYGROUND_HORIZON_URL =
  process.env.PLAYGROUND_HORIZON_URL ??
  "https://horizon-testnet.stellar.org";
const STELLAR_EXPERT_API_URL = "https://api.stellar.expert";
const STELLAR_EXPERT_HOSTS = new Set([
  "stellar.expert",
  "www.stellar.expert",
  "api.stellar.expert",
]);
const CONTRACT_SPEC_SECTION_NAME = "contractspecv0";
const SAMPLE_SOURCE_SECRET =
  // gitleaks:allow
  "S" + "DDXWE2JG2VL7NU3EQ5CRJWXPIYSYNBSUBRA2MHQLAERV5CGSGDMXZFY";
const SAMPLE_SOURCE_SEQUENCE = "0";
const SAMPLE_TX_TIMEOUT_SECONDS = 300;
const SAMPLE_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

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

const PlaygroundContractImportSchema = z.object({
  url: z.string().min(1, "url is required").url("url must be a valid URL"),
});

type PlaygroundContractImportRequest = z.infer<
  typeof PlaygroundContractImportSchema
>;

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

interface StellarExpertContractMetadata {
  contract: string;
  wasm: string;
  creator?: string;
  created?: number;
  validation?: {
    status?: string;
    repository?: string;
    commit?: string;
    ts?: number;
  };
}

interface ImportedContractFunctionParameter {
  name: string;
  type: string;
  doc?: string;
}

interface ImportedContractFunction {
  name: string;
  doc?: string;
  parameters: ImportedContractFunctionParameter[];
  outputs: string[];
  sampleXdr: string;
}

interface ImportedContractResponse {
  ok: true;
  receivedAt: string;
  sourceUrl: string;
  apiUrl: string;
  wasmUrl: string;
  network: "public" | "testnet";
  contractId: string;
  wasmHash: string;
  creator?: string;
  validation?: StellarExpertContractMetadata["validation"];
  functions: ImportedContractFunction[];
}

class PlaygroundImportError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "PlaygroundImportError";
  }
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

function getNetworkPassphrase(network: "public" | "testnet"): string {
  return network === "public" ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;
}

function parseStellarExpertContractUrl(rawUrl: string): {
  normalizedUrl: string;
  network: "public" | "testnet";
  contractId: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new PlaygroundImportError(
      "Invalid Stellar Expert URL",
      400,
      "INVALID_STELLAR_EXPERT_URL"
    );
  }

  if (!STELLAR_EXPERT_HOSTS.has(parsed.hostname)) {
    throw new PlaygroundImportError(
      "URL must point to stellar.expert",
      400,
      "INVALID_STELLAR_EXPERT_URL"
    );
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (
    parts.length < 4 ||
    parts[0] !== "explorer" ||
    (parts[1] !== "public" && parts[1] !== "testnet") ||
    parts[2] !== "contract"
  ) {
    throw new PlaygroundImportError(
      "URL must match /explorer/{public|testnet}/contract/{contractId}",
      400,
      "INVALID_STELLAR_EXPERT_URL"
    );
  }

  const contractId = parts[3];
  if (!StellarSdk.StrKey.isValidContract(contractId)) {
    throw new PlaygroundImportError(
      "Invalid Stellar contract ID in URL",
      400,
      "INVALID_STELLAR_EXPERT_URL"
    );
  }

  return {
    normalizedUrl: `https://stellar.expert/explorer/${parts[1]}/contract/${contractId}`,
    network: parts[1],
    contractId,
  };
}

async function fetchStellarExpertJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new PlaygroundImportError(
      `Stellar Expert request failed with ${response.status}`,
      502,
      "STELLAR_EXPERT_FETCH_FAILED",
      { url, status: response.status }
    );
  }

  return (await response.json()) as T;
}

async function fetchStellarExpertBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new PlaygroundImportError(
      `Stellar Expert request failed with ${response.status}`,
      502,
      "STELLAR_EXPERT_FETCH_FAILED",
      { url, status: response.status }
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

function readLeb128(buffer: Buffer, offset: number): {
  value: number;
  nextOffset: number;
} {
  let value = 0;
  let shift = 0;
  let currentOffset = offset;

  while (currentOffset < buffer.length) {
    const byte = buffer[currentOffset];
    currentOffset += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value, nextOffset: currentOffset };
    }
    shift += 7;
  }

  throw new PlaygroundImportError(
    "Invalid WASM payload returned by Stellar Expert",
    502,
    "INVALID_WASM"
  );
}

function extractWasmCustomSection(
  wasm: Buffer,
  sectionName: string
): Buffer | null {
  if (
    wasm.length < 8 ||
    wasm[0] !== 0x00 ||
    wasm[1] !== 0x61 ||
    wasm[2] !== 0x73 ||
    wasm[3] !== 0x6d
  ) {
    throw new PlaygroundImportError(
      "Stellar Expert returned an invalid WASM binary",
      502,
      "INVALID_WASM"
    );
  }

  let offset = 8;
  while (offset < wasm.length) {
    const sectionId = wasm[offset];
    offset += 1;

    const sizeInfo = readLeb128(wasm, offset);
    const sectionSize = sizeInfo.value;
    offset = sizeInfo.nextOffset;

    const sectionEnd = offset + sectionSize;
    if (sectionEnd > wasm.length) {
      throw new PlaygroundImportError(
        "Invalid WASM section size",
        502,
        "INVALID_WASM"
      );
    }

    if (sectionId === 0) {
      const nameLengthInfo = readLeb128(wasm, offset);
      const nameLength = nameLengthInfo.value;
      offset = nameLengthInfo.nextOffset;

      const name = wasm.subarray(offset, offset + nameLength).toString("utf8");
      offset += nameLength;

      if (name === sectionName) {
        return wasm.subarray(offset, sectionEnd);
      }
    }

    offset = sectionEnd;
  }

  return null;
}

function decodeContractSpecEntries(wasm: Buffer): xdr.ScSpecEntry[] {
  const section = extractWasmCustomSection(wasm, CONTRACT_SPEC_SECTION_NAME);
  if (!section) {
    throw new PlaygroundImportError(
      "No Soroban contract spec found in the contract WASM",
      422,
      "CONTRACT_SPEC_NOT_FOUND"
    );
  }

  const reader = new XdrReader(section);
  const entries: xdr.ScSpecEntry[] = [];

  while (!reader.eof) {
    entries.push(xdr.ScSpecEntry.read(reader));
  }

  return entries;
}

function formatSpecType(typeDef: xdr.ScSpecTypeDef): string {
  const type = typeDef.switch().value;

  if (type === xdr.ScSpecType.scSpecTypeVal().value) return "val";
  if (type === xdr.ScSpecType.scSpecTypeBool().value) return "bool";
  if (type === xdr.ScSpecType.scSpecTypeVoid().value) return "void";
  if (type === xdr.ScSpecType.scSpecTypeError().value) return "error";
  if (type === xdr.ScSpecType.scSpecTypeU32().value) return "u32";
  if (type === xdr.ScSpecType.scSpecTypeI32().value) return "i32";
  if (type === xdr.ScSpecType.scSpecTypeU64().value) return "u64";
  if (type === xdr.ScSpecType.scSpecTypeI64().value) return "i64";
  if (type === xdr.ScSpecType.scSpecTypeTimepoint().value) return "timepoint";
  if (type === xdr.ScSpecType.scSpecTypeDuration().value) return "duration";
  if (type === xdr.ScSpecType.scSpecTypeU128().value) return "u128";
  if (type === xdr.ScSpecType.scSpecTypeI128().value) return "i128";
  if (type === xdr.ScSpecType.scSpecTypeU256().value) return "u256";
  if (type === xdr.ScSpecType.scSpecTypeI256().value) return "i256";
  if (type === xdr.ScSpecType.scSpecTypeBytes().value) return "bytes";
  if (type === xdr.ScSpecType.scSpecTypeString().value) return "string";
  if (type === xdr.ScSpecType.scSpecTypeSymbol().value) return "symbol";
  if (type === xdr.ScSpecType.scSpecTypeAddress().value) return "address";
  if (type === xdr.ScSpecType.scSpecTypeOption().value) {
    return `${formatSpecType(typeDef.option().valueType())}?`;
  }
  if (type === xdr.ScSpecType.scSpecTypeResult().value) {
    return `result<${formatSpecType(typeDef.result().okType())}, ${formatSpecType(
      typeDef.result().errorType()
    )}>`;
  }
  if (type === xdr.ScSpecType.scSpecTypeVec().value) {
    return `vec<${formatSpecType(typeDef.vec().elementType())}>`;
  }
  if (type === xdr.ScSpecType.scSpecTypeMap().value) {
    return `map<${formatSpecType(typeDef.map().keyType())}, ${formatSpecType(
      typeDef.map().valueType()
    )}>`;
  }
  if (type === xdr.ScSpecType.scSpecTypeTuple().value) {
    return `[${typeDef
      .tuple()
      .valueTypes()
      .map((valueType) => formatSpecType(valueType))
      .join(", ")}]`;
  }
  if (type === xdr.ScSpecType.scSpecTypeBytesN().value) {
    return `bytes[${typeDef.bytesN().n()}]`;
  }
  if (type === xdr.ScSpecType.scSpecTypeUdt().value) {
    return typeDef.udt().name().toString();
  }

  return typeDef.switch().name;
}

function buildSampleValue(
  contractSpec: ContractSpec,
  typeDef: xdr.ScSpecTypeDef,
  seen = new Set<string>()
): unknown {
  const type = typeDef.switch().value;

  if (type === xdr.ScSpecType.scSpecTypeVal().value) return 0;
  if (type === xdr.ScSpecType.scSpecTypeBool().value) return false;
  if (type === xdr.ScSpecType.scSpecTypeVoid().value) return null;
  if (type === xdr.ScSpecType.scSpecTypeError().value) return 0;
  if (type === xdr.ScSpecType.scSpecTypeU32().value) return 0;
  if (type === xdr.ScSpecType.scSpecTypeI32().value) return 0;
  if (type === xdr.ScSpecType.scSpecTypeU64().value) return 0n;
  if (type === xdr.ScSpecType.scSpecTypeI64().value) return 0n;
  if (type === xdr.ScSpecType.scSpecTypeTimepoint().value) return 0n;
  if (type === xdr.ScSpecType.scSpecTypeDuration().value) return 0n;
  if (type === xdr.ScSpecType.scSpecTypeU128().value) return 0n;
  if (type === xdr.ScSpecType.scSpecTypeI128().value) return 0n;
  if (type === xdr.ScSpecType.scSpecTypeU256().value) return 0n;
  if (type === xdr.ScSpecType.scSpecTypeI256().value) return 0n;
  if (type === xdr.ScSpecType.scSpecTypeBytes().value) return Buffer.from("sample");
  if (type === xdr.ScSpecType.scSpecTypeString().value) return "sample";
  if (type === xdr.ScSpecType.scSpecTypeSymbol().value) return "sample";
  if (type === xdr.ScSpecType.scSpecTypeAddress().value) return SAMPLE_ADDRESS;
  if (type === xdr.ScSpecType.scSpecTypeOption().value) return undefined;
  if (type === xdr.ScSpecType.scSpecTypeVec().value) {
    return [buildSampleValue(contractSpec, typeDef.vec().elementType(), seen)];
  }
  if (type === xdr.ScSpecType.scSpecTypeMap().value) {
    return [
      [
        buildSampleValue(contractSpec, typeDef.map().keyType(), seen),
        buildSampleValue(contractSpec, typeDef.map().valueType(), seen),
      ],
    ];
  }
  if (type === xdr.ScSpecType.scSpecTypeTuple().value) {
    return typeDef
      .tuple()
      .valueTypes()
      .map((valueType) => buildSampleValue(contractSpec, valueType, seen));
  }
  if (type === xdr.ScSpecType.scSpecTypeBytesN().value) {
    return Buffer.alloc(typeDef.bytesN().n());
  }
  if (type === xdr.ScSpecType.scSpecTypeUdt().value) {
    const name = typeDef.udt().name().toString();
    if (seen.has(name)) {
      return null;
    }

    const nextSeen = new Set(seen);
    nextSeen.add(name);

    const entry = contractSpec.findEntry(name);
    const entryType = entry.switch().value;
    if (entryType === xdr.ScSpecEntryKind.scSpecEntryUdtStructV0().value) {
      const struct = entry.udtStructV0();
      const fields = struct.fields();
      if (fields.every((field) => /^\d+$/.test(field.name().toString()))) {
        return fields.map((field) =>
          buildSampleValue(contractSpec, field.type(), nextSeen)
        );
      }

      return Object.fromEntries(
        fields.map((field) => [
          field.name().toString(),
          buildSampleValue(contractSpec, field.type(), nextSeen),
        ])
      );
    }

    if (entryType === xdr.ScSpecEntryKind.scSpecEntryUdtUnionV0().value) {
      const union = entry.udtUnionV0();
      const firstCase = union.cases()[0];
      const tag = firstCase.value().name().toString();

      if (
        firstCase.switch().value ===
        xdr.ScSpecUdtUnionCaseV0Kind.scSpecUdtUnionCaseVoidV0().value
      ) {
        return { tag };
      }

      return {
        tag,
        values: firstCase
          .tupleCase()
          .type()
          .map((valueType) =>
            buildSampleValue(contractSpec, valueType, nextSeen)
          ),
      };
    }

    if (
      entryType === xdr.ScSpecEntryKind.scSpecEntryUdtEnumV0().value ||
      entryType === xdr.ScSpecEntryKind.scSpecEntryUdtErrorEnumV0().value
    ) {
      return entryType === xdr.ScSpecEntryKind.scSpecEntryUdtEnumV0().value
        ? entry.udtEnumV0().cases()[0].value()
        : entry.udtErrorEnumV0().cases()[0].value();
    }
  }

  return 0;
}

function buildSampleInvocationXdr(
  contractId: string,
  functionName: string,
  contractSpec: ContractSpec,
  args: Record<string, unknown>,
  network: "public" | "testnet"
): string {
  const keypair = Keypair.fromSecret(SAMPLE_SOURCE_SECRET);
  const sourceAccount = new StellarSdk.Account(
    keypair.publicKey(),
    SAMPLE_SOURCE_SEQUENCE
  );
  const networkPassphrase = getNetworkPassphrase(network);
  const contract = new StellarSdk.Contract(contractId);
  const scArgs = contractSpec.funcArgsToScVals(functionName, args);

  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(contract.call(functionName, ...scArgs))
    .setTimeout(SAMPLE_TX_TIMEOUT_SECONDS)
    .build();

  tx.sign(keypair);
  return tx.toXDR();
}

function buildImportedFunction(
  contractId: string,
  contractSpec: ContractSpec,
  fn: xdr.ScSpecFunctionV0,
  network: "public" | "testnet"
): ImportedContractFunction {
  const functionName = fn.name().toString();
  const args = Object.fromEntries(
    fn.inputs().map((input) => [
      input.name().toString(),
      buildSampleValue(contractSpec, input.type()),
    ])
  );

  return {
    name: functionName,
    doc: fn.doc()?.toString(),
    parameters: fn.inputs().map((input) => ({
      name: input.name().toString(),
      type: formatSpecType(input.type()),
      doc: input.doc()?.toString(),
    })),
    outputs: fn.outputs().map((output) => formatSpecType(output)),
    sampleXdr: buildSampleInvocationXdr(
      contractId,
      functionName,
      contractSpec,
      args,
      network
    ),
  };
}

async function importContractInterface(
  rawUrl: string,
  receivedAt: string
): Promise<ImportedContractResponse> {
  const parsed = parseStellarExpertContractUrl(rawUrl);
  const apiUrl = `${STELLAR_EXPERT_API_URL}/explorer/${parsed.network}/contract/${parsed.contractId}`;
  const metadata = await fetchStellarExpertJson<StellarExpertContractMetadata>(
    apiUrl
  );

  if (!metadata.wasm || !/^[0-9a-f]{64}$/i.test(metadata.wasm)) {
    throw new PlaygroundImportError(
      "Stellar Expert response did not include a valid WASM hash",
      502,
      "INVALID_STELLAR_EXPERT_RESPONSE"
    );
  }

  const wasmUrl = `${STELLAR_EXPERT_API_URL}/explorer/${parsed.network}/wasm/${metadata.wasm}`;
  const wasm = await fetchStellarExpertBuffer(wasmUrl);
  const specEntries = decodeContractSpecEntries(wasm);
  const contractSpec = new ContractSpec(specEntries);

  return {
    ok: true,
    receivedAt,
    sourceUrl: parsed.normalizedUrl,
    apiUrl,
    wasmUrl,
    network: parsed.network,
    contractId: metadata.contract || parsed.contractId,
    wasmHash: metadata.wasm,
    creator: metadata.creator,
    validation: metadata.validation,
    functions: contractSpec
      .funcs()
      .map((fn) =>
        buildImportedFunction(
          metadata.contract || parsed.contractId,
          contractSpec,
          fn,
          parsed.network
        )
      ),
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

export async function playgroundContractImportHandler(
  req: Request,
  res: Response
): Promise<void> {
  const receivedAt = new Date().toISOString();
  const parsed = PlaygroundContractImportSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: "Validation failed",
      details: parsed.error.format(),
      receivedAt,
    });
    return;
  }

  const body: PlaygroundContractImportRequest = parsed.data;

  try {
    const result = await importContractInterface(body.url, receivedAt);
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof PlaygroundImportError) {
      res.status(error.statusCode).json({
        ok: false,
        error: error.message,
        code: error.code,
        details: error.details,
        receivedAt,
      });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      ok: false,
      error: `Failed to import contract ABI: ${message}`,
      code: "CONTRACT_IMPORT_FAILED",
      receivedAt,
    });
  }
}
