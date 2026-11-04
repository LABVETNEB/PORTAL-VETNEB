import { expect, test } from "@playwright/test";

import { waitForLayoutSettled } from "../helpers/dashboard-geometry-matrix";
import { openSurface, readTable, V8_SURFACES, type V8TableReading } from "../helpers/drv-column-probe";

// ─────────────────────────────────────────────────────────────────────────────
// DRV V8 · DRV-01 contract. The columns of the five admin tables follow the width
// of the table frame (the Table wrapper), never the viewport. The 1280 px
// rail->drawer switch removes 176 px from the frame; a viewport breakpoint kept
// revealing columns while the frame shrank (6 columns / 0 truncated cells at 1279
// became 7 / up to 42 at 1280). Each contract below fails against that behaviour.
// ─────────────────────────────────────────────────────────────────────────────

const SWEEP = [800, 900, 960, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1920] as const;

for (const surface of V8_SURFACES) {
  test.describe(`DRV V8 container columns ${surface.id}`, () => {
    test("the same frame width yields the same columns under a different viewport", async ({ page }) => {
      const rail = { width: 1100, height: 800 };
      const drawer = { width: 1280, height: 800 };
      await openSurface(page, surface, rail, false, `${surface.id} rail`);
      const atRail = await readTable(page, surface.contentRootSelector);
      await page.setViewportSize(drawer);
      await waitForLayoutSettled(page);
      const atDrawer = await readTable(page, surface.contentRootSelector);
      expect(Math.abs(atRail.containerWidth - atDrawer.containerWidth)).toBeLessThan(1);
      expect(atDrawer.visibleColumnLabels).toEqual(atRail.visibleColumnLabels);
    });

    test("crossing 1279 to 1280 never adds columns or truncated cells", async ({ page }) => {
      await openSurface(page, surface, { width: 1279, height: 800 }, false, `${surface.id} 1279`);
      const before = await readTable(page, surface.contentRootSelector);
      await page.setViewportSize({ width: 1280, height: 800 });
      await waitForLayoutSettled(page);
      const after = await readTable(page, surface.contentRootSelector);
      expect(after.containerWidth).toBeLessThan(before.containerWidth);
      expect(after.columns.length).toBeLessThanOrEqual(before.columns.length);
      expect(after.truncatedCells).toBeLessThanOrEqual(before.truncatedCells);
    });

    test("columns are revealed monotonically as the frame grows and keep the table intact", async ({ page }) => {
      test.setTimeout(120_000);
      await openSurface(page, surface, { width: SWEEP[0], height: 800 }, false, `${surface.id} sweep`);
      const readings: V8TableReading[] = [];
      for (const width of SWEEP) {
        await page.setViewportSize({ width, height: 800 });
        await waitForLayoutSettled(page);
        readings.push(await readTable(page, surface.contentRootSelector));
      }
      readings.sort((a, b) => a.containerWidth - b.containerWidth);
      for (let index = 1; index < readings.length; index += 1) {
        const narrower = readings[index - 1];
        const wider = readings[index];
        for (const label of narrower.visibleColumnLabels) {
          expect(wider.visibleColumnLabels, `${label} stays visible from ${narrower.containerWidth} to ${wider.containerWidth}`).toContain(label);
        }
      }
      expect(readings[readings.length - 1].columns.length).toBeGreaterThan(readings[0].columns.length);
      for (const reading of readings) {
        expect(reading.containerType, "the frame is an inline-size container").toBe("inline-size");
        expect(reading.documentOverflowX, "no document horizontal overflow").toBeLessThanOrEqual(0);
        expect(reading.containerOverflowX, "no frame horizontal overflow").toBeLessThanOrEqual(1);
        expect(reading.actionsReachable, "row actions stay inside the frame").toBe(true);
        expect(reading.headerCellsAligned, "th and td stay aligned").toBe(true);
        expect(reading.rowHeight, "row height is not a V8 concern").toBe(readings[0].rowHeight);
        expect(reading.columns.some((column) => column.label.toLowerCase().includes("acci")), "the action column stays").toBe(true);
      }
    });

    test("long text keeps the frame without overflow in both layouts", async ({ page }) => {
      await openSurface(page, surface, { width: 1280, height: 800 }, true, `${surface.id} long`);
      const drawer = await readTable(page, surface.contentRootSelector);
      await page.setViewportSize({ width: 1279, height: 800 });
      await waitForLayoutSettled(page);
      const rail = await readTable(page, surface.contentRootSelector);
      for (const reading of [drawer, rail]) {
        expect(reading.documentOverflowX).toBeLessThanOrEqual(0);
        expect(reading.containerOverflowX).toBeLessThanOrEqual(1);
        expect(reading.headerCellsAligned).toBe(true);
        expect(reading.actionsReachable).toBe(true);
      }
      expect(drawer.truncatedCells).toBeLessThanOrEqual(rail.truncatedCells);
    });
  });
}
