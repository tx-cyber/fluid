import { NextFunction, Request, Response } from "express";
import { ApiKeyConfig, maskApiKey } from "./apiKeys";
import { incrWithExpiry } from "../utils/redis";
import { TenantUsageTracker } from "../services/tenantUsageTracker";

// Fallback in-memory bucket if Redis is unavailable.
interface UsageEntry {
  count: number;
  resetTime: number;
}

const usageByApiKey = new Map<string, UsageEntry>();
const usageTracker = new TenantUsageTracker();

function getUsageEntry(apiKeyConfig: ApiKeyConfig): UsageEntry {
  const now = Date.now();
  const existingEntry = usageByApiKey.get(apiKeyConfig.key);

  if (!existingEntry || now >= existingEntry.resetTime) {
    const freshEntry: UsageEntry = {
      count: 0,
      resetTime: now + apiKeyConfig.windowMs,
    };

    usageByApiKey.set(apiKeyConfig.key, freshEntry);
    return freshEntry;
  }

  return existingEntry;
}

export async function apiKeyRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKeyConfig = res.locals.apiKey as ApiKeyConfig | undefined;

  if (!apiKeyConfig) {
    res.status(500).json({
      error: "API key context missing before rate limiting.",
    });
    return;
  }

  const windowSeconds = Math.max(1, Math.ceil(apiKeyConfig.windowMs / 1000));
  const rateLimit = apiKeyConfig.rateLimit;

  // Try Redis atomic counter first.
  try {
    const key = `rl:${apiKeyConfig.key}`;
    const result = await incrWithExpiry(key, windowSeconds);

    if (result) {
      const { count, ttl } = result;

      res.setHeader("X-RateLimit-Limit", rateLimit.toString());
      res.setHeader("X-RateLimit-Remaining", Math.max(rateLimit - count, 0).toString());
      res.setHeader("X-RateLimit-Reset", Math.ceil((Date.now() / 1000) + ttl).toString());

      if (count > rateLimit) {
        // Record violation for intelligent rate limiting
        usageTracker.recordViolation(apiKeyConfig.tenantId).catch(() => { }); // Don't block on errors

        res.status(429).json({
          error: `API key rate limit exceeded for ${maskApiKey(apiKeyConfig.key)} (${apiKeyConfig.tierName} tier).`,
          tier: apiKeyConfig.tier,
          tierName: apiKeyConfig.tierName,
          limit: rateLimit,
          retryAfterSeconds: Math.max(ttl, 0),
        });
        return;
      }

      // Record successful request for intelligent rate limiting
      usageTracker.recordRequest(apiKeyConfig.tenantId).catch(() => { }); // Don't block on errors

      // allowed
      next();
      return;
    }
  } catch (err) {
    // If Redis helper threw, we'll fall back to in-memory below.
  }

  // Fallback to in-memory windowing if Redis is unavailable
  const usageEntry = getUsageEntry(apiKeyConfig);
  const now = Date.now();

  res.setHeader("X-RateLimit-Limit", rateLimit.toString());
  res.setHeader(
    "X-RateLimit-Remaining",
    Math.max(rateLimit - usageEntry.count - 1, 0).toString()
  );
  res.setHeader("X-RateLimit-Reset", Math.ceil(usageEntry.resetTime / 1000).toString());

  if (usageEntry.count >= rateLimit) {
    // Record violation for intelligent rate limiting
    usageTracker.recordViolation(apiKeyConfig.tenantId).catch(() => { }); // Don't block on errors

    res.status(429).json({
      error: `API key rate limit exceeded for ${maskApiKey(apiKeyConfig.key)} (${apiKeyConfig.tierName} tier).`,
      tier: apiKeyConfig.tier,
      tierName: apiKeyConfig.tierName,
      limit: rateLimit,
      retryAfterSeconds: Math.max(Math.ceil((usageEntry.resetTime - now) / 1000), 0),
    });
    return;
  }

  // Record successful request for intelligent rate limiting
  usageTracker.recordRequest(apiKeyConfig.tenantId).catch(() => { }); // Don't block on errors

  usageEntry.count += 1;
  next();
}
