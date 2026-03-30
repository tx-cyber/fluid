import cron from "node-cron";
import { logger } from "../utils/logger";
import { TenantUsageTracker } from "../services/tenantUsageTracker";
import { IntelligentRateLimiter } from "../services/intelligentRateLimiter";

export class DailyScoringWorker {
  private usageTracker: TenantUsageTracker;
  private rateLimiter: IntelligentRateLimiter;
  private isRunning: boolean = false;

  constructor() {
    this.usageTracker = new TenantUsageTracker();
    this.rateLimiter = new IntelligentRateLimiter();
  }

  /**
   * Start the daily scoring job
   * Runs every day at 2 AM UTC
   */
  start(): void {
    // Schedule daily job at 2 AM UTC
    cron.schedule("0 2 * * *", async () => {
      if (this.isRunning) {
        logger.warn("Daily scoring job is already running, skipping");
        return;
      }

      await this.runDailyScoring();
    }, {
      timezone: "UTC"
    });

    logger.info("Daily scoring worker started - scheduled to run daily at 2 AM UTC");
  }

  /**
   * Run the daily scoring job manually
   */
  async runDailyScoring(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Daily scoring job is already running");
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info("Starting daily tenant scoring job");

      // Step 1: Update daily statistics for all tenants
      await this.usageTracker.updateDailyStats();
      logger.info("Daily statistics updated");

      // Step 2: Process intelligent rate limit adjustments
      const adjustments = await this.rateLimiter.processAutoAdjustments();
      logger.info(`Processed ${adjustments.length} tier adjustments`);

      // Step 3: Log summary
      const duration = Date.now() - startTime;
      logger.info(`Daily scoring job completed in ${duration}ms`, {
        adjustmentsProcessed: adjustments.length,
        duration
      } as any);

      // Create admin notification for summary
      if (adjustments.length > 0) {
        await this.createAdminSummary(adjustments);
      }

    } catch (error) {
      logger.error("Daily scoring job failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime
      } as any);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Create admin notification with job summary
   */
  private async createAdminSummary(adjustments: any[]): Promise<void> {
    try {
      const { createNotification } = await import("../services/notificationService");

      const upgrades = adjustments.filter(adj => adj.reason === "auto_upgrade");
      const downgrades = adjustments.filter(adj => adj.reason === "violation_demotion");

      let title = "Daily Rate Limit Adjustments";
      let message = `Processed ${adjustments.length} tier adjustments today.`;

      if (upgrades.length > 0) {
        message += `\n\n📈 Upgrades: ${upgrades.length} tenants upgraded to higher tiers.`;
      }

      if (downgrades.length > 0) {
        message += `\n\n📉 Downgrades: ${downgrades.length} tenants downgraded due to violations.`;
      }

      await createNotification({
        type: "info",
        title,
        message,
        metadata: {
          totalAdjustments: adjustments.length,
          upgrades: upgrades.length,
          downgrades: downgrades.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error("Failed to create admin summary notification", {
        error: error instanceof Error ? error.message : String(error)
      } as any);
    }
  }

  /**
   * Get worker status
   */
  getStatus(): { isRunning: boolean; lastRun?: Date } {
    return {
      isRunning: this.isRunning,
      // TODO: Add last run tracking if needed
    };
  }

  /**
   * Stop the worker
   */
  stop(): void {
    cron.getTasks().forEach((task: any) => task.stop());
    logger.info("Daily scoring worker stopped");
  }
}

// Export singleton instance
export const dailyScoringWorker = new DailyScoringWorker();
