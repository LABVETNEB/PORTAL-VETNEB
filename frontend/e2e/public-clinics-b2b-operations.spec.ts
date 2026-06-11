import { expect, test } from "@playwright/test";

test.describe("clinicas B2B operations landing (PR-14)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/clinicas");
    await page.waitForLoadState("domcontentloaded");
  });

  test.describe("B2B operations section", () => {
    test("renders 'Cómo opera tu clínica con VETNEB' heading", async ({
      page,
    }) => {
      await expect(
        page.locator("h2#clinicas-operations-heading"),
      ).toBeVisible();
      await expect(
        page.locator("h2#clinicas-operations-heading"),
      ).toContainText("Cómo opera tu clínica con VETNEB");
    });

    test("renders operations step list with accessible label", async ({
      page,
    }) => {
      const ol = page.locator(
        'ol[aria-label="Pasos operativos de derivación con VETNEB"]',
      );
      await expect(ol).toBeVisible();
    });

    test("renders derivación step", async ({ page }) => {
      await expect(page.locator("body")).toContainText(
        "Coordinás la derivación",
      );
    });

    test("renders muestra/envío step", async ({ page }) => {
      await expect(page.locator("body")).toContainText(
        "Enviás la muestra con los datos del caso",
      );
    });

    test("renders recepción y trazabilidad step", async ({ page }) => {
      await expect(page.locator("body")).toContainText(
        "VETNEB registra la recepción",
      );
      await expect(page.locator("body")).toContainText("Trazabilidad");
    });

    test("renders evaluación/procesamiento step", async ({ page }) => {
      await expect(page.locator("body")).toContainText(
        "Procesamos y evaluamos el material",
      );
    });

    test("renders informe digital step", async ({ page }) => {
      await expect(page.locator("body")).toContainText(
        "Tu clínica recibe el informe digital",
      );
    });
  });

  test.describe("B2B conversion CTAs", () => {
    test("renders conversion heading", async ({ page }) => {
      await expect(
        page.locator("h2#clinicas-conversion-heading"),
      ).toBeVisible();
    });

    test("renders 'Coordiná una derivación' CTA toward contacto", async ({
      page,
    }) => {
      const cta = page.locator("a[href='/contacto']", {
        hasText: /Coordiná una derivación/i,
      });
      await expect(cta).toBeVisible();
    });

    test("renders 'Consultar alta de clínica' CTA toward contacto", async ({
      page,
    }) => {
      const cta = page.locator("a[href='/contacto']", {
        hasText: /Consultar alta de clínica/i,
      });
      await expect(cta).toBeVisible();
    });
  });

  test.describe("no demo/fictitious content", () => {
    test("no demo badge present", async ({ page }) => {
      await expect(page.locator("body")).not.toContainText(/DEMOSTRATIVO/i);
      await expect(page.locator("body")).not.toContainText(/Muestra · Demostrativo/i);
    });

    test("no fictitious patient data present", async ({ page }) => {
      await expect(page.locator("body")).not.toContainText(
        /Paciente demostrativo/i,
      );
      await expect(page.locator("body")).not.toContainText(
        /Clínica demostrativa/i,
      );
    });

    test("no DEMO-000 or DEMO-CLINICA case codes present", async ({ page }) => {
      await expect(page.locator("body")).not.toContainText(/DEMO-000/i);
      await expect(page.locator("body")).not.toContainText(/DEMO-CLINICA/i);
    });

    test("no simulated report preview", async ({ page }) => {
      await expect(
        page.locator('article[aria-labelledby="report-preview-card-title"]'),
      ).not.toBeVisible();
    });
  });

  test.describe("preserved content from previous PRs", () => {
    test("hero heading present", async ({ page }) => {
      await expect(page.locator("h1#clinicas-page-title")).toBeVisible();
      await expect(page.locator("h1#clinicas-page-title")).toContainText(
        /portal para clínicas/i,
      );
    });

    test("hero CTAs preserved", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Acceder al portal");
      await expect(page.locator("body")).toContainText("Solicitar acceso");
    });

    test("features section preserved", async ({ page }) => {
      await expect(page.locator("h2#clinicas-features-heading")).toBeVisible();
      await expect(page.locator("body")).toContainText("Recepción de informes");
    });

    test("onboarding steps preserved", async ({ page }) => {
      await expect(page.locator("h2#clinicas-onboarding-heading")).toBeVisible();
    });
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
