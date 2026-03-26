# Stripe Webhook Handler Implementation

## Overview

This implementation adds automated quota unlocking when customers make successful Stripe payments. When a Stripe `checkout.session.completed` event is received, the tenant's XLM quota is automatically increased.

## Features

✅ Handles `checkout.session.completed` webhook events from Stripe  
✅ Verifies webhook signature for security  
✅ Updates tenant `dailyQuotaStroops` and `totalCredit` atomically  
✅ Idempotent - prevents double-crediting for the same payment  
✅ Comprehensive logging for debugging and auditing  
✅ Test suite with passing integration tests  

## Database Schema Changes

### New Models

**Payment** - Tracks all Stripe payments
- `id`: UUID primary key
- `tenantId`: Foreign key to Tenant
- `stripeSessionId`: Unique Stripe checkout session ID
- `stripePaymentId`: Stripe payment intent ID
- `amountCents`: Payment amount in cents
- `creditStroops`: XLM credit amount in stroops
- `status`: Payment status (pending, completed, failed)
- `metadata`: JSON metadata from Stripe
- `createdAt`, `updatedAt`: Timestamps

**SponsoredTransaction** - Tracks fee sponsorship usage
- `id`: UUID primary key
- `tenantId`: Tenant identifier
- `feeStroops`: Fee amount in stroops
- `createdAt`: Timestamp

### Updated Models

**Tenant** - Added quota tracking fields
- `dailyQuotaStroops`: Daily spending limit in stroops (BigInt)
- `totalCredit`: Total purchased credit in stroops (BigInt)
- `webhookUrl`: Optional webhook URL for notifications

**ApiKey** - Added quota configuration fields
- `dailyQuotaStroops`: Per-key quota limit (BigInt)
- `maxRequests`: Rate limit max requests
- `windowMs`: Rate limit window in milliseconds
- `tier`: Subscription tier (free/pro)

## API Endpoint

### POST /webhooks/stripe

Receives and processes Stripe webhook events.

**Headers:**
- `stripe-signature`: Stripe webhook signature (required)
- `Content-Type`: application/json

**Request Body:**
Raw Stripe event payload

**Response:**
```json
{
  "received": true
}
```

**Error Responses:**
- `400`: Missing signature or invalid signature
- `500`: Stripe not configured

## Configuration

Add these environment variables to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Getting Your Stripe Keys

1. **Secret Key**: Get from [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. **Webhook Secret**: 
   - Go to [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
   - Click "Add endpoint"
   - Enter your webhook URL: `https://yourdomain.com/webhooks/stripe`
   - Select event: `checkout.session.completed`
   - Copy the webhook signing secret

## Stripe Checkout Session Metadata

When creating a Stripe checkout session, include these metadata fields:

```javascript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: {
        name: 'XLM Credit - 10 XLM',
      },
      unit_amount: 1000, // $10.00
    },
    quantity: 1,
  }],
  mode: 'payment',
  success_url: 'https://yourdomain.com/success',
  cancel_url: 'https://yourdomain.com/cancel',
  metadata: {
    tenantId: 'tenant-uuid-here',
    creditStroops: '100000000', // 10 XLM = 100,000,000 stroops
  },
});
```

## Testing

### Run Unit Tests

```bash
cd server
export DATABASE_URL="file:./dev.db"
npx ts-node src/test/stripeWebhookTest.ts
```

### Run Integration Tests

```bash
cd server
export DATABASE_URL="file:./dev.db"
npx ts-node src/test/stripeWebhookIntegration.ts
```

### Test Output

```
✅ Created test tenant
✅ Quota increased correctly (1,000,000 → 6,000,000 stroops)
✅ Total credit tracked correctly
✅ Payment record created
✅ Idempotency verified - quota not double-credited
✅ Test cleanup completed
🎉 All integration tests passed!
```

## Testing with Stripe CLI

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)

2. Login to Stripe:
```bash
stripe login
```

3. Forward webhooks to your local server:
```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

4. Trigger a test webhook:
```bash
stripe trigger checkout.session.completed
```

5. Or create a real test checkout session:
```bash
stripe checkout sessions create \
  --mode=payment \
  --line-items='[{"price_data":{"currency":"usd","product_data":{"name":"XLM Credit"},"unit_amount":1000},"quantity":1}]' \
  --success-url="https://example.com/success" \
  --cancel-url="https://example.com/cancel" \
  --metadata='{"tenantId":"your-tenant-id","creditStroops":"100000000"}'
```

## Security Considerations

1. **Signature Verification**: All webhooks are verified using Stripe's signature to prevent spoofing
2. **Idempotency**: Payment IDs are checked to prevent double-crediting
3. **Atomic Transactions**: Database updates use transactions to ensure consistency
4. **Environment Variables**: Sensitive keys are stored in environment variables, not code

## Logging

All webhook events are logged with structured JSON logging:

```json
{
  "level": "info",
  "component": "stripe_webhook",
  "sessionId": "cs_test_...",
  "tenantId": "uuid",
  "creditStroops": "100000000",
  "msg": "Quota updated successfully"
}
```

## Quota Calculation

- **1 XLM = 10,000,000 stroops**
- Default quota: 1,000,000 stroops (0.1 XLM)
- Example purchase: $10 = 10 XLM = 100,000,000 stroops

## Future Enhancements

- [ ] Email notifications to users after successful payment
- [ ] Webhook notifications to tenant's configured webhook URL
- [ ] Support for subscription-based recurring payments
- [ ] Admin dashboard to view payment history
- [ ] Refund handling (decrease quota on refund)
- [ ] Payment analytics and reporting

## Files Changed

- `server/prisma/schema.prisma` - Added Payment, SponsoredTransaction models, updated Tenant and ApiKey
- `server/src/handlers/stripeWebhook.ts` - New webhook handler
- `server/src/index.ts` - Added webhook endpoint
- `server/src/utils/db.ts` - Updated to use better-sqlite3 adapter
- `server/.env.example` - Added Stripe configuration
- `server/src/test/stripeWebhookTest.ts` - Unit tests
- `server/src/test/stripeWebhookIntegration.ts` - Integration tests

## Commit Message

```
feat: add stripe webhook handler to automatically unlock quotas

- Handle checkout.session.completed events from Stripe
- Verify webhook signatures for security
- Update tenant dailyQuotaStroops and totalCredit atomically
- Implement idempotency to prevent double-crediting
- Add comprehensive test suite with passing tests
- Log all quota updates for auditing

Closes #140
```
