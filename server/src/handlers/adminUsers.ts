import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/db";
import { requirePermission, signAdminJwt } from "../utils/adminAuth";
import { isValidRole, AdminRole } from "../utils/permissions";
import { getAuditActor, logAuditEvent } from "../services/auditLogger";
import { AppError } from "../errors/AppError";

const adminUserModel = (prisma as any).adminUser as {
  findMany: (args?: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
};

// ── POST /admin/auth/login ────────────────────────────────────────────────────

export async function adminLoginHandler(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    // 1. Try DB-based admin user
    const user = await adminUserModel.findUnique({ where: { email } });

    if (user && user.active) {
      const match = await bcrypt.compare(password, user.passwordHash);
      if (match) {
        const token = signAdminJwt({ sub: user.id, email: user.email, role: user.role });
        void logAuditEvent("ADMIN_LOGIN", user.email, { source: "db" });
        return res.json({ token, role: user.role, email: user.email });
      }
    }

    // 2. Env-var fallback (bootstrap / single-admin deployments)
    const envEmail = process.env.ADMIN_EMAIL;
    const envHash = process.env.ADMIN_PASSWORD_HASH;
    if (envEmail && envHash && email === envEmail) {
      const match = await bcrypt.compare(password, envHash);
      if (match) {
        const token = signAdminJwt({ sub: "env-admin", email: envEmail, role: "SUPER_ADMIN" });
        void logAuditEvent("ADMIN_LOGIN", envEmail, { source: "env" });
        return res.json({ token, role: "SUPER_ADMIN", email: envEmail });
      }
    }

    return res.status(401).json({ error: "Invalid credentials" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ── GET /admin/users ──────────────────────────────────────────────────────────

export async function listAdminUsersHandler(req: Request, res: Response) {
  try {
    const users = await adminUserModel.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(
      users.map((u: any) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        active: u.active,
        createdAt: u.createdAt,
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: "Failed to list admin users" });
  }
}

// ── POST /admin/users ─────────────────────────────────────────────────────────

export async function createAdminUserHandler(req: Request, res: Response) {
  const { email, password, role } = req.body ?? {};

  if (!email || !password || !role) {
    return res.status(400).json({ error: "email, password, and role are required" });
  }
  if (!isValidRole(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: SUPER_ADMIN, ADMIN, READ_ONLY, BILLING` });
  }

  try {
    const existing = await adminUserModel.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An admin user with that email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await adminUserModel.create({
      data: {
        id: require("crypto").randomUUID(),
        email,
        passwordHash,
        role,
        active: true,
      },
    });

    void logAuditEvent("ADMIN_ACTION", getAuditActor(req), {
      action: "create_admin_user",
      targetEmail: email,
      role,
    });

    return res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create admin user" });
  }
}

// ── PATCH /admin/users/:id/role ───────────────────────────────────────────────

export async function updateAdminUserRoleHandler(req: Request, res: Response) {
  const { id } = req.params;
  const { role } = req.body ?? {};

  if (!role || !isValidRole(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: SUPER_ADMIN, ADMIN, READ_ONLY, BILLING` });
  }

  try {
    const user = await adminUserModel.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "Admin user not found" });

    const updated = await adminUserModel.update({
      where: { id },
      data: { role, updatedAt: new Date() },
    });

    void logAuditEvent("ADMIN_ACTION", getAuditActor(req), {
      action: "update_admin_role",
      targetId: id,
      targetEmail: updated.email,
      newRole: role,
      previousRole: user.role,
    });

    return res.json({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      active: updated.active,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update role" });
  }
}

// ── DELETE /admin/users/:id ───────────────────────────────────────────────────

export async function deactivateAdminUserHandler(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const user = await adminUserModel.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "Admin user not found" });

    const updated = await adminUserModel.update({
      where: { id },
      data: { active: false, updatedAt: new Date() },
    });

    void logAuditEvent("ADMIN_ACTION", getAuditActor(req), {
      action: "deactivate_admin_user",
      targetId: id,
      targetEmail: updated.email,
    });

    return res.json({ id: updated.id, email: updated.email, active: false });
  } catch (err) {
    return res.status(500).json({ error: "Failed to deactivate admin user" });
  }
}
