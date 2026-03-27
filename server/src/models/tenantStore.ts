import { ApiKeyConfig } from "../middleware/apiKeys";
import { SubscriptionTierCode, SubscriptionTierName } from "./subscriptionTier";

export interface Tenant {
  id: string;
  apiKey: string;
  name: string;
  tier: SubscriptionTierCode;
  tierName: SubscriptionTierName;
  txLimit: number;
  rateLimit: number;
  priceMonthly: number;
  dailyQuotaStroops: number;
}

const tenantsByApiKey = new Map<string, Tenant>();

export function syncTenantFromApiKey(apiKeyConfig: ApiKeyConfig): Tenant {
  const existingTenant = tenantsByApiKey.get(apiKeyConfig.key);

  if (existingTenant) {
    const updatedTenant: Tenant = {
      ...existingTenant,
      name: apiKeyConfig.name,
      tier: apiKeyConfig.tier,
      tierName: apiKeyConfig.tierName,
      txLimit: apiKeyConfig.txLimit,
      rateLimit: apiKeyConfig.rateLimit,
      priceMonthly: apiKeyConfig.priceMonthly,
      dailyQuotaStroops: apiKeyConfig.dailyQuotaStroops,
    };

    tenantsByApiKey.set(apiKeyConfig.key, updatedTenant);
    return updatedTenant;
  }

  const tenant: Tenant = {
    id: apiKeyConfig.tenantId,
    apiKey: apiKeyConfig.key,
    name: apiKeyConfig.name,
    tier: apiKeyConfig.tier,
    tierName: apiKeyConfig.tierName,
    txLimit: apiKeyConfig.txLimit,
    rateLimit: apiKeyConfig.rateLimit,
    priceMonthly: apiKeyConfig.priceMonthly,
    dailyQuotaStroops: apiKeyConfig.dailyQuotaStroops,
  };

  tenantsByApiKey.set(apiKeyConfig.key, tenant);
  return tenant;
}

export function getTenantByApiKey(apiKey: string): Tenant | undefined {
  return tenantsByApiKey.get(apiKey);
}
