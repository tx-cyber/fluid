import StellarSdk from "@stellar/stellar-sdk";
import { verifySettlementPayment, extractSettlementRequirement } from "../src/utils/settlementVerifier";
import { loadConfig } from "../src/config";

// Test configuration
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const issuerPublicKey = StellarSdk.Keypair.random().publicKey();
const settlementToken = `USDC:${issuerPublicKey}`;

async function testSettlementVerification() {
  console.log("=== Settlement Verification Test ===\n");

  const config = loadConfig();
  const feePayerAccount = config.feePayerAccounts[0];
  const feePayerPublicKey = feePayerAccount.publicKey;

  console.log(`Fee Payer Public Key: ${feePayerPublicKey}\n`);

  // Test 1: Valid XLM payment
  console.log("Test 1: Valid XLM payment");
  const sourceKeypair = StellarSdk.Keypair.random();
  const sourceAccount = new StellarSdk.Account(sourceKeypair.publicKey(), "1");

  const validXlmTx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
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

  validXlmTx.sign(sourceKeypair);

  const result1 = verifySettlementPayment(
    validXlmTx,
    { token: "XLM", requiredAmountStroops: 200 },
    config
  );

  console.log(`Result: ${result1.isValid ? "✅ PASS" : "❌ FAIL"}`);
  if (!result1.isValid) {
    console.log(`Reason: ${result1.reason}`);
  }
  console.log();

  // Test 2: Insufficient amount
  console.log("Test 2: Insufficient XLM payment");
  const insufficientTx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
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

  insufficientTx.sign(sourceKeypair);

  const result2 = verifySettlementPayment(
    insufficientTx,
    { token: "XLM", requiredAmountStroops: 200 },
    config
  );

  console.log(`Result: ${result2.isValid ? "✅ PASS" : "❌ FAIL"}`);
  if (!result2.isValid) {
    console.log(`Reason: ${result2.reason}`);
    console.log(`Expected: ${result2.expectedAmount} XLM`);
    console.log(`Actual: ${result2.actualAmount} XLM`);
  }
  console.log();

  // Test 3: Wrong destination
  console.log("Test 3: Payment to wrong destination");
  const wrongDestTx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: StellarSdk.Keypair.random().publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: "0.00002",
      })
    )
    .setTimeout(30)
    .build();

  wrongDestTx.sign(sourceKeypair);

  const result3 = verifySettlementPayment(
    wrongDestTx,
    { token: "XLM", requiredAmountStroops: 200 },
    config
  );

  console.log(`Result: ${result3.isValid ? "✅ PASS" : "❌ FAIL"}`);
  if (!result3.isValid) {
    console.log(`Reason: ${result3.reason}`);
  }
  console.log();

  // Test 4: Path payment with USDC
  console.log("Test 4: Path payment with USDC");
  const usdcAsset = new StellarSdk.Asset("USDC", issuerPublicKey);
  
  const pathPaymentTx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset: StellarSdk.Asset.native(),
        sendMax: "1",
        destination: feePayerPublicKey,
        destAsset: usdcAsset,
        destAmount: "0.00002",
      })
    )
    .setTimeout(30)
    .build();

  pathPaymentTx.sign(sourceKeypair);

  const result4 = verifySettlementPayment(
    pathPaymentTx,
    { token: settlementToken, requiredAmountStroops: 200 },
    config
  );

  console.log(`Result: ${result4.isValid ? "✅ PASS" : "❌ FAIL"}`);
  if (!result4.isValid) {
    console.log(`Reason: ${result4.reason}`);
  }
  console.log();

  // Test 5: No settlement payment
  console.log("Test 5: No settlement payment");
  const noSettlementTx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.createAccount({
        destination: StellarSdk.Keypair.random().publicKey(),
        startingBalance: "1",
      })
    )
    .setTimeout(30)
    .build();

  noSettlementTx.sign(sourceKeypair);

  const result5 = verifySettlementPayment(
    noSettlementTx,
    { token: "XLM", requiredAmountStroops: 200 },
    config
  );

  console.log(`Result: ${result5.isValid ? "✅ PASS" : "❌ FAIL"}`);
  if (!result5.isValid) {
    console.log(`Reason: ${result5.reason}`);
  }
  console.log();

  console.log("=== Settlement Verification Test Complete ===");
}

// Test extractSettlementRequirement
function testExtractSettlementRequirement() {
  console.log("\n=== Extract Settlement Requirement Test ===\n");

  // Test 1: No token specified
  const result1 = extractSettlementRequirement(undefined, 200);
  console.log(`No token: ${result1 === null ? "✅ PASS" : "❌ FAIL"}`);

  // Test 2: XLM token
  const result2 = extractSettlementRequirement("XLM", 200);
  console.log(`XLM token: ${result2?.token === "XLM" && result2.requiredAmountStroops === 200 ? "✅ PASS" : "❌ FAIL"}`);

  // Test 3: USDC token
  const result3 = extractSettlementRequirement(settlementToken, 200);
  console.log(`USDC token: ${result3?.token === settlementToken && result3.requiredAmountStroops === 200 ? "✅ PASS" : "❌ FAIL"}`);

  // Test 4: Default fee amount
  const result4 = extractSettlementRequirement("XLM");
  console.log(`Default fee: ${result4?.token === "XLM" && result4.requiredAmountStroops === 100 ? "✅ PASS" : "❌ FAIL"}`);

  console.log("\n=== Extract Settlement Requirement Test Complete ===");
}

async function main() {
  try {
    await testSettlementVerification();
    testExtractSettlementRequirement();
  } catch (error) {
    console.error("Test failed:", error);
  }
}

if (require.main === module) {
  main();
}
