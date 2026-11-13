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

test("VETNEB badge position across desktop viewports", async ({ page }) => {
  test.setTimeout(90_000);

  for (const width of [1280, 1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/servicios");

    const nav = page.getByRole("navigation", {
      name: "Navegación principal",
    });

    await expect(nav).toBeVisible();

    const clinics = nav.getByRole("button", {
      name: "Clínicas",
      exact: true,
    });

    const logo = nav.getByRole("button", {
      name: "VETNEB",
      exact: true,
    });

    const particulars = nav.getByRole("button", {
      name: "Particulares",
      exact: true,
    });

    await expect(clinics).toBeVisible();
    await expect(logo).toBeVisible();
    await expect(particulars).toBeVisible();

    const labels = (await nav.getByRole("button").allTextContents())
      .map((value) => value.trim());

    const clinicIndex = labels.indexOf("Clínicas");
    const logoIndex = labels.indexOf("VETNEB");
    const particularIndex = labels.indexOf("Particulares");

    expect(clinicIndex).toBeGreaterThanOrEqual(0);
    expect(logoIndex).toBe(clinicIndex + 1);
    expect(particularIndex).toBe(logoIndex + 1);

    const a = await clinics.boundingBox();
    const b = await logo.boundingBox();
    const c = await particulars.boundingBox();

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).not.toBeNull();

    expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + 1);
    expect(b!.x + b!.width).toBeLessThanOrEqual(c!.x + 1);

    const centers = [
      a!.y + a!.height / 2,
      b!.y + b!.height / 2,
      c!.y + c!.height / 2,
    ];

    expect(Math.max(...centers) - Math.min(...centers))
      .toBeLessThanOrEqual(4);

    const geometry = await page.evaluate(() => {
      const header = document.querySelector("header");
      const controls = Array.from(
        header?.querySelectorAll("button") ?? [],
      ).filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      const overlaps = controls.some((first, index) => {
        const a = first.getBoundingClientRect();

        return controls.slice(index + 1).some((second) => {
          if (first.contains(second) || second.contains(first)) {
            return false;
          }

          const b = second.getBoundingClientRect();

          return (
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2
          );
        });
      });

      return {
        overlaps,
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });

    expect(geometry.overlaps).toBe(false);
    expect(geometry.overflow).toBeLessThanOrEqual(0);

    await logo.click();
    await expect(page).toHaveURL(/127\.0\.0\.1:3000\/?$/);
  }
});

test("VETNEB navigation remains responsive", async ({ page }) => {
  test.setTimeout(90_000);

  for (const width of [375, 768, 1024, 1180]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const desktopNav = page.getByRole("navigation", {
      name: "Navegación principal",
    });

    await expect(desktopNav).toBeHidden();

    const toggle = page.getByLabel("Abrir navegación VETNEB");

    const mobileNav = page.getByRole("navigation", {
      name: "Navegación mobile",
    });

    await expect(toggle).toBeVisible();
    await expect(mobileNav).toBeHidden();

    await toggle.click();
    await expect(mobileNav).toBeVisible();

    await expect(
      mobileNav.getByRole("button", {
        name: "Clínicas",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      mobileNav.getByRole("button", {
        name: "Particulares",
        exact: true,
      }),
    ).toBeVisible();

    await toggle.click();
    await expect(mobileNav).toBeHidden();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(0);
  }
});
