import { expect, test, type Locator, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// CMP-12 (RC-017) — scope correction.
//
// This spec's name says "parity" but it measures Clinic against ITSELF. Real,
// valuable Clinic-domain behavior — kept in full below — but never a parity
// contract, and it never opened an Admin session.
//
// Cross-role runtime parity now lives exclusively in `frontend/e2e/clinic/
// shell/clinic-mobile-admin-parity-contract.spec.ts` (Admin measured against
// Clinic in the same run, 6 viewports x 10 clinic surfaces). This file's job
// is Clinic-domain behavior only.
// ─────────────────────────────────────────────────────────────────────────────

const TOLERANCE = 2;

const MOBILE_VIEWPORTS = [
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "android-small-360x800", width: 360, height: 800 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

/**
 * Literal labels of the three mobile toolbar controls. Frozen here because the
 * row's geometry contract below is only meaningful against the exact strings
 * that are painted: a longer label is what pushed the third control out of the
 * card, so a silent relabel must fail this spec instead of quietly re-widening
 * the row.
 */
const TOOLBAR_LABELS = {
  filters: "Filtros",
  refresh: "Actualizar",
  create: "Generar token",
} as const;

/**
 * Strings the mobile toolbar/list band must NOT paint any more. Each of these
 * lives on a node that is retired wholesale below `md`, so "must not paint" is
 * decidable per element. The retired half of the create button's label is NOT
 * in this list: it is a `hidden md:inline` fragment INSIDE a button that stays
 * visible, so no element-level visibility check can express it — the painted
 * label is asserted instead by `expectToolbarRowContained`, which reads
 * `innerText` and therefore sees only what the viewport actually renders.
 */
const MOBILE_RETIRED_TEXT = [
  "Filtros activos",
  "Últimos tokens de la clínica",
  "Tokens particulares de la clínica.",
  "Lista paginada sin scroll interno.",
] as const;

// A dataset of 6 never proves the reserve stayed retired: the highest real
// adaptive capacity these four viewports reach (measured with the
// `trackingLoadError` alert painting, exactly as this spec's own unmocked
// study-tracking fetch always renders it) is 9, at iphone-pro-max-430x932.
// With only 6 rows on offer, `nextButton` is disabled everywhere and
// `expectListBandRecovered`'s `hasNextPage` branch — the one assertion that
// actually re-detects a phantom reserve — never runs. Doubling that measured
// ceiling guarantees a real next page at every viewport, including the one
// with the most room, without hardcoding a pitch or gap literal.
const MOCK_TOKENS_MAX_MEASURED_CAPACITY = 9;
const MOCK_TOKENS = Array.from({ length: MOCK_TOKENS_MAX_MEASURED_CAPACITY * 2 }, (_, index) => {
  const id = index + 1;

  return {
    id,
    clinicId: 10,
    reportId: id % 2 === 0 ? 200 + id : null,
    tokenLast4: String(9000 + id).slice(-4),
    tutorLastName: `Apellido compuesto del tutor ${id} con contenido operativo extenso`,
    petName: `Paciente veterinario ${id} con nombre clínico extenso`,
    petAge: `${id + 1} años y 6 meses`,
    petBreed: "Mestizo de pelo largo con descripción clínica extensa",
    petSex: id % 2 === 0 ? "Hembra" : "Macho",
    petSpecies: id % 2 === 0 ? "Felinos" : "Caninos",
    sampleLocation:
      "Región torácica lateral derecha con múltiples lesiones nodulares",
    sampleEvolution:
      "Evolución subaguda de varias semanas con crecimiento progresivo",
    detailsLesion:
      "Lesión nodular firme, irregular y pigmentada compatible con seguimiento anatomopatológico prioritario.",
    extractionDate: "2026-06-01T00:00:00.000Z",
    shippingDate: "2026-06-02T00:00:00.000Z",
    isActive: id !== 6,
    lastLoginAt: id % 2 === 0 ? "2026-06-05T12:30:00.000Z" : null,
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    createdByAdminId: null,
    createdByClinicUserId: 77,
    hasLinkedReport: id % 2 === 0,
  };
});

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
  mainOverflowY: string;
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
      value: "e2e_test_clinic_session",
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

async function mockClinicTokens(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/particular-tokens",
    async (route) => {
      const request = route.request();

      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }

      const url = new URL(request.url());
      const limit = Number(url.searchParams.get("limit"));
      // R-16 (C6): the fetch limit is now derived from the adaptive
      // rowsPerPage superset (clamp(rowsPerPage * 3, 12, 36)), not a fixed
      // literal -- assert the observable contract (a valid superset bound),
      // not a specific number.
      expect(
        Number.isInteger(limit),
        "limit must be sent as an integer",
      ).toBe(true);
      expect(
        limit,
        "limit must respect the fetch superset fallback",
      ).toBeGreaterThanOrEqual(12);
      expect(
        limit,
        "limit must respect the fetch superset cap",
      ).toBeLessThanOrEqual(36);
      expect(url.searchParams.get("offset")).toBe("0");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: MOCK_TOKENS.length,
          particularTokens: MOCK_TOKENS,
          pagination: { limit, offset: 0 },
        }),
      });
    },
  );
}

async function readLayoutContract(page: Page): Promise<LayoutContract> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    const card = document.querySelector<HTMLElement>("#clinic-particular-tokens");
    const list = document.querySelector<HTMLElement>(
      '[data-clinic-access-list-body="true"]',
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
      mainOverflowY: main ? window.getComputedStyle(main).overflowY : "none",
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
  expect(
    ["auto", "scroll"],
    `${label}: dashboard shell must not be a scroll container`,
  ).not.toContain(metrics.mainOverflowY);
  expect(metrics.hasList, `${label}: inline list present`).toBe(true);
  expect(
    metrics.listClientHeight,
    `${label}: inline list must keep an operable height`,
  ).toBeGreaterThanOrEqual(44);
  expect(
    metrics.listScrollHeight,
    `${label}: token list must not clip hidden overflow`,
  ).toBeLessThanOrEqual(metrics.listClientHeight + TOLERANCE);
  expect(
    ["auto", "scroll"],
    `${label}: token list must not expose vertical scroll`,
  ).not.toContain(metrics.listOverflowY);
  expect(
    metrics.moduleScrollContainers,
    `${label}: tokens module must not contain internal scroll containers`,
  ).toEqual([]);
}

type BoxMetrics = {
  readonly label: string;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
  readonly clientWidth: number;
  readonly scrollWidth: number;
};

type ToolbarGeometry = {
  readonly documentScrollWidth: number;
  readonly documentClientWidth: number;
  readonly container: BoxMetrics;
  readonly toolbar: BoxMetrics;
  readonly gapEffective: number;
  readonly buttons: readonly BoxMetrics[];
};

/**
 * Real geometry of the mobile action row, read off the DOM rather than inferred
 * from a screenshot or from DOM order. `getBoundingClientRect` is the only thing
 * that can prove the three controls are inside the card AND on one line: a
 * control pushed out of the card still renders, still reports `toBeVisible`, and
 * still sits in the right place in the markup.
 */
async function readToolbarGeometry(page: Page): Promise<ToolbarGeometry | null> {
  return page.evaluate(() => {
    const container = document.querySelector<HTMLElement>(
      "#clinic-particular-tokens",
    );
    const toolbar = document.querySelector<HTMLElement>(
      '[data-clinic-access-toolbar="true"]',
    );
    if (!container || !toolbar) return null;

    const measure = (label: string, element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return {
        label,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      };
    };

    // Painted controls only: the filter trigger is `md:hidden` and the metric
    // run is `hidden md:flex`, so exactly one regime answers at any viewport.
    const buttons = Array.from(
      toolbar.querySelectorAll<HTMLElement>("button"),
    ).filter((button) => button.getClientRects().length > 0);

    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      container: measure("container", container),
      toolbar: measure("toolbar", toolbar),
      gapEffective: Number.parseFloat(
        window.getComputedStyle(toolbar).columnGap || "0",
      ),
      // `innerText`, never `textContent`: a control may carry a label fragment
      // that only paints above `md`, and the contract here is about what this
      // viewport actually renders.
      buttons: buttons.map((button) =>
        measure((button.innerText ?? "").trim(), button),
      ),
    };
  });
}

/**
 * The row contract of §9/§10: three controls, one line, fully inside the card,
 * no overflow at any level and no overlap. Every bound is two-sided so a
 * regression on either edge fails, and nothing here is satisfied by clipping.
 */
async function expectToolbarRowContained(page: Page, label: string) {
  // `Actualizar` swaps to `Actualizando...` for the duration of a load, and the
  // card can re-fetch after a resize. Settle on the idle label before measuring:
  // the transient one is WIDER, so measuring it would be a stricter test of a
  // state the contract is not written about.
  await expect(async () => {
    const settling = await readToolbarGeometry(page);
    expect(
      settling?.buttons.map((button) => button.label),
      `${label}: the mobile row paints exactly the three canonical controls`,
    ).toEqual([
      TOOLBAR_LABELS.filters,
      TOOLBAR_LABELS.refresh,
      TOOLBAR_LABELS.create,
    ]);
  }).toPass({ timeout: 10_000 });

  const geometry = await readToolbarGeometry(page);
  expect(geometry, `${label}: toolbar geometry readable`).not.toBeNull();
  const { container, toolbar, buttons } = geometry!;

  // Evidence for the report; also names the failing viewport in CI output.
  console.log(
    `[clinic-tokens toolbar] ${label} ${JSON.stringify(geometry, null, 0)}`,
  );

  expect(
    geometry!.documentScrollWidth,
    `${label}: document horizontal overflow`,
  ).toBeLessThanOrEqual(geometry!.documentClientWidth + TOLERANCE);
  expect(
    container.scrollWidth,
    `${label}: card horizontal overflow`,
  ).toBeLessThanOrEqual(container.clientWidth + TOLERANCE);
  expect(
    toolbar.scrollWidth,
    `${label}: action row horizontal overflow`,
  ).toBeLessThanOrEqual(toolbar.clientWidth + TOLERANCE);

  for (const button of buttons) {
    expect(
      button.left,
      `${label}: ${button.label} starts inside the card`,
    ).toBeGreaterThanOrEqual(container.left - TOLERANCE);
    expect(
      button.right,
      `${label}: ${button.label} ends inside the card`,
    ).toBeLessThanOrEqual(container.right + TOLERANCE);
    expect(
      button.width,
      `${label}: ${button.label} has a real width`,
    ).toBeGreaterThan(0);
    // Truncation check on the control itself: an ellipsised or clipped label
    // overflows its own box even while the row as a whole fits.
    expect(
      button.scrollWidth,
      `${label}: ${button.label} label is clipped inside its own box`,
    ).toBeLessThanOrEqual(button.clientWidth + TOLERANCE);
  }

  // One line, proved by the boxes: every pair overlaps vertically and none
  // overlaps horizontally.
  for (let index = 1; index < buttons.length; index += 1) {
    const previous = buttons[index - 1];
    const current = buttons[index];
    expect(
      Math.min(previous.bottom, current.bottom) -
        Math.max(previous.top, current.top),
      `${label}: ${previous.label} and ${current.label} must share one row`,
    ).toBeGreaterThan(0);
    expect(
      current.left - previous.right,
      `${label}: ${previous.label} and ${current.label} must not overlap`,
    ).toBeGreaterThanOrEqual(-TOLERANCE);
  }
}

/**
 * The vertical half of the same correction: with the list header retired below
 * `md`, the rows must actually OCCUPY the freed band instead of leaving an empty
 * strip behind, and they must do it without clipping themselves against the
 * pitch lock or riding over the pager.
 */
async function expectListBandRecovered(
  page: Page,
  label: string,
  options: { hasNextPage: boolean } = { hasNextPage: false },
) {
  const band = await page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>(
      '[data-clinic-access-toolbar="true"]',
    );
    const panel = document.querySelector<HTMLElement>(
      '[data-clinic-access-list-panel="true"]',
    );
    const header = panel?.firstElementChild as HTMLElement | null;
    const alert = panel?.querySelector<HTMLElement>(':scope > [role="alert"]');
    const body = document.querySelector<HTMLElement>(
      '[data-clinic-access-list-body="true"]',
    );
    const pager = document.querySelector<HTMLElement>(
      '[data-clinic-access-pagination-footer="true"]',
    );
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-clinic-access-mobile-row="true"]',
      ),
    );
    if (!panel || !toolbar || !body || !pager || rows.length === 0) return null;

    return {
      toolbarBottom: toolbar.getBoundingClientRect().bottom,
      headerPaints: header ? header.getClientRects().length > 0 : false,
      panelTop: panel.getBoundingClientRect().top,
      alertHeight:
        alert && alert.getClientRects().length > 0
          ? alert.getBoundingClientRect().height
          : 0,
      bodyTop: body.getBoundingClientRect().top,
      bodyHeight: body.getBoundingClientRect().height,
      firstRowTop: rows[0].getBoundingClientRect().top,
      lastRowBottom: rows[rows.length - 1].getBoundingClientRect().bottom,
      pagerTop: pager.getBoundingClientRect().top,
      rows: rows.map((row) => {
        const rect = row.getBoundingClientRect();
        const action = row.querySelector<HTMLElement>("button");
        const actionRect = action?.getBoundingClientRect() ?? null;
        return {
          top: rect.top,
          bottom: rect.bottom,
          clientHeight: row.clientHeight,
          scrollHeight: row.scrollHeight,
          actionTop: actionRect?.top ?? null,
          actionBottom: actionRect?.bottom ?? null,
          actionLeft: actionRect?.left ?? null,
          actionRight: actionRect?.right ?? null,
          left: rect.left,
          right: rect.right,
        };
      }),
    };
  });

  expect(band, `${label}: list band readable`).not.toBeNull();
  console.log(`[clinic-tokens list] ${label} ${JSON.stringify(band, null, 0)}`);

  expect(
    band!.headerPaints,
    `${label}: the retired list header must not occupy a band`,
  ).toBe(false);

  // No residual empty strip where the header used to be: inside the panel, the
  // only thing allowed between its top edge and the first row is a painted
  // alert (plus the panel's own 1px border). The bound is expressed against the
  // measured alert instead of a fixed number, so it stays exact whether or not
  // the tracking alert is showing.
  expect(
    band!.bodyTop - band!.panelTop - band!.alertHeight,
    `${label}: freed band must be taken by the list, not left empty`,
  ).toBeLessThanOrEqual(1 + TOLERANCE);

  const remainingGap = band!.pagerTop - band!.lastRowBottom;

  expect(
    remainingGap,
    `${label}: the pager must not ride over the last row`,
  ).toBeGreaterThanOrEqual(-TOLERANCE);

  // Structural upper bound: a real next page proves the canvas could still
  // absorb another row, so a phantom reserve (or any regression that returns
  // one) leaves a leftover gap that fits a full row advance. `realStride` is
  // the row's own measured advance (top-to-top of two consecutive rows) —
  // never a literal pitch/gap px, so this holds across every tier and
  // viewport this spec runs.
  if (options.hasNextPage && band!.rows.length >= 2) {
    const advances = band!.rows
      .slice(1)
      .map((row, index) => row.top - band!.rows[index].top);
    const realStride =
      advances.reduce((sum, advance) => sum + advance, 0) / advances.length;

    expect(
      remainingGap,
      `${label}: a next page exists, so leftover space below the last row must not fit another full row (phantom reserve)`,
    ).toBeLessThan(realStride + TOLERANCE);
  }

  for (const [index, row] of band!.rows.entries()) {
    expect(
      row.scrollHeight,
      `${label}: row ${index} content is clipped by the pitch lock`,
    ).toBeLessThanOrEqual(row.clientHeight + TOLERANCE);
    expect(
      row.actionTop,
      `${label}: row ${index} keeps its detail action`,
    ).not.toBeNull();
    expect(
      row.actionTop!,
      `${label}: row ${index} detail action escapes the row on top`,
    ).toBeGreaterThanOrEqual(row.top - TOLERANCE);
    expect(
      row.actionBottom!,
      `${label}: row ${index} detail action escapes the row at the bottom`,
    ).toBeLessThanOrEqual(row.bottom + TOLERANCE);
    expect(
      row.actionRight!,
      `${label}: row ${index} detail action escapes the row on the right`,
    ).toBeLessThanOrEqual(row.right + TOLERANCE);
  }
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

// The mobile pager is centred inside its footer (the Admin mobile grammar,
// `dashboard-pager ... justify-center`); desktop keeps the right-aligned
// footer, which this mobile-only spec never measures. Centring is asserted as
// a two-sided bound on the residual between the controls' centre and the
// panel's centre, so an off-by-one-side regression fails exactly the way the
// previous right-edge bound did.
async function expectFooterBottomCentered(
  footer: Locator,
  controls: Locator,
  panel: Locator,
  label: string,
) {
  await expect(footer, `${label}: footer visible`).toBeVisible();
  await expect(controls, `${label}: controls visible`).toBeVisible();

  const footerBox = await footer.boundingBox();
  const controlsBox = await controls.boundingBox();
  const panelBox = await panel.boundingBox();

  expect(footerBox, `${label}: footer box`).not.toBeNull();
  expect(controlsBox, `${label}: controls box`).not.toBeNull();
  expect(panelBox, `${label}: panel box`).not.toBeNull();

  expect(
    Math.abs(footerBox!.y + footerBox!.height - (panelBox!.y + panelBox!.height)),
    `${label}: footer sits on panel bottom edge`,
  ).toBeLessThanOrEqual(TOLERANCE);
  expect(
    Math.abs(
      controlsBox!.x + controlsBox!.width / 2 - (panelBox!.x + panelBox!.width / 2),
    ),
    `${label}: controls are centred inside the footer`,
  ).toBeLessThanOrEqual(TOLERANCE);
  expect(
    controlsBox!.x - panelBox!.x,
    `${label}: controls stay inside the footer's left edge`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    panelBox!.x + panelBox!.width - (controlsBox!.x + controlsBox!.width),
    `${label}: controls stay inside the footer's right edge`,
  ).toBeGreaterThanOrEqual(0);
}

// `useAdaptiveRowsPerPage` now actually reacts to the measured container
// (PR-FIX-1). Right after the list mounts it can briefly compute a transient
// value from not-yet-updated sub-measurements (row height / header height)
// before a follow-up render settles on the real value, so a naive read can
// catch that transient instead of the converged count. Wait until the count
// stops changing for a few consecutive polls before trusting it.
async function waitForSettledRowCount(
  locator: Locator,
  label: string,
): Promise<number> {
  let previousCount = -1;
  let stableReads = 0;

  await expect(async () => {
    const currentCount = await locator.count();
    if (currentCount === previousCount) {
      stableReads += 1;
    } else {
      previousCount = currentCount;
      stableReads = 0;
    }
    expect(
      stableReads,
      `${label}: adaptive row count must settle (currently ${currentCount})`,
    ).toBeGreaterThanOrEqual(3);
  }).toPass({ timeout: 8_000, intervals: [50] });

  return previousCount;
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`clinic Tokens mobile parity at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setClinicSession(page);
    await mockClinicTokens(page);

    await page.goto("/dashboard?module=tokens");

    const workspace = page
      .locator('[data-dashboard-module-workspace="tokens"]')
      .first();
    const card = page.locator("#clinic-particular-tokens");
    const listPanel = card.locator('[data-clinic-access-list-panel="true"]');
    const tokenRows = card.locator('[data-clinic-access-mobile-row="true"]');
    const detailButtons = card.getByRole("button", {
      name: "Ver detalle",
      exact: true,
    });
    const filtersButton = card.getByRole("button", {
      name: TOOLBAR_LABELS.filters,
      exact: true,
    });
    const refreshButton = card.getByRole("button", {
      name: TOOLBAR_LABELS.refresh,
      exact: true,
    });
    const createButton = card.getByRole("button", {
      name: TOOLBAR_LABELS.create,
      exact: true,
    });
    const pager = card.locator(
      '[data-clinic-access-pagination-footer="true"]',
    );
    const pagerControls = card.locator(
      '[data-clinic-access-pagination-controls="true"]',
    );
    const futureSlots = card.locator(
      '[data-clinic-access-future-slots="true"]',
    );
    const previousButton = pager.getByRole("button", {
      name: "Página anterior",
      exact: true,
    });
    const nextButton = pager.getByRole("button", {
      name: "Página siguiente",
      exact: true,
    });

    await expect(async () => {
      await expect(workspace).toBeVisible();
      await expect(card).toBeVisible();
      await expectClinicMobileNav(page, viewport.name, "tokens");
      await expect(filtersButton).toBeVisible();
      await expect(filtersButton).toBeEnabled();
      await expect(refreshButton).toBeVisible();
      await expect(refreshButton).toBeEnabled();
      await expect(createButton).toBeVisible();
      await expect(createButton).toBeEnabled();
      await expect(pager).toBeVisible();
      await expect(previousButton).toBeVisible();
      await expect(nextButton).toBeVisible();
      await expect(card.getByText(/1[–-]4 de \d+ tokens/)).toHaveCount(0);
      await expect(futureSlots).toBeVisible();
      await expect(card.getByText("Usuarios y roles")).toHaveCount(0);
      await expect(card.getByText("Auditoría")).toHaveCount(0);
      await expect(card.getByText("Mantenimiento")).toHaveCount(0);
    }).toPass({ timeout: 12_000 });

    // `rowsPerPage` is adaptive (useAdaptiveRowsPerPage), not the historical
    // fixed TOKENS_PAGE_SIZE=4 -- assert the observable contract instead of a
    // literal: a positive, settled row count bounded by the mocked dataset,
    // wired consistently to the detail buttons and the pagination footer.
    const rowCount = await waitForSettledRowCount(
      tokenRows,
      `${viewport.name}: initial list`,
    );
    expect(
      rowCount,
      `${viewport.name}: adaptive row count must be positive`,
    ).toBeGreaterThan(0);
    expect(
      rowCount,
      `${viewport.name}: adaptive row count must not exceed the mocked dataset`,
    ).toBeLessThanOrEqual(MOCK_TOKENS.length);
    await expect(detailButtons).toHaveCount(rowCount);

    for (let index = 0; index < rowCount; index += 1) {
      await expect(tokenRows.nth(index)).toBeVisible();
      await expect(detailButtons.nth(index)).toBeVisible();
    }

    const expectedPageCount = Math.ceil(MOCK_TOKENS.length / rowCount);
    await expect(
      pager.getByText(`Página 1 / ${expectedPageCount}`),
    ).toBeVisible();
    if (expectedPageCount > 1) {
      await expect(nextButton).toBeEnabled();
    } else {
      await expect(nextButton).toBeDisabled();
    }

    // The action row is the regression this spec exists to catch: assert its
    // real geometry (card containment, one line, no overflow, no overlap, no
    // per-control clipping) before the looser viewport-edge bounds below.
    await expectToolbarRowContained(page, `${viewport.name}: barra de acciones`);

    // The phantom-reserve regression this spec now checks for is only
    // re-detectable when a next page genuinely exists: assert that
    // precondition by name instead of letting it fail the upper-bound check
    // silently or, worse, pass by never running it.
    const hasNextPage = await nextButton.isEnabled();
    expect(
      hasNextPage,
      `${viewport.name}: MOCK_TOKENS must outnumber the adaptive capacity so the phantom-reserve upper bound below actually runs`,
    ).toBe(true);

    await expectListBandRecovered(page, `${viewport.name}: lista de tokens`, {
      hasNextPage,
    });

    // Retired below `md` by media query, not by unmounting: the nodes stay in
    // the tree for desktop, so the contract is "must not PAINT". Filtering on
    // visibility is what distinguishes that from "must not exist", and a node
    // that starts painting again still fails here.
    for (const retired of MOBILE_RETIRED_TEXT) {
      await expect(
        card.getByText(retired, { exact: true }).filter({ visible: true }),
        `${viewport.name}: "${retired}" must not paint on mobile`,
      ).toHaveCount(0);
    }
    // The retired header's page indicator ("Pág. N"). The pager's own
    // "Página 1 / N" is a different string and must survive, so this is
    // anchored on the badge's exact wording.
    await expect(
      card.getByText(/^Pág\.\s*\d+$/).filter({ visible: true }),
      `${viewport.name}: the list header page badge must not paint on mobile`,
    ).toHaveCount(0);

    await expectHorizontallyUnclipped(
      filtersButton,
      viewport.width,
      `${viewport.name}: ${TOOLBAR_LABELS.filters}`,
    );
    await expectHorizontallyUnclipped(
      refreshButton,
      viewport.width,
      `${viewport.name}: ${TOOLBAR_LABELS.refresh}`,
    );
    await expectHorizontallyUnclipped(
      createButton,
      viewport.width,
      `${viewport.name}: ${TOOLBAR_LABELS.create}`,
    );
    await expectHorizontallyUnclipped(
      pager,
      viewport.width,
      `${viewport.name}: paginador`,
    );
    await expectHorizontallyUnclipped(
      pagerControls,
      viewport.width,
      `${viewport.name}: controles de paginación`,
    );
    await expectHorizontallyUnclipped(
      previousButton,
      viewport.width,
      `${viewport.name}: Página anterior`,
    );
    await expectHorizontallyUnclipped(
      nextButton,
      viewport.width,
      `${viewport.name}: Página siguiente`,
    );
    await expectFooterBottomCentered(
      pager,
      pagerControls,
      listPanel,
      `${viewport.name}: footer de paginación`,
    );

    await expect(card.locator('[data-clinic-access-table="true"]')).toBeHidden();
    await expect(
      card.locator('[data-clinic-access-mobile-list="true"]'),
    ).toBeVisible();
    await expect(
      card.locator('[data-detail-state="selected"], .dashboard-inline-detail'),
    ).toHaveCount(0);

    await expect(async () => {
      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: initial layout`);
    }).toPass({ timeout: 10_000 });

    await detailButtons.nth(1).click();

    await expect(async () => {
      await expect(tokenRows).toHaveCount(rowCount);
      await expect(tokenRows.nth(0)).toBeVisible();
      await expect(tokenRows.nth(1)).toBeVisible();
      await expect(
        card.locator('[data-detail-state="selected"], .dashboard-inline-detail'),
      ).toHaveCount(0);

      const detailDialog = page.locator(
        '[data-clinic-access-detail-dialog="true"]',
      );
      await expect(detailDialog).toBeVisible();
      await expect(
        detailDialog.getByText(
          /Paciente veterinario 2 .* Apellido compuesto del tutor 2/,
        ),
      ).toBeVisible();

      const metrics = await readLayoutContract(page);
      assertNoGlobalOverflow(metrics, `${viewport.name}: modal detail`);
    }).toPass({ timeout: 10_000 });
  });
}
