import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const routes = [
  {
    name: "home",
    path: "/",
    readyText: /VETNEB/i,
  },
  {
    name: "login",
    path: "/login",
    readyText: /VETNEB|login|acceso/i,
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

async function waitForStablePublicPage(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: disableAnimations });
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

for (const viewport of viewports) {
  test.describe(`public visual regression ${viewport.name}`, () => {
    test.use({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
    });

    for (const route of routes) {
      test(`${route.name} baseline`, async ({ page }) => {
        const response = await page.goto(route.path, {
          timeout: 15_000,
          waitUntil: "commit",
        });

        expect(
          response?.ok(),
          `${route.path} should return a successful response`,
        ).toBeTruthy();

        const body = page.locator("body");
        await expect(body).toBeVisible();
        await expect(body).toContainText(route.readyText);
        await waitForStablePublicPage(page);

        await expect(page).toHaveScreenshot(
          `public-${route.name}-${viewport.name}.png`,
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
