import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", text: /VETNEB/i },
  { path: "/servicios", text: /servicios/i },
  { path: "/profesionales", text: /profesionales/i },
  { path: "/clinicas", text: /Portal para cl.nicas veterinarias/i },
  { path: "/particulares", text: /Seguimiento e informe de su caso/i },
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
