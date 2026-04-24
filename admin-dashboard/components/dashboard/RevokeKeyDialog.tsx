"use client";

import { useState, useRef, useEffect } from "react";
import { TriangleAlert, X } from "lucide-react";

interface RevokeKeyDialogProps {
  keyId: string;
  keyDisplay: string;
  onConfirm: (keyId: string) => Promise<void>;
  onClose: () => void;
}

export function RevokeKeyDialog({
  keyId,
  keyDisplay,
  onConfirm,
  onClose,
}: RevokeKeyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button on open for accessibility
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(keyId);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to revoke key. Please try again.");
      setLoading(false);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-dialog-title"
      onClick={(e: {
        target: EventTarget | null;
        currentTarget: EventTarget | null;
      }) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
              <TriangleAlert
                className="h-5 w-5 text-rose-600"
                aria-hidden="true"
              />
            </div>
            <h2
              id="revoke-dialog-title"
              className="text-base font-semibold text-slate-900"
            >
              Revoke API Key
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600">
            This will immediately deactivate{" "}
            <span className="font-mono font-semibold text-slate-900">
              {keyDisplay}
            </span>
            . Any dApp or service using this key will lose access instantly.
          </p>
          <p className="mt-2 text-sm font-medium text-rose-600">
            This action cannot be undone.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex min-h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex min-h-9 items-center rounded-full bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {loading ? "Revoking…" : "Revoke Key"}
          </button>
        </div>
      </div>
    </div>
  );
}
