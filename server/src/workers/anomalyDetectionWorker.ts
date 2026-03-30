import { runAnomalyDetection } from "../services/anomalyDetection";
import { createLogger } from "../utils/logger";

const logger = createLogger({ component: "anomaly_detection_worker" });

class AnomalyDetectionWorker {
  private interval: NodeJS.Timeout | null = null;
  private readonly RUN_INTERVAL_MS = Number(process.env.ANOMALY_DETECTION_INTERVAL_MS) || 60 * 60 * 1000; // Default: 1 hour

  start(): void {
    if (this.interval) {
      logger.warn("Anomaly detection worker already running");
      return;
    }

    logger.info(
      { poll_interval_ms: this.RUN_INTERVAL_MS },
      "Starting anomaly detection worker"
    );

    // Run immediately on start
    this.runDetection();

    // Schedule periodic runs
    this.interval = setInterval(() => {
      this.runDetection();
    }, this.RUN_INTERVAL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info("Stopped anomaly detection worker");
    }
  }

  private async runDetection(): Promise<void> {
    try {
      logger.info("Running anomaly detection");
      await runAnomalyDetection();
      logger.info("Anomaly detection completed successfully");
    } catch (error) {
      logger.error({ error: String(error) }, "Anomaly detection failed");
    }
  }
}

export const anomalyDetectionWorker = new AnomalyDetectionWorker();
