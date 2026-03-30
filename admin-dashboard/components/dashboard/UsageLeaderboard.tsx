import Link from "next/link";
import type { TenantUsageRow } from "@/components/dashboard/types";

interface UsageLeaderboardProps {
  rows: TenantUsageRow[];
  sortBy?: "cost" | "txCount";
  transactionsBasePath?: string;
}

// Palette cycles through distinct hues for each rank
const BAR_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
];

function formatStroops(stroops: number): string {
  if (stroops >= 10_000_000) {
    return `${(stroops / 10_000_000).toFixed(2)} XLM`;
  }
  return `${stroops.toLocaleString()} stroops`;
}

export function UsageLeaderboard({
  rows,
  sortBy = "cost",
  transactionsBasePath = "/admin/transactions",
}: UsageLeaderboardProps) {
  const sorted = [...rows].sort((a, b) =>
    sortBy === "cost"
      ? b.totalCostStroops - a.totalCostStroops
      : b.txCount - a.txCount,
  );

  const maxCost = sorted[0]?.totalCostStroops ?? 1;
  const maxTx = sorted[0]?.txCount ?? 1;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Tenant Usage Ranking
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Top tenants by XLM spent and transaction volume.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />
            XLM cost
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />
            Tx count
          </span>
        </div>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-slate-100">
        {sorted.map((row, index) => {
          const costPct = Math.max(2, (row.totalCostStroops / maxCost) * 100);
          const txPct = Math.max(2, (row.txCount / maxTx) * 100);
          const barColor = BAR_COLORS[index % BAR_COLORS.length];
          const rank = index + 1;

          return (
            <li key={row.tenant} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                {/* Rank + name */}
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500"
                    aria-label={`Rank ${rank}`}
                  >
                    {rank}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`${transactionsBasePath}?q=${encodeURIComponent(row.tenant)}`}
                      className="truncate text-sm font-semibold text-slate-900 underline-offset-2 hover:text-sky-600 hover:underline"
                    >
                      {row.tenant}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span>{row.txCount} txns</span>
                      <span
                        className={
                          row.failedCount > 0
                            ? "text-rose-500"
                            : "text-slate-400"
                        }
                      >
                        {row.failedCount} failed
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cost label */}
                <div className="shrink-0 text-right">
                  <span className="text-sm font-semibold text-slate-900">
                    {formatStroops(row.totalCostStroops)}
                  </span>
                </div>
              </div>

              {/* Progress bars */}
              <div className="mt-3 space-y-1.5">
                {/* XLM cost bar */}
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label={`${row.tenant} XLM cost`}
                  aria-valuenow={row.totalCostStroops}
                  aria-valuemax={maxCost}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${costPct}%` }}
                  />
                </div>
                {/* Tx count bar */}
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label={`${row.tenant} transaction count`}
                  aria-valuenow={row.txCount}
                  aria-valuemax={maxTx}
                >
                  <div
                    className="h-full rounded-full bg-slate-300 transition-all duration-500"
                    style={{ width: `${txPct}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}

        {sorted.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-slate-400">
            No tenant data available.
          </li>
        )}
      </ul>

      {/* Footer */}
      <div className="border-t border-slate-100 px-5 py-3">
        <Link
          href={transactionsBasePath}
          className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
        >
          View full transaction history →
        </Link>
      </div>
    </div>
  );
}
