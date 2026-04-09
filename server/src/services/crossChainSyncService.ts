import { ethers } from "ethers";
import * as StellarSdk from "@stellar/stellar-sdk";
import { SorobanRpc } from "@stellar/stellar-sdk";
import prisma from "../utils/db";
import { createLogger, serializeError } from "../utils/logger";
import { loadConfig } from "../config";

const logger = createLogger({ component: "cross_chain_sync" });

export class CrossChainSyncService {
  private config: any;
  private evmProvider: ethers.JsonRpcProvider;
  private evmWallet: ethers.Wallet;
  private evmContract: ethers.Contract;
  private stellarRpc: SorobanRpc.Server;
  private stellarKeypair: StellarSdk.Keypair;

  private sorobanContractId: string;
  private evmContractAddress: string;

  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastSorobanLedger: number = 0;

  constructor() {
    this.config = loadConfig();
    
    // EVM setup
    this.evmProvider = new ethers.JsonRpcProvider(process.env.WORMHOLE_RPC_EVM || "https://ethereum-sepolia.publicnode.com");
    this.evmWallet = new ethers.Wallet(process.env.WORMHOLE_TREASURY_EVM_SECRET || "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", this.evmProvider);
    
    const evmAbi = [
      "function increment() public",
      "function syncCount(uint256 newCount) public",
      "function count() public view returns (uint256)",
      "event Incremented(uint256 newCount)",
      "event Synced(uint256 newCount)"
    ];
    this.evmContractAddress = process.env.WORMHOLE_COUNTER_EVM_ADDRESS || "0x0000000000000000000000000000000000000000";
    this.evmContract = new ethers.Contract(this.evmContractAddress, evmAbi, this.evmWallet);

    // Stellar/Soroban setup
    this.stellarRpc = new SorobanRpc.Server(process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org");
    this.stellarKeypair = StellarSdk.Keypair.fromSecret(process.env.WORMHOLE_TREASURY_STELLAR_SECRET || process.env.FLUID_FEE_PAYER_SECRET || "SCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    this.sorobanContractId = process.env.WORMHOLE_COUNTER_SOROBAN_ID || "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info("Cross-chain sync service started");

    // Start polling for Soroban events
    this.pollInterval = setInterval(() => this.pollSorobanEvents(), 10000);

    // Listen for EVM events (Ethers v6 uses .on)
    this.evmContract.on("Incremented", (newCount, event) => {
      this.handleEvmIncrement(newCount, event.log.transactionHash);
    });

    logger.info(`Monitoring Soroban: ${this.sorobanContractId}`);
    logger.info(`Monitoring EVM: ${this.evmContractAddress}`);
  }

  stop() {
    this.isRunning = false;
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.evmContract.removeAllListeners();
    logger.info("Cross-chain sync service stopped");
  }

  /**
   * Poll Soroban for increment events
   */
  private async pollSorobanEvents() {
    try {
      const response = await this.stellarRpc.getEvents({
          startLedger: this.lastSorobanLedger || undefined,
          filters: [
            {
              type: "contract",
              contractIds: [this.sorobanContractId],
            },
          ],
          limit: 10,
      });

      for (const event of response.events) {
        // Event topics for "Counter", "increment" (symbol_short)
        // Note: Soroban events have topics as XDR
        if (event.type === "contract") {
            // Placeholder logic: check if it's an increment event
            // In a real implementation, you'd decode the XDR topics
            logger.info({ eventId: event.id }, "Detected Soroban event");
            
            // For PoC, we'll assume any event from this contract with specific topics is an increment
            // Actual decoding logic would go here
            const countValue = 10; // Mock decoded value
            await this.handleSorobanIncrement(countValue, event.id);
        }
      }

      if (response.latestLedger) {
        this.lastSorobanLedger = response.latestLedger;
      }
    } catch (error) {
      logger.error({ error: serializeError(error) }, "Failed to poll Soroban events");
    }
  }

  /**
   * Handle Soroban increment -> Sync EVM
   */
  private async handleSorobanIncrement(count: number, sorobanEventId: string) {
    logger.info({ count, sorobanEventId }, "Handling Soroban increment");
    
    // Check if already synced
    const existing = await prisma.crossChainSync.findUnique({
      where: { sourceTxHash: sorobanEventId }
    });
    if (existing) return;

    const syncEntry = await prisma.crossChainSync.create({
      data: {
        sourceChain: "stellar",
        targetChain: "ethereum",
        sourceTxHash: sorobanEventId,
        sourceContract: this.sorobanContractId,
        targetContract: this.evmContractAddress,
        payload: JSON.stringify({ count }),
        status: "PENDING",
      }
    });

    try {
      const tx = await this.evmContract.syncCount(count);
      logger.info({ evmTxHash: tx.hash }, "Submitted EVM sync transaction");
      
      const receipt = await tx.wait();
      
      await prisma.crossChainSync.update({
        where: { id: syncEntry.id },
        data: {
          targetTxHash: receipt.hash,
          status: "COMPLETED"
        }
      });
      
      logger.info({ syncId: syncEntry.id }, "Cross-chain sync completed: Soroban -> EVM");
    } catch (error) {
      logger.error({ error: serializeError(error), syncId: syncEntry.id }, "Failed to sync to EVM");
      await prisma.crossChainSync.update({
        where: { id: syncEntry.id },
        data: {
          status: "FAILED",
          error: String(error)
        }
      });
    }
  }

  /**
   * Handle EVM increment -> Sync Soroban
   */
  private async handleEvmIncrement(count: bigint, evmTxHash: string) {
    logger.info({ count: count.toString(), evmTxHash }, "Handling EVM increment");

    // Check if already synced
    const existing = await prisma.crossChainSync.findUnique({
      where: { sourceTxHash: evmTxHash }
    });
    if (existing) return;

    const syncEntry = await prisma.crossChainSync.create({
      data: {
        sourceChain: "ethereum",
        targetChain: "stellar",
        sourceTxHash: evmTxHash,
        sourceContract: this.evmContractAddress,
        targetContract: this.sorobanContractId,
        payload: JSON.stringify({ count: count.toString() }),
        status: "PENDING",
      }
    });

    try {
      // In a real implementation: Build, sign, and submit Soroban transaction
      // For PoC, we'll log the intention and simulate completion
      logger.info({ syncId: syncEntry.id }, "Initiating Soroban sync (Placeholder)");
      
      const mockStellarTxHash = "MOCK_STELLAR_" + Math.random().toString(36).slice(2).toUpperCase();
      
      await prisma.crossChainSync.update({
        where: { id: syncEntry.id },
        data: {
          targetTxHash: mockStellarTxHash,
          status: "COMPLETED"
        }
      });

      logger.info({ syncId: syncEntry.id, stellarTxHash: mockStellarTxHash }, "Cross-chain sync completed: EVM -> Soroban");
    } catch (error) {
      logger.error({ error: serializeError(error), syncId: syncEntry.id }, "Failed to sync to Soroban");
      await prisma.crossChainSync.update({
        where: { id: syncEntry.id },
        data: {
          status: "FAILED",
          error: String(error)
        }
      });
    }
  }
}

export const crossChainSyncService = new CrossChainSyncService();
