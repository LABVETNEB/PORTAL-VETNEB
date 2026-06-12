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

  test("hero compone diagrama estructural del proceso (PR-17)", async ({ page }) => {
    const diagram = page.locator("[data-hero-system-diagram]");
    await expect(diagram).toBeVisible();
    await expect(diagram).toContainText("De la muestra al informe");
    await expect(diagram).toContainText("Muestra");
    await expect(diagram).toContainText("Laboratorio");
    await expect(diagram).toContainText("Evaluación diagnóstica");
    await expect(diagram).toContainText("Informe");
    await expect(diagram).toContainText("Acceso digital");
  });

  test("hero no renderiza términos demo ni datos ficticios (PR-17)", async ({ page }) => {
    const body = page.locator("body");
    const forbiddenTerms = [
      "DEMOSTRATIVO",
      "DEMO-000",
      "DEMO-CLINICA",
      "Paciente demostrativo",
      "clínica demostrativa",
      "sin datos reales",
      "caso demo",
      "datos ficticios",
      "informe simulado",
      "panel operativo simulado",
    ];

    for (const term of forbiddenTerms) {
      await expect(body).not.toContainText(term);
    }
  });

});
