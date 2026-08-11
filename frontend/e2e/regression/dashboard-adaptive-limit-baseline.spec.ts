import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type TestInfo } from "@playwright/test";

import { DASHBOARD_ADAPTIVE_LIMIT_BASELINE } from "../fixtures/dashboard-adaptive-limit-baseline";
import { DASHBOARD_GEOMETRY_VIEWPORTS } from "../helpers/dashboard-geometry-matrix";
import {
  A03_LEAF_OBSERVATION_COUNT,
  A03_MODULE_IDS,
  A03_OBSERVERS,
  A03_PRIMARY_RECORD_COUNT,
  assertA03Cardinality,
  assertMatchesBaseline,
  assertMatrixIntegrity,
  observeLeaf,
  prepareContext,
  primaryKey,
  resolveBaselineObservations,
  sortObservations,
  type A03ModuleId,
  type A03Observation,
} from "../helpers/dashboard-adaptive-limit-matrix";

// ─────────────────────────────────────────────────────────────────────────────
// A03 · CURRENT limit/offset behaviour of the 15 adaptive consumers across the
// 13 canonical viewports: 195 primary records · 234 leaf observations.
//
// One Playwright case per module walks all 13 viewports (and every declared
// variant), so the matrix costs 15 browser contexts instead of 234. A final
// serial case aggregates every module's observations and asserts the full
// cardinality contract of audit §20.1–§20.2.
//
// Frozen on Win32 Chromium from two consecutive post-A05 cold runs with exact
// zero drift. A platform without a real baseline fails closed; capture mode
// only preserves its observations in test-results and never borrows Win32.
// ─────────────────────────────────────────────────────────────────────────────

const A03_PLATFORM_CAPTURE_MODE: "off" | "capture" = "capture";

/** Shared, run-scoped sink. `test-results/` is cleared by Playwright at start. */
function matrixDir(testInfo: TestInfo): string {
  return path.join(testInfo.project.outputDir, "a03-matrix");
}

async function writeModuleObservations(
  testInfo: TestInfo,
  moduleId: A03ModuleId,
  observations: readonly A03Observation[],
): Promise<void> {
  const directory = matrixDir(testInfo);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${moduleId}.json`),
    `${JSON.stringify(observations, null, 2)}\n`,
    "utf8",
  );
}

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  assertA03Cardinality();
});

test.describe("A03 · adaptive limit/offset matrix 15x13", () => {
  for (const moduleId of A03_MODULE_IDS) {
    const observer = A03_OBSERVERS[moduleId];

    test(`${moduleId} · ${observer.source}`, async ({ page }, testInfo) => {
      test.setTimeout(900_000);

      await prepareContext(page, observer);

      const observations: A03Observation[] = [];

      for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        for (const leaf of observer.leaves) {
          // Per-leaf progress: a failing leaf must be identifiable by
          // moduleId/viewportSlug/variantId without re-running the matrix.
          console.log(
            `[A03 matrix] → ${moduleId}::${viewport.slug}${leaf.variantId ? `::${leaf.variantId}` : ""}`,
          );
          observations.push(await observeLeaf(page, observer, leaf, viewport.slug));
        }
      }

      const expectedLeaves = observer.leaves.length * DASHBOARD_GEOMETRY_VIEWPORTS.length;
      expect(observations.length, `${moduleId}: leaf observations`).toBe(expectedLeaves);
      expect(
        new Set(observations.map((o) => primaryKey(o.moduleId, o.viewportSlug))).size,
        `${moduleId}: primary records`,
      ).toBe(DASHBOARD_GEOMETRY_VIEWPORTS.length);

      await writeModuleObservations(testInfo, moduleId, observations);
    });
  }

  test("matrix integrity · 195 primary records · 234 leaves", async ({}, testInfo) => {
    const directory = matrixDir(testInfo);
    const files = (await readdir(directory)).filter((name) => name.endsWith(".json"));

    expect(files.length, "one observation file per module").toBe(A03_MODULE_IDS.length);

    const observations: A03Observation[] = [];
    for (const file of files) {
      const parsed = JSON.parse(
        await readFile(path.join(directory, file), "utf8"),
      ) as A03Observation[];
      observations.push(...parsed);
    }

    assertMatrixIntegrity(observations);

    const sorted = sortObservations(observations);
    const rendered = `${JSON.stringify(
      {
        schema: "a03-matrix-run/1",
        primaryRecords: new Set(
          sorted.map((o) => primaryKey(o.moduleId, o.viewportSlug)),
        ).size,
        leafObservations: sorted.length,
        observations: sorted,
      },
      null,
      2,
    )}\n`;

    const outputFile = path.join(directory, "a03-matrix-observations.json");
    await writeFile(outputFile, rendered, "utf8");

    const baseline = resolveBaselineObservations(
      DASHBOARD_ADAPTIVE_LIMIT_BASELINE,
      process.platform,
    );
    if (baseline === null) {
      if (A03_PLATFORM_CAPTURE_MODE === "capture") {
        await testInfo.attach("a03-matrix-observations.json", {
          path: outputFile,
          contentType: "application/json",
        });
      }
      throw new Error(
        `A03 baseline is unavailable for platform "${process.platform}"; ` +
          `capture=${A03_PLATFORM_CAPTURE_MODE}. Add only a real 234-leaf capture.`,
      );
    }

    assertMatchesBaseline(sorted, baseline.observations, baseline.provenance);

    console.log(
      `\n[A03 matrix] ${sorted.length}/${A03_LEAF_OBSERVATION_COUNT} leaves · ` +
        `${
          new Set(sorted.map((o) => primaryKey(o.moduleId, o.viewportSlug))).size
        }/${A03_PRIMARY_RECORD_COUNT} primary records\n` +
        `[A03 matrix] observations JSON: ${outputFile}\n`,
    );
  });
});
