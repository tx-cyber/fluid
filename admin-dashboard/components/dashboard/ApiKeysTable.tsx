"use client";

import { useState } from "react";
import { ShieldOff } from "lucide-react";
import type { ApiKey } from "@/components/dashboard/types";
import { RevokeKeyDialog } from "@/components/dashboard/RevokeKeyDialog";

interface ApiKeysTableProps {
  initialKeys: ApiKey[];
  serverUrl: string;
  adminToken: string;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function ApiKeysTable({
  initialKeys,
  serverUrl,
  adminToken,
}: ApiKeysTableProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null);

  async function handleRevoke(keyId: string) {
    const res = await fetch(`${serverUrl}/admin/api-keys/${keyId}/revoke`, {
      method: "PATCH",
      headers: {
        "x-admin-token": adminToken,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `Request failed (${res.status})`);
    }

    // Optimistic update — mark key as inactive in local state
    setKeys((prev) =>
      prev.map((k: ApiKey) => (k.id === keyId ? { ...k, active: false } : k)),
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">API Keys</h2>
          <p className="mt-1 text-sm text-slate-500">
            Revoke a key immediately if it is leaked or a dApp is abusive.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Key
                </th>
                <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">
                  Tenant
                </th>
                <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">
                  Created
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {keys.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-slate-400"
                  >
                    No API keys found.
                  </td>
                </tr>
              )}
              {keys.map((apiKey: ApiKey) => (
                <tr
                  key={apiKey.id}
                  className={
                    apiKey.active
                      ? "transition hover:bg-slate-50"
                      : "bg-slate-50 opacity-60"
                  }
                >
                  {/* Key display */}
                  <td className="px-5 py-4">
                    <span
                      className={`font-mono text-sm ${
                        apiKey.active
                          ? "text-slate-900"
                          : "text-slate-400 line-through"
                      }`}
                    >
                      {apiKey.key}
                    </span>
                  </td>

                  {/* Tenant */}
                  <td className="hidden px-5 py-4 text-sm text-slate-600 sm:table-cell">
                    {apiKey.tenantId}
                  </td>

                  {/* Created */}
                  <td className="hidden px-5 py-4 text-sm text-slate-500 md:table-cell">
                    {formatDate(apiKey.createdAt)}
                  </td>

                  {/* Status badge */}
                  <td className="px-5 py-4">
                    {apiKey.active ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold capitalize text-rose-700 ring-1 ring-inset ring-rose-200">
                        Revoked
                      </span>
                    )}
                  </td>

                  {/* Revoke action */}
                  <td className="px-5 py-4 text-right">
                    {apiKey.active ? (
                      <button
                        type="button"
                        onClick={() => setPendingRevoke(apiKey)}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                        aria-label={`Revoke API key ${apiKey.key}`}
                      >
                        <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                        Revoke
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pendingRevoke && (
        <RevokeKeyDialog
          keyId={pendingRevoke.id}
          keyDisplay={pendingRevoke.key}
          onConfirm={handleRevoke}
          onClose={() => setPendingRevoke(null)}
        />
      )}
    </>
  );
}
