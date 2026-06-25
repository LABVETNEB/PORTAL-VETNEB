import { expect, test, type Locator, type Page } from "@playwright/test";

const TOLERANCE = 2;
const LONG_PATIENT_NAME =
  "Paciente con nombre clínico extraordinariamente extenso para validar el detalle mobile";

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
  hasMain: boolean;
  hasList: boolean;
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

async function expectClinicMobileBottomNav(page: Page, label: string) {
  const clinicNav = page.locator('[data-clinic-mobile-bottom-nav="true"]');
  await expect(clinicNav, `${label}: clinic bottom nav visible`).toBeVisible();
  await expect(
    clinicNav.locator('[data-clinic-mobile-bottom-nav-item="true"]'),
    `${label}: clinic bottom nav item count`,
  ).toHaveCount(6);
  await expect(
    page.locator('[data-admin-mobile-bottom-nav="true"]'),
    `${label}: admin bottom nav absent`,
  ).toHaveCount(0);
  await expect(
    page.locator('[data-dashboard-horizontal-nav-shell="true"]'),
    `${label}: horizontal nav hidden on clinic mobile`,
  ).toBeHidden();
}

async function readLayoutContract(page: Page): Promise<LayoutContract> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const list = document.querySelector<HTMLElement>(".dashboard-inline-scroll");

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
      hasMain: main !== null,
      hasList: list !== null,
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
  expect(metrics.hasList, `${label}: inline list present`).toBe(true);
  expect(
    metrics.listClientHeight,
    `${label}: inline list must keep an operable height`,
  ).toBeGreaterThanOrEqual(44);
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
  test(`clinic Informes populated mobile parity at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setClinicSession(page);

    await page.goto("/dashboard?module=informes");

    const workspace = page
      .locator('[data-dashboard-module-workspace="informes"]')
      .first();
    const card = workspace.locator(
      '[aria-label="Informes recientes de la clínica"]',
    );
    const inlineList = card.locator(".dashboard-inline-scroll");
    const reportRows = inlineList.locator('button[aria-pressed]');
    const fullModuleButton = card.getByRole("button", {
      name: "Abrir módulo completo de informes",
      exact: true,
    });

    await expect(async () => {
      await expect(workspace).toBeVisible();
      await expect(card).toBeVisible();
      await expectClinicMobileBottomNav(page, viewport.name);
      await expect(reportRows).toHaveCount(3);

      for (let index = 0; index < 3; index += 1) {
        await expect(reportRows.nth(index)).toBeVisible();
      }

      await expect(fullModuleButton).toBeVisible();
      await expect(fullModuleButton).toBeEnabled();
    }).toPass({ timeout: 12_000 });

    await expect(card.locator("table")).toHaveCount(0);
    await expectHorizontallyUnclipped(
      fullModuleButton,
      viewport.width,
      `${viewport.name}: full Informes CTA`,
    );

    for (let index = 0; index < 3; index += 1) {
      await expectHorizontallyUnclipped(
        reportRows.nth(index),
        viewport.width,
        `${viewport.name}: report row ${index + 1}`,
      );
    }

    await expect(async () => {
      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: initial layout`);
    }).toPass({ timeout: 10_000 });

    const secondReport = reportRows.nth(1);
    await secondReport.click();

    await expect(async () => {
      await expect(secondReport).toHaveAttribute("aria-expanded", "true");

      const inlineDetail = card.locator('[data-detail-state="selected"]');
      await expect(inlineDetail).toHaveCount(1);
      await expect(inlineDetail).toBeVisible();
      await expect(inlineDetail).toContainText(LONG_PATIENT_NAME);

      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: expanded inline detail`);
    }).toPass({ timeout: 10_000 });
  });
}
