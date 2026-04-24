"use client";

/**
 * SimulationErrorDisplay.tsx
 *
 * Displays a structured, developer-friendly error panel for failed
 * Soroban / Horizon pre-flight simulations.
 *
 * Issue #128 – Pre-flight Simulation Error Mapping for UI
 */

import { useState } from "react";
import {
    MappedSimulationError,
    ErrorCategory,
    ErrorSeverity,
} from "@/lib/simulation-error-mapper";

// ─── Icon helpers ────────────────────────────────────────────────────────────

function CategoryIcon({ category }: { category: ErrorCategory }) {
    const cls = "h-5 w-5 shrink-0";
    switch (category) {
        case "insufficient_funds":
            return (
                <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            );
        case "auth":
            return (
                <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            );
        case "contract_revert":
            return (
                <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polygon points="12 2 22 20 2 20" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            );
        case "resource":
            return (
                <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
            );
        case "network":
            return (
                <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
            );
        case "rate_limit":
            return (
                <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
            );
        default:
            return (
                <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            );
    }
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

// ─── Palette helpers ─────────────────────────────────────────────────────────

function severityStyles(severity: ErrorSeverity): {
    border: string;
    bg: string;
    icon: string;
    badge: string;
    badgeText: string;
} {
    switch (severity) {
        case "critical":
            return {
                border: "border-red-500/40",
                bg: "bg-red-500/[0.06]",
                icon: "text-red-400",
                badge: "bg-red-500/15",
                badgeText: "text-red-400",
            };
        case "warning":
            return {
                border: "border-amber-500/40",
                bg: "bg-amber-500/[0.06]",
                icon: "text-amber-400",
                badge: "bg-amber-500/15",
                badgeText: "text-amber-400",
            };
        case "info":
            return {
                border: "border-sky-500/40",
                bg: "bg-sky-500/[0.06]",
                icon: "text-sky-400",
                badge: "bg-sky-500/15",
                badgeText: "text-sky-400",
            };
    }
}

function severityLabel(severity: ErrorSeverity): string {
    switch (severity) {
        case "critical":
            return "Critical";
        case "warning":
            return "Warning";
        case "info":
            return "Info";
    }
}

function categoryLabel(category: ErrorCategory): string {
    const map: Record<ErrorCategory, string> = {
        insufficient_funds: "Insufficient Funds",
        auth: "Authorization",
        contract_revert: "Contract Revert",
        resource: "Resource Limit",
        network: "Network",
        rate_limit: "Rate Limit",
        validation: "Validation",
        unknown: "Unknown",
    };
    return map[category] ?? category;
}

// ─── Main component ──────────────────────────────────────────────────────────

export interface SimulationErrorDisplayProps {
    /** The structured error produced by parseSimulationError(). */
    error: MappedSimulationError;
    /** Optional CSS class to append to the root element. */
    className?: string;
}

/**
 * Renders a human-readable error panel for a failed Soroban simulation.
 *
 * - Displays a prominent title + friendly message.
 * - Shows an actionable hint when available.
 * - Includes a collapsible "Technical Details" section with the raw trace.
 */
export default function SimulationErrorDisplay({
    error,
    className = "",
}: SimulationErrorDisplayProps) {
    const [traceOpen, setTraceOpen] = useState(false);
    const styles = severityStyles(error.severity);

    return (
        <div
            role="alert"
            aria-live="assertive"
            className={[
                "relative overflow-hidden rounded-2xl border",
                styles.border,
                styles.bg,
                "p-5 shadow-sm",
                className,
            ].join(" ")}
        >
            {/* Coloured left accent bar */}
            <div
                className={[
                    "absolute left-0 top-0 h-full w-1 rounded-l-2xl",
                    error.severity === "critical"
                        ? "bg-red-500"
                        : error.severity === "warning"
                            ? "bg-amber-500"
                            : "bg-sky-500",
                ].join(" ")}
            />

            <div className="pl-3">
                {/* Header row */}
                <div className="flex flex-wrap items-start gap-3">
                    <span className={styles.icon}>
                        <CategoryIcon category={error.category} />
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-foreground">
                                {error.title}
                            </h3>

                            {/* Severity badge */}
                            <span
                                className={[
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                    styles.badge,
                                    styles.badgeText,
                                ].join(" ")}
                            >
                                {severityLabel(error.severity)}
                            </span>

                            {/* Category badge */}
                            <span className="inline-flex items-center rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-foreground/60 uppercase tracking-wider">
                                {categoryLabel(error.category)}
                            </span>
                        </div>

                        {/* Friendly message */}
                        <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
                            {error.message}
                        </p>

                        {/* Actionable hint */}
                        {error.hint && (
                            <div className="mt-3 flex items-start gap-2 rounded-xl bg-foreground/5 px-3 py-2.5">
                                <svg
                                    className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                <p className="text-xs leading-relaxed text-foreground/60">
                                    <span className="font-semibold text-foreground/80">Tip: </span>
                                    {error.hint}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Collapsible technical details */}
                <div className="mt-4">
                    <button
                        id="sim-error-trace-toggle"
                        onClick={() => setTraceOpen((v) => !v)}
                        className="flex w-full items-center justify-between rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2 text-left text-xs font-semibold text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground/80"
                        aria-expanded={traceOpen}
                    >
                        <span>Technical Details</span>
                        <div className="flex items-center gap-2">
                            {/* Raw error code pill */}
                            <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground/50">
                                {error.code}
                            </code>
                            <ChevronIcon open={traceOpen} />
                        </div>
                    </button>

                    {traceOpen && (
                        <div className="mt-2 overflow-auto rounded-xl border border-foreground/10 bg-background/60 p-3">
                            <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/60">
                                {JSON.stringify(error.originalTrace, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
