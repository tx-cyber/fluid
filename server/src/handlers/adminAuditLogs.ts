import { Request, Response } from "express";
import prisma from "../utils/db";

export async function listAuditLogsHandler(req: Request, res: Response) {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const actor = typeof req.query.actor === "string" ? req.query.actor : undefined;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (actor) where.actor = actor;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ items, total, limit, offset });
}
