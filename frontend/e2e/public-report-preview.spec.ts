import { expect, test } from "@playwright/test";

test.describe("public pages — no demo/preview content (PR-14/PR-15)", () => {
  test.describe("home page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
    });

    test("no demo badge visible on home page", async ({ page }) => {
      await expect(page.locator("body")).not.toContainText(/DEMOSTRATIVO/i);
      await expect(page.locator("body")).not.toContainText(/No es un informe real/i);
    });

    test("no fictitious patient or case data on home page", async ({ page }) => {
      await expect(page.locator("body")).not.toContainText(/Paciente demostrativo/i);
      await expect(page.locator("body")).not.toContainText(/DEMO-000/i);
      await expect(page.locator("body")).not.toContainText(/Mastocitoma/i);
    });

    test("no report preview section on home page", async ({ page }) => {
      await expect(page.locator("h2#report-preview-heading")).not.toBeVisible();
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

  test.describe("servicios page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/servicios");
      await page.waitForLoadState("domcontentloaded");
    });

    test("no demo badge visible on servicios page", async ({ page }) => {
      await expect(page.locator("body")).not.toContainText(/DEMOSTRATIVO/i);
      await expect(page.locator("body")).not.toContainText(/Ejemplo visual sin datos reales/i);
    });

    test("no fictitious patient or case data on servicios page", async ({ page }) => {
      await expect(page.locator("body")).not.toContainText(/Paciente demostrativo/i);
      await expect(page.locator("body")).not.toContainText(/DEMO-000/i);
      await expect(page.locator("body")).not.toContainText(/Mastocitoma/i);
    });

    test("no report preview card on servicios page", async ({ page }) => {
      await expect(
        page.locator('article[aria-labelledby="report-preview-card-title"]'),
      ).not.toBeVisible();
    });

    test("preserves servicios hero and categories", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Servicio patológico veterinario");
      await expect(page.locator("body")).toContainText("Estudio anatomopatológico de tejidos");
    });

    test("does not call private APIs", async ({ page }) => {
      const privateCalls: string[] = [];
      page.on("request", (request) => {
        const url = request.url();
        if (/\/api\/(admin|auth|particular)/.test(url)) {
          privateCalls.push(url);
        }
      });

      await page.goto("/servicios");
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

    test("no demo badge visible on clinicas page", async ({ page }) => {
      await expect(page.locator("body")).not.toContainText(/DEMOSTRATIVO/i);
      await expect(page.locator("body")).not.toContainText(/Muestra · Demostrativo/i);
    });

    test("no fictitious patient or clinic data on clinicas page", async ({ page }) => {
      await expect(page.locator("body")).not.toContainText(/Paciente demostrativo/i);
      await expect(page.locator("body")).not.toContainText(/Clínica demostrativa/i);
      await expect(page.locator("body")).not.toContainText(/DEMO-000/i);
    });

    test("no report preview section on clinicas page", async ({ page }) => {
      await expect(
        page.locator("h2#clinicas-report-preview-heading"),
      ).not.toBeVisible();
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
