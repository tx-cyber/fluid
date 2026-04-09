import "server-only";

import type { Partner, PartnerPageData, PartnerStatus } from "@/components/dashboard/types";

// In-memory store — replace with a real DB (Prisma, etc.) in production.
// Keyed by partner ID for O(1) lookups.
const store = new Map<string, Partner>();

let _seeded = false;

const SAMPLE_PARTNERS: Partner[] = [
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

function seed() {
  if (_seeded) return;
  _seeded = true;
  for (const p of SAMPLE_PARTNERS) {
    store.set(p.id, p);
  }
}

export async function getPartnerPageData(): Promise<PartnerPageData> {
  seed();
  return { partners: Array.from(store.values()), source: "sample" };
}

export async function getApprovedPartners(): Promise<Partner[]> {
  seed();
  return Array.from(store.values()).filter((p) => p.status === "approved");
}

export async function getPartnerById(id: string): Promise<Partner | null> {
  seed();
  return store.get(id) ?? null;
}

export async function createPartner(
  data: Pick<Partner, "projectName" | "contactEmail" | "websiteUrl" | "description">,
): Promise<Partner> {
  seed();
  const id = `partner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const partner: Partner = {
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

export async function updatePartnerStatus(
  id: string,
  status: PartnerStatus,
  reviewNote: string | null,
): Promise<Partner | null> {
  seed();
  const existing = store.get(id);
  if (!existing) return null;
  const updated: Partner = {
    ...existing,
    status,
    reviewedAt: new Date().toISOString(),
    reviewNote,
  };
  store.set(id, updated);
  return updated;
}

export async function deletePartner(id: string): Promise<boolean> {
  seed();
  return store.delete(id);
}
