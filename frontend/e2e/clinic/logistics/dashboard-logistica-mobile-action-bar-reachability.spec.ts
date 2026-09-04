import { expect, test, type Page } from "@playwright/test";

// CMP-06 retired the extra StickyActionBar from this full route. Its three
// destinations now belong to the single ModuleCard header, so the operational
// contract remains hit-testability and row containment rather than visibility.
const VIEWPORTS = [
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
  { name: "android-large-412x915", width: 412, height: 915 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "iphone-compact-375x812", width: 375, height: 812 },
  { name: "android-small-360x800", width: 360, height: 800 },
  { name: "tablet-boundary-768x1024", width: 768, height: 1024 },
] as const;

const VISITS_PAGER = 'nav[aria-label="Paginación de visitas recientes"]';
const PLANS_PAGER = 'nav[aria-label="Paginación de planes recientes"]';
const NEXT = '[data-dashboard-pager-next="true"] button';
const HEADER_ACTIONS = ["Visitas", "Rutas", "Métricas"] as const;
const ROW_CONTAINMENT_TOLERANCE_PX = 0.5;

type RowObservation = {
  readonly index: number;
  readonly overflowTopPx: number;
  readonly overflowBottomPx: number;
  readonly overflowLeftPx: number;
  readonly overflowRightPx: number;
  readonly hit: string;
};

type CanvasGeometry = {
  readonly canvasHeight: number;
  readonly renderedRows: number;
  readonly rows: readonly RowObservation[];
};

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    { name: "app_session_id", value: "e2e_populated_clinic_session", url: "http://127.0.0.1:3000" },
    { name: "e2e_a03_adaptive_pagination", value: "1", url: "http://127.0.0.1:3000" },
  ]);
}

async function openHub(page: Page) {
  await page.goto("/dashboard/logistica");
  await expect(page.locator('[data-dashboard-module-workspace="logistica-full"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator(PLANS_PAGER)).toBeVisible({ timeout: 30_000 });
}

async function hitResult(page: Page, selector: string): Promise<string> {
  return page.evaluate((target) => {
    const element = document.querySelector<HTMLElement>(target);
    if (!element) return "missing";
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(
      Math.round(box.x + box.width / 2),
      Math.round(box.y + box.height / 2),
    );
    return !hit ? "nothing" : element.contains(hit) ? "self" : hit.tagName.toLowerCase();
  }, selector);
}

async function expectHeaderActionsReachable(page: Page, label: string) {
  for (const action of HEADER_ACTIONS) {
    const control = page
      .locator('section[aria-label="Centro de logística"]')
      .getByRole("button", { name: action, exact: true });
    await expect(control, `${label}: ${action} visible`).toBeVisible();
    await expect(control, `${label}: ${action} enabled`).toBeEnabled();
    const selector = await control.evaluate((element) => {
      const label = element.textContent?.trim() ?? "";
      element.setAttribute("data-e2e-header-action", label);
      return `[data-e2e-header-action="${label}"]`;
    });
    expect(await hitResult(page, selector), `${label}: ${action} answers its hit test`).toBe("self");
  }

  await page
    .locator('section[aria-label="Centro de logística"]')
    .getByRole("button", { name: "Métricas", exact: true })
    .click();
  await expect(page, `${label}: a header action really navigates`).toHaveURL(
    /\/dashboard\/logistica\/metricas/,
  );
}

async function readCanvasGeometry(page: Page, pager: string): Promise<CanvasGeometry | null> {
  return page.evaluate((pagerSelector) => {
    const nav = document.querySelector(pagerSelector);
    const canvas = nav?.parentElement?.querySelector<HTMLElement>(
      '[data-logistics-recent-list-canvas="true"]',
    );
    if (!canvas) return null;
    const canvasBox = canvas.getBoundingClientRect();
    // CMP-08: the row converged on the shared CanonicalOperationalRow
    // primitive (`.dashboard-list-row` retired); identified now by its own
    // data attribute, present on both the visits and plans variants.
    const rows = Array.from(
      canvas.querySelectorAll<HTMLElement>("[data-logistics-recent-row]"),
    );
    return {
      canvasHeight: canvasBox.height,
      renderedRows: rows.length,
      rows: rows.map((row, index) => {
        const box = row.getBoundingClientRect();
        const hit = document.elementFromPoint(
          Math.round(box.x + box.width / 2),
          Math.round(box.y + box.height / 2),
        );
        return {
          index,
          overflowTopPx: canvasBox.top - box.top,
          overflowBottomPx: box.bottom - canvasBox.bottom,
          overflowLeftPx: canvasBox.left - box.left,
          overflowRightPx: box.right - canvasBox.right,
          hit: !hit ? "nothing" : row.contains(hit) ? "self" : hit.tagName.toLowerCase(),
        };
      }),
    };
  }, pager);
}

async function expectEveryRowReachable(page: Page, pager: string, label: string) {
  await expect(async () => {
    const canvas = await readCanvasGeometry(page, pager);
    expect(canvas, `${label}: canvas exists`).not.toBeNull();
    expect(canvas!.canvasHeight, `${label}: canvas has height`).toBeGreaterThan(0);
    expect(canvas!.renderedRows, `${label}: rows render`).toBeGreaterThan(0);
    for (const row of canvas!.rows) {
      const rowLabel = `${label}: row ${row.index + 1}/${canvas!.renderedRows}`;
      expect(row.overflowTopPx, `${rowLabel}: clipped above`).toBeLessThanOrEqual(ROW_CONTAINMENT_TOLERANCE_PX);
      expect(row.overflowBottomPx, `${rowLabel}: clipped below`).toBeLessThanOrEqual(ROW_CONTAINMENT_TOLERANCE_PX);
      expect(row.overflowLeftPx, `${rowLabel}: clipped left`).toBeLessThanOrEqual(ROW_CONTAINMENT_TOLERANCE_PX);
      expect(row.overflowRightPx, `${rowLabel}: clipped right`).toBeLessThanOrEqual(ROW_CONTAINMENT_TOLERANCE_PX);
      expect(row.hit, `${rowLabel}: answers its hit test`).toBe("self");
    }
  }).toPass({ timeout: 15_000 });
}

async function expectSecondPageReachable(page: Page, pager: string, label: string) {
  const next = page.locator(`${pager} ${NEXT}`);
  await expect(next, `${label}: next visible`).toBeVisible();
  await expect(next, `${label}: next enabled`).toBeEnabled();
  await next.click();
  // CMP-09: pager label wording aligned to Admins "Pag. X / Y" (G-010).
  await expect(page.locator(`${pager} [data-dashboard-pager-state="true"]`)).toHaveText(/Pág\.?[\s ]*2/);
  await expectEveryRowReachable(page, pager, `${label}: page 2`);
}

async function expectNoScrollOrOverflow(page: Page, label: string) {
  const geometry = await page.evaluate(() => {
    const html = document.documentElement;
    return {
      horizontal: html.scrollWidth - html.clientWidth,
      vertical: html.scrollHeight - html.clientHeight,
      scrollableCanvases: Array.from(
        document.querySelectorAll<HTMLElement>('[data-logistics-recent-list-canvas="true"]'),
      ).filter((canvas) => ["auto", "scroll"].includes(getComputedStyle(canvas).overflowY)).length,
    };
  });
  expect(geometry.horizontal, `${label}: document horizontal overflow`).toBeLessThanOrEqual(1);
  expect(geometry.vertical, `${label}: document vertical scroll`).toBeLessThanOrEqual(1);
  expect(geometry.scrollableCanvases, `${label}: no list canvas becomes a scroller`).toBe(0);
}

for (const viewport of VIEWPORTS) {
  test(`logistics hub keeps header actions and every row reachable at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setClinicSession(page);
    await openHub(page);
    await expectHeaderActionsReachable(page, viewport.name);

    await openHub(page);
    await expectEveryRowReachable(page, VISITS_PAGER, `${viewport.name}: visits page 1`);
    await expectEveryRowReachable(page, PLANS_PAGER, `${viewport.name}: plans page 1`);
    await expectSecondPageReachable(page, VISITS_PAGER, `${viewport.name}: visits`);
    await expectSecondPageReachable(page, PLANS_PAGER, `${viewport.name}: plans`);
    await expectNoScrollOrOverflow(page, viewport.name);
  });
}
