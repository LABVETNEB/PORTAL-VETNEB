import { expect, test, type Page } from "@playwright/test";

import {
  assertSurfaceLoaded,
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_GEOMETRY_VIEWPORTS,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
} from "../helpers/dashboard-geometry-matrix";
import { addAppCookies } from "../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../helpers/zero-scroll-contract";

// ─────────────────────────────────────────────────────────────────────────────
// Responsive cold-load sentinel — closes the E2E-GLOBAL-09 P2 gap.
//
// A02/A08 enter every surface at the desktop viewport (1920x1080) and reach the
// 12 remaining viewports by resize; E2E-GLOBAL-09 measured that transition as
// geometrically identical to a cold navigation on all 273 combinations. That
// equivalence holds for CSS-driven responsive layout, which recomputes
// identically regardless of navigation history. It does NOT cover a narrower
// class: a component whose responsive behaviour is decided once, in
// JavaScript, on mount.
//
// Exactly two of the 21 canonical surfaces fall into that class today —
// verified by reading every `matchMedia`/`isMobile*` usage under
// `frontend/src` (`git grep -rn "matchMedia\|isMobile\|useIsMobile"`), not
// assumed:
//
// - `admin-precios` (`AdminMobilePricingModule`) and `admin-mantenimiento`
//   (`AdminMobileMaintenanceModule`, via the shared `useIsMobileViewport`
//   hook) each read `window.matchMedia("(max-width: 767px)")` once in a
//   `useEffect` on mount, call `syncViewport()` synchronously to seed state,
//   then rely on the query's `"change"` event for every later transition. A
//   resize crossing 767px always fires `"change"`, so E2E-GLOBAL-09's
//   hot-resize path exercises that listener correctly. A COLD load already
//   inside the phone class never fires `"change"` (there is no transition to
//   fire from), so it depends entirely on the mount-time `syncViewport()`
//   call — the one line E2E-GLOBAL-09's matrix no longer reaches, because
//   every surface's first (and only) navigation lands at the desktop
//   viewport. Both surfaces gate their DEFAULT chip's data fetch on this
//   state (`AdminMobilePricingModule`'s "Editar" section, first of two;
//   `AdminMobileMaintenanceModule`'s "Esquema" section, first of two): a
//   broken mount-time sync leaves that panel's data empty forever on a real
//   cold phone load, which is exactly what each surface's own
//   `loadedState.forbidden` text in the A02/A08 matrix (reused unmodified
//   below via `assertSurfaceLoaded`) already exists to catch.
// - `admin-estado` (`AdminMobileHealthModule`) has the SAME `matchMedia` hook,
//   but only inside `AdminMobileSchemaSection`, the third of three chips,
//   mounted only once a user opens it. A02/A08 measure the default
//   ("Servicios") chip, which the surface's parent populates unconditionally
//   (no `matchMedia` gate). The hazard is real for that nested chip, but
//   A02/A08 never reach it either way (cold or resize) — adding a cold
//   sentinel for `admin-estado` would not close any gap the resize path
//   actually leaves open, so it is deliberately excluded (AGENTS.md §6: no
//   redundant coverage).
// - No other surface (or shared shell component reachable at first paint —
//   `DashboardNotificationsBell` included) has a JS-mount-vs-resize hazard:
//   the state it derives from `matchMedia` lives in a ref read only on click,
//   never affecting the geometry A02/A08 freeze. Every other surface's
//   mobile/tablet/desktop rendering is pure CSS (`@media`), which the browser
//   resolves identically at parse time regardless of whether the viewport
//   arrived via `goto` or `resize` — there is no state to get stuck.
//
// Design: this sentinel does ONE cold navigation per affected surface, landing
// directly on a phone viewport (`w390x844` — any of the 5 phone widths shares
// the same `matchMedia` branch, so one is representative of the JS state;
// A02/A08 already re-verify all 5 phone widths' pixel geometry via resize),
// then asserts the SAME two properties A02/A08 already assert per combination:
// the surface's loaded-state contract (content-correctness — this is the
// signal that actually catches a broken mount-time sync, since the affected
// chip's data never arrives) and A08's exact zero-scroll contract
// (overflow-correctness). It deliberately does NOT also compare against A02's
// frozen numeric baseline: that comparison is orthogonal to this hazard (a
// broken sync fails the loaded-state check before geometry is ever read) and
// inherits A02's own already-documented, unrelated Windows topbar-height
// baseline drift (see docs/implementation/e2e-global-09-canonical-matrix-performance.md,
// "Salida idéntica BEFORE/AFTER" — A02 fails 21/21 on win32 for that reason,
// which is why A02 stays in `extended` rather than the required `ci` cohort).
// Reusing it here would make this required sentinel flaky for a reason
// unrelated to what it exists to prove.
//
// Cost: +2 navigations total (one per surface), not +2 per viewport class and
// not a return to per-viewport cold navigation for the full 21x13 matrix.
// ─────────────────────────────────────────────────────────────────────────────

const COLD_LOAD_SENTINEL_SURFACE_IDS = ["admin-precios", "admin-mantenimiento"] as const;

const PHONE_SENTINEL_VIEWPORT_SLUG = "w390x844";

const sentinelSurfaces = COLD_LOAD_SENTINEL_SURFACE_IDS.map((id) => {
  const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === id);
  if (!surface) {
    throw new Error(
      `Responsive cold-load sentinel: surface "${id}" is no longer in DASHBOARD_GEOMETRY_SURFACES ` +
        "(A02/A08 canonical census). Re-derive the affected-surface list before removing this sentinel.",
    );
  }
  return surface;
});

const sentinelViewport = DASHBOARD_GEOMETRY_VIEWPORTS.find(
  (viewport) => viewport.slug === PHONE_SENTINEL_VIEWPORT_SLUG,
);
if (!sentinelViewport) {
  throw new Error(
    `Responsive cold-load sentinel: viewport "${PHONE_SENTINEL_VIEWPORT_SLUG}" is no longer in ` +
      "DASHBOARD_GEOMETRY_VIEWPORTS.",
  );
}

// ── A08's exact zero-scroll contract, reused verbatim ──────────────────────
// The MEASUREMENT shape below stays duplicated (not imported) from
// dashboard-zero-scroll-baseline.spec.ts on purpose: this sentinel must never
// drift from A08's already-validated readings by sharing a mutable helper, and
// the duplicated surface is ~30 lines. The THRESHOLD is not duplicated —
// E2E-GLOBAL-10 gave the zero-scroll régime one owner (R-12).

const MAX_SCROLL_DELTA_PX = MAX_DOCUMENT_SCROLL_DELTA_PX;

type AxisMetrics = {
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
};

async function readZeroScrollMetrics(page: Page) {
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
    };
  });
}

function collectZeroScrollViolations(
  metrics: {
    readonly hasMain: boolean;
    readonly html: AxisMetrics;
    readonly body: AxisMetrics;
    readonly main: AxisMetrics;
    readonly mainOverflowY: string;
  },
  label: string,
): string[] {
  if (!metrics.hasMain) return [`${label}: main.dashboard-main is absent`];

  const violations: string[] = [];

  if (metrics.mainOverflowY === "auto" || metrics.mainOverflowY === "scroll") {
    violations.push(
      `${label}: main.dashboard-main is an operational scroll container (overflow-y=${metrics.mainOverflowY})`,
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
        `${label}: ${element.name} scrolls vertically (delta ${verticalDelta}px, contract allows ${MAX_SCROLL_DELTA_PX}px)`,
      );
    }
    if (horizontalDelta > MAX_SCROLL_DELTA_PX) {
      violations.push(
        `${label}: ${element.name} scrolls horizontally (delta ${horizontalDelta}px, contract allows ${MAX_SCROLL_DELTA_PX}px)`,
      );
    }
  }

  return violations;
}

test.beforeAll(() => {
  expect(sentinelSurfaces.length, "sentinel surface count").toBe(
    COLD_LOAD_SENTINEL_SURFACE_IDS.length,
  );
});

test.describe("Responsive cold-load sentinel · admin-precios / admin-mantenimiento (P2)", () => {
  for (const surface of sentinelSurfaces) {
    test(`${surface.id} cold navigation at ${sentinelViewport.slug} loads its default chip and stays zero-scroll`, async ({
      page,
    }) => {
      test.setTimeout(60_000);

      await suppressNextDevChrome(page);
      await clearDashboardModuleMemory(page);
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

      await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role]]);
      await installSurfaceMocks(page, surface);

      // The cold entry itself: the viewport is set BEFORE `goto`, so this
      // navigation's `matchMedia("(max-width: 767px)")` already matches at
      // mount — the exact condition E2E-GLOBAL-09's desktop-first matrix
      // never produces.
      await page.setViewportSize({
        width: sentinelViewport.width,
        height: sentinelViewport.height,
      });
      await page.goto(surface.route);
      const label = `${surface.id} @ ${sentinelViewport.slug} (cold)`;
      await expect(page.locator(surface.readinessSelector).first(), `${label}: readiness`).toBeVisible({
        timeout: 25_000,
      });

      await page.waitForLoadState("networkidle", { timeout: 20_000 });

      // The property this sentinel exists to prove: if the mount-time
      // `matchMedia` sync were broken, the default chip's data-fetch effect
      // never fires on a genuine cold phone load, and its loaded-state marker
      // never appears — exactly what `loadedState.forbidden` catches here.
      await assertSurfaceLoaded(page, surface, label);
      await waitForLayoutSettled(page);

      let lastMetrics = await readZeroScrollMetrics(page);
      await expect(async () => {
        lastMetrics = await readZeroScrollMetrics(page);
        expect(collectZeroScrollViolations(lastMetrics, label).join("\n"), `${label}: zero-scroll`).toBe(
          "",
        );
      }).toPass({ timeout: 15_000 });
    });
  }
});
