import { expect, test, type Locator, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// CMP-12 (RC-017) — scope correction.
//
// This spec's name says "parity" but it measures Clinic against ITSELF: no
// overflow, adaptive row capacity, nav structure, dialog content. That is a
// real, valuable Clinic-domain behavior contract — it is kept in full below —
// but it was never a parity contract and never opened an Admin session.
//
// Cross-role runtime parity (Admin measured against Clinic in the same test
// run, across all 6 canonical viewports and all 10 clinic surfaces) is now
// owned exclusively by `frontend/e2e/clinic/shell/clinic-mobile-admin-parity-
// contract.spec.ts`. Duplicating that comparison here would violate "no
// duplicar test infra" (CMP-12); this file's job is Clinic-domain behavior
// only, not parity.
// ─────────────────────────────────────────────────────────────────────────────

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

// FASE D · the OTHER half of the `table-head-above-md` reserve grammar.
//
// The canvas declares one reserve for two regimes, so a contract that only
// measures below `md` proves half of it: a regression that zeroed the reserve
// everywhere would still pass every mobile assertion while under-reserving the
// head that actually paints from `md` up, putting the surplus on the last row
// and turning the table wrapper into an internal scroller. These two viewports
// are the smallest pair that exercises the `min-width: 768px` branch — the
// breakpoint itself and one tablet above it.
const MD_CONTROL_VIEWPORTS = [
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "tablet-834x1194", width: 834, height: 1194 },
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

// B09 unified navigation contract: every clinic module reaches every other one
// from ONE owner. `/dashboard` used to be the exception — the clinic bottom nav
// returned null there and `DashboardModuleRail` took over — so this surface had
// a different navigation owner than the rest of the role. The bar covers it now
// and the rail is retired, together with its prev/next pager: that pager was a
// SECOND grammar over the same ordered modules, not a destination, so it is not
// reproduced. What the rail actually delivered — the five modules, the deep
// link and `aria-current` — is asserted here against the new owner.
async function expectClinicMobileNav(
  page: Page,
  label: string,
  activeModule: "operaciones" | "informes" | "logistica" | "perfil" | "tokens",
) {
  // `DashboardMobileNav` streams through a Suspense boundary whose fallback
  // mounts a SECOND `DashboardMobileNavBar` carrying the same attributes, so
  // the bare owner can resolve to two nodes while exactly one is painted.
  // Filtering the OWNER keeps every slot/aria-current count below measuring the
  // painted bar; zero visible bars still fail, two still fail on strictness.
  const nav = page
    .locator('[data-dashboard-mobile-nav="clinic"]')
    .filter({ visible: true });
  await expect(nav, `${label}: clinic mobile navigation visible`).toBeVisible();

  for (const moduleId of ["operaciones", "informes", "logistica"] as const) {
    await expect(
      nav.locator(`[data-dashboard-mobile-nav-item="${moduleId}"]`),
      `${label}: navigation exposes ${moduleId}`,
    ).toHaveCount(1);
  }

  // CMP-02: the clinic bar uses the same five-slot primary cut as Admin.
  await expect(
    nav.locator("[data-dashboard-mobile-nav-item]"),
    `${label}: five clinic primary destinations`,
  ).toHaveCount(5);
  await expect(
    nav.locator('[data-dashboard-mobile-nav-item="home"]'),
    `${label}: Inicio preserved`,
  ).toHaveCount(1);

  const currentDestination = ["perfil", "tokens"].includes(activeModule)
    ? "overflow"
    : activeModule;
  await expect(
    nav.locator(`[data-dashboard-mobile-nav-item="${currentDestination}"]`),
    `${label}: active destination marked current`,
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.locator("[aria-current='page']"),
    `${label}: exactly one current destination`,
  ).toHaveCount(1);

  await expect(
    nav.locator('[data-dashboard-mobile-nav-item="overflow"]'),
    `${label}: clinic destination overflow available`,
  ).toHaveCount(1);

  // The retired owners must not come back next to it.
  await expect(
    page.locator("[data-dashboard-module-rail]"),
    `${label}: retired module rail absent`,
  ).toHaveCount(0);
  await expect(
    page.locator('[data-dashboard-mobile-nav="admin"]'),
    `${label}: admin mobile navigation absent`,
  ).toHaveCount(0);
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

/**
 * FASE D · the reserve contract of the informes list canvas, measured.
 *
 * Reads the canvas geometry, the two tokens the capacity engine subtracts, and
 * the head's ACTUAL painted rects in ONE evaluation, so the reserve declared and
 * the geometry it claims to describe can never be compared across two different
 * layouts.
 */
async function readHeadReserveContract(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>(
      '[data-clinic-reports-list-body="true"]',
    );
    const tableWrapper = document.querySelector<HTMLElement>(
      '[data-clinic-reports-table="true"]',
    );
    const thead = tableWrapper?.querySelector<HTMLElement>("thead") ?? null;
    const list = document.querySelector<HTMLElement>(
      '[data-clinic-reports-mobile-list="true"]',
    );
    const pager = document.querySelector<HTMLElement>(
      '[data-dashboard-pager="true"]',
    );

    if (!canvas || !pager) {
      return null;
    }

    const canvasStyle = window.getComputedStyle(canvas);
    // The rows the viewport actually paints: below `md` the mobile list owns
    // them, from `md` up the table body does. Both are read, and the visible
    // one is the one with painted rects — never a width literal in this file.
    const paintedRows = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-clinic-reports-mobile-row="true"], [data-clinic-reports-table-row="true"]',
      ),
    ].filter((row) => row.getClientRects().length > 0);

    const tops = paintedRows.map((row) => row.getBoundingClientRect().top);
    // Top-to-top of consecutive rows: the row's own measured advance, so this
    // contract never restates a pitch or gap literal and holds at every tier.
    const advances = tops.slice(1).map((top, index) => top - tops[index]);

    return {
      reserveAttribute: canvas.getAttribute("data-dashboard-canvas-reserve"),
      reservedToken: canvasStyle.getPropertyValue("--dash-canvas-reserved").trim(),
      rowGapToken: canvasStyle.getPropertyValue("--dash-row-gap").trim(),
      canvasClientHeight: canvas.clientHeight,
      canvasScrollHeight: canvas.scrollHeight,
      tableWrapperDisplay: tableWrapper
        ? window.getComputedStyle(tableWrapper).display
        : "missing",
      theadClientRects: thead?.getClientRects().length ?? -1,
      theadHeight: thead?.getBoundingClientRect().height ?? -1,
      listClientHeight: list?.clientHeight ?? -1,
      listScrollHeight: list?.scrollHeight ?? -1,
      paintedRowCount: paintedRows.length,
      rowAdvance:
        advances.length > 0
          ? advances.reduce((sum, advance) => sum + advance, 0) / advances.length
          : 0,
      lastRowBottom:
        paintedRows.length > 0
          ? paintedRows[paintedRows.length - 1].getBoundingClientRect().bottom
          : 0,
      pagerTop: pager.getBoundingClientRect().top,
      pagerRects: pager.getClientRects().length,
    };
  });
}

/**
 * Below `md` the head paints nothing, so the canvas must charge nothing for it.
 *
 * ASSERTION ORDER IS PART OF THIS CONTRACT. The attribute value is checked LAST
 * and on its own is not the contract at all — it names an intention, and a spec
 * that stopped there would report "wrong string" for a defect whose whole cost
 * is geometric. What runs first is the geometry that intention has to produce:
 * the rows the canvas height can actually hold, the leftover band below the last
 * row while a next page still exists, and only then the two tokens and the
 * declaration that produced them. So a phantom reserve fails here as a
 * measurement — "expected 13 rows, received 11" — before it fails as a name.
 */
async function expectMobileHeadReserveRetired(
  page: Page,
  label: string,
  options: { hasNextPage: boolean },
) {
  const contract = await readHeadReserveContract(page);

  expect(contract, `${label}: canvas and pager present`).not.toBeNull();

  // Premise, true in BOTH states: the head is retired below `md` by media query,
  // not by unmounting, so the node stays in the tree and the contract is "must
  // not PAINT". This is what makes any reserve charged here a phantom.
  expect(
    contract!.tableWrapperDisplay,
    `${label}: the desktop table wrapper must not paint below md`,
  ).toBe("none");
  expect(
    contract!.theadClientRects,
    `${label}: the table head must paint zero client rects below md`,
  ).toBe(0);
  expect(
    contract!.theadHeight,
    `${label}: the table head must occupy no geometry below md`,
  ).toBe(0);

  expect(
    contract!.paintedRowCount,
    `${label}: at least two painted rows are needed to measure a row advance`,
  ).toBeGreaterThanOrEqual(2);
  expect(
    contract!.rowAdvance,
    `${label}: rows must expose a measurable advance`,
  ).toBeGreaterThan(0);

  // Capacity accounting, derived from the canvas and the row's own measured
  // advance rather than from any token literal: with nothing reserved and no
  // gap charged, the rows the canvas paints are exactly the rows its height
  // holds. This is the assertion a phantom reserve fails first.
  //
  // No TOLERANCE inside this floor, deliberately. `TOLERANCE` is slack for a
  // comparison at an EDGE (overflow, overlap), and it is still used that way
  // everywhere else in this file. Here the floor is a discretisation, so slack
  // added before it does not absorb noise — it crosses the next multiple of
  // `rowAdvance` and demands a row the canvas does not actually contain.
  // `canvasClientHeight` is already the browser's own integer layout dimension
  // (the canvas carries zero padding and zero border, so it IS the content
  // box), and `rowAdvance` is measured top-to-top off the painted rows, so
  // both terms are real geometry and the floor must count only rows that fit
  // in it.
  expect(
    contract!.paintedRowCount,
    `${label}: painted rows must match what the canvas height can hold`,
  ).toBe(Math.floor(contract!.canvasClientHeight / contract!.rowAdvance));

  expect(
    contract!.pagerRects,
    `${label}: the pager must stay painted`,
  ).toBeGreaterThan(0);
  expect(
    contract!.pagerTop - contract!.lastRowBottom,
    `${label}: the pager must not ride over the last row`,
  ).toBeGreaterThanOrEqual(-TOLERANCE);

  // Structural upper bound. A real next page proves the canvas could still
  // absorb another row, so any reserve charged for chrome that paints nothing
  // leaves a leftover band that fits a full row advance.
  if (options.hasNextPage) {
    expect(
      contract!.pagerTop - contract!.lastRowBottom,
      `${label}: a next page exists, so the leftover band below the last row must not fit another full row (phantom reserve)`,
    ).toBeLessThan(contract!.rowAdvance + TOLERANCE);
  }

  expect(
    contract!.listScrollHeight,
    `${label}: the mobile list must not clip hidden overflow`,
  ).toBeLessThanOrEqual(contract!.listClientHeight + TOLERANCE);
  expect(
    contract!.canvasScrollHeight,
    `${label}: the rows canvas must not become an internal scroller`,
  ).toBeLessThanOrEqual(contract!.canvasClientHeight + TOLERANCE);

  // The two tokens the capacity engine subtracts, resolved from CSS.
  expect(
    contract!.reservedToken,
    `${label}: a head that paints nothing must be reserved nothing`,
  ).toBe("0px");
  expect(
    contract!.rowGapToken,
    `${label}: mobile rows stack flush, so the canvas must charge no row gap`,
  ).toBe("0px");

  // Last, and only as the name of what produced the geometry above.
  expect(
    contract!.reserveAttribute,
    `${label}: the canvas declares the collapsing reserve grammar`,
  ).toBe("table-head-above-md");

  return contract!;
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
      await expectClinicMobileNav(page, viewport.name, "informes");
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

    // FASE D · the phantom table-head reserve.
    //
    // The upper bound below is only re-detectable while a next page genuinely
    // exists, so the precondition is asserted by name instead of being allowed
    // to pass by never running. The dashboard superset is 100 reports and the
    // largest measured mobile capacity is 16, so this holds by construction.
    const nextPageButton = card.getByRole("button", { name: "Página siguiente" });
    const hasNextPage = await nextPageButton.isEnabled();
    expect(
      hasNextPage,
      `${viewport.name}: the fetched superset must outnumber the adaptive capacity so the phantom-reserve bound below actually runs`,
    ).toBe(true);

    await expectMobileHeadReserveRetired(
      page,
      `${viewport.name}: informes list canvas`,
      { hasNextPage },
    );
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
      const currentReportRowCount = await reportRows.count();

      expect(
        currentReportRowCount,
        `${viewport.name}: modal keeps populated adaptive rows`,
      ).toBeGreaterThanOrEqual(MIN_ADAPTIVE_REPORT_ROWS);
      expect(
        currentReportRowCount,
        `${viewport.name}: modal row count stays within dashboard superset`,
      ).toBeLessThanOrEqual(CLINIC_REPORTS_SUMMARY_SUPERSET_LIMIT);
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

// FASE D · >=md control.
//
// `table-head-above-md` is one declaration with two regimes. Retiring the
// reserve below `md` is only correct while the regime above `md` keeps charging
// it: the head paints there, and under-reserving a head that paints is the
// documented way the surplus lands on the last row and turns the table wrapper
// into an internal scroller. These cases assert the charged half — they do not
// duplicate the mobile geometry, they measure the branch the mobile cases
// cannot reach.
for (const viewport of MD_CONTROL_VIEWPORTS) {
  test(`clinic Informes charges the painted table head at ${viewport.name}`, async ({
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
    const table = card.locator('[data-clinic-reports-table="true"]');

    await expect(async () => {
      await expect(workspace).toBeVisible();
      await expect(card).toBeVisible();
      await expect(table).toBeVisible();
      await expect(table.locator("thead")).toBeVisible();
      await expect(
        card.locator('[data-clinic-reports-mobile-list="true"]'),
      ).toBeHidden();
    }).toPass({ timeout: 12_000 });

    const nextPageButton = card.getByRole("button", { name: "Página siguiente" });
    expect(
      await nextPageButton.isEnabled(),
      `${viewport.name}: the fetched superset must outnumber the adaptive capacity`,
    ).toBe(true);

    await expect(async () => {
      const contract = await readHeadReserveContract(page);
      expect(contract, `${viewport.name}: canvas and pager present`).not.toBeNull();

      expect(
        contract!.tableWrapperDisplay,
        `${viewport.name}: the table wrapper paints from md up`,
      ).toBe("block");
      expect(
        contract!.theadClientRects,
        `${viewport.name}: the table head paints from md up`,
      ).toBeGreaterThan(0);
      expect(
        contract!.theadHeight,
        `${viewport.name}: the painted head occupies real geometry`,
      ).toBeGreaterThan(0);

      // The reserve the engine subtracts and the head the browser paints must
      // be the SAME number — asserted against the measured head, never against
      // a px literal restated here.
      expect(
        Number.parseFloat(contract!.reservedToken),
        `${viewport.name}: the reserve must equal the head it reserves`,
      ).toBeCloseTo(contract!.theadHeight, 1);
      // The collapsed table border is one pixel of advance per extra row; it is
      // charged here and only here, which is the other half of the grammar.
      expect(
        contract!.rowGapToken,
        `${viewport.name}: the collapsed row separator stays charged from md up`,
      ).toBe("1px");

      expect(
        contract!.canvasScrollHeight,
        `${viewport.name}: the rows canvas must not become an internal scroller`,
      ).toBeLessThanOrEqual(contract!.canvasClientHeight + TOLERANCE);
      expect(
        contract!.pagerTop - contract!.lastRowBottom,
        `${viewport.name}: the pager must not ride over the last row`,
      ).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(
        contract!.pagerTop - contract!.lastRowBottom,
        `${viewport.name}: a next page exists, so the leftover band must not fit another full row`,
      ).toBeLessThan(contract!.rowAdvance + TOLERANCE);

      // Last, and only as the name of what produced the geometry above: the
      // SAME single declaration the mobile cases measure in its other regime.
      expect(
        contract!.reserveAttribute,
        `${viewport.name}: one declaration, two regimes`,
      ).toBe("table-head-above-md");

      const metrics = await readLayoutContract(page);
      expect(
        metrics.htmlScrollWidth,
        `${viewport.name}: documentElement horizontal overflow`,
      ).toBeLessThanOrEqual(metrics.htmlClientWidth + TOLERANCE);
      expect(
        metrics.htmlScrollHeight,
        `${viewport.name}: documentElement global scroll`,
      ).toBeLessThanOrEqual(metrics.htmlClientHeight + TOLERANCE);
      expect(
        metrics.bodyScrollHeight,
        `${viewport.name}: body global scroll`,
      ).toBeLessThanOrEqual(metrics.bodyClientHeight + TOLERANCE);
      expect(
        metrics.mainScrollHeight,
        `${viewport.name}: dashboard shell scroll`,
      ).toBeLessThanOrEqual(metrics.mainClientHeight + TOLERANCE);
    }).toPass({ timeout: 12_000 });
  });
}
