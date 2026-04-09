import { expect, test, type Page } from "@playwright/test";

/**
 * Admin Login E2E tests  (#220)
 *
 * Requires a running dev/test server with valid credentials exported as:
 *   ADMIN_EMAIL=<email>  ADMIN_PASSWORD=<password>  npx playwright test admin-login
 *
 * When credentials are absent all auth-dependent tests are skipped.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function attemptLogin(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

// ---------------------------------------------------------------------------
// Login page UI
// ---------------------------------------------------------------------------

test.describe("Admin Login – page structure", () => {
  test("renders login form with email, password and submit button", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /admin login/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Invalid-credentials error
// ---------------------------------------------------------------------------

test.describe("Admin Login – invalid credentials", () => {
  test("shows error message for wrong email/password", async ({ page }) => {
    await attemptLogin(page, "wrong@example.com", "badpassword");
    // NextAuth credentials provider redirects back with error, or shows inline error
    await expect(
      page.getByText(/invalid credentials/i),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Successful login flow (requires ADMIN_EMAIL + ADMIN_PASSWORD)
// ---------------------------------------------------------------------------

test.describe("Admin Login – successful flow", () => {
  test("logs in and redirects to admin dashboard", async ({ page }) => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      test.skip(true, "ADMIN_EMAIL / ADMIN_PASSWORD not set");
      return;
    }

    await attemptLogin(page, email, password);
    await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });

    await expect(
      page.getByRole("heading", { name: /node operations dashboard/i }),
    ).toBeVisible();
  });

  test("unauthenticated visit to /admin/dashboard redirects to /login", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard");
    await page.waitForURL("**/login**", { timeout: 8_000 });
    await expect(
      page.getByRole("heading", { name: /admin login/i }),
    ).toBeVisible();
  });
});
