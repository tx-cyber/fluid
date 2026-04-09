"use client";

import { motion } from "framer-motion";
import { CheckCircle, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { Partner } from "@/components/dashboard/types";

interface PartnerDirectoryProps {
  partners: Partner[];
}

export function PartnerDirectory({ partners }: PartnerDirectoryProps) {
  const searchParams = useSearchParams();
  const verifyId = searchParams.get("verify");
  const highlighted = verifyId ? partners.find((p) => p.id === verifyId) : null;

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      {/* Hero */}
      <section
        className="relative isolate overflow-hidden border-b border-border/80"
        aria-labelledby="partners-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary"
            >
              Certified partners
            </motion.p>
            <motion.h1
              id="partners-heading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl"
            >
              Fluid Certified Partners
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 text-lg text-muted-foreground sm:text-xl"
            >
              Vetted dApps and integrations that meet Fluid&apos;s quality and security
              standards. Look for the badge to know you&apos;re building on a trusted
              integration.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Button size="lg" className="min-w-[200px] text-base shadow-lg" asChild>
                <Link href="/partners/apply">Apply for certification</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/">Back to portal</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Verification banner */}
      {highlighted && (
        <div className="border-b border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <span className="font-bold">{highlighted.projectName}</span> is a verified
              Fluid Certified Partner.
            </p>
          </div>
        </div>
      )}

      {/* Partner grid */}
      <section
        className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
        aria-labelledby="partner-grid-heading"
      >
        <motion.h2
          id="partner-grid-heading"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Certified partners ({partners.length})
        </motion.h2>

        {partners.length === 0 ? (
          <p className="mt-8 text-muted-foreground">
            No certified partners yet. Be the first to apply.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((partner, i) => (
              <motion.div
                key={partner.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className={`group relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md ${
                  highlighted?.id === partner.id
                    ? "border-emerald-400 ring-2 ring-emerald-300"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{partner.projectName}</h3>
                    <a
                      href={partner.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                    >
                      {partner.websiteUrl.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <ShieldCheck className="h-6 w-6 shrink-0 text-sky-500" aria-label="Certified" />
                </div>

                <p className="mt-3 flex-1 text-sm text-muted-foreground">
                  {partner.description}
                </p>

                {partner.reviewedAt && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Certified {new Date(partner.reviewedAt).toLocaleDateString()}
                  </p>
                )}

                {/* Embeddable badge preview */}
                <div className="mt-4 flex items-center gap-2">
                  <img
                    src={`/api/partners/badge/${partner.id}`}
                    alt={`Fluid Certified Partner: ${partner.projectName}`}
                    className="h-7"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
