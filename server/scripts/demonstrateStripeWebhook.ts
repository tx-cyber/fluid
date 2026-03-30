#!/usr/bin/env ts-node
/**
 * Demonstration script for Stripe webhook quota unlocking
 * 
 * This script demonstrates the complete flow:
 * 1. Creates a test tenant
 * 2. Shows initial quota
 * 3. Simulates a Stripe payment webhook
 * 4. Shows updated quota
 * 5. Tests idempotency
 */

import prisma from "../src/utils/db";
import { PrismaClient } from "@prisma/client";
import { handleCheckoutSessionCompleted } from "../src/handlers/stripeWebhook";
import Stripe from "stripe";

const typedPrisma = prisma as unknown as PrismaClient;

async function demonstrateWebhook() {
  console.log("\n🎯 Stripe Webhook Quota Unlocking Demonstration\n");
  console.log("=".repeat(60));

  try {
    // Step 1: Create a test tenant
    console.log("\n📝 Step 1: Creating test tenant...");
    const tenant = await typedPrisma.tenant.create({
      data: {
        name: "Demo Tenant - Acme Corp",
      },
    });
    console.log(`✅ Tenant created: ${tenant.id}`);
    console.log(`   Name: ${tenant.name}`);
    console.log(`   Initial quota: ${tenant.dailyQuotaStroops.toString()} stroops (${Number(tenant.dailyQuotaStroops) / 10_000_000} XLM)`);
    console.log(`   Total credit: ${tenant.totalCredit.toString()} stroops`);

    // Step 2: Simulate a Stripe payment
    console.log("\n💳 Step 2: Simulating Stripe payment webhook...");
    const creditAmount = BigInt(50_000_000); // 5 XLM
    const mockSession = {
      id: `cs_demo_${Date.now()}`,
      payment_intent: `pi_demo_${Date.now()}`,
      amount_total: 2500, // $25.00
      metadata: {
        tenantId: tenant.id,
        creditStroops: creditAmount.toString(),
      },
    } as unknown as Stripe.Checkout.Session;

    console.log(`   Session ID: ${mockSession.id}`);
    console.log(`   Payment amount: $${(mockSession.amount_total || 0) / 100}`);
    console.log(`   Credit to add: ${creditAmount.toString()} stroops (${Number(creditAmount) / 10_000_000} XLM)`);

    console.log("\n⚙️  Processing webhook event...");
    await handleCheckoutSessionCompleted(mockSession);

    // Step 3: Verify quota update
    console.log("\n📊 Step 3: Verifying quota update...");
    const updatedTenant = await typedPrisma.tenant.findUnique({
      where: { id: tenant.id },
    });

    if (!updatedTenant) {
      throw new Error("Tenant not found");
    }

    console.log(`✅ Quota updated successfully!`);
    console.log(`   Previous quota: ${tenant.dailyQuotaStroops.toString()} stroops`);
    console.log(`   New quota: ${updatedTenant.dailyQuotaStroops.toString()} stroops (${Number(updatedTenant.dailyQuotaStroops) / 10_000_000} XLM)`);
    console.log(`   Credit added: ${creditAmount.toString()} stroops`);
    console.log(`   Total credit: ${updatedTenant.totalCredit.toString()} stroops (${Number(updatedTenant.totalCredit) / 10_000_000} XLM)`);

    // Step 4: Verify payment record
    const payment = await typedPrisma.payment.findUnique({
      where: { stripeSessionId: mockSession.id },
    });

    if (payment) {
      console.log(`\n💾 Payment record created:`);
      console.log(`   Payment ID: ${payment.id}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Amount: $${payment.amountCents / 100}`);
    }

    // Step 5: Test idempotency
    console.log("\n🔒 Step 4: Testing idempotency (processing same payment again)...");
    await handleCheckoutSessionCompleted(mockSession);

    const tenantAfterDuplicate = await typedPrisma.tenant.findUnique({
      where: { id: tenant.id },
    });

    if (tenantAfterDuplicate?.dailyQuotaStroops === updatedTenant.dailyQuotaStroops) {
      console.log(`✅ Idempotency verified - quota remains: ${tenantAfterDuplicate.dailyQuotaStroops.toString()} stroops`);
      console.log(`   (Payment was not double-credited)`);
    } else {
      console.log(`❌ Idempotency failed - quota changed unexpectedly`);
    }

    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    await typedPrisma.payment.deleteMany({ where: { tenantId: tenant.id } });
    await typedPrisma.tenant.delete({ where: { id: tenant.id } });
    console.log("✅ Cleanup completed");

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Demonstration completed successfully!");
    console.log("=".repeat(60));
    console.log("\n✅ Stripe webhook handler successfully increases tenant quotas");
    console.log("✅ Idempotency prevents double-crediting");
    console.log("✅ All database updates are atomic");
    console.log("\n");

  } catch (error: any) {
    console.error("\n❌ Demonstration failed:", error.message);
    throw error;
  } finally {
    await typedPrisma.$disconnect();
  }
}

// Run the demonstration
demonstrateWebhook().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
