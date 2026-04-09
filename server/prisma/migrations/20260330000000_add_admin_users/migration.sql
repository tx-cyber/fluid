-- AdminUser table for role-based access control
CREATE TABLE "AdminUser" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "email"        TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role"         TEXT NOT NULL DEFAULT 'READ_ONLY',
    "active"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE INDEX "AdminUser_email_idx" ON "AdminUser"("email");
CREATE INDEX "AdminUser_role_idx" ON "AdminUser"("role");
CREATE INDEX "AdminUser_active_idx" ON "AdminUser"("active");
