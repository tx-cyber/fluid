import {
  isAllowed,
  setAllowed,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import { TransactionBuilder, Networks, Horizon, Asset, Operation } from "@stellar/stellar-sdk";

export const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "PUBLIC" : "TESTNET";
export const HORIZON_URL = STELLAR_NETWORK === "PUBLIC" 
  ? "https://horizon.stellar.org" 
  : "https://horizon-testnet.stellar.org";

const server = new Horizon.Server(HORIZON_URL);

/**
 * Connects to the Freighter wallet and retrieves the active public key.
 */
export async function connectFreighter(): Promise<string> {
  const isBrowser = typeof window !== "undefined";
  if (isBrowser && !(window as any).freighter) {
    throw new Error("Freighter is not installed.");
  }

  let allowed = await isAllowed();
  if (!allowed.isAllowed) {
    allowed = await setAllowed();
    if (!allowed.isAllowed) throw new Error("Connection to Freighter was not allowed. Please approve the connection in the extension.");
  }
  
  const userInfo = await getAddress();
  if (!userInfo.address || userInfo.error) throw new Error(userInfo.error || "Failed to retrieve public key from Freighter. Is it unlocked?");
  return userInfo.address;
}

/**
 * Fetches the user's native XLM balance.
 */
export async function getBalance(publicKey: string): Promise<string> {
  try {
    const account = await server.loadAccount(publicKey);
    const nativeBal = account.balances.find((b) => b.asset_type === "native");
    if (!nativeBal) return "0.00";
    return parseFloat(nativeBal.balance).toFixed(2);
  } catch (err) {
    console.warn("Failed to load balance from Horizon", err);
    return "0.00";
  }
}

/**
 * Deposits XLM from the connected user to a specific pool signer.
 */
export async function depositXlm(
  fromPublicKey: string,
  toPublicKey: string,
  amount: string
) {
  const sourceAccount = await server.loadAccount(fromPublicKey);
  
  const networkPassphrase = STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: toPublicKey,
        asset: Asset.native(),
        amount: amount,
      })
    )
    .setTimeout(120) // 2 minutes
    .build();

  const resultData = await signTransaction(tx.toXDR(), {
    networkPassphrase,
  });

  if (resultData.error) {
    throw new Error(resultData.error || "Freighter failed to sign the transaction.");
  }

  if (typeof resultData.signedTxXdr !== "string") {
    throw new Error("Freighter failed to sign the transaction. Received invalid response.");
  }

  // Use 'any' cast as the newer Stellar SDK typings can sometimes be strict on submitTransaction
  const signedTx = TransactionBuilder.fromXDR(resultData.signedTxXdr, networkPassphrase) as any;
  
  const result = await server.submitTransaction(signedTx);
  return result;
}
