import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../utils/db";

describe("Transaction Logging", () => {
  beforeEach(async () => {
    // Clean up test transactions
    await prisma.transaction.deleteMany({
      where: { tenantId: "test-tenant" },
    });
  });

  it("should create a transaction record with PENDING status", async () => {
    const transaction = await prisma.transaction.create({
      data: {
        innerTxHash: "test-inner-hash",
        tenantId: "test-tenant",
        status: "PENDING",
        costStroops: BigInt(1000),
      },
    });

    expect(transaction.id).toBeDefined();
    expect(transaction.status).toBe("PENDING");
    expect(transaction.innerTxHash).toBe("test-inner-hash");
    expect(transaction.tenantId).toBe("test-tenant");
    expect(transaction.costStroops).toBe(BigInt(1000));
    expect(transaction.txHash).toBeNull();
  });

  it("should update transaction to SUCCESS with txHash", async () => {
    const transaction = await prisma.transaction.create({
      data: {
        innerTxHash: "test-inner-hash",
        tenantId: "test-tenant",
        status: "PENDING",
        costStroops: BigInt(1000),
      },
    });

    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "SUCCESS",
        txHash: "test-fee-bump-hash",
      },
    });

    expect(updated.status).toBe("SUCCESS");
    expect(updated.txHash).toBe("test-fee-bump-hash");
  });

  it("should update transaction to FAILED on error", async () => {
    const transaction = await prisma.transaction.create({
      data: {
        innerTxHash: "test-inner-hash",
        tenantId: "test-tenant",
        status: "PENDING",
        costStroops: BigInt(1000),
      },
    });

    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "FAILED",
      },
    });

    expect(updated.status).toBe("FAILED");
  });

  it("should query transactions by tenantId", async () => {
    await prisma.transaction.createMany({
      data: [
        {
          innerTxHash: "hash-1",
          tenantId: "test-tenant",
          status: "SUCCESS",
          costStroops: BigInt(1000),
          txHash: "fee-bump-hash-1",
        },
        {
          innerTxHash: "hash-2",
          tenantId: "test-tenant",
          status: "FAILED",
          costStroops: BigInt(2000),
        },
      ],
    });

    const transactions = await prisma.transaction.findMany({
      where: { tenantId: "test-tenant" },
    });

    expect(transactions).toHaveLength(2);
  });

  it("should query transactions by status", async () => {
    await prisma.transaction.createMany({
      data: [
        {
          innerTxHash: "hash-1",
          tenantId: "test-tenant",
          status: "SUCCESS",
          costStroops: BigInt(1000),
          txHash: "fee-bump-hash-1",
        },
        {
          innerTxHash: "hash-2",
          tenantId: "test-tenant",
          status: "FAILED",
          costStroops: BigInt(2000),
        },
      ],
    });

    const successTxs = await prisma.transaction.findMany({
      where: { status: "SUCCESS" },
    });

    const failedTxs = await prisma.transaction.findMany({
      where: { status: "FAILED" },
    });

    expect(successTxs.length).toBeGreaterThanOrEqual(1);
    expect(failedTxs.length).toBeGreaterThanOrEqual(1);
  });

  it("should calculate total cost by tenant", async () => {
    await prisma.transaction.createMany({
      data: [
        {
          innerTxHash: "hash-1",
          tenantId: "test-tenant",
          status: "SUCCESS",
          costStroops: BigInt(1000),
          txHash: "fee-bump-hash-1",
        },
        {
          innerTxHash: "hash-2",
          tenantId: "test-tenant",
          status: "SUCCESS",
          costStroops: BigInt(2000),
          txHash: "fee-bump-hash-2",
        },
      ],
    });

    const result = await prisma.transaction.aggregate({
      where: { tenantId: "test-tenant", status: "SUCCESS" },
      _sum: { costStroops: true },
    });

    expect(result._sum.costStroops).toBe(BigInt(3000));
  });
});
