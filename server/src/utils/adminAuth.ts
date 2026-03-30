import { Request, Response } from "express";
import { getAuditActor, logAuditEvent } from "../services/auditLogger";

export function isAdminTokenAuthority(req: Request): boolean {
  const token = req.header("x-admin-token");
  const expected = process.env.FLUID_ADMIN_TOKEN;
  return Boolean(expected) && token === expected;
}

export function requireAdminToken(req: Request, res: Response): boolean {
  if (!isAdminTokenAuthority(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  void logAuditEvent("ADMIN_LOGIN", getAuditActor(req), {
    path: req.path,
    method: req.method,
  });

  return true;
}
