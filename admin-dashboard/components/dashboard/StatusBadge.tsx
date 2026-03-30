"use client";

import type { TransactionStatus } from "@/components/dashboard/types";
import { Pulse } from "@/components/ui/motion";

type BadgeTone = "green" | "amber" | "slate" | "red";

function getTone(status: TransactionStatus | "active" | "inactive"): BadgeTone {
  switch (status) {
    case "success":
    case "active":
      return "green";
    case "pending":
    case "submitted":
      return "amber";
    case "failed":
      return "red";
    default:
      return "slate";
  }
}

function isPendingStatus(
  status: TransactionStatus | "active" | "inactive"
): boolean {
  return status === "pending" || status === "submitted";
}

export function StatusBadge({
  status,
}: {
  status: TransactionStatus | "active" | "inactive";
}) {
  const toneClassName = {
    green:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-800",
    amber:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:ring-amber-800",
    slate:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    red: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:ring-rose-800",
  }[getTone(status)];

  const isPending = isPendingStatus(status);

  return (
    <Pulse active={isPending}>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset transition-all duration-200 ${toneClassName}`}
      >
        {isPending && (
          <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        )}
        {status}
      </span>
    </Pulse>
  );
}