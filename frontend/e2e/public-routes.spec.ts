import { expect, test, type Page } from "@playwright/test";

// The branded not-found CTAs navigate through an onClick handler (router.push),
// which only runs after React hydrates. Right after a `domcontentloaded`
// navigation the handler may not be attached yet, so the first click can be a
// no-op and the URL stays put. Retry the click until the navigation actually
// happens, mirroring the hydration-probe pattern used elsewhere in the suite
// (see contacto-hydration.spec.ts).
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function clickAndExpectNavigation(
  page: Page,
  name: string,
  expectedUrl: string,
): Promise<void> {
  const control = page.getByRole("button", { name });

  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await expect(async () => {
    await control.click();
    await expect(page).toHaveURL(expectedUrl, { timeout: 500 });
  }).toPass({
    intervals: [50, 100, 250],
    timeout: 5_000,
  });
}

const routes = [
  { path: "/", text: /VETNEB/i },
  { path: "/servicios", text: /servicios/i },
  { path: "/profesionales", text: /profesionales/i },
  { path: "/clinicas", text: /Portal para cl.nicas veterinarias/i },
  { path: "/particulares", text: /Acceda al seguimiento y al informe de su caso con token seguro/i },
  { path: "/contacto", text: /contacto/i },
  { path: "/login", text: /VETNEB|login|acceso/i },
];

for (const route of routes) {
  test(`renders public route ${route.path}`, async ({ page }) => {
    const response = await page.goto(route.path);

    expect(response?.ok(), `${route.path} should return a successful response`).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).toContainText(route.text);
  });
}

test.describe("particulares hero action hierarchy (PR-PUX1)", () => {
  test("renders hero, primary action and next-step zone", async ({ page }) => {
    await page.goto("/particulares");

    await expect(page.locator('[data-particulares-hero="true"]')).toBeVisible();
    await expect(
      page.locator('[data-particulares-primary-action="true"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-particulares-next-step-zone="true"]'),
    ).toBeVisible();
  });

  test("primary action is visible in the first viewport on mobile without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/particulares");

    const primaryAction = page.locator(
      '[data-particulares-primary-action="true"]',
    );
    await expect(primaryAction).toBeVisible();
    await expect(primaryAction).toBeInViewport();

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("particulares mobile no-regression evidence (PR-PUX4)", () => {
  const mobileViewports = [
    { width: 390, height: 844 },
    { width: 360, height: 740 },
  ];

  for (const viewport of mobileViewports) {
    test(`keeps hero, primary action and next-step zone visible without horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/particulares");

      await expect(page.locator('[data-particulares-hero="true"]')).toBeVisible();

      const primaryAction = page.locator(
        '[data-particulares-primary-action="true"]',
      );
      await expect(primaryAction).toBeVisible();
      await expect(primaryAction).toBeInViewport();

      await expect(
        page.locator('[data-particulares-next-step-zone="true"]'),
      ).toBeVisible();

      await expectNoHorizontalOverflow(page);
    });
  }

  test("keeps public navigation to /login reachable from /particulares on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/particulares");

    await expectNoHorizontalOverflow(page);

    await clickAndExpectNavigation(
      page,
      "Inicie sesión en el portal",
      "/login",
    );
  });
});

test("unknown route renders the branded not-found page without mobile overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.setItem("vetneb-theme-mode", "dark-gray");
  });

  const response = await page.goto("/ruta-institucional-inexistente", {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    "dark-gray",
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Página no encontrada",
    }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("VETNEB");
  await expect(
    page.getByRole("button", { name: "Volver al inicio" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ver servicios" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Contactar" }),
  ).toBeVisible();
  const robotsDirectives = await page
    .locator('meta[name="robots"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("content") ?? ""),
    );
  expect(
    robotsDirectives.some((directive) => /noindex/i.test(directive)),
    "not-found must include Next.js automatic noindex",
  ).toBeTruthy();

  for (const prohibited of [
    "DEMO-000",
    "caso demo",
    "datos ficticios",
    "stack trace",
    "Internal Server Error",
  ]) {
    await expect(page.locator("body")).not.toContainText(prohibited);
  }

  await expectNoHorizontalOverflow(page);

  await clickAndExpectNavigation(page, "Ver servicios", "/servicios");

  await page.goto("/ruta-institucional-inexistente", {
    waitUntil: "domcontentloaded",
  });
  await clickAndExpectNavigation(page, "Contactar", "/contacto");

  await page.goto("/ruta-institucional-inexistente", {
    waitUntil: "domcontentloaded",
  });
  await clickAndExpectNavigation(page, "Volver al inicio", "/");
});

test("global metadata publishes one dedicated OpenGraph and Twitter image", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(
    page.locator('meta[property="og:image:width"]'),
  ).toHaveAttribute("content", "1200");
  await expect(
    page.locator('meta[property="og:image:height"]'),
  ).toHaveAttribute("content", "630");
  await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
  await expect(
    page.locator('meta[name="twitter:image:width"]'),
  ).toHaveAttribute("content", "1200");
  await expect(
    page.locator('meta[name="twitter:image:height"]'),
  ).toHaveAttribute("content", "630");

  const openGraphImage = new URL(
    (await page
      .locator('meta[property="og:image"]')
      .getAttribute("content"))!,
  );
  const twitterImage = new URL(
    (await page
      .locator('meta[name="twitter:image"]')
      .getAttribute("content"))!,
  );

  expect(openGraphImage.pathname).toBe("/images/og-vetneb.png");
  expect(twitterImage.pathname).toBe("/images/og-vetneb.png");

  for (const imageUrl of [openGraphImage, twitterImage]) {
    const imageResponse = await request.get(
      `${imageUrl.pathname}${imageUrl.search}`,
    );
    expect(imageResponse.ok()).toBeTruthy();
    expect(imageResponse.headers()["content-type"]).toContain("image/png");

    const bytes = await imageResponse.body();
    expect([...bytes.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  }
});
