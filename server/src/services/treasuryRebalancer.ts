import { Config } from "../config";
import { WormholeBridgeService, loadWormholeConfig } from "./wormholeBridgeService";
import { createLogger, serializeError } from "../utils/logger";
import { AlertService } from "./alertService";
import prisma from "../utils/db";
import { createNotification } from "./notificationService";

const logger = createLogger({ component: "treasury_rebalancer" });

const REBALANCE_THRESHOLD_XLM = parseFloat(process.env.WORMHOLE_REBALANCE_THRESHOLD_XLM || "50");
const REBALANCE_AMOUNT_USDC = BigInt(process.env.WORMHOLE_REBALANCE_AMOUNT_USDC || "100000000"); // 100 USDC (6 decimals)
const MIN_EVM_SURPLUS_USDC = BigInt(process.env.WORMHOLE_MIN_EVM_SURPLUS_USDC || "500000000"); // 500 USDC

export class TreasuryRebalancer {
  private bridgeService: WormholeBridgeService | null = null;
  private alertService?: AlertService;

  constructor(
    private readonly config: Config,
    alertService?: AlertService
  ) {
    this.alertService = alertService;
    const whConfig = loadWormholeConfig();
    if (whConfig) {
      this.bridgeService = new WormholeBridgeService(whConfig);
      logger.info("TreasuryRebalancer initialized with Wormhole support");
    } else {
      logger.warn("TreasuryRebalancer initialized without Wormhole support (missing config)");
    }
  }

  setAlertService(alertService: AlertService): void {
    this.alertService = alertService;
  }

  async checkAndRebalance(accountPublicKey: string, currentBalanceXlm: number): Promise<void> {
    if (!this.bridgeService) return;

    if (currentBalanceXlm < REBALANCE_THRESHOLD_XLM) {
      logger.info(
        { account: accountPublicKey, balance: currentBalanceXlm, threshold: REBALANCE_THRESHOLD_XLM },
        "Stellar treasury balance below rebalance threshold"
      );

      try {
        const evmBalance = await this.bridgeService.getEvmUsdcBalance();
        logger.info({ evmBalance: evmBalance.toString() }, "Checked EVM treasury balance");

        if (evmBalance >= MIN_EVM_SURPLUS_USDC) {
          logger.info(
            { amount: REBALANCE_AMOUNT_USDC.toString() },
            "EVM treasury has sufficient surplus, triggering bridge"
          );

          const sourceTxHash = await this.bridgeService.initiateBridge(REBALANCE_AMOUNT_USDC);
          
          await createNotification({
            type: "info",
            title: "Cross-chain rebalancing initiated",
            message: `Initiated Wormhole bridge of ${Number(REBALANCE_AMOUNT_USDC) / 1000000} USDC from EVM to Stellar.`,
            metadata: { sourceTxHash, amount: REBALANCE_AMOUNT_USDC.toString() }
          });

          // Track in background
          this.bridgeService.trackAndRedeem(sourceTxHash).catch(err => {
            logger.error({ ...serializeError(err), sourceTxHash }, "Failed to track and redeem bridge transfer");
            createNotification({
              type: "critical",
              title: "Cross-chain rebalancing failed",
              message: `Bridge transfer ${sourceTxHash} failed during VAA tracking or redemption.`,
              metadata: { error: err.message, sourceTxHash }
            });
          });
        } else {
          logger.warn(
            { evmBalance: evmBalance.toString(), required: MIN_EVM_SURPLUS_USDC.toString() },
            "EVM treasury does not have sufficient surplus for rebalancing"
          );
        }
      } catch (error) {
        logger.error({ ...serializeError(error) }, "Error during treasury rebalancing check");
      }
    }
  }
}
