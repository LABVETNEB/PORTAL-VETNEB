import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

import { DASHBOARD_GEOMETRY_BASELINE } from "../fixtures/dashboard-geometry-baseline";
import {
  assertSurfaceLoaded,
  clearDashboardModuleMemory,
  compareGeometryRecords,
  DASHBOARD_GEOMETRY_COMBINATION_COUNT,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACE_COUNT,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_GEOMETRY_VIEWPORT_COUNT,
  DASHBOARD_GEOMETRY_VIEWPORTS,
  formatGeometryDifferences,
  geometryKey,
  installSurfaceMocks,
  measureSurfaceGeometry,
  suppressNextDevChrome,
  waitForLayoutSettled,
  type DashboardGeometryRecord,
} from "../helpers/dashboard-geometry-matrix";

// ─────────────────────────────────────────────────────────────────────────────
// A02 · Frozen geometry baseline of the 21 authenticated dashboard surfaces
// across the 13 canonical viewports (273 combinations).
//
// One Playwright case per surface walks all 13 viewports, so the matrix costs
// 21 browser contexts instead of 273. Every combination is compared against the
// versioned baseline with explicit per-metric tolerances.
//
// This is the CURRENT geometry, not the audit's §46 target geometry. It is not
// the A08 zero-scroll contract, and it measures no pagination parameter (A03).
// ─────────────────────────────────────────────────────────────────────────────

const APP_ORIGIN = "http://127.0.0.1:3000";

/**
 * Opt-in capture pass. Writes one JSON per surface into `test-results/` and
 * skips comparison; it never touches the versioned baseline. Fails closed on
 * CI so a red baseline can never be "fixed" by a pipeline re-capture.
 */
const captureRequested = process.env.VETNEB_A02_GEOMETRY_CAPTURE === "1";

if (captureRequested && process.env.CI === "true") {
  throw new Error(
    "VETNEB_A02_GEOMETRY_CAPTURE is a local-only capture mode and must not run with CI=true",
  );
}

const baselineIndex = new Map<string, DashboardGeometryRecord>(
  DASHBOARD_GEOMETRY_BASELINE.records.map((record) => [
    geometryKey(record.surfaceId, record.viewportSlug),
    record,
  ]),
);

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
    "expected combinations",
  ).toBe(DASHBOARD_GEOMETRY_COMBINATION_COUNT);

  if (captureRequested) return;

  expect(DASHBOARD_GEOMETRY_BASELINE.records.length, "baseline record count").toBe(
    DASHBOARD_GEOMETRY_COMBINATION_COUNT,
  );
  expect(baselineIndex.size, "baseline keys must be unique").toBe(
    DASHBOARD_GEOMETRY_COMBINATION_COUNT,
  );
});

test.describe("A02 · dashboard geometry baseline 21x13", () => {
  for (const surface of DASHBOARD_GEOMETRY_SURFACES) {
    test(`${surface.id} geometry matches the frozen baseline across 13 viewports`, async ({
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

      const captured: DashboardGeometryRecord[] = [];
      const failures: string[] = [];

      for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS) {
        const label = `${surface.id} @ ${viewport.slug}`;

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(surface.route);

        await expect(
          page.locator(surface.readinessSelector).first(),
          `${label}: readiness`,
        ).toBeVisible({ timeout: 25_000 });

        // Modules that hydrate their collection client-side finish fetching
        // before the geometry can be frozen. Idle network is an ADDITIONAL
        // condition on top of the readiness selector, never the only one.
        await page.waitForLoadState("networkidle", { timeout: 20_000 });

        // Semantic loaded-state gate: the stubbed surfaces must show their
        // representative record and no error/loading banner before measuring.
        await assertSurfaceLoaded(page, surface, label);
        await waitForLayoutSettled(page);

        const record = await measureSurfaceGeometry(page, surface, viewport);
        captured.push(record);

        if (captureRequested) continue;

        const expectedRecord = baselineIndex.get(geometryKey(surface.id, viewport.slug));
        if (!expectedRecord) {
          failures.push(`${label}: missing baseline record`);
          continue;
        }

        const differences = compareGeometryRecords(expectedRecord, record);
        if (differences.length > 0) {
          failures.push(formatGeometryDifferences(differences));
        }
      }

      expect(captured.length, `${surface.id}: measured viewports`).toBe(
        DASHBOARD_GEOMETRY_VIEWPORT_COUNT,
      );

      if (captureRequested) {
        await writeFile(
          testInfo.outputPath(`a02-geometry-${surface.id}.json`),
          `${JSON.stringify(captured, null, 2)}\n`,
          "utf8",
        );
        return;
      }

      if (failures.length > 0) {
        await testInfo.attach(`a02-geometry-${surface.id}.json`, {
          contentType: "application/json",
          body: Buffer.from(`${JSON.stringify(captured, null, 2)}\n`, "utf8"),
        });
      }

      expect(failures.join("\n"), `${surface.id}: geometry drift`).toBe("");
    });
  }
});
