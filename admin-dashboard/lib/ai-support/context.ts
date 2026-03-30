import "server-only";

import { getRelevantSupportDocs } from "./docs";
import type {
  OperatorSupportContext,
  SupportNodeConfig,
  SupportTransactionContext,
} from "./shared";

interface HealthResponse {
  status?: string;
  network?: string;
  checks?: {
    horizon?: {
      url?: string;
    };
    feePayers?: Array<{
      publicKey?: string;
      status?: string;
      balance?: string | number;
    }>;
  };
}

interface TransactionsResponse {
  transactions?: Array<{
    id: string;
    hash: string;
    innerTxHash?: string | null;
    tenantId: string;
    status: string;
    category?: string | null;
    createdAt: string;
    costStroops?: number | null;
  }>;
}

interface AiSupportSettingsLike {
  provider: string;
  model: string;
}

function getFluidServerUrl() {
  const value = process.env.FLUID_SERVER_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

function getAdminToken() {
  const value = process.env.FLUID_ADMIN_TOKEN?.trim();
  return value && value.length > 0 ? value : null;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getRecentTransactions() {
  const baseUrl = getFluidServerUrl();
  const adminToken = getAdminToken();
  if (!baseUrl || !adminToken) {
    return [];
  }

  const payload = await fetchJson<TransactionsResponse>(
    `${baseUrl}/admin/transactions?limit=100`,
    {
      headers: {
        "x-admin-token": adminToken,
      },
    },
  ).catch(() => ({ transactions: [] }));

  return (payload.transactions ?? []).map<SupportTransactionContext>(
    (transaction) => ({
      id: transaction.id,
      tenantId: transaction.tenantId,
      status: transaction.status,
      category: transaction.category ?? "Other",
      createdAt: transaction.createdAt,
      hash: transaction.innerTxHash ?? transaction.hash,
      costStroops:
        typeof transaction.costStroops === "number"
          ? transaction.costStroops
          : null,
    }),
  );
}

async function getLiveHealth() {
  const baseUrl = getFluidServerUrl();
  if (!baseUrl) {
    return null;
  }

  return fetchJson<HealthResponse>(`${baseUrl}/health`).catch(() => null);
}

function buildNodeConfig(
  settings: AiSupportSettingsLike,
  health: HealthResponse | null,
): SupportNodeConfig {
  return {
    dashboardUrl: process.env.NEXTAUTH_URL?.trim() ?? null,
    fluidServerUrl: getFluidServerUrl(),
    docsUrl: process.env.NEXT_PUBLIC_DOCS_URL?.trim() ?? null,
    sandboxHorizonUrl:
      process.env.NEXT_PUBLIC_SANDBOX_HORIZON_URL?.trim() ?? null,
    aiProvider: settings.provider,
    aiModel: settings.model,
    adminTokenConfigured: Boolean(getAdminToken()),
    healthStatus: health?.status ?? null,
    network: health?.network ?? null,
    horizonUrl: health?.checks?.horizon?.url ?? null,
    feePayerStates:
      health?.checks?.feePayers?.map((feePayer) => {
        const suffix = feePayer.publicKey
          ? feePayer.publicKey.slice(-6)
          : "unknown";
        const balance =
          feePayer.balance !== undefined ? ` (${feePayer.balance} XLM)` : "";
        return `${suffix}: ${feePayer.status ?? "unknown"}${balance}`;
      }) ?? [],
  };
}

export async function buildOperatorSupportContext(input: {
  adminEmail: string;
  query: string;
  settings: AiSupportSettingsLike;
}): Promise<OperatorSupportContext> {
  const [docs, recentTransactions, health] = await Promise.all([
    getRelevantSupportDocs(input.query),
    getRecentTransactions(),
    getLiveHealth(),
  ]);

  return {
    adminEmail: input.adminEmail,
    docs,
    nodeConfig: buildNodeConfig(input.settings, health),
    recentTransactions,
  };
}
