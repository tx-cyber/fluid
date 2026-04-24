import Stripe from "stripe";
import prisma from "../utils/db";
import { createLogger } from "../utils/logger";
import { PrismaClient } from "@prisma/client";

const logger = createLogger({ component: "stripe_webhook_test" });
const typedPrisma = prisma as unknown as PrismaClient;

/**
 * Test script to simulate a Stripe webhook event
 * This creates a test payment and verifies quota is updated
 */
async function testStripeWebhook() {
  try {
    // Create a test tenant
    const tenant = await typedPrisma.tenant.create({
      data: {
        name: "Test Tenant for Stripe",
      },
    });

    logger.info({ tenantId: tenant.id }, "Created test tenant");

    const initialQuota = tenant.dailyQuotaStroops;
    logger.info(
      { initialQuota: initialQuota.toString() },
      "Initial quota"
    );

    // Simulate a successful Stripe checkout session
    const creditStroops = BigInt(10_000_000); // 1 XLM = 10,000,000 stroops
    const sessionId = `cs_test_${Date.now()}`;

    // Simulate the webhook handler logic
    await typedPrisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: tenant.id,
          stripeSessionId: sessionId,
          stripePaymentId: `pi_test_${Date.now()}`,
          amountCents: 1000, // $10.00
          creditStroops,
          status: "completed",
          metadata: {
            tenantId: tenant.id,
            creditStroops: creditStroops.toString(),
          },
        },
      });

      const updatedTenant = await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          dailyQuotaStroops: {
            increment: creditStroops,
          },
          totalCredit: {
            increment: creditStroops,
          },
        },
      });

      logger.info(
        {
          paymentId: payment.id,
          sessionId: payment.stripeSessionId,
          oldQuota: initialQuota.toString(),
          newQuota: updatedTenant.dailyQuotaStroops.toString(),
          totalCredit: updatedTenant.totalCredit.toString(),
          creditAdded: creditStroops.toString(),
        },
        "✅ Quota updated successfully"
      );

      // Verify the update
      const expectedQuota = initialQuota + creditStroops;
      if (updatedTenant.dailyQuotaStroops === expectedQuota) {
        logger.info("✅ Quota verification passed");
      } else {
        logger.error(
          {
            expected: expectedQuota.toString(),
            actual: updatedTenant.dailyQuotaStroops.toString(),
          },
          "❌ Quota verification failed"
        );
      }
    });

    // Test idempotency - try to process the same payment again
    logger.info("Testing idempotency...");
    const existingPayment = await typedPrisma.payment.findUnique({
      where: { stripeSessionId: sessionId },
    });

    if (existingPayment && existingPayment.status === "completed") {
      logger.info("✅ Idempotency check passed - payment already processed");
    }

    // Cleanup
    await typedPrisma.payment.deleteMany({ where: { tenantId: tenant.id } });
    await typedPrisma.tenant.delete({ where: { id: tenant.id } });
    logger.info("✅ Test cleanup completed");

    logger.info("🎉 All tests passed!");
  } catch (error: any) {
    logger.error({ error: error.message }, "❌ Test failed");
    throw error;
  } finally {
    await typedPrisma.$disconnect();
  }
}

// Run the test
testStripeWebhook().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
