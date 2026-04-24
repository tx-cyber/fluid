export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  metadata: string | null;
  aiSummary: string | null;
  createdAt: string;
}

export interface AuditLogPageData {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
  source: "live" | "sample";
}

const SAMPLE_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "al_001",
    actor: "admin@fluid.dev",
    action: "tenant.create",
    target: "tenant_001",
    metadata: JSON.stringify({ name: "Acme Corp", tier: "pro" }),
    aiSummary: "Admin created new tenant Acme Corp on the pro tier",
    createdAt: "2024-03-28T10:30:00Z",
  },
  {
    id: "al_002",
    actor: "system",
    action: "apikey.revoke",
    target: "key_abc123",
    metadata: JSON.stringify({ reason: "expired" }),
    aiSummary: "System auto-revoked expired API key",
    createdAt: "2024-03-28T09:15:00Z",
  },
  {
    id: "al_003",
    actor: "admin@fluid.dev",
    action: "signer.add",
    target: "GABCD...WXYZ",
    metadata: null,
    aiSummary: null,
    createdAt: "2024-03-27T14:00:00Z",
  },
];

function getBaseUrl() {
  const value = process.env.FLUID_SERVER_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

function getAdminToken() {
  const value = process.env.FLUID_ADMIN_TOKEN?.trim();
  return value && value.length > 0 ? value : null;
}

export async function getAuditLogsData(
  limit = 50,
  offset = 0,
  action?: string,
  actor?: string,
): Promise<AuditLogPageData> {
  const baseUrl = getBaseUrl();
  const token = getAdminToken();

  if (baseUrl && token) {
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (action) params.set("action", action);
      if (actor) params.set("actor", actor);

      const res = await fetch(`${baseUrl}/admin/audit-logs?${params}`, {
        headers: { "x-admin-token": token },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        return { ...data, source: "live" };
      }
    } catch {
      // fall through to sample
    }
  }

  return {
    items: SAMPLE_AUDIT_LOGS.slice(offset, offset + limit),
    total: SAMPLE_AUDIT_LOGS.length,
    limit,
    offset,
    source: "sample",
  };
}
