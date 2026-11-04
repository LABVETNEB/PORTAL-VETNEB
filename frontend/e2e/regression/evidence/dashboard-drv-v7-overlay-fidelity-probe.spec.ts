import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import {
  assertSurfaceLoaded,
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACES,
  installSurfaceMocks,
  settleRenderAndData,
  suppressNextDevChrome,
  surfaceMeasurementRoots,
  trackDataRequests,
  waitForLayoutSettled,
  type DashboardGeometrySurface,
} from "../../helpers/dashboard-geometry-matrix";
import {
  classifyMetric,
  tallyBy,
  validateDriveReference,
  type DriveReference,
  type FidelityResult,
  type MeasuredValue,
} from "../../helpers/drive-fidelity";
import { addAppCookies } from "../../helpers/session";
import { NORMAL_THEME_MODE, THEME_STORAGE_KEY } from "../../../src/lib/theme";

// ─────────────────────────────────────────────────────────────────────────────
// DRV V7 · overlay fidelity probe (menus, tooltip, filter popover). Same
// classifier, statuses and instrument/visual separation as the V1 probe; its own
// reference (e2e/fixtures/drive-ui-reference.v7-overlays.json) and records, so the
// V1 semantics stay untouched. Evidence generator, not a gate on visual
// difference: what fails is the instrument (an unread metric, an unparseable
// colour), a side effect (mutating request, URL change) or a functional contract
// of the overlay itself (focus in/out, Escape, aria relations, viewport bounds,
// contrast, no native title duplicate).
//
// It opens a menu and a tooltip and closes both; it selects nothing, applies no
// filter and never touches data. Set DRV_V7_OUT to also write records to disk.
// ─────────────────────────────────────────────────────────────────────────────

const REFERENCE_PATH = path.resolve(process.cwd(), "e2e/fixtures/drive-ui-reference.v7-overlays.json");

const PROBE_VIEWPORTS = [
  { slug: "w1920x945", width: 1920, height: 945 },
  { slug: "w1920x1080", width: 1920, height: 1080 },
  { slug: "w1440x900", width: 1440, height: 900 },
  { slug: "w1366x768", width: 1366, height: 768 },
  { slug: "w1280x800", width: 1280, height: 800 },
  { slug: "w1024x768", width: 1024, height: 768 },
] as const;

const PROBE_SURFACE_IDS = ["admin-auditoria", "admin-informes", "clinic-informes"] as const;
const PROBE_SURFACES = PROBE_SURFACE_IDS.map((id) => {
  const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === id);
  if (!surface) throw new Error(`DRV V7: surface ${id} is not an A02 surface`);
  return surface as DashboardGeometrySurface;
});

const MENU_IDS = [
  "menu.surface.background",
  "menu.surface.radius",
  "menu.surface.boxShadow",
  "menu.surface.paddingBlock",
  "menu.item.height",
  "menu.item.paddingInline",
  "menu.item.fontSize",
  "menu.item.fontWeight",
  "menu.item.lineHeight",
] as const;
const TOOLTIP_IDS = [
  "tooltip.background",
  "tooltip.color",
  "tooltip.fontSize",
  "tooltip.fontWeight",
  "tooltip.lineHeight",
  "tooltip.letterSpacing",
  "tooltip.radius",
  "tooltip.padding",
  "tooltip.boxShadow",
] as const;
const FILTER_POPOVER_IDS = ["filterPopover.radius", "filterPopover.item.height", "filterPopover.paddingBlock"] as const;

type Reading = { readings: Record<string, MeasuredValue>; inventory: Record<string, unknown> };

/** In-page toolkit shared by both readers: painted colour through a 2D canvas, WCAG contrast. */
const TOOLKIT = `
  const canvas = document.createElement("canvas");
  canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const round = (value) => Math.round(value * 100) / 100;
  const isTransparent = (color) => /^rgba\\(0, 0, 0, 0\\)$|^transparent$/.test(color);
  const paint = (layers, foreground) => {
    ctx.globalAlpha = 1; ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 1, 1);
    for (const layer of [...layers, ...(foreground ? [foreground] : [])]) { ctx.fillStyle = layer; ctx.fillRect(0, 0, 1, 1); }
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  };
  const stack = (element) => {
    const chain = [];
    for (let node = element; node; node = node.parentElement) chain.unshift(node);
    return chain.map((node) => getComputedStyle(node).backgroundColor).filter((color) => !isTransparent(color));
  };
  const rgb = ([r, g, b]) => "rgb(" + r + ", " + g + ", " + b + ")";
  const background = (element) => rgb(paint(stack(element)));
  const foreground = (element) => rgb(paint(stack(element), getComputedStyle(element).color));
  const lum = ([r, g, b]) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return round((hi + 0.05) / (lo + 0.05)); };
  const css = (element, property) => getComputedStyle(element).getPropertyValue(property);
`;

async function readMenu(page: Page): Promise<Reading> {
  return page.evaluate(`(() => {
    ${TOOLKIT}
    const menu = document.querySelector('[role="menu"][data-action-menu-surface="root"]');
    const readings = {}; const inventory = {};
    if (!menu) return { readings, inventory: { present: false } };
    const items = Array.from(menu.querySelectorAll(':scope > [role="menuitem"]'));
    const enabled = items.filter((item) => item.getAttribute("aria-disabled") !== "true");
    const disabled = items.filter((item) => item.getAttribute("aria-disabled") === "true");
    const sample = enabled[0] ?? items[0];
    const rect = menu.getBoundingClientRect();
    readings["menu.surface.background"] = background(menu);
    readings["menu.surface.radius"] = css(menu, "border-top-left-radius");
    readings["menu.surface.boxShadow"] = css(menu, "box-shadow");
    readings["menu.surface.paddingBlock"] = css(menu, "padding-top") + " " + css(menu, "padding-bottom");
    readings["menu.item.height"] = sample ? round(sample.getBoundingClientRect().height) : null;
    readings["menu.item.paddingInline"] = sample ? css(sample, "padding-left") + " " + css(sample, "padding-right") : null;
    readings["menu.item.fontSize"] = sample ? css(sample, "font-size") : null;
    readings["menu.item.fontWeight"] = sample ? css(sample, "font-weight") : null;
    readings["menu.item.lineHeight"] = sample ? css(sample, "line-height") : null;
    const bg = paint(stack(menu));
    const textContrast = (item) => { const m = /rgba?\\((\\d+), (\\d+), (\\d+)/.exec(foreground(item)); return m ? contrast([+m[1], +m[2], +m[3]], bg) : null; };
    const active = document.activeElement;
    const ring = active instanceof HTMLElement ? getComputedStyle(active) : null;
    Object.assign(inventory, {
      present: true,
      itemCount: items.length, enabledCount: enabled.length, disabledCount: disabled.length,
      disabledHeights: disabled.map((item) => round(item.getBoundingClientRect().height)),
      subMenuItems: menu.querySelectorAll('[aria-haspopup="menu"]').length,
      minWidth: css(menu, "min-width"), width: round(rect.width), height: round(rect.height),
      rect: [round(rect.x), round(rect.y), round(rect.right), round(rect.bottom)],
      insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= document.documentElement.clientWidth && rect.bottom <= document.documentElement.clientHeight,
      outlineColor: css(menu, "outline-color"), outlineStyle: css(menu, "outline-style"),
      focusInsideMenu: Boolean(active && menu.contains(active)),
      focusedRole: active ? active.getAttribute("role") : null,
      focusRing: ring ? { outlineStyle: ring.outlineStyle, boxShadow: ring.boxShadow } : null,
      enabledTextContrast: enabled[0] ? textContrast(enabled[0]) : null,
      disabledTextContrast: disabled[0] ? textContrast(disabled[0]) : null,
      labelledBy: menu.getAttribute("aria-labelledby"),
      parent: menu.parentElement ? (menu.parentElement.matches('[data-dashboard-portal-root="true"]') ? "dashboard-portal-root" : menu.parentElement.tagName.toLowerCase()) : null,
      insideAppShell: Boolean(menu.closest(".dashboard-app-shell")),
    });
    return { readings, inventory };
  })()`) as Promise<Reading>;
}

async function readTooltip(page: Page): Promise<Reading> {
  return page.evaluate(`(() => {
    ${TOOLKIT}
    const tip = document.querySelector('[role="tooltip"][data-dashboard-tooltip="true"]');
    const readings = {}; const inventory = {};
    if (!tip) return { readings, inventory: { present: false } };
    const rect = tip.getBoundingClientRect();
    const trigger = document.querySelector('[aria-describedby="' + tip.id + '"]');
    readings["tooltip.background"] = background(tip);
    readings["tooltip.color"] = foreground(tip);
    readings["tooltip.fontSize"] = css(tip, "font-size");
    readings["tooltip.fontWeight"] = css(tip, "font-weight");
    readings["tooltip.lineHeight"] = css(tip, "line-height");
    readings["tooltip.letterSpacing"] = css(tip, "letter-spacing");
    readings["tooltip.radius"] = css(tip, "border-top-left-radius");
    readings["tooltip.padding"] = css(tip, "padding-top") + " " + css(tip, "padding-left");
    readings["tooltip.boxShadow"] = css(tip, "box-shadow");
    const fg = /rgba?\\((\\d+), (\\d+), (\\d+)/.exec(foreground(tip));
    Object.assign(inventory, {
      present: true,
      text: tip.textContent,
      rect: [round(rect.x), round(rect.y), round(rect.right), round(rect.bottom)],
      insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= document.documentElement.clientWidth && rect.bottom <= document.documentElement.clientHeight,
      contrast: fg ? contrast([+fg[1], +fg[2], +fg[3]], paint(stack(tip))) : null,
      describedByTrigger: Boolean(trigger),
      triggerHasTitle: trigger ? trigger.hasAttribute("title") : null,
      triggerName: trigger ? trigger.getAttribute("aria-label") : null,
      triggerFocused: Boolean(trigger && document.activeElement === trigger),
      outlineStyle: css(tip, "outline-style"),
      transitionDuration: css(tip, "transition-duration"),
    });
    return { readings, inventory };
  })()`) as Promise<Reading>;
}

let reference: DriveReference;

test.beforeAll(async () => {
  reference = JSON.parse(await readFile(REFERENCE_PATH, "utf8")) as DriveReference;
  expect(validateDriveReference(reference), "Drive overlay reference is well formed").toEqual([]);
});

test.describe("DRV V7 · Google Drive overlay fidelity probe", () => {
  for (const surface of PROBE_SURFACES) {
    for (const viewport of PROBE_VIEWPORTS) {
      test(`${surface.id} @ ${viewport.slug}`, async ({ page }, testInfo) => {
        test.setTimeout(90_000);
        const label = `${surface.id} @ ${viewport.slug}`;

        let probePhase = "load";
        const mutatingRequests: { phase: string; request: string }[] = [];
        page.on("request", (request) => {
          if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
            mutatingRequests.push({ phase: probePhase, request: `${request.method()} ${new URL(request.url()).pathname}` });
          }
        });

        await suppressNextDevChrome(page);
        await clearDashboardModuleMemory(page);
        await page.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
          [THEME_STORAGE_KEY, NORMAL_THEME_MODE] as const,
        );
        await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
        await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role]]);
        await installSurfaceMocks(page, surface);
        const flight = trackDataRequests(page);

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const navigation = await page.goto(surface.route);
        expect(navigation?.ok(), `${label}: document response`).toBe(true);
        await expect(page.locator(surface.readinessSelector).first(), `${label}: readiness`).toBeVisible({ timeout: 25_000 });
        await assertSurfaceLoaded(page, surface, label);
        await settleRenderAndData(page, flight, label, surfaceMeasurementRoots(surface));
        await expect(page.locator("html"), `${label}: theme`).toHaveAttribute("data-theme", NORMAL_THEME_MODE);
        const loadedUrl = page.url();
        probePhase = "probe";

        const readings: Record<string, MeasuredValue> = {};
        const inventory: Record<string, unknown> = {};

        // ── Menu: a real ActionMenu trigger, opened and closed from the keyboard ──
        const trigger = page.locator('[data-action-menu-trigger="true"]').filter({ visible: true }).first();
        const hasMenu = (await trigger.count()) > 0;
        if (hasMenu) {
          await trigger.focus();
          await expect(trigger, `${label}: trigger collapsed`).toHaveAttribute("aria-expanded", "false");
          await page.keyboard.press("ArrowDown");
          const menu = page.locator('[role="menu"][data-action-menu-surface="root"]');
          await expect(menu, `${label}: menu opened`).toBeVisible();
          await expect(trigger, `${label}: trigger expanded`).toHaveAttribute("aria-expanded", "true");
          await waitForLayoutSettled(page);
          const opened = await readMenu(page);
          Object.assign(readings, opened.readings);
          inventory.menu = opened.inventory;
          expect(opened.inventory.focusInsideMenu, `${label}: focus enters the menu`).toBe(true);
          expect(opened.inventory.focusedRole, `${label}: initial focus is a menu item`).toBe("menuitem");
          expect(opened.inventory.insideViewport, `${label}: menu stays inside the viewport`).toBe(true);
          expect(opened.inventory.labelledBy, `${label}: menu is labelled by its trigger`).toBeTruthy();
          expect(opened.inventory.enabledTextContrast as number, `${label}: item text contrast`).toBeGreaterThanOrEqual(4.5);
          await page.keyboard.press("Escape");
          await expect(menu, `${label}: Escape closes the menu`).toHaveCount(0);
          await expect(trigger, `${label}: trigger collapsed again`).toHaveAttribute("aria-expanded", "false");
          await expect(trigger, `${label}: focus returns to the trigger`).toBeFocused();

          // Outside dismissal: reopen with the pointer, press on a neutral point.
          await trigger.click();
          await expect(menu, `${label}: menu reopened`).toBeVisible();
          await page.mouse.click(2, viewport.height - 2);
          await expect(menu, `${label}: outside press closes the menu`).toHaveCount(0);
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        } else {
          for (const id of MENU_IDS) readings[id] = { notApplicable: "the surface renders no ActionMenu trigger at this viewport" };
          inventory.menu = { present: false };
        }

        // ── Tooltip: the compact rail (768-1279) is the only real trigger ──
        const rail = page.locator(".dashboard-navigation-rail").filter({ visible: true }).first();
        const hasRail = (await rail.count()) > 0;
        if (hasRail) {
          const item = rail.locator('[data-dashboard-navigation-item]:not([aria-current="page"])').filter({ visible: true }).first();
          await page.keyboard.press("Shift");
          await item.focus();
          const tip = page.locator('[role="tooltip"][data-dashboard-tooltip="true"]');
          // A head without the V7 tooltip (main) is measured, not failed: AUSENTE plus the native title it uses.
          const shown = await tip.waitFor({ state: "visible", timeout: 1_500 }).then(() => true, () => false);
          if (shown) {
            await waitForLayoutSettled(page);
            const keyboard = await readTooltip(page);
            Object.assign(readings, keyboard.readings);
            inventory.tooltipKeyboard = keyboard.inventory;
            expect(keyboard.inventory.describedByTrigger, `${label}: aria-describedby points at the tooltip`).toBe(true);
            expect(keyboard.inventory.triggerHasTitle, `${label}: no native title duplicate`).toBe(false);
            expect(keyboard.inventory.text, `${label}: tooltip text is the accessible name`).toBe(keyboard.inventory.triggerName);
            expect(keyboard.inventory.insideViewport, `${label}: tooltip stays inside the viewport`).toBe(true);
            expect(keyboard.inventory.contrast as number, `${label}: tooltip contrast`).toBeGreaterThanOrEqual(4.5);
            await page.keyboard.press("Escape");
            await expect(tip, `${label}: Escape closes the tooltip`).toHaveCount(0);
            await expect(item, `${label}: Escape keeps focus on the control`).toBeFocused();
            await item.evaluate((element) => (element as HTMLElement).blur());

            await item.hover();
            await expect(tip, `${label}: hover shows the tooltip`).toBeVisible();
            inventory.tooltipHover = (await readTooltip(page)).inventory;
            await page.mouse.move(viewport.width - 4, viewport.height - 4);
            await expect(tip, `${label}: leaving hides the tooltip`).toHaveCount(0);
          } else {
            for (const id of TOOLTIP_IDS) readings[id] = null;
            inventory.tooltipKeyboard = { present: false, nativeTitle: await item.getAttribute("title") };
          }
        } else {
          for (const id of TOOLTIP_IDS) readings[id] = { notApplicable: "the drawer shows the full label; no tooltip trigger at this viewport" };
          inventory.tooltipKeyboard = { present: false };
        }

        // ── Filter popover: VETNEB has no functional equivalent (RM-07/C12) ──
        for (const id of FILTER_POPOVER_IDS) {
          readings[id] = { notApplicable: "no filter popover exists; FilterOverflow is a menu of applied filters and chips are not menu triggers" };
        }
        inventory.overlays = {
          menu: hasMenu,
          tooltip: hasRail,
          subMenu: false,
          filterPopover: false,
          filterOverflowMounted: (await page.locator("[data-filter-overflow], [data-action-menu-trigger]").count()) > 0,
          notificationsBellDialog: (await page.locator('[aria-haspopup="dialog"]').count()) > 0,
        };

        expect(page.url(), `${label}: the probe did not navigate`).toBe(loadedUrl);
        expect(mutatingRequests.filter((entry) => entry.phase === "probe"), `${label}: no mutating request`).toEqual([]);

        const results: FidelityResult[] = reference.metrics.map((metric) => {
          expect(metric.id in readings, `${label}: ${metric.id} was read`).toBe(true);
          return classifyMetric(metric, readings[metric.id], viewport.width);
        });
        expect(results.filter((result) => result.instrumentError), `${label}: instrument errors`).toEqual([]);

        const record = {
          schema: "drv-v7-overlay-record/1",
          surface: surface.id,
          viewport: viewport.slug,
          theme: NORMAL_THEME_MODE,
          colorCriterion: reference.colorCriterion,
          results,
          notComparable: reference.notComparable,
          inventory: { ...inventory, applicationMutatingRequests: mutatingRequests },
          byComponent: tallyBy(results, "component"),
        };
        const body = JSON.stringify(record, null, 2);
        await testInfo.attach(`drv-v7-${surface.id}-${viewport.slug}.json`, { body, contentType: "application/json" });
        const outDir = process.env.DRV_V7_OUT;
        if (outDir) {
          await mkdir(outDir, { recursive: true });
          await writeFile(path.join(outDir, `${surface.id}-${viewport.slug}.json`), body);
        }
        expect(results).toHaveLength(reference.metrics.length);
      });
    }
  }
});
