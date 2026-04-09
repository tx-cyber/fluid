"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Clock, Trash2, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Partner, PartnerStatus } from "@/components/dashboard/types";

const STATUS_CONFIG: Record<
  PartnerStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: <XCircle className="h-3 w-3" />,
  },
};

function StatusBadge({ status }: { status: PartnerStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

type ActionState = { loading: boolean; error: string | null };

export function PartnerCertificationManager({
  initialPartners,
}: {
  initialPartners: Partner[];
}) {
  const [partners, setPartners] = useState(initialPartners);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function setLoading(id: string, loading: boolean, error: string | null = null) {
    setActionState((s) => ({ ...s, [id]: { loading, error } }));
  }

  async function updateStatus(partner: Partner, status: PartnerStatus) {
    setLoading(partner.id, true);
    try {
      const res = await fetch(`/api/admin/partners/${encodeURIComponent(partner.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, reviewNote: reviewNotes[partner.id] ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setPartners((ps) => ps.map((p) => (p.id === partner.id ? (data as Partner) : p)));
      setLoading(partner.id, false);
    } catch (err) {
      setLoading(partner.id, false, err instanceof Error ? err.message : "Error");
    }
  }

  async function deletePartner(id: string) {
    if (!confirm("Delete this application permanently?")) return;
    setLoading(id, true);
    try {
      const res = await fetch(`/api/admin/partners/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete");
      }
      setPartners((ps) => ps.filter((p) => p.id !== id));
      setLoading(id, false);
    } catch (err) {
      setLoading(id, false, err instanceof Error ? err.message : "Error");
    }
  }

  async function copyBadgeSnippet(id: string) {
    const origin = window.location.origin;
    const snippet = `<a href="${origin}/partners?verify=${id}" target="_blank" rel="noopener noreferrer">\n  <img src="${origin}/api/partners/badge/${id}" alt="Fluid Certified Partner" />\n</a>`;
    await navigator.clipboard.writeText(snippet).catch(() => null);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const pending = partners.filter((p) => p.status === "pending");
  const reviewed = partners.filter((p) => p.status !== "pending");

  return (
    <div className="space-y-8">
      {/* Pending applications */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Pending Applications
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">No pending applications.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((p) => (
              <PartnerCard
                key={p.id}
                partner={p}
                reviewNote={reviewNotes[p.id] ?? ""}
                onNoteChange={(v) => setReviewNotes((n) => ({ ...n, [p.id]: v }))}
                onApprove={() => void updateStatus(p, "approved")}
                onReject={() => void updateStatus(p, "rejected")}
                onDelete={() => void deletePartner(p.id)}
                onCopyBadge={() => void copyBadgeSnippet(p.id)}
                state={actionState[p.id] ?? { loading: false, error: null }}
                copied={copiedId === p.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Reviewed */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Reviewed</h2>
        {reviewed.length === 0 ? (
          <p className="text-sm text-slate-500">No reviewed applications yet.</p>
        ) : (
          <div className="space-y-4">
            {reviewed.map((p) => (
              <PartnerCard
                key={p.id}
                partner={p}
                reviewNote={reviewNotes[p.id] ?? ""}
                onNoteChange={(v) => setReviewNotes((n) => ({ ...n, [p.id]: v }))}
                onApprove={() => void updateStatus(p, "approved")}
                onReject={() => void updateStatus(p, "rejected")}
                onDelete={() => void deletePartner(p.id)}
                onCopyBadge={() => void copyBadgeSnippet(p.id)}
                state={actionState[p.id] ?? { loading: false, error: null }}
                copied={copiedId === p.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PartnerCard({
  partner,
  reviewNote,
  onNoteChange,
  onApprove,
  onReject,
  onDelete,
  onCopyBadge,
  state,
  copied,
}: {
  partner: Partner;
  reviewNote: string;
  onNoteChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onCopyBadge: () => void;
  state: ActionState;
  copied: boolean;
}) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {partner.projectName}
              <StatusBadge status={partner.status} />
            </CardTitle>
            <CardDescription className="mt-1">
              <a
                href={partner.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                {partner.websiteUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </div>
          <div className="text-xs text-muted-foreground">
            Submitted {new Date(partner.submittedAt).toLocaleDateString()}
            {partner.reviewedAt && (
              <> · Reviewed {new Date(partner.reviewedAt).toLocaleDateString()}</>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Contact</p>
            <p className="text-sm">{partner.contactEmail}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Description</p>
            <p className="text-sm">{partner.description}</p>
          </div>
          {partner.reviewNote && (
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">Review note</p>
              <p className="text-sm">{partner.reviewNote}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Review note</label>
          <Input
            value={reviewNote}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Optional note for this decision…"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={onApprove}
            disabled={state.loading || partner.status === "approved"}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={state.loading || partner.status === "rejected"}
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            <XCircle className="mr-1 h-4 w-4" />
            Reject
          </Button>
          {partner.status === "approved" && (
            <Button size="sm" variant="outline" onClick={onCopyBadge}>
              <Copy className="mr-1 h-4 w-4" />
              {copied ? "Copied!" : "Copy badge snippet"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={state.loading}
            className="ml-auto text-slate-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {state.error && (
            <span className="text-xs text-red-600">{state.error}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
