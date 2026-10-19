import { expect, test, type Locator, type Page } from "@playwright/test";
import { setClinicSession } from "../../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../helpers/zero-scroll-contract";

const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-short-1366x768", width: 1366, height: 768 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

const PAGE_SCOPE_NOTE =
  "Conteos calculados sobre la página visible, no sobre el total general de visitas.";
const WORKSPACE_HEADER_PX = 40;

// C23b D-A: `sr-only` keeps a 1x1 box, so Playwright's toBeVisible() cannot
// tell painted text from text kept only for assistive technologies.
async function paintOf(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      display: style.display,
      position: style.position,
      flexDirection: style.flexDirection,
      hitTested: hit !== null && (hit === element || element.contains(hit)),
      clipped: element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight,
    };
  });
}

async function expectPageScopeHeader(page: Page, width: number, showing: RegExp, label: string) {
  const surface = page.locator('[data-dashboard-table-surface="true"]');
  const header = surface.locator(":scope > div").first();
  const title = header.locator("h3");
  const note = page.getByText(PAGE_SCOPE_NOTE, { exact: true });
  const [headerPaint, titlePaint, notePaint] = await Promise.all([paintOf(header), paintOf(title), paintOf(note)]);

  expect(notePaint.hitTested, `${label}: the page-scope note is painted on top`).toBe(true);
  expect(notePaint.position, `${label}: the page-scope note is in flow`).toBe("static");
  expect(notePaint.width, `${label}: the page-scope note has a real box`).toBeGreaterThan(1);
  expect(notePaint.clipped, `${label}: the page-scope note is not cut`).toBe(false);

  const tree = await surface.ariaSnapshot();
  if (width >= 768) {
    expect(headerPaint.flexDirection, `${label}: one header row`).toBe("row");
    expect(Math.abs(headerPaint.height - WORKSPACE_HEADER_PX), `${label}: 40px header`).toBeLessThanOrEqual(TOLERANCE);
    expect(titlePaint.x + titlePaint.width, `${label}: title and note do not overlap`).toBeLessThanOrEqual(notePaint.x);
    expect(notePaint.y + notePaint.height, `${label}: the note stays inside the header`).toBeLessThanOrEqual(headerPaint.y + headerPaint.height);
    const showingPaint = await paintOf(page.getByText(showing));
    expect(showingPaint.display, `${label}: Mostrando stays rendered`).not.toBe("none");
    expect(showingPaint.width * showingPaint.height, `${label}: Mostrando is visually hidden`).toBeLessThanOrEqual(1);
    expect(tree, `${label}: Mostrando reaches assistive technologies`).toMatch(showing);
  } else {
    expect(headerPaint.flexDirection, `${label}: the phone header keeps its stacked layout`).toBe("column");
    expect(await paintOf(page.getByText(showing)).then((paint) => paint.display), `${label}: phone hides Mostrando as before`).toBe("none");
  }
}

async function readNoExternalScroll(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    return {
      htmlScrollHeight: html.scrollHeight,
      htmlClientHeight: html.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
    };
  });
}

test.describe("clinic Logística Visitas full route adaptive contract (R-12)", () => {
  for (const viewport of VIEWPORTS) {
    test(`renders an always-visible pager sized to ${viewport.name} without external scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setClinicSession(page, "populated");

      await page.goto("/dashboard/logistica/visitas");

      const pager = page.getByRole("navigation", { name: "Paginación de visitas" });
      const previousButton = page.getByRole("button", { name: "Página anterior" });
      const nextButton = page.getByRole("button", { name: "Página siguiente" });
      const pageIndicator = pager.locator(".dashboard-pagination-context");
      const rows = page.locator("table tbody tr");

      await expect(async () => {
        await expect(pager).toBeVisible();
        await expect(previousButton).toBeVisible();
        await expect(nextButton).toBeVisible();

        const rowCount = await rows.count();
        expect(rowCount, `${viewport.name}: at least one row rendered`).toBeGreaterThan(0);
      }).toPass({ timeout: 12_000 });

      // Fixture dataset (3 visits) is far below the default page-size limit
      // (50), so this is the "everything fits on page 1" contract state:
      // no previous page, and the page-full heuristic correctly reports no
      // further page either.
      await expect(previousButton).toBeDisabled();
      await expect(nextButton).toBeDisabled();
      await expect(pageIndicator).toHaveText("Página 1");
      await expectPageScopeHeader(page, viewport.width, /Mostrando 3 visitas · página 1/, viewport.name);

      await expect(async () => {
        const metrics = await readNoExternalScroll(page);
        expect(
          metrics.htmlScrollHeight,
          `${viewport.name}: documentElement must not scroll globally`,
        ).toBeLessThanOrEqual(metrics.htmlClientHeight + MAX_DOCUMENT_SCROLL_DELTA_PX);
        expect(
          metrics.bodyScrollHeight,
          `${viewport.name}: body must not scroll globally`,
        ).toBeLessThanOrEqual(metrics.bodyClientHeight + MAX_DOCUMENT_SCROLL_DELTA_PX);
      }).toPass({ timeout: 10_000 });

      const pagerBox = await pager.boundingBox();
      expect(pagerBox, `${viewport.name}: pager bounding box`).not.toBeNull();
      expect(
        pagerBox!.x + pagerBox!.width,
        `${viewport.name}: pager right edge`,
      ).toBeLessThanOrEqual(viewport.width + TOLERANCE);
      expect(pagerBox!.x, `${viewport.name}: pager left edge`).toBeGreaterThanOrEqual(-TOLERANCE);
    });
  }

  test("page-full heuristic enables next/previous navigation and keeps the offset contract in the URL", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setClinicSession(page, "populated");

    // The fixture serves exactly 3 field visits regardless of limit/offset,
    // so requesting `limit=3` forces the deterministic "page full" state
    // (visits.length === limit) without depending on real production data.
    await page.goto("/dashboard/logistica/visitas?limit=3&offset=0");

    const pager = page.getByRole("navigation", { name: "Paginación de visitas" });
    const previousButton = page.getByRole("button", { name: "Página anterior" });
    const nextButton = page.getByRole("button", { name: "Página siguiente" });
    const pageIndicator = pager.locator(".dashboard-pagination-context");

    await expect(async () => {
      await expect(nextButton).toBeEnabled();
      await expect(previousButton).toBeDisabled();
    }).toPass({ timeout: 12_000 });

    await expect(pageIndicator).toHaveText("Página 1");
    await expectPageScopeHeader(page, 1440, /Mostrando 3 visitas · página 1 · puede haber más visitas disponibles/, "page full");

    await nextButton.click();

    await expect(async () => {
      const url = new URL(page.url());
      expect(url.searchParams.get("offset")).toBe("3");
      expect(url.searchParams.get("limit")).toBe("3");
    }).toPass({ timeout: 10_000 });

    await expect(pageIndicator).toHaveText("Página 2");
    await expect(previousButton).toBeEnabled();

    await previousButton.click();

    await expect(async () => {
      const url = new URL(page.url());
      expect(url.searchParams.get("offset")).toBe("0");
    }).toPass({ timeout: 10_000 });
    await expect(pageIndicator).toHaveText("Página 1");
    await expect(previousButton).toBeDisabled();
  });
});
