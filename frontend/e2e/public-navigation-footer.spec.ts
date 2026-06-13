import { expect, test } from "@playwright/test";

const primaryDestinations = [
  "Servicios",
  "Profesionales",
  "Clínicas",
  "Precios",
  "Particulares",
  "Contacto",
];

const prohibitedPublicCopy = [
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
];

test("desktop navbar and footer preserve the public information architecture", async ({
  page,
}) => {
  await page.goto("/");

  const desktopNav = page.getByRole("navigation", {
    name: "Navegación principal",
  });
  await expect(desktopNav).toBeVisible();
  await expect(desktopNav).not.toContainText("Diagnóstico");
  await expect(desktopNav).not.toContainText("Operación");
  await expect(desktopNav).not.toContainText("Acceso");

  for (const destination of primaryDestinations) {
    await expect(
      desktopNav.getByRole("button", { name: destination, exact: true }),
    ).toBeVisible();
  }

  const header = page.getByRole("banner");
  await expect(
    header.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await expect(
    header.getByRole("button", { name: "Solicitar acceso", exact: true }),
  ).toBeVisible();

  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText("Navegación");
  await expect(footer).toContainText("Acceso");
  await expect(footer).not.toContainText("Diagnóstico / Servicios");
  await expect(footer).not.toContainText("Operación clínica");
  await expect(footer).toContainText("Blvd. Italia 274 - Villa María - Córdoba");
  await expect(footer).toContainText("Lunes a viernes de 8 a 17hs");
  await expect(footer).toContainText("WhatsApp");
  await expect(footer).toContainText("lab.vetneb@gmail.com");
  await expect(
    footer.getByTitle("Mapa de ubicación de Servicio Patológico VETNEB"),
  ).toHaveCount(1);

  for (const text of prohibitedPublicCopy) {
    await expect(page.locator("body")).not.toContainText(text);
  }
});

test("mobile navigation opens closes and retains public links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const toggle = page.getByLabel("Abrir navegación VETNEB");
  const mobileNav = page.getByRole("navigation", {
    name: "Navegación mobile",
  });

  await expect(mobileNav).not.toBeVisible();
  await toggle.click();
  await expect(mobileNav).toBeVisible();

  for (const destination of primaryDestinations) {
    await expect(
      mobileNav.getByRole("button", { name: destination, exact: true }),
    ).toBeVisible();
  }

  await expect(
    page.getByRole("banner").getByRole("button", {
      name: "Iniciar sesión",
      exact: true,
    }),
  ).toBeVisible();

  await toggle.click();
  await expect(mobileNav).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

const intermediateOverflowRoutes = ["/", "/servicios", "/precios", "/contacto"];

for (const width of [1024, 1180]) {
  test(`public routes have no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const route of intermediateOverflowRoutes) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `${route} must not overflow horizontally at ${width}px`,
      ).toBeLessThanOrEqual(0);
    }
  });
}

test("desktop navbar pill becomes visible at xl width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).toBeVisible();
});

for (const activation of [
  { key: "Enter", width: 1280 },
  { key: "Space", width: 375 },
] as const) {
  test(`keyboard users activate the skip control with ${activation.key}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: activation.width, height: 812 });
    await page.goto("/");

    const skipControl = page.getByRole("button", {
      name: "Saltar al contenido principal",
    });

    const hidden = await skipControl.boundingBox();
    expect(hidden, "skip control must exist in the public layout").not.toBeNull();
    expect(hidden!.y).toBeLessThan(0);

    await page.keyboard.press("Tab");
    await expect(skipControl).toBeFocused();

    const revealed = await skipControl.boundingBox();
    expect(revealed).not.toBeNull();
    expect(revealed!.y).toBeGreaterThanOrEqual(0);
    expect(revealed!.x).toBeGreaterThanOrEqual(0);
    expect(revealed!.x + revealed!.width).toBeLessThanOrEqual(activation.width);

    await page.keyboard.press(activation.key);
    await expect(page.locator("#main-content")).toBeFocused();
    await expect(page.locator("#main-content")).toHaveAttribute(
      "tabindex",
      "-1",
    );

    await page.keyboard.press("Tab");
    await expect(page.locator("#main-content")).not.toBeFocused();
    await expect(page.locator("#main-content")).not.toHaveAttribute("tabindex");

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}
