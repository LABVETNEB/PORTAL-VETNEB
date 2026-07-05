import { expect, test, type Locator, type Page } from "@playwright/test";

const TOLERANCE = 2;
const LONG_PATIENT_NAME =
  "Paciente con nombre clínico extraordinariamente extenso para validar el detalle mobile";
const MIN_ADAPTIVE_REPORT_ROWS = 3;
const CLINIC_REPORTS_SUMMARY_SUPERSET_LIMIT = 24;

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
    const card = document.querySelector<HTMLElement>(
      '[aria-label="Informes recientes de la clínica"]',
    );
    const list = document.querySelector<HTMLElement>(
      '[data-clinic-reports-mobile-list="true"]',
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
    `${label}: report list must keep an operable height`,
  ).toBeGreaterThanOrEqual(44);
  expect(
    metrics.listScrollHeight,
    `${label}: report list must not clip hidden overflow`,
  ).toBeLessThanOrEqual(metrics.listClientHeight + TOLERANCE);
  expect(
    ["auto", "scroll"],
    `${label}: report list must not expose vertical scroll`,
  ).not.toContain(metrics.listOverflowY);
  expect(
    metrics.moduleScrollContainers,
    `${label}: informes module must not contain internal scroll containers`,
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

async function assertAdaptiveMobileReportRows({
  mobileList,
  reportRows,
  viewButtons,
  label,
}: {
  mobileList: Locator;
  reportRows: Locator;
  viewButtons: Locator;
  label: string;
}) {
  let rowCount = 0;

  await expect(async () => {
    const currentRowCount = await reportRows.count();
    const currentButtonCount = await viewButtons.count();

    expect(
      currentRowCount,
      `${label}: renders at least the legacy minimum while adapting upward`,
    ).toBeGreaterThanOrEqual(MIN_ADAPTIVE_REPORT_ROWS);
    expect(
      currentRowCount,
      `${label}: visible rows stay within the fetched dashboard superset`,
    ).toBeLessThanOrEqual(CLINIC_REPORTS_SUMMARY_SUPERSET_LIMIT);
    expect(
      currentButtonCount,
      `${label}: each visible row keeps one Ver action`,
    ).toBe(currentRowCount);

    const visibleCapacity = await mobileList.evaluate(
      (list, tolerance) => {
        const firstRow = list.querySelector<HTMLElement>(
          '[data-clinic-reports-mobile-row="true"]',
        );
        const rowHeight = firstRow?.getBoundingClientRect().height ?? 0;

        if (rowHeight <= 0) {
          return 0;
        }

        return Math.floor((list.clientHeight + tolerance) / rowHeight);
      },
      TOLERANCE,
    );

    expect(
      visibleCapacity,
      `${label}: adaptive list exposes measurable row capacity`,
    ).toBeGreaterThanOrEqual(MIN_ADAPTIVE_REPORT_ROWS);
    expect(
      currentRowCount,
      `${label}: row count is bounded by the visible adaptive page`,
    ).toBeLessThanOrEqual(visibleCapacity);

    rowCount = currentRowCount;
  }).toPass({ timeout: 12_000 });

  return rowCount;
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
    const mobileList = card.locator('[data-clinic-reports-mobile-list="true"]');
    const reportRows = card.locator('[data-clinic-reports-mobile-row="true"]');
    const viewButtons = card.getByRole("button", { name: "Ver", exact: true });
    const fullModuleButton = card.getByRole("button", {
      name: "Abrir módulo completo de informes",
      exact: true,
    });

    await expect(async () => {
      await expect(workspace).toBeVisible();
      await expect(card).toBeVisible();
      await expectClinicMobileBottomNav(page, viewport.name);
      await expect(mobileList).toBeVisible();

      await expect(fullModuleButton).toBeVisible();
      await expect(fullModuleButton).toBeEnabled();
    }).toPass({ timeout: 12_000 });

    const adaptiveReportRowCount = await assertAdaptiveMobileReportRows({
      mobileList,
      reportRows,
      viewButtons,
      label: `${viewport.name}: settled layout`,
    });

    await expect(card.locator('[data-clinic-reports-table="true"]')).toBeHidden();
    await expect(
      card.locator('[data-detail-state="selected"], .dashboard-inline-detail'),
    ).toHaveCount(0);
    await expectHorizontallyUnclipped(
      fullModuleButton,
      viewport.width,
      `${viewport.name}: full Informes CTA`,
    );

    for (let index = 0; index < adaptiveReportRowCount; index += 1) {
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

    await viewButtons.nth(1).click();

    await expect(async () => {
      await expect(reportRows).toHaveCount(adaptiveReportRowCount);
      await expect(reportRows.nth(1)).toBeVisible();
      await expect(
        card.locator('[data-detail-state="selected"], .dashboard-inline-detail'),
      ).toHaveCount(0);

      const detailDialog = page.locator(
        '[data-clinic-reports-detail-dialog="true"]',
      );
      await expect(detailDialog).toBeVisible();
      await expect(detailDialog).toContainText(LONG_PATIENT_NAME);

      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: modal detail`);
    }).toPass({ timeout: 10_000 });
  });
}
