import { type Page, expect, test } from "@playwright/test";

const MOCK_PRICING = {
  success: true,
  categories: [
    {
      category: "CITOLOGÍAS",
      items: [
        { id: 1, studyName: "Citología básica de piel", priceLabel: "$5.000", displayOrder: 1 },
        { id: 2, studyName: "Citología con tinción especial", priceLabel: null, displayOrder: 2 },
      ],
    },
    {
      category: "HISTOPATOLOGÍAS",
      items: [
        { id: 3, studyName: "Biopsia incisional", priceLabel: "$8.000", displayOrder: 1 },
      ],
    },
  ],
};

function mockPricing(page: Page) {
  return page.route("**/api/public/pricing**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_PRICING),
    }),
  );
}

test.describe("precios — actionable pricing conversion layer (PR-11)", () => {
  test("renderiza h1 y CTA de contacto en el hero", async ({ page }) => {
    await mockPricing(page);
    await page.goto("/precios");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1#pricing-page-title")).toBeVisible();
    const heroCta = page.getByRole("button", { name: /consultar por un estudio/i });
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toBeEnabled();
  });

  test("listado dinámico de categorías y estudios se muestra", async ({ page }) => {
    await mockPricing(page);
    await page.goto("/precios");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("CITOLOGÍAS")).toBeVisible();
    await expect(page.getByText("Citología básica de piel")).toBeVisible();
    await expect(page.getByText("$5.000")).toBeVisible();
  });

  test("ítems sin precio muestran etiqueta Consultar y CTA de coordinación", async ({ page }) => {
    await mockPricing(page);
    await page.goto("/precios");
    await page.waitForLoadState("networkidle");

    // "Consultar" pill label visible
    await expect(page.getByText("Consultar").first()).toBeVisible();

    // Consultar band CTA present
    const coordinarCta = page.getByRole("button", { name: /coordinar por contacto/i });
    await expect(coordinarCta).toBeVisible();
    await expect(coordinarCta).toBeEnabled();
  });

  test("cada categoría tiene CTA Consultar este estudio", async ({ page }) => {
    await mockPricing(page);
    await page.goto("/precios");
    await page.waitForLoadState("networkidle");

    const categoryCtaButtons = page.getByRole("button", { name: /consultar este estudio/i });
    const count = await categoryCtaButtons.count();
    // one per category rendered
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      await expect(categoryCtaButtons.nth(i)).toBeEnabled();
    }
  });

  test("estado de carga muestra skeleton visual en lugar de texto plano", async ({ page }) => {
    // Delay the API response to observe the loading skeleton
    await page.route("**/api/public/pricing**", async (route) => {
      await new Promise<void>((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PRICING),
      });
    });

    await page.goto("/precios");

    // Skeleton is visible immediately after load (before API responds)
    await expect(
      page.locator("[data-pricing-skeleton='true']").first(),
    ).toBeVisible({ timeout: 3000 });

    // Old plain text loading message is gone
    await expect(page.getByText("Cargando precios disponibles...")).not.toBeVisible();
  });

  test("estado de error muestra alerta visible", async ({ page }) => {
    await page.route("**/api/public/pricing**", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" }),
    );

    await page.goto("/precios");
    await page.waitForLoadState("networkidle");

    const errorAlert = page.getByRole("alert");
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/no se pudieron cargar los precios/i);
  });

  test("todos los CTAs son accesibles y están habilitados", async ({ page }) => {
    await mockPricing(page);
    await page.goto("/precios");
    await page.waitForLoadState("networkidle");

    const allCtaButtons = page.getByRole("button", { name: /consultar|coordinar/i });
    const count = await allCtaButtons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(allCtaButtons.nth(i)).toBeEnabled();
      await expect(allCtaButtons.nth(i)).toBeVisible();
    }
  });

  test("leyenda de valor incluido está presente", async ({ page }) => {
    await mockPricing(page);
    await page.goto("/precios");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/incluido en cada estudio/i)).toBeVisible();
    await expect(page.getByText(/informe diagnóstico digital/i)).toBeVisible();
    await expect(page.getByText(/acceso al portal/i)).toBeVisible();
  });

  test("no hay llamadas a APIs privadas ni de autenticación", async ({ page }) => {
    const privateCalls: string[] = [];

    page.on("request", (request) => {
      const url = request.url();
      if (/\/api\/(admin|auth|particular)/.test(url)) {
        privateCalls.push(url);
      }
    });

    await mockPricing(page);
    await page.goto("/precios");
    await page.waitForLoadState("networkidle");

    expect(privateCalls).toEqual([]);
  });
});
