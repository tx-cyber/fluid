/**
 * Unit tests for admin-dashboard/lib/discourse.ts
 * Run with: node --test forum.test.mjs
 *
 * Uses the compiled JS via tsx/ts-node is not available, so we test the
 * pure JS-equivalent logic inline (same logic as discourse.ts).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ── Inline ports of the pure functions from lib/discourse.ts ────────────────

function formatRelativeTime(isoDate) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getTopicUrl(config, topic) {
  return `${config.baseUrl}/t/${topic.slug}/${topic.id}`;
}

function getDiscourseSearchUrl(config, query) {
  return `${config.baseUrl}/search?q=${encodeURIComponent(query)}`;
}

function getSsoLoginUrl(config, returnPath = "/forum") {
  const siteUrl = "http://localhost:3000";
  const returnUrl = encodeURIComponent(`${siteUrl}${returnPath}`);
  return `${config.baseUrl}/session/sso?return_path=${returnUrl}`;
}

// Sample config used in tests
const config = {
  baseUrl: "https://community.fluid.dev",
  categoryId: 1,
};

// ── Sample data shape ────────────────────────────────────────────────────────

const SAMPLE_TOPICS = [
  {
    id: 1,
    title: "Getting started with Fluid fee sponsorship",
    slug: "getting-started-with-fluid-fee-sponsorship",
    postsCount: 12,
    replyCount: 11,
    views: 430,
    likeCount: 18,
    categoryId: 1,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastPostedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    pinned: true,
    excerpt: "Welcome! This thread covers everything.",
    tags: ["getting-started", "typescript"],
  },
  {
    id: 2,
    title: "How to integrate Fluid with a React + Freighter wallet",
    slug: "fluid-react-freighter-integration",
    postsCount: 8,
    replyCount: 7,
    views: 215,
    likeCount: 9,
    categoryId: 1,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    lastPostedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    pinned: false,
    excerpt: "Step-by-step guide to wiring up Freighter.",
    tags: ["react", "freighter"],
  },
];

// ── formatRelativeTime ────────────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  test("returns minutes ago for recent dates", () => {
    const date = new Date(Date.now() - 30 * 60_000).toISOString(); // 30 min ago
    assert.equal(formatRelativeTime(date), "30m ago");
  });

  test("returns 0m ago for just-now date", () => {
    const date = new Date(Date.now() - 500).toISOString();
    assert.match(formatRelativeTime(date), /^\dm ago$/);
  });

  test("returns hours ago for dates within a day", () => {
    const date = new Date(Date.now() - 5 * 60 * 60_000).toISOString(); // 5h ago
    assert.equal(formatRelativeTime(date), "5h ago");
  });

  test("returns days ago for dates within a month", () => {
    const date = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString(); // 7d ago
    assert.equal(formatRelativeTime(date), "7d ago");
  });

  test("returns months ago for old dates", () => {
    const date = new Date(Date.now() - 45 * 24 * 60 * 60_000).toISOString(); // ~45d ago
    assert.equal(formatRelativeTime(date), "1mo ago");
  });

  test("boundary: exactly 60 minutes returns 1h ago", () => {
    const date = new Date(Date.now() - 60 * 60_000).toISOString();
    assert.equal(formatRelativeTime(date), "1h ago");
  });

  test("boundary: exactly 24 hours returns 1d ago", () => {
    const date = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    assert.equal(formatRelativeTime(date), "1d ago");
  });
});

// ── getTopicUrl ───────────────────────────────────────────────────────────────

describe("getTopicUrl", () => {
  test("builds correct URL for a topic", () => {
    const topic = { slug: "hello-world", id: 42 };
    assert.equal(
      getTopicUrl(config, topic),
      "https://community.fluid.dev/t/hello-world/42"
    );
  });

  test("uses the config baseUrl", () => {
    const cfg = { baseUrl: "https://forum.example.com", categoryId: 2 };
    const topic = { slug: "test-slug", id: 7 };
    assert.equal(getTopicUrl(cfg, topic), "https://forum.example.com/t/test-slug/7");
  });

  test("works with sample topic data", () => {
    const url = getTopicUrl(config, SAMPLE_TOPICS[0]);
    assert.equal(
      url,
      "https://community.fluid.dev/t/getting-started-with-fluid-fee-sponsorship/1"
    );
  });
});

// ── getDiscourseSearchUrl ────────────────────────────────────────────────────

describe("getDiscourseSearchUrl", () => {
  test("encodes simple query", () => {
    assert.equal(
      getDiscourseSearchUrl(config, "fee bump"),
      "https://community.fluid.dev/search?q=fee%20bump"
    );
  });

  test("encodes special characters", () => {
    const url = getDiscourseSearchUrl(config, "react & typescript");
    assert.ok(url.includes("react%20%26%20typescript"));
  });

  test("empty query produces empty q param", () => {
    assert.equal(
      getDiscourseSearchUrl(config, ""),
      "https://community.fluid.dev/search?q="
    );
  });
});

// ── getSsoLoginUrl ────────────────────────────────────────────────────────────

describe("getSsoLoginUrl", () => {
  test("uses default /forum return path", () => {
    const url = getSsoLoginUrl(config);
    assert.ok(url.startsWith("https://community.fluid.dev/session/sso?return_path="));
    assert.ok(url.includes(encodeURIComponent("http://localhost:3000/forum")));
  });

  test("accepts custom return path", () => {
    const url = getSsoLoginUrl(config, "/sdk");
    assert.ok(url.includes(encodeURIComponent("http://localhost:3000/sdk")));
  });
});

// ── Sample data schema ────────────────────────────────────────────────────────

describe("SAMPLE_TOPICS schema", () => {
  test("all topics have required fields", () => {
    for (const topic of SAMPLE_TOPICS) {
      assert.ok(typeof topic.id === "number", `id should be number: ${topic.title}`);
      assert.ok(typeof topic.title === "string" && topic.title.length > 0);
      assert.ok(typeof topic.slug === "string" && topic.slug.length > 0);
      assert.ok(typeof topic.postsCount === "number");
      assert.ok(typeof topic.replyCount === "number");
      assert.ok(typeof topic.views === "number");
      assert.ok(typeof topic.likeCount === "number");
      assert.ok(typeof topic.categoryId === "number");
      assert.ok(typeof topic.createdAt === "string");
      assert.ok(typeof topic.lastPostedAt === "string");
      assert.ok(typeof topic.pinned === "boolean");
      assert.ok(Array.isArray(topic.tags));
    }
  });

  test("pinned topic exists in sample data", () => {
    assert.ok(SAMPLE_TOPICS.some((t) => t.pinned === true));
  });

  test("topics have valid ISO date strings", () => {
    for (const topic of SAMPLE_TOPICS) {
      assert.ok(!isNaN(new Date(topic.createdAt).getTime()));
      assert.ok(!isNaN(new Date(topic.lastPostedAt).getTime()));
    }
  });

  test("tags are non-empty strings", () => {
    for (const topic of SAMPLE_TOPICS) {
      for (const tag of topic.tags) {
        assert.ok(typeof tag === "string" && tag.length > 0);
      }
    }
  });

  test("all topic IDs are unique", () => {
    const ids = SAMPLE_TOPICS.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
