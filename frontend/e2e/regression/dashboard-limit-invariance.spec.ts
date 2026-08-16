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

type PendingRequestMetadata = {
  readonly method: string;
  readonly resourceType: string;
  readonly origin: string;
  readonly pathname: string;
  readonly responseSeen: boolean;
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

/**
 * Data traffic, whatever the module's A03 pagination semantics.
 *
 * Render quiescence alone cannot prove a reading is coherent. A capacity change
 * refetches, and while that request flies the runtime keeps the PREVIOUS page
 * painted: the rows canvas is flex-allocated, so its block size does not depend
 * on the row count, and its subtree is not mutated. Both halves of the drained
 * render signature — descendant count and canvas block size — are therefore
 * constant across the whole flight, and a drained cycle can converge on the
 * cardinality the SUPERSEDED limit produced. `admin-audit-log` read `limit` 8
 * (viewport B's page) inside a viewport A canvas for exactly that reason.
 *
 * The filter is resource type, not `observer.requestPathname`, because
 * `client-slice` classifies how a consumer PAGES, not how it loads: several
 * client-sliced modules size their dataset fetch from the measured capacity
 * (`resolveTokensFetchLimit` in `ClinicParticularTokensCard`), so a viewport
 * change refetches and `usePagedRows` slices the previous array until it lands.
 * Scoping to the declared pathname left exactly those modules uncovered, which
 * is how `clinic-particular-tokens` read 7 rows of an 8-row page with the canvas
 * already back to its final block size.
 *
 * Documents, scripts, stylesheets and images are excluded so `next dev` chunk
 * traffic cannot starve the condition; HMR runs over a websocket and never
 * surfaces here. Settlement is what closes it: a reading is only accepted when
 * no data request started or settled during the cycle that produced it and none
 * is in flight — the same coupling `observeLeaf` already applies in A03.
 */
function isDataRequest(request: Request): boolean {
  const resourceType = request.resourceType();
  return resourceType === "fetch" || resourceType === "xhr";
}

type PaginationFlight = {
  /** Pagination requests observed since tracking began (assertion input). */
  readonly paginationStarted: () => number;
  /** Data requests observed since tracking began (coherence input). */
  readonly dataStarted: () => number;
  /** Data requests that finished or failed since tracking began. */
  readonly dataSettled: () => number;
  /** Resolves on the terminal event of every currently tracked request. */
  readonly waitForIdle: (label: string) => Promise<void>;
  readonly dispose: () => void;
};

type IdleWaiter = {
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

const DATA_IDLE_TIMEOUT_MS = 30_000;

function trackPaginationFlight(page: Page, observer: ModuleObserver): PaginationFlight {
  let paginationStarted = 0;
  let dataStarted = 0;
  let dataSettled = 0;
  let disposed = false;
  const trackedDataRequests = new Set<Request>();
  const responseSeen = new Set<Request>();
  const idleWaiters = new Set<IdleWaiter>();

  const pendingRequests = (): readonly PendingRequestMetadata[] =>
    [...trackedDataRequests].map((request) => {
      const url = new URL(request.url());
      return {
        method: request.method(),
        resourceType: request.resourceType(),
        origin: url.origin,
        pathname: url.pathname,
        responseSeen: responseSeen.has(request),
      };
    });

  const resolveIdle = () => {
    if (trackedDataRequests.size > 0) return;
    for (const waiter of idleWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
    idleWaiters.clear();
  };

  const onRequest = (request: Request) => {
    if (isPaginationRequest(request, observer)) paginationStarted += 1;
    if (isDataRequest(request)) {
      trackedDataRequests.add(request);
      dataStarted += 1;
    }
  };
  const onResponse = (response: { request: () => Request }) => {
    const request = response.request();
    if (trackedDataRequests.has(request)) responseSeen.add(request);
  };
  const onSettled = (request: Request) => {
    if (trackedDataRequests.delete(request)) {
      responseSeen.delete(request);
      dataSettled += 1;
      resolveIdle();
    }
  };

  const waitForIdle = (label: string) => {
    if (trackedDataRequests.size === 0) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      let waiter: IdleWaiter;
      const timer = setTimeout(() => {
        idleWaiters.delete(waiter);
        reject(
          new Error(
            `${label}: timed out after ${DATA_IDLE_TIMEOUT_MS}ms waiting for ` +
              `${trackedDataRequests.size} data request(s) to finish: ` +
              JSON.stringify(pendingRequests()),
          ),
        );
      }, DATA_IDLE_TIMEOUT_MS);
      waiter = { resolve, reject, timer };
      idleWaiters.add(waiter);
    });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    page.off("request", onRequest);
    page.off("response", onResponse);
    page.off("requestfinished", onSettled);
    page.off("requestfailed", onSettled);
    page.off("close", dispose);
    for (const waiter of idleWaiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("A05 data request tracker disposed before becoming idle"));
    }
    idleWaiters.clear();
    trackedDataRequests.clear();
    responseSeen.clear();
  };

  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfinished", onSettled);
  page.on("requestfailed", onSettled);
  page.once("close", dispose);

  return {
    paginationStarted: () => paginationStarted,
    dataStarted: () => dataStarted,
    dataSettled: () => dataSettled,
    waitForIdle,
    dispose,
  };
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

/** Bounded fail-closed budget for the coherence condition below. */
const STABLE_READING_ATTEMPTS = 8;

async function readStableState(
  page: Page,
  leaf: LeafTarget,
  label: string,
  flight: PaginationFlight,
): Promise<StableReading> {
  for (let attempt = 0; attempt < STABLE_READING_ATTEMPTS; attempt += 1) {
    // Render convergence cannot finish a request. Bind the read to the exact
    // terminal events observed by this tracker before draining the UI.
    await flight.waitForIdle(`${label}: before stable read`);
    const startedBefore = flight.dataStarted();
    const settledBefore = flight.dataSettled();

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

    const reading: StableReading = {
      canvasBlockSize: roundSubpixel(box?.height ?? 0),
      limit: await rows.count(),
      pager: await readPagerReservation(page, leaf, label),
    };

    // Coherence, not duration: the drained cycle that produced this reading
    // must have crossed NO pagination boundary and must leave nothing in
    // flight. A cycle that did is discarded and re-run — the reading it
    // produced describes the limit the runtime has already superseded.
    // Steady state satisfies this on the first attempt, so the common path
    // costs exactly what it did before.
    if (
      flight.dataStarted() === startedBefore &&
      flight.dataSettled() === settledBefore &&
      flight.dataStarted() === flight.dataSettled()
    ) {
      return reading;
    }
  }

  throw new Error(
    `${label}: data never settled — ${STABLE_READING_ATTEMPTS} drained cycles ` +
      `each crossed a data request boundary or left one in flight ` +
      `(started=${flight.dataStarted()} settled=${flight.dataSettled()})`,
  );
}

async function applyScenario(
  page: Page,
  leaf: LeafTarget,
  scenario: (typeof INTERNAL_CONTROL_SCENARIOS)[number],
  label: string,
  flight: PaginationFlight,
): Promise<StableReading> {
  await page
    .locator('[data-a05-active-canvas="true"]')
    .evaluateAll((nodes) => {
      for (const node of nodes) node.removeAttribute("data-a05-active-canvas");
    });
  await visibleCanvas(page, leaf, label);
  await driveInternalControl(page, leaf, scenario, label);
  const reading = await readStableState(page, leaf, label, flight);

  console.log(
    `[A05 observation] ${label} · CONTROL=${scenario}px` +
      ` · PAGER_BLOCK_SIZE=${reading.pager.blockSize}` +
      ` · PAGER_COMPUTED_BLOCK_SIZE=${reading.pager.computedBlockSize}` +
      ` · PAGER_MIN_BLOCK_SIZE=${reading.pager.minBlockSize}` +
      ` · PAGER_MAX_BLOCK_SIZE=${reading.pager.maxBlockSize}` +
      ` · PAGER_FLEX_BASIS=${reading.pager.flexBasis}` +
      ` · ROWS_CANVAS_BLOCK_SIZE=${reading.canvasBlockSize}` +
      ` · LIMIT=${reading.limit}` +
      ` · PAGINATION_REQUESTS=${flight.paginationStarted()}` +
      ` · DATA_REQUESTS=${flight.dataStarted()}`,
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

        for (const leaf of observer.leaves) {
          const label = `${moduleId}::${viewport.slug}${leaf.variantId ? `::${leaf.variantId}` : ""}`;
          console.log(`[A05 invariance] → ${label}`);
          const flight = trackPaginationFlight(page, observer);

          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await observeLeaf(page, observer, leaf, viewport.slug);
          await visibleCanvas(page, leaf, label);

          const scenario32 = await applyScenario(page, leaf, 32, `${label}::32`, flight);
          const requestsAfterReservation = flight.paginationStarted();
          const scenario48 = await applyScenario(page, leaf, 48, `${label}::48`, flight);
          const scenario64 = await applyScenario(page, leaf, 64, `${label}::64`, flight);

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
            flight.paginationStarted(),
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
          const hotReading = await applyScenario(page, leaf, 64, `${label}::hot-b`, flight);
          expect(hotReading.limit, `${label}: hot viewport B limit`).toBeGreaterThan(0);

          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          if (leaf.prepare) await leaf.prepare(page);
          await expect(
            page.locator(`${leaf.rowSelectors.join(", ")} >> visible=true`).first(),
            `${label}: returned viewport A data row`,
          ).toBeVisible({ timeout: 30_000 });
          const returned = await applyScenario(page, leaf, 64, `${label}::hot-a`, flight);
          expect(returned.limit, `${label}: A -> B -> A limit`).toBe(scenario64.limit);
          expect(
            returned.canvasBlockSize,
            `${label}: A -> B -> A rows canvas block-size`,
          ).toBe(scenario64.canvasBlockSize);
          expect(
            returned.pager.blockSize,
            `${label}: A -> B -> A pager reservation`,
          ).toBe(scenario64.pager.blockSize);

          flight.dispose();
          coveredLeaves += 1;
        }
      }

      expect(coveredLeaves).toBe(
        observer.leaves.length * DASHBOARD_GEOMETRY_VIEWPORTS.length,
      );
    });
  }
});
