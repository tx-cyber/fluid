"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getDailySpendData, type SpendDataPoint } from "@/lib/spend-chart-data";

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SpendDataPoint }>;
}

function SpendTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(point.isoDate));

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-medium text-slate-500">{formatted}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">
        {point.xlmSpent.toLocaleString()}{" "}
        <span className="text-sm font-normal text-sky-600">XLM</span>
      </p>
    </div>
  );
}

// ─── SpendChart ───────────────────────────────────────────────────────────────

export function SpendChart() {
  const data = getDailySpendData();

  // Show every 5th label so the X-axis stays clean
  const tickFormatter = (_: string, index: number) =>
    index % 5 === 0 ? data[index]?.date ?? "" : "";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">
          Analytics
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Daily XLM Spend</h2>
        <p className="mt-0.5 text-sm text-slate-500">Treasury expenditure over the last 30 days</p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="xlmGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={tickFormatter}
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />

          <Tooltip content={<SpendTooltip />} cursor={{ stroke: "#0ea5e9", strokeWidth: 1 }} />

          <Area
            type="monotone"
            dataKey="xlmSpent"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#xlmGradient)"
            dot={false}
            activeDot={{ r: 5, fill: "#0ea5e9", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}