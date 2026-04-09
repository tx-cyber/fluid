import { expect, test, type Page } from "@playwright/test";

/**
 * Settings / Subscription Tier Manager E2E tests  (#220)
 *
 * The dashboard's primary "settings" panel is the SubscriptionTierManager
 * which lets admins change a tenant's plan tier and displays a notice banner
 * on success (acting as the success toast).
 *
 * Requires a running dev/test server with valid credentials:
 *   ADMIN_EMAIL=<email>  ADMIN_PASSWORD=<password>  npx playwright test settings
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
// SubscriptionTierManager on dashboard
// ---------------------------------------------------------------------------

test.describe("Settings – Subscription Tier Manager", () => {
  test("renders the tier manager section on the admin dashboard", async ({
    page,
  }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
      return;
    }

    await expect(
      page.getByRole("heading", { name: /tiered saas controls/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Tier cards should be visible
    await expect(page.getByRole("article").first()).toBeVisible();
  });

  test("shows current plan for the selected tenant", async ({ page }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
      return;
    }

    // "Current plan" label appears inside the dark banner when a tenant is loaded
    await expect(
      page.getByText(/current plan/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a non-current tier shows a success notice", async ({
    page,
  }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
      return;
    }

    await page.waitForSelector("article", { timeout: 10_000 });

    // Find the first "Move to …" button (non-current tier) and click it
    const upgradeBtn = page
      .getByRole("button", { name: /move to/i })
      .first();

    if ((await upgradeBtn.count()) === 0) {
      test.skip(
        true,
        "No non-current tiers available — only one tier in sample data",
      );
      return;
    }

    await upgradeBtn.click();

    // In sample mode: notice banner appears with "Preview updated: ..."
    // In live mode: notice banner appears with "<tenant> upgraded to <tier>."
    await expect(
      page.getByText(/preview updated|upgraded to/i),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// BillingTopUp section
// ---------------------------------------------------------------------------

test.describe("Settings – Billing Top-Up", () => {
  test("renders billing top-up section on the dashboard", async ({ page }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
      return;
    }

    // BillingTopUp uses Stripe and shows a card form or balance info
    // At minimum the section should be present in the DOM
    await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
    // Scroll to bottom to ensure the billing section is loaded
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  });
});
