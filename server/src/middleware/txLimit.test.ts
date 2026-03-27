import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantTierTxLimit } from "./txLimit";
import type { ApiKeyConfig } from "./apiKeys";

vi.mock("../models/transactionLedger", () => ({
  getTenantDailyTransactionCount: vi.fn(),
}));

import { getTenantDailyTransactionCount } from "../models/transactionLedger";

const mockedCount = vi.mocked(getTenantDailyTransactionCount);

function buildApiKeyConfig(overrides: Partial<ApiKeyConfig> = {}): ApiKeyConfig {
  return {
    key: "free-key",
    tenantId: "tenant-free",
    name: "Free Tenant",
    tier: "free",
    tierName: "Free",
    tierId: "tier-free",
    txLimit: 10,
    rateLimit: 5,
    priceMonthly: 0,
    maxRequests: 5,
    windowMs: 60_000,
    dailyQuotaStroops: 1_000_000,
    ...overrides,
  };
}

function buildResponse(apiKey: ApiKeyConfig) {
  const headers = new Map<string, string>();

  return {
    locals: { apiKey },
    statusCode: 200,
    body: null as unknown,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    getHeader(name: string) {
      return headers.get(name);
    },
  };
}

describe("tenantTierTxLimit", () => {
  beforeEach(() => {
    mockedCount.mockReset();
  });

  it("rejects a free tenant after the 10th transaction in the day", async () => {
    mockedCount.mockResolvedValue(10);

    const res = buildResponse(buildApiKeyConfig());
    const next = vi.fn();

    await tenantTierTxLimit({} as never, res as never, next);

    expect(res.statusCode).toBe(429);
    expect(res.getHeader("X-Tier-Tx-Limit")).toBe("10");
    expect(next).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      tier: "free",
      tierName: "Free",
      txLimit: 10,
      currentTxCount: 10,
    });
  });

  it("allows a pro tenant when it still has daily tier capacity", async () => {
    mockedCount.mockResolvedValue(42);

    const res = buildResponse(
      buildApiKeyConfig({
        tier: "pro",
        tierName: "Pro",
        tierId: "tier-pro",
        txLimit: 1000,
        rateLimit: 60,
        priceMonthly: 4900,
        maxRequests: 60,
      }),
    );
    const next = vi.fn();

    await tenantTierTxLimit({} as never, res as never, next);

    expect(res.statusCode).toBe(200);
    expect(res.getHeader("X-Tier-Tx-Limit")).toBe("1000");
    expect(res.getHeader("X-Tier-Tx-Remaining")).toBe("958");
    expect(next).toHaveBeenCalledTimes(1);
  });
});
