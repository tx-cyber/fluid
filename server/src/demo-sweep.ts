import StellarSdk from "@stellar/stellar-sdk";
import { TreasurySweeper } from "./tasks/sweeper";
import { Config } from "./config";

async function main() {
  console.log("---------------------------------------------------");
  console.log("  Fluid - Treasury Sweeper Demo (Cold Storage)     ");
  console.log("---------------------------------------------------");

  const coldWallet = "GARTLY7N6X74P4VNCX75Y4P5Y4P5Y4P5Y4P5Y4P5Y4P5Y4P5Y4P5Y4P5";
  const feePayer = StellarSdk.Keypair.random();
  
  const config: any = {
    networkPassphrase: "Test SDF Network ; September 2015",
    feePayerAccounts: [{
      publicKey: feePayer.publicKey(),
      keypair: feePayer,
      secretSource: { type: "env", secret: feePayer.secret() }
    }],
    supportedAssets: [{
      code: "USDC",
      issuer: "GDC...USDC",
      treasuryRetentionLimit: "50"
    }],
    treasury: {
      enabled: true,
      coldWallet,
      retentionLimitXlm: 100,
      cronSchedule: "0 0 * * *"
    }
  };

  const horizonClientMock: any = {
    loadAccount: async (pk: string) => {
      return {
        id: pk,
        sequence: "1",
        balances: [
          { asset_type: "native", balance: "250.0000000" },
          { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GDC...USDC", balance: "150.0000000" }
        ],
        accountId: () => pk,
        sequenceNumber: () => "1"
      };
    },
    submitTransaction: async (tx: any) => {
      console.log(`[MOCK] Transaction submitted. Hash: 12345...`);
      return { result: { hash: "3e5a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6" } };
    }
  };

  const sweeper = new TreasurySweeper(config as Config);
  
  console.log("Starting manual sweep run...");
  await sweeper.runSweep(horizonClientMock);
  console.log("---------------------------------------------------");
  console.log("Demo completed.");
}

main().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});
