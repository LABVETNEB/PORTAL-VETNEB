import { expect, test } from "@playwright/test";

test.describe("service bento + specimen journey (PR-12)", () => {
  test.describe("home page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
    });

    test("renders service bento with featured anatomopatológico", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Estudio Anatomopatológico");
      await expect(page.locator("body")).toContainText("Estudio Citológico");
      await expect(page.locator("body")).toContainText("Tinciones Especiales");
      await expect(page.locator("body")).toContainText("Diagnóstico Integral");
      await expect(page.locator("body")).toContainText("Servicio principal");
    });

    test("renders specimen journey section heading", async ({ page }) => {
      await expect(page.locator("h2#specimen-journey-heading")).toBeVisible();
      await expect(page.locator("h2#specimen-journey-heading")).toContainText(
        "Recorrido de la muestra",
      );
    });

    test("narrativa end-to-end unificada — sin sección separada (PR-17)", async ({ page }) => {
      await expect(page.locator("h2#specimen-journey-heading")).toHaveCount(1);
      await expect(page.locator("#how-it-works-heading")).toHaveCount(0);
      await expect(page.locator("body")).toContainText("Cómo funciona");
      await expect(page.locator("body")).toContainText("Trabajar con VETNEB es simple");
      await expect(page.locator("body")).toContainText("Contactanos para empezar");
    });

    test("renders all 5 specimen journey stages", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Toma y fijación");
      await expect(page.locator("body")).toContainText("Envío coordinado");
      await expect(page.locator("body")).toContainText("Recepción y procesamiento");
      await expect(page.locator("body")).toContainText("Evaluación diagnóstica");
      await expect(page.locator("body")).toContainText("Informe digital y acceso");
    });

    test("renders verified protocol data — formol 10% visible", async ({ page }) => {
      await expect(page.locator("body")).toContainText("formol al 10%");
    });

    test("renders verified protocol data — 15 días hábiles visible", async ({ page }) => {
      await expect(page.locator("body")).toContainText("15 días hábiles");
    });

    test("specimen journey ordered list has accessible label", async ({ page }) => {
      const ol = page.locator('ol[aria-label="Etapas del recorrido de la muestra"]');
      await expect(ol).toBeVisible();
    });

    test("centers each journey number over its content on desktop", async ({
      page,
    }) => {
      const stages = page.locator("[data-specimen-stage]");

      for (const stage of await stages.all()) {
        const centerDelta = await stage.evaluate((element) => {
          const number = element.querySelector<HTMLElement>(
            "[data-specimen-stage-number]",
          );
          const content = element.querySelector<HTMLElement>(
            "[data-specimen-stage-content]",
          );

          if (!number || !content) return null;

          const centerWithinStage = (child: HTMLElement) => {
            let left = 0;
            let current: HTMLElement | null = child;

            while (current && current !== element) {
              left += current.offsetLeft;
              current = current.offsetParent as HTMLElement | null;
            }

            return left + child.offsetWidth / 2;
          };

          return Math.abs(
            centerWithinStage(number) - centerWithinStage(content),
          );
        });

        expect(centerDelta).not.toBeNull();
        expect(centerDelta ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
      }
    });

    test("preserves hero CTAs from PR-10", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Acceder al portal");
      await expect(page.locator("body")).toContainText("Seguir con código");
      await expect(page.locator("body")).toContainText("Dr. Nicolás E. Barbé");
    });

    test("preserves services route CTA", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Ver todos los servicios");
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

    test("renders specimen journey section heading", async ({ page }) => {
      await expect(
        page.locator("h2#services-specimen-journey-heading"),
      ).toBeVisible();
      await expect(
        page.locator("h2#services-specimen-journey-heading"),
      ).toContainText("Recorrido de la muestra");
    });

    test("renders all 5 specimen journey stages", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Toma y fijación");
      await expect(page.locator("body")).toContainText("Envío coordinado");
      await expect(page.locator("body")).toContainText("Recepción y procesamiento");
      await expect(page.locator("body")).toContainText("Evaluación diagnóstica");
      await expect(page.locator("body")).toContainText("Informe digital y acceso");
    });

    test("renders verified protocol data — 15 días hábiles visible", async ({ page }) => {
      await expect(page.locator("body")).toContainText("15 días hábiles");
    });

    test("centers each journey number over its content on desktop", async ({
      page,
    }) => {
      const stages = page.locator("[data-specimen-stage]");

      for (const stage of await stages.all()) {
        const centerDelta = await stage.evaluate((element) => {
          const number = element.querySelector<HTMLElement>(
            "[data-specimen-stage-number]",
          );
          const content = element.querySelector<HTMLElement>(
            "[data-specimen-stage-content]",
          );

          if (!number || !content) return null;

          const centerWithinStage = (child: HTMLElement) => {
            let left = 0;
            let current: HTMLElement | null = child;

            while (current && current !== element) {
              left += current.offsetLeft;
              current = current.offsetParent as HTMLElement | null;
            }

            return left + child.offsetWidth / 2;
          };

          return Math.abs(
            centerWithinStage(number) - centerWithinStage(content),
          );
        });

        expect(centerDelta).not.toBeNull();
        expect(centerDelta ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
      }
    });

    test("featured anatomopatológico card visible with eyebrow label", async ({ page }) => {
      await expect(page.locator("body")).toContainText("Servicio principal");
      await expect(page.locator("body")).toContainText(
        "Estudio anatomopatológico de tejidos",
      );
    });

    test("preserves conversion CTAs", async ({ page }) => {
      await expect(page.locator("body")).toContainText(
        "Coordinación diagnóstica para clínicas y profesionales",
      );
      await expect(page.locator("body")).toContainText(
        "Solicitar coordinación diagnóstica",
      );
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
});
