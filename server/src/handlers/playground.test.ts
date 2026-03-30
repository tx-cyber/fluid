/**
 * Unit tests for the playground fee-bump handler.
 *
 * These tests exercise `decodeXdr` and the handler logic using mocked
 * Stellar SDK and fetch calls — no real network requests are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import * as StellarSdk from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// We need a real signed testnet transaction XDR for tests.
// We generate one deterministically using a fixed keypair.
// ---------------------------------------------------------------------------

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

function buildSignedTestnetXdr(): string {
  const sourceKp = StellarSdk.Keypair.fromSecret(
    // gitleaks:allow
    "S" + "DDXWE2JG2VL7NU3EQ5CRJWXPIYSYNBSUBRA2MHQLAERV5CGSGDMXZFY"
  );

  const tx = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(sourceKp.publicKey(), "0"),
    {
      fee: "100",
      networkPassphrase: TESTNET_PASSPHRASE,
    }
  )
    .addOperation(
      StellarSdk.Operation.payment({
            destination:
          "GCCAXCM6VOXWFM2BHNFI7FEYAQ46M6NUW5XMP5TKL6LN52XW4KRMLFA2",
        asset: StellarSdk.Asset.native(),
        amount: "10",
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(sourceKp);
  return tx.toXDR();
}

const VALID_XDR = buildSignedTestnetXdr();
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const SAMPLE_CONTRACT_URL =
  "https://stellar.expert/explorer/public/contract/CCK5PTLH5F5QQZP4HEJF3RMMTIDROHHUSCK4CQMLBGOA4MKJXTWEUEAR";
const SAMPLE_CONTRACT_ID =
  "CCK5PTLH5F5QQZP4HEJF3RMMTIDROHHUSCK4CQMLBGOA4MKJXTWEUEAR";
const SAMPLE_WASM_HASH =
  "a89ca4283f5a713b476842a3ef8ba16c19e9ac42826b87907cad3bdc01356b56";
const SAMPLE_SPEC_ENTRIES = [
  "AAAAAAAAAhpJbml0aWFsaXplIHRoZSBjb250cmFjdAoKIyMjIEFyZ3VtZW50cwoqIGBhZG1pbmAgLSBUaGUgYWRtaW4gb2YgdGhlIGxvY2t1cCBjb250cmFjdAoqIGBvd25lcmAgLSBUaGUgb3duZXIgb2YgdGhlIGxvY2t1cCBjb250cmFjdAoqIGB0b2tlbmAgLSBUaGUgdG9rZW4gdG8gbG9jayB1cAoqIGB1bmxvY2tzYCAtIEEgdmVjdG9yIG9mIHVubG9ja3MuIFBlcmNlbnRhZ2VzIHJlcHJlc2VudCB0aGUgcG9ydGlvbiBvZiB0aGUgbG9ja3VwcyB0b2tlbiBiYWxhbmNlIGNhbiBiZSBjbGFpbWVkCmF0IHRoZSBnaXZlbiB1bmxvY2sgdGltZS4gSWYgbXVsdGlwbGUgdW5sb2NrcyBhcmUgY2xhaW1lZCBhdCBvbmNlLCB0aGUgcGVyY2VudGFnZXMgYXJlIGFwcGxpZWQgaW4gb3JkZXIuCgojIyMgRXJyb3JzCiogQWxyZWFkeUluaXRpYWxpemVkRXJyb3IgLSBUaGUgY29udHJhY3QgaGFzIGFscmVhZHkgYmVlbiBpbml0aWFsaXplZAoqIEludmFsaWRVbmxvY2tzIC0gVGhlIHVubG9jayB0aW1lcyBkbyBub3QgcmVwcmVzZW50IGEgdmFsaWQgdW5sb2NrIHNlcXVlbmNlAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAB3VubG9ja3MAAAAD6gAAB9AAAAAGVW5sb2NrAAAAAAAA",
  "AAAAAAAAABpHZXQgdW5sb2NrcyBmb3IgdGhlIGxvY2t1cAAAAAAAB3VubG9ja3MAAAAAAAAAAAEAAAPqAAAH0AAAAAZVbmxvY2sAAA==",
  "AAAAAAAAABVHZXQgdGhlIGFkbWluIGFkZHJlc3MAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
  "AAAAAAAAABVHZXQgdGhlIG93bmVyIGFkZHJlc3MAAAAAAAAFb3duZXIAAAAAAAAAAAAAAQAAABM=",
  "AAAAAAAAAUwoT25seSBhZG1pbikgU2V0IG5ldyB1bmxvY2tzIGZvciB0aGUgbG9ja3VwLiBUaGUgbmV3IHVubG9ja3MgbXVzdCByZXRhaW4KYW55IGV4aXN0aW5nIHVubG9ja3MgdGhhdCBoYXZlIGFscmVhZHkgcGFzc2VkIHRoZWlyIHVubG9jayB0aW1lLgoKIyMjIEFyZ3VtZW50cwoqIGBuZXdfdW5sb2Nrc2AgLSBUaGUgbmV3IHVubG9ja3MgdG8gc2V0CgojIyMgRXJyb3JzCiogVW5hdXRob3JpemVkRXJyb3IgLSBUaGUgY2FsbGVyIGlzIG5vdCB0aGUgYWRtaW4KKiBJbnZhbGlkVW5sb2NrcyAtIFRoZSB1bmxvY2sgdGltZXMgZG8gbm90IHJlcHJlc2VudCBhIHZhbGlkIHVubG9jayBzZXF1ZW5jZQAAAAtzZXRfdW5sb2NrcwAAAAABAAAAAAAAAAtuZXdfdW5sb2NrcwAAAAPqAAAH0AAAAAZVbmxvY2sAAAAAAAA=",
  "AAAAAAAAAQsoT25seSBvd25lcikgQ2xhaW0gdGhlIHVubG9ja2VkIHRva2Vucy4gVGhlIHRva2VucyBhcmUgdHJhbnNmZXJyZWQgdG8gdGhlIG93bmVyLgoKIyMjIEFyZ3VtZW50cwoqIGB0b2tlbnNgIC0gQSB2ZWN0b3Igb2YgdG9rZW5zIHRvIGNsYWltCgojIyMgRXJyb3JzCiogVW5hdXRob3JpemVkRXJyb3IgLSBUaGUgY2FsbGVyIGlzIG5vdCB0aGUgb3duZXIKKiBOb1VubG9ja2VkVG9rZW5zIC0gVGhlcmUgYXJlIG5vdCB0b2tlbnMgdG8gY2xhaW0gZm9yIGEgZ2l2ZW4gYXNzZXQAAAAABWNsYWltAAAAAAAAAQAAAAAAAAAGdG9rZW5zAAAAAAPqAAAAEwAAAAA=",
  "AAAABAAAACFUaGUgZXJyb3IgY29kZXMgZm9yIHRoZSBjb250cmFjdC4AAAAAAAAAAAAAEFRva2VuTG9ja3VwRXJyb3IAAAAKAAAAAAAAAA1JbnRlcm5hbEVycm9yAAAAAAAAAQAAAAAAAAAXQWxyZWFkeUluaXRpYWxpemVkRXJyb3IAAAAAAwAAAAAAAAARVW5hdXRob3JpemVkRXJyb3IAAAAAAAAEAAAAAAAAABNOZWdhdGl2ZUFtb3VudEVycm9yAAAAAAgAAAAAAAAADkFsbG93YW5jZUVycm9yAAAAAAAJAAAAAAAAAAxCYWxhbmNlRXJyb3IAAAAKAAAAAAAAAA1PdmVyZmxvd0Vycm9yAAAAAAAADAAAAAAAAAAOSW52YWxpZFVubG9ja3MAAAAAAGQAAAAAAAAAEE5vVW5sb2NrZWRUb2tlbnMAAABlAAAAAAAAAA9BbHJlYWR5VW5sb2NrZWQAAAAAZg==",
  "AAAAAQAAAAAAAAAAAAAABlVubG9jawAAAAAAAgAAAC9UaGUgYW1vdW50IG9mIGN1cnJlbnQgdG9rZW5zIChpbiBicHMpIHRvIHVubG9jawAAAAAHcGVyY2VudAAAAAAEAAAALlRoZSBsZWRnZXIgdGltZSAoaW4gc2Vjb25kcykgdGhlIHVubG9jayBvY2N1cnMAAAAAAAR0aW1lAAAABg==",
] as const;

// ---------------------------------------------------------------------------
// Helpers to create mock Express req/res/next
// ---------------------------------------------------------------------------

function mockRes(): {
  res: Partial<Response>;
  statusCode: { value: number };
  body: { value: unknown };
} {
  const statusCode = { value: 200 };
  const body = { value: null as unknown };
  const res: Partial<Response> = {
    status: vi.fn().mockImplementation((code: number) => {
      statusCode.value = code;
      return res as Response;
    }),
    json: vi.fn().mockImplementation((data: unknown) => {
      body.value = data;
      return res as Response;
    }),
    locals: {},
  };
  return { res, statusCode, body };
}

function mockReq(body: unknown): Partial<Request> {
  return { body } as Partial<Request>;
}

const mockNext: NextFunction = vi.fn() as unknown as NextFunction;

function encodeLeb128(value: number): number[] {
  const bytes: number[] = [];
  let current = value;

  do {
    let byte = current & 0x7f;
    current >>>= 7;
    if (current !== 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (current !== 0);

  return bytes;
}

function buildContractSpecWasm(specEntries: readonly string[]): Buffer {
  const payload = Buffer.concat(
    specEntries.map((entry) => Buffer.from(entry, "base64"))
  );
  const sectionName = Buffer.from("contractspecv0", "utf8");
  const sectionBody = Buffer.concat([
    Buffer.from(encodeLeb128(sectionName.length)),
    sectionName,
    payload,
  ]);

  return Buffer.concat([
    Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
    Buffer.from([0x00]),
    Buffer.from(encodeLeb128(sectionBody.length)),
    sectionBody,
  ]);
}

// ---------------------------------------------------------------------------
// Tests for decodeXdr utility
// ---------------------------------------------------------------------------

import { decodeXdr } from "./playground";

describe("decodeXdr", () => {
  it("decodes a valid signed transaction XDR", () => {
    const decoded = decodeXdr(VALID_XDR, TESTNET_PASSPHRASE);

    expect(decoded.operations).toHaveLength(1);
    expect(decoded.operations[0].type).toBe("payment");
    expect(decoded.signatures).toBeGreaterThan(0);
    expect(decoded.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(decoded.sourceAccount).toBeTruthy();
  });

  it("throws on invalid XDR", () => {
    expect(() => decodeXdr("not-valid-xdr", TESTNET_PASSPHRASE)).toThrow();
  });

  it("produces a different hash when decoded with wrong network passphrase", () => {
    // stellar-sdk does NOT throw when passphrase is wrong — it decodes the XDR
    // but produces a different transaction hash (the hash includes the passphrase).
    const testnetDecoded = decodeXdr(VALID_XDR, TESTNET_PASSPHRASE);
    const mainnetDecoded = decodeXdr(
      VALID_XDR,
      "Public Global Stellar Network ; September 2015"
    );
    // Same operations but different hashes because of different network passphrase
    expect(testnetDecoded.operations).toHaveLength(mainnetDecoded.operations.length);
    expect(testnetDecoded.hash).not.toBe(mainnetDecoded.hash);
  });
});

// ---------------------------------------------------------------------------
// Tests for playgroundFeeBumpHandler
// ---------------------------------------------------------------------------

import { playgroundFeeBumpHandler } from "./playground";
import { playgroundContractImportHandler } from "./playground";

describe("playgroundFeeBumpHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set the required env variable for all tests
    // gitleaks:allow
    process.env.PLAYGROUND_FEE_PAYER_SECRET =
      "S" + "DDXWE2JG2VL7NU3EQ5CRJWXPIYSYNBSUBRA2MHQLAERV5CGSGDMXZFY";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 when xdr is missing", async () => {
    const { res, statusCode, body } = mockRes();
    await playgroundFeeBumpHandler(
      mockReq({}) as Request,
      res as Response,
      mockNext
    );

    expect(statusCode.value).toBe(400);
    expect((body.value as { ok: boolean }).ok).toBe(false);
  });

  it("returns 400 when xdr is invalid base64", async () => {
    const { res, statusCode, body } = mockRes();
    await playgroundFeeBumpHandler(
      mockReq({ xdr: "this-is-not-valid-xdr", network: "testnet" }) as Request,
      res as Response,
      mockNext
    );

    expect(statusCode.value).toBe(400);
    const result = body.value as { ok: boolean; code: string };
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_XDR");
  });

  it("returns 400 when xdr exceeds max length", async () => {
    const { res, statusCode, body } = mockRes();
    const longXdr = "A".repeat(11_000);
    await playgroundFeeBumpHandler(
      mockReq({ xdr: longXdr, network: "testnet" }) as Request,
      res as Response,
      mockNext
    );

    expect(statusCode.value).toBe(400);
    expect((body.value as { ok: boolean }).ok).toBe(false);
  });

  it("returns 503 when PLAYGROUND_FEE_PAYER_SECRET is not set", async () => {
    delete process.env.PLAYGROUND_FEE_PAYER_SECRET;

    const { res, statusCode, body } = mockRes();
    await playgroundFeeBumpHandler(
      mockReq({ xdr: VALID_XDR, network: "testnet", submit: false }) as Request,
      res as Response,
      mockNext
    );

    expect(statusCode.value).toBe(503);
    const result = body.value as { code: string };
    expect(result.code).toBe("PLAYGROUND_NOT_CONFIGURED");
  });

  it("returns 400 for already-fee-bumped XDR", async () => {
    // Build a fee-bump XDR around the valid inner XDR
    const feePayerKp = StellarSdk.Keypair.fromSecret(
      // gitleaks:allow
      "S" + "DDXWE2JG2VL7NU3EQ5CRJWXPIYSYNBSUBRA2MHQLAERV5CGSGDMXZFY"
    );
    const innerTx = StellarSdk.TransactionBuilder.fromXDR(
      VALID_XDR,
      TESTNET_PASSPHRASE
    ) as StellarSdk.Transaction;
    const feeBump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      feePayerKp,
      "200",
      innerTx,
      TESTNET_PASSPHRASE
    );
    feeBump.sign(feePayerKp);
    const feeBumpXdr = feeBump.toXDR();

    const { res, statusCode, body } = mockRes();
    await playgroundFeeBumpHandler(
      mockReq({ xdr: feeBumpXdr, network: "testnet", submit: false }) as Request,
      res as Response,
      mockNext
    );

    expect(statusCode.value).toBe(400);
    const result = body.value as { code: string };
    expect(result.code).toBe("ALREADY_FEE_BUMPED");
  });

  it("returns decoded XDR + feeBumpXdr without submission when submit=false", async () => {
    const { res, body } = mockRes();
    await playgroundFeeBumpHandler(
      mockReq({
        xdr: VALID_XDR,
        network: "testnet",
        submit: false,
        apiKey: "sbx_test_key",
      }) as Request,
      res as Response,
      mockNext
    );

    const result = body.value as {
      ok: boolean;
      decoded: { operations: unknown[] };
      feeBumpXdr: string;
      submitted: boolean;
      request: { headers: { "X-Api-Key": string } };
    };

    expect(result.ok).toBe(true);
    expect(result.decoded.operations).toHaveLength(1);
    expect(result.feeBumpXdr).toBeTruthy();
    expect(result.submitted).toBe(false);
    expect(result.request.headers["X-Api-Key"]).toBe("sbx_test_key");
  });

  it("returns network=mainnet response with submission skipped", async () => {
    const { res, body } = mockRes();
    await playgroundFeeBumpHandler(
      mockReq({ xdr: VALID_XDR, network: "mainnet", submit: true }) as Request,
      res as Response,
      mockNext
    );

    const result = body.value as {
      ok: boolean;
      submitted: boolean;
      network: string;
    };
    expect(result.ok).toBe(true);
    expect(result.network).toBe("mainnet");
    // Mainnet safety: submission must be blocked
    expect(result.submitted).toBe(false);
  });

  it("imports a Stellar Expert contract URL, decodes ABI, and generates sample XDRs", async () => {
    const wasmFixture = buildContractSpecWasm(SAMPLE_SPEC_ENTRIES);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          contract: SAMPLE_CONTRACT_ID,
          wasm: SAMPLE_WASM_HASH,
          creator: "GBU5Y3KF2A5JJSVVWF4UJGXMNHDKCCAZKCOD2NADEMXNDZA442GKVMPP",
          validation: {
            status: "verified",
            repository: "https://github.com/script3/token-lockup",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          wasmFixture.buffer.slice(
            wasmFixture.byteOffset,
            wasmFixture.byteOffset + wasmFixture.byteLength
          ),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { res, statusCode, body } = mockRes();
    await playgroundContractImportHandler(
      mockReq({ url: SAMPLE_CONTRACT_URL }) as Request,
      res as Response
    );

    expect(statusCode.value).toBe(200);
    const result = body.value as {
      ok: boolean;
      network: string;
      contractId: string;
      wasmHash: string;
      functions: Array<{
        name: string;
        parameters: Array<{ name: string; type: string }>;
        sampleXdr: string;
      }>;
    };

    expect(result.ok).toBe(true);
    expect(result.network).toBe("public");
    expect(result.contractId).toBe(SAMPLE_CONTRACT_ID);
    expect(result.wasmHash).toBe(SAMPLE_WASM_HASH);
    expect(result.functions.length).toBeGreaterThan(0);

    const claimFunction = result.functions.find((fn) => fn.name === "claim");
    expect(claimFunction).toBeTruthy();
    expect(claimFunction?.parameters).toEqual([
      expect.objectContaining({ name: "tokens", type: "vec<address>" }),
    ]);
    expect(claimFunction?.sampleXdr).toBeTruthy();

    const decodedClaimSample = decodeXdr(
      claimFunction!.sampleXdr,
      MAINNET_PASSPHRASE
    );
    expect(decodedClaimSample.operations).toHaveLength(1);
    expect(decodedClaimSample.operations[0].type).toBe("invokeHostFunction");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `https://api.stellar.expert/explorer/public/contract/${SAMPLE_CONTRACT_ID}`
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://api.stellar.expert/explorer/public/wasm/${SAMPLE_WASM_HASH}`
    );
  });

  it("rejects non-Stellar Expert URLs for contract import", async () => {
    const { res, statusCode, body } = mockRes();
    await playgroundContractImportHandler(
      mockReq({ url: "https://example.com/not-stellar" }) as Request,
      res as Response
    );

    expect(statusCode.value).toBe(400);
    const result = body.value as { ok: boolean; code: string };
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_STELLAR_EXPERT_URL");
  });
});
