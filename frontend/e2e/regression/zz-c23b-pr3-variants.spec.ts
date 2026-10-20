// TEMPORARY C23b/PR3 variant probe — never committed, deleted after use.
import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

import {
  assertSurfaceLoaded,
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_GEOMETRY_VIEWPORTS,
  installSurfaceMocks,
  measureSurfaceGeometry,
  resizeSurfaceViewport,
  suppressNextDevChrome,
  trackDataRequests,
  waitForLayoutSettled,
} from "../helpers/dashboard-geometry-matrix";
import { addAppCookies } from "../helpers/session";

const surface = DASHBOARD_GEOMETRY_SURFACES.find((s) => s.id === "clinic-informes-full")!;
const FILTERS = '[aria-label="Filtros compactos de informes"]';
const CONTENT = '.dashboard-surface[data-informes-workspace="true"] > :last-child';

// V1: the "Más filtros" trigger duplicates the inline fields from lg; hide it there.
// V2: V1 + card content rhythm 16 -> 8 px from md.
const MORE = `@media (min-width:1024px){ ${FILTERS} > [data-probe-more] { display:none !important } }`;
const RHYTHM = `@media (min-width:768px) and (min-height:761px){ ${CONTENT} { padding-top:8px !important; row-gap:8px !important } }`;
const LABELS = `@media (min-width:1024px){ ${FILTERS} label > span:first-child { position:absolute !important; width:1px !important; height:1px !important; overflow:hidden !important; clip:rect(0,0,0,0) !important; white-space:nowrap !important } }`;
const INLINE = `@media (min-width:1024px){ ${FILTERS} label { grid-template-columns:auto minmax(0,1fr) !important; align-items:center !important; column-gap:6px !important } }`;
const VARIANTS: Record<string, string> = { V5: MORE + RHYTHM + INLINE };

for (const [name, css] of Object.entries(VARIANTS)) {
  test(`variant ${name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await suppressNextDevChrome(page);
    await clearDashboardModuleMemory(page);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role]]);
    await installSurfaceMocks(page, surface);
    const [entry] = DASHBOARD_GEOMETRY_VIEWPORTS;
    await page.setViewportSize({ width: entry.width, height: entry.height });
    await page.goto(surface.route);
    await expect(page.locator(surface.readinessSelector).first()).toBeVisible({ timeout: 25_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 });
    await page.evaluate((sel) => {
      const more = [...document.querySelectorAll(`${sel} > *`)].find((n) => n.textContent?.trim() === "Más filtros");
      more?.setAttribute("data-probe-more", "true");
    }, FILTERS);
    if (css) await page.addStyleTag({ content: css });
    const flight = trackDataRequests(page);
    const out: unknown[] = [];
    try {
      for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS) {
        if (viewport !== entry) await resizeSurfaceViewport(page, surface, viewport, flight);
        await assertSurfaceLoaded(page, surface, viewport.slug);
        await waitForLayoutSettled(page);
        const record = await measureSurfaceGeometry(page, surface, viewport, flight);
        const extra = await page.evaluate((sel) => {
          const filters = document.querySelector(sel)!;
          const kids = [...filters.children].map((k) => {
            const b = k.getBoundingClientRect();
            return { t: (k.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 20), y: +b.y.toFixed(1), h: +b.height.toFixed(1), w: +b.width.toFixed(1), shown: k.getClientRects().length > 0 };
          });
          const canvas = document.querySelector('[data-informes-rows-canvas="true"]');
          const doc = document.scrollingElement!;
          const clipped = [...filters.querySelectorAll("input,select,button")].filter((n) => (n as HTMLElement).offsetWidth > 0).map((n) => ({ w: (n as HTMLElement).offsetWidth, sw: (n as HTMLElement).scrollWidth, h: (n as HTMLElement).offsetHeight }));
          const pager = document.querySelector('[aria-label="Paginación de informes"]');
          return {
            filtersH: +filters.getBoundingClientRect().height.toFixed(2),
            kids,
            rows: canvas ? canvas.querySelectorAll(":scope > *").length : 0,
            pager: pager?.textContent?.replace(/\s+/g, " ").trim(),
            clipped,
            docScroll: [doc.scrollHeight - doc.clientHeight, doc.scrollWidth - doc.clientWidth],
          };
        }, FILTERS);
        if (["w1024x768","w1280x720"].includes(viewport.slug)) await page.screenshot({ path: `${process.env.C23B_PROBE_DIR}/shots/${name}-${viewport.slug}.png` });
        out.push({ slug: viewport.slug, chromePx: record.derived.chromeBeforePrimaryContentPx, ratio: record.derived.chromeBeforePrimaryContentRatio, canvasH: record.derived.collectionCanvasHeight, ...extra });
      }
    } finally {
      flight.dispose();
    }
    await writeFile(`${process.env.C23B_PROBE_DIR}/variant-${name}.json`, JSON.stringify(out, null, 1));
  });
}
