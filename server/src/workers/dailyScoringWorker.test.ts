import { describe, it, expect, beforeEach, vi } from "vitest";
import { DailyScoringWorker } from "../workers/dailyScoringWorker";

// Mock the dependencies
vi.mock("../services/tenantUsageTracker", () => ({
  TenantUsageTracker: vi.fn().mockImplementation(() => ({
    updateDailyStats: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../services/intelligentRateLimiter", () => ({
  IntelligentRateLimiter: vi.fn().mockImplementation(() => ({
    processAutoAdjustments: vi.fn().mockResolvedValue([
      {
        tenantId: "tenant-1",
        fromTier: "Free",
        toTier: "Pro",
        reason: "auto_upgrade",
      },
    ]),
  })),
}));

vi.mock("../services/notificationService", () => ({
  createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock node-cron
vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn(),
    getTasks: vi.fn(() => new Map()),
  },
}));

describe("DailyScoringWorker", () => {
  let worker: DailyScoringWorker;

  beforeEach(() => {
    worker = new DailyScoringWorker();
    vi.clearAllMocks();
  });

  describe("runDailyScoring", () => {
    it("should run daily scoring successfully", async () => {
      await worker.runDailyScoring();

      // Verify that usage stats were updated
      const { TenantUsageTracker } = await import("../services/tenantUsageTracker");
      const mockTracker = vi.mocked(TenantUsageTracker).mock.instances[0];
      expect(mockTracker.updateDailyStats).toHaveBeenCalled();

      // Verify that adjustments were processed
      const { IntelligentRateLimiter } = await import("../services/intelligentRateLimiter");
      const mockRateLimiter = vi.mocked(IntelligentRateLimiter).mock.instances[0];
      expect(mockRateLimiter.processAutoAdjustments).toHaveBeenCalled();

      // Verify notification was created
      const { createNotification } = await import("../services/notificationService");
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "info",
          title: "Daily Rate Limit Adjustments",
        })
      );
    });

    it("should handle errors gracefully", async () => {
      // Mock an error in usage tracker
      const { TenantUsageTracker } = await import("../services/tenantUsageTracker");
      const mockTracker = vi.mocked(TenantUsageTracker).mock.instances[0];
      mockTracker.updateDailyStats.mockRejectedValue(new Error("Database error"));

      // Should not throw
      await expect(worker.runDailyScoring()).resolves.toBeUndefined();

      // Should log error
      const { logger } = await import("../utils/logger");
      expect(logger.error).toHaveBeenCalledWith(
        "Daily scoring job failed",
        expect.any(Object)
      );
    });

    it("should not run if already running", async () => {
      // Set worker as running
      worker["isRunning"] = true;

      await worker.runDailyScoring();

      // Verify that nothing was processed
      const { TenantUsageTracker } = await import("../services/tenantUsageTracker");
      const mockTracker = vi.mocked(TenantUsageTracker).mock.instances[0];
      expect(mockTracker.updateDailyStats).not.toHaveBeenCalled();
    });

    it("should not create notification when no adjustments", async () => {
      // Mock no adjustments
      const { IntelligentRateLimiter } = await import("../services/intelligentRateLimiter");
      const mockRateLimiter = vi.mocked(IntelligentRateLimiter).mock.instances[0];
      mockRateLimiter.processAutoAdjustments.mockResolvedValue([]);

      await worker.runDailyScoring();

      // Verify no notification was created
      const { createNotification } = await import("../services/notificationService");
      expect(createNotification).not.toHaveBeenCalled();
    });
  });

  describe("getStatus", () => {
    it("should return current status", () => {
      const status = worker.getStatus();

      expect(status).toEqual({
        isRunning: false,
      });
    });
  });

  describe("start", () => {
    it("should schedule the daily job", () => {
      const cron = require("node-cron");
      
      worker.start();

      expect(cron.schedule).toHaveBeenCalledWith(
        "0 2 * * *",
        expect.any(Function),
        { timezone: "UTC" }
      );
    });
  });

  describe("stop", () => {
    it("should stop all scheduled tasks", () => {
      const cron = require("node-cron");
      const mockTask = { stop: vi.fn() };
      const mockTasks = new Map([["task1", mockTask]]);
      cron.getTasks.mockReturnValue(mockTasks);

      worker.stop();

      expect(mockTask.stop).toHaveBeenCalled();
    });
  });
});
