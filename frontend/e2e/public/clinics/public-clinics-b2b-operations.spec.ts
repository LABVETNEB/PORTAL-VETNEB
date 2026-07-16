import { expect, test } from "@playwright/test";

test.describe("clinicas product landing (PR-20)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/clinicas");
    await page.waitForLoadState("domcontentloaded");
  });

  test.describe("clinic operations section", () => {
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
      await expect(ol.locator("[data-clinic-op-step]")).toHaveCount(5);
    });

    test("centers each operation number over its content on desktop", async ({
      page,
    }) => {
      const steps = page.locator("[data-clinic-op-step]");

      for (const step of await steps.all()) {
        const centerDelta = await step.evaluate((element) => {
          const number = element.querySelector<HTMLElement>(
            "[data-clinic-op-step-number]",
          );
          const content = element.querySelector<HTMLElement>(
            "[data-clinic-op-step-content]",
          );

          if (!number || !content) return null;

          const centerWithinStep = (child: HTMLElement) => {
            let left = 0;
            let current: HTMLElement | null = child;

            while (current && current !== element) {
              left += current.offsetLeft;
              current = current.offsetParent as HTMLElement | null;
            }

            return left + child.offsetWidth / 2;
          };

          return Math.abs(centerWithinStep(number) - centerWithinStep(content));
        });

        expect(centerDelta).not.toBeNull();
        expect(centerDelta ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
      }
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

  test.describe("clinic product modules", () => {
    test("groups all six capabilities into three named modules", async ({
      page,
    }) => {
      const modules = page.locator("[data-clinic-module]");

      await expect(modules).toHaveCount(3);
      await expect(modules.nth(0)).toHaveAttribute(
        "data-clinic-module",
        "informes",
      );
      await expect(modules.nth(1)).toHaveAttribute(
        "data-clinic-module",
        "operacion",
      );
      await expect(modules.nth(2)).toHaveAttribute(
        "data-clinic-module",
        "gestion",
      );

      for (const productModule of await modules.all()) {
        await expect(productModule.locator("article")).toHaveCount(2);
      }
    });

    test("keeps the six existing feature titles visible", async ({ page }) => {
      for (const title of [
        "Recepción de informes",
        "Búsqueda avanzada",
        "Seguimiento de logística",
        "Acceso seguro y auditado",
        "Gestión de usuarios",
        "Perfil público",
      ]) {
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
      }
    });
  });

  test("renders onboarding as four connected steps", async ({ page }) => {
    const onboarding = page.locator(
      'ol[aria-label="Pasos para comenzar con Portal VETNEB"]',
    );

    await expect(onboarding).toBeVisible();
    await expect(
      onboarding.locator("[data-clinic-onboarding-step]"),
    ).toHaveCount(4);
  });

  test.describe("clinic conversion CTAs", () => {
    test("renders conversion heading", async ({ page }) => {
      await expect(
        page.locator("h2#clinicas-conversion-heading"),
      ).toBeVisible();
    });

    test("renders 'Coordiná una derivación' CTA toward contacto", async ({
      page,
    }) => {
      const cta = page.getByRole("button", {
        name: /Coordiná una derivación/i,
      });
      await expect(cta).toBeVisible();
      await cta.click();
      await expect(page).toHaveURL("/contacto");
    });

    test("renders 'Consultar alta de clínica' CTA toward contacto", async ({
      page,
    }) => {
      const cta = page.getByRole("button", {
        name: /Consultar alta de clínica/i,
      });
      await expect(cta).toBeVisible();
      await cta.click();
      await expect(page).toHaveURL("/contacto");
    });
  });

  test.describe("no demo/fictitious content", () => {
    test("does not render B2B wording", async ({ page }) => {
      await expect(page.locator("body")).not.toContainText("B2B");
    });

    test("does not render prohibited demo or fictitious content", async ({
      page,
    }) => {
      const body = page.locator("body");

      for (const prohibitedText of [
        "MUESTRA",
        "DEMOSTRATIVO",
        "ejemplo visual",
        "sin datos reales",
        "caso demo",
        "DEMO-000",
        "DEMO-CLINICA-001",
        "paciente demostrativo",
        "clínica demostrativa",
        "preview de informe simulado",
        "panel operativo simulado",
        "dashboard ficticio",
        "informe inventado",
        "datos ficticios visibles",
        "mocks públicos falsos",
      ]) {
        await expect(body).not.toContainText(prohibitedText);
      }
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

    test("clinicas JSON-LD remains present", async ({ page }) => {
      const jsonLdScripts = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();

      expect(jsonLdScripts.length).toBeGreaterThan(0);
      expect(
        jsonLdScripts.some((content) =>
          content.includes("Portal para Clínicas Veterinarias"),
        ),
      ).toBe(true);

      for (const content of jsonLdScripts) {
        expect(() => JSON.parse(content)).not.toThrow();
      }
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
