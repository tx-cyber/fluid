# Quick Start - Transaction Logging Verification

## Prerequisites
- Node.js and npm installed
- Database configured (SQLite by default)
- Environment variables set (see `.env.example`)

## Step-by-Step Verification

### 1. Apply Database Migration
```bash
cd server
npm run db:migrate:deploy
```

Expected output: Migration applied successfully

### 2. Generate Prisma Client
```bash
npx prisma generate
```

Expected output: Prisma Client generated successfully

### 3. Run Unit Tests
```bash
npm test feeBump.test.ts
```

Expected output: All tests passing ✓

### 4. Trigger a Test Transaction
```bash
ts-node scripts/testFeeBump.ts
```

Expected output: Fee bump response with transaction hash

### 5. Verify Transaction Logging
```bash
ts-node scripts/verifyTransactionLogging.ts
```

Expected output:
- Total transaction count
- Recent transactions list
- Transactions grouped by status
- Transactions grouped by tenant

### 6. View in Prisma Studio (Optional)
```bash
npx prisma studio
```

Then:
1. Open browser at http://localhost:5555
2. Click on "Transaction" table
3. View all transaction records

## What to Look For

After running `testFeeBump.ts`, you should see in the Transaction table:

| Field | Expected Value |
|-------|---------------|
| id | UUID (auto-generated) |
| status | SUCCESS or FAILED |
| txHash | Transaction hash (if successful) |
| innerTxHash | Original transaction hash |
| tenantId | Tenant ID from API key |
| costStroops | Fee amount (e.g., 5000) |
| createdAt | Timestamp |

## Troubleshooting

### Migration fails
- Check DATABASE_URL in .env
- Ensure database file is writable
- Try: `npm run db:reset` (WARNING: deletes all data)

### Prisma generate fails
- Install dependencies: `npm install`
- Check prisma.config.ts is valid
- Try removing node_modules and reinstalling

### Test transaction fails
- Verify FLUID_FEE_PAYER_SECRET is set
- Check network connectivity to Stellar testnet
- Ensure API key is valid

### No transactions appear
- Check database connection
- Verify migration was applied
- Look for errors in server logs

## Sample Queries

### Get all successful transactions
```typescript
const successful = await prisma.transaction.findMany({
  where: { status: "SUCCESS" },
  orderBy: { createdAt: "desc" },
});
```

### Get total cost for a tenant
```typescript
const total = await prisma.transaction.aggregate({
  where: { tenantId: "your-tenant-id" },
  _sum: { costStroops: true },
});
```

### Get failed transactions
```typescript
const failed = await prisma.transaction.findMany({
  where: { status: "FAILED" },
  include: { tenant: true },
});
```

## Success Criteria

✅ Migration applied without errors
✅ Prisma client generated successfully
✅ All unit tests pass
✅ Test transaction creates a record in Transaction table
✅ Transaction status is SUCCESS (or FAILED with reason)
✅ txHash is populated for successful transactions
✅ Verification script shows transaction details

## Need Help?

See detailed documentation in:
- `server/docs/TRANSACTION_LOGGING.md` - Full implementation details
- `IMPLEMENTATION_SUMMARY.md` - Overview of changes
