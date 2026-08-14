import { expect, test, type Locator, type Page, type Request } from "@playwright/test";

import { DASHBOARD_GEOMETRY_VIEWPORTS } from "../helpers/dashboard-geometry-matrix";
import {
  A03_MODULE_IDS,
  A03_OBSERVERS,
  observeLeaf,
  prepareContext,
  resolveVisibleRows,
  waitForAdaptiveConvergence,
  type LeafTarget,
  type ModuleObserver,
} from "../helpers/dashboard-adaptive-limit-matrix";

/**
 * Block sizes forced onto the pager's own INTERNAL control. They are the
 * independent variable of this contract and nothing else is mutated.
 *
 * A05 previously also pinned the reserved region itself to a contractual
 * `block-size/min-block-size/max-block-size/flex-basis` of 64px with
 * `!important`. That FABRICATED the very reservation under test: any consumer
 * whose production CSS reserves nothing still measured a rock-stable 64px
 * region, so the suite reported invariance for surfaces that visibly moved
 * their rows canvas in production. The region is now read, never written.
 */
const INTERNAL_CONTROL_SCENARIOS = [32, 48, 64] as const;

type PagerReservation = {
  /** Used layout height of the reserved region (production geometry). */
  readonly blockSize: number;
  readonly computedBlockSize: string;
  readonly minBlockSize: string;
  readonly maxBlockSize: string;
  readonly flexBasis: string;
};

type StableReading = {
  readonly canvasBlockSize: number;
  readonly limit: number;
  readonly pager: PagerReservation;
};

function roundSubpixel(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function isPaginationRequest(request: Request, observer: ModuleObserver): boolean {
  if (observer.source !== "server-request" || !observer.requestPathname) {
    return false;
  }

  const url = new URL(request.url());
  return url.pathname === observer.requestPathname;
}

async function visibleCanvas(
  page: Page,
  leaf: LeafTarget,
  label: string,
): Promise<Locator> {
  const rows = await resolveVisibleRows(page, leaf.rowSelectors, label);
  const canvas = rows
    .first()
    .locator('xpath=ancestor::*[@data-dashboard-adaptive-rows-canvas="true"][1]');

  await expect(canvas, `${label}: A05 measured canvas`).toHaveCount(1);
  await canvas.evaluate((node) => node.setAttribute("data-a05-active-canvas", "true"));
  return canvas;
}

function pagerRegion(page: Page, leaf: LeafTarget): Locator {
  return page
    .locator('[data-dashboard-adaptive-reserved-region="pager"] >> visible=true')
    .nth(leaf.scopeNth ?? 0);
}

/**
 * Grows the pager's own internal control. The reserved region is NOT touched:
 * whether it absorbs the growth or passes it on to the rows canvas is exactly
 * what the contract measures.
 */
async function driveInternalControl(
  page: Page,
  leaf: LeafTarget,
  scenario: (typeof INTERNAL_CONTROL_SCENARIOS)[number],
  label: string,
): Promise<void> {
  const reservedRegion = pagerRegion(page, leaf);
  const internalControl = reservedRegion.locator("button >> visible=true").first();

  await expect(reservedRegion, `${label}: declared pager reservation`).toHaveCount(1);
  await expect(internalControl, `${label}: pager internal control`).toHaveCount(1);
  await internalControl.evaluate((node, controlPx) => {
    const control = node as HTMLElement;
    control.style.setProperty("block-size", `${controlPx}px`, "important");
    control.style.setProperty("min-block-size", `${controlPx}px`, "important");
    control.style.setProperty("max-block-size", `${controlPx}px`, "important");
    control.style.setProperty("box-sizing", "border-box");
  }, scenario);
}

async function readPagerReservation(
  page: Page,
  leaf: LeafTarget,
  label: string,
): Promise<PagerReservation> {
  const reservedRegion = pagerRegion(page, leaf);
  const box = await reservedRegion.boundingBox();
  expect(box, `${label}: pager reservation bounds`).not.toBeNull();

  const computed = await reservedRegion.evaluate((node) => {
    const style = getComputedStyle(node as HTMLElement);
    return {
      computedBlockSize: style.blockSize,
      minBlockSize: style.minBlockSize,
      maxBlockSize: style.maxBlockSize,
      flexBasis: style.flexBasis,
    };
  });

  return { blockSize: roundSubpixel(box?.height ?? 0), ...computed };
}

async function readStableState(
  page: Page,
  leaf: LeafTarget,
  label: string,
): Promise<StableReading> {
  await waitForAdaptiveConvergence(
    page,
    '[data-a05-active-canvas="true"]',
    label,
    0,
  );
  await page.waitForLoadState("networkidle");
  await waitForAdaptiveConvergence(
    page,
    '[data-a05-active-canvas="true"]',
    label,
    0,
  );

  const rows = await resolveVisibleRows(page, leaf.rowSelectors, label);
  const canvas = page.locator('[data-a05-active-canvas="true"]');
  const box = await canvas.boundingBox();
  expect(box, `${label}: rows canvas bounds`).not.toBeNull();

  return {
    canvasBlockSize: roundSubpixel(box?.height ?? 0),
    limit: await rows.count(),
    pager: await readPagerReservation(page, leaf, label),
  };
}

async function applyScenario(
  page: Page,
  leaf: LeafTarget,
  scenario: (typeof INTERNAL_CONTROL_SCENARIOS)[number],
  label: string,
  paginationRequests: () => number,
): Promise<StableReading> {
  await page
    .locator('[data-a05-active-canvas="true"]')
    .evaluateAll((nodes) => {
      for (const node of nodes) node.removeAttribute("data-a05-active-canvas");
    });
  await visibleCanvas(page, leaf, label);
  await driveInternalControl(page, leaf, scenario, label);
  const reading = await readStableState(page, leaf, label);

  console.log(
    `[A05 observation] ${label} · CONTROL=${scenario}px` +
      ` · PAGER_BLOCK_SIZE=${reading.pager.blockSize}` +
      ` · PAGER_COMPUTED_BLOCK_SIZE=${reading.pager.computedBlockSize}` +
      ` · PAGER_MIN_BLOCK_SIZE=${reading.pager.minBlockSize}` +
      ` · PAGER_MAX_BLOCK_SIZE=${reading.pager.maxBlockSize}` +
      ` · PAGER_FLEX_BASIS=${reading.pager.flexBasis}` +
      ` · ROWS_CANVAS_BLOCK_SIZE=${reading.canvasBlockSize}` +
      ` · LIMIT=${reading.limit}` +
      ` · PAGINATION_REQUESTS=${paginationRequests()}`,
  );

  return reading;
}

// Deliberately NOT serial. The serial mode existed because capacity was
// path-dependent: a leaf that had drifted could poison the next one, so the
// suite was forced onto a single worker and, worse, a failure SKIPPED every
// module after it. Neither reason survives the pitch-locked engine — capacity
// is a function of the geometry alone — and these tests share nothing: each
// owns its `page` fixture and browser context, `prepareContext` re-establishes
// cookies per test, there is no `beforeAll`, no module-level state and no file
// written between tests. Serialising 15 independent module matrices is what
// made `E2E Completeness` approach its 1800 s budget.
test.describe("A05 · stable geometry reservation limit invariance", () => {
  for (const moduleId of A03_MODULE_IDS) {
    const observer = A03_OBSERVERS[moduleId];

    test(`${moduleId} · 13 viewports · 32/48/64 · hot resize`, async ({ page }) => {
      test.setTimeout(1_200_000);
      await prepareContext(page, observer);

      let coveredLeaves = 0;
      for (let viewportIndex = 0; viewportIndex < DASHBOARD_GEOMETRY_VIEWPORTS.length; viewportIndex += 1) {
        const viewport = DASHBOARD_GEOMETRY_VIEWPORTS[viewportIndex];
        const hotViewport =
          DASHBOARD_GEOMETRY_VIEWPORTS[
            (viewportIndex + 1) % DASHBOARD_GEOMETRY_VIEWPORTS.length
          ];

        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        for (const leaf of observer.leaves) {
          const label = `${moduleId}::${viewport.slug}${leaf.variantId ? `::${leaf.variantId}` : ""}`;
          console.log(`[A05 invariance] → ${label}`);
          await observeLeaf(page, observer, leaf, viewport.slug);
          await visibleCanvas(page, leaf, label);

          let paginationRequests = 0;
          const countPaginationRequest = (request: Request) => {
            if (isPaginationRequest(request, observer)) paginationRequests += 1;
          };
          page.on("request", countPaginationRequest);

          const readRequests = () => paginationRequests;
          const scenario32 = await applyScenario(page, leaf, 32, `${label}::32`, readRequests);
          const requestsAfterReservation = paginationRequests;
          const scenario48 = await applyScenario(page, leaf, 48, `${label}::48`, readRequests);
          const scenario64 = await applyScenario(page, leaf, 64, `${label}::64`, readRequests);

          // The reservation is the primitive under test: a region that grows
          // with its own content is the defect, and it is what steals the
          // rows canvas 1:1 and flips the adaptive limit.
          expect(
            scenario48.pager.blockSize,
            `${label}: 32px -> 48px pager reservation`,
          ).toBe(scenario32.pager.blockSize);
          expect(
            scenario64.pager.blockSize,
            `${label}: 48px -> 64px pager reservation`,
          ).toBe(scenario48.pager.blockSize);
          expect(scenario48.limit, `${label}: 32px -> 48px limit`).toBe(
            scenario32.limit,
          );
          expect(scenario64.limit, `${label}: 48px -> 64px limit`).toBe(
            scenario48.limit,
          );
          expect(scenario48.canvasBlockSize, `${label}: 32px -> 48px canvas`).toBe(
            scenario32.canvasBlockSize,
          );
          expect(scenario64.canvasBlockSize, `${label}: 48px -> 64px canvas`).toBe(
            scenario48.canvasBlockSize,
          );
          expect(
            paginationRequests,
            `${label}: internal pager geometry must emit no pagination request`,
          ).toBe(requestsAfterReservation);

          await page.setViewportSize({
            width: hotViewport.width,
            height: hotViewport.height,
          });
          if (leaf.prepare) await leaf.prepare(page);
          await expect(
            page.locator(`${leaf.rowSelectors.join(", ")} >> visible=true`).first(),
            `${label}: hot viewport B data row`,
          ).toBeVisible({ timeout: 30_000 });
          const hotReading = await applyScenario(page, leaf, 64, `${label}::hot-b`, readRequests);
          expect(hotReading.limit, `${label}: hot viewport B limit`).toBeGreaterThan(0);

          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          if (leaf.prepare) await leaf.prepare(page);
          await expect(
            page.locator(`${leaf.rowSelectors.join(", ")} >> visible=true`).first(),
            `${label}: returned viewport A data row`,
          ).toBeVisible({ timeout: 30_000 });
          const returned = await applyScenario(page, leaf, 64, `${label}::hot-a`, readRequests);
          expect(returned.limit, `${label}: A -> B -> A limit`).toBe(scenario64.limit);
          expect(
            returned.canvasBlockSize,
            `${label}: A -> B -> A rows canvas block-size`,
          ).toBe(scenario64.canvasBlockSize);
          expect(
            returned.pager.blockSize,
            `${label}: A -> B -> A pager reservation`,
          ).toBe(scenario64.pager.blockSize);

          page.off("request", countPaginationRequest);
          coveredLeaves += 1;
        }
      }

      expect(coveredLeaves).toBe(
        observer.leaves.length * DASHBOARD_GEOMETRY_VIEWPORTS.length,
      );
    });
  }
});
