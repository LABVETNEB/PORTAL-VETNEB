import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);
test.skip(
  ({ browserName }) => browserName !== "chromium" || process.platform !== "linux",
  "Authenticated visual baselines are versioned only for Chromium Linux.",
);

type SessionSurface = "clinic" | "admin";

type RouteCase = {
  name: string;
  path: string;
  session: SessionSurface;
  ready: string;
  mobileReady?: string;
};

const routes: RouteCase[] = [
  {
    name: "dashboard",
    path: "/dashboard",
    session: "clinic",
    ready: '[data-dashboard-module-workspace="operaciones"]',
  },
  {
    name: "admin-dashboard",
    path: "/dashboard/admin",
    session: "admin",
    ready: '[data-dashboard-module-hub="true"]',
    mobileReady: '[data-admin-mobile-hub-launcher="true"]',
  },
];

const viewports = [
  { name: "320", width: 320, height: 720 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1536", width: 1536, height: 960 },
  { name: "1920", width: 1920, height: 1080 },
];

const disableAnimations = `
  *,
  *::before,
  *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
    caret-color: transparent !important;
  }
`;

async function applySession(page: Page, surface: SessionSurface) {
  await page.context().addCookies([
    {
      name: surface === "admin" ? "admin_session_id" : "app_session_id",
      value:
        surface === "admin"
          ? "e2e_populated_admin_session"
          : "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function waitForStableDashboard(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: disableAnimations });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.evaluate(
    async () =>
      Promise.race([
        Promise.all(
          Array.from(document.images)
            .filter((image) => image.loading !== "lazy")
            .filter((image) => !image.complete)
            .map(
              (image) =>
                new Promise<void>((resolve) => {
                  image.addEventListener("load", () => resolve(), {
                    once: true,
                  });
                  image.addEventListener("error", () => resolve(), {
                    once: true,
                  });
                }),
            ),
        ).then(() => undefined),
        new Promise<void>((resolve) => window.setTimeout(resolve, 2_500)),
      ]).then(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve()),
            ),
          ),
      ),
  );
}

async function waitForVisibleReadySelector(page: Page, route: RouteCase) {
  const selectors = [route.ready, route.mobileReady].filter(
    (selector): selector is string => Boolean(selector),
  );

  await expect
    .poll(
      async () =>
        page.evaluate((candidateSelectors) => {
          return candidateSelectors.some((selector) =>
            Array.from(document.querySelectorAll(selector)).some((element) => {
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);

              return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !== "hidden" &&
                style.display !== "none"
              );
            }),
          );
        }, selectors),
      { timeout: 12_000 },
    )
    .toBe(true);
}

for (const viewport of viewports) {
  test.describe(`authenticated visual regression ${viewport.name}`, () => {
    test.use({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
    });

    for (const route of routes) {
      test(`${route.name} baseline`, async ({ page }) => {
        await applySession(page, route.session);

        const response = await page.goto(route.path, {
          timeout: 20_000,
          waitUntil: "domcontentloaded",
        });

        expect(
          response?.ok(),
          `${route.path} should return a successful response`,
        ).toBeTruthy();

        await waitForVisibleReadySelector(page, route);
        await waitForStableDashboard(page);

        await expect(page).toHaveScreenshot(
          `${route.name}-${viewport.name}.png`,
          {
            animations: "disabled",
            caret: "hide",
            fullPage: false,
            maxDiffPixelRatio: 0.001,
          },
        );
      });
    }
  });
}
