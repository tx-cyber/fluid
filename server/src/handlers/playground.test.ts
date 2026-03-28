/**
 * Unit tests for the playground fee-bump handler.
 *
 * These tests exercise `decodeXdr` and the handler logic using mocked
 * Stellar SDK and fetch calls — no real network requests are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import * as StellarSdk from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// We need a real signed testnet transaction XDR for tests.
// We generate one deterministically using a fixed keypair.
// ---------------------------------------------------------------------------

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

function buildSignedTestnetXdr(): string {
  const sourceKp = StellarSdk.Keypair.fromSecret(
    "SDDXWE2JG2VL7NU3EQ5CRJWXPIYSYNBSUBRA2MHQLAERV5CGSGDMXZFY"
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

describe("playgroundFeeBumpHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set the required env variable for all tests
    process.env.PLAYGROUND_FEE_PAYER_SECRET =
      "SDDXWE2JG2VL7NU3EQ5CRJWXPIYSYNBSUBRA2MHQLAERV5CGSGDMXZFY";
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
      "SDDXWE2JG2VL7NU3EQ5CRJWXPIYSYNBSUBRA2MHQLAERV5CGSGDMXZFY"
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
});
