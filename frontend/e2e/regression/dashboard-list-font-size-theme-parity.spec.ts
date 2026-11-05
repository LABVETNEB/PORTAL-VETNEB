import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  DARK_GRAY_THEME_MODE,
  NORMAL_THEME_MODE,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "../../src/lib/theme";
import {
  assertSurfaceLoaded,
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACES,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
  type DashboardGeometrySurface,
} from "../helpers/dashboard-geometry-matrix";
import { LIGHT_LIST_FONT_SIZE_BASELINE } from "../fixtures/dashboard-list-font-size-light-baseline";
import { addAppCookies } from "../helpers/session";

// Font-size parity between themes. Normal (light) is the canonical reference:
// every list element measured under dark-gray must resolve to the same
// computed font-size as its equivalent under normal, on the same DOM, with a
// 0 px tolerance. Only the CSS property is compared; the dark theme must never
// shrink or grow list typography relative to light.

const VIEWPORTS = [
  { slug: "w1920x945", width: 1920, height: 945 },
  { slug: "w1366x768", width: 1366, height: 768 },
  { slug: "w1280x720", width: 1280, height: 720 },
  { slug: "w834x1194", width: 834, height: 1194 },
  { slug: "w390x844", width: 390, height: 844 },
] as const;

type FontReading = Readonly<Record<string, number>>;

/**
 * Every element inside a table that directly owns text, keyed by its position
 * in the DOM (table / section / row / cell / child path). The key is theme
 * independent because the theme only changes CSS, never the markup.
 */
async function readListFontSizes(page: Page, contentRootSelector: string): Promise<FontReading> {
  return page.evaluate((contentRootSelector) => {
    const result: Record<string, number> = {};
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };
    const ownsText = (element: Element) =>
      Array.from(element.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0,
      );
    const pathOf = (element: Element, stop: Element): string => {
      const parts: string[] = [];
      let node: Element | null = element;
      while (node && node !== stop) {
        const parent: Element | null = node.parentElement;
        parts.unshift(
          `${node.tagName.toLowerCase()}${parent ? Array.from(parent.children).indexOf(node) : 0}`,
        );
        node = parent;
      }
      return parts.join(">");
    };

    const roots = Array.from(
      document.querySelectorAll(".dashboard-app-shell table"),
    ).filter(isVisible);
    roots.forEach((table, tableIndex) => {
      const candidates = [table, ...Array.from(table.querySelectorAll("*"))];
      for (const element of candidates) {
        if (!ownsText(element) || !isVisible(element)) continue;
        const key = `t${tableIndex}:${pathOf(element, table)}`;
        result[key] = Number.parseFloat(window.getComputedStyle(element).fontSize);
      }
    });
    // Card lists (phone) and any other text outside tables, inside the module content.
    const contentRoot = document.querySelector(contentRootSelector);
    if (contentRoot) {
      for (const element of Array.from(contentRoot.querySelectorAll("*"))) {
        if (element.closest("table") || !ownsText(element) || !isVisible(element)) continue;
        result[`c:${pathOf(element, contentRoot)}`] = Number.parseFloat(
          window.getComputedStyle(element).fontSize,
        );
      }
    }
    return result;
  }, contentRootSelector);
}

async function switchThemeLive(page: Page, theme: ThemeMode): Promise<void> {
  await page.evaluate((mode) => {
    document.documentElement.dataset.theme = mode;
  }, theme);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await waitForLayoutSettled(page);
}

type ParityDifference = { readonly key: string; readonly light: number; readonly dark: number };

function diffReadings(light: FontReading, dark: FontReading): readonly ParityDifference[] {
  const keys = new Set([...Object.keys(light), ...Object.keys(dark)]);
  const differences: ParityDifference[] = [];
  for (const key of keys) {
    const l = light[key];
    const d = dark[key];
    if (l === undefined || d === undefined || l !== d) {
      differences.push({ key, light: l ?? Number.NaN, dark: d ?? Number.NaN });
    }
  }
  return differences;
}

function histogramOf(reading: FontReading): Record<string, number> {
  const histogram: Record<string, number> = {};
  for (const size of Object.values(reading)) {
    histogram[String(size)] = (histogram[String(size)] ?? 0) + 1;
  }
  return histogram;
}

const SURFACES: readonly DashboardGeometrySurface[] = DASHBOARD_GEOMETRY_SURFACES;
const REPORT_DIR = process.env.E2E_FONT_PARITY_REPORT_DIR;

test.describe("Dashboard lists · font-size parity between normal and dark-gray", () => {
  for (const surface of SURFACES) {
    test(`${surface.id} keeps light font sizes in dark-gray`, async ({ browser }, testInfo) => {
      test.setTimeout(240_000);
      const lightCensusMismatches: string[] = [];
      const report: Array<{
        viewport: string;
        measured: number;
        differences: readonly ParityDifference[];
        reloadDifferences: readonly ParityDifference[];
        sizes: Record<string, number>;
      }> = [];

      for (const viewport of VIEWPORTS) {
        const label = `${surface.id} @ ${viewport.slug}`;
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          reducedMotion: "reduce",
          colorScheme: "light",
        });
        try {
          await addAppCookies(context, [DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role]]);
          const page = await context.newPage();
          await suppressNextDevChrome(page);
          await clearDashboardModuleMemory(page);
          await installSurfaceMocks(page, surface);
          await page.addInitScript(
            ([key, mode]) => {
              try {
                if (!window.sessionStorage.getItem("font-parity-booted")) {
                  window.localStorage.setItem(key, mode);
                  window.sessionStorage.setItem("font-parity-booted", "1");
                }
              } catch {
                /* storage unavailable: the theme assertion below reports it */
              }
            },
            [THEME_STORAGE_KEY, NORMAL_THEME_MODE] as const,
          );

          await page.goto(surface.route);
          await expect(
            page.locator(surface.readinessSelector).first(),
            `${label}: readiness`,
          ).toBeVisible({ timeout: 25_000 });
          await expect(page.locator("html")).toHaveAttribute("data-theme", NORMAL_THEME_MODE);
          await page.waitForLoadState("networkidle", { timeout: 20_000 });
          await assertSurfaceLoaded(page, surface, label);
          await waitForLayoutSettled(page);

          const light = await readListFontSizes(page, surface.contentRootSelector);
          lightCensusMismatches.push(
            ...(JSON.stringify(histogramOf(light)) ===
            JSON.stringify(LIGHT_LIST_FONT_SIZE_BASELINE[`${surface.id}@${viewport.slug}`] ?? {})
              ? []
              : [`${viewport.slug}: ${JSON.stringify(histogramOf(light))}`]),
          );
          if (REPORT_DIR) {
            mkdirSync(REPORT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(REPORT_DIR, `${surface.id}-${viewport.slug}-normal.png`) });
          }

          await switchThemeLive(page, DARK_GRAY_THEME_MODE);
          const dark = await readListFontSizes(page, surface.contentRootSelector);
          if (REPORT_DIR) {
            await page.screenshot({ path: path.join(REPORT_DIR, `${surface.id}-${viewport.slug}-dark-gray.png`) });
          }

          // Persisted dark-gray applied before hydration on a fresh load.
          await page.evaluate(
            ([key, mode]) => window.localStorage.setItem(key, mode),
            [THEME_STORAGE_KEY, DARK_GRAY_THEME_MODE] as const,
          );
          await page.reload();
          await expect(page.locator(surface.readinessSelector).first()).toBeVisible({
            timeout: 25_000,
          });
          await expect(page.locator("html")).toHaveAttribute("data-theme", DARK_GRAY_THEME_MODE);
          await page.waitForLoadState("networkidle", { timeout: 20_000 });
          await assertSurfaceLoaded(page, surface, label);
          await waitForLayoutSettled(page);
          const reloaded = await readListFontSizes(page, surface.contentRootSelector);

          report.push({
            viewport: viewport.slug,
            measured: Object.keys(light).length,
            differences: diffReadings(light, dark),
            reloadDifferences: diffReadings(light, reloaded),
            sizes: light,
          });
        } finally {
          await context.close();
        }
      }

      if (REPORT_DIR) {
        mkdirSync(REPORT_DIR, { recursive: true });
        writeFileSync(
          path.join(REPORT_DIR, `${surface.id}.json`),
          JSON.stringify(report, null, 1),
        );
      }

      const failures = report.flatMap((entry) => [
        ...entry.differences.map((d) => `${entry.viewport} live ${d.key}: light ${d.light}px, dark ${d.dark}px`),
        ...entry.reloadDifferences.map(
          (d) => `${entry.viewport} reload ${d.key}: light ${d.light}px, dark ${d.dark}px`,
        ),
      ]);
      testInfo.annotations.push({
        type: "measured",
        description: report.map((entry) => `${entry.viewport}=${entry.measured}`).join(" "),
      });
      expect(
        lightCensusMismatches,
        `${surface.id}: normal-theme font sizes must match the main baseline`,
      ).toEqual([]);
      expect(failures, `${surface.id}: dark-gray font-size must equal normal`).toEqual([]);
    });
  }
});
