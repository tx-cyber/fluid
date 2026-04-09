/**
 * Unit tests for the partner certification data layer and badge SVG logic.
 * Run with: node --test partners.test.mjs
 *
 * Tests the pure logic inline (same approach as forum.test.mjs) since
 * TypeScript source is not directly runnable without a build step.
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Inline port of lib/partners-data.ts (pure logic, no "server-only") ──────

/** @type {Map<string, object>} */
let store = new Map();
let _idCounter = 1;

function resetStore(seedData) {
  store = new Map();
  _idCounter = 1;
  for (const p of seedData) {
    store.set(p.id, p);
  }
}

const SAMPLE_PARTNERS = [
  {
    id: "partner-001",
    projectName: "AnchorPay",
    contactEmail: "dev@anchorpay.example",
    websiteUrl: "https://anchorpay.example",
    description: "Gasless payment rails for Stellar anchors.",
    status: "approved",
    submittedAt: "2026-01-10T09:00:00Z",
    reviewedAt: "2026-01-12T14:30:00Z",
    reviewNote: "Excellent integration quality.",
  },
  {
    id: "partner-002",
    projectName: "StellarSwap",
    contactEmail: "hello@stellarswap.example",
    websiteUrl: "https://stellarswap.example",
    description: "DEX aggregator with Fluid fee sponsorship.",
    status: "pending",
    submittedAt: "2026-03-20T11:00:00Z",
    reviewedAt: null,
    reviewNote: null,
  },
  {
    id: "partner-003",
    projectName: "NovaNFT",
    contactEmail: "team@novanft.example",
    websiteUrl: "https://novanft.example",
    description: "NFT marketplace on Soroban using Fluid for gasless minting.",
    status: "rejected",
    submittedAt: "2026-02-05T08:00:00Z",
    reviewedAt: "2026-02-07T10:00:00Z",
    reviewNote: "Integration does not meet security requirements.",
  },
];

function getApprovedPartners() {
  return Array.from(store.values()).filter((p) => p.status === "approved");
}

function getPartnerById(id) {
  return store.get(id) ?? null;
}

function createPartner(data) {
  const id = `partner-new-${_idCounter++}`;
  const partner = {
    id,
    ...data,
    status: "pending",
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewNote: null,
  };
  store.set(id, partner);
  return partner;
}

function updatePartnerStatus(id, status, reviewNote) {
  const existing = store.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    status,
    reviewedAt: new Date().toISOString(),
    reviewNote,
  };
  store.set(id, updated);
  return updated;
}

function deletePartner(id) {
  return store.delete(id);
}

// ── Badge SVG generation logic (inline port) ─────────────────────────────────

function escapeXml(str) {
  return str.replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c),
  );
}

function generateBadgeSvg(partner, siteUrl) {
  const verifyUrl = `${siteUrl}/partners?verify=${encodeURIComponent(partner.id)}`;
  const name = escapeXml(partner.projectName);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="28">
  <title>Fluid Certified Partner: ${name}</title>
  <text>${name}</text>
  <a href="${verifyUrl}"><rect width="220" height="28" fill="transparent"/></a>
</svg>`;
}

// ── Validation logic (inline port of API route validation) ───────────────────

const VALID_STATUSES = ["pending", "approved", "rejected"];

function validateApplicationBody(body) {
  const { projectName, contactEmail, websiteUrl, description } = body ?? {};
  if (
    typeof projectName !== "string" || !projectName.trim() ||
    typeof contactEmail !== "string" || !contactEmail.trim() ||
    typeof websiteUrl !== "string" || !websiteUrl.trim() ||
    typeof description !== "string" || !description.trim()
  ) {
    return { valid: false, error: "All fields required" };
  }
  return { valid: true };
}

function validateStatusUpdate(body) {
  const { status } = body ?? {};
  if (!VALID_STATUSES.includes(status)) {
    return { valid: false, error: "Invalid status" };
  }
  return { valid: true };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Partner data — sample data shape", () => {
  beforeEach(() => resetStore(SAMPLE_PARTNERS));

  test("sample data has 3 partners", () => {
    assert.equal(store.size, 3);
  });

  test("all partners have required fields", () => {
    for (const p of store.values()) {
      assert.ok(typeof p.id === "string" && p.id.length > 0, "id");
      assert.ok(typeof p.projectName === "string" && p.projectName.length > 0, "projectName");
      assert.ok(typeof p.contactEmail === "string" && p.contactEmail.length > 0, "contactEmail");
      assert.ok(typeof p.websiteUrl === "string" && p.websiteUrl.length > 0, "websiteUrl");
      assert.ok(typeof p.description === "string" && p.description.length > 0, "description");
      assert.ok(VALID_STATUSES.includes(p.status), `status: ${p.status}`);
      assert.ok(typeof p.submittedAt === "string", "submittedAt");
    }
  });

  test("all partner IDs are unique", () => {
    const ids = Array.from(store.keys());
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("getApprovedPartners", () => {
  beforeEach(() => resetStore(SAMPLE_PARTNERS));

  test("returns only approved partners", () => {
    const approved = getApprovedPartners();
    assert.ok(approved.every((p) => p.status === "approved"));
  });

  test("returns AnchorPay from sample data", () => {
    const approved = getApprovedPartners();
    assert.ok(approved.some((p) => p.projectName === "AnchorPay"));
  });

  test("does not include pending or rejected partners", () => {
    const approved = getApprovedPartners();
    assert.ok(!approved.some((p) => p.status === "pending"));
    assert.ok(!approved.some((p) => p.status === "rejected"));
  });
});

describe("getPartnerById", () => {
  beforeEach(() => resetStore(SAMPLE_PARTNERS));

  test("returns correct partner for known id", () => {
    const p = getPartnerById("partner-001");
    assert.ok(p !== null);
    assert.equal(p.projectName, "AnchorPay");
  });

  test("returns null for unknown id", () => {
    assert.equal(getPartnerById("does-not-exist"), null);
  });
});

describe("createPartner", () => {
  beforeEach(() => resetStore(SAMPLE_PARTNERS));

  test("creates a new partner with pending status", () => {
    const p = createPartner({
      projectName: "TestDApp",
      contactEmail: "test@example.com",
      websiteUrl: "https://testdapp.example",
      description: "A test dApp",
    });
    assert.equal(p.status, "pending");
    assert.equal(p.projectName, "TestDApp");
    assert.ok(typeof p.id === "string" && p.id.length > 0);
    assert.equal(p.reviewedAt, null);
    assert.equal(p.reviewNote, null);
  });

  test("new partner is stored and retrievable", () => {
    const p = createPartner({
      projectName: "StoredDApp",
      contactEmail: "stored@example.com",
      websiteUrl: "https://stored.example",
      description: "Stored test",
    });
    const retrieved = getPartnerById(p.id);
    assert.ok(retrieved !== null);
    assert.equal(retrieved.projectName, "StoredDApp");
  });

  test("each created partner gets a unique id", () => {
    const a = createPartner({ projectName: "A", contactEmail: "a@x.com", websiteUrl: "https://a.com", description: "A" });
    const b = createPartner({ projectName: "B", contactEmail: "b@x.com", websiteUrl: "https://b.com", description: "B" });
    assert.notEqual(a.id, b.id);
  });
});

describe("updatePartnerStatus", () => {
  beforeEach(() => resetStore(SAMPLE_PARTNERS));

  test("approves a pending partner", () => {
    const updated = updatePartnerStatus("partner-002", "approved", "Looks great");
    assert.ok(updated !== null);
    assert.equal(updated.status, "approved");
    assert.equal(updated.reviewNote, "Looks great");
    assert.ok(updated.reviewedAt !== null);
  });

  test("rejects a pending partner", () => {
    const updated = updatePartnerStatus("partner-002", "rejected", "Not ready");
    assert.equal(updated.status, "rejected");
    assert.equal(updated.reviewNote, "Not ready");
  });

  test("returns null for unknown partner id", () => {
    const result = updatePartnerStatus("nonexistent", "approved", null);
    assert.equal(result, null);
  });

  test("persists the update in the store", () => {
    updatePartnerStatus("partner-002", "approved", null);
    const p = getPartnerById("partner-002");
    assert.equal(p.status, "approved");
  });

  test("sets reviewedAt to a valid ISO date", () => {
    const updated = updatePartnerStatus("partner-002", "approved", null);
    assert.ok(!isNaN(new Date(updated.reviewedAt).getTime()));
  });
});

describe("deletePartner", () => {
  beforeEach(() => resetStore(SAMPLE_PARTNERS));

  test("deletes an existing partner and returns true", () => {
    const result = deletePartner("partner-001");
    assert.equal(result, true);
    assert.equal(getPartnerById("partner-001"), null);
  });

  test("returns false for unknown partner", () => {
    const result = deletePartner("nonexistent");
    assert.equal(result, false);
  });

  test("store size decreases after delete", () => {
    const before = store.size;
    deletePartner("partner-001");
    assert.equal(store.size, before - 1);
  });
});

describe("Badge SVG generation", () => {
  test("SVG contains partner name", () => {
    const partner = { id: "partner-001", projectName: "AnchorPay", status: "approved" };
    const svg = generateBadgeSvg(partner, "https://fluid.example");
    assert.ok(svg.includes("AnchorPay"));
  });

  test("SVG contains verification link", () => {
    const partner = { id: "partner-001", projectName: "AnchorPay", status: "approved" };
    const svg = generateBadgeSvg(partner, "https://fluid.example");
    assert.ok(svg.includes("https://fluid.example/partners?verify=partner-001"));
  });

  test("SVG escapes special characters in project name", () => {
    const partner = { id: "p-x", projectName: 'Acme & <Co>', status: "approved" };
    const svg = generateBadgeSvg(partner, "https://fluid.example");
    assert.ok(!svg.includes("<Co>"), "raw < should be escaped");
    assert.ok(svg.includes("&lt;Co&gt;") || svg.includes("&amp;"), "should contain escaped chars");
  });

  test("SVG is valid XML structure (has opening and closing svg tags)", () => {
    const partner = { id: "p-1", projectName: "Test", status: "approved" };
    const svg = generateBadgeSvg(partner, "https://fluid.example");
    assert.ok(svg.trimStart().startsWith("<svg"), "starts with <svg");
    assert.ok(svg.trimEnd().endsWith("</svg>"), "ends with </svg>");
  });
});

describe("Application form validation", () => {
  test("valid body passes validation", () => {
    const result = validateApplicationBody({
      projectName: "MyDApp",
      contactEmail: "dev@example.com",
      websiteUrl: "https://mydapp.example",
      description: "A great dApp",
    });
    assert.equal(result.valid, true);
  });

  test("missing projectName fails validation", () => {
    const result = validateApplicationBody({
      contactEmail: "dev@example.com",
      websiteUrl: "https://mydapp.example",
      description: "A great dApp",
    });
    assert.equal(result.valid, false);
  });

  test("empty string fields fail validation", () => {
    const result = validateApplicationBody({
      projectName: "  ",
      contactEmail: "dev@example.com",
      websiteUrl: "https://mydapp.example",
      description: "A great dApp",
    });
    assert.equal(result.valid, false);
  });

  test("null body fails validation", () => {
    const result = validateApplicationBody(null);
    assert.equal(result.valid, false);
  });
});

describe("Status update validation", () => {
  test("approved is valid", () => {
    assert.equal(validateStatusUpdate({ status: "approved" }).valid, true);
  });

  test("rejected is valid", () => {
    assert.equal(validateStatusUpdate({ status: "rejected" }).valid, true);
  });

  test("pending is valid", () => {
    assert.equal(validateStatusUpdate({ status: "pending" }).valid, true);
  });

  test("unknown status is invalid", () => {
    assert.equal(validateStatusUpdate({ status: "certified" }).valid, false);
  });

  test("missing status is invalid", () => {
    assert.equal(validateStatusUpdate({}).valid, false);
  });
});
