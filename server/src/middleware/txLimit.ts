import { NextFunction, Request, Response } from "express";
import { ApiKeyConfig } from "./apiKeys";
import { getTenantDailyTransactionCount } from "../models/transactionLedger";

function getSecondsUntilUtcMidnight(now: Date): number {
  const nextMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return Math.max(Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000), 0);
}

export async function tenantTierTxLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKeyConfig = res.locals.apiKey as ApiKeyConfig | undefined;

  if (!apiKeyConfig) {
    res.status(500).json({
      error: "API key context missing before tier transaction limiting.",
    });
    return;
  }

  const currentTxCount = await getTenantDailyTransactionCount(apiKeyConfig.tenantId);
  const remaining = Math.max(apiKeyConfig.txLimit - currentTxCount, 0);
  res.setHeader("X-Tier-Tx-Limit", apiKeyConfig.txLimit.toString());
  res.setHeader("X-Tier-Tx-Remaining", remaining.toString());

  if (currentTxCount >= apiKeyConfig.txLimit) {
    res.status(429).json({
      error: `Daily transaction limit exceeded for tenant ${apiKeyConfig.tenantId} (${apiKeyConfig.tierName} tier).`,
      tier: apiKeyConfig.tier,
      tierName: apiKeyConfig.tierName,
      txLimit: apiKeyConfig.txLimit,
      currentTxCount,
      retryAfterSeconds: getSecondsUntilUtcMidnight(new Date()),
    });
    return;
  }

  next();
}
