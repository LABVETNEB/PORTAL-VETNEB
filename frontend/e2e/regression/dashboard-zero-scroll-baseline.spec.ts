import { expect, test, type Page } from "@playwright/test";

import {
  assertSurfaceLoaded,
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_COMBINATION_COUNT,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACE_COUNT,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_GEOMETRY_VIEWPORT_COUNT,
  DASHBOARD_GEOMETRY_VIEWPORTS,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
} from "../helpers/dashboard-geometry-matrix";

// ─────────────────────────────────────────────────────────────────────────────
// A08 · Zero-scroll canonical freeze — 21 surfaces × 13 viewports (273).
//
// A08 freezes the APP SHELL invariant of §10/§48: with the surface in its real
// LOADED state, neither `documentElement`, nor `body`, nor `main.dashboard-main`
// may scroll on either axis, and `main.dashboard-main` may not be an
// operational scroll container (computed `overflow-y` is neither `auto` nor
// `scroll`).
//
// It deliberately does NOT forbid the contracted internal scroll of a bounded
// canvas/list: §10 permits exactly that ("solo el contratado, p. ej. body de
// tabla") and those canvases have their own specs. A08 owns the outer frame.
//
// Completeness comes from the SAME canonical matrix as A02
// (`../helpers/dashboard-geometry-matrix`) and never from a second hand-written
// census: dropping a surface or a viewport there fails A08 in `beforeAll`.
//
// Frontier: A02 freezes CURRENT geometry, A03 freezes limit/offset, A05–A07
// freeze the capacity engine. A08 freezes zero-scroll and measures no bound, no
// pagination parameter and no region height.
// ─────────────────────────────────────────────────────────────────────────────

const APP_ORIGIN = "http://127.0.0.1:3000";

/**
 * EXACT contract, not a tolerance. `AGENTS.md` §10 states the invariant as
 * `SCROLL_VERTICAL_DEL_DOCUMENTO = 0` / `SCROLL_HORIZONTAL_DEL_DOCUMENTO = 0`,
 * so A08 freezes zero, not "almost zero": any delta of 1 px or more fails.
 *
 * This is measured, not aspirational — the 273 canonical combinations all
 * report a delta of exactly 0 px on the six metrics, so the gate is enforced at
 * the value the shell already holds and no runtime change was needed to reach
 * it. The older zero-scroll specs in `frontend/e2e/platform/app-shell/` keep
 * their 2 px allowance; A08 is the freeze and does not inherit it.
 *
 * It must NOT be raised to absorb a failure: a positive delta is a runtime
 * defect to report, not a number to re-tune.
 */
const MAX_SCROLL_DELTA_PX = 0;

type AxisMetrics = {
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
};

type ZeroScrollMetrics = {
  readonly hasMain: boolean;
  readonly html: AxisMetrics;
  readonly body: AxisMetrics;
  readonly main: AxisMetrics;
  readonly mainOverflowY: string;
  readonly mainClassName: string;
};

type ZeroScrollRecord = {
  readonly surfaceId: string;
  readonly viewportSlug: string;
  readonly htmlVerticalDelta: number;
  readonly htmlHorizontalDelta: number;
  readonly bodyVerticalDelta: number;
  readonly bodyHorizontalDelta: number;
  readonly mainVerticalDelta: number;
  readonly mainHorizontalDelta: number;
  readonly mainOverflowY: string;
};

async function readZeroScrollMetrics(page: Page): Promise<ZeroScrollMetrics> {
  return page.evaluate(() => {
    const axis = (element: Element | null) => ({
      scrollHeight: element?.scrollHeight ?? 0,
      clientHeight: element?.clientHeight ?? 0,
      scrollWidth: element?.scrollWidth ?? 0,
      clientWidth: element?.clientWidth ?? 0,
    });

    const main = document.querySelector<HTMLElement>("main.dashboard-main");

    return {
      hasMain: main !== null,
      html: axis(document.documentElement),
      body: axis(document.body),
      main: axis(main),
      mainOverflowY: main ? window.getComputedStyle(main).overflowY : "absent",
      mainClassName: typeof main?.className === "string" ? main.className : "",
    };
  });
}

function toRecord(
  surfaceId: string,
  viewportSlug: string,
  metrics: ZeroScrollMetrics,
): ZeroScrollRecord {
  return {
    surfaceId,
    viewportSlug,
    htmlVerticalDelta: metrics.html.scrollHeight - metrics.html.clientHeight,
    htmlHorizontalDelta: metrics.html.scrollWidth - metrics.html.clientWidth,
    bodyVerticalDelta: metrics.body.scrollHeight - metrics.body.clientHeight,
    bodyHorizontalDelta: metrics.body.scrollWidth - metrics.body.clientWidth,
    mainVerticalDelta: metrics.main.scrollHeight - metrics.main.clientHeight,
    mainHorizontalDelta: metrics.main.scrollWidth - metrics.main.clientWidth,
    mainOverflowY: metrics.mainOverflowY,
  };
}

/**
 * Every frame-contract violation of ONE combination, as diagnosable lines.
 * Collecting them all instead of throwing on the first keeps a red run
 * actionable: surface, viewport, element, axis and exact delta.
 */
function collectViolations(metrics: ZeroScrollMetrics, label: string): string[] {
  if (!metrics.hasMain) {
    return [`${label}: main.dashboard-main is absent`];
  }

  const violations: string[] = [];

  if (metrics.mainOverflowY === "auto" || metrics.mainOverflowY === "scroll") {
    violations.push(
      `${label}: main.dashboard-main is an operational scroll container (overflow-y=${metrics.mainOverflowY}, class="${metrics.mainClassName}")`,
    );
  }

  const elements = [
    { name: "documentElement", axis: metrics.html },
    { name: "body", axis: metrics.body },
    { name: "main.dashboard-main", axis: metrics.main },
  ] as const;

  for (const element of elements) {
    const verticalDelta = element.axis.scrollHeight - element.axis.clientHeight;
    const horizontalDelta = element.axis.scrollWidth - element.axis.clientWidth;

    if (verticalDelta > MAX_SCROLL_DELTA_PX) {
      violations.push(
        `${label}: ${element.name} scrolls vertically (scrollHeight ${element.axis.scrollHeight} > clientHeight ${element.axis.clientHeight}, delta ${verticalDelta}px — the contract allows exactly ${MAX_SCROLL_DELTA_PX}px)`,
      );
    }
    if (horizontalDelta > MAX_SCROLL_DELTA_PX) {
      violations.push(
        `${label}: ${element.name} scrolls horizontally (scrollWidth ${element.axis.scrollWidth} > clientWidth ${element.axis.clientWidth}, delta ${horizontalDelta}px — the contract allows exactly ${MAX_SCROLL_DELTA_PX}px)`,
      );
    }
  }

  return violations;
}

test.beforeAll(() => {
  expect(DASHBOARD_GEOMETRY_SURFACES.length, "surface cardinality").toBe(
    DASHBOARD_GEOMETRY_SURFACE_COUNT,
  );
  expect(DASHBOARD_GEOMETRY_VIEWPORTS.length, "viewport cardinality").toBe(
    DASHBOARD_GEOMETRY_VIEWPORT_COUNT,
  );
  expect(
    new Set(DASHBOARD_GEOMETRY_SURFACES.map((surface) => surface.id)).size,
    "surface ids must be unique",
  ).toBe(DASHBOARD_GEOMETRY_SURFACE_COUNT);
  expect(
    new Set(DASHBOARD_GEOMETRY_VIEWPORTS.map((viewport) => viewport.slug)).size,
    "viewport slugs must be unique",
  ).toBe(DASHBOARD_GEOMETRY_VIEWPORT_COUNT);
  expect(
    DASHBOARD_GEOMETRY_SURFACES.length * DASHBOARD_GEOMETRY_VIEWPORTS.length,
    "expected zero-scroll combinations",
  ).toBe(DASHBOARD_GEOMETRY_COMBINATION_COUNT);
});

test.describe("A08 · dashboard zero-scroll canonical freeze 21x13", () => {
  for (const surface of DASHBOARD_GEOMETRY_SURFACES) {
    test(`${surface.id} keeps the app shell free of scroll across 13 viewports`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(300_000);

      await suppressNextDevChrome(page);
      await clearDashboardModuleMemory(page);
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

      const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role];
      await page.context().addCookies([
        { name: cookie.name, value: cookie.value, url: APP_ORIGIN },
      ]);
      await installSurfaceMocks(page, surface);

      const measured: ZeroScrollRecord[] = [];
      const failures: string[] = [];

      for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS) {
        const label = `${surface.id} @ ${viewport.slug}`;

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(surface.route);

        await expect(
          page.locator(surface.readinessSelector).first(),
          `${label}: readiness`,
        ).toBeVisible({ timeout: 25_000 });

        // Idle network is an ADDITIONAL condition on top of the readiness
        // selector: modules that hydrate their collection client-side would
        // otherwise be measured mid-fetch.
        await page.waitForLoadState("networkidle", { timeout: 20_000 });

        // Semantic loaded-state gate, shared with A02: a stubbed surface must
        // show its representative record and no error/loading banner, so A08
        // can never freeze the frame of a 404, an error or an accidental empty.
        await assertSurfaceLoaded(page, surface, label);
        await waitForLayoutSettled(page);

        let lastMetrics = await readZeroScrollMetrics(page);

        try {
          // Polling absorbs the adaptive re-measure pass several modules run
          // after first paint (measure viewport → derive capacity → repaint).
          // It only ever converges on a settled frame: a real overflow does not
          // disappear on its own, so it still fails.
          await expect(async () => {
            lastMetrics = await readZeroScrollMetrics(page);
            expect(
              collectViolations(lastMetrics, label).join("\n"),
              `${label}: zero-scroll`,
            ).toBe("");
          }).toPass({ timeout: 15_000 });
        } catch (error) {
          const violations = collectViolations(lastMetrics, label);
          failures.push(...violations);

          // The poll can also fail for a reason the last snapshot does not
          // explain (the evaluate threw, the page closed, a navigation raced).
          // Recording it is mandatory: swallowing it would let an unexecuted
          // combination report green.
          if (violations.length === 0) {
            failures.push(
              `${label}: zero-scroll poll failed without a geometry violation — ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }

        measured.push(toRecord(surface.id, viewport.slug, lastMetrics));
      }

      // Fail-closed on execution: a viewport that silently stops running can
      // never leave this test green.
      expect(measured.length, `${surface.id}: measured viewports`).toBe(
        DASHBOARD_GEOMETRY_VIEWPORT_COUNT,
      );
      expect(
        new Set(measured.map((record) => record.viewportSlug)).size,
        `${surface.id}: distinct viewports measured`,
      ).toBe(DASHBOARD_GEOMETRY_VIEWPORT_COUNT);

      await testInfo.attach(`a08-zero-scroll-${surface.id}.json`, {
        contentType: "application/json",
        body: Buffer.from(`${JSON.stringify(measured, null, 2)}\n`, "utf8"),
      });

      expect(failures.join("\n"), `${surface.id}: zero-scroll violations`).toBe("");
    });
  }
});
