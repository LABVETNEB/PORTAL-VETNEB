import { expect, test, type Locator, type Page } from "@playwright/test";

const TOLERANCE = 1;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const EXPECTED_MODULES = [
  "Administración",
  "Informes",
  "Estado",
  "Clínicas",
  "Tokens",
  "Precios",
  "Sesiones",
  "Usuarios",
  "Auditoría",
  "Mantenimiento",
] as const;

async function setPopulatedAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_populated_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function suppressNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function expectInsideViewport(
  locator: Locator,
  viewportWidth: number,
  label: string,
) {
  await expect(locator, `${label}: visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label}: bounding box`).not.toBeNull();
  expect(box!.x, `${label}: left edge`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.x + box!.width, `${label}: right edge`).toBeLessThanOrEqual(
    viewportWidth + TOLERANCE,
  );
}

async function expectModule(page: Page, moduleId: string) {
  await expect(
    page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
  ).toBeVisible({ timeout: 15_000 });
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`Admin bottom navigation is complete and no-scroll at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setPopulatedAdminSession(page);
    await page.goto("/dashboard/admin?module=admin-clinics");
    await suppressNextDevIndicator(page);
    await expectModule(page, "admin-clinics");

    const nav = page.locator('[data-admin-mobile-bottom-nav="true"]');
    const destinations = nav.locator('[data-admin-mobile-bottom-nav-item="true"]');

    await expect(nav).toBeVisible();
    await expect(destinations).toHaveCount(5);

    for (let index = 0; index < 5; index += 1) {
      await expectInsideViewport(
        destinations.nth(index),
        viewport.width,
        `${viewport.name}: bottom destination ${index + 1}`,
      );
    }

    const navOverflow = await nav.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(["auto", "scroll"]).not.toContain(navOverflow.overflowX);
    expect(["auto", "scroll"]).not.toContain(navOverflow.overflowY);
    expect(navOverflow.scrollWidth).toBeLessThanOrEqual(
      navOverflow.clientWidth + TOLERANCE,
    );

    await nav.getByRole("button", { name: "Inicio", exact: true }).click();
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toBeVisible({
      timeout: 15_000,
    });

    await nav.getByRole("button", { name: "Clínicas", exact: true }).click();
    await expectModule(page, "admin-clinics");

    await nav.getByRole("button", { name: "Auditoría", exact: true }).click();
    await expectModule(page, "audit-log");

    await nav.getByRole("button", { name: "Sesiones", exact: true }).click();
    await expectModule(page, "admin-sessions");

    await nav.getByRole("button", { name: "Más", exact: true }).click();
    const moduleMenu = page.locator('[data-admin-mobile-module-menu="true"]');
    await expect(moduleMenu).toBeVisible();

    const firstPageLabels = await moduleMenu
      .locator('[data-admin-mobile-module-link="true"]')
      .allTextContents();
    await moduleMenu
      .getByRole("button", { name: "Página siguiente de módulos", exact: true })
      .click();
    const secondPageLabels = await moduleMenu
      .locator('[data-admin-mobile-module-link="true"]')
      .allTextContents();
    const moduleLabels = [...firstPageLabels, ...secondPageLabels].map((label) =>
      label.trim(),
    );
    expect(new Set(moduleLabels)).toEqual(new Set(EXPECTED_MODULES));

    const menuOverflow = await moduleMenu.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { overflowX: style.overflowX, overflowY: style.overflowY };
    });
    expect(["auto", "scroll"]).not.toContain(menuOverflow.overflowX);
    expect(["auto", "scroll"]).not.toContain(menuOverflow.overflowY);
    await moduleMenu
      .getByRole("button", { name: "Cerrar menú de módulos", exact: true })
      .click();

    await page.getByRole("button", { name: "Menú de administración" }).click();
    const kebabMenu = page.locator('[data-admin-mobile-kebab-menu="true"]');
    await expect(kebabMenu).toBeVisible();
    await expect(
      kebabMenu.getByRole("button", { name: "Cerrar sesión", exact: true }),
    ).toHaveCount(1);
    await expect(page.getByText("Salir", { exact: true })).toHaveCount(0);

    await kebabMenu
      .getByRole("button", { name: "Notificaciones", exact: true })
      .click();
    const notificationsPanel = page.locator(
      '[data-admin-mobile-notifications-panel="true"]',
    );
    await expect(notificationsPanel).toBeVisible();
    const notificationScrollContainers = await notificationsPanel.evaluate(
      (panel) =>
        [panel, ...Array.from(panel.querySelectorAll<HTMLElement>("*"))].flatMap(
          (element) => {
            const style = window.getComputedStyle(element);
            return ["auto", "scroll"].includes(style.overflowX) ||
              ["auto", "scroll"].includes(style.overflowY)
              ? [
                  {
                    tag: element.tagName,
                    overflowX: style.overflowX,
                    overflowY: style.overflowY,
                  },
                ]
              : [];
          },
        ),
    );
    expect(notificationScrollContainers).toEqual([]);
    await expect(
      page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
    ).toBeHidden();
  });
}

test("Admin desktop preserves horizontal navigation and desktop actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setPopulatedAdminSession(page);
  await page.goto("/dashboard/admin");

  await expect(
    page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-admin-mobile-bottom-nav="true"]')).toBeHidden();
  await expect(page.locator('[data-theme-toggle="true"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Notificaciones" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión", exact: true }),
  ).toBeVisible();
});
