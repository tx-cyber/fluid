import StellarSdk from "@stellar/stellar-sdk";
import { Config } from "../config";
import prisma from "../utils/db";
import { createLogger } from "../utils/logger";

const logger = createLogger({ component: "status_monitor" });

const CHECK_INTERVAL_MS = 60000; // 1 minute
const HORIZON_TIMEOUT_MS = 5000;
const DB_TIMEOUT_MS = 3000;

interface HealthCheckResult {
  component: "api" | "horizon" | "database";
  status: "operational" | "degraded" | "down";
  message?: string;
  metadata?: Record<string, any>;
}

export class StatusMonitorService {
  private prisma: any;
  private config: Config;
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(prismaClient: any, config: Config) {
    this.prisma = prismaClient;
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Status monitor already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting status monitor service");

    // Run initial check
    await this.performAllChecks();

    // Schedule regular checks
    this.interval = setInterval(
      () => this.performAllChecks(),
      CHECK_INTERVAL_MS,
    );
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    logger.info("Status monitor service stopped");
  }

  private async performAllChecks(): Promise<void> {
    try {
      const results = await Promise.allSettled([
        this.checkApi(),
        this.checkHorizon(),
        this.checkDatabase(),
      ]);

      for (const result of results) {
        if (result.status === "fulfilled") {
          await this.recordStatusEvent(result.value);
        } else {
          logger.error("Health check failed:", result.reason);
        }
      }
    } catch (error) {
      logger.error("Error performing health checks:", error);
    }
  }

  private async checkApi(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Simple API health check - we can check if the server is responsive
      // This is more of a placeholder since we're running within the API itself
      const responseTime = Date.now() - startTime;

      return {
        component: "api",
        status: "operational",
        metadata: {
          responseTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        component: "api",
        status: "down",
        message: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async checkHorizon(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    if (!this.config.horizonUrl) {
      return {
        component: "horizon",
        status: "down",
        message: "Horizon URL not configured",
      };
    }

    try {
      const server = new StellarSdk.Server(this.config.horizonUrl);

      // Race between the actual request and timeout
      const result = await Promise.race([
        server.serverInfo(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), HORIZON_TIMEOUT_MS),
        ),
      ]);

      const responseTime = Date.now() - startTime;

      return {
        component: "horizon",
        status: "operational",
        metadata: {
          responseTime,
          horizonUrl: this.config.horizonUrl,
          timestamp: new Date().toISOString(),
          // Add some horizon info if available
          horizonInfo: result
            ? {
                ledger: result.ledger,
                protocolVersion: result.protocol_version,
              }
            : undefined,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        component: "horizon",
        status: responseTime > HORIZON_TIMEOUT_MS ? "degraded" : "down",
        message: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          responseTime,
          horizonUrl: this.config.horizonUrl,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Simple database connectivity check
      const result = await Promise.race([
        prisma.$queryRaw`SELECT 1 as health_check`,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Database timeout")),
            DB_TIMEOUT_MS,
          ),
        ),
      ]);

      const responseTime = Date.now() - startTime;

      return {
        component: "database",
        status: "operational",
        metadata: {
          responseTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        component: "database",
        status: responseTime > DB_TIMEOUT_MS ? "degraded" : "down",
        message: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          responseTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async recordStatusEvent(result: HealthCheckResult): Promise<void> {
    try {
      // Check if the last event for this component has the same status
      // If so, we don't need to create a new event (avoid spam)
      const lastEvent = await prisma.statusEvent.findFirst({
        where: {
          component: result.component,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (lastEvent && lastEvent.status === result.status) {
        // Status hasn't changed, skip recording
        return;
      }

      await prisma.statusEvent.create({
        data: {
          component: result.component,
          status: result.status,
          message: result.message,
          metadata: result.metadata ? JSON.stringify(result.metadata) : null,
        },
      });

      logger.info(
        `Status event recorded: ${result.component} is ${result.status}`,
      );
    } catch (error) {
      logger.error("Failed to record status event:", error);
    }
  }

  // Method to get current status for the public API
  async getCurrentStatus(): Promise<any> {
    try {
      const [apiStatus, horizonStatus, dbStatus] = await Promise.all([
        this.getLatestStatus("api"),
        this.getLatestStatus("horizon"),
        this.getLatestStatus("database"),
      ]);

      // Calculate overall status
      const overallStatus = this.calculateOverallStatus([
        apiStatus?.status,
        horizonStatus?.status,
        dbStatus?.status,
      ]);

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        components: {
          api: apiStatus,
          horizon: horizonStatus,
          database: dbStatus,
        },
      };
    } catch (error) {
      logger.error("Failed to get current status:", error);
      throw error;
    }
  }

  private async getLatestStatus(component: string): Promise<any> {
    const event = await prisma.statusEvent.findFirst({
      where: {
        component,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!event) {
      return {
        component,
        status: "unknown",
        message: "No data available",
      };
    }

    return {
      component: event.component,
      status: event.status,
      message: event.message,
      lastUpdated: event.createdAt,
      metadata: event.metadata ? JSON.parse(event.metadata) : undefined,
    };
  }

  private calculateOverallStatus(statuses: (string | undefined)[]): string {
    const validStatuses = statuses.filter(Boolean) as string[];

    if (validStatuses.includes("down")) {
      return "down";
    }

    if (validStatuses.includes("degraded")) {
      return "degraded";
    }

    if (validStatuses.includes("operational")) {
      return "operational";
    }

    return "unknown";
  }

  // Method to get uptime statistics
  async getUptimeStats(days: number = 90): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const events = await prisma.statusEvent.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // Group events by component
      const componentEvents = events.reduce(
        (acc: Record<string, any[]>, event: any) => {
          if (!acc[event.component]) {
            acc[event.component] = [];
          }
          acc[event.component].push(event);
          return acc;
        },
        {} as Record<string, any[]>,
      );

      // Calculate uptime for each component
      const uptimeStats: Record<string, any> = {};

      for (const [component, compEvents] of Object.entries(componentEvents)) {
        uptimeStats[component] = this.calculateComponentUptime(
          compEvents as any[],
          days,
        );
      }

      return {
        period: `${days} days`,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        components: uptimeStats,
      };
    } catch (error) {
      logger.error("Failed to calculate uptime stats:", error);
      throw error;
    }
  }

  private calculateComponentUptime(events: any[], days: number): any {
    if (events.length === 0) {
      return {
        uptime: 0,
        operational: 0,
        degraded: 0,
        down: 0,
      };
    }

    let operationalTime = 0;
    let degradedTime = 0;
    let downTime = 0;
    let lastEvent = events[0];
    const totalMs = days * 24 * 60 * 60 * 1000;

    for (let i = 1; i < events.length; i++) {
      const currentEvent = events[i];
      const duration =
        currentEvent.createdAt.getTime() - lastEvent.createdAt.getTime();

      switch (lastEvent.status) {
        case "operational":
          operationalTime += duration;
          break;
        case "degraded":
          degradedTime += duration;
          break;
        case "down":
          downTime += duration;
          break;
      }

      lastEvent = currentEvent;
    }

    // Add time from last event to now
    const now = new Date();
    const remainingTime = now.getTime() - lastEvent.createdAt.getTime();

    switch (lastEvent.status) {
      case "operational":
        operationalTime += remainingTime;
        break;
      case "degraded":
        degradedTime += remainingTime;
        break;
      case "down":
        downTime += remainingTime;
        break;
    }

    const uptime = ((operationalTime / totalMs) * 100).toFixed(2);

    return {
      uptime: parseFloat(uptime),
      operational: ((operationalTime / totalMs) * 100).toFixed(2),
      degraded: ((degradedTime / totalMs) * 100).toFixed(2),
      down: ((downTime / totalMs) * 100).toFixed(2),
    };
  }

  // Method to get incident history
  async getIncidentHistory(days: number = 90): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const events = await this.prisma.statusEvent.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
          status: {
            in: ["degraded", "down"],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Group events into incidents
      const incidents: any[] = [];
      let currentIncident: any = null;

      for (const event of events) {
        if (event.status === "degraded" || event.status === "down") {
          if (!currentIncident) {
            currentIncident = {
              id: event.id,
              component: event.component,
              status: event.status,
              startedAt: event.createdAt,
              message: event.message,
              metadata: event.metadata ? JSON.parse(event.metadata) : undefined,
              resolvedAt: null,
              duration: null,
            };
          }
        } else if (
          currentIncident &&
          event.component === currentIncident.component
        ) {
          // This is a resolution event
          currentIncident.resolvedAt = event.createdAt;
          currentIncident.duration =
            event.createdAt.getTime() - currentIncident.startedAt.getTime();
          incidents.push(currentIncident);
          currentIncident = null;
        }
      }

      // If there's an ongoing incident, add it
      if (currentIncident) {
        currentIncident.duration =
          Date.now() - currentIncident.startedAt.getTime();
        incidents.push(currentIncident);
      }

      return {
        period: `${days} days`,
        incidents: incidents.map((incident) => ({
          ...incident,
          durationMinutes: Math.round(incident.duration / (1000 * 60)),
        })),
      };
    } catch (error) {
      logger.error("Failed to get incident history:", error);
      throw error;
    }
  }
}
