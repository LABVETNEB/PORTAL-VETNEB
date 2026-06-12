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
  await expect(desktopNav).toContainText("Diagnóstico");
  await expect(desktopNav).toContainText("Operación");
  await expect(desktopNav).toContainText("Acceso");

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
  await expect(footer).toContainText("Diagnóstico / Servicios");
  await expect(footer).toContainText("Operación clínica");
  await expect(footer).toContainText("Acceso");
  await expect(footer).toContainText("Contacto");
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

test("mobile navigation opens closes and retains links and access actions", async ({
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
    mobileNav.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await expect(
    mobileNav.getByRole("button", { name: "Solicitar acceso", exact: true }),
  ).toBeVisible();

  await toggle.click();
  await expect(mobileNav).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});
