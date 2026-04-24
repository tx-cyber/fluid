import * as StellarSdk from "@stellar/stellar-sdk";
import { createLogger, serializeError } from "../utils/logger";

const logger = createLogger({ component: "treasury_swap" });

export interface TreasurySwapConfig {
  /** Soroban RPC URL for simulating and submitting contract calls */
  sorobanRpcUrl: string;
  /** Horizon URL for account lookups */
  horizonUrl: string;
  /** Network passphrase (testnet/mainnet) */
  networkPassphrase: string;
  /** Soroswap Router contract ID */
  routerContractId: string;
  /** Asset code to swap from (e.g. "USDC") */
  swapFromAssetCode: string;
  /** Asset issuer to swap from */
  swapFromAssetIssuer: string;
  /** Minimum non-native balance to trigger a swap */
  swapThreshold: number;
  /** Maximum slippage percentage (0-100, default 1.0) */
  maxSlippagePercent: number;
  /** Deadline offset in seconds for swap expiry (default 300 = 5 min) */
  deadlineOffsetSec: number;
}

export function loadTreasurySwapConfig(): TreasurySwapConfig | null {
  const sorobanRpcUrl = process.env.STELLAR_RPC_URL?.trim();
  const horizonUrl = process.env.STELLAR_HORIZON_URL?.trim();
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
  const routerContractId = process.env.TREASURY_SWAP_ROUTER_CONTRACT_ID?.trim();
  const swapFromAssetCode = process.env.TREASURY_SWAP_FROM_ASSET_CODE?.trim() || "USDC";
  const swapFromAssetIssuer = process.env.TREASURY_SWAP_FROM_ASSET_ISSUER?.trim();
  const swapThreshold = parseFloat(process.env.TREASURY_SWAP_THRESHOLD || "100");
  const maxSlippagePercent = parseFloat(process.env.TREASURY_SWAP_MAX_SLIPPAGE_PERCENT || "1.0");
  const deadlineOffsetSec = parseInt(process.env.TREASURY_SWAP_DEADLINE_SEC || "300", 10);

  if (!sorobanRpcUrl || !horizonUrl || !routerContractId || !swapFromAssetIssuer) {
    return null;
  }

  return {
    sorobanRpcUrl,
    horizonUrl,
    networkPassphrase,
    routerContractId,
    swapFromAssetCode,
    swapFromAssetIssuer,
    swapThreshold,
    maxSlippagePercent,
    deadlineOffsetSec,
  };
}

export class TreasurySwapService {
  private readonly sorobanServer: StellarSdk.SorobanRpc.Server;
  private readonly horizonServer: StellarSdk.Horizon.Server;
  private readonly routerContract: StellarSdk.Contract;
  private readonly swapFromAsset: StellarSdk.Asset;

  constructor(private readonly config: TreasurySwapConfig) {
    this.sorobanServer = new StellarSdk.SorobanRpc.Server(config.sorobanRpcUrl);
    this.horizonServer = new StellarSdk.Horizon.Server(config.horizonUrl);
    this.routerContract = new StellarSdk.Contract(config.routerContractId);
    this.swapFromAsset = new StellarSdk.Asset(config.swapFromAssetCode, config.swapFromAssetIssuer);
  }

  async getAssetBalance(publicKey: string): Promise<number> {
    const account = await this.horizonServer.loadAccount(publicKey);
    const balance = account.balances.find(
      (b: any) =>
        b.asset_type !== "native" &&
        b.asset_code === this.config.swapFromAssetCode &&
        b.asset_issuer === this.config.swapFromAssetIssuer
    );
    return balance ? parseFloat(balance.balance) : 0;
  }

  async getNativeBalance(publicKey: string): Promise<number> {
    const account = await this.horizonServer.loadAccount(publicKey);
    const balance = account.balances.find((b: any) => b.asset_type === "native");
    return balance ? parseFloat(balance.balance) : 0;
  }

  shouldSwap(assetBalance: number): boolean {
    return assetBalance >= this.config.swapThreshold;
  }

  async executeSwap(
    keypair: StellarSdk.Keypair,
    amountIn: string
  ): Promise<{ txHash: string; amountIn: string; assetCode: string }> {
    const publicKey = keypair.publicKey();

    logger.info(
      {
        account: publicKey,
        amount_in: amountIn,
        asset: `${this.config.swapFromAssetCode}:${this.config.swapFromAssetIssuer}`,
        router: this.config.routerContractId,
      },
      "Building treasury swap transaction"
    );

    const account = await this.sorobanServer.getAccount(publicKey);

    // Calculate minimum output with slippage
    const amountInStroops = BigInt(Math.floor(parseFloat(amountIn) * 10_000_000));
    const slippageMultiplier = 1 - this.config.maxSlippagePercent / 100;
    const minAmountOut = BigInt(Math.floor(Number(amountInStroops) * slippageMultiplier));

    // Deadline: current ledger time + offset
    const deadline = Math.floor(Date.now() / 1000) + this.config.deadlineOffsetSec;

    // Build Soroswap router path: [fromAssetContractId, nativeAssetContractId]
    const fromAssetContractId = this.swapFromAsset.contractId(this.config.networkPassphrase);
    const nativeAssetContractId = StellarSdk.Asset.native().contractId(this.config.networkPassphrase);

    // Build the swap_exact_tokens_for_tokens call
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        this.routerContract.call(
          "swap_exact_tokens_for_tokens",
          StellarSdk.nativeToScVal(amountInStroops, { type: "i128" }),
          StellarSdk.nativeToScVal(minAmountOut, { type: "i128" }),
          StellarSdk.nativeToScVal(
            [
              new StellarSdk.Address(fromAssetContractId),
              new StellarSdk.Address(nativeAssetContractId),
            ],
            { type: "Vec", itemType: "Address" }
          ),
          new StellarSdk.Address(publicKey).toScVal(),
          StellarSdk.nativeToScVal(deadline, { type: "u64" })
        )
      )
      .setTimeout(this.config.deadlineOffsetSec)
      .build();

    // Simulate to get proper resource footprint
    const simulated = await this.sorobanServer.simulateTransaction(tx);

    if (StellarSdk.SorobanRpc.Api.isSimulationError(simulated)) {
      throw new Error(`Swap simulation failed: ${simulated.error}`);
    }

    const prepared = StellarSdk.SorobanRpc.assembleTransaction(tx, simulated).build();
    prepared.sign(keypair);

    // Submit the transaction
    const sendResult = await this.sorobanServer.sendTransaction(prepared);

    if (sendResult.status === "ERROR") {
      throw new Error(`Swap submission failed: ${JSON.stringify(sendResult.errorResult)}`);
    }

    // Poll for completion
    let getResult = await this.sorobanServer.getTransaction(sendResult.hash);
    while (getResult.status === "NOT_FOUND") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      getResult = await this.sorobanServer.getTransaction(sendResult.hash);
    }

    if (getResult.status === "FAILED") {
      throw new Error(`Swap transaction failed on-chain: ${sendResult.hash}`);
    }

    logger.info(
      {
        tx_hash: sendResult.hash,
        account: publicKey,
        amount_in: amountIn,
        asset: this.config.swapFromAssetCode,
      },
      "Treasury swap completed successfully"
    );

    return {
      txHash: sendResult.hash,
      amountIn,
      assetCode: this.config.swapFromAssetCode,
    };
  }
}
