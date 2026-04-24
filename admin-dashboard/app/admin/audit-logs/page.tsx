"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getAuditLogsData, type AuditLogEntry, type AuditLogPageData } from "@/lib/audit-logs-data";

function AiSummaryTooltip({ summary }: { summary: string }) {
  return (
    <span className="group relative cursor-help">
      <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
        AI
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {summary}
      </span>
    </span>
  );
}

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const time = new Date(entry.createdAt).toLocaleString();

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition">
      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{time}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
          {entry.action}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">{entry.actor}</td>
      <td className="px-4 py-3 text-sm text-slate-500 font-mono truncate max-w-[160px]">
        {entry.target ?? "—"}
      </td>
      <td className="px-4 py-3 text-sm">
        {entry.aiSummary ? (
          <div className="flex items-center gap-2">
            <AiSummaryTooltip summary={entry.aiSummary} />
            <span className="text-slate-600 truncate max-w-[260px]">{entry.aiSummary}</span>
          </div>
        ) : (
          <span className="text-slate-400 italic text-xs">pending…</span>
        )}
      </td>
    </tr>
  );
}

export default function AdminAuditLogsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<AuditLogPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    getAuditLogsData(limit, offset).then(setData).finally(() => setLoading(false));
  }, [offset]);

  const hasPrev = offset > 0;
  const hasNext = data ? offset + limit < data.total : false;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-600">
                Fluid Admin
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Audit Logs</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Track admin and system actions with AI-generated summaries.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-900">{session?.user?.email}</div>
                <div>{data?.source === "live" ? "Live server data" : "Sample data"}</div>
              </div>
              <Link
                href="/admin/dashboard"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-64 bg-slate-200 rounded-xl" />
          </div>
        ) : !data ? (
          <p className="text-center py-12 text-red-600">Failed to load audit logs</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">AI Summary</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                      No audit logs yet
                    </td>
                  </tr>
                ) : (
                  data.items.map((entry) => <AuditLogRow key={entry.id} entry={entry} />)
                )}
              </tbody>
            </table>

            {data.total > limit && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
                <span>
                  Showing {offset + 1}–{Math.min(offset + limit, data.total)} of {data.total}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={!hasPrev}
                    onClick={() => setOffset((o) => Math.max(0, o - limit))}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={!hasNext}
                    onClick={() => setOffset((o) => o + limit)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
