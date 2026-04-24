import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getAuditActor, logAuditEvent } from "../services/auditLogger";
import {
  AdminRole,
  Permission,
  hasPermission,
  isValidRole,
} from "./permissions";

export interface AdminJwtPayload {
  sub: string;   // AdminUser id
  email: string;
  role: AdminRole;
  iat?: number;
  exp?: number;
}

function getJwtSecret(): string {
  return process.env.FLUID_ADMIN_JWT_SECRET ?? "dev-admin-jwt-secret";
}

// ── JWT helpers ──────────────────────────────────────────────────────────────

export function signAdminJwt(payload: Omit<AdminJwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "8h" });
}

export function verifyAdminJwt(token: string): AdminJwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AdminJwtPayload;
    if (!isValidRole(decoded.role)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ── Legacy static-token helpers (backward compat) ────────────────────────────

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

// ── Role resolution ───────────────────────────────────────────────────────────

/**
 * Resolve the admin role for an incoming request.
 *
 * Priority:
 *   1. x-admin-jwt header → verified JWT → role from payload
 *   2. x-admin-token matches FLUID_ADMIN_TOKEN → SUPER_ADMIN (backward compat)
 *   3. No valid auth → null
 */
export function resolveAdminRole(req: Request): AdminRole | null {
  const jwtHeader = req.header("x-admin-jwt");
  if (jwtHeader) {
    // JWT header present — must be valid; do NOT fall through to static token
    // so a tampered JWT can't be silently upgraded to SUPER_ADMIN.
    const payload = verifyAdminJwt(jwtHeader);
    return payload ? payload.role : null;
  }

  if (isAdminTokenAuthority(req)) return "SUPER_ADMIN";

  return null;
}

// ── requirePermission middleware factory ──────────────────────────────────────

/**
 * Express middleware that enforces a specific permission.
 *
 * Usage:
 *   app.post("/admin/api-keys", requirePermission("manage_api_keys"), handler)
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = resolveAdminRole(req);

    if (!role) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!hasPermission(role, permission)) {
      res.status(403).json({
        error: "Forbidden",
        detail: `Role '${role}' does not have permission '${permission}'`,
      });
      return;
    }

    void logAuditEvent("ADMIN_LOGIN", getAuditActor(req), {
      path: req.path,
      method: req.method,
      role,
      permission,
    });

    next();
  };
}
