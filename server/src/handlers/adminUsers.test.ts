import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// ── Mock Prisma ──────────────────────────────────────────────────────────────
vi.mock("../utils/db", () => ({
  default: {
    adminUser: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../services/auditLogger", () => ({
  logAuditEvent: vi.fn(),
  getAuditActor: vi.fn().mockReturnValue("test-actor"),
}));

import prisma from "../utils/db";
import {
  listAdminUsersHandler,
  createAdminUserHandler,
  updateAdminUserRoleHandler,
  deactivateAdminUserHandler,
  adminLoginHandler,
} from "./adminUsers";

const adminUser = (prisma as any).adminUser;

function makeReq(body: any = {}, params: any = {}): Request {
  return { body, params, header: vi.fn() } as unknown as Request;
}

function makeRes(): { res: Response; json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> } {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  const res = { json, status } as unknown as Response;
  return { res, json, status };
}

// ── listAdminUsersHandler ────────────────────────────────────────────────────

describe("listAdminUsersHandler", () => {
  it("returns a list of users with sensitive fields omitted", async () => {
    adminUser.findMany.mockResolvedValueOnce([
      { id: "1", email: "a@test.com", role: "ADMIN", active: true, passwordHash: "SECRET", createdAt: new Date() },
    ]);
    const { res, json } = makeRes();
    await listAdminUsersHandler(makeReq(), res);
    expect(json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ email: "a@test.com", role: "ADMIN" }),
      ])
    );
    // passwordHash must NOT be leaked
    const result = json.mock.calls[0][0];
    expect(result[0]).not.toHaveProperty("passwordHash");
  });

  it("returns 500 on DB error", async () => {
    adminUser.findMany.mockRejectedValueOnce(new Error("db error"));
    const { res, status, json } = makeRes();
    (res as any).status = status;
    await listAdminUsersHandler(makeReq(), res);
    expect(status).toHaveBeenCalledWith(500);
  });
});

// ── createAdminUserHandler ───────────────────────────────────────────────────

describe("createAdminUserHandler", () => {
  beforeEach(() => {
    adminUser.findUnique.mockResolvedValue(null);
    adminUser.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      createdAt: new Date(),
    }));
  });

  it("creates a user and returns 201", async () => {
    const { res, status } = makeRes();
    (res as any).status = status;
    await createAdminUserHandler(
      makeReq({ email: "new@test.com", password: "secure123!", role: "ADMIN" }),
      res
    );
    expect(status).toHaveBeenCalledWith(201);
    const created = status.mock.results[0].value.json.mock.calls[0][0];
    expect(created.email).toBe("new@test.com");
    expect(created.role).toBe("ADMIN");
    expect(created).not.toHaveProperty("passwordHash");
  });

  it("rejects invalid role with 400", async () => {
    const { res, status } = makeRes();
    (res as any).status = status;
    await createAdminUserHandler(
      makeReq({ email: "x@test.com", password: "pass", role: "GOD_MODE" }),
      res
    );
    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 409 when email already exists", async () => {
    adminUser.findUnique.mockResolvedValueOnce({ id: "1" });
    const { res, status } = makeRes();
    (res as any).status = status;
    await createAdminUserHandler(
      makeReq({ email: "exists@test.com", password: "pass", role: "ADMIN" }),
      res
    );
    expect(status).toHaveBeenCalledWith(409);
  });

  it("returns 400 when required fields are missing", async () => {
    const { res, status } = makeRes();
    (res as any).status = status;
    await createAdminUserHandler(makeReq({ email: "only@test.com" }), res);
    expect(status).toHaveBeenCalledWith(400);
  });
});

// ── updateAdminUserRoleHandler ───────────────────────────────────────────────

describe("updateAdminUserRoleHandler", () => {
  it("updates role and returns updated user", async () => {
    adminUser.findUnique.mockResolvedValueOnce({ id: "1", email: "u@test.com", role: "READ_ONLY" });
    adminUser.update.mockResolvedValueOnce({ id: "1", email: "u@test.com", role: "ADMIN", active: true });

    const { res, json } = makeRes();
    await updateAdminUserRoleHandler(makeReq({ role: "ADMIN" }, { id: "1" }), res);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }));
  });

  it("returns 404 when user does not exist", async () => {
    adminUser.findUnique.mockResolvedValueOnce(null);
    const { res, status } = makeRes();
    (res as any).status = status;
    await updateAdminUserRoleHandler(makeReq({ role: "ADMIN" }, { id: "ghost" }), res);
    expect(status).toHaveBeenCalledWith(404);
  });

  it("returns 400 for invalid role", async () => {
    const { res, status } = makeRes();
    (res as any).status = status;
    await updateAdminUserRoleHandler(makeReq({ role: "INVALID" }, { id: "1" }), res);
    expect(status).toHaveBeenCalledWith(400);
  });
});

// ── deactivateAdminUserHandler ───────────────────────────────────────────────

describe("deactivateAdminUserHandler", () => {
  it("sets active=false and returns the user", async () => {
    adminUser.findUnique.mockResolvedValueOnce({ id: "1", email: "u@test.com", active: true });
    adminUser.update.mockResolvedValueOnce({ id: "1", email: "u@test.com", active: false });

    const { res, json } = makeRes();
    await deactivateAdminUserHandler(makeReq({}, { id: "1" }), res);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  it("returns 404 when user does not exist", async () => {
    adminUser.findUnique.mockResolvedValueOnce(null);
    const { res, status } = makeRes();
    (res as any).status = status;
    await deactivateAdminUserHandler(makeReq({}, { id: "ghost" }), res);
    expect(status).toHaveBeenCalledWith(404);
  });
});

// ── adminLoginHandler ────────────────────────────────────────────────────────

describe("adminLoginHandler", () => {
  it("returns 400 when email or password missing", async () => {
    const { res, status } = makeRes();
    (res as any).status = status;
    await adminLoginHandler(makeReq({ email: "x@test.com" }), res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 401 for unknown email", async () => {
    adminUser.findUnique.mockResolvedValueOnce(null);
    const { res, status } = makeRes();
    (res as any).status = status;
    await adminLoginHandler(makeReq({ email: "unknown@test.com", password: "pw" }), res);
    expect(status).toHaveBeenCalledWith(401);
  });

  it("returns 401 for inactive user", async () => {
    adminUser.findUnique.mockResolvedValueOnce({ id: "1", email: "u@test.com", passwordHash: "$x", active: false });
    const { res, status } = makeRes();
    (res as any).status = status;
    await adminLoginHandler(makeReq({ email: "u@test.com", password: "pw" }), res);
    expect(status).toHaveBeenCalledWith(401);
  });
});
