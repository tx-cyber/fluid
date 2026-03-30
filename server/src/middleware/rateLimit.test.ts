import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiKeyRateLimit } from "./rateLimit";
import type { ApiKeyConfig } from "./apiKeys";

vi.mock("../utils/redis", () => ({
  incrWithExpiry: vi.fn().mockResolvedValue(null),
}));

function buildApiKeyConfig(overrides: Partial<ApiKeyConfig> = {}): ApiKeyConfig {
  return {
    key: "free-key",
    tenantId: "tenant-free",
    name: "Free Tenant",
    tier: "free",
    tierName: "Free",
    tierId: "tier-free",
    txLimit: 10,
    rateLimit: 1,
    priceMonthly: 0,
    maxRequests: 1,
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

describe("apiKeyRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("uses the tier rate limit when deciding whether to reject requests", async () => {
    const apiKey = buildApiKeyConfig({ rateLimit: 1, maxRequests: 50 });
    const next = vi.fn();

    const firstRes = buildResponse(apiKey);
    await apiKeyRateLimit({} as never, firstRes as never, next);
    expect(next).toHaveBeenCalledTimes(1);

    const secondRes = buildResponse(apiKey);
    await apiKeyRateLimit({} as never, secondRes as never, vi.fn());

    expect(secondRes.statusCode).toBe(429);
    expect(secondRes.body).toMatchObject({
      tier: "free",
      tierName: "Free",
      limit: 1,
    });
  });
});
