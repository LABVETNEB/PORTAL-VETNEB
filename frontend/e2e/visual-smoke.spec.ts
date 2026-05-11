import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", text: /VETNEB/i },
  { path: "/contacto", text: /contacto/i },
  { path: "/particulares", text: /Acceso para particulares/i },
  { path: "/login", text: /VETNEB|login|acceso/i },
  { path: "/dashboard", text: /dashboard|informes|VETNEB/i },
];

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
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
  }
`;

for (const viewport of viewports) {
  test.describe(`visual smoke ${viewport.name}`, () => {
    for (const route of routes) {
      test(`renders ${route.path}`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        const response = await page.goto(route.path, {
          waitUntil: "domcontentloaded",
        });

        expect(response?.ok(), `${route.path} should return a successful response`).toBeTruthy();

        await page.addStyleTag({ content: disableAnimations });

        const body = page.locator("body");
        await expect(body).toBeVisible();
        await expect(body).toContainText(route.text);

        const box = await body.boundingBox();

        expect(box?.width, `${route.path} should have visible layout width`).toBeGreaterThan(300);
        expect(box?.height, `${route.path} should have visible layout height`).toBeGreaterThan(300);

        const screenshot = await page.screenshot({
          fullPage: true,
          animations: "disabled",
        });

        expect(screenshot.byteLength, `${route.path} should produce a non-empty visual render`).toBeGreaterThan(1000);
        expect(screenshot[0]).toBe(0x89);
        expect(screenshot.subarray(1, 4).toString("ascii")).toBe("PNG");
      });
    }
  });
}