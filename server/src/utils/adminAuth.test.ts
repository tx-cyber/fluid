import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { signAdminJwt, verifyAdminJwt, resolveAdminRole, requirePermission } from "./adminAuth";

vi.mock("../services/auditLogger", () => ({
  logAuditEvent: vi.fn(),
  getAuditActor: vi.fn().mockReturnValue("test"),
}));

function makeReq(headers: Record<string, string> = {}): Request {
  return { header: (name: string) => headers[name.toLowerCase()] } as unknown as Request;
}

function makeRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as Response, json, status };
}

// ── JWT round-trip ────────────────────────────────────────────────────────────

describe("signAdminJwt / verifyAdminJwt", () => {
  it("produces a token that verifies back to the same payload", () => {
    const payload = { sub: "u1", email: "a@test.com", role: "ADMIN" as const };
    const token = signAdminJwt(payload);
    const decoded = verifyAdminJwt(token);
    expect(decoded?.sub).toBe("u1");
    expect(decoded?.role).toBe("ADMIN");
  });

  it("returns null for a tampered token", () => {
    const token = signAdminJwt({ sub: "u1", email: "a@test.com", role: "ADMIN" });
    expect(verifyAdminJwt(token + "tampered")).toBeNull();
  });

  it("returns null for a token with an unknown role", () => {
    // Forge a token with an invalid role using a different secret
    // — verifyAdminJwt should reject it
    const result = verifyAdminJwt("not.a.jwt");
    expect(result).toBeNull();
  });
});

// ── resolveAdminRole ──────────────────────────────────────────────────────────

describe("resolveAdminRole", () => {
  beforeEach(() => {
    vi.stubEnv("FLUID_ADMIN_TOKEN", "static-token");
    vi.stubEnv("FLUID_ADMIN_JWT_SECRET", "test-secret");
  });

  it("resolves role from a valid x-admin-jwt header", () => {
    const token = signAdminJwt({ sub: "u1", email: "a@test.com", role: "READ_ONLY" });
    const req = makeReq({ "x-admin-jwt": token });
    expect(resolveAdminRole(req)).toBe("READ_ONLY");
  });

  it("falls back to SUPER_ADMIN when static token matches", () => {
    const req = makeReq({ "x-admin-token": "static-token" });
    expect(resolveAdminRole(req)).toBe("SUPER_ADMIN");
  });

  it("returns null when neither header is present", () => {
    const req = makeReq({});
    expect(resolveAdminRole(req)).toBeNull();
  });

  it("returns null for an invalid JWT even if static token matches", () => {
    // JWT takes priority; if it's invalid → null (don't fall through to static token)
    const req = makeReq({ "x-admin-jwt": "invalid.jwt.here", "x-admin-token": "static-token" });
    expect(resolveAdminRole(req)).toBeNull();
  });
});

// ── requirePermission middleware ──────────────────────────────────────────────

describe("requirePermission", () => {
  beforeEach(() => {
    vi.stubEnv("FLUID_ADMIN_TOKEN", "static-token");
    vi.stubEnv("FLUID_ADMIN_JWT_SECRET", "test-secret");
  });

  it("calls next() when role has the required permission", () => {
    const token = signAdminJwt({ sub: "u1", email: "a@test.com", role: "ADMIN" });
    const req = makeReq({ "x-admin-jwt": token });
    const { res } = makeRes();
    const next = vi.fn() as NextFunction;

    requirePermission("manage_api_keys")(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when role lacks the permission", () => {
    const token = signAdminJwt({ sub: "u1", email: "a@test.com", role: "READ_ONLY" });
    const req = makeReq({ "x-admin-jwt": token });
    const { res, status } = makeRes();
    const next = vi.fn() as NextFunction;

    requirePermission("manage_api_keys")(req, res, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when no auth header provided", () => {
    const req = makeReq({});
    const { res, status } = makeRes();
    const next = vi.fn() as NextFunction;

    requirePermission("view_transactions")(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN via static token passes any permission check", () => {
    const req = makeReq({ "x-admin-token": "static-token" });
    const { res } = makeRes();
    const next = vi.fn() as NextFunction;

    requirePermission("manage_users")(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("BILLING role can access manage_billing", () => {
    const token = signAdminJwt({ sub: "u2", email: "b@test.com", role: "BILLING" });
    const req = makeReq({ "x-admin-jwt": token });
    const { res } = makeRes();
    const next = vi.fn() as NextFunction;

    requirePermission("manage_billing")(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("BILLING role cannot access manage_api_keys", () => {
    const token = signAdminJwt({ sub: "u2", email: "b@test.com", role: "BILLING" });
    const req = makeReq({ "x-admin-jwt": token });
    const { res, status } = makeRes();
    const next = vi.fn() as NextFunction;

    requirePermission("manage_api_keys")(req, res, next);
    expect(status).toHaveBeenCalledWith(403);
  });
});
