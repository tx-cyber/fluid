-- CreateTable
CREATE TABLE "WebhookDlq" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL,
    "failedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookDlq_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WebhookDlq_tenantId_idx" ON "WebhookDlq"("tenantId");

-- CreateIndex
CREATE INDEX "WebhookDlq_expiresAt_idx" ON "WebhookDlq"("expiresAt");
