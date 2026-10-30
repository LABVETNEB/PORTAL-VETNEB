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
// DRV V1 · Google Drive fidelity probe. Evidence generator, not a gate: it reads
// computed geometry, typography and painted colour in four states (default,
// row hover, nav-item keyboard focus and, where the surface has active-filter
// chips, a filtered state), classifies each metric against the lab reference
// (e2e/fixtures/drive-ui-reference.v1.json) and attaches the per-metric record
// plus a text-free DOM inventory that traces every AUSENTE to the real DOM.
//
// A visual difference never fails a test. What fails is the instrument: an
// unread metric, an unparseable colour, a non-numeric geometry reading, or a
// side effect (a non-GET request, a URL change, chips left applied).
// Set DRV_V1_OUT to also write the records outside the runner's output dir.
// ─────────────────────────────────────────────────────────────────────────────

const REFERENCE_PATH = path.resolve(process.cwd(), "e2e/fixtures/drive-ui-reference.v1.json");

const PROBE_VIEWPORTS = [
  { slug: "w1920x945", width: 1920, height: 945 },
  { slug: "w1920x1080", width: 1920, height: 1080 },
  { slug: "w1440x900", width: 1440, height: 900 },
  { slug: "w1366x768", width: 1366, height: 768 },
  { slug: "w1280x800", width: 1280, height: 800 },
  { slug: "w1024x768", width: 1024, height: 768 },
] as const;

/**
 * `chipFilter` names the searchbox whose Enter applies a client-side filter
 * rendered as ActiveFilterChips. Surfaces without it have no chip equivalent.
 */
const PROBE_SURFACE_CONFIG = [
  { id: "admin-auditoria", chipFilter: null },
  { id: "admin-informes", chipFilter: "Buscar informe" },
  { id: "clinic-informes", chipFilter: null },
] as const;

const PROBE_SURFACES = PROBE_SURFACE_CONFIG.map(({ id, chipFilter }) => {
  const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === id);
  if (!surface) throw new Error(`DRV V1: surface ${id} is not an A02 surface`);
  return { surface: surface as DashboardGeometrySurface, chipFilter };
});

const CHIP_METRIC_IDS = [
  "chip.height",
  "chip.radius",
  "chip.borderWidth",
  "chip.borderStyle",
  "chip.borderColor",
  "chip.fontSize",
  "chip.fontWeight",
  "chip.color",
] as const;

type Phase = "default" | "hover" | "focus" | "filtered";
type PhaseReading = { readings: Record<string, number | string | null>; inventory: Record<string, unknown> };

/**
 * One in-page reader for every phase. Playwright serialises this function by
 * source, so the toolkit lives inside it. Painted colours go through a 2D
 * canvas: the ancestor background stack is composited source-over on white
 * (the initial canvas) and read back as 8-bit sRGB, which resolves rgb, oklab,
 * oklch, color(srgb) and any engine-resolved color-mix() the same way.
 */
async function readPhase(page: Page, phase: Phase, contentRoot: string): Promise<PhaseReading> {
  return page.evaluate(
    ({ phase, root }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const visible = (element: Element | null): element is HTMLElement => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const first = (selector: string, scope: ParentNode = document): HTMLElement | null =>
        Array.from(scope.querySelectorAll(selector)).find(visible) ?? null;
      const all = (selector: string, scope: ParentNode = document): HTMLElement[] =>
        Array.from(scope.querySelectorAll(selector)).filter(visible);
      const round = (value: number) => Math.round(value * 100) / 100;
      const css = (element: Element | null, property: string, pseudo: string | null = null) =>
        element ? getComputedStyle(element, pseudo).getPropertyValue(property) : null;
      const isTransparent = (color: string) => /^rgba\(0, 0, 0, 0\)$|^transparent$/.test(color);

      /** Painted layers below and on `element`: ancestors first, then extra layers. */
      const backgroundStack = (element: Element, extra: string[] = []) => {
        const chain: Element[] = [];
        for (let node: Element | null = element; node; node = node.parentElement) chain.unshift(node);
        const layers = chain
          .map((node) => getComputedStyle(node).backgroundColor)
          .filter((color) => !isTransparent(color));
        return [...layers, ...extra.filter((color) => !isTransparent(color))];
      };
      const paint = (layers: string[], foreground: string | null = null) => {
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 1, 1);
        for (const layer of [...layers, ...(foreground ? [foreground] : [])]) {
          ctx.fillStyle = layer;
          ctx.fillRect(0, 0, 1, 1);
        }
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `rgb(${r}, ${g}, ${b})`;
      };
      const effectiveBackground = (element: Element | null, extra: string[] = []) =>
        element ? paint(backgroundStack(element, extra)) : null;
      const effectiveColor = (element: Element | null, color: string | null) =>
        element && color ? paint(backgroundStack(element), color) : null;
      /** `color @ opacity` of a pseudo-element that is actually generated. */
      const pseudoLayer = (element: Element, pseudo: "::before" | "::after") => {
        const style = getComputedStyle(element, pseudo);
        if (style.content === "none" || isTransparent(style.backgroundColor)) return null;
        const opacity = Number(style.opacity);
        return opacity >= 1
          ? style.backgroundColor
          : `color-mix(in srgb, ${style.backgroundColor} ${opacity * 100}%, transparent)`;
      };
      /** First node of `candidates` (element or generated pseudo) painting a bottom border. */
      const separatorPainter = (candidates: (Element | null)[]) => {
        for (const element of candidates) {
          if (!element) continue;
          for (const pseudo of [null, "::before", "::after"] as const) {
            const style = getComputedStyle(element, pseudo);
            if (pseudo && style.content === "none") continue;
            if (parseFloat(style.borderBottomWidth) > 0 && style.borderBottomStyle !== "none") {
              return {
                node: `${element.tagName.toLowerCase()}${pseudo ?? ""}`,
                width: style.borderBottomWidth,
                color: effectiveColor(element, style.borderBottomColor),
              };
            }
          }
        }
        return null;
      };

      const readings: Record<string, number | string | null> = {};
      const inventory: Record<string, unknown> = {};
      const scope = document.querySelector(root) ?? document;

      if (phase === "default") {
        const header = first('header[data-dashboard-topbar-polish="true"]');
        readings["header.height"] = header ? round(header.getBoundingClientRect().height) : null;
        readings["header.background"] = css(header, "background-color");
        readings["header.boxShadow"] = css(header, "box-shadow");

        const sidebar = first(".dashboard-navigation-drawer, .dashboard-navigation-rail");
        readings["sidebar.x"] = sidebar ? round(sidebar.getBoundingClientRect().x) : null;
        readings["sidebar.width"] = sidebar ? round(sidebar.getBoundingClientRect().width) : null;
        const items = sidebar ? all("[data-dashboard-navigation-item]", sidebar) : [];
        const active = items.find((item) => item.getAttribute("aria-current") === "page") ?? null;
        const sample = active ?? items[0] ?? null;
        readings["navItem.height"] = sample ? round(sample.getBoundingClientRect().height) : null;
        readings["navItem.radiusToHeight"] = sample
          ? round(parseFloat(css(sample, "border-top-left-radius") ?? "0") / sample.getBoundingClientRect().height)
          : null;
        readings["navItem.fontSize"] = css(sample, "font-size");
        readings["navItem.fontWeight"] = css(sample, "font-weight");
        readings["navItem.lineHeight"] = css(sample, "line-height");
        readings["navItem.active.background"] = effectiveBackground(active);
        readings["navItem.active.color"] = effectiveColor(active, css(active, "color"));
        inventory.sidebar = sidebar ? (sidebar.classList.contains("dashboard-navigation-rail") ? "rail" : "drawer") : null;

        const main = first("main.dashboard-main");
        readings["main.x"] = main ? round(main.getBoundingClientRect().x) : null;
        readings["main.width"] = main ? round(main.getBoundingClientRect().width) : null;

        const table = first("table", scope);
        const headRow = table ? first("thead tr", table) : null;
        const headCells = headRow ? all("th", headRow) : [];
        const headCell = headCells[1] ?? headCells[0] ?? null;
        const rows = table ? all("tbody tr", table) : [];
        const cells = rows[0] ? all("td", rows[0]) : [];
        const cell = cells.length > 2 ? cells[1] : (cells[0] ?? null);
        readings["list.top"] = headRow ? round(headRow.getBoundingClientRect().y) : null;
        readings["list.inset"] =
          table && main ? round(table.getBoundingClientRect().x - main.getBoundingClientRect().x) : null;
        readings["tableHeader.height"] = headRow ? round(headRow.getBoundingClientRect().height) : null;
        readings["tableHeader.fontSize"] = css(headCell, "font-size");
        readings["tableHeader.fontWeight"] = css(headCell, "font-weight");
        readings["tableHeader.letterSpacing"] = css(headCell, "letter-spacing");
        readings["tableHeader.color"] = effectiveColor(headCell, css(headCell, "color"));
        const headSeparator = separatorPainter([headRow, headCell, headRow?.parentElement ?? null]);
        readings["tableHeader.separatorWidth"] = headRow ? (headSeparator?.width ?? "0px") : null;
        readings["tableHeader.separatorColor"] = headSeparator?.color ?? null;
        readings["tableRow.height"] = rows[0] ? round(rows[0].getBoundingClientRect().height) : null;
        readings["tableRow.pitch"] =
          rows.length > 1 ? round(rows[1].getBoundingClientRect().y - rows[0].getBoundingClientRect().y) : null;
        const rowSeparator = separatorPainter([rows[0] ?? null, cells[0] ?? null]);
        readings["tableRow.separatorWidth"] = rows[0] ? (rowSeparator?.width ?? "0px") : null;
        readings["tableRow.separatorColor"] = rowSeparator?.color ?? null;
        readings["tableCell.fontSize"] = css(cell, "font-size");
        readings["tableCell.fontWeight"] = css(cell, "font-weight");
        readings["tableCell.color"] = effectiveColor(cell, css(cell, "color"));
        readings["tableCell.paddingInline"] = cell ? `${css(cell, "padding-left")} ${css(cell, "padding-right")}` : null;
        inventory.separators = { header: headSeparator?.node ?? null, row: rowSeparator?.node ?? null };

        const search = first("[data-workspace-app-bar-search]");
        readings["search.height"] = search ? round(search.getBoundingClientRect().height) : null;
        readings["search.width"] = search ? round(search.getBoundingClientRect().width) : null;
        readings["search.radius"] = css(search, "border-top-left-radius");
        readings["search.background"] = effectiveBackground(search);
        readings["search.input.fontSize"] = css(first("[data-workspace-app-bar-search-input]"), "font-size");

        // The visible page title: the canonical WorkspaceHeader h2 when it is
        // laid out, else the topbar h1 that carries the page name.
        const titleCandidates = [
          { source: "workspace-header-h2", element: first("[data-workspace-header] h2") },
          { source: "topbar-h1", element: first('header[data-dashboard-topbar-polish="true"] h1') },
        ];
        const title = titleCandidates.find((candidate) => candidate.element) ?? null;
        readings["title.fontSize"] = css(title?.element ?? null, "font-size");
        readings["title.fontWeight"] = css(title?.element ?? null, "font-weight");
        readings["title.lineHeight"] = css(title?.element ?? null, "line-height");
        inventory.titleSource = title?.source ?? null;
        inventory.headings = Array.from(document.querySelectorAll("h1, h2, h3, [role=heading]")).map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === "string" ? element.className.slice(0, 120) : "",
            rect: [round(rect.x), round(rect.y), round(rect.width), round(rect.height)],
            display: getComputedStyle(element).display,
            inMain: Boolean(element.closest("main")),
          };
        });

        readings["page.background"] = effectiveBackground(document.body);
        readings["page.fontSize"] = css(document.body, "font-size");
        readings["page.lineHeight"] = css(document.body, "line-height");
        const family = css(document.body, "font-family") ?? "";
        readings["page.fontFamilyFirst"] =
          family.split(",")[0]?.trim().replace(/^["']|["']$/g, "").toLowerCase() || null;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const rightRail = Array.from(document.body.querySelectorAll("*")).find((element) => {
          if (!visible(element)) return false;
          const rect = element.getBoundingClientRect();
          return rect.right >= viewportWidth - 1 && rect.width <= 80 && rect.height >= viewportHeight * 0.8;
        });
        readings["rightRail.width"] = rightRail ? round(rightRail.getBoundingClientRect().width) : null;
      }

      if (phase === "hover") {
        const row = first("table tbody tr", scope);
        const cell = row ? (all("td", row)[1] ?? all("td", row)[0] ?? null) : null;
        const layers = row && cell
          ? [pseudoLayer(row, "::before"), pseudoLayer(row, "::after"), pseudoLayer(cell, "::before"), pseudoLayer(cell, "::after")]
              .filter((layer): layer is string => layer !== null)
          : [];
        readings["tableRow.hover.background"] = cell ? effectiveBackground(cell, layers) : null;
        readings["tableCell.hover.color"] = cell
          ? paint(backgroundStack(cell, layers), css(cell, "color"))
          : null;
        inventory.hoverLayers = layers.length;
        inventory.rowHovered = row ? row.matches(":hover") : null;
      }

      if (phase === "focus") {
        const active = document.activeElement;
        const focused =
          active instanceof HTMLElement && active.matches("[data-dashboard-navigation-item]:focus-visible") ? active : null;
        const ok = focused !== null;
        inventory.focusVisible = ok;
        const style = focused ? getComputedStyle(focused) : null;
        readings["navItem.focus.outlineWidth"] = style ? (style.outlineStyle === "none" ? "0px" : style.outlineWidth) : null;
        readings["navItem.focus.outlineStyle"] = style ? style.outlineStyle : null;
        readings["navItem.focus.outlineColor"] =
          focused && style && style.outlineStyle !== "none" ? effectiveColor(focused.parentElement, style.outlineColor) : null;
        readings["navItem.focus.background"] = effectiveBackground(focused);
      }

      if (phase === "filtered") {
        const chip = first("[data-filter-chip]");
        readings["chip.height"] = chip ? round(chip.getBoundingClientRect().height) : null;
        readings["chip.radius"] = css(chip, "border-top-left-radius");
        readings["chip.borderWidth"] = css(chip, "border-top-width");
        readings["chip.borderStyle"] = css(chip, "border-top-style");
        readings["chip.borderColor"] = effectiveColor(chip?.parentElement ?? null, css(chip, "border-top-color"));
        readings["chip.fontSize"] = css(chip, "font-size");
        readings["chip.fontWeight"] = css(chip, "font-weight");
        readings["chip.color"] = effectiveColor(chip, css(chip, "color"));
        inventory.chipsVisible = all("[data-filter-chip]").length;
        inventory.chipsMounted = document.querySelectorAll("[data-filter-chip]").length;
      }

      return { readings, inventory };
    },
    { phase, root: contentRoot },
  );
}

async function hoverFirstRow(page: Page, contentRoot: string): Promise<boolean> {
  const row = page.locator(`${contentRoot} table tbody tr`).filter({ visible: true }).first();
  if ((await row.count()) === 0) return false;
  await row.hover();
  await waitForLayoutSettled(page);
  return true;
}

async function focusInactiveNavItem(page: Page): Promise<boolean> {
  const inactive = page
    .locator(
      ':is(.dashboard-navigation-drawer, .dashboard-navigation-rail) [data-dashboard-navigation-item]:not([aria-current="page"])',
    )
    .filter({ visible: true })
    .first();
  if ((await inactive.count()) === 0) return false;
  // A key press first makes Chromium treat the following focus as keyboard focus.
  await page.keyboard.press("Shift");
  await inactive.focus();
  await waitForLayoutSettled(page);
  return true;
}

let reference: DriveReference;

test.beforeAll(async () => {
  reference = JSON.parse(await readFile(REFERENCE_PATH, "utf8")) as DriveReference;
  expect(validateDriveReference(reference), "Drive reference is well formed").toEqual([]);
});

test.describe("DRV V1 · Google Drive fidelity probe", () => {
  for (const { surface, chipFilter } of PROBE_SURFACES) {
    for (const viewport of PROBE_VIEWPORTS) {
      test(`${surface.id} @ ${viewport.slug}`, async ({ page }, testInfo) => {
        test.setTimeout(90_000);
        const label = `${surface.id} @ ${viewport.slug}`;

        // Side-effect guard: the probe may only read. Any mutating request fails.
        let probePhase = "load";
        const mutatingRequests: { phase: string; request: string; serverAction: boolean }[] = [];
        page.on("request", (request) => {
          if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
            mutatingRequests.push({
              phase: probePhase,
              request: `${request.method()} ${new URL(request.url()).pathname}`,
              serverAction: request.headers()["next-action"] !== undefined,
            });
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
        await expect(page.locator(surface.readinessSelector).first(), `${label}: readiness`).toBeVisible({
          timeout: 25_000,
        });
        await assertSurfaceLoaded(page, surface, label);
        await settleRenderAndData(page, flight, label, surfaceMeasurementRoots(surface));
        await expect(page.locator("html"), `${label}: theme`).toHaveAttribute("data-theme", NORMAL_THEME_MODE);
        expect(
          await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
          `${label}: applied viewport`,
        ).toEqual({ width: viewport.width, height: viewport.height });
        const loadedUrl = page.url();
        probePhase = "probe";

        const phases: Record<string, Record<string, unknown>> = {};
        const readings: Record<string, MeasuredValue> = {};
        const absorb = (phase: Phase, reading: PhaseReading) => {
          Object.assign(readings, reading.readings);
          phases[phase] = reading.inventory;
        };

        absorb("default", await readPhase(page, "default", surface.contentRootSelector));

        const hovered = await hoverFirstRow(page, surface.contentRootSelector);
        absorb("hover", await readPhase(page, "hover", surface.contentRootSelector));
        if (hovered) expect(phases.hover.rowHovered, `${label}: row reached :hover`).toBe(true);
        await page.mouse.move(0, 0);

        const focused = await focusInactiveNavItem(page);
        absorb("focus", await readPhase(page, "focus", surface.contentRootSelector));
        if (focused) expect(phases.focus.focusVisible, `${label}: nav item reached :focus-visible`).toBe(true);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

        if (chipFilter) {
          const searchbox = page.getByRole("searchbox", { name: chipFilter, exact: true });
          await expect(searchbox, `${label}: chip filter field`).toBeVisible();
          await searchbox.fill("1");
          await searchbox.press("Enter");
          await waitForLayoutSettled(page);
          absorb("filtered", await readPhase(page, "filtered", surface.contentRootSelector));
          expect(phases.filtered.chipsMounted, `${label}: the filter produced a chip`).toBeGreaterThan(0);
          // Restore: the probe leaves no filter applied.
          await searchbox.fill("");
          await searchbox.press("Enter");
          await waitForLayoutSettled(page);
          await expect(page.locator("[data-filter-chip]"), `${label}: filter restored`).toHaveCount(0);
        } else {
          for (const id of CHIP_METRIC_IDS) {
            readings[id] = { notApplicable: "the surface has no active-filter chips component" };
          }
        }

        expect(page.url(), `${label}: the probe did not navigate`).toBe(loadedUrl);
        // Requests the application itself issues while loading are recorded, not
        // blamed on the probe; only those started by the probe's own actions fail.
        expect(
          mutatingRequests.filter((entry) => entry.phase === "probe"),
          `${label}: the probe issued no mutating request`,
        ).toEqual([]);

        const results: FidelityResult[] = reference.metrics.map((metric) => {
          expect(metric.id in readings, `${label}: ${metric.id} was read`).toBe(true);
          return classifyMetric(metric, readings[metric.id], viewport.width);
        });
        const instrumentErrors = results.filter((result) => result.instrumentError);
        expect(instrumentErrors, `${label}: instrument errors`).toEqual([]);

        const record = {
          schema: "drv-v1-fidelity-record/2",
          surface: surface.id,
          viewport: viewport.slug,
          theme: NORMAL_THEME_MODE,
          colorCriterion: reference.colorCriterion,
          results,
          notComparable: reference.notComparable,
          inventory: { ...phases, applicationMutatingRequests: mutatingRequests },
          byComponent: tallyBy(results, "component"),
          byCategory: tallyBy(results, "category"),
          byState: tallyBy(results, "state"),
        };
        const body = JSON.stringify(record, null, 2);
        await testInfo.attach(`drv-v1-${surface.id}-${viewport.slug}.json`, {
          body,
          contentType: "application/json",
        });
        const outDir = process.env.DRV_V1_OUT;
        if (outDir) {
          await mkdir(outDir, { recursive: true });
          await writeFile(path.join(outDir, `${surface.id}-${viewport.slug}.json`), body);
        }
        expect(results).toHaveLength(reference.metrics.length);
      });
    }
  }
});
