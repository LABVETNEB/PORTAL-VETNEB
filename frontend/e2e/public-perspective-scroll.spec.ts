import { expect, test, type Locator, type Page } from "@playwright/test";

const perspectiveRoutes = ["/", "/servicios", "/clinicas", "/precios", "/contacto"];

type PerspectiveMetrics = {
  rotateXDeg: number;
  transform: string;
  translateZPx: number;
};

async function waitForPerspectiveFrame(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  });
}

async function positionSectionAtProgress(
  page: Page,
  section: Locator,
  progress: number,
) {
  await section.evaluate((element, targetProgress) => {
    const rect = element.getBoundingClientRect();
    const viewportCenter = window.innerHeight / 2;
    const targetCenter =
      viewportCenter + targetProgress * (viewportCenter + rect.height / 2);
    const currentCenter = rect.top + rect.height / 2;

    window.scrollBy(0, currentCenter - targetCenter);
  }, progress);
  await waitForPerspectiveFrame(page);
}

async function readPerspectiveMetrics(section: Locator): Promise<PerspectiveMetrics> {
  return section
    .locator(".public-perspective-section-inner")
    .first()
    .evaluate((element) => {
      const transform = window.getComputedStyle(element).transform;

      if (transform === "none") {
        return { rotateXDeg: 0, transform, translateZPx: 0 };
      }

      const matrix = new DOMMatrixReadOnly(transform);

      return {
        rotateXDeg: Math.atan2(matrix.m23, matrix.m22) * (180 / Math.PI),
        transform,
        translateZPx: matrix.m43,
      };
    });
}

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
    await expect(
      page.getByRole("banner").locator(".public-perspective-section-inner"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("contentinfo").locator(".public-perspective-section-inner"),
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

    const firstSection = page.locator("[data-public-perspective-section]").first();
    await positionSectionAtProgress(page, firstSection, 0.6);
    const mobileMetrics = await readPerspectiveMetrics(firstSection);

    expect(Math.abs(mobileMetrics.rotateXDeg)).toBeLessThan(0.1);
    expect(Math.abs(mobileMetrics.translateZPx)).toBeLessThan(0.1);
  });
}

test("desktop perspective transform changes across visible scroll positions", async ({
  page,
}) => {
  await page.goto("/servicios");

  const section = page.locator(
    '[data-public-perspective-section][data-perspective-intensity="standard"]',
  );

  await positionSectionAtProgress(page, section, 0.55);
  const belowCenter = await readPerspectiveMetrics(section);
  await positionSectionAtProgress(page, section, -0.55);
  const aboveCenter = await readPerspectiveMetrics(section);

  expect(belowCenter.transform).not.toBe(aboveCenter.transform);
  expect(belowCenter.rotateXDeg).toBeGreaterThan(1.5);
  expect(aboveCenter.rotateXDeg).toBeLessThan(-1.5);
  expect(belowCenter.translateZPx).toBeLessThan(-1);
  expect(aboveCenter.translateZPx).toBeLessThan(-1);
});

test("standard and featured sections are perceptible off-center and neutral at center", async ({
  page,
}) => {
  await page.goto("/servicios");

  for (const intensity of ["standard", "featured"] as const) {
    const section = page.locator(
      `[data-public-perspective-section][data-perspective-intensity="${intensity}"]`,
    ).first();

    await positionSectionAtProgress(page, section, 0);
    const centered = await readPerspectiveMetrics(section);
    expect(Math.abs(centered.rotateXDeg), `${intensity} should be neutral at center`).toBeLessThan(
      0.5,
    );

    await positionSectionAtProgress(page, section, 0.6);
    const offCenter = await readPerspectiveMetrics(section);
    expect(
      Math.abs(offCenter.rotateXDeg),
      `${intensity} should be perceptible while still visible`,
    ).toBeGreaterThanOrEqual(1.5);
    expect(Math.abs(offCenter.translateZPx)).toBeGreaterThanOrEqual(30);
    await expect(section).toBeInViewport();
  }
});

test("desktop intensity hierarchy increases real depth", async ({ page }) => {
  await page.goto("/servicios");

  const metricsByIntensity: Record<string, PerspectiveMetrics> = {};

  for (const intensity of ["subtle", "standard", "featured"] as const) {
    const section = page.locator(
      `[data-public-perspective-section][data-perspective-intensity="${intensity}"]`,
    ).first();

    await positionSectionAtProgress(page, section, 0.6);
    metricsByIntensity[intensity] = await readPerspectiveMetrics(section);
  }

  expect(Math.abs(metricsByIntensity.standard.translateZPx)).toBeGreaterThan(
    Math.abs(metricsByIntensity.subtle.translateZPx),
  );
  expect(Math.abs(metricsByIntensity.featured.translateZPx)).toBeGreaterThan(
    Math.abs(metricsByIntensity.standard.translateZPx),
  );
  expect(Math.abs(metricsByIntensity.standard.rotateXDeg)).toBeGreaterThan(
    Math.abs(metricsByIntensity.subtle.rotateXDeg),
  );
  expect(Math.abs(metricsByIntensity.featured.rotateXDeg)).toBeGreaterThan(
    Math.abs(metricsByIntensity.standard.rotateXDeg),
  );
});

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
