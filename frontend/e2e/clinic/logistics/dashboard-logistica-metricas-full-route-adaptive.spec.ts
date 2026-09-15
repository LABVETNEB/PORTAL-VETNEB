import { expect, test, type Page } from "@playwright/test";
import { setClinicSession } from "../../helpers/session";

const TOLERANCE = 2;
const METRICAS_PATHNAME = "/dashboard/logistica/metricas";
const FIXTURE_ROUTE_PLAN_COUNT = 3;

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-short-1366x768", width: 1366, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

// Fixture (frontend/e2e/fixtures/admin-populated-api-server.mjs) serves a
// fixed 3-plan CLINIC_ROUTE_PLANS array (ids 8601/8602/8603) whenever the
// request carries limit/offset, plus one metrics entry per id. Because
// metricas/page.tsx is a pure server component, its route-plans/metrics
// fetches happen server-to-server (Next.js SSR -> fixture) and are never
// visible to the browser's network stack, so fan-out scoping is asserted
// via rendered content (exactly 1 metric detail card per page-visible route
// plan) rather than via page.on("request").

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

test.describe("clinic Logística Métricas full route adaptive contract (R-14)", () => {
  for (const viewport of VIEWPORTS) {
    test(`renders an always-visible pager sized to ${viewport.name} without external scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setClinicSession(page, "populated");

      await page.goto(METRICAS_PATHNAME);

      // Without a URL `limit` the server default (12) is only the pre-measurement
      // render: LogisticsBoundedCanvas measures the canvas and replaces the URL
      // ONCE with `offset=0&limit=<measured>`, and the server re-renders for it.
      // That navigation is the convergence signal of this contract (same signal
      // as the A03 `logistics-bounded-canvas` leaves); asserting before it lands
      // reads the transient default instead of the page sized to the viewport.
      await page.waitForURL(
        (url) =>
          url.pathname === METRICAS_PATHNAME &&
          url.searchParams.get("offset") === "0" &&
          url.searchParams.get("limit") !== null,
        { timeout: 12_000 },
      );
      const measuredLimit = Number(new URL(page.url()).searchParams.get("limit"));
      expect(
        Number.isInteger(measuredLimit) && measuredLimit > 0,
        `${viewport.name}: adaptive limit must be a positive integer (received ${measuredLimit})`,
      ).toBe(true);

      const pager = page.getByRole("navigation", { name: "Paginación de métricas de ruta" });
      const previousButton = page.getByRole("button", { name: "Página anterior" });
      const nextButton = page.getByRole("button", { name: "Página siguiente" });
      const pageIndicator = pager.locator(".dashboard-pagination-context");
      const metricCards = page.locator(".surface-soft");

      // The caption names the limit the server actually rendered with, so it
      // proves the measured page — not the default one — is on screen before
      // any state shared by both renders is asserted.
      await expect(
        page.getByText(
          `Métricas calculadas sobre la página visible (máximo ${measuredLimit} planes), no sobre el total general de rutas.`,
        ),
      ).toBeVisible();

      await expect(async () => {
        await expect(pager).toBeVisible();
        await expect(previousButton).toBeVisible();
        await expect(nextButton).toBeVisible();

        const cardCount = await metricCards.count();
        expect(cardCount, `${viewport.name}: metrics fan-out`).toBe(FIXTURE_ROUTE_PLAN_COUNT);
      }).toPass({ timeout: 12_000 });

      // First page: no previous page. The fixture serves its 3 route plans for
      // any limit/offset, so the page-full heuristic (`routePlans.length ===
      // limit`) enables "Siguiente" exactly when the measured limit is 3.
      await expect(previousButton).toBeDisabled();
      await expect(nextButton).toBeEnabled({
        enabled: measuredLimit === FIXTURE_ROUTE_PLAN_COUNT,
      });
      await expect(pageIndicator).toHaveText("Página 1");

      // Fan-out is bounded to exactly the route plans served for the page (one
      // metric detail card per plan) — never more, never fewer.
      await expect(metricCards).toHaveCount(FIXTURE_ROUTE_PLAN_COUNT);

      await expect(async () => {
        const metrics = await readNoExternalScroll(page);
        expect(
          metrics.htmlScrollHeight,
          `${viewport.name}: documentElement must not scroll globally`,
        ).toBeLessThanOrEqual(metrics.htmlClientHeight + TOLERANCE);
        expect(
          metrics.bodyScrollHeight,
          `${viewport.name}: body must not scroll globally`,
        ).toBeLessThanOrEqual(metrics.bodyClientHeight + TOLERANCE);
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

  test("renders real aggregate metrics computed from the visible page only", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setClinicSession(page, "populated");

    await page.goto("/dashboard/logistica/metricas");

    // Fixture metrics: compliance 90/65/100 -> avg 85%; completed 3+2+10=15
    // of total 8+5+10=23; durations 42/55/null -> avg of [42,55] = 49min.
    await expect(async () => {
      await expect(page.getByText("85%")).toBeVisible();
      await expect(page.getByText("15/23")).toBeVisible();
      await expect(page.getByText("49 min")).toBeVisible();
    }).toPass({ timeout: 12_000 });

    await expect(page.getByText("Mostrando 3 métricas de ruta · página 1")).toBeVisible();
    await expect(page.getByText("90% cumplimiento")).toBeVisible();
    await expect(page.getByText("65% cumplimiento")).toBeVisible();
    await expect(page.getByText("100% cumplimiento")).toBeVisible();
  });

  test("page-full heuristic enables next/previous navigation and keeps the offset contract in the URL", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setClinicSession(page, "populated");

    // The fixture serves exactly 3 route plans regardless of limit/offset,
    // so requesting `limit=3` forces the deterministic "page full" state
    // (routePlans.length === limit) without depending on real production data.
    await page.goto("/dashboard/logistica/metricas?limit=3&offset=0");

    const pager = page.getByRole("navigation", { name: "Paginación de métricas de ruta" });
    const previousButton = page.getByRole("button", { name: "Página anterior" });
    const nextButton = page.getByRole("button", { name: "Página siguiente" });
    const pageIndicator = pager.locator(".dashboard-pagination-context");

    await expect(async () => {
      await expect(nextButton).toBeEnabled();
      await expect(previousButton).toBeDisabled();
    }).toPass({ timeout: 12_000 });

    await expect(pageIndicator).toHaveText("Página 1");
    await expect(page.getByText(/puede haber más planes de ruta disponibles/)).toBeVisible();

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
