import { describe, it, expect } from "@jest/globals";
import StellarSdk from "@stellar/stellar-sdk";
import { verifySettlementPayment, extractSettlementRequirement } from "./settlementVerifier";
import { Config } from "../config";

describe("settlementVerifier", () => {
  const mockConfig: Config = {
    feePayerAccounts: [
      {
        publicKey: "GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB",
        keypair: StellarSdk.Keypair.fromSecret("SABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB"),
        secretSource: { type: "env", secret: "SABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB" }
      }
    ],
    signerPool: {} as any,
    baseFee: 100,
    feeMultiplier: 2.0,
    networkPassphrase: "Test SDF Network ; September 2015",
    rateLimitWindowMs: 60000,
    rateLimitMax: 5,
    allowedOrigins: [],
    alerting: {
      checkIntervalMs: 3600000,
      cooldownMs: 21600000
    }
  };

  const feePayerPublicKey = "GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB";

  describe("verifySettlementPayment", () => {
    it("should accept a valid payment operation", () => {
      const sourceAccount = new StellarSdk.Account("GTEST1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678", "1");
      const innerTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: feePayerPublicKey,
            asset: StellarSdk.Asset.native(),
            amount: "0.00002", // 200 stroops
          })
        )
        .setTimeout(30)
        .build();

      const result = verifySettlementPayment(innerTransaction, {
        token: "XLM",
        requiredAmountStroops: 200,
      }, mockConfig);

      expect(result.isValid).toBe(true);
      expect(result.actualAmount).toBe("0.00002");
      expect(result.assetCode).toBe("XLM");
    });

    it("should accept a valid pathPaymentStrictReceive operation", () => {
      const sourceAccount = new StellarSdk.Account("GTEST1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678", "1");
      const innerTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
        .addOperation(
          StellarSdk.Operation.pathPaymentStrictReceive({
            sendAsset: StellarSdk.Asset.native(),
            sendMax: "1",
            destination: feePayerPublicKey,
            destAsset: new StellarSdk.Asset("USDC", "GISSUER1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456"),
            destAmount: "0.00002", // 200 stroops equivalent
          })
        )
        .setTimeout(30)
        .build();

      const result = verifySettlementPayment(innerTransaction, {
        token: "USDC:GISSUER1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456",
        requiredAmountStroops: 200,
      }, mockConfig);

      expect(result.isValid).toBe(true);
      expect(result.actualAmount).toBe("0.00002");
      expect(result.assetCode).toBe("USDC:GISSUER1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456");
    });

    it("should reject insufficient payment amount", () => {
      const sourceAccount = new StellarSdk.Account("GTEST1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678", "1");
      const innerTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: feePayerPublicKey,
            asset: StellarSdk.Asset.native(),
            amount: "0.00001", // 100 stroops - insufficient
          })
        )
        .setTimeout(30)
        .build();

      const result = verifySettlementPayment(innerTransaction, {
        token: "XLM",
        requiredAmountStroops: 200,
      }, mockConfig);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("Incorrect settlement amount");
      expect(result.expectedAmount).toBe("0.00002");
      expect(result.actualAmount).toBe("0.00001");
    });

    it("should reject payment to wrong destination", () => {
      const sourceAccount = new StellarSdk.Account("GTEST1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678", "1");
      const innerTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: "GWRONG1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB",
            asset: StellarSdk.Asset.native(),
            amount: "0.00002",
          })
        )
        .setTimeout(30)
        .build();

      const result = verifySettlementPayment(innerTransaction, {
        token: "XLM",
        requiredAmountStroops: 200,
      }, mockConfig);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("No settlement payment found");
    });

    it("should reject payment with wrong asset", () => {
      const sourceAccount = new StellarSdk.Account("GTEST1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678", "1");
      const innerTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: feePayerPublicKey,
            asset: new StellarSdk.Asset("BTC", "GBTC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890"),
            amount: "0.00002",
          })
        )
        .setTimeout(30)
        .build();

      const result = verifySettlementPayment(innerTransaction, {
        token: "USDC:GISSUER1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456",
        requiredAmountStroops: 200,
      }, mockConfig);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("No settlement payment found");
    });

    it("should reject when no settlement operations are found", () => {
      const sourceAccount = new StellarSdk.Account("GTEST1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12345678", "1");
      const innerTransaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
        .addOperation(
          StellarSdk.Operation.createAccount({
            destination: "GDEST1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB",
            startingBalance: "1",
          })
        )
        .setTimeout(30)
        .build();

      const result = verifySettlementPayment(innerTransaction, {
        token: "XLM",
        requiredAmountStroops: 200,
      }, mockConfig);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("No settlement payment found");
    });
  });

  describe("extractSettlementRequirement", () => {
    it("should return null when no token is specified", () => {
      const result = extractSettlementRequirement(undefined, 200);
      expect(result).toBeNull();
    });

    it("should return requirement when token is specified", () => {
      const result = extractSettlementRequirement("USDC:GISSUER1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456", 200);
      expect(result).toEqual({
        token: "USDC:GISSUER1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF123456",
        requiredAmountStroops: 200,
      });
    });

    it("should use default fee amount when not specified", () => {
      const result = extractSettlementRequirement("XLM");
      expect(result).toEqual({
        token: "XLM",
        requiredAmountStroops: 100,
      });
    });
  });
});
