import StellarSdk from "@stellar/stellar-sdk";
import { buildSACTransferTx, resolveSacAsset } from "../soroban";

const TESTNET_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const FRIEND_BOT_URL =
  process.env.FRIENDBOT_URL ?? "https://friendbot.stellar.org";

async function fund(address: string) {
  const response = await fetch(`${FRIEND_BOT_URL}?addr=${encodeURIComponent(address)}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Friendbot failed for ${address}: ${body}`);
  }
}

async function main() {
  const source = StellarSdk.Keypair.random();
  const destination = StellarSdk.Keypair.random();

  await fund(source.publicKey());
  await fund(destination.publicKey());

  const tx = await buildSACTransferTx({
    source: source.publicKey(),
    destination: destination.publicKey(),
    asset: "native",
    amount: "1000000",
    networkPassphrase: StellarSdk.Networks.TESTNET,
    sorobanRpcUrl: TESTNET_RPC_URL,
  });

  const resolvedAsset = resolveSacAsset("native", StellarSdk.Networks.TESTNET);

  console.log("Source:", source.publicKey());
  console.log("Destination:", destination.publicKey());
  console.log("Asset contract:", resolvedAsset.contractId);
  console.log("Prepared SAC transfer XDR:", tx.toXDR());
}

main().catch((error) => {
  console.error("Failed to generate SAC transfer XDR:", error);
  process.exit(1);
});
