import { expect, test, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Logistics hub mobile reachability contract.
//
// Two stacked pieces of bottom chrome live on this route below `md`: the role
// bottom nav (`z-65`) and StickyActionBar. Two defects made real controls
// unreachable while every Playwright visibility check still passed:
//
//   1. the bar anchored to the viewport (`fixed bottom-0`), landing UNDER the
//      bottom nav, which swallowed the pointer events of its lowest action row;
//   2. the bar left the flow, so `main` handed its full height to the hub and
//      the lower list's pager rendered underneath the bar.
//
// Visibility is therefore not the contract here — HIT-TESTABILITY is. Each
// assertion resolves `elementFromPoint` at the control's own click point and
// requires the control itself to answer, then performs a REAL click. No
// `force`, no `dispatchEvent`, no keyboard fallback.
//
// A third defect had the same shape and the same blind spot: with every pager
// and action reachable, the two stacked cards could still compress BELOW the
// height of one data row. The canvas is `overflow: hidden`, so the rows were
// clipped silently — measured 45.91 / 38.23 / 5.31 / 0 / 0 px of canvas against
// a ~51px row. `toBeVisible()` cannot see that, so the row contract below is
// geometric: the row must be fully CONTAINED by its own canvas and answer its
// own hit test, on page 1 and after a real transition to page 2.
// ─────────────────────────────────────────────────────────────────────────────

const MOBILE_VIEWPORTS = [
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
  { name: "android-large-412x915", width: 412, height: 915 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-compact-375x812", width: 375, height: 812 },
  { name: "android-small-360x800", width: 360, height: 800 },
] as const;

const MD_BOUNDARY = { name: "tablet-boundary-768x1024", width: 768, height: 1024 } as const;

const BAR = '[data-sticky-action-bar="true"]';
const VISITS_PAGER = 'nav[aria-label="Paginación de visitas recientes"]';
const PLANS_PAGER = 'nav[aria-label="Paginación de planes recientes"]';
const NEXT = '[data-dashboard-pager-next="true"] button';
const BAR_ACTIONS = ["Ver visitas", "Ver rutas", "Ver métricas"] as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
    // Opt-in deep dataset already shipped by the fixture server: both lists need
    // more than one page for the second-page transition to exist at all.
    {
      name: "e2e_a03_adaptive_pagination",
      value: "1",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function openHub(page: Page) {
  await page.goto("/dashboard/logistica");
  await expect(page.locator(PLANS_PAGER)).toBeVisible({ timeout: 30_000 });
  // A05 publishes the stable reserve on the route's reservation root before
  // first layout; wait for that scoped contract instead of the removed
  // documentElement measurement side effect.
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector<HTMLElement>(".dashboard-main")!)
        .getPropertyValue("--dash-sticky-action-h")
        .trim().length > 0,
    undefined,
    { timeout: 20_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

/** True only when the control itself answers a hit test at its own centre. */
async function isHitTestable(page: Page, selector: string): Promise<string> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    if (!element) return "missing";
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return "zero-box";
    const hit = document.elementFromPoint(
      Math.round(box.x + box.width / 2),
      Math.round(box.y + box.height / 2),
    );
    if (!hit) return "nothing";
    return element.contains(hit) ? "self" : hit.tagName.toLowerCase();
  }, selector);
}

/** Sub-pixel slack: layout rounds, the containment contract must not. */
const ROW_CONTAINMENT_TOLERANCE_PX = 0.5;

type RowObservation = {
  index: number;
  width: number;
  height: number;
  overflowTopPx: number;
  overflowBottomPx: number;
  overflowLeftPx: number;
  overflowRightPx: number;
  hit: string;
};

type CanvasGeometry = {
  canvasHeight: number;
  canvasWidth: number;
  renderedRows: number;
  rows: RowObservation[];
};

/**
 * Geometry of EVERY rendered data row of one list, read against its own canvas.
 *
 * `toBeVisible()` is not enough here: a row clipped by the canvas's
 * `overflow: hidden` still reports visible. Every row the canvas actually
 * rendered — not just the first — must be inside it and must answer
 * `elementFromPoint` at its own centre, or the adaptive cardinality is no
 * longer the measured one.
 */
async function readCanvasGeometry(page: Page, pager: string): Promise<CanvasGeometry | null> {
  return page.evaluate((pagerSelector) => {
    const nav = document.querySelector(pagerSelector);
    if (!nav?.parentElement) return null;
    const canvas = nav.parentElement.querySelector<HTMLElement>(
      '[data-logistics-recent-list-canvas="true"]',
    );
    if (!canvas) return null;

    const canvasBox = canvas.getBoundingClientRect();
    const rows = Array.from(canvas.querySelectorAll<HTMLElement>(".dashboard-list-row"));

    return {
      canvasHeight: canvasBox.height,
      canvasWidth: canvasBox.width,
      renderedRows: rows.length,
      rows: rows.map((row, index) => {
        const rowBox = row.getBoundingClientRect();
        const hitTarget = document.elementFromPoint(
          Math.round(rowBox.x + rowBox.width / 2),
          Math.round(rowBox.y + rowBox.height / 2),
        );

        return {
          index,
          width: rowBox.width,
          height: rowBox.height,
          overflowTopPx: canvasBox.top - rowBox.top,
          overflowBottomPx: rowBox.bottom - canvasBox.bottom,
          overflowLeftPx: canvasBox.left - rowBox.left,
          overflowRightPx: rowBox.right - canvasBox.right,
          hit: !hitTarget
            ? "nothing"
            : row.contains(hitTarget)
              ? "self"
              : hitTarget.tagName.toLowerCase(),
        };
      }),
    };
  }, pager);
}

/**
 * EVERY rendered row must be real, fully inside its canvas and hit-testable.
 * Returns the settled geometry so the run can report what actually converged —
 * the row count is never asserted against a hardcoded number.
 */
async function expectEveryRowReachable(
  page: Page,
  pager: string,
  label: string,
): Promise<CanvasGeometry> {
  let settled: CanvasGeometry | null = null;

  // The canvas re-measures its own page size after paint; poll the geometry
  // instead of sleeping so the contract is read on the settled layout.
  await expect(async () => {
    const geometry = await readCanvasGeometry(page, pager);
    expect(geometry, `${label}: canvas must exist`).not.toBeNull();
    const canvas = geometry as CanvasGeometry;

    expect(canvas.canvasHeight, `${label}: canvas must have height`).toBeGreaterThan(0);
    expect(canvas.renderedRows, `${label}: at least one row rendered`).toBeGreaterThan(0);

    for (const row of canvas.rows) {
      const where = `${label}: row ${row.index + 1}/${canvas.renderedRows}`;
      expect(row.width, `${where}: width`).toBeGreaterThan(0);
      expect(row.height, `${where}: height`).toBeGreaterThan(0);
      expect(
        row.overflowTopPx,
        `${where}: clipped above its canvas`,
      ).toBeLessThanOrEqual(ROW_CONTAINMENT_TOLERANCE_PX);
      expect(
        row.overflowBottomPx,
        `${where}: clipped below its canvas (canvas=${canvas.canvasHeight}px, row=${row.height}px)`,
      ).toBeLessThanOrEqual(ROW_CONTAINMENT_TOLERANCE_PX);
      expect(
        row.overflowLeftPx,
        `${where}: clipped left of its canvas`,
      ).toBeLessThanOrEqual(ROW_CONTAINMENT_TOLERANCE_PX);
      expect(
        row.overflowRightPx,
        `${where}: clipped right of its canvas`,
      ).toBeLessThanOrEqual(ROW_CONTAINMENT_TOLERANCE_PX);
      expect(row.hit, `${where}: must answer its own hit test`).toBe("self");
    }

    settled = canvas;
  }).toPass({ timeout: 15_000 });

  return settled as unknown as CanvasGeometry;
}

/**
 * Records what the adaptive canvas actually converged to. Observability only —
 * no assertion depends on these numbers, so a legitimate future density change
 * moves the log, never the contract.
 */
function reportConvergence(
  viewport: string,
  pages: {
    visitsPage1: CanvasGeometry;
    plansPage1: CanvasGeometry;
    visitsPage2: CanvasGeometry;
    plansPage2: CanvasGeometry;
  },
) {
  const describe = (geometry: CanvasGeometry) =>
    `rows=${geometry.renderedRows} canvas=${geometry.canvasHeight.toFixed(2)}px row=${(
      geometry.rows[0]?.height ?? 0
    ).toFixed(2)}px`;

  console.log(
    `[logistics-convergence] ${viewport} | visits p1 ${describe(pages.visitsPage1)} | visits p2 ${describe(
      pages.visitsPage2,
    )} | plans p1 ${describe(pages.plansPage1)} | plans p2 ${describe(pages.plansPage2)}`,
  );
}

async function expectSecondPageReachable(page: Page, pager: string, label: string) {
  const next = page.locator(`${pager} ${NEXT}`);

  await expect(next, `${label}: next control visible`).toBeVisible();
  await expect(next, `${label}: next control enabled`).toBeEnabled();
  expect(
    await isHitTestable(page, `${pager} ${NEXT}`),
    `${label}: next control must answer its own hit test (not chrome painted over it)`,
  ).toBe("self");

  await next.click();

  await expect(
    page.locator(`${pager} [data-dashboard-pager-state="true"]`),
    `${label}: second page reached by a real click`,
  ).toHaveText(/Página[\s ]*2/);
  await expect(next, `${label}: pager still reachable after paging`).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const html = document.documentElement;
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    return {
      document: html.scrollWidth - html.clientWidth,
      shell: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(overflow.document, `${label}: document horizontal overflow`).toBeLessThanOrEqual(1);
  expect(overflow.shell, `${label}: shell horizontal overflow`).toBeLessThanOrEqual(1);
}

/**
 * Zero document scroll, and no list canvas silently promoted to a scroller.
 * `overflow: hidden` is the contracted mode for the canvas: it must clip, never
 * scroll, or the row contract above would be satisfiable by a hidden scrollbar.
 */
async function expectNoUnauthorizedScroll(page: Page, label: string) {
  const scroll = await page.evaluate(() => {
    const html = document.documentElement;
    return {
      documentVertical: html.scrollHeight - html.clientHeight,
      scrollableCanvases: Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-logistics-recent-list-canvas="true"]',
        ),
      ).filter((canvas) => {
        const overflowY = getComputedStyle(canvas).overflowY;
        return overflowY === "auto" || overflowY === "scroll";
      }).length,
    };
  });

  expect(scroll.documentVertical, `${label}: document vertical scroll`).toBeLessThanOrEqual(1);
  expect(
    scroll.scrollableCanvases,
    `${label}: no list canvas may become an internal scroller`,
  ).toBe(0);
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`logistics hub keeps every bottom control reachable at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setClinicSession(page);
    await openHub(page);

    // 1 · The bar must clear the role bottom nav instead of hiding under it.
    const chrome = await page.evaluate((bar) => {
      const element = document.querySelector(bar)!;
      const nav = document.querySelector(".dashboard-mobile-nav");
      const reservationRoot = document.querySelector<HTMLElement>(".dashboard-main")!;
      const reserveProbe = document.createElement("div");
      reserveProbe.style.cssText =
        "position:absolute;visibility:hidden;block-size:var(--dash-sticky-action-h);";
      reservationRoot.append(reserveProbe);
      const box = element.getBoundingClientRect();
      const reserve = Math.round(reserveProbe.getBoundingClientRect().height);
      reserveProbe.remove();
      return {
        position: getComputedStyle(element).position,
        reserve,
        height: Math.round(box.height),
        overlapWithNav: nav
          ? Math.round(Math.max(0, box.bottom - nav.getBoundingClientRect().top))
          : 0,
      };
    }, BAR);

    expect(chrome.position, `${viewport.name}: bar is out of flow on mobile`).toBe("absolute");
    expect(
      chrome.overlapWithNav,
      `${viewport.name}: action bar must not sit under the role bottom nav`,
    ).toBe(0);
    expect(
      chrome.reserve,
      `${viewport.name}: the shell must reserve the stable bar height`,
    ).toBe(chrome.height);

    // 2 · Every quick action answers its own hit test, and one really navigates.
    for (const action of BAR_ACTIONS) {
      const byLabel = page.locator(`${BAR} button`).filter({ hasText: action }).first();
      await expect(byLabel, `${viewport.name}: "${action}" visible`).toBeVisible();
      await expect(byLabel, `${viewport.name}: "${action}" enabled`).toBeEnabled();
      expect(
        await page.evaluate(
          ({ bar, label }) => {
            const button = Array.from(
              document.querySelectorAll<HTMLElement>(`${bar} button`),
            ).find((candidate) => (candidate.textContent ?? "").includes(label));
            if (!button) return "missing";
            const box = button.getBoundingClientRect();
            const hit = document.elementFromPoint(
              Math.round(box.x + box.width / 2),
              Math.round(box.y + box.height / 2),
            );
            if (!hit) return "nothing";
            return button.contains(hit) ? "self" : hit.tagName.toLowerCase();
          },
          { bar: BAR, label: action },
        ),
        `${viewport.name}: quick action "${action}" must answer its own hit test`,
      ).toBe("self");
    }

    await page.locator(`${BAR} button`).filter({ hasText: "Ver métricas" }).first().click();
    await expect(
      page,
      `${viewport.name}: the lowest quick action really navigates`,
    ).toHaveURL(/\/dashboard\/logistica\/metricas/);

    // 3 · EVERY rendered row of each list is fully inside its own canvas and
    //     hit-testable — on page 1 and after a real transition to page 2. The
    //     row count is whatever the canvas measured; it is never asserted
    //     against a hardcoded number.
    await openHub(page);
    const visitsPage1 = await expectEveryRowReachable(
      page,
      VISITS_PAGER,
      `${viewport.name}: visits rows (page 1)`,
    );
    const plansPage1 = await expectEveryRowReachable(
      page,
      PLANS_PAGER,
      `${viewport.name}: plans rows (page 1)`,
    );

    // 4 · Both hub pagers reach their second page with a real click, and every
    //     row page 2 renders is contained and hit-testable as well.
    await expectSecondPageReachable(page, VISITS_PAGER, `${viewport.name}: visits pager`);
    const visitsPage2 = await expectEveryRowReachable(
      page,
      VISITS_PAGER,
      `${viewport.name}: visits rows (page 2)`,
    );
    await expectSecondPageReachable(page, PLANS_PAGER, `${viewport.name}: plans pager`);
    const plansPage2 = await expectEveryRowReachable(
      page,
      PLANS_PAGER,
      `${viewport.name}: plans rows (page 2)`,
    );

    reportConvergence(viewport.name, {
      visitsPage1,
      plansPage1,
      visitsPage2,
      plansPage2,
    });

    await expectNoUnauthorizedScroll(page, viewport.name);
    await expectNoHorizontalOverflow(page, viewport.name);
  });
}

test(`logistics hub keeps the desktop action bar contract at ${MD_BOUNDARY.name}`, async ({
  page,
}) => {
  await page.setViewportSize({ width: MD_BOUNDARY.width, height: MD_BOUNDARY.height });
  await setClinicSession(page);
  await openHub(page);

  const chrome = await page.evaluate((bar) => {
    const reservationRoot = document.querySelector<HTMLElement>(".dashboard-main")!;
    const reserveProbe = document.createElement("div");
    reserveProbe.style.cssText =
      "position:absolute;visibility:hidden;block-size:var(--dash-sticky-action-h);";
    reservationRoot.append(reserveProbe);
    const reserve = reserveProbe.getBoundingClientRect().height;
    reserveProbe.remove();

    return {
      position: getComputedStyle(document.querySelector(bar)!).position,
      reserve,
      paddingBlockEnd: Number.parseFloat(getComputedStyle(reservationRoot).paddingBlockEnd),
    };
  }, BAR);

  // From `md` the bar occupies flow, so it must contribute nothing to the ledger.
  expect(chrome.position, `${MD_BOUNDARY.name}: bar stays sticky`).toBe("sticky");
  expect(chrome.reserve, `${MD_BOUNDARY.name}: stable reserve remains declared`).toBeGreaterThan(0);
  expect(
    chrome.paddingBlockEnd,
    `${MD_BOUNDARY.name}: stable reserve is not applied out of mobile`,
  ).toBeLessThan(chrome.reserve);

  for (const action of BAR_ACTIONS) {
    expect(
      await page.evaluate(
        ({ bar, label }) => {
          const button = Array.from(
            document.querySelectorAll<HTMLElement>(`${bar} button`),
          ).find((candidate) => (candidate.textContent ?? "").includes(label));
          if (!button) return "missing";
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(
            Math.round(box.x + box.width / 2),
            Math.round(box.y + box.height / 2),
          );
          if (!hit) return "nothing";
          return button.contains(hit) ? "self" : hit.tagName.toLowerCase();
        },
        { bar: BAR, label: action },
      ),
      `${MD_BOUNDARY.name}: quick action "${action}" hit test`,
    ).toBe("self");
  }

  const visitsPage1 = await expectEveryRowReachable(
    page,
    VISITS_PAGER,
    `${MD_BOUNDARY.name}: visits rows (page 1)`,
  );
  const plansPage1 = await expectEveryRowReachable(
    page,
    PLANS_PAGER,
    `${MD_BOUNDARY.name}: plans rows (page 1)`,
  );

  await expectSecondPageReachable(page, VISITS_PAGER, `${MD_BOUNDARY.name}: visits pager`);
  const visitsPage2 = await expectEveryRowReachable(
    page,
    VISITS_PAGER,
    `${MD_BOUNDARY.name}: visits rows (page 2)`,
  );
  await expectSecondPageReachable(page, PLANS_PAGER, `${MD_BOUNDARY.name}: plans pager`);
  const plansPage2 = await expectEveryRowReachable(
    page,
    PLANS_PAGER,
    `${MD_BOUNDARY.name}: plans rows (page 2)`,
  );

  reportConvergence(MD_BOUNDARY.name, { visitsPage1, plansPage1, visitsPage2, plansPage2 });

  await expectNoUnauthorizedScroll(page, MD_BOUNDARY.name);
  await expectNoHorizontalOverflow(page, MD_BOUNDARY.name);
});
