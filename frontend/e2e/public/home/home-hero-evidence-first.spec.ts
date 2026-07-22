import { expect, test } from "@playwright/test";

test.describe("home hero — evidence-first (PR-10)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  test("H1 es VETNEB como marca principal del hero", async ({ page }) => {
    const h1 = page.locator("h1#hero-heading");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("VETNEB");
    await expect(page.locator("body")).toContainText(/anatomopatológico/i);
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

  test("hero integra horario y WhatsApp como información operativa", async ({ page }) => {
    await expect(page.locator("body")).toContainText(/lunes a viernes/i);
    await expect(page.locator("body")).toContainText("WhatsApp: 3534138946");
  });

  test("hero presenta marca VETNEB y no contiene diagrama de proceso", async ({ page }) => {
    const hero = page.locator('section[aria-labelledby="hero-heading"]');
    await expect(hero).toContainText("VETNEB");
    await expect(page.locator("[data-hero-system-diagram]")).toHaveCount(0);
    await expect(hero).not.toContainText("De la muestra al informe");
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

test.describe("home hero - production image optimizer (P2)", () => {
  test("hero next/image se sirve por el optimizador sharp con dimensiones reales (P2)", async ({
    page,
  }) => {
    const optimizedResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/_next/image" &&
        url.searchParams.get("url")?.includes("hero-microscope-vetneb") === true
      );
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const optimizedResponse = await optimizedResponsePromise;

    const heroImage = page.getByAltText(
      "Microscopio en laboratorio patológico veterinario",
    );
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveAttribute("src", /\/_next\/image\?/);

    expect(optimizedResponse.status()).toBe(200);
    expect(optimizedResponse.ok()).toBe(true);
    expect(optimizedResponse.headers()["content-type"]).toMatch(/^image\//);

    const optimizedBody = await optimizedResponse.body();
    expect(optimizedBody.byteLength).toBeGreaterThan(0);

    await expect
      .poll(() =>
        heroImage.evaluate((element) => (element as HTMLImageElement).complete),
      )
      .toBe(true);

    const naturalDimensions = await heroImage.evaluate((element) => {
      const image = element as HTMLImageElement;
      return {
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      };
    });

    expect(naturalDimensions.naturalWidth).toBeGreaterThan(0);
    expect(naturalDimensions.naturalHeight).toBeGreaterThan(0);
  });
});
