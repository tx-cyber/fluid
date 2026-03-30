"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type FormState = "idle" | "submitting" | "success" | "error";

export function PartnerApplicationForm() {
  const [form, setForm] = useState({
    projectName: "",
    contactEmail: "",
    websiteUrl: "",
    description: "",
  });
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Submission failed");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-4"
        >
          <CheckCircle className="h-16 w-16 text-emerald-500" />
          <h1 className="text-2xl font-bold">Application submitted</h1>
          <p className="max-w-md text-muted-foreground">
            Thanks for applying. Our team will review your application and get back to
            you via email.
          </p>
          <Button asChild className="mt-4">
            <Link href="/partners">View certified partners</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">
          Certification programme
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Apply for Fluid Certified Partner
        </h1>
        <p className="mt-4 text-muted-foreground">
          Tell us about your project. We review every application and aim to respond
          within 5 business days.
        </p>
      </motion.div>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle>Application form</CardTitle>
          <CardDescription>All fields are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="projectName" className="text-sm font-medium">
                Project name
              </label>
              <Input
                id="projectName"
                value={form.projectName}
                onChange={(e) => update("projectName", e.target.value)}
                placeholder="My dApp"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contactEmail" className="text-sm font-medium">
                Contact email
              </label>
              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                placeholder="dev@example.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="websiteUrl" className="text-sm font-medium">
                Website URL
              </label>
              <Input
                id="websiteUrl"
                type="url"
                value={form.websiteUrl}
                onChange={(e) => update("websiteUrl", e.target.value)}
                placeholder="https://myapp.example"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Briefly describe your project and how you use Fluid…"
                required
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {state === "error" && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={state === "submitting"}>
                {state === "submitting" ? "Submitting…" : "Submit application"}
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/partners">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
