import { expect, test, type Locator, type Page } from "@playwright/test";

const TOLERANCE = 2;
const LONG_VISIT_ADDRESS =
  "Avenida de los Diagnósticos Veterinarios Integrales 4850, Torre Norte, Piso 12, Consultorio 1204, Ciudad Autónoma de Buenos Aires";

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

type LayoutContract = {
  htmlScrollWidth: number;
  htmlClientWidth: number;
  htmlScrollHeight: number;
  htmlClientHeight: number;
  bodyScrollWidth: number;
  bodyClientWidth: number;
  bodyScrollHeight: number;
  bodyClientHeight: number;
  mainScrollHeight: number;
  mainClientHeight: number;
  listClientHeight: number;
  listScrollHeight: number;
  listOverflowY: string;
  moduleScrollContainers: Array<{ tag: string; overflowY: string }>;
  hasMain: boolean;
  hasList: boolean;
  hasInlineScroll: boolean;
};

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

// Unified navigation contract: every clinic module (mobile + desktop) uses the
// single shared DashboardModuleRail — there is no separate clinic mobile bottom
// bar and no legacy horizontal tab shell on the main dashboard.
async function expectClinicModuleRail(
  page: Page,
  label: string,
  activeModule: "operaciones" | "informes" | "logistica" | "perfil" | "tokens",
) {
  const rail = page.locator('[data-dashboard-module-rail="true"]');
  await expect(rail, `${label}: module rail visible`).toBeVisible();
  await expect(
    page.locator('[data-dashboard-pager="module"]'),
    `${label}: shared module pager present`,
  ).toBeVisible();

  for (const moduleId of [
    "operaciones",
    "informes",
    "logistica",
    "perfil",
    "tokens",
  ] as const) {
    await expect(
      page.locator(`[data-dashboard-module-rail-item="${moduleId}"]`),
      `${label}: rail exposes ${moduleId}`,
    ).toHaveCount(1);
  }

  await expect(
    page.locator(`[data-dashboard-module-rail-item="${activeModule}"]`),
    `${label}: active module ${activeModule} marked current`,
  ).toHaveAttribute("aria-current", "page");

  await expect(
    rail.locator('[data-dashboard-module-rail-prev="true"]'),
    `${label}: rail prev control present`,
  ).toHaveCount(1);
  await expect(
    rail.locator('[data-dashboard-module-rail-next="true"]'),
    `${label}: rail next control present`,
  ).toHaveCount(1);

  // The removed device-specific navigations must not come back.
  await expect(
    page.locator('[data-clinic-mobile-bottom-nav="true"]'),
    `${label}: legacy clinic bottom nav removed`,
  ).toHaveCount(0);
  await expect(
    page.locator('[data-admin-mobile-bottom-nav="true"]'),
    `${label}: admin bottom nav absent`,
  ).toHaveCount(0);
}

async function readLayoutContract(page: Page): Promise<LayoutContract> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const card = document.querySelector<HTMLElement>(
      '[aria-label="Visitas de campo recientes de la clínica"]',
    );
    const list = document.querySelector<HTMLElement>(
      '[data-clinic-logistics-list-body="true"]',
    );
    const moduleScrollContainers = card
      ? [card, ...Array.from(card.querySelectorAll<HTMLElement>("*"))].flatMap(
          (element) => {
            const style = window.getComputedStyle(element);
            return ["auto", "scroll"].includes(style.overflowY)
              ? [{ tag: element.tagName, overflowY: style.overflowY }]
              : [];
          },
        )
      : [];
    const listStyle = list ? window.getComputedStyle(list) : null;

    return {
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      htmlScrollHeight: html.scrollHeight,
      htmlClientHeight: html.clientHeight,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
      mainScrollHeight: main?.scrollHeight ?? 0,
      mainClientHeight: main?.clientHeight ?? 0,
      listClientHeight: list?.clientHeight ?? 0,
      listScrollHeight: list?.scrollHeight ?? 0,
      listOverflowY: listStyle?.overflowY ?? "missing",
      moduleScrollContainers,
      hasMain: main !== null,
      hasList: list !== null,
      hasInlineScroll: card
        ? card.querySelector(".dashboard-inline-scroll") !== null
        : false,
    };
  });
}

function assertNoGlobalOverflow(metrics: LayoutContract, label: string) {
  expect(metrics.hasMain, `${label}: main.dashboard-main present`).toBe(true);
  expect(
    metrics.htmlScrollWidth,
    `${label}: documentElement horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.htmlClientWidth + TOLERANCE);
  expect(
    metrics.bodyScrollWidth,
    `${label}: body horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.bodyClientWidth + TOLERANCE);
  expect(
    metrics.htmlScrollHeight,
    `${label}: documentElement global scroll`,
  ).toBeLessThanOrEqual(metrics.htmlClientHeight + TOLERANCE);
  expect(
    metrics.bodyScrollHeight,
    `${label}: body global scroll`,
  ).toBeLessThanOrEqual(metrics.bodyClientHeight + TOLERANCE);
  expect(metrics.mainScrollHeight, `${label}: dashboard shell scroll`).toBeLessThanOrEqual(
    metrics.mainClientHeight + TOLERANCE,
  );
  expect(metrics.hasList, `${label}: compact list present`).toBe(true);
  expect(
    metrics.hasInlineScroll,
    `${label}: logistica card must not use .dashboard-inline-scroll`,
  ).toBe(false);
  expect(
    metrics.listClientHeight,
    `${label}: visit list must keep an operable height`,
  ).toBeGreaterThanOrEqual(44);
  expect(
    metrics.listScrollHeight,
    `${label}: visit list must not clip hidden overflow`,
  ).toBeLessThanOrEqual(metrics.listClientHeight + TOLERANCE);
  expect(
    ["auto", "scroll"],
    `${label}: visit list must not expose vertical scroll`,
  ).not.toContain(metrics.listOverflowY);
  expect(
    metrics.moduleScrollContainers,
    `${label}: logistica module must not contain internal scroll containers`,
  ).toEqual([]);
}

async function expectHorizontallyUnclipped(
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

for (const viewport of MOBILE_VIEWPORTS) {
  test(`clinic Logística populated mobile parity at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setClinicSession(page);

    await page.goto("/dashboard?module=logistica");

    const workspace = page
      .locator('[data-dashboard-module-workspace="logistica"]')
      .first();
    const card = workspace.locator(
      '[aria-label="Visitas de campo recientes de la clínica"]',
    );
    const listPanel = card.locator('[data-clinic-logistics-list-panel="true"]');
    const visitRows = card.locator('[data-clinic-logistics-row="true"]');
    const fullModuleButton = card.getByRole("button", {
      name: "Abrir módulo completo de logística",
      exact: true,
    });

    await expect(async () => {
      await expect(workspace).toBeVisible();
      await expect(card).toBeVisible();
      await expectClinicModuleRail(page, viewport.name, "logistica");
      await expect(listPanel).toBeVisible();
      await expect(visitRows).toHaveCount(3);

      for (let index = 0; index < 3; index += 1) {
        await expect(visitRows.nth(index)).toBeVisible();
      }

      await expect(fullModuleButton).toBeVisible();
      await expect(fullModuleButton).toBeEnabled();
    }).toPass({ timeout: 12_000 });

    await expect(card.locator("table")).toHaveCount(0);
    await expect(card.locator(".dashboard-inline-scroll")).toHaveCount(0);
    await expect(
      card.locator('[data-detail-state="selected"], .dashboard-inline-detail'),
    ).toHaveCount(0);
    await expectHorizontallyUnclipped(
      fullModuleButton,
      viewport.width,
      `${viewport.name}: full Logística CTA`,
    );

    for (let index = 0; index < 3; index += 1) {
      await expectHorizontallyUnclipped(
        visitRows.nth(index),
        viewport.width,
        `${viewport.name}: visit row ${index + 1}`,
      );
    }

    await expect(async () => {
      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: initial layout`);
    }).toPass({ timeout: 10_000 });

    await visitRows.nth(1).click();

    await expect(async () => {
      await expect(visitRows).toHaveCount(3);
      await expect(visitRows.nth(1)).toBeVisible();
      await expect(
        card.locator('[data-detail-state="selected"], .dashboard-inline-detail'),
      ).toHaveCount(0);

      const detailDialog = page.locator(
        '[data-clinic-logistics-detail-dialog="true"]',
      );
      await expect(detailDialog).toBeVisible();
      await expect(detailDialog).toContainText(LONG_VISIT_ADDRESS);

      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: modal detail`);
    }).toPass({ timeout: 10_000 });
  });
}
