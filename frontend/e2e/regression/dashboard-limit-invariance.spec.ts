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

const RESERVATION_SCENARIOS = [32, 48, 64] as const;
const CONTRACTUAL_PAGER_RESERVE_PX = 64;

type StableReading = {
  readonly canvasBlockSize: number;
  readonly limit: number;
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

async function reservePager(
  page: Page,
  leaf: LeafTarget,
  scenario: (typeof RESERVATION_SCENARIOS)[number],
  label: string,
): Promise<void> {
  const reservedRegion = page
    .locator('[data-dashboard-adaptive-reserved-region="pager"] >> visible=true')
    .nth(leaf.scopeNth ?? 0);
  const internalControl = reservedRegion.locator("button >> visible=true").first();

  await expect(reservedRegion, `${label}: declared pager reservation`).toHaveCount(1);
  await expect(internalControl, `${label}: pager internal control`).toHaveCount(1);
  await reservedRegion.evaluate(
    (node, { reservePx, controlPx }) => {
      const element = node as HTMLElement;
      element.style.setProperty(
        "--dash-adaptive-pager-reserved-block-size",
        `${reservePx}px`,
      );
      element.style.setProperty("block-size", `${reservePx}px`, "important");
      element.style.setProperty("min-block-size", `${reservePx}px`, "important");
      element.style.setProperty("max-block-size", `${reservePx}px`, "important");
      element.style.setProperty("flex-basis", `${reservePx}px`, "important");
      element.style.setProperty("box-sizing", "border-box");

      const control = element.querySelector("button") as HTMLElement | null;
      if (!control) throw new Error("A05 pager internal control disappeared");
      control.style.setProperty("block-size", `${controlPx}px`, "important");
      control.style.setProperty("min-block-size", `${controlPx}px`, "important");
      control.style.setProperty("max-block-size", `${controlPx}px`, "important");
      control.style.setProperty("box-sizing", "border-box");
    },
    { reservePx: CONTRACTUAL_PAGER_RESERVE_PX, controlPx: scenario },
  );
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
  };
}

async function applyScenario(
  page: Page,
  leaf: LeafTarget,
  scenario: (typeof RESERVATION_SCENARIOS)[number],
  label: string,
): Promise<StableReading> {
  await page
    .locator('[data-a05-active-canvas="true"]')
    .evaluateAll((nodes) => {
      for (const node of nodes) node.removeAttribute("data-a05-active-canvas");
    });
  await visibleCanvas(page, leaf, label);
  await reservePager(page, leaf, scenario, label);
  return readStableState(page, leaf, label);
}

test.describe.configure({ mode: "serial" });

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

          const scenario32 = await applyScenario(page, leaf, 32, `${label}::32`);
          const requestsAfterReservation = paginationRequests;
          const scenario48 = await applyScenario(page, leaf, 48, `${label}::48`);
          const scenario64 = await applyScenario(page, leaf, 64, `${label}::64`);

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
          const hotReading = await applyScenario(page, leaf, 64, `${label}::hot-b`);
          expect(hotReading.limit, `${label}: hot viewport B limit`).toBeGreaterThan(0);

          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          if (leaf.prepare) await leaf.prepare(page);
          await expect(
            page.locator(`${leaf.rowSelectors.join(", ")} >> visible=true`).first(),
            `${label}: returned viewport A data row`,
          ).toBeVisible({ timeout: 30_000 });
          const returned = await applyScenario(page, leaf, 64, `${label}::hot-a`);
          expect(returned.limit, `${label}: A -> B -> A limit`).toBe(scenario64.limit);
          expect(
            returned.canvasBlockSize,
            `${label}: A -> B -> A rows canvas block-size`,
          ).toBe(scenario64.canvasBlockSize);

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
