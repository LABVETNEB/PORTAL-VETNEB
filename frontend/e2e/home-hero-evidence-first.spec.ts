import { expect, test } from "@playwright/test";

test.describe("home hero — evidence-first (PR-10)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  test("H1 contiene diagnóstico anatomopatológico", async ({ page }) => {
    const h1 = page.locator("h1#hero-heading");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/anatomopatológico/i);
  });

  test("firma profesional Dr. Nicolás E. Barbé visible", async ({ page }) => {
    await expect(page.locator("body")).toContainText("Dr. Nicolás E. Barbé");
    await expect(page.locator("body")).toContainText(/Responsable de diagnóstico/i);
  });

  test("CTA portal de informes presente", async ({ page }) => {
    await expect(page.locator("body")).toContainText("Acceder al portal");
  });

  test("CTA seguimiento con código presente", async ({ page }) => {
    await expect(page.locator("body")).toContainText("Seguir con código");
  });

  test("banda utilitaria fuera del hero contiene horario y WhatsApp", async ({ page }) => {
    await expect(page.locator("body")).toContainText(/lunes a viernes/i);
    await expect(page.locator("body")).toContainText("WhatsApp: 3534138946");
  });

  test.describe("desktop — mock demostrativo y mini timeline visibles", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("mock de informe rotulado DEMOSTRATIVO", async ({ page }) => {
      await expect(page.locator("body")).toContainText(/DEMOSTRATIVO/i);
      await expect(page.locator("body")).toContainText(/No es un informe real/i);
      await expect(page.locator("body")).toContainText("Informe Anatomopatológico");
    });

    test("mini timeline con las 4 etapas", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Recepción");
      await expect(page.locator("body")).toContainText("Procesamiento");
      await expect(page.locator("body")).toContainText("Evaluación");
      await expect(page.locator("body")).toContainText("Informe emitido");
    });
  });
});
