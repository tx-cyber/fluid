import { expect, test } from "@playwright/test";

test.describe("Partner certification — public directory", () => {
  test("shows the certified partners page with hero and partner cards", async ({ page }) => {
    await page.goto("/partners");

    await expect(
      page.getByRole("heading", { name: /Fluid Certified Partners/i }),
    ).toBeVisible();

    // At least one approved partner card should be visible (sample data: AnchorPay)
    await expect(page.getByText("AnchorPay")).toBeVisible();
  });

  test("shows verification banner when ?verify= param matches an approved partner", async ({
    page,
  }) => {
    await page.goto("/partners?verify=partner-001");

    await expect(page.getByText(/AnchorPay.*verified Fluid Certified Partner/i)).toBeVisible();
  });

  test("badge SVG is served for an approved partner", async ({ request }) => {
    const res = await request.get("/api/partners/badge/partner-001");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/svg+xml");
    const body = await res.text();
    expect(body).toContain("AnchorPay");
    expect(body).toContain("Fluid Certified Partner");
  });

  test("badge SVG returns 404 for a non-approved partner", async ({ request }) => {
    const res = await request.get("/api/partners/badge/partner-002");
    expect(res.status()).toBe(404);
  });

  test("verify API returns certified:true for approved partner", async ({ request }) => {
    const res = await request.get("/api/partners/verify/partner-001");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.certified).toBe(true);
    expect(body.projectName).toBe("AnchorPay");
  });

  test("verify API returns 404 for pending partner", async ({ request }) => {
    const res = await request.get("/api/partners/verify/partner-002");
    expect(res.status()).toBe(404);
  });
});

test.describe("Partner certification — application form", () => {
  test("shows the application form page", async ({ page }) => {
    await page.goto("/partners/apply");

    await expect(
      page.getByRole("heading", { name: /Apply for Fluid Certified Partner/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Project name")).toBeVisible();
    await expect(page.getByLabel("Contact email")).toBeVisible();
    await expect(page.getByLabel("Website URL")).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();
  });

  test("submits a new application and shows success state", async ({ page }) => {
    await page.goto("/partners/apply");

    await page.getByLabel("Project name").fill("TestDApp");
    await page.getByLabel("Contact email").fill("test@example.com");
    await page.getByLabel("Website URL").fill("https://testdapp.example");
    await page.getByLabel("Description").fill("A test dApp using Fluid for gasless transactions.");

    await page.getByRole("button", { name: /Submit application/i }).click();

    await expect(page.getByText(/Application submitted/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Partner certification — public API", () => {
  test("POST /api/admin/partners creates a pending application", async ({ request }) => {
    const res = await request.post("/api/admin/partners", {
      data: {
        projectName: "E2E Partner",
        contactEmail: "e2e@example.com",
        websiteUrl: "https://e2e.example",
        description: "Created by e2e test",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("pending");
    expect(body.projectName).toBe("E2E Partner");
    expect(body.id).toBeTruthy();
  });

  test("POST /api/admin/partners returns 400 for missing fields", async ({ request }) => {
    const res = await request.post("/api/admin/partners", {
      data: { projectName: "Incomplete" },
    });
    expect(res.status()).toBe(400);
  });
});
