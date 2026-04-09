import { expect, test, type Page } from "@playwright/test";

/**
 * Transaction History E2E tests  (#220)
 *
 * Requires a running dev/test server with valid credentials:
 *   ADMIN_EMAIL=<email>  ADMIN_PASSWORD=<password>  npx playwright test transactions
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
// Transactions page structure
// ---------------------------------------------------------------------------

test.describe("Transaction History – page structure", () => {
  test.beforeEach(async ({ page }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
    }
  });

  test("shows Transaction History heading", async ({ page }) => {
    await page.goto("/admin/transactions");
    await expect(
      page.getByRole("heading", { name: /transaction history/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("renders table with expected columns", async ({ page }) => {
    await page.goto("/admin/transactions");
    await page.waitForSelector("table", { timeout: 10_000 });

    await expect(page.getByRole("columnheader", { name: /time/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /inner hash/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /status/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /cost/i })).toBeVisible();
  });

  test("shows pagination controls", async ({ page }) => {
    await page.goto("/admin/transactions");
    await expect(
      page.getByRole("link", { name: /previous/i }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("link", { name: /next/i })).toBeVisible();
  });

  test("shows page count information", async ({ page }) => {
    await page.goto("/admin/transactions");
    // Text like "Showing page 1 of N with X total transactions."
    await expect(page.getByText(/showing page/i)).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

test.describe("Transaction History – pagination", () => {
  test("Previous button is disabled on page 1", async ({ page }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
      return;
    }

    await page.goto("/admin/transactions?page=1");
    const prev = page.getByRole("link", { name: /previous/i });
    await expect(prev).toBeVisible({ timeout: 8_000 });
    // The component sets aria-disabled="true" when on first page
    await expect(prev).toHaveAttribute("aria-disabled", "true");
  });

  test("Next link advances to page 2 and Previous becomes enabled", async ({
    page,
  }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
      return;
    }

    await page.goto("/admin/transactions?page=1");

    const next = page.getByRole("link", { name: /next/i });
    await expect(next).toBeVisible({ timeout: 8_000 });

    const nextHref = await next.getAttribute("href");
    // Only navigate if next is not disabled (i.e. there is a page 2)
    if (!nextHref || nextHref === "#") {
      test.skip(true, "Only one page of transactions in sample data");
      return;
    }

    await next.click();
    await page.waitForURL(/page=2/, { timeout: 8_000 });
    const prev = page.getByRole("link", { name: /previous/i });
    await expect(prev).not.toHaveAttribute("aria-disabled", "true");
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

test.describe("Transaction History – search", () => {
  test("submitting the search form updates the URL query", async ({ page }) => {
    const authed = await loginIfPossible(page);
    if (!authed) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
      return;
    }

    await page.goto("/admin/transactions");
    await page.waitForSelector("table", { timeout: 10_000 });

    const searchInput = page.getByRole("textbox", {
      name: /search transactions/i,
    });
    await searchInput.fill("success");
    await page.getByRole("button", { name: /search/i }).click();

    await page.waitForURL(/q=success/, { timeout: 8_000 });
  });
});
