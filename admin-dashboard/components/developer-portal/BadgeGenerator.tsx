"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BadgeStyle = "light" | "dark" | "minimal";

interface BadgeGeneratorProps {
  serverUrl: string;
}

const STYLES: { value: BadgeStyle; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "minimal", label: "Minimal" },
];

export function BadgeGenerator({ serverUrl }: BadgeGeneratorProps) {
  const [style, setStyle] = useState<BadgeStyle>("light");
  const [showStats, setShowStats] = useState(true);
  const [copied, setCopied] = useState<"html" | "md" | null>(null);

  const base = serverUrl.replace(/\/$/, "");
  const badgeUrl = `${base}/badge?style=${style}&stats=${showStats}`;

  const htmlSnippet = `<a href="${base}" target="_blank" rel="noopener noreferrer">\n  <img src="${badgeUrl}" alt="Powered by Fluid" height="28">\n</a>`;
  const mdSnippet = `[![Powered by Fluid](${badgeUrl})](${base})`;

  async function copy(type: "html" | "md") {
    const text = type === "html" ? htmlSnippet : mdSnippet;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-6">
        {/* Style picker */}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Style
          </legend>
          <div className="flex gap-2">
            {STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStyle(s.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition",
                  style === s.value
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-border bg-background text-muted-foreground hover:border-slate-400 hover:text-foreground",
                )}
                aria-pressed={style === s.value}
              >
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Stats toggle */}
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={showStats}
            onChange={(e) => setShowStats(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-sky-500"
          />
          Show live tx count
        </label>
      </div>

      {/* Preview */}
      <div
        className={cn(
          "flex min-h-20 items-center justify-center rounded-xl border p-8",
          style === "dark" ? "bg-slate-900" : "bg-slate-50",
        )}
        aria-label="Badge preview"
        data-testid="badge-preview"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={badgeUrl}
          alt="Powered by Fluid"
          height={28}
          key={badgeUrl}
          className="max-w-full"
        />
      </div>

      {/* Embed codes */}
      <div className="space-y-4">
        <EmbedCode
          label="HTML"
          code={htmlSnippet}
          onCopy={() => copy("html")}
          copied={copied === "html"}
          data-testid="embed-html"
        />
        <EmbedCode
          label="Markdown"
          code={mdSnippet}
          onCopy={() => copy("md")}
          copied={copied === "md"}
          data-testid="embed-md"
        />
      </div>

      {/* Live link */}
      <p className="text-xs text-muted-foreground">
        The badge SVG is served by your Fluid server at{" "}
        <a
          href={badgeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-sky-600 underline-offset-2 hover:underline"
          data-testid="badge-direct-link"
        >
          {badgeUrl}
          <ExternalLink className="h-3 w-3" />
        </a>
        . Clicking the badge links users to the Fluid developer portal.
      </p>
    </div>
  );
}

interface EmbedCodeProps {
  label: string;
  code: string;
  onCopy: () => void;
  copied: boolean;
  "data-testid"?: string;
}

function EmbedCode({ label, code, onCopy, copied, "data-testid": testId }: EmbedCodeProps) {
  return (
    <div data-testid={testId}>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground">
          {code}
        </pre>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCopy}
          aria-label={`Copy ${label} embed code`}
          className="mt-0.5 h-7 w-7 shrink-0"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
