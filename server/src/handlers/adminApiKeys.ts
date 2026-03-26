import { Request, Response } from "express";
import {
  ApiKeyConfig,
  upsertApiKey,
  deleteApiKey,
  listApiKeys,
} from "../middleware/apiKeys";
import { invalidateApiKeyCache } from "../utils/redis";
import prisma from "../utils/db";

// Typed accessor for the prisma apiKey model since db.ts uses a loose type
const apiKeyModel = (prisma as any).apiKey as {
  findMany: (args: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any | null>;
  update: (args: any) => Promise<any>;
};

function requireAdminToken(req: Request, res: Response): boolean {
  const token = req.header("x-admin-token");
  const expected = process.env.FLUID_ADMIN_TOKEN;
  if (!expected || token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// Note: These admin endpoints are intentionally minimal — secure them in production.

export async function listApiKeysHandler(req: Request, res: Response) {
  if (!requireAdminToken(req, res)) return;

  try {
    const dbKeys = await apiKeyModel.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        key: true,
        prefix: true,
        tenantId: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const keys = dbKeys.map((k: any) => ({
      id: k.id,
      key: `${k.key.slice(0, 4)}...${k.key.slice(-4)}`,
      prefix: k.prefix,
      tenantId: k.tenantId,
      active: k.active,
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
    }));

    res.json({ keys });
  } catch (err) {
    // Fallback to in-memory list if DB unavailable
    const keys = listApiKeys().map((k) => ({
      id: k.key,
      key: `${k.key.slice(0, 4)}...${k.key.slice(-4)}`,
      prefix: k.key.slice(0, 4),
      tenantId: k.tenantId,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    res.json({ keys });
  }
}

export async function upsertApiKeyHandler(req: Request, res: Response) {
  if (!requireAdminToken(req, res)) return;

  const payload = req.body as ApiKeyConfig | undefined;
  if (!payload || typeof payload.key !== "string") {
    res.status(400).json({ error: "Invalid payload; expected ApiKeyConfig" });
    return;
  }

  try {
    upsertApiKey(payload);
    res
      .status(200)
      .json({ message: "API key upserted and cached", key: payload.key });
  } catch (err) {
    res.status(500).json({ error: "Failed to upsert API key" });
  }
}

export async function revokeApiKeyHandler(req: Request, res: Response) {
  if (!requireAdminToken(req, res)) return;

  const { key } = req.params;
  if (!key) {
    res.status(400).json({ error: "Key param required" });
    return;
  }

  try {
    // Update active = false in DB
    await apiKeyModel.update({
      where: { id: key },
      data: { active: false },
    });

    // Invalidate cache so the middleware re-checks DB on next request
    const record = await apiKeyModel.findUnique({ where: { id: key } });
    if (record) {
      deleteApiKey(record.key);
      await invalidateApiKeyCache(record.key);
    }

    res.status(200).json({ message: `API key ${key} revoked` });
  } catch (err: any) {
    if (err?.code === "P2025") {
      res.status(404).json({ error: "API key not found" });
      return;
    }
    res.status(500).json({ error: "Failed to revoke API key" });
  }
}
