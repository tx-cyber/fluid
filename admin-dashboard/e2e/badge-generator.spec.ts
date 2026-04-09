import { expect, test } from "@playwright/test";

test.describe("Badge Generator page (/badge)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/badge");
  });

  test("renders page heading and description", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Badge Generator/i }),
    ).toBeVisible();
    await expect(page.getByText(/Powered by Fluid/i)).toBeVisible();
  });

  test("renders style picker with three options", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Light" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dark" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Minimal" })).toBeVisible();
  });

  test("badge preview img is present", async ({ page }) => {
    const preview = page.getByTestId("badge-preview").locator("img");
    await expect(preview).toBeVisible();

    const src = await preview.getAttribute("src");
    expect(src).toContain("/badge?style=");
  });

  test("changing style updates badge preview URL", async ({ page }) => {
    const preview = page.getByTestId("badge-preview").locator("img");

    await page.getByRole("button", { name: "Dark" }).click();
    const darkSrc = await preview.getAttribute("src");
    expect(darkSrc).toContain("style=dark");

    await page.getByRole("button", { name: "Minimal" }).click();
    const minimalSrc = await preview.getAttribute("src");
    expect(minimalSrc).toContain("style=minimal");

    await page.getByRole("button", { name: "Light" }).click();
    const lightSrc = await preview.getAttribute("src");
    expect(lightSrc).toContain("style=light");
  });

  test("toggling stats checkbox updates badge URL", async ({ page }) => {
    const preview = page.getByTestId("badge-preview").locator("img");

    // Stats on by default
    const srcOn = await preview.getAttribute("src");
    expect(srcOn).toContain("stats=true");

    // Toggle off
    await page.getByRole("checkbox").click();
    const srcOff = await preview.getAttribute("src");
    expect(srcOff).toContain("stats=false");
  });

  test("HTML embed code is displayed", async ({ page }) => {
    await expect(page.getByTestId("embed-html")).toBeVisible();
    await expect(
      page.getByTestId("embed-html").getByText(/<img/),
    ).toBeVisible();
  });

  test("Markdown embed code is displayed", async ({ page }) => {
    await expect(page.getByTestId("embed-md")).toBeVisible();
    await expect(
      page.getByTestId("embed-md").getByText(/!\[Powered by Fluid\]/),
    ).toBeVisible();
  });

  test("direct badge link is present and uses correct URL", async ({ page }) => {
    const link = page.getByTestId("badge-direct-link");
    await expect(link).toBeVisible();

    const href = await link.getAttribute("href");
    expect(href).toContain("/badge?style=");
  });

  test("footer contains Badge Generator link", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(
      footer.getByRole("link", { name: /Badge Generator/i }),
    ).toHaveAttribute("href", "/badge");
  });
});
