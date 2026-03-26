"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/dashboard/CopyButton";
import type { ManagedSigner } from "@/lib/signer-management";

function formatHash(value: string) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function statusTone(status: ManagedSigner["status"]) {
  switch (status) {
    case "Active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "Low Balance":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "Sequence Error":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function sourceTone(source: ManagedSigner["source"]) {
  switch (source) {
    case "db":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "vault":
      return "bg-violet-50 text-violet-700 ring-violet-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function SignerPoolManager({
  signers,
  addEnabled,
}: {
  signers: ManagedSigner[];
  addEnabled: boolean;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const router = useRouter();

  const activeCount = signers.filter((signer) => signer.status === "Active").length;
  const lowBalanceCount = signers.filter((signer) => signer.status === "Low Balance").length;
  const sequenceErrorCount = signers.filter((signer) => signer.status === "Sequence Error").length;

  function closeModal() {
    setIsModalOpen(false);
    setSecret("");
    setError("");
  }

  async function handleAddSigner() {
    setError("");

    const response = await fetch("/api/admin/signers", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ secret }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "Failed to add signer");
      return;
    }

    closeModal();
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleRemoveSigner(publicKey: string) {
    setRemovingKey(publicKey);
    setError("");

    try {
      const response = await fetch(`/api/admin/signers/${encodeURIComponent(publicKey)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Failed to remove signer");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setRemovingKey(null);
    }
  }

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[2rem] border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
            Active
          </p>
          <p className="mt-3 text-4xl font-semibold text-emerald-950">{activeCount}</p>
          <p className="mt-2 text-sm text-emerald-800">
            Signers ready to sponsor transactions right now.
          </p>
        </article>
        <article className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
            Low Balance
          </p>
          <p className="mt-3 text-4xl font-semibold text-amber-950">{lowBalanceCount}</p>
          <p className="mt-2 text-sm text-amber-900">
            Accounts that need top-up before they drift out of rotation.
          </p>
        </article>
        <article className="rounded-[2rem] border border-rose-200 bg-rose-50/80 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-700">
            Sequence Errors
          </p>
          <p className="mt-3 text-4xl font-semibold text-rose-950">{sequenceErrorCount}</p>
          <p className="mt-2 text-sm text-rose-900">
            Investigate these signers before routing more traffic through them.
          </p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Signer Pool Status</h2>
            <p className="mt-1 text-sm text-slate-600">
              Every public key in rotation is listed here. Secrets are never shown after intake.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!addEnabled ? (
              <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Configure `FLUID_SERVER_URL`, `FLUID_ADMIN_TOKEN`, and `FLUID_SIGNER_ENCRYPTION_KEY`
                to enable live changes.
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={!addEnabled}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Add New Signer
            </button>
          </div>
        </div>

        {error ? (
          <div className="mx-5 mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-5 py-3">Signer</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Balance</th>
                <th className="px-5 py-3">Source</th>
                <th className="hidden px-5 py-3 lg:table-cell">In Flight</th>
                <th className="hidden px-5 py-3 xl:table-cell">Sequence</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {signers.map((signer) => (
                <tr key={signer.publicKey} className="align-top">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-950">{formatHash(signer.publicKey)}</div>
                    <div className="mt-2 max-w-sm text-xs text-slate-500">{signer.publicKey}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(signer.status)}`}
                    >
                      {signer.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-950">{signer.balance}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ring-1 ring-inset ${sourceTone(signer.source)}`}
                    >
                      {signer.source}
                    </span>
                  </td>
                  <td className="hidden px-5 py-4 text-sm text-slate-600 lg:table-cell">
                    {signer.inFlight}
                  </td>
                  <td className="hidden px-5 py-4 text-sm text-slate-600 xl:table-cell">
                    {signer.sequenceNumber}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <CopyButton value={signer.publicKey} label="Copy key" />
                      {signer.canRemove ? (
                        <button
                          type="button"
                          onClick={() => void handleRemoveSigner(signer.publicKey)}
                          disabled={isPending || removingKey === signer.publicKey}
                          className="inline-flex min-h-9 items-center rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {removingKey === signer.publicKey ? "Removing..." : "Remove"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
                  Secure Intake
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">Add New Signer</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Paste the Stellar secret once. It will be encrypted before storage and never
                  rendered back into the UI.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-medium text-slate-800">Signer secret</span>
              <input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="SB..."
                autoFocus
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:bg-white"
              />
            </label>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddSigner()}
                disabled={!secret.trim() || isPending}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isPending ? "Saving..." : "Save signer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
