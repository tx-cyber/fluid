export const SUBSCRIPTION_TIER_NAMES = ["Free", "Pro", "Enterprise"] as const;

export type SubscriptionTierName = (typeof SUBSCRIPTION_TIER_NAMES)[number];
export type SubscriptionTierCode = "free" | "pro" | "enterprise";

export interface SubscriptionTierSnapshot {
  id: string;
  name: SubscriptionTierName;
  txLimit: number;
  rateLimit: number;
  priceMonthly: number;
}

export function toTierCode(name: string): SubscriptionTierCode {
  switch (name.trim().toLowerCase()) {
    case "free":
      return "free";
    case "pro":
      return "pro";
    case "enterprise":
      return "enterprise";
    default:
      return "free";
  }
}
