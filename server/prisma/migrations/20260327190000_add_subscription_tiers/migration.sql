CREATE TABLE "SubscriptionTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "txLimit" INTEGER NOT NULL,
    "rateLimit" INTEGER NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "SubscriptionTier_name_key" ON "SubscriptionTier"("name");

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "stripePaymentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "creditStroops" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Payment_stripeSessionId_key" ON "Payment"("stripeSessionId");
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

ALTER TABLE "Tenant" ADD COLUMN "subscriptionTierId" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Default API Key';

INSERT INTO "SubscriptionTier" ("id", "name", "txLimit", "rateLimit", "priceMonthly", "createdAt", "updatedAt")
VALUES
    ('tier-free', 'Free', 10, 5, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('tier-pro', 'Pro', 1000, 60, 4900, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('tier-enterprise', 'Enterprise', 100000, 300, 19900, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "Tenant"
SET "subscriptionTierId" = 'tier-free'
WHERE "subscriptionTierId" IS NULL;

CREATE TABLE "new_Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subscriptionTierId" TEXT NOT NULL,
    "dailyQuotaStroops" BIGINT NOT NULL DEFAULT 1000000,
    "totalCredit" BIGINT NOT NULL DEFAULT 0,
    "webhookUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tenant_subscriptionTierId_fkey" FOREIGN KEY ("subscriptionTierId") REFERENCES "SubscriptionTier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Tenant" ("id", "name", "subscriptionTierId", "dailyQuotaStroops", "totalCredit", "webhookUrl", "createdAt", "updatedAt")
SELECT "id", "name", "subscriptionTierId", "dailyQuotaStroops", "totalCredit", "webhookUrl", "createdAt", "updatedAt"
FROM "Tenant";

DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";

CREATE INDEX "Tenant_subscriptionTierId_idx" ON "Tenant"("subscriptionTierId");
