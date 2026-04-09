import { expect, test, type Page } from "@playwright/test";

/**
 * API Keys E2E tests  (#220)
 *
 * Requires a running dev/test server with valid credentials:
 *   ADMIN_EMAIL=<email>  ADMIN_PASSWORD=<password>  npx playwright test api-keys
 *
 * When credentials are absent all tests are skipped.
 */

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function loginIfPossible(page: Page): Promise<boolean> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return false;

  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });
  return true;
}

// ---------------------------------------------------------------------------
// API Keys page
// ---------------------------------------------------------------------------

test.describe("API Keys – page structure", () => {
  test.beforeEach(async ({ page }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
    }
  });

  test("shows API Key Management heading", async ({ page }) => {
    await page.goto("/admin/api-keys");
    await expect(
      page.getByRole("heading", { name: /api key management/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("renders the API Keys table", async ({ page }) => {
    await page.goto("/admin/api-keys");
    await expect(
      page.getByRole("heading", { name: /api keys/i }),
    ).toBeVisible({ timeout: 10_000 });
    // Table should have column headers
    await expect(page.getByRole("columnheader", { name: /key/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /status/i })).toBeVisible();
  });

  test("Back to dashboard link navigates correctly", async ({ page }) => {
    await page.goto("/admin/api-keys");
    await page.getByRole("link", { name: /back to dashboard/i }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 8_000 });
    await expect(
      page.getByRole("heading", { name: /node operations dashboard/i }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// API Key copy flow
// ---------------------------------------------------------------------------

test.describe("API Keys – copy key", () => {
  test("copies the first active API key to clipboard", async ({
    page,
    context,
  }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
      return;
    }

    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/admin/api-keys");
    await page.waitForSelector("table", { timeout: 10_000 });

    // Find the first "Copy hash" button and click it
    const copyBtn = page.getByRole("button", { name: /copy/i }).first();
    if ((await copyBtn.count()) === 0) {
      test.skip(true, "No copy buttons found — sample data has no keys");
      return;
    }

    await copyBtn.click();
    // Assert clipboard contains a value (non-empty)
    const clipText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipText.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Revoke dialog
// ---------------------------------------------------------------------------

test.describe("API Keys – revoke dialog", () => {
  test("opens revoke confirmation dialog when Revoke is clicked", async ({
    page,
  }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
      return;
    }

    await page.goto("/admin/api-keys");
    await page.waitForSelector("table", { timeout: 10_000 });

    const revokeBtn = page.getByRole("button", { name: /revoke/i }).first();
    if ((await revokeBtn.count()) === 0) {
      test.skip(true, "No active keys to revoke in sample data");
      return;
    }

    await revokeBtn.click();

    // Dialog should appear with confirmation message
    await expect(
      page.getByRole("dialog"),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole("dialog").getByText(/revoke/i),
    ).toBeVisible();
  });
});
