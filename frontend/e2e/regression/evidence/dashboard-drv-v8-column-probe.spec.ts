import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { openSurface, readTable, V8_SURFACES } from "../../helpers/drv-column-probe";

// ─────────────────────────────────────────────────────────────────────────────
// DRV V8 · DRV-01 column / truncation probe. Evidence generator, not a gate: for
// each of the five admin tables and each probe viewport it records the table
// container width, the visible columns, their computed widths, the real text
// truncation of every visible cell (scrollWidth > clientWidth on an element that
// clips), the row/header/pager geometry, the request `limit` and the document
// overflow. Set DRV_V8_OUT to write one JSON per surface/dataset/viewport and
// DRV_V8_SWEEP=1 to add twelve intermediate widths and DRV_V8_SHOTS to save full-viewport PNGs
// at 1279, 1280, 1366 and 1920 (populated dataset). The container-driven and
// monotonic contracts live in e2e/regression/dashboard-drv-v8-container-columns.spec.ts.
// ─────────────────────────────────────────────────────────────────────────────

const V8_PROBE_VIEWPORTS = [
  { width: 768, height: 1024 },
  { width: 834, height: 1194 },
  { width: 1024, height: 768 },
  { width: 1279, height: 800 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 945 },
] as const;

const SWEEP_WIDTHS = [800, 900, 960, 1100, 1200, 1250, 1300, 1330, 1400, 1500, 1600, 1700] as const;
const PROBE_VIEWPORT_SET = process.env.DRV_V8_SWEEP
  ? [...V8_PROBE_VIEWPORTS, ...SWEEP_WIDTHS.map((width) => ({ width, height: 800 }))]
  : V8_PROBE_VIEWPORTS;

const DATASETS = [
  { slug: "fixture", title: "populated", longText: false },
  { slug: "long", title: "long-text", longText: true },
] as const;

test.describe("DRV V8 column and truncation probe", () => {
  test.describe.configure({ mode: "serial" });

  for (const surface of V8_SURFACES) {
    for (const dataset of DATASETS) {
      for (const viewport of PROBE_VIEWPORT_SET) {
        const label = `${surface.id} ${dataset.title} ${viewport.width}x${viewport.height}`;
        test(`V8 probe ${label}`, async ({ page }, testInfo) => {
          const { limits } = await openSurface(page, surface, viewport, dataset.longText, label);
          const reading = await readTable(page, surface.contentRootSelector);
          expect(reading.viewportWidth, `${label}: applied viewport`).toBe(viewport.width);
          const record = {
            schema: "drv-v8-column-record/1",
            surface: surface.id,
            dataset: dataset.slug,
            viewport: `${viewport.width}x${viewport.height}`,
            reading,
            requests: limits.slice(-4),
          };
          const body = JSON.stringify(record, null, 2);
          await testInfo.attach(`drv-v8-${surface.id}-${dataset.slug}-${viewport.width}.json`, {
            body,
            contentType: "application/json",
          });
          const outDir = process.env.DRV_V8_OUT;
          if (outDir) {
            await mkdir(outDir, { recursive: true });
            await writeFile(path.join(outDir, `${surface.id}-${dataset.slug}-${viewport.width}x${viewport.height}.json`), body);
          }
          const shotsDir = process.env.DRV_V8_SHOTS;
          if (shotsDir && !dataset.longText && [1279, 1280, 1366, 1920].includes(viewport.width)) {
            await mkdir(shotsDir, { recursive: true });
            await page.screenshot({ path: path.join(shotsDir, `${surface.id}-${viewport.width}x${viewport.height}.png`) });
          }
          expect(reading.found, `${label}: a table is mounted`).toBe(true);
        });
      }
    }
  }
});
