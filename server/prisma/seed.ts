import "dotenv/config";

import { createLogger, serializeError } from "../src/utils/logger";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const dbUrl = process.env["DATABASE_URL"] ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });
const logger = createLogger({ component: "prisma_seed" });

async function main () {
  logger.info("Seeding database with initial data");

  const tiers = await Promise.all([
    prisma.subscriptionTier.upsert({
      where: { name: "Free" },
      update: { txLimit: 10, rateLimit: 5, priceMonthly: 0 },
      create: {
        id: "tier-free",
        name: "Free",
        txLimit: 10,
        rateLimit: 5,
        priceMonthly: 0,
      },
    }),
    prisma.subscriptionTier.upsert({
      where: { name: "Pro" },
      update: { txLimit: 1000, rateLimit: 60, priceMonthly: 4900 },
      create: {
        id: "tier-pro",
        name: "Pro",
        txLimit: 1000,
        rateLimit: 60,
        priceMonthly: 4900,
      },
    }),
    prisma.subscriptionTier.upsert({
      where: { name: "Enterprise" },
      update: { txLimit: 100000, rateLimit: 300, priceMonthly: 19900 },
      create: {
        id: "tier-enterprise",
        name: "Enterprise",
        txLimit: 100000,
        rateLimit: 300,
        priceMonthly: 19900,
      },
    }),
  ]);

  const freeTier = tiers.find((tier) => tier.name === "Free");
  if (!freeTier) {
    throw new Error("Free tier was not seeded");
  }

  // Create test tenants with API keys
  const tenants = await Promise.all([
    prisma.tenant.upsert({
      where: { id: "tenant-test-001" },
      update: {
        name: "Test Tenant 1",
        subscriptionTierId: freeTier.id,
      },
      create: {
        id: "tenant-test-001",
        name: "Test Tenant 1",
        subscriptionTierId: freeTier.id,
      },
    }),
    prisma.tenant.upsert({
      where: { id: "tenant-test-002" },
      update: {
        name: "Development Tenant",
        subscriptionTierId: freeTier.id,
      },
      create: {
        id: "tenant-test-002",
        name: "Development Tenant",
        subscriptionTierId: freeTier.id,
      },
    }),
  ]);

  await Promise.all([
    prisma.apiKey.upsert({
      where: { key: "test-api-key-001" },
      update: {
        tenantId: tenants[0].id,
        prefix: "test",
        name: "Primary Test Key",
        maxRequests: freeTier.rateLimit,
        tier: "free",
      },
      create: {
        key: "test-api-key-001",
        prefix: "test",
        name: "Primary Test Key",
        tenantId: tenants[0].id,
        maxRequests: freeTier.rateLimit,
        tier: "free",
      },
    }),
    prisma.apiKey.upsert({
      where: { key: "test-api-key-002" },
      update: {
        tenantId: tenants[1].id,
        prefix: "test",
        name: "Development Key",
        maxRequests: freeTier.rateLimit,
        tier: "free",
      },
      create: {
        key: "test-api-key-002",
        prefix: "test",
        name: "Development Key",
        tenantId: tenants[1].id,
        maxRequests: freeTier.rateLimit,
        tier: "free",
      },
    }),
  ]);

  logger.info(
    {
      tier_count: tiers.length,
      tenant_count: tenants.length,
      tenants: tenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        subscription_tier_id: tenant.subscriptionTierId,
      })),
    },
    "Seeded test tenants"
  );

  logger.info("Seeding complete");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    logger.error({ ...serializeError(e) }, "Seeding failed");
    await prisma.$disconnect();
    process.exit(1);
  });
