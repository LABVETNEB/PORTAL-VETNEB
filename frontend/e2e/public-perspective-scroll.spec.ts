import { expect, test } from "@playwright/test";

const perspectiveRoutes = ["/", "/servicios", "/clinicas", "/precios", "/contacto"];

for (const route of perspectiveRoutes) {
  test(`${route} renders perspective sections outside navbar and footer`, async ({
    page,
  }) => {
    const response = await page.goto(route);

    expect(response?.ok(), `${route} should return a successful response`).toBeTruthy();

    const perspectiveSections = page.locator("[data-public-perspective-section]");
    await expect(perspectiveSections.first()).toBeAttached();

    await expect(
      page.getByRole("banner").locator("[data-public-perspective-section]"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("contentinfo").locator("[data-public-perspective-section]"),
    ).toHaveCount(0);
  });

  test(`${route} keeps mobile free of horizontal overflow while scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(route);

    for (const scrollY of [0, 600, 1600, 99999]) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(120);

      const horizontalOverflow = await page.evaluate(() => {
        const documentElement = document.documentElement;

        return documentElement.scrollWidth - documentElement.clientWidth;
      });

      expect(
        horizontalOverflow,
        `${route} must not overflow horizontally at scrollY=${scrollY}`,
      ).toBeLessThanOrEqual(1);
    }
  });
}

test("home keeps several perspective sections readable after scrolling", async ({
  page,
}) => {
  await page.goto("/");

  const perspectiveSections = page.locator("[data-public-perspective-section]");
  expect(await perspectiveSections.count()).toBeGreaterThanOrEqual(4);

  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 2);
  });
  await page.waitForTimeout(200);

  await expect(page.getByRole("heading", { name: "Recorrido de la muestra" })).toBeVisible();

  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(200);

  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("reduced motion disables perspective transforms and marks sections", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();

  await page.goto("/");

  const firstSection = page.locator("[data-public-perspective-section]").first();
  await expect(firstSection).toHaveAttribute(
    "data-perspective-disabled",
    "reduced-motion",
  );

  const innerTransform = await firstSection
    .locator(".public-perspective-section-inner")
    .first()
    .evaluate((element) => window.getComputedStyle(element).transform);

  expect(innerTransform).toBe("none");

  await context.close();
});

test("mobile navbar still opens and closes with perspective sections active", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const toggle = page.getByLabel("Abrir navegación VETNEB");
  const mobileNav = page.getByRole("navigation", { name: "Navegación mobile" });

  await toggle.click();
  await expect(mobileNav).toBeVisible();

  await toggle.click();
  await expect(mobileNav).toBeHidden();
});
