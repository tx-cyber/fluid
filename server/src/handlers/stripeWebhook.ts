import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import prisma from "../utils/db";
import { PrismaClient } from "@prisma/client";
import { createLogger } from "../utils/logger";

const logger = createLogger({ component: "stripe_webhook" });
const typedPrisma = prisma as unknown as PrismaClient;

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    })
  : null;

export async function stripeWebhookHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    logger.warn("Missing Stripe signature header");
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  if (!stripe) {
    logger.error("Stripe not configured - missing STRIPE_SECRET_KEY");
    res.status(500).json({ error: "Stripe not configured" });
    return;
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!endpointSecret) {
    logger.error("Missing STRIPE_WEBHOOK_SECRET");
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      endpointSecret
    );
  } catch (err: any) {
    logger.error({ error: err.message }, "Webhook signature verification failed");
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  logger.info({ eventType: event.type, eventId: event.id }, "Received Stripe webhook");

  try {
    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      await handleCheckoutSessionCompleted(session);
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error({ error: error.message }, "Error processing webhook");
    next(error);
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const { id: sessionId, metadata, amount_total, payment_intent } = session;

  if (!metadata?.tenantId) {
    logger.warn({ sessionId }, "No tenantId in session metadata");
    return;
  }

  const tenantId = metadata.tenantId;
  const creditStroops = metadata.creditStroops ? BigInt(metadata.creditStroops) : BigInt(0);

  logger.info(
    { sessionId, tenantId, creditStroops: creditStroops.toString() },
    "Processing checkout session"
  );

  // Check for idempotency - don't credit twice for the same payment
  const existingPayment = await typedPrisma.payment.findUnique({
    where: { stripeSessionId: sessionId },
  });

  if (existingPayment) {
    if (existingPayment.status === "completed") {
      logger.info(
        { sessionId, tenantId },
        "Payment already processed, skipping duplicate"
      );
      return;
    }
  }

  // Start a transaction to ensure atomicity
  await typedPrisma.$transaction(async (tx) => {
    // Create or update payment record
    const payment = await tx.payment.upsert({
      where: { stripeSessionId: sessionId },
      create: {
        tenantId,
        stripeSessionId: sessionId,
        stripePaymentId: payment_intent as string,
        amountCents: amount_total || 0,
        creditStroops,
        status: "completed",
        metadata: metadata as any,
      },
      update: {
        stripePaymentId: payment_intent as string,
        status: "completed",
      },
    });

    // Update tenant's quota
    const tenant = await tx.tenant.update({
      where: { id: tenantId },
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
        tenantId,
        sessionId,
        paymentId: payment.id,
        newQuota: tenant.dailyQuotaStroops.toString(),
        totalCredit: tenant.totalCredit.toString(),
      },
      "Quota updated successfully"
    );

    // TODO: Send notification to user via webhook or email
    if (tenant.webhookUrl) {
      logger.info(
        { tenantId, webhookUrl: tenant.webhookUrl },
        "Tenant webhook notification would be sent here"
      );
      // You can integrate with the existing WebhookService here
    }
  });
}

// Export for testing
export { handleCheckoutSessionCompleted };
