"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface ChainRecord {
  id: string;
  chainId: string;
  name: string;
  rpcUrl: string;
  enabled: boolean;
  hasFeePayerSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

function statusTone(enabled: boolean) {
  return enabled
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

export function ChainRegistryManager({ chains }: { chains: ChainRecord[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Add chain modal ──────────────────────────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [addForm, setAddForm] = useState({
    chainId: "",
    name: "",
    rpcUrl: "",
    feePayerSecret: "",
  });

  // ── Edit chain modal ──────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<ChainRecord | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    rpcUrl: "",
    feePayerSecret: "",
  });
  const [editError, setEditError] = useState("");

  // ── Inline status ─────────────────────────────────────────────────────────
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<Record<string, string>>({});

  function openEdit(chain: ChainRecord) {
    setEditTarget(chain);
    setEditForm({ name: chain.name, rpcUrl: chain.rpcUrl, feePayerSecret: "" });
    setEditError("");
  }

  function closeEdit() {
    setEditTarget(null);
    setEditError("");
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleAddChain() {
    setAddError("");
    if (!addForm.chainId.trim() || !addForm.name.trim() || !addForm.rpcUrl.trim()) {
      setAddError("chainId, name, and rpcUrl are required");
      return;
    }

    const res = await fetch("/api/admin/chains", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chainId: addForm.chainId.trim(),
        name: addForm.name.trim(),
        rpcUrl: addForm.rpcUrl.trim(),
        feePayerSecret: addForm.feePayerSecret.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setAddError(data.error ?? "Failed to add chain");
      return;
    }

    setIsAddOpen(false);
    setAddForm({ chainId: "", name: "", rpcUrl: "", feePayerSecret: "" });
    startTransition(() => router.refresh());
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setEditError("");

    const body: Record<string, unknown> = {};
    if (editForm.name.trim()) body.name = editForm.name.trim();
    if (editForm.rpcUrl.trim()) body.rpcUrl = editForm.rpcUrl.trim();
    if (editForm.feePayerSecret.trim()) body.feePayerSecret = editForm.feePayerSecret.trim();

    const res = await fetch(`/api/admin/chains/${editTarget.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setEditError(data.error ?? "Failed to update chain");
      return;
    }

    closeEdit();
    startTransition(() => router.refresh());
  }

  async function handleToggleEnabled(chain: ChainRecord) {
    setTogglingId(chain.id);
    setInlineError((prev) => ({ ...prev, [chain.id]: "" }));

    const res = await fetch(`/api/admin/chains/${chain.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !chain.enabled }),
    });

    const data = await res.json();
    if (!res.ok) {
      setInlineError((prev) => ({
        ...prev,
        [chain.id]: data.error ?? "Failed to toggle chain",
      }));
    } else {
      startTransition(() => router.refresh());
    }

    setTogglingId(null);
  }

  async function handleDelete(chain: ChainRecord) {
    if (!confirm(`Delete chain "${chain.name}"? This cannot be undone.`)) return;
    setDeletingId(chain.id);

    const res = await fetch(`/api/admin/chains/${chain.id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      setInlineError((prev) => ({
        ...prev,
        [chain.id]: data.error ?? "Failed to delete chain",
      }));
      setDeletingId(null);
      return;
    }

    startTransition(() => router.refresh());
    setDeletingId(null);
  }

  const enabledCount = chains.filter((c) => c.enabled).length;

  return (
    <>
      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total chains" value={chains.length} />
        <StatCard label="Enabled" value={enabledCount} highlight />
        <StatCard label="Disabled" value={chains.length - enabledCount} />
      </div>

      {/* ── Table card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Chain Registry</h2>
          <button
            onClick={() => { setIsAddOpen(true); setAddError(""); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            + Add chain
          </button>
        </div>

        {chains.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No chains configured yet. Click <strong>Add chain</strong> to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">Chain ID</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">RPC URL</th>
                  <th className="px-6 py-3">Fee Payer</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {chains.map((chain) => (
                  <tr key={chain.id} className="group hover:bg-slate-50/60">
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">
                      {chain.chainId}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {chain.name}
                    </td>
                    <td className="max-w-[240px] truncate px-6 py-4 font-mono text-xs text-slate-500">
                      {chain.rpcUrl}
                    </td>
                    <td className="px-6 py-4">
                      {chain.hasFeePayerSecret ? (
                        <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
                          custom
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                          global
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(chain.enabled)}`}>
                        {chain.enabled ? "Enabled" : "Disabled"}
                      </span>
                      {inlineError[chain.id] && (
                        <p className="mt-1 text-xs text-rose-600">{inlineError[chain.id]}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleEnabled(chain)}
                          disabled={togglingId === chain.id || isPending}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            chain.enabled
                              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          } disabled:opacity-50`}
                        >
                          {togglingId === chain.id
                            ? "…"
                            : chain.enabled
                            ? "Disable"
                            : "Enable"}
                        </button>
                        <button
                          onClick={() => openEdit(chain)}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(chain)}
                          disabled={deletingId === chain.id}
                          className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          {deletingId === chain.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add chain modal ── */}
      {isAddOpen && (
        <Modal title="Add chain" onClose={() => setIsAddOpen(false)}>
          <FieldGroup>
            <Field label="Chain ID" hint="Unique identifier, e.g. mainnet or testnet">
              <input
                value={addForm.chainId}
                onChange={(e) => setAddForm((f) => ({ ...f, chainId: e.target.value }))}
                placeholder="mainnet"
                className={inputCls}
              />
            </Field>
            <Field label="Name">
              <input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Stellar Mainnet"
                className={inputCls}
              />
            </Field>
            <Field label="RPC / Horizon URL">
              <input
                value={addForm.rpcUrl}
                onChange={(e) => setAddForm((f) => ({ ...f, rpcUrl: e.target.value }))}
                placeholder="https://horizon.stellar.org"
                className={inputCls}
              />
            </Field>
            <Field label="Fee payer secret" hint="Leave blank to use the global fee payer">
              <input
                type="password"
                value={addForm.feePayerSecret}
                onChange={(e) => setAddForm((f) => ({ ...f, feePayerSecret: e.target.value }))}
                placeholder="S…"
                className={inputCls}
              />
            </Field>
          </FieldGroup>
          {addError && <p className="mt-3 text-sm text-rose-600">{addError}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setIsAddOpen(false)} className={secondaryBtnCls}>
              Cancel
            </button>
            <button onClick={handleAddChain} className={primaryBtnCls}>
              Add chain
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit chain modal ── */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.chainId}`} onClose={closeEdit}>
          <FieldGroup>
            <Field label="Name">
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="RPC / Horizon URL">
              <input
                value={editForm.rpcUrl}
                onChange={(e) => setEditForm((f) => ({ ...f, rpcUrl: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="New fee payer secret" hint="Leave blank to keep existing">
              <input
                type="password"
                value={editForm.feePayerSecret}
                onChange={(e) => setEditForm((f) => ({ ...f, feePayerSecret: e.target.value }))}
                placeholder="S…"
                className={inputCls}
              />
            </Field>
          </FieldGroup>
          {editError && <p className="mt-3 text-sm text-rose-600">{editError}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={closeEdit} className={secondaryBtnCls}>
              Cancel
            </button>
            <button onClick={handleSaveEdit} className={primaryBtnCls}>
              Save changes
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-3xl font-bold ${highlight ? "text-sky-600" : "text-slate-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {hint && <span className="ml-1.5 font-normal text-slate-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

const primaryBtnCls =
  "inline-flex items-center rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-700";

const secondaryBtnCls =
  "inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";
