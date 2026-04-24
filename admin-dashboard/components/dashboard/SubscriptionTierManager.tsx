"use client";

import { useMemo, useState } from "react";
import type {
  SubscriptionTier,
  TenantTierSummary,
} from "@/components/dashboard/types";
import { ArrowUpRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface Props {
  tiers: SubscriptionTier[];
  tenants: TenantTierSummary[];
  initialTenant: TenantTierSummary | null;
  source: "live" | "sample";
}

function formatPrice(priceMonthly: number) {
  if (priceMonthly === 0) return "Custom / $0";
  return `$${(priceMonthly / 100).toFixed(0)}/mo`;
}

export function SubscriptionTierManager({
  tiers,
  tenants,
  initialTenant,
  source,
}: Props) {
  const [tenantId, setTenantId] = useState(initialTenant?.id ?? tenants[0]?.id ?? "");
  const [currentTenant, setCurrentTenant] = useState<TenantTierSummary | null>(
    initialTenant ?? tenants[0] ?? null,
  );
  const [savingTierId, setSavingTierId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    source === "sample"
      ? "Sample mode is active, so upgrade actions update the preview state only."
      : null,
  );

  const sortedTiers = useMemo(
    () => [...tiers].sort((left, right) => left.priceMonthly - right.priceMonthly),
    [tiers],
  );

  async function handleTenantChange(nextTenantId: string) {
    setTenantId(nextTenantId);
    setError(null);

    if (source === "sample") {
      const tenant = tenants.find((item) => item.id === nextTenantId) ?? null;
      setCurrentTenant(tenant);
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/subscription-tiers?tenantId=${encodeURIComponent(nextTenantId)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load tenant tier");
      }
      setCurrentTenant((payload.tenant as TenantTierSummary | null) ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load tenant tier");
    }
  }

  async function handleUpgrade(tier: SubscriptionTier) {
    if (!currentTenant) return;

    setSavingTierId(tier.id);
    setError(null);
    setNotice(null);

    if (source === "sample") {
      const updatedTenant = {
        ...currentTenant,
        subscriptionTierId: tier.id,
        subscriptionTier: tier,
      };
      setCurrentTenant(updatedTenant);
      setNotice(`Preview updated: ${currentTenant.name} is now on ${tier.name}.`);
      setSavingTierId(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/tenants/${encodeURIComponent(currentTenant.id)}/subscription-tier`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: tier.id }),
        },
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update tenant tier");
      }

      setCurrentTenant(payload.tenant as TenantTierSummary);
      setNotice(`${currentTenant.name} upgraded to ${tier.name}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update tenant tier");
    } finally {
      setSavingTierId(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white px-6 py-7 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
            <Sparkles className="h-3.5 w-3.5" />
            Upgrade Tier
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">
            Tiered SaaS controls for every tenant
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Choose the plan that controls request throughput and the daily transaction allowance.
          </p>
        </div>

        <label className="flex min-w-[220px] flex-col gap-2 text-sm font-medium text-slate-700">
          Tenant
          <select
            value={tenantId}
            onChange={(event) => void handleTenantChange(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {currentTenant ? (
        <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-950 px-5 py-4 text-white">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300">
            Current plan
          </div>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-2xl font-semibold">{currentTenant.subscriptionTier.name}</div>
              <div className="mt-1 text-sm text-slate-300">
                {currentTenant.subscriptionTier.txLimit.toLocaleString()} tx/day and{" "}
                {currentTenant.subscriptionTier.rateLimit.toLocaleString()} requests/minute
              </div>
            </div>
            <div className="text-sm text-slate-300">
              {formatPrice(currentTenant.subscriptionTier.priceMonthly)}
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {sortedTiers.map((tier) => {
          const isCurrent = currentTenant?.subscriptionTier.id === tier.id;
          const isSaving = savingTierId === tier.id;

          return (
            <article
              key={tier.id}
              className={`rounded-[1.75rem] border p-5 transition ${
                isCurrent
                  ? "border-sky-500 bg-sky-50 shadow-[0_20px_60px_-30px_rgba(14,165,233,0.55)]"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-950">{tier.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{formatPrice(tier.priceMonthly)}</p>
                </div>
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Current
                  </span>
                ) : null}
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl bg-slate-100 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Daily transactions
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">
                    {tier.txLimit.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-100 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Request rate
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">
                    {tier.rateLimit.toLocaleString()}/min
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isCurrent || isSaving || !currentTenant}
                onClick={() => void handleUpgrade(tier)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
                {isCurrent ? "Current tier" : `Move to ${tier.name}`}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
