import { expect, type Page } from "@playwright/test";

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
} from "./dashboard-geometry-matrix";
import { LONG_TEXT_COOKIE_NAME, LONG_TEXT_COOKIE_VALUE } from "./long-text-dataset.mjs";
import { addAppCookies } from "./session";
import { NORMAL_THEME_MODE, THEME_STORAGE_KEY } from "../../src/lib/theme";

// DRV V8 · shared reader for the column probe and the DRV-01 contract spec.
export const V8_PROBE_SURFACE_IDS = [
  "admin-auditoria",
  "admin-usuarios",
  "admin-informes",
  "admin-sesiones",
  "admin-tokens",
] as const;

export const V8_SURFACES = V8_PROBE_SURFACE_IDS.map((id) => {
  const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === id);
  if (!surface) throw new Error(`DRV V8: surface ${id} is not an A02 surface`);
  return surface as DashboardGeometrySurface;
});

export type V8ColumnReading = {
  index: number;
  label: string;
  width: number;
  ariaSort: string | null;
  truncatedCells: number;
  cells: number;
};

export type V8TableReading = {
  found: boolean;
  viewportWidth: number;
  containerWidth: number;
  tableWidth: number;
  columns: V8ColumnReading[];
  visibleColumnLabels: string[];
  cells: number;
  truncatedCells: number;
  truncatedPercent: number;
  firstColumnWidth: number;
  actionsReachable: boolean;
  headerCellsAligned: boolean;
  rowCount: number;
  rowHeight: number;
  headerHeight: number;
  pagerHeight: number | null;
  documentOverflowX: number;
  documentOverflowY: number;
  containerOverflowX: number;
  containerType: string;
};

export async function readTable(page: Page, root: string): Promise<V8TableReading> {
  return page.evaluate((rootSelector) => {
    const round = (value: number) => Math.round(value * 100) / 100;
    const shown = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const scope = document.querySelector(rootSelector) ?? document.body;
    const table = Array.from(scope.querySelectorAll("table")).find(shown) as HTMLTableElement | undefined;
    const empty = {
      found: false,
      viewportWidth: window.innerWidth,
      containerWidth: 0,
      tableWidth: 0,
      columns: [],
      visibleColumnLabels: [],
      cells: 0,
      truncatedCells: 0,
      truncatedPercent: 0,
      firstColumnWidth: 0,
      actionsReachable: false,
      headerCellsAligned: false,
      rowCount: 0,
      rowHeight: 0,
      headerHeight: 0,
      pagerHeight: null,
      documentOverflowX: 0,
      documentOverflowY: 0,
      containerOverflowX: 0,
      containerType: "none",
    };
    if (!table) return empty;
    const container = table.parentElement as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const headers = Array.from(table.querySelectorAll("thead th")).filter(shown) as HTMLElement[];
    const rows = Array.from(table.querySelectorAll("tbody tr")).filter(shown) as HTMLElement[];
    const clips = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return (
        element.scrollWidth > element.clientWidth + 1 &&
        (style.overflowX === "hidden" || style.overflowX === "clip")
      );
    };
    const cellTruncated = (cell: HTMLElement) => {
      const nodes = [cell, ...Array.from(cell.querySelectorAll<HTMLElement>("*"))].filter(shown);
      return nodes.some((node) => node.textContent?.trim() && clips(node));
    };
    const allHeaderCells = Array.from(table.querySelectorAll("thead th")) as HTMLElement[];
    const columns = headers.map((header) => {
      const index = allHeaderCells.indexOf(header);
      const cells = rows
        .map((row) => (row.children[index] as HTMLElement | undefined) ?? null)
        .filter((cell): cell is HTMLElement => cell !== null && shown(cell));
      return {
        index,
        label: (header.textContent ?? "").trim() || header.getAttribute("aria-label") || `col-${index}`,
        width: round(header.getBoundingClientRect().width),
        ariaSort: header.getAttribute("aria-sort"),
        truncatedCells: cells.filter(cellTruncated).length,
        cells: cells.length,
      };
    });
    const cellCount = columns.reduce((sum, column) => sum + column.cells, 0);
    const truncated = columns.reduce((sum, column) => sum + column.truncatedCells, 0);
    const aligned = headers.every((header) => {
      const index = allHeaderCells.indexOf(header);
      const headerRect = header.getBoundingClientRect();
      return rows.every((row) => {
        const cell = row.children[index] as HTMLElement | undefined;
        if (!cell || !shown(cell)) return false;
        const rect = cell.getBoundingClientRect();
        return Math.abs(rect.left - headerRect.left) <= 1 && Math.abs(rect.width - headerRect.width) <= 1;
      });
    });
    const firstRow = rows[0];
    const actionControls = firstRow
      ? Array.from(firstRow.querySelectorAll("button, [role=button], [role=menuitem]")).filter(shown)
      : [];
    const pager = scope.querySelector(".dashboard-pager");
    const doc = document.documentElement;
    return {
      found: true,
      viewportWidth: window.innerWidth,
      containerWidth: round(containerRect.width),
      tableWidth: round(table.getBoundingClientRect().width),
      columns,
      visibleColumnLabels: columns.map((column) => column.label),
      cells: cellCount,
      truncatedCells: truncated,
      truncatedPercent: cellCount ? round((truncated / cellCount) * 100) : 0,
      firstColumnWidth: columns[0] ? columns[0].width : 0,
      actionsReachable: actionControls.length > 0 && actionControls.every((control) => {
        const rect = control.getBoundingClientRect();
        return rect.left >= containerRect.left - 1 && rect.right <= containerRect.right + 1;
      }),
      headerCellsAligned: aligned,
      rowCount: rows.length,
      rowHeight: firstRow ? round(firstRow.getBoundingClientRect().height) : 0,
      headerHeight: headers[0] ? round(headers[0].getBoundingClientRect().height) : 0,
      pagerHeight: pager ? round(pager.getBoundingClientRect().height) : null,
      documentOverflowX: doc.scrollWidth - doc.clientWidth,
      documentOverflowY: doc.scrollHeight - doc.clientHeight,
      containerOverflowX: container.scrollWidth - container.clientWidth,
      containerType: getComputedStyle(container).containerType,
    };
  }, root);
}

export async function openSurface(
  page: Page,
  surface: DashboardGeometrySurface,
  viewport: { width: number; height: number },
  longText: boolean,
  label: string,
): Promise<{ limits: string[] }> {
  const limits: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    const limit = url.searchParams.get("limit");
    if (limit !== null && request.method() === "GET") limits.push(`${url.pathname}?limit=${limit}&offset=${url.searchParams.get("offset") ?? ""}`);
  });
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [THEME_STORAGE_KEY, NORMAL_THEME_MODE] as const,
  );
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const cookies = [DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role]];
  if (longText) cookies.push({ name: LONG_TEXT_COOKIE_NAME, value: LONG_TEXT_COOKIE_VALUE });
  await addAppCookies(page, cookies);
  await installSurfaceMocks(page, surface);
  const flight = trackDataRequests(page);
  await page.setViewportSize(viewport);
  const navigation = await page.goto(surface.route);
  expect(navigation?.ok(), `${label}: document response`).toBe(true);
  await expect(page.locator(surface.readinessSelector).first(), `${label}: readiness`).toBeVisible({ timeout: 25_000 });
  await assertSurfaceLoaded(page, surface, label);
  await settleRenderAndData(page, flight, label, surfaceMeasurementRoots(surface));
  await waitForLayoutSettled(page);
  return { limits };
}

