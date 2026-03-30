import Stripe from "stripe";
import prisma from "../utils/db";
import { PrismaClient } from "@prisma/client";
import { createLogger } from "../utils/logger";

const logger = createLogger({ component: "stripe_webhook_integration_test" });
const typedPrisma = prisma as unknown as PrismaClient;

/**
 * Integration test for Stripe webhook endpoint
 * Tests the webhook handler logic with a mock Stripe session
 */
async function testStripeWebhookIntegration() {
  try {
    // Create a test tenant
    const tenant = await typedPrisma.tenant.create({
      data: {
        name: "Integration Test Tenant",
      },
    });

    logger.info({ tenantId: tenant.id }, "Created test tenant");

    const initialQuota = tenant.dailyQuotaStroops;
    const creditStroops = BigInt(5_000_000); // 0.5 XLM

    // Create a minimal mock Stripe checkout session
    const mockSession = {
      id: `cs_test_${Date.now()}`,
      payment_intent: `pi_test_${Date.now()}`,
      amount_total: 500, // $5.00
      metadata: {
        tenantId: tenant.id,
        creditStroops: creditStroops.toString(),
      },
    } as unknown as Stripe.Checkout.Session;

    logger.info("Simulating webhook event processing...");

    // Import and call the internal handler function
    const { handleCheckoutSessionCompleted } = require("../handlers/stripeWebhook");
    await handleCheckoutSessionCompleted(mockSession);

    // Verify the quota was updated
    const updatedTenant = await typedPrisma.tenant.findUnique({
      where: { id: tenant.id },
    });

    if (!updatedTenant) {
      throw new Error("Tenant not found after update");
    }

    const expectedQuota = initialQuota + creditStroops;
    
    logger.info({
      tenantId: tenant.id,
      initialQuota: initialQuota.toString(),
      creditAdded: creditStroops.toString(),
      newQuota: updatedTenant.dailyQuotaStroops.toString(),
      expectedQuota: expectedQuota.toString(),
      totalCredit: updatedTenant.totalCredit.toString(),
    }, "Quota update results");

    if (updatedTenant.dailyQuotaStroops === expectedQuota) {
      logger.info("✅ Quota increased correctly");
    } else {
      throw new Error(
        `Quota mismatch: expected ${expectedQuota}, got ${updatedTenant.dailyQuotaStroops}`
      );
    }

    if (updatedTenant.totalCredit === creditStroops) {
      logger.info("✅ Total credit tracked correctly");
    } else {
      throw new Error(
        `Total credit mismatch: expected ${creditStroops}, got ${updatedTenant.totalCredit}`
      );
    }

    // Verify payment record was created
    const payment = await typedPrisma.payment.findUnique({
      where: { stripeSessionId: mockSession.id },
    });

    if (!payment) {
      throw new Error("Payment record not created");
    }

    logger.info({ paymentId: payment.id, status: payment.status }, "✅ Payment record created");

    // Test idempotency - try processing the same session again
    logger.info("Testing idempotency...");
    await handleCheckoutSessionCompleted(mockSession);

    const tenantAfterDuplicate = await typedPrisma.tenant.findUnique({
      where: { id: tenant.id },
    });

    if (tenantAfterDuplicate?.dailyQuotaStroops === expectedQuota) {
      logger.info("✅ Idempotency verified - quota not double-credited");
    } else {
      throw new Error("Idempotency failed - quota was credited twice");
    }

    // Cleanup
    await typedPrisma.payment.deleteMany({ where: { tenantId: tenant.id } });
    await typedPrisma.tenant.delete({ where: { id: tenant.id } });
    logger.info("✅ Test cleanup completed");

    logger.info("🎉 All integration tests passed!");
    logger.info("✅ Stripe webhook handler successfully increases tenant quota");
    
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, "❌ Integration test failed");
    throw error;
  } finally {
    await typedPrisma.$disconnect();
  }
}

// Run the test
testStripeWebhookIntegration().catch((error) => {
  console.error("Integration test failed:", error);
  process.exit(1);
});
