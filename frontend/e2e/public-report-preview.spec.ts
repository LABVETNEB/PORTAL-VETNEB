import { expect, test } from "@playwright/test";

test.describe("report preview system (PR-13)", () => {
  test.describe("home page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
    });

    test("renders report preview section heading", async ({ page }) => {
      await expect(page.locator("h2#report-preview-heading")).toBeVisible();
      await expect(page.locator("h2#report-preview-heading")).toContainText(
        "Así se entrega la evidencia diagnóstica",
      );
    });

    test("renders MUESTRA · DEMOSTRATIVO badge", async ({ page }) => {
      await expect(page.locator("body")).toContainText(/DEMOSTRATIVO/i);
      await expect(page.locator("body")).toContainText(/Muestra/i);
    });

    test("renders disclaimer — ejemplo visual sin datos reales", async ({ page }) => {
      await expect(page.locator("body")).toContainText(/Ejemplo visual sin datos reales/i);
    });

    test("renders diagnóstico section content", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Diagnóstico");
      await expect(page.locator("body")).toContainText("Mastocitoma");
    });

    test("renders microscopía section", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Microscopía");
      await expect(page.locator("body")).toContainText(/mastocitos/i);
    });

    test("renders comentario section", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Comentario");
      await expect(page.locator("body")).toContainText(/correlación clínico-patológica/i);
    });

    test("renders acceso digital / trazabilidad", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Trazabilidad");
      await expect(page.locator("body")).toContainText("Disponible en portal clínica");
    });

    test("report card uses fictitious data DEMO-000", async ({ page }) => {
      await expect(page.locator("body")).toContainText("DEMO-000");
      await expect(page.locator("body")).toContainText(/Paciente demostrativo/i);
    });

    test("report card does not contain real personal data within the preview article", async ({ page }) => {
      const cardText = await page
        .locator('article[aria-labelledby="report-preview-card-title"]')
        .innerText();
      expect(cardText).not.toMatch(/@[\w.-]+\.[a-z]{2,}/i);
      expect(cardText).not.toMatch(/\+54\s?\d{10}/);
      expect(cardText).not.toMatch(/dni\s*:?\s*\d{7,8}/i);
    });

    test("preserves hero CTAs from PR-10", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Acceder al portal");
      await expect(page.locator("body")).toContainText("Seguir con código");
      await expect(page.locator("body")).toContainText("Dr. Nicolás E. Barbé");
    });

    test("preserves service bento from PR-12", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Estudio Anatomopatológico");
      await expect(page.locator("body")).toContainText("Servicio principal");
    });

    test("preserves specimen journey from PR-12", async ({ page }) => {
      await expect(page.locator("h2#specimen-journey-heading")).toBeVisible();
      await expect(page.locator("body")).toContainText("Recorrido de la muestra");
    });

    test("does not call private APIs", async ({ page }) => {
      const privateCalls: string[] = [];
      page.on("request", (request) => {
        const url = request.url();
        if (/\/api\/(admin|auth|particular)/.test(url)) {
          privateCalls.push(url);
        }
      });

      await page.goto("/");
      await page.waitForLoadState("networkidle");

      expect(privateCalls).toEqual([]);
    });

    test.describe("mobile — no horizontal overflow", () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test("body does not overflow horizontally on mobile", async ({ page }) => {
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
      });
    });
  });

  test.describe("clinicas page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/clinicas");
      await page.waitForLoadState("domcontentloaded");
    });

    test("renders clinicas report preview section heading", async ({ page }) => {
      await expect(page.locator("h2#clinicas-report-preview-heading")).toBeVisible();
      await expect(page.locator("h2#clinicas-report-preview-heading")).toContainText(
        "El informe diagnóstico que recibe tu clínica",
      );
    });

    test("renders MUESTRA · DEMOSTRATIVO badge on clinicas", async ({ page }) => {
      await expect(page.locator("body")).toContainText(/DEMOSTRATIVO/i);
    });

    test("renders diagnóstico and microscopía sections on clinicas", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Diagnóstico");
      await expect(page.locator("body")).toContainText("Microscopía");
    });

    test("preserves clinicas hero CTAs", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Acceder al portal");
      await expect(page.locator("body")).toContainText("Solicitar acceso");
    });

    test("preserves clinicas features section", async ({ page }) => {
      await expect(page.locator("h2#clinicas-features-heading")).toBeVisible();
      await expect(page.locator("body")).toContainText("Recepción de informes");
    });

    test("does not call private APIs", async ({ page }) => {
      const privateCalls: string[] = [];
      page.on("request", (request) => {
        const url = request.url();
        if (/\/api\/(admin|auth|particular)/.test(url)) {
          privateCalls.push(url);
        }
      });

      await page.goto("/clinicas");
      await page.waitForLoadState("networkidle");

      expect(privateCalls).toEqual([]);
    });

    test.describe("mobile — no horizontal overflow", () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test("body does not overflow horizontally on mobile", async ({ page }) => {
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
      });
    });
  });
});
