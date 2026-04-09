"use client";

import { motion } from "framer-motion";
import { ExternalLink, MessageSquare, Pin, Search, ThumbsUp, Eye, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  type DiscourseConfig,
  type DiscourseTopic,
  type DiscourseSearchResult,
  formatRelativeTime,
  getTopicUrl,
  getDiscourseSearchUrl,
  getSsoLoginUrl,
} from "@/lib/discourse";
import { cn } from "@/lib/utils";

interface ForumWidgetProps {
  topics: DiscourseTopic[];
  config: DiscourseConfig;
}

export function ForumWidget({ topics, config }: ForumWidgetProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscourseSearchResult[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const ssoEnabled = Boolean(process.env.NEXT_PUBLIC_DISCOURSE_URL);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    startTransition(async () => {
      const res = await fetch(`/api/discourse/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    });
  }

  function clearSearch() {
    setQuery("");
    setResults(null);
  }

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        className="relative isolate overflow-hidden border-b border-border/80"
        aria-labelledby="forum-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary"
            >
              Community forum
            </motion.p>
            <motion.h1
              id="forum-heading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl font-extrabold tracking-tight sm:text-5xl"
            >
              Get help. Share knowledge.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 text-lg text-muted-foreground"
            >
              Recent discussions from the Fluid community. Click any topic to read
              the full thread on Discourse.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button size="lg" className="shadow-lg" asChild>
                <a href={config.baseUrl} target="_blank" rel="noopener noreferrer">
                  Open forum
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                </a>
              </Button>
              {ssoEnabled && (
                <Button size="lg" variant="outline" asChild>
                  <a href={getSsoLoginUrl(config)} target="_blank" rel="noopener noreferrer">
                    Log in with Discourse
                  </a>
                </Button>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Search ────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <motion.form
          onSubmit={handleSearch}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex gap-2"
          role="search"
          aria-label="Search forum topics"
        >
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search forum topics…"
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-4 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Search query"
            />
          </div>
          <Button type="submit" disabled={isPending || !query.trim()}>
            {isPending ? "Searching…" : "Search"}
          </Button>
          {results !== null && (
            <Button type="button" variant="outline" onClick={clearSearch} aria-label="Clear search">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </motion.form>

        {/* Search results */}
        {results !== null && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {results.length === 0
                  ? "No results found"
                  : `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`}
              </p>
              <a
                href={getDiscourseSearchUrl(config, query)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:underline"
              >
                Search on Discourse
                <ExternalLink className="ml-1 inline h-3 w-3 opacity-60" aria-hidden />
              </a>
            </div>
            <div className="space-y-3">
              {results.map((r) => (
                <SearchResultRow key={r.id} result={r} config={config} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Recent topics ─────────────────────────────────────────────── */}
      {results === null && (
        <section
          className="border-t border-border bg-muted/30"
          aria-labelledby="recent-topics-heading"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45 }}
              className="mb-6 flex items-center justify-between"
            >
              <h2
                id="recent-topics-heading"
                className="text-xl font-bold tracking-tight sm:text-2xl"
              >
                Recent topics
              </h2>
              <a
                href={config.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all on Discourse
                <ExternalLink className="ml-1 inline h-3 w-3 opacity-60" aria-hidden />
              </a>
            </motion.div>

            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {topics.map((topic, index) => (
                <TopicRow key={topic.id} topic={topic} config={config} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-border bg-card/50" role="contentinfo">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold text-foreground">Fluid</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Fee sponsorship infrastructure for Stellar developers.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer">
            <Link href="/" className="text-sm font-medium text-primary hover:underline">
              Developer portal
            </Link>
            <Link href="/sdk" className="text-sm font-medium text-primary hover:underline">
              SDK Registry
            </Link>
            <Link href="/plugins" className="text-sm font-medium text-primary hover:underline">
              Plugin marketplace
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// ── TopicRow ────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  config,
  index,
}: {
  topic: DiscourseTopic;
  config: DiscourseConfig;
  index: number;
}) {
  const url = getTopicUrl(config, topic);

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-start sm:gap-4"
      aria-label={`Open topic: ${topic.title}`}
    >
      {/* Pin indicator */}
      <div className="flex shrink-0 items-center gap-2 sm:mt-0.5 sm:w-5 sm:justify-center">
        {topic.pinned && (
          <Pin className="h-3.5 w-3.5 text-primary" aria-label="Pinned topic" />
        )}
      </div>

      {/* Title + excerpt + tags */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{topic.title}</p>
        {topic.excerpt && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{topic.excerpt}</p>
        )}
        {topic.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {topic.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground sm:flex-col sm:items-end sm:gap-1">
        <span className={cn("flex items-center gap-1", topic.replyCount > 0 && "text-foreground")}>
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          {topic.replyCount}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {topic.views}
        </span>
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
          {topic.likeCount}
        </span>
        <span className="hidden sm:block">{formatRelativeTime(topic.lastPostedAt)}</span>
      </div>
    </motion.a>
  );
}

// ── SearchResultRow ─────────────────────────────────────────────────────────

function SearchResultRow({
  result,
  config,
}: {
  result: DiscourseSearchResult;
  config: DiscourseConfig;
}) {
  const url = getTopicUrl(config, result);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-muted/40"
      aria-label={`Open topic: ${result.title}`}
    >
      <p className="font-medium text-foreground">{result.title}</p>
      {result.blurb && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{result.blurb}</p>
      )}
      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" aria-hidden />
          {result.postsCount} posts
        </span>
        <span>{formatRelativeTime(result.createdAt)}</span>
        {result.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-primary/8 px-2 py-0.5 font-medium text-primary">
            {tag}
          </span>
        ))}
      </div>
    </a>
  );
}
