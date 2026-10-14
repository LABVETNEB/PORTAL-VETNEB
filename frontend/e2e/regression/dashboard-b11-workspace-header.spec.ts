import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

import {
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_GEOMETRY_VIEWPORTS,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
  type DashboardGeometrySurface,
} from "../helpers/dashboard-geometry-matrix";
import { A03_ADAPTIVE_DATASET_COOKIE } from "../helpers/dashboard-adaptive-limit-matrix";
import { addAppCookies, sessionCookie } from "../helpers/session";

// B11 is the target-geometry bridge for A02, the height-ledger analysis for
// A03, and a zero-scroll-preserving change under A08. The complete matrices
// remain owned by those three contracts; this spec proves the B11 delta itself
// on both shared DashboardModuleWorkspace consumers and both viewport classes.

const HEADER_SELECTOR = '[data-workspace-header="true"]';
const DESCRIPTION_SELECTOR = '[data-workspace-header-description="true"]';
const APP_SHELL_SELECTOR = '[data-vetneb-app-shell="true"]';
const MAIN_SELECTOR = "main.dashboard-main";
const MOBILE_NAV_SELECTOR = '[data-dashboard-mobile-nav="clinic"]';

const SURFACE_IDS = ["admin-tokens", "clinic-tokens"] as const;
const VIEWPORT_SLUGS = ["w390x844", "w1366x768"] as const;

const SURFACES = SURFACE_IDS.map((id) => {
  const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === id);
  if (!surface) throw new Error(`B11: missing canonical surface ${id}`);
  return surface;
});

const VIEWPORTS = VIEWPORT_SLUGS.map((slug) => {
  const viewport = DASHBOARD_GEOMETRY_VIEWPORTS.find(
    (candidate) => candidate.slug === slug,
  );
  if (!viewport) throw new Error(`B11: missing canonical viewport ${slug}`);
  return viewport;
});

async function prepareSurface(page: Page, surface: DashboardGeometrySurface) {
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

  await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role]]);
  await installSurfaceMocks(page, surface);
}

async function openSurface(page: Page, surface: DashboardGeometrySurface) {
  await page.goto(surface.route, { waitUntil: "domcontentloaded" });
  await expect(page.locator(surface.readinessSelector)).toBeVisible({ timeout: 25_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  await waitForLayoutSettled(page);
}

async function expectNoOuterScroll(page: Page, label: string) {
  const metrics = await page.evaluate((mainSelector) => {
    const read = (element: Element | null) => ({
      vertical: (element?.scrollHeight ?? 0) - (element?.clientHeight ?? 0),
      horizontal: (element?.scrollWidth ?? 0) - (element?.clientWidth ?? 0),
    });
    const main = document.querySelector<HTMLElement>(mainSelector);
    return {
      html: read(document.documentElement),
      body: read(document.body),
      main: read(main),
      mainOverflowY: main ? getComputedStyle(main).overflowY : "absent",
    };
  }, MAIN_SELECTOR);

  expect(metrics, `${label}: A08 outer scroll`).toEqual({
    html: { vertical: 0, horizontal: 0 },
    body: { vertical: 0, horizontal: 0 },
    main: { vertical: 0, horizontal: 0 },
    mainOverflowY: "hidden",
  });
}

test.beforeAll(() => {
  expect(SURFACES.map((surface) => surface.id)).toEqual(SURFACE_IDS);
  expect(VIEWPORTS.map((viewport) => viewport.slug)).toEqual(VIEWPORT_SLUGS);
});

let b16Harness: string;

test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
const main = document.querySelector("main.dashboard-main");
const mount = document.createElement("div");
mount.setAttribute("data-b16-harness", "true");
mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2";
main.style.position = "relative";
main.append(mount);
createRoot(mount).render(<WorkspaceScaffold kind="full-route" moduleId="b16-harness" collection={<div data-b16-primary="true">Colección intacta</div>} details={<div data-b16-content="true">Contenido genérico</div>} />);`,
      resolveDir: resolve(process.cwd()),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    alias: { "@": resolve(process.cwd(), "src") },
  });
  b16Harness = result.outputFiles[0].text;
});

let c01Harness: string;

// C01 harness: the published primitives inside the real B15 scaffold (with the
// B16 panel) and the app CSS, over a deliberately overflowing dataset. Zero
// scroll keeps every production canvas at its fitted page size, so this is the
// only state in which the sticky header can be observed engaging.
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
import { Table, TableCell, TableHead, TableRow } from "./src/components/ui/table.tsx";
import { CollectionHeader, CollectionWorkspace, ContentList, ContentListItem } from "./src/features/dashboard/presentation/surfaces/index.ts";
const main = document.querySelector("main.dashboard-main");
const mount = document.createElement("div");
mount.setAttribute("data-c01-harness", "true");
mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2";
main.style.position = "relative";
main.append(mount);
const rows = Array.from({ length: 60 }, (_, index) => index + 1);
createRoot(mount).render(<WorkspaceScaffold kind="full-route" moduleId="c01-harness" details={<div data-c01-details="true">Detalle genérico</div>} collection={
  <CollectionWorkspace className="flex-1">
    <Table>
      <CollectionHeader><TableRow><TableHead>Registro</TableHead><TableHead>Acción</TableHead></TableRow></CollectionHeader>
      <ContentList as="tbody">{rows.map((row) => <ContentListItem as="tr" key={row}><TableCell>Registro {row}</TableCell><TableCell><button type="button">Abrir {row}</button></TableCell></ContentListItem>)}</ContentList>
    </Table>
  </CollectionWorkspace>
} />);`,
      resolveDir: resolve(process.cwd()),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    alias: { "@": resolve(process.cwd(), "src") },
  });
  c01Harness = result.outputFiles[0].text;
});

const COLLECTION_HEADER_TARGET_PX = 36;

/** The first ancestor that can scroll — the box `position: sticky` binds to. */
async function readCollectionScrollOwnership(page: Page, rootSelector: string) {
  return page.evaluate((selector) => {
    const root = document.querySelector<HTMLElement>(selector);
    const header = root?.querySelector<HTMLElement>('[data-collection-header="true"]') ?? null;
    const workspace = root?.querySelector<HTMLElement>('[data-collection-workspace="true"]') ?? null;
    let owner: HTMLElement | null = header?.parentElement ?? null;
    while (owner && !["auto", "scroll", "hidden"].includes(getComputedStyle(owner).overflowY)) {
      owner = owner.parentElement;
    }
    const scrollers = workspace
      ? [workspace, ...Array.from(workspace.querySelectorAll<HTMLElement>("*"))].filter((element) => {
          const overflowY = getComputedStyle(element).overflowY;
          return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight;
        })
      : [];
    const headerStyle = header ? getComputedStyle(header) : null;
    return {
      headerPresent: header !== null,
      headerPosition: headerStyle?.position ?? "absent",
      headerHeight: header?.getBoundingClientRect().height ?? -1,
      ownerIsTableFrame: Boolean(owner && owner.firstElementChild?.tagName === "TABLE" && owner.contains(header)),
      ownerInsideWorkspace: Boolean(owner && workspace && workspace !== owner && workspace.contains(owner)),
      workspaceOverflowY: workspace ? getComputedStyle(workspace).overflowY : "absent",
      workspaceScrollDelta: workspace ? workspace.scrollHeight - workspace.clientHeight : -1,
      ownerScrollDelta: owner ? owner.scrollHeight - owner.clientHeight : -1,
      ownerHorizontalDelta: owner ? owner.scrollWidth - owner.clientWidth : -1,
      activeScrollers: scrollers.length,
    };
  }, rootSelector);
}

test.describe("C01 · CollectionWorkspace + sticky CollectionHeader harness", () => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    test(`sticky header binds to the collection frame @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const label = `C01 harness @ ${viewport.width}x${viewport.height}`;
      const surface = SURFACES[0];
      await page.setViewportSize(viewport);
      await prepareSurface(page, surface);
      await openSurface(page, surface);
      await page.addScriptTag({ content: c01Harness });

      const harness = '[data-c01-harness="true"]';
      await expect(page.locator(`${harness} [data-content-list-item="true"]`)).toHaveCount(60);
      const before = await readCollectionScrollOwnership(page, harness);
      console.log(`[C01] ${label}: ${JSON.stringify(before)}`);
      expect(before.headerPosition, `${label}: sticky, never fixed`).toBe("sticky");
      expect(Math.abs(before.headerHeight - COLLECTION_HEADER_TARGET_PX), `${label}: 36px header`).toBeLessThanOrEqual(1);
      expect(before.ownerIsTableFrame, `${label}: sticky binds to the Table frame`).toBe(true);
      expect(before.ownerInsideWorkspace, `${label}: the frame lives inside the workspace`).toBe(true);
      expect(before.workspaceOverflowY, `${label}: the workspace is not a scroll container`).toBe("visible");
      expect(before.workspaceScrollDelta, `${label}: the workspace bounds the frame`).toBeLessThanOrEqual(0);
      expect(before.ownerScrollDelta, `${label}: the frame owns the overflow`).toBeGreaterThan(0);
      expect(before.activeScrollers, `${label}: exactly one scroll owner`).toBe(1);
      expect(before.ownerHorizontalDelta, `${label}: no horizontal overflow`).toBeLessThanOrEqual(0);
      await expectNoOuterScroll(page, label);

      const stuck = await page.evaluate((selector) => {
        const header = document.querySelector<HTMLElement>(`${selector} [data-collection-header="true"]`)!;
        const frame = header.closest("table")!.parentElement!;
        frame.scrollTop = 400;
        const firstRow = frame.querySelector<HTMLElement>('[data-content-list-item="true"]')!;
        return {
          scrollTop: frame.scrollTop,
          headerTopOffset: header.getBoundingClientRect().top - frame.getBoundingClientRect().top,
          firstRowBelowHeader: firstRow.getBoundingClientRect().bottom <= header.getBoundingClientRect().top,
        };
      }, harness);
      expect(stuck.scrollTop, `${label}: the frame scrolled`).toBeGreaterThan(0);
      expect(Math.abs(stuck.headerTopOffset), `${label}: header pinned to the frame top`).toBeLessThanOrEqual(2);
      expect(stuck.firstRowBelowHeader, `${label}: rows scroll beneath the header`).toBe(true);
      await expectNoOuterScroll(page, `${label} scrolled`);

      // Tab order still walks the row actions; no selection stop is introduced.
      await page.locator(harness).getByRole("button", { name: "Abrir 1", exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(page.locator(harness).getByRole("button", { name: "Abrir 2", exact: true })).toBeFocused();

      // B16 stays intact next to the collection.
      const panel = page.locator(`${harness} .dashboard-utility-side-panel`);
      await panel.locator("button.dashboard-utility-side-panel-toggle").click();
      await expect(panel).toHaveAttribute("data-expanded", "true");
      const width = await panel.evaluate((element) => element.getBoundingClientRect().width);
      if (viewport.width >= 768) {
        expect(width, `${label}: B16 panel`).toBeGreaterThanOrEqual(334);
        expect(width, `${label}: B16 panel`).toBeLessThanOrEqual(338);
      }
      await expectNoOuterScroll(page, `${label} panel expanded`);
    });
  }
});

test.describe("C01 · Auditoría adopts the collection primitives", () => {
  const auditSurface = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
  if (!auditSurface) throw new Error("C01: missing canonical admin-auditoria surface");
  const desktopCard = '#audit-log > section[aria-label="Registro operativo"]';

  test("desktop table form keeps the A03 reserve, actions and pager @ 1366x768", async ({ page }) => {
    const label = "C01 admin-auditoria @ 1366x768";
    await page.setViewportSize({ width: 1366, height: 768 });
    await prepareSurface(page, auditSurface);
    await openSurface(page, auditSurface);

    const workspace = page.locator(`${desktopCard} [data-collection-workspace="true"]`);
    await expect(workspace).toHaveCount(1);
    await expect(workspace).toHaveAttribute("data-dashboard-adaptive-rows-canvas", "true");
    await expect(workspace).toHaveAttribute("data-dashboard-canvas-reserve", "table-head-dense");

    const ownership = await readCollectionScrollOwnership(page, desktopCard);
    const reserve = await workspace.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).getPropertyValue("--dash-canvas-reserved")),
    );
    console.log(`[C01] ${label}: ${JSON.stringify({ ...ownership, reserve })}`);
    expect(ownership.headerPosition).toBe("sticky");
    expect(Math.abs(ownership.headerHeight - reserve), `${label}: header equals the A03 reserve`).toBeLessThanOrEqual(0.5);
    expect(ownership.ownerIsTableFrame).toBe(true);
    expect(ownership.ownerInsideWorkspace).toBe(true);
    expect(ownership.workspaceOverflowY).toBe("visible");
    expect(ownership.ownerScrollDelta, `${label}: fitted page, zero internal scroll`).toBeLessThanOrEqual(0);
    expect(ownership.activeScrollers).toBe(0);

    const rows = page.locator(`${desktopCard} tbody[data-content-list="true"] > tr[data-content-list-item="true"]`);
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    const detail = rows.first().getByRole("button", { name: /Ver detalle del evento/ });
    await detail.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    const range = page.locator(`${desktopCard} footer span[aria-live="polite"]`);
    const firstRange = (await range.textContent())?.trim();
    const next = page.locator(`${desktopCard} footer`).getByRole("button", { name: "Página siguiente" });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(range).not.toHaveText(firstRange ?? "");
    await expectNoOuterScroll(page, label);
  });

  test("mobile list form keeps its canvas and row actions @ 390x844", async ({ page }) => {
    const label = "C01 admin-auditoria @ 390x844";
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareSurface(page, auditSurface);
    await openSurface(page, auditSurface);

    const list = page.locator('[data-admin-mobile-ops-module="audit"] [data-content-list="true"]');
    await expect(list).toHaveCount(1);
    await expect(list).toHaveAttribute("data-dashboard-adaptive-rows-canvas", "true");
    expect(await list.evaluate((element) => element.tagName)).toBe("DIV");
    const items = list.locator(':scope > article[data-content-list-item="true"]');
    await expect(items.first()).toBeVisible();
    await expect(page.locator('[data-collection-header="true"]').filter({ visible: true })).toHaveCount(0);
    await items.first().getByRole("button", { name: /Ver detalle del evento/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expectNoOuterScroll(page, label);
  });
});

test.describe("B16 · UtilitySidePanel scaffold integration", () => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    test(`controlled panel @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const surface = SURFACES[0];
      await page.setViewportSize(viewport);
      await prepareSurface(page, surface);
      await openSurface(page, surface);
      await page.addScriptTag({ content: b16Harness });

      const harness = page.locator('[data-b16-harness="true"]');
      const panel = harness.locator(".dashboard-utility-side-panel");
      const toggle = panel.locator("button.dashboard-utility-side-panel-toggle");
      await expect(toggle).toBeVisible();
      await expect(panel.getByRole("button", { name: "Expandir panel utilitario", expanded: false })).toBeVisible();
      await expect(panel).toHaveAttribute("data-expanded", "false");
      await expect(harness.locator('[data-b16-content="true"]')).toBeHidden();
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(panel).toHaveAttribute("data-expanded", "true");
      await expect(panel.getByRole("button", { name: "Contraer panel utilitario", expanded: true })).toBeVisible();
      await expect(harness.locator('[data-b16-content="true"]')).toBeVisible();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(toggle).toBeFocused();
      const width = await panel.evaluate((element) => element.getBoundingClientRect().width);
      console.log(`[B16] ${viewport.width}x${viewport.height}: panel width ${width}px`);
      if (viewport.width < 768) {
        expect(width).toBeGreaterThanOrEqual(viewport.width - 1);
        expect(width).toBeLessThanOrEqual(viewport.width + 1);
      } else {
        expect(width).toBeGreaterThanOrEqual(334);
        expect(width).toBeLessThanOrEqual(338);
      }
      const touch = await toggle.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height, outline: getComputedStyle(element).outlineStyle };
      });
      expect(touch.width).toBeGreaterThanOrEqual(44);
      expect(touch.height).toBeGreaterThanOrEqual(44);
      expect(touch.outline).not.toBe("none");
      await expect(harness.locator('[data-b16-primary="true"]')).toContainText("Colección intacta");
      await expectNoOuterScroll(page, `B16 expanded @ ${viewport.width}`);
      await toggle.click();
      await expect(panel).toHaveAttribute("data-expanded", "false");
      await expect(toggle).toBeFocused();
      await page.keyboard.press("Space");
      await expect(panel).toHaveAttribute("data-expanded", "true");
      await expectNoOuterScroll(page, `B16 @ ${viewport.width}`);
    });
  }
});

test.describe("B11 · canonical WorkspaceHeader shared owner", () => {
  for (const surface of SURFACES) {
    for (const viewport of VIEWPORTS) {
      test(`${surface.id} @ ${viewport.slug}`, async ({ page }) => {
        const label = `${surface.id} @ ${viewport.slug}`;
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await prepareSurface(page, surface);
        await openSurface(page, surface);

        const workspace = page.locator(surface.contentRootSelector);
        const allHeaders = workspace.locator(HEADER_SELECTOR);
        await expect(allHeaders, `${label}: one canonical owner in the DOM`).toHaveCount(1);
        await expect(page.locator(APP_SHELL_SELECTOR), `${label}: one app shell`).toHaveCount(1);

        // Admin and clinic desktop/tablet space passes: the module header band
        // is reclaimed from 768px up on both roles, as G-003 already does below
        // 768px, so the canonical owner stays in the DOM (one per workspace)
        // only as the workspace's accessible name and description.
        const isMobile = viewport.width < 768;
        await expect(
          allHeaders,
          isMobile
            ? `${label}: mobile app bar owns the contextual header`
            : `${label}: desktop/tablet reclaims the module header band`,
        ).toBeHidden();
        await expect(allHeaders.locator("h2"), `${label}: one heading`).toHaveCount(1);
        await expect(allHeaders.locator(DESCRIPTION_SELECTOR), `${label}: one description`).toHaveCount(1);
        const wiring = await workspace.evaluate((element) => ({
          labelledBy: element.getAttribute("aria-labelledby"),
          describedBy: element.getAttribute("aria-describedby"),
          headingId: element.querySelector("h2")?.id ?? null,
          descriptionId:
            element.querySelector<HTMLElement>('[data-workspace-header-description="true"]')?.id ?? null,
          viewportPaddingTop: Number.parseFloat(
            getComputedStyle(element.querySelector<HTMLElement>("[data-dashboard-module-viewport]")!).paddingTop,
          ),
        }));
        expect(wiring.labelledBy, `${label}: the workspace keeps its accessible name`).toBe(wiring.headingId);
        expect(wiring.describedBy, `${label}: the workspace keeps its description`).toBe(wiring.descriptionId);
        expect(wiring.viewportPaddingTop, `${label}: no gap left where the band was`).toBe(0);

        await expect(page).toHaveURL(new RegExp(surface.route.replace("?", "\\?")));
        await expectNoOuterScroll(page, label);

        if (surface.role === "clinic" && viewport.width < 768) {
          await expect(
            page.locator(MOBILE_NAV_SELECTOR).filter({ visible: true }),
            `${label}: B09 mobile navigation owner`,
          ).toHaveCount(1);
        }
      });
    }
  }
});

const B15_SURFACES = [
  ...SURFACES,
  DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "clinic-informes-full"),
];

test.describe("B15 · single workspace scaffold owner", () => {
  for (const surface of B15_SURFACES) {
    if (!surface) throw new Error("B15: missing canonical clinic full route");
    for (const viewport of VIEWPORTS) {
      test(`${surface.id} @ ${viewport.slug}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await prepareSurface(page, surface);
        await openSurface(page, surface);
        const scaffold = page.locator('[data-workspace-scaffold="true"]');
        await expect(scaffold).toHaveCount(1);
        await expect(scaffold.locator('[data-dashboard-module-viewport]')).toHaveCount(1);
        const measurements = await scaffold.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const parent = element.parentElement?.getBoundingClientRect();
          const header = element.querySelector('[data-workspace-header="true"]');
          const viewportNode = element.querySelector('[data-dashboard-module-viewport]');
          return {
            widthDelta: parent ? Math.abs(rect.width - parent.width) : -1,
            viewportAfterHeader: !header || Boolean(viewportNode && header.compareDocumentPosition(viewportNode) & Node.DOCUMENT_POSITION_FOLLOWING),
          };
        });
        expect(measurements.widthDelta).toBeLessThanOrEqual(0.5);
        expect(measurements.viewportAfterHeader).toBe(true);
        await expectNoOuterScroll(page, `${surface.id} @ ${viewport.slug}`);
      });
    }
  }
});

type C02PagerReadout = {
  blockSize: number;
  minBlockSize: number;
  maxBlockSize: number;
  height: number;
  top: number;
  bottom: number;
  controlHeights: number[];
  controlsHitTestable: boolean;
  lastRowBottom: number;
  rows: number;
};

// Reads the reserved pager region, its controls (hit-tested at their centre so
// an overlapping row or nav would be caught) and the rows canvas above it.
async function readC02Pager(page: Page, pagerSelector: string, rowSelector: string): Promise<C02PagerReadout> {
  return page.evaluate(({ pagerSelector, rowSelector }) => {
    const pager = [...document.querySelectorAll<HTMLElement>(pagerSelector)].find(
      (candidate) => candidate.getBoundingClientRect().height > 0,
    )!;
    const style = getComputedStyle(pager);
    const rect = pager.getBoundingClientRect();
    const controls = [...pager.querySelectorAll<HTMLButtonElement>("button")];
    const rows = [...document.querySelectorAll<HTMLElement>(rowSelector)].filter(
      (row) => row.getBoundingClientRect().height > 0,
    );
    return {
      blockSize: Number.parseFloat(style.blockSize),
      minBlockSize: Number.parseFloat(style.minBlockSize),
      maxBlockSize: Number.parseFloat(style.maxBlockSize),
      height: rect.height,
      top: rect.top,
      bottom: rect.bottom,
      controlHeights: controls.map((control) => control.getBoundingClientRect().height),
      // Disabled centered controls are `pointer-events: none` by design
      // (responsive.css), so only enabled ones can own their hit point.
      controlsHitTestable: controls.filter((control) => !control.disabled).every((control) => {
        const box = control.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return hit !== null && (hit === control || control.contains(hit));
      }),
      lastRowBottom: Math.max(0, ...rows.map((row) => row.getBoundingClientRect().bottom)),
      rows: rows.length,
    };
  }, { pagerSelector, rowSelector });
}

function trackApiRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) requests.push(`${request.method()} ${url.pathname}${url.search}`);
  });
  return requests;
}

function expectExactReservation(readout: C02PagerReadout, label: string) {
  expect(readout.minBlockSize, `${label}: min-block-size is the reservation`).toBeCloseTo(readout.blockSize, 1);
  expect(readout.maxBlockSize, `${label}: max-block-size is the reservation`).toBeCloseTo(readout.blockSize, 1);
  expect(Math.abs(readout.height - readout.blockSize), `${label}: rendered height is the reservation`).toBeLessThanOrEqual(0.5);
  expect(readout.lastRowBottom, `${label}: rows stay above the pager`).toBeLessThanOrEqual(readout.top + 0.5);
  expect(readout.controlsHitTestable, `${label}: enabled controls are reachable`).toBe(true);
}

const C02_RANGE = /^(\d+)–(\d+) de (\d+)(?: \S+)?$/;

function parseRange(text: string | null, label: string) {
  const match = C02_RANGE.exec((text ?? "").trim());
  expect(match, `${label}: range "${text}"`).not.toBeNull();
  const [start, end, total] = match!.slice(1).map(Number);
  return { start, end, total, size: end - start + 1 };
}

test.describe("C02 · CollectionPager owns both legacy pagers on real consumers", () => {
  test("compact variant (CompactPager) on Precios @ 1366x768 when a category overflows the view", async ({ page }) => {
    // Desktop/tablet space pass: a Precios category shows ALL its studies in
    // one view; the compact pager only mounts when the measured canvas cannot
    // hold the whole category. A 24-study category forces that real fallback.
    const label = "C02 admin-precios overflow @ 1366x768";
    const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === "admin-precios");
    if (!surface) throw new Error("C02: missing canonical admin-precios surface");
    await page.setViewportSize({ width: 1366, height: 768 });
    await prepareSurface(page, surface);
    await page.route("**/api/admin/pricing**", async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== "GET" || url.pathname !== "/api/admin/pricing") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          categories: [
            {
              category: "Citología C02",
              items: Array.from({ length: 24 }, (_, index) => ({
                id: 7100 + index,
                studyName: `Estudio C02 ${String(index + 1).padStart(2, "0")}`,
                priceLabel: `$ ${1000 + index}`,
                displayOrder: index,
                isActive: true,
                updatedAt: "2026-02-10T15:30:00.000Z",
              })),
            },
          ],
        }),
      });
    });
    await page.goto(surface.route, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Estudio C02 01")).toBeVisible({ timeout: 25_000 });
    await waitForLayoutSettled(page);

    const pagerSelector = '[data-collection-pager="compact"]';
    const pager = page.locator(pagerSelector).filter({ visible: true });
    await expect(pager).toHaveCount(1);
    await expect(pager).toHaveAttribute("data-dashboard-compact-pager", "true");
    await expect(pager).toHaveAttribute("data-dashboard-pager", "compact");
    await expect(pager).toHaveAttribute("data-dashboard-adaptive-reserved-region", "pager");
    await expect(page.locator('[data-admin-pricing-all-items="false"]')).toHaveCount(1);

    const rowSelector = "form[data-admin-pricing-item-form]";
    const before = await readC02Pager(page, pagerSelector, rowSelector);
    console.log(`[C02] ${label}: ${JSON.stringify(before)}`);
    expectExactReservation(before, label);
    expect(before.controlHeights, `${label}: text controls keep h-8`).toEqual([32, 32]);

    // Anterior/Siguiente only: the range is announced, no page state is painted.
    const live = pager.locator('[aria-live="polite"][aria-atomic="true"]');
    await expect(pager.locator('[data-dashboard-pager-state="true"]')).toHaveCount(0);
    await expect(live).toHaveClass(/sr-only/);
    await expect(pager.getByRole("button")).toHaveText(["Anterior", "Siguiente"]);
    const first = parseRange(await live.textContent(), label);
    expect(await live.textContent()).toMatch(/ estudios$/);
    expect(first.start).toBe(1);
    expect(first.total).toBe(24);
    expect(first.size, `${label}: rendered forms equal the announced range`).toBe(before.rows);
    expect(first.size, `${label}: the category overflows`).toBeLessThan(first.total);
    const prev = pager.getByRole("button", { name: "Página anterior" });
    const next = pager.getByRole("button", { name: "Página siguiente" });
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();

    const requests = trackApiRequests(page);
    await next.click();
    const second = parseRange(await live.textContent(), `${label} page 2`);
    expect(second.start, `${label}: page 2 starts after page 1`).toBe(first.end + 1);
    expect(second.total).toBe(first.total);
    await expect(prev).toBeEnabled();

    await prev.focus();
    await page.keyboard.press("Enter");
    await expect(live).toHaveText(`1–${first.end} de ${first.total} estudios`);
    expect(requests, `${label}: client pagination issues no request`).toEqual([]);
    expectExactReservation(await readC02Pager(page, pagerSelector, rowSelector), `${label} after paging`);
    await expectNoOuterScroll(page, label);
  });

  test("Precios shows every study of the category in one view, without a pager @ 1366x768 and 768x1024", async ({ page }) => {
    const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === "admin-precios");
    if (!surface) throw new Error("C02: missing canonical admin-precios surface");
    for (const viewport of [{ width: 1366, height: 768 }, { width: 768, height: 1024 }]) {
      const label = `Precios all-in-view @ ${viewport.width}x${viewport.height}`;
      await page.setViewportSize(viewport);
      await prepareSurface(page, surface);
      await openSurface(page, surface);
      const tabs = page.locator('[role="tablist"][aria-label="Categorías de precios"]');
      await expect(tabs.getByRole("tab"), `${label}: Citología and Histopatología stay separate tabs`).toHaveCount(2);
      for (const tab of await tabs.getByRole("tab").all()) {
        await tab.click();
        const declared = Number((await tab.locator("span").last().textContent())?.trim());
        await expect(page.locator('[data-admin-pricing-all-items="true"]'), `${label}: one view`).toHaveCount(1);
        await expect(page.locator("form[data-admin-pricing-item-form]").filter({ visible: true })).toHaveCount(declared);
        await expect(page.locator('[data-collection-pager="compact"]').filter({ visible: true })).toHaveCount(0);
      }
      await expectNoOuterScroll(page, label);
    }
  });

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    test(`centered variant (DashboardPager) on Logística @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const label = `C02 clinic-logistica @ ${viewport.width}x${viewport.height}`;
      const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === "clinic-logistica");
      if (!surface) throw new Error("C02: missing canonical clinic-logistica surface");
      await page.setViewportSize(viewport);
      await prepareSurface(page, surface);
      // The A03 dataset (256 synthetic visits) is what makes this list paginate.
      await addAppCookies(page, [A03_ADAPTIVE_DATASET_COOKIE]);
      await openSurface(page, surface);

      const pagerSelector = '[data-clinic-logistics-pagination-footer="true"] [data-collection-pager="centered"]';
      const pager = page.getByRole("navigation", { name: "Paginación de visitas recientes" });
      await expect(pager).toBeVisible();
      await expect(pager).toHaveAttribute("data-collection-pager", "centered");
      await expect(pager).toHaveAttribute("data-dashboard-pager", "true");
      await expect(pager).toHaveAttribute("data-dashboard-adaptive-reserved-region", "pager");

      const rowSelector = '[data-clinic-logistics-row="true"]';
      const before = await readC02Pager(page, pagerSelector, rowSelector);
      console.log(`[C02] ${label}: ${JSON.stringify(before)}`);
      expectExactReservation(before, label);
      expect(before.blockSize, `${label}: touch reservation floor`).toBeGreaterThanOrEqual(40);
      expect(before.controlHeights, `${label}: text controls keep h-8`).toEqual([32, 32]);

      const live = pager.locator('.sr-only[aria-live="polite"]');
      const state = pager.locator('[data-dashboard-pager-state="true"]');
      const first = parseRange(await live.textContent(), label);
      expect(first).toMatchObject({ start: 1, total: 256 });
      expect(first.size, `${label}: rendered rows equal the announced range`).toBe(before.rows);
      const pageCount = Math.ceil(first.total / first.size);
      // Clinic desktop/tablet space pass: from 768px up the page state is not
      // painted (Anterior / Siguiente only); the announced range still proves
      // every transition below.
      const statePainted = viewport.width < 768;
      const expectState = async (pageNumber: number) => {
        if (statePainted) await expect(state).toHaveText(`Pág. ${pageNumber} / ${pageCount}`);
        else await expect(state, `${label}: page state not painted`).toBeHidden();
      };
      await expectState(1);
      const prev = pager.getByRole("button", { name: "Página anterior" });
      const next = pager.getByRole("button", { name: "Página siguiente" });
      await expect(prev).toBeDisabled();
      await expect(next).toBeEnabled();

      const requests = trackApiRequests(page);
      await next.focus();
      await page.keyboard.press("Enter");
      await expect(live).toHaveText(`${first.end + 1}–${first.end + first.size} de 256`);
      await expectState(2);
      await expect(prev).toBeEnabled();
      await prev.click();
      await expectState(1);
      await expect(live).toHaveText(`1–${first.size} de 256`);
      expect(requests, `${label}: client pagination issues no request`).toEqual([]);
      expectExactReservation(await readC02Pager(page, pagerSelector, rowSelector), `${label} after paging`);
      await expectNoOuterScroll(page, label);
    });
  }
});

// C03 · CollectionState renders the legacy EmptyState/ErrorState on a real
// consumer. Informes (full route) is the A03/A05 pilot whose empty and error
// branches share one bounded canvas: the default clinic session gets the
// fixture's 404 (SSR load error) and the populated one an unmatched query
// (empty). Loading is not deterministically observable on a real consumer, so
// its contract is proved at runtime in frontend-dashboard-state-polish.test.ts.

type C03StateReadout = {
  count: number;
  role: string | null;
  ariaLive: string | null;
  ariaBusy: string | null;
  headings: string[];
  insidePanel: boolean;
  clippedOrScrolling: string[];
  otherStates: string[];
};

async function readC03State(page: Page, variant: "empty" | "error"): Promise<C03StateReadout> {
  return page.evaluate((stateVariant) => {
    const visible = (element: Element) => element.getClientRects().length > 0;
    const states = [...document.querySelectorAll<HTMLElement>(`[data-collection-state="${stateVariant}"]`)].filter(visible);
    const state = states[0];
    const panel = state?.closest<HTMLElement>("section#reports-master-list");
    if (!state || !panel) {
      return { count: states.length, role: null, ariaLive: null, ariaBusy: null, headings: [], insidePanel: false, clippedOrScrolling: [], otherStates: [] };
    }
    const box = state.getBoundingClientRect();
    const frame = panel.getBoundingClientRect();
    const clippedOrScrolling = [panel, ...panel.querySelectorAll<HTMLElement>("*")]
      .filter((element) => element.scrollHeight - element.clientHeight > 1 || element.scrollWidth - element.clientWidth > 1)
      .map((element) => `${element.tagName.toLowerCase()}.${[...element.classList].slice(0, 3).join(".")}`);
    return {
      count: states.length,
      role: state.getAttribute("role"),
      ariaLive: state.getAttribute("aria-live"),
      ariaBusy: state.getAttribute("aria-busy"),
      headings: [...state.querySelectorAll("h2")].map((heading) => heading.textContent?.trim() ?? ""),
      insidePanel:
        box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1 && box.left >= frame.left - 1 && box.right <= frame.right + 1,
      clippedOrScrolling,
      otherStates: [...document.querySelectorAll("[data-collection-state]")]
        .filter((element) => element !== state && visible(element))
        .map((element) => element.getAttribute("data-collection-state") ?? ""),
    };
  }, variant);
}

async function openC03Informes(page: Page, viewport: { width: number; height: number }, profile: "default" | "populated", path: string) {
  await page.setViewportSize(viewport);
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await addAppCookies(page, [sessionCookie("clinic", profile)]);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator(MAIN_SELECTOR)).toBeVisible({ timeout: 25_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  await waitForLayoutSettled(page);
}

test.describe("C03 · CollectionState owns the legacy states on a real consumer", () => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    test(`error variant (ErrorState) on Informes @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const label = `C03 error clinic-informes-full @ ${viewport.width}x${viewport.height}`;
      await openC03Informes(page, viewport, "default", "/dashboard/informes");

      const state = page.locator('[data-collection-state="error"]').filter({ visible: true });
      await expect(state).toHaveCount(1);
      await expect(state).toHaveAttribute("role", "alert");
      await expect(state.getByRole("heading", { level: 2, name: "No se pudieron cargar los informes" })).toBeVisible();
      await expect(state).toContainText("No se pudieron cargar los informes. Intente nuevamente.");
      await expect(state.getByRole("button", { name: "Reintentar" }), `${label}: no retry without onRetry`).toHaveCount(0);

      const readout = await readC03State(page, "error");
      console.log(`[C03] ${label}: ${JSON.stringify(readout)}`);
      expect(readout).toMatchObject({ count: 1, role: "alert", ariaLive: null, ariaBusy: null, insidePanel: true });
      expect(readout.clippedOrScrolling, `${label}: the state fits its canvas without clip or nested scroll`).toEqual([]);
      expect(readout.otherStates, `${label}: an error is never shown as empty or loading`).toEqual([]);
      await expectNoOuterScroll(page, label);
    });

    test(`empty variant (EmptyState) on Informes @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const label = `C03 empty clinic-informes-full @ ${viewport.width}x${viewport.height}`;
      await openC03Informes(page, viewport, "populated", "/dashboard/informes?query=c03-sin-coincidencias");

      const state = page.locator('[data-collection-state="empty"]').filter({ visible: true });
      await expect(state).toHaveCount(1);
      await expect(state.getByRole("heading", { level: 2, name: "No hay informes disponibles." })).toBeVisible();
      await expect(state).toContainText("Cuando haya informes para los filtros actuales, aparecerán en esta lista.");
      await expect(page.getByRole("alert").filter({ hasText: "No se pudieron cargar los informes" })).toHaveCount(0);

      const readout = await readC03State(page, "empty");
      console.log(`[C03] ${label}: ${JSON.stringify(readout)}`);
      expect(readout).toMatchObject({ count: 1, role: null, ariaLive: null, ariaBusy: null, insidePanel: true });
      expect(readout.clippedOrScrolling, `${label}: the state fits its canvas without clip or nested scroll`).toEqual([]);
      expect(readout.otherStates, `${label}: empty is never shown as error or loading`).toEqual([]);
      await expectNoOuterScroll(page, label);
    });
  }
});

// C06 · useCollectionSelection on Auditoría's table form. Selection is state
// only: it never fetches, pages or opens the row's detail dialog, and the
// selector column fits the frozen row pitch without moving the A03 limit.
test.describe("C06 · Auditoría collection selection", () => {
  const auditSurface = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
  if (!auditSurface) throw new Error("C06: missing canonical admin-auditoria surface");
  const desktopCard = '#audit-log > section[aria-label="Registro operativo"]';
  const pageSelector = `${desktopCard} thead input[data-collection-selection="page"]`;
  const rowSelector = `${desktopCard} tbody[data-content-list="true"] > tr[data-content-list-item="true"]`;

  async function readPageCheckbox(page: Page) {
    return page.locator(pageSelector).evaluate((input: HTMLInputElement) => ({
      checked: input.checked,
      indeterminate: input.indeterminate,
    }));
  }

  async function readRowStates(page: Page) {
    return page.locator(rowSelector).evaluateAll((rows) =>
      rows.map((row) => {
        const input = row.querySelector<HTMLInputElement>('input[data-collection-selection="item"]');
        return { name: input?.getAttribute("aria-label") ?? "", checked: Boolean(input?.checked), state: row.getAttribute("data-state") };
      }),
    );
  }

  test("individual, multiple, page, keyboard and paging contract @ 1366x768", async ({ page }) => {
    const label = "C06 admin-auditoria @ 1366x768";
    await page.setViewportSize({ width: 1366, height: 768 });
    await prepareSurface(page, auditSurface);
    await openSurface(page, auditSurface);

    const rows = page.locator(rowSelector);
    await expect(rows.first()).toBeVisible();
    const limit = await rows.count();
    expect(limit, `${label}: a multi-row page`).toBeGreaterThan(3);
    const itemBoxes = rows.locator('input[data-collection-selection="item"]');
    await expect(itemBoxes).toHaveCount(limit);
    expect(await readPageCheckbox(page)).toEqual({ checked: false, indeterminate: false });
    expect((await readRowStates(page)).every((row) => !row.checked && row.state === null)).toBe(true);

    const requests: string[] = [];
    page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));

    // Individual + multiple by click; the row's detail dialog never opens.
    await itemBoxes.nth(0).click();
    await expect(itemBoxes.nth(0)).toBeChecked();
    await expect(rows.nth(0)).toHaveAttribute("data-state", "selected");
    await expect(page.locator(pageSelector)).toBeChecked({ indeterminate: true });
    await itemBoxes.nth(1).click();
    await expect(itemBoxes.nth(1)).toBeChecked();
    await expect(itemBoxes.nth(0)).toBeChecked();
    await itemBoxes.nth(0).click();
    await expect(itemBoxes.nth(0)).not.toBeChecked();
    await expect(rows.nth(0)).not.toHaveAttribute("data-state", "selected");
    await expect(itemBoxes.nth(1)).toBeChecked();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Keyboard: Space toggles the focused selector, Enter does not, Tab reaches the row action next.
    await itemBoxes.nth(2).focus();
    await page.keyboard.press("Space");
    await expect(itemBoxes.nth(2)).toBeChecked();
    await page.keyboard.press("Enter");
    await expect(itemBoxes.nth(2)).toBeChecked();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("Space");
    await expect(itemBoxes.nth(2)).not.toBeChecked();
    await page.keyboard.press("Tab");
    await expect(rows.nth(2).getByRole("button", { name: /Ver detalle del evento/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(itemBoxes.nth(3)).toBeFocused();
    expect(await itemBoxes.nth(3).evaluate((input) => input.matches(":focus-visible"))).toBe(true);

    // Accessibility while the page is partially selected (indeterminate header).
    await expect(page.getByRole("checkbox", { name: "Seleccionar los eventos de esta página" })).toBeVisible();
    const firstName = (await readRowStates(page))[0].name;
    expect(firstName).toMatch(/^Seleccionar evento \d+$/);
    await expect(page.getByRole("checkbox", { name: firstName, exact: true })).toHaveCount(1);
    const axe = await new AxeBuilder({ page })
      .include(desktopCard)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`), `${label}: axe`).toEqual([]);

    // Page selection by keyboard: partial -> all visible; all -> none (clears the page).
    await page.locator(pageSelector).focus();
    await page.keyboard.press("Space");
    expect(await readPageCheckbox(page)).toEqual({ checked: true, indeterminate: false });
    expect((await readRowStates(page)).every((row) => row.checked && row.state === "selected")).toBe(true);
    await page.locator(pageSelector).click();
    expect(await readPageCheckbox(page)).toEqual({ checked: false, indeterminate: false });
    expect((await readRowStates(page)).every((row) => !row.checked && row.state === null)).toBe(true);

    // Primary action keeps its behaviour and leaves the selection as it was.
    await itemBoxes.nth(0).click();
    await rows.nth(0).getByRole("button", { name: /Ver detalle del evento/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(itemBoxes.nth(0)).toBeChecked();
    await expect(itemBoxes).toHaveCount(limit);
    expect(requests, `${label}: selection is local state, no request`).toEqual([]);

    // Paging: the page flags follow the visible IDs; the selection persists by ID.
    const range = page.locator(`${desktopCard} footer span[aria-live="polite"]`);
    const firstRange = (await range.textContent())?.trim() ?? "";
    await page.locator(`${desktopCard} footer`).getByRole("button", { name: "Página siguiente" }).click();
    await expect(range).not.toHaveText(firstRange);
    // The range derives from the offset at once; wait for the fetched rows themselves.
    await expect(page.getByRole("checkbox", { name: firstName, exact: true })).toHaveCount(0);
    await expect(rows).toHaveCount(limit);
    const secondPage = await readRowStates(page);
    expect(secondPage.some((row) => row.name === firstName), `${label}: page 2 shows other IDs`).toBe(false);
    expect(secondPage.every((row) => !row.checked)).toBe(true);
    expect(await readPageCheckbox(page)).toEqual({ checked: false, indeterminate: false });
    await page.locator(`${desktopCard} footer`).getByRole("button", { name: "Página anterior" }).click();
    await expect(range).toHaveText(firstRange);
    await expect(page.getByRole("checkbox", { name: firstName, exact: true })).toHaveCount(1);
    await expect(page.getByRole("checkbox", { name: firstName, exact: true })).toBeChecked();
    await expect(page.locator(pageSelector)).toBeChecked({ indeterminate: true });
    await expect(rows).toHaveCount(limit);
    await expectNoOuterScroll(page, label);
  });

  for (const slug of ["w1920x1080", "w1280x720", "w1024x768", "w834x1194", "w768x1024"] as const) {
    const viewport = DASHBOARD_GEOMETRY_VIEWPORTS.find((candidate) => candidate.slug === slug);
    if (!viewport) throw new Error(`C06: missing canonical viewport ${slug}`);

    test(`selector column fits the frozen geometry @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const label = `C06 admin-auditoria @ ${viewport.width}x${viewport.height}`;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareSurface(page, auditSurface);
      await openSurface(page, auditSurface);
      await expect(page.locator(rowSelector).first()).toBeVisible();
      await page.locator(`${rowSelector} input[data-collection-selection="item"]`).first().click();
      const metrics = await page.locator(desktopCard).evaluate((card) => {
        const frame = card.querySelector("table")!.parentElement!;
        const box = (selector: string) => {
          const rect = card.querySelector(selector)!.getBoundingClientRect();
          return [rect.width, rect.height];
        };
        const rows = [...card.querySelectorAll('tbody > tr[data-content-list-item="true"]')];
        const canvas = card.querySelector("[data-dashboard-row-pitch]")!;
        return {
          frameOverflowX: frame.scrollWidth - frame.clientWidth,
          frameOverflowY: frame.scrollHeight - frame.clientHeight,
          checkbox: box('tbody input[data-collection-selection="item"]'),
          headCheckbox: box('thead input[data-collection-selection="page"]'),
          rowHeights: [...new Set(rows.map((row) => Math.round(row.getBoundingClientRect().height * 100) / 100))],
          pitch: Number.parseFloat(getComputedStyle(canvas).getPropertyValue("--dash-row-pitch")),
          headHeight: card.querySelector("thead")!.getBoundingClientRect().height,
        };
      });
      console.log(`[C06] ${label}: ${JSON.stringify(metrics)}`);
      expect(metrics.frameOverflowX, `${label}: no horizontal overflow from the selector column`).toBeLessThanOrEqual(0);
      expect(metrics.frameOverflowY, `${label}: no internal vertical scroll`).toBeLessThanOrEqual(0);
      expect(metrics.checkbox).toEqual([18, 18]);
      expect(metrics.headCheckbox).toEqual([18, 18]);
      expect(metrics.rowHeights, `${label}: rows keep the frozen pitch`).toEqual([metrics.pitch]);
      expect(metrics.headHeight).toBeCloseTo(32, 0);
      await expectNoOuterScroll(page, label);
    });
  }
});


// C06 · the mobile list form selects on the same owner as the table: a native
// checkbox per item inside the item's own row, so the canvas, pitch and A03
// limit do not move. Page selection has no authorized mobile host (see the
// documented blocker): no S1, pager, toolbar or new reserved region.
test.describe("C06 · Auditoría mobile collection selection", () => {
  const auditSurface = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
  if (!auditSurface) throw new Error("C06: missing canonical admin-auditoria surface");
  const mobileModule = '[data-admin-mobile-ops-module="audit"]';
  const itemSelector = `${mobileModule} [data-content-list="true"] > article[data-content-list-item="true"]`;

  async function readMobileItems(page: Page) {
    return page.locator(itemSelector).evaluateAll((items) =>
      items.map((item) => {
        const input = item.querySelector<HTMLInputElement>('input[data-collection-selection="item"]');
        return { name: input?.getAttribute("aria-label") ?? "", checked: Boolean(input?.checked), state: item.getAttribute("data-state") };
      }),
    );
  }

  test("individual, multiple, keyboard, Ver and paging on the shared owner @ 390x844", async ({ page }) => {
    const label = "C06 mobile admin-auditoria @ 390x844";
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareSurface(page, auditSurface);
    await openSurface(page, auditSurface);

    const items = page.locator(itemSelector);
    await expect(items.first()).toBeVisible();
    const limit = await items.count();
    const boxes = items.locator('input[data-collection-selection="item"]');
    await expect(boxes).toHaveCount(limit);
    expect((await readMobileItems(page)).every((item) => !item.checked && item.state === null)).toBe(true);

    const requests: string[] = [];
    page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));

    await boxes.nth(0).click();
    await boxes.nth(1).click();
    await expect(boxes.nth(0)).toBeChecked();
    await expect(boxes.nth(1)).toBeChecked();
    await expect(items.nth(0)).toHaveAttribute("data-state", "selected");
    await boxes.nth(1).click();
    await expect(boxes.nth(1)).not.toBeChecked();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await boxes.nth(2).focus();
    await page.keyboard.press("Space");
    await expect(boxes.nth(2)).toBeChecked();
    expect(await boxes.nth(2).evaluate((input) => input.matches(":focus-visible"))).toBe(true);
    await page.keyboard.press("Space");
    await expect(boxes.nth(2)).not.toBeChecked();
    await page.keyboard.press("Tab");
    await expect(items.nth(2).getByRole("button", { name: /Ver detalle del evento/ })).toBeFocused();

    await items.nth(0).getByRole("button", { name: /Ver detalle del evento/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(boxes.nth(0)).toBeChecked();

    // Page checkbox in the mobile strip: same owner, visible IDs only.
    const pageBox = page.getByRole("checkbox", { name: "Seleccionar los eventos de esta página" });
    await expect(pageBox).toHaveCount(1);
    await expect(pageBox).toBeChecked({ indeterminate: true });
    const urlBefore = page.url();
    await pageBox.focus();
    await page.keyboard.press("Space");
    await expect(pageBox).toBeChecked();
    expect(await pageBox.evaluate((input: HTMLInputElement) => input.indeterminate)).toBe(false);
    expect((await readMobileItems(page)).every((item) => item.checked && item.state === "selected")).toBe(true);
    expect(await pageBox.evaluate((input) => input.matches(":focus-visible"))).toBe(true);
    await pageBox.click();
    await expect(pageBox).not.toBeChecked();
    expect((await readMobileItems(page)).every((item) => !item.checked)).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(page.url(), `${label}: no filter submit or navigation`).toBe(urlBefore);
    await boxes.nth(0).click();
    expect(requests, `${label}: selection is local state, no request`).toEqual([]);

    const axe = await new AxeBuilder({ page })
      .include(mobileModule)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`), `${label}: axe`).toEqual([]);

    const firstName = (await readMobileItems(page))[0].name;
    const pager = page.locator(`${mobileModule} nav[data-admin-mobile-ops-pager="true"]`);
    await pager.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByRole("checkbox", { name: firstName, exact: true })).toHaveCount(0);
    await expect(items).toHaveCount(limit);
    expect((await readMobileItems(page)).every((item) => !item.checked)).toBe(true);
    await expect(pageBox).not.toBeChecked();
    expect(await pageBox.evaluate((input: HTMLInputElement) => input.indeterminate)).toBe(false);
    await pageBox.click();
    expect((await readMobileItems(page)).every((item) => item.checked)).toBe(true);
    await pager.getByRole("button", { name: "Anterior" }).click();
    await expect(page.getByRole("checkbox", { name: firstName, exact: true })).toBeChecked();
    await expect(pageBox).toBeChecked({ indeterminate: true });
    expect((await readMobileItems(page)).filter((item) => item.checked).length, "page 2 selection never leaks into page 1").toBe(1);
    await expect(items).toHaveCount(limit);
    await expectNoOuterScroll(page, label);
  });

  for (const [width, height] of [[320, 568], [360, 800], [375, 812], [390, 844], [412, 915], [430, 932], [767, 1024]] as const) {
    test(`item selector fits each row without moving the canvas @ ${width}x${height}`, async ({ page }) => {
      const label = `C06 mobile admin-auditoria @ ${width}x${height}`;
      await page.setViewportSize({ width, height });
      await prepareSurface(page, auditSurface);
      await openSurface(page, auditSurface);
      await expect(page.locator(itemSelector).first()).toBeVisible();
      await page.locator(`${itemSelector} input[data-collection-selection="item"]`).first().click();

      const metrics = await page.locator(mobileModule).evaluate((module) => {
        const canvas = module.querySelector<HTMLElement>('[data-content-list="true"]')!;
        const items = [...canvas.querySelectorAll<HTMLElement>(':scope > article[data-content-list-item="true"]')];
        const pitch = Number.parseFloat(getComputedStyle(canvas).getPropertyValue("--dash-row-pitch"));
        const geometry = items.map((item) => {
          const row = item.getBoundingClientRect();
          const box = item.querySelector('input[data-collection-selection="item"]')!.getBoundingClientRect();
          const hit = item.querySelector("label")!.getBoundingClientRect();
          const view = item.querySelector("button")!.getBoundingClientRect();
          return {
            rowHeight: Math.round(row.height * 100) / 100,
            box: [box.width, box.height],
            hit: [hit.width, hit.height],
            inside: hit.left >= row.left && view.right <= row.right + 0.5 && hit.top >= row.top - 0.5 && hit.bottom <= row.bottom + 0.5,
            overlap: hit.right > view.left,
            viewVisible: view.width > 0 && view.height > 0,
          };
        });
        const canvasRect = canvas.getBoundingClientRect();
        const pageBoxes = [...module.querySelectorAll<HTMLElement>('[data-collection-selection="page"]')];
        const strip = pageBoxes[0]?.closest("label")?.parentElement ?? null;
        const stripRect = strip?.getBoundingClientRect();
        const pageHit = pageBoxes[0]?.closest("label")?.getBoundingClientRect();
        const stripChildren = strip
          ? [...strip.children].filter((child) => !child.matches('[data-selection-live="true"]')).map((child) => child.getBoundingClientRect())
          : [];
        const filtersButton = [...(strip?.querySelectorAll("button") ?? [])]
          .find((button) => button.textContent?.trim() === "Filtros")?.getBoundingClientRect();
        return {
          items: items.length,
          pitch,
          canvasOverflowY: canvas.scrollHeight - canvas.clientHeight,
          canvasOverflowX: canvas.scrollWidth - canvas.clientWidth,
          leftoverPx: Math.round((canvasRect.height - items.length * pitch) * 10) / 10,
          pageSelectors: pageBoxes.length,
          pageInsideForm: Boolean(pageBoxes[0]?.closest("form")),
          stripHeight: stripRect ? Math.round(stripRect.height * 10) / 10 : null,
          stripOverflowX: strip ? strip.scrollWidth - strip.clientWidth : null,
          pageHit: pageHit ? [pageHit.width, pageHit.height] : null,
          stripOverlap: stripChildren.some((rect, index) => index > 0 && rect.left < stripChildren[index - 1].right - 0.5),
          stripInside: Boolean(stripRect && stripChildren.every((rect) => rect.left >= stripRect.left - 0.5 && rect.right <= stripRect.right + 0.5)),
          filtersVisible: Boolean(filtersButton && filtersButton.width > 0),
          geometry,
        };
      });
      console.log(`[C06 mobile] ${label}: ${JSON.stringify({ ...metrics, geometry: metrics.geometry[0] })}`);
      expect(metrics.items).toBeGreaterThan(0);
      expect(metrics.canvasOverflowY, `${label}: no internal vertical scroll`).toBeLessThanOrEqual(0);
      expect(metrics.canvasOverflowX, `${label}: no horizontal overflow`).toBeLessThanOrEqual(0);
      expect(metrics.pageSelectors, `${label}: one page selector in the mobile strip`).toBe(1);
      expect(metrics.pageInsideForm, `${label}: the page selector is never part of the S1 form`).toBe(false);
      expect(metrics.stripHeight, `${label}: the strip keeps its 53px height`).toBe(53);
      expect(metrics.stripOverflowX, `${label}: the strip does not overflow`).toBeLessThanOrEqual(0);
      expect(metrics.stripOverlap, `${label}: strip controls never overlap`).toBe(false);
      expect(metrics.stripInside, `${label}: strip controls stay inside the strip`).toBe(true);
      expect(metrics.filtersVisible, `${label}: Filtros stays visible`).toBe(true);
      expect(metrics.pageHit![0], `${label}: 36px page touch target`).toBeGreaterThanOrEqual(36);
      expect(metrics.pageHit![1], `${label}: 36px page touch target`).toBeGreaterThanOrEqual(36);
      for (const [index, row] of metrics.geometry.entries()) {
        expect(row.rowHeight, `${label} item ${index}: frozen pitch`).toBe(metrics.pitch);
        expect(row.box, `${label} item ${index}: 18px checkbox`).toEqual([18, 18]);
        expect(row.hit[0], `${label} item ${index}: 36px touch target`).toBeGreaterThanOrEqual(36);
        expect(row.hit[1], `${label} item ${index}: 36px touch target`).toBeGreaterThanOrEqual(36);
        expect(row.inside, `${label} item ${index}: selector and Ver stay inside the row`).toBe(true);
        expect(row.overlap, `${label} item ${index}: selector never overlaps Ver`).toBe(false);
        expect(row.viewVisible, `${label} item ${index}: Ver stays visible`).toBe(true);
      }
      await expectNoOuterScroll(page, label);
    });
  }
});

// C07 · SelectionToolbar takes the DefaultToolbar's place while the C06 owner
// has a selection, and gives it back when cleared: no new band, no capacity
// change. List form: inside the mobile strip, beside the page selector. Table
// form (admin desktop/tablet space pass, the section header is retired): an
// overlay host in the table header row, beside the page selector, covering the
// column labels only while there is a selection.
test.describe("C07 · Auditoría contextual SelectionToolbar", () => {
  const auditSurface = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
  if (!auditSurface) throw new Error("C07: missing canonical admin-auditoria surface");
  const desktopCard = '#audit-log > section[aria-label="Registro operativo"]';
  const desktopHeader = `${desktopCard} thead [data-audit-selection-toolbar-host="true"]`;
  const desktopRows = `${desktopCard} tbody[data-content-list="true"] > tr[data-content-list-item="true"]`;
  const mobileModule = '[data-admin-mobile-ops-module="audit"]';
  const mobileItems = `${mobileModule} [data-content-list="true"] > article[data-content-list-item="true"]`;

  async function readHost(page: Page, hostSelector: string, canvasSelector: string) {
    return page.locator(hostSelector).evaluate((host, canvas) => {
      const rect = host.getBoundingClientRect();
      const toolbar = host.querySelector<HTMLElement>('[data-selection-toolbar="true"]');
      const clear = toolbar?.querySelector("button")?.getBoundingClientRect();
      const count = toolbar?.querySelector<HTMLElement>("[data-selection-count]");
      const live = host.querySelector<HTMLElement>('[data-selection-live="true"]');
      const children = [...host.children].filter((child) => child !== live).map((child) => child.getBoundingClientRect()).filter((box) => box.width > 0);
      return {
        height: Math.round(rect.height * 100) / 100,
        overflowX: host.scrollWidth - host.clientWidth,
        canvasHeight: Math.round(document.querySelector(canvas)!.getBoundingClientRect().height * 100) / 100,
        toolbar: Boolean(toolbar),
        clear: clear ? [Math.round(clear.width), Math.round(clear.height)] : null,
        countTruncated: count ? count.scrollWidth > count.clientWidth : null,
        live: live ? { text: live.textContent, ariaLive: live.getAttribute("aria-live") } : null,
        clearInside: Boolean(clear && clear.left >= rect.left - 0.5 && clear.right <= rect.right + 0.5 && clear.top >= rect.top - 0.5 && clear.bottom <= rect.bottom + 0.5),
        overlap: children.some((box, index) => index > 0 && box.left < children[index - 1].right - 0.5),
      };
    }, canvasSelector);
  }

  test("swap, count, paging, keyboard clear and focus on the table form @ 1366x768", async ({ page }) => {
    const label = "C07 admin-auditoria @ 1366x768";
    await page.setViewportSize({ width: 1366, height: 768 });
    await prepareSurface(page, auditSurface);
    await openSurface(page, auditSurface);

    const rows = page.locator(desktopRows);
    await expect(rows.first()).toBeVisible();
    const limit = await rows.count();
    const boxes = rows.locator('input[data-collection-selection="item"]');
    const header = page.locator(desktopHeader);
    const toolbar = header.getByRole("group", { name: "Selección" });
    const canvas = `${desktopCard} [data-dashboard-adaptive-rows-canvas="true"]`;
    const pageSelector = page.locator(`${desktopCard} thead input[data-collection-selection="page"]`);
    // Idle, the host is transparent and inert: the column labels stay readable.
    await expect(header).toHaveCSS("pointer-events", "none");
    await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(toolbar).toHaveCount(0);
    const idle = await readHost(page, desktopHeader, canvas);
    expect(idle.toolbar).toBe(false);
    expect(idle.live, `${label}: the live region is mounted, empty, before the first selection`).toEqual({ text: "", ariaLive: "polite" });
    const liveNode = await header.locator('[data-selection-live="true"]').elementHandle();

    const requests: string[] = [];
    page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));

    await boxes.nth(0).click();
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toContainText("1 seleccionado");
    await expect(header.locator('[data-selection-live="true"]')).toHaveText("1 seleccionado");
    expect(
      await liveNode!.evaluate((node) => node.isConnected),
      `${label}: the same live region node survives the swap (content change, not insertion)`,
    ).toBe(true);
    await expect(header).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(desktopCard)).toHaveAttribute("aria-label", "Registro operativo");
    const [selectorBox, toolbarBox] = await Promise.all([pageSelector.boundingBox(), toolbar.boundingBox()]);
    expect(
      Math.abs(selectorBox!.y + selectorBox!.height / 2 - (toolbarBox!.y + toolbarBox!.height / 2)),
      `${label}: the toolbar is horizontally aligned with the page selector`,
    ).toBeLessThanOrEqual(1);
    expect(toolbarBox!.x, `${label}: the toolbar starts right after the page selector`).toBeGreaterThan(selectorBox!.x + selectorBox!.width);
    await boxes.nth(1).click();
    await expect(toolbar).toContainText("2 seleccionados");
    const active = await readHost(page, desktopHeader, canvas);
    expect(active.height, `${label}: the swap keeps the header height`).toBe(idle.height);
    expect(active.canvasHeight, `${label}: the canvas keeps its height`).toBe(idle.canvasHeight);
    expect(active.overflowX).toBeLessThanOrEqual(0);
    expect(active.clearInside && !active.overlap, `${label}: clear control inside the header, no overlap`).toBe(true);
    await expect(rows).toHaveCount(limit);
    expect(requests, `${label}: the swap is local state, no request`).toEqual([]);

    const axe = await new AxeBuilder({ page })
      .include(desktopCard)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`), `${label}: axe`).toEqual([]);

    // Paging keeps the selection by ID: the toolbar stays and counts off-page IDs.
    const range = page.locator(`${desktopCard} footer span[aria-live="polite"]`);
    const firstRange = (await range.textContent())?.trim() ?? "";
    const firstName = (await boxes.nth(0).getAttribute("aria-label")) ?? "";
    await page.locator(`${desktopCard} footer`).getByRole("button", { name: "Página siguiente" }).click();
    await expect(range).not.toHaveText(firstRange);
    await expect(page.getByRole("checkbox", { name: firstName, exact: true })).toHaveCount(0);
    await expect(rows).toHaveCount(limit);
    await expect(toolbar).toContainText("2 seleccionados");
    await boxes.nth(0).click();
    await expect(toolbar).toContainText("3 seleccionados");

    // Keyboard: the clear control is reachable in Tab order, focus-visible, and Enter clears the owner.
    await boxes.nth(0).focus();
    const clear = toolbar.getByRole("button", { name: "Limpiar selección" });
    for (let step = 0; step < 40 && !(await clear.evaluate((button) => button === document.activeElement)); step += 1) {
      await page.keyboard.press("Shift+Tab");
    }
    await expect(clear).toBeFocused();
    expect(await clear.evaluate((button) => button.matches(":focus-visible"))).toBe(true);
    requests.length = 0;
    await page.keyboard.press("Enter");
    await expect(toolbar).toHaveCount(0);
    await expect(header).toHaveCSS("pointer-events", "none");
    await expect(pageSelector).toBeFocused();
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    expect(await boxes.evaluateAll((inputs) => inputs.filter((input) => (input as HTMLInputElement).checked).length)).toBe(0);
    expect((await readHost(page, desktopHeader, canvas)).height).toBe(idle.height);
    expect(requests, `${label}: clearing is local state, no request`).toEqual([]);

    // The clear covered the IDs selected on the other page as well.
    await page.locator(`${desktopCard} footer`).getByRole("button", { name: "Página anterior" }).click();
    await expect(range).toHaveText(firstRange);
    await expect(page.getByRole("checkbox", { name: firstName, exact: true })).not.toBeChecked();
    await expect(toolbar).toHaveCount(0);
    await expect(rows).toHaveCount(limit);
    await expectNoOuterScroll(page, label);
  });

  for (const slug of ["w1920x1080", "w1280x720", "w1024x768", "w834x1194", "w768x1024"] as const) {
    const viewport = DASHBOARD_GEOMETRY_VIEWPORTS.find((candidate) => candidate.slug === slug);
    if (!viewport) throw new Error(`C07: missing canonical viewport ${slug}`);

    test(`table-form swap keeps the header and canvas @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const label = `C07 admin-auditoria @ ${viewport.width}x${viewport.height}`;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareSurface(page, auditSurface);
      await openSurface(page, auditSurface);
      const rows = page.locator(desktopRows);
      await expect(rows.first()).toBeVisible();
      const limit = await rows.count();
      const canvas = `${desktopCard} [data-dashboard-adaptive-rows-canvas="true"]`;
      const idle = await readHost(page, desktopHeader, canvas);
      await rows.locator('input[data-collection-selection="item"]').first().click();
      await expect(page.locator(`${desktopHeader} [data-selection-toolbar="true"]`)).toBeVisible();
      const active = await readHost(page, desktopHeader, canvas);
      console.log(`[C07] ${label}: ${JSON.stringify({ idle, active })}`);
      expect(active.height, `${label}: header height`).toBe(idle.height);
      expect(active.canvasHeight, `${label}: canvas height`).toBe(idle.canvasHeight);
      expect(active.overflowX, `${label}: no horizontal overflow`).toBeLessThanOrEqual(0);
      expect(active.clearInside, `${label}: clear control inside the header`).toBe(true);
      expect(active.overlap, `${label}: no overlap`).toBe(false);
      expect(active.clear![1], `${label}: 32px toolbar action`).toBe(32);
      expect(active.countTruncated, `${label}: the count is legible`).toBe(false);
      await expect(rows).toHaveCount(limit);
      await page.getByRole("button", { name: "Limpiar selección" }).click();
      await expect(page.locator(`${desktopHeader} [data-selection-toolbar="true"]`)).toHaveCount(0);
      expect(await readHost(page, desktopHeader, canvas)).toEqual(idle);
      await expectNoOuterScroll(page, label);
    });
  }

  test("swap, count, keyboard clear and focus on the mobile strip @ 390x844", async ({ page }) => {
    const label = "C07 mobile admin-auditoria @ 390x844";
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareSurface(page, auditSurface);
    await openSurface(page, auditSurface);

    const items = page.locator(mobileItems);
    await expect(items.first()).toBeVisible();
    const limit = await items.count();
    const boxes = items.locator('input[data-collection-selection="item"]');
    const pageBox = page.getByRole("checkbox", { name: "Seleccionar los eventos de esta página" });
    const strip = `${mobileModule} label:has(> input[data-collection-selection="page"])`;
    const toolbar = page.locator(mobileModule).getByRole("group", { name: "Selección" });
    const filtros = page.locator(mobileModule).getByRole("button", { name: "Filtros", exact: true });
    const canvas = `${mobileModule} [data-content-list="true"]`;
    const host = `${strip} >> xpath=..`;
    // Pre-C05 mobile space: the idle strip paints no summary; Filtros sits next to the page selector.
    const retiredSummary = page.locator(host).getByText("Todos los eventos", { exact: true });
    await expect(toolbar).toHaveCount(0);
    await expect(retiredSummary).toHaveCount(0);
    const stripOrder = await page.locator(host).evaluate((strip) => {
      const pageSelector = strip.querySelector('input[data-collection-selection="page"]')!.closest("label")!.getBoundingClientRect();
      const filters = [...strip.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Filtros")!.getBoundingClientRect();
      return { pageRight: pageSelector.right, filtersLeft: filters.left, sameRow: Math.abs((pageSelector.top + pageSelector.bottom) / 2 - (filters.top + filters.bottom) / 2) <= 4 };
    });
    expect(stripOrder.filtersLeft, "Filtros follows the page selector").toBeGreaterThan(stripOrder.pageRight);
    expect(stripOrder.filtersLeft - stripOrder.pageRight, "Filtros sits next to the page selector").toBeLessThanOrEqual(16);
    expect(stripOrder.sameRow, "Filtros and the page selector share one band").toBe(true);
    const idle = await readHost(page, host, canvas);

    const requests: string[] = [];
    page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));
    const urlBefore = page.url();

    await boxes.nth(0).click();
    await boxes.nth(1).click();
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toContainText("2 seleccionados");
    await expect(filtros).toBeVisible();
    await expect(pageBox).toBeVisible();
    const active = await readHost(page, host, canvas);
    expect(active.height, `${label}: the strip keeps its height`).toBe(idle.height);
    expect(active.canvasHeight, `${label}: the canvas keeps its height`).toBe(idle.canvasHeight);
    expect(active.clear![1], `${label}: 44px touch target below 768`).toBe(44);
    expect(active.clear![0], `${label}: 44px touch target below 768`).toBeGreaterThanOrEqual(44);
    expect(idle.live, `${label}: the live region is mounted, empty, before the first selection`).toEqual({ text: "", ariaLive: "polite" });
    expect(active.live).toEqual({ text: "2 seleccionados", ariaLive: "polite" });
    await expect(items).toHaveCount(limit);

    const axe = await new AxeBuilder({ page })
      .include(mobileModule)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`), `${label}: axe`).toEqual([]);

    // Tab order in the strip (pre-C05): page selector → Filtros → clear; Enter clears and focus returns to the page selector.
    await pageBox.focus();
    await page.keyboard.press("Tab");
    await expect(filtros).toBeFocused();
    await page.keyboard.press("Tab");
    const clear = toolbar.getByRole("button", { name: "Limpiar selección" });
    await expect(clear).toBeFocused();
    expect(await clear.evaluate((button) => button.matches(":focus-visible"))).toBe(true);
    await page.keyboard.press("Shift+Tab");
    await expect(filtros).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(clear).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toolbar).toHaveCount(0);
    await expect(pageBox).toBeFocused();
    await expect(retiredSummary).toHaveCount(0);
    expect(await boxes.evaluateAll((inputs) => inputs.filter((input) => (input as HTMLInputElement).checked).length)).toBe(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(page.url(), `${label}: no filter submit or navigation`).toBe(urlBefore);
    expect(requests, `${label}: swap and clear are local state, no request`).toEqual([]);
    expect(await readHost(page, host, canvas)).toEqual(idle);

    // Page selection drives the same toolbar; it persists across pages while the count is > 0.
    await pageBox.click();
    await expect(toolbar).toContainText(`${limit} seleccionado`);
    const pager = page.locator(`${mobileModule} nav[data-admin-mobile-ops-pager="true"]`);
    await pager.getByRole("button", { name: "Siguiente" }).click();
    await expect(pageBox).not.toBeChecked();
    await expect(toolbar).toContainText(`${limit} seleccionado`);
    await toolbar.getByRole("button", { name: "Limpiar selección" }).click();
    await expect(toolbar).toHaveCount(0);
    await pager.getByRole("button", { name: "Anterior" }).click();
    await expect(items).toHaveCount(limit);
    expect(await boxes.evaluateAll((inputs) => inputs.filter((input) => (input as HTMLInputElement).checked).length)).toBe(0);
    await expectNoOuterScroll(page, label);
  });

  for (const [width, height] of [[320, 568], [360, 800], [375, 812], [412, 915], [430, 932], [767, 1024]] as const) {
    test(`mobile strip swap fits without a new band @ ${width}x${height}`, async ({ page }) => {
      const label = `C07 mobile admin-auditoria @ ${width}x${height}`;
      await page.setViewportSize({ width, height });
      await prepareSurface(page, auditSurface);
      await openSurface(page, auditSurface);
      const items = page.locator(mobileItems);
      await expect(items.first()).toBeVisible();
      const limit = await items.count();
      const host = `${mobileModule} label:has(> input[data-collection-selection="page"]) >> xpath=..`;
      const canvas = `${mobileModule} [data-content-list="true"]`;
      const idle = await readHost(page, host, canvas);
      await items.locator('input[data-collection-selection="item"]').first().click();
      const toolbar = page.locator(mobileModule).getByRole("group", { name: "Selección" });
      await expect(toolbar).toContainText("1 seleccionado");
      const active = await readHost(page, host, canvas);
      console.log(`[C07 mobile] ${label}: ${JSON.stringify({ idle, active })}`);
      expect(active.height, `${label}: the strip keeps its 53px height`).toBe(53);
      expect(active.height).toBe(idle.height);
      expect(active.canvasHeight, `${label}: canvas height`).toBe(idle.canvasHeight);
      expect(active.overflowX, `${label}: no horizontal overflow`).toBeLessThanOrEqual(0);
      expect(active.overlap, `${label}: strip controls never overlap`).toBe(false);
      expect(active.clearInside, `${label}: clear control inside the strip`).toBe(true);
      expect(active.clear![1], `${label}: 44px touch target`).toBe(44);
      expect(active.clear![0], `${label}: 44px touch target`).toBeGreaterThanOrEqual(44);
      expect(active.countTruncated, `${label}: the count is legible`).toBe(false);
      await expect(page.locator(mobileModule).getByRole("button", { name: "Filtros", exact: true })).toBeVisible();
      await expect(items).toHaveCount(limit);
      await expectNoOuterScroll(page, label);
    });
  }
});

let c08Harness: string;

// C08 harness: the four published menu primitives inside the real B15 scaffold
// and the app CSS, beside the C06 selection owner and the C07 toolbar. No
// module adopts a menu before C17+, so this is where their runtime is observed.
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
import { ActionMenu, ActionMenuItem, ContextMenu, OverflowMenu, SelectionToolbar, SubMenu, useCollectionSelection } from "./src/features/dashboard/presentation/surfaces/index.ts";
const main = document.querySelector("main.dashboard-main");
const mount = document.createElement("div");
mount.setAttribute("data-c08-harness", "true");
mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2";
main.style.position = "relative";
main.append(mount);
const log = (window.__c08 = []);
const ROWS = [1, 2, 3];
function Items({ scope }) {
  return (<>
    <ActionMenuItem onSelect={() => log.push(scope + ":editar")}>Editar</ActionMenuItem>
    <ActionMenuItem disabled onSelect={() => log.push(scope + ":archivar")}>Archivar</ActionMenuItem>
    <SubMenu label="Mover a">
      <ActionMenuItem onSelect={() => log.push(scope + ":mover-a")}>Carpeta A</ActionMenuItem>
      <ActionMenuItem onSelect={() => log.push(scope + ":mover-b")}>Carpeta B</ActionMenuItem>
    </SubMenu>
    <SubMenu disabled label="Compartir"><ActionMenuItem onSelect={() => log.push(scope + ":compartir")}>Enlace</ActionMenuItem></SubMenu>
    <ActionMenuItem onSelect={() => log.push(scope + ":eliminar")}>Eliminar</ActionMenuItem>
  </>);
}
function Harness() {
  const selection = useCollectionSelection({ visibleIds: ROWS });
  return (<>
    <WorkspaceScaffold kind="surface" ariaLabel="Arnés C08"
      toolbar={<div data-c08-toolbar="true" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
        <SelectionToolbar selectedCount={selection.selectedCount} onClearSelection={selection.clearSelection}><span data-c08-default-toolbar="true">Registros</span></SelectionToolbar>
        <span style={{ flex: 1 }} />
        <ActionMenu trigger="Acciones"><Items scope="toolbar" /></ActionMenu>
      </div>}
      collection={<ul data-c08-list="true" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {ROWS.map((row) => (
          <ContextMenu key={row} label={"Acciones del registro " + row} menu={<Items scope={"context-" + row} />}>
            {(region) => (
              <li {...region} data-c08-row={row} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "0 12px" }}>
                <input type="checkbox" aria-label={"Seleccionar registro " + row} checked={selection.isSelected(row)} onChange={() => selection.toggle(row)} />
                <span data-c08-row-label={row} style={{ flex: 1, minWidth: 0 }}>Registro {row}</span>
                <button type="button" data-c08-open={row}>Abrir {row}</button>
                <OverflowMenu label={"Más acciones del registro " + row}><Items scope={"overflow-" + row} /></OverflowMenu>
              </li>
            )}
          </ContextMenu>
        ))}
      </ul>}
    />
    <div data-c08-bottom="true" style={{ position: "absolute", right: 8, bottom: 8 }}>
      <ActionMenu trigger="Abajo" align="end"><Items scope="bottom" /></ActionMenu>
    </div>
  </>);
}
createRoot(mount).render(<Harness />);`,
      resolveDir: resolve(process.cwd()),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    alias: { "@": resolve(process.cwd(), "src") },
  });
  c08Harness = result.outputFiles[0].text;
});

// C08 · OverflowMenu, ContextMenu, ActionMenu and SubMenu share one surface
// owner: ARIA menu semantics, full keyboard operation, focus returned to the
// opener, disabled items that never act, viewport-clamped placement and the
// audit §46 geometry (item 32 px from md, 48 px touch below; surface min 200 px).
test.describe("C08 · menu primitives in the WorkspaceScaffold", () => {
  const auditSurface = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
  if (!auditSurface) throw new Error("C08: missing canonical admin-auditoria surface");
  const HARNESS = '[data-c08-harness="true"]';
  const ROOT_MENU = '[data-action-menu-surface="root"]';
  const SUB_MENU = '[data-action-menu-surface="sub"]';

  async function mountHarness(page: Page, width: number, height: number) {
    await page.setViewportSize({ width, height });
    await prepareSurface(page, auditSurface!);
    await openSurface(page, auditSurface!);
    await page.addScriptTag({ content: c08Harness });
    await expect(page.locator(`${HARNESS} [data-c08-row]`)).toHaveCount(3);
    await waitForLayoutSettled(page);
  }

  const readLog = (page: Page) => page.evaluate(() => [...((window as unknown as { __c08: string[] }).__c08)]);
  const focusedName = (page: Page) =>
    page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return active && active !== document.body ? (active.getAttribute("aria-label") ?? active.textContent?.trim() ?? "") : null;
    });

  /** Geometry of an open menu surface, in CSS pixels against the layout viewport. */
  async function readSurface(page: Page, selector: string) {
    return page.locator(selector).evaluate((menu) => {
      const rect = menu.getBoundingClientRect();
      const style = getComputedStyle(menu);
      const items = [...menu.querySelectorAll<HTMLElement>(':scope > [role="menuitem"]')];
      const first = items[0];
      const firstStyle = first ? getComputedStyle(first) : null;
      const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        inside: rect.left >= 8 - 0.5 && rect.top >= 8 - 0.5 && rect.right <= viewport.width - 8 + 0.5 && rect.bottom <= viewport.height - 8 + 0.5,
        position: style.position,
        radius: style.borderTopLeftRadius,
        paddingBlock: [style.paddingTop, style.paddingBottom],
        elevated: style.boxShadow !== "none",
        scrollable: menu.scrollHeight > menu.clientHeight || menu.scrollWidth > menu.clientWidth,
        itemHeights: [...new Set(items.map((item) => Math.round(item.getBoundingClientRect().height * 100) / 100))],
        itemPaddingInline: firstStyle ? [firstStyle.paddingLeft, firstStyle.paddingRight] : null,
        itemRadius: firstStyle?.borderTopLeftRadius ?? null,
        itemsInside: items.every((item) => {
          const box = item.getBoundingClientRect();
          return box.left >= rect.left - 0.5 && box.right <= rect.right + 0.5;
        }),
        firstItemTop: first?.getBoundingClientRect().top ?? null,
      };
    });
  }

  test("ActionMenu: ARIA, keyboard, disabled items, single action and focus restoration @ 1366x768", async ({ page }) => {
    const label = "C08 ActionMenu @ 1366x768";
    await mountHarness(page, 1366, 768);
    const harness = page.locator(HARNESS);
    const trigger = harness.getByRole("button", { name: "Acciones", exact: true });
    const menu = page.getByRole("menu", { name: "Acciones", exact: true });

    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("menu")).toHaveCount(0);

    // Enter opens on the first item; the trigger names and controls the menu. prepareSurface
    // emulates reduced motion, where the global 0.01ms transition makes a surface that is
    // revealed after placement still compute as hidden when its first item takes focus.
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await trigger.getAttribute("aria-controls"), `${label}: aria-controls`).toBe(await menu.getAttribute("id"));
    await expect(menu).toHaveAttribute("aria-orientation", "vertical");
    await expect(menu.getByRole("menuitem")).toHaveText(["Editar", "Archivar", "Mover a", "Compartir", "Eliminar"]);
    await expect(menu.getByRole("menuitem", { name: "Editar" })).toBeFocused();
    expect(await menu.getByRole("menuitem").evaluateAll((items) => items.map((item) => item.getAttribute("tabindex"))),
      `${label}: items are out of the Tab order`).toEqual(["-1", "-1", "-1", "-1", "-1"]);

    // A disabled item is announced and focusable, and never acts — by keyboard or by pointer.
    const disabled = menu.getByRole("menuitem", { name: "Archivar" });
    await expect(disabled).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("ArrowDown");
    await expect(disabled).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await disabled.click({ force: true });
    await expect(menu).toBeVisible();
    expect(await readLog(page), `${label}: a disabled item never runs its action`).toEqual([]);

    // Roving focus: End, Home, wrap-around and type-ahead.
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem", { name: "Eliminar" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Editar" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(menu.getByRole("menuitem", { name: "Eliminar" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(menu.getByRole("menuitem", { name: "Editar" })).toBeFocused();
    await page.keyboard.press("m");
    await expect(menu.getByRole("menuitem", { name: "Mover a" })).toBeFocused();
    expect(await menu.getByRole("menuitem", { name: "Mover a" }).evaluate((item) => item.matches(":focus-visible")), `${label}: visible focus`).toBe(true);

    // Escape closes and returns focus to the trigger.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(await trigger.getAttribute("aria-controls")).toBeNull();

    // ArrowUp opens on the last item; Enter runs the action exactly once and restores focus.
    await page.keyboard.press("ArrowUp");
    await expect(menu.getByRole("menuitem", { name: "Eliminar" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await readLog(page), `${label}: one action per activation, no duplicate handler`).toEqual(["toolbar:eliminar"]);

    // Space opens too; Tab closes without trapping focus and moves on from the trigger.
    await page.keyboard.press("Space");
    await expect(menu.getByRole("menuitem", { name: "Editar" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(harness.getByRole("checkbox", { name: "Seleccionar registro 1" })).toBeFocused();

    // Pointer: the trigger toggles; a click on an item acts once.
    await trigger.click();
    await expect(menu).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await trigger.click();
    await menu.getByRole("menuitem", { name: "Editar" }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await readLog(page)).toEqual(["toolbar:eliminar", "toolbar:editar"]);
    await expectNoOuterScroll(page, label);
  });

  test("SubMenu: opens and closes per level by keyboard and hover, and acts from the nested level @ 1366x768", async ({ page }) => {
    const label = "C08 SubMenu @ 1366x768";
    await mountHarness(page, 1366, 768);
    const harness = page.locator(HARNESS);
    const trigger = harness.getByRole("button", { name: "Acciones", exact: true });
    const root = page.locator(ROOT_MENU);
    const sub = page.locator(SUB_MENU);
    const parent = root.getByRole("menuitem", { name: "Mover a" });

    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("m");
    await expect(parent).toBeFocused();
    await expect(parent).toHaveAttribute("aria-haspopup", "menu");
    await expect(parent).toHaveAttribute("aria-expanded", "false");

    // ArrowRight opens the nested level on its first item; the parent item names and controls it.
    await page.keyboard.press("ArrowRight");
    await expect(sub).toBeVisible();
    await expect(sub).toHaveAttribute("role", "menu");
    await expect(page.getByRole("menu", { name: "Mover a", exact: true })).toHaveCount(1);
    await expect(parent).toHaveAttribute("aria-expanded", "true");
    expect(await parent.getAttribute("aria-controls")).toBe(await sub.getAttribute("id"));
    await expect(sub.getByRole("menuitem", { name: "Carpeta A" })).toBeFocused();
    const [rootBox, subBox, parentBox] = await Promise.all([readSurface(page, ROOT_MENU), readSurface(page, SUB_MENU), parent.boundingBox()]);
    // The toolbar trigger sits at the right edge, so the nested level flips to the left of its parent.
    expect(Math.min(Math.abs(subBox.left - rootBox.right), Math.abs(subBox.right - rootBox.left)), `${label}: the submenu opens flush beside its parent`).toBeLessThanOrEqual(1);
    expect(Math.abs(subBox.firstItemTop! - parentBox!.y), `${label}: first nested item level with its parent item`).toBeLessThanOrEqual(1);
    expect(subBox.inside && rootBox.inside, `${label}: both levels inside the viewport`).toBe(true);

    // Arrow keys stay in the nested level; ArrowLeft closes it only and returns to the parent item.
    await page.keyboard.press("ArrowDown");
    await expect(sub.getByRole("menuitem", { name: "Carpeta B" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(sub.getByRole("menuitem", { name: "Carpeta A" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(sub).toHaveCount(0);
    await expect(root).toBeVisible();
    await expect(parent).toBeFocused();

    // Enter opens it as well; Escape closes one level per press.
    await page.keyboard.press("Enter");
    await expect(sub.getByRole("menuitem", { name: "Carpeta A" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sub).toHaveCount(0);
    await expect(root).toBeVisible();
    await expect(parent).toBeFocused();
    expect(await readLog(page), `${label}: opening a submenu is not an action`).toEqual([]);

    // A disabled submenu never opens.
    const disabled = root.getByRole("menuitem", { name: "Compartir" });
    await expect(disabled).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("ArrowDown");
    await expect(disabled).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await disabled.click({ force: true });
    await expect(sub).toHaveCount(0);

    // Acting from the nested level closes every level and returns focus to the trigger.
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await readLog(page)).toEqual(["toolbar:mover-b"]);

    // Hover opens the nested level; moving to a sibling closes it.
    await trigger.click();
    await parent.hover();
    await expect(sub).toBeVisible();
    await root.getByRole("menuitem", { name: "Eliminar" }).hover();
    await expect(sub).toHaveCount(0);
    await parent.hover();
    await sub.getByRole("menuitem", { name: "Carpeta A" }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    expect(await readLog(page)).toEqual(["toolbar:mover-b", "toolbar:mover-a"]);
    await expectNoOuterScroll(page, label);
  });

  test("OverflowMenu and ContextMenu on rows: pointer, keyboard, outside click, selection, navigation and axe @ 1366x768", async ({ page }) => {
    const label = "C08 rows @ 1366x768";
    await mountHarness(page, 1366, 768);
    const harness = page.locator(HARNESS);
    const root = page.locator(ROOT_MENU);
    const url = page.url();
    const historyLength = await page.evaluate(() => window.history.length);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));

    // The C06 owner holds a selection before any menu opens.
    const boxes = harness.getByRole("checkbox");
    await boxes.nth(0).check();
    const toolbar = harness.getByRole("group", { name: "Selección" });
    await expect(toolbar).toContainText("1 seleccionado");
    const selectionState = () => boxes.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).checked));

    // OverflowMenu: icon-only trigger with a name, menu lined up with the trigger's end edge.
    const overflow = harness.getByRole("button", { name: "Más acciones del registro 2", exact: true });
    await expect(overflow).toHaveAttribute("aria-haspopup", "menu");
    expect(await overflow.evaluate((button) => button.textContent), `${label}: icon-only trigger`).toBe("");
    await overflow.click();
    const overflowMenu = page.getByRole("menu", { name: "Más acciones del registro 2", exact: true });
    await expect(overflowMenu).toBeVisible();
    const [menuBox, triggerBox] = await Promise.all([readSurface(page, ROOT_MENU), overflow.boundingBox()]);
    expect(Math.abs(menuBox.right - (triggerBox!.x + triggerBox!.width)), `${label}: end-aligned`).toBeLessThanOrEqual(1);
    expect(Math.abs(menuBox.top - (triggerBox!.y + triggerBox!.height + 4)), `${label}: 4px below the trigger`).toBeLessThanOrEqual(1);
    expect([triggerBox!.width, triggerBox!.height], `${label}: 32px trigger from md`).toEqual([32, 32]);

    // axe with a root menu and a nested level open.
    await overflowMenu.getByRole("menuitem", { name: "Mover a" }).click();
    await expect(page.locator(SUB_MENU)).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .include(HARNESS)
      .include('[data-action-menu-surface]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`), `${label}: axe`).toEqual([]);

    // Outside click closes every level, acts on nothing and leaves the selection alone.
    await harness.locator('[data-c08-row-label="1"]').click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    expect(await readLog(page)).toEqual([]);
    expect(await selectionState()).toEqual([true, false, false]);

    // Opening another menu closes the first: one root at a time.
    await overflow.click();
    await harness.getByRole("button", { name: "Más acciones del registro 1", exact: true }).click();
    await expect(root).toHaveCount(1);
    await expect(page.getByRole("menu", { name: "Más acciones del registro 1", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(harness.getByRole("button", { name: "Más acciones del registro 1", exact: true })).toBeFocused();

    // A menu action is the host's callback only: the selection owner is not touched.
    await overflow.click();
    await overflowMenu.getByRole("menuitem", { name: "Editar" }).click();
    expect(await readLog(page)).toEqual(["overflow-2:editar"]);
    await expect(toolbar).toContainText("1 seleccionado");
    expect(await selectionState()).toEqual([true, false, false]);

    // ContextMenu by pointer: opens at the pointer, on the row that was clicked.
    const row = harness.locator('[data-c08-row="3"]');
    const rowBox = await row.boundingBox();
    await row.click({ button: "right", position: { x: 160, y: 20 } });
    const contextMenu = page.getByRole("menu", { name: "Acciones del registro 3", exact: true });
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.getByRole("menuitem")).toHaveText(["Editar", "Archivar", "Mover a", "Compartir", "Eliminar"]);
    const pointBox = await readSurface(page, ROOT_MENU);
    expect(Math.abs(pointBox.left - (rowBox!.x + 160)), `${label}: opens at the pointer (x)`).toBeLessThanOrEqual(1);
    expect(Math.abs(pointBox.top - (rowBox!.y + 20)), `${label}: opens at the pointer (y)`).toBeLessThanOrEqual(1);
    await expect(contextMenu.getByRole("menuitem", { name: "Editar" })).toBeFocused();
    // A right click on another row moves the menu instead of stacking a second one.
    await harness.locator('[data-c08-row="1"]').click({ button: "right", position: { x: 120, y: 20 } });
    await expect(root).toHaveCount(1);
    await expect(page.getByRole("menu", { name: "Acciones del registro 1", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);

    // The browser menu keeps copy and paste: over selected text or an editable field the
    // region neither opens its menu nor cancels the event; elsewhere it does both.
    await page.evaluate(() => {
      const seen: boolean[] = [];
      (window as unknown as { __c08Prevented: boolean[] }).__c08Prevented = seen;
      document.addEventListener("contextmenu", (event) => seen.push(event.defaultPrevented));
    });
    const prevented = () => page.evaluate(() => (window as unknown as { __c08Prevented: boolean[] }).__c08Prevented.splice(0));
    const rowLabel = harness.locator('[data-c08-row-label="2"]');
    await rowLabel.dispatchEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 200, clientY: 200 });
    await expect(page.getByRole("menu", { name: "Acciones del registro 2", exact: true })).toBeVisible();
    expect(await prevented(), `${label}: the region takes the context menu`).toEqual([true]);
    await page.keyboard.press("Escape");
    await rowLabel.evaluate((node) => window.getSelection()?.selectAllChildren(node));
    await rowLabel.dispatchEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 200, clientY: 200 });
    expect(await prevented(), `${label}: selected text keeps the browser menu`).toEqual([false]);
    await harness.locator('[data-c08-row="2"]').dispatchEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 200, clientY: 200 });
    expect(await prevented(), `${label}: the row holding the selection keeps the browser menu`).toEqual([false]);
    await expect(page.getByRole("menu")).toHaveCount(0);
    // A selection elsewhere is not this target's: another row still opens its menu, by pointer and by keyboard.
    await harness.locator('[data-c08-row-label="3"]').dispatchEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 200, clientY: 200 });
    await expect(page.getByRole("menu", { name: "Acciones del registro 3", exact: true })).toBeVisible();
    expect(await prevented(), `${label}: a selection in another row does not keep the browser menu`).toEqual([true]);
    await page.keyboard.press("Escape");
    await harness.locator('[data-c08-open="1"]').focus();
    await page.keyboard.press("Shift+F10");
    await expect(page.getByRole("menu", { name: "Acciones del registro 1", exact: true }), `${label}: Shift+F10 with a selection in another row`).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => window.getSelection()?.toString()), `${label}: the selection survives`).toBe("Registro 2");
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await boxes.nth(1).dispatchEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 200, clientY: 200 });
    expect(await prevented(), `${label}: an editable field keeps the browser menu`).toEqual([false]);
    await expect(page.getByRole("menu")).toHaveCount(0);

    // ContextMenu by keyboard: Shift+F10 and the ContextMenu key, with focus returned to the opener.
    const open2 = harness.locator('[data-c08-open="2"]');
    for (const key of ["Shift+F10", "ContextMenu"]) {
      await open2.focus();
      await page.keyboard.press(key);
      const keyboardMenu = page.getByRole("menu", { name: "Acciones del registro 2", exact: true });
      await expect(keyboardMenu, `${label}: ${key}`).toBeVisible();
      await expect(keyboardMenu.getByRole("menuitem", { name: "Editar" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await expect(open2, `${label}: ${key} returns focus`).toBeFocused();
    }
    await page.keyboard.press("Shift+F10");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await expect(open2).toBeFocused();
    expect(await readLog(page)).toEqual(["overflow-2:editar", "context-2:eliminar"]);

    // Nothing above navigated, pushed history or issued a request; the selection is intact.
    await expect(toolbar).toContainText("1 seleccionado");
    expect(await selectionState()).toEqual([true, false, false]);
    expect(page.url(), `${label}: no navigation`).toBe(url);
    expect(await page.evaluate(() => window.history.length), `${label}: no history entry`).toBe(historyLength);
    expect(requests, `${label}: menus are local state, no request`).toEqual([]);
    await expectNoOuterScroll(page, label);
  });

  for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 768], [768, 1024], [767, 1024], [430, 932], [390, 844], [360, 800], [320, 568]] as const) {
    test(`geometry and viewport clamping @ ${width}x${height}`, async ({ page }) => {
      const label = `C08 geometry @ ${width}x${height}`;
      const touch = width < 768;
      await mountHarness(page, width, height);
      const harness = page.locator(HARNESS);
      const idle = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      const expectSurface = (surface: Awaited<ReturnType<typeof readSurface>>, name: string) => {
        console.log(`[C08] ${label} · ${name}: ${JSON.stringify(surface)}`);
        expect(surface.inside, `${label}: ${name} inside the viewport with an 8px margin`).toBe(true);
        expect(surface.position, `${label}: ${name} is fixed, outside the layout`).toBe("fixed");
        expect(surface.itemHeights, `${label}: ${name} item height`).toEqual([touch ? 48 : 32]);
        expect(surface.width, `${label}: ${name} min width`).toBeGreaterThanOrEqual(200);
        expect(surface.width, `${label}: ${name} never wider than the viewport`).toBeLessThanOrEqual(width - 16);
        expect(surface.radius, `${label}: ${name} radius`).toBe("8px");
        expect(surface.paddingBlock, `${label}: ${name} padding`).toEqual(["8px", "8px"]);
        expect(surface.itemPaddingInline, `${label}: ${name} item padding`).toEqual(["12px", "12px"]);
        expect(surface.itemRadius, `${label}: ${name} item radius`).toBe("0px");
        expect(surface.elevated, `${label}: ${name} elevation`).toBe(true);
        expect(surface.scrollable, `${label}: ${name} has no inner scroll`).toBe(false);
        expect(surface.itemsInside, `${label}: ${name} items do not overflow the surface`).toBe(true);
      };
      const expectDocumentUnchanged = async (name: string) => {
        expect(await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
        })), `${label}: ${name} does not grow the document`).toEqual(idle);
        await expectNoOuterScroll(page, `${label} (${name})`);
      };

      // ActionMenu in the toolbar, with its nested level.
      const trigger = harness.getByRole("button", { name: "Acciones", exact: true });
      expect((await trigger.boundingBox())!.height, `${label}: toolbar trigger height`).toBe(touch ? 44 : 32);
      await trigger.click();
      expectSurface(await readSurface(page, ROOT_MENU), "ActionMenu");
      await page.locator(ROOT_MENU).getByRole("menuitem", { name: "Mover a" }).click();
      await expect(page.locator(SUB_MENU)).toBeVisible();
      expectSurface(await readSurface(page, SUB_MENU), "SubMenu");
      await expectDocumentUnchanged("ActionMenu + SubMenu");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);

      // OverflowMenu on the last row.
      const overflow = harness.getByRole("button", { name: "Más acciones del registro 3", exact: true });
      const overflowBox = await overflow.boundingBox();
      expect([overflowBox!.width, overflowBox!.height], `${label}: overflow trigger`).toEqual(touch ? [44, 44] : [32, 32]);
      await overflow.click();
      expectSurface(await readSurface(page, ROOT_MENU), "OverflowMenu");
      await expectDocumentUnchanged("OverflowMenu");
      await page.keyboard.press("Escape");

      // ActionMenu pinned to the bottom edge: it flips above its trigger.
      const bottom = harness.getByRole("button", { name: "Abajo", exact: true });
      await bottom.click();
      const flipped = await readSurface(page, ROOT_MENU);
      expectSurface(flipped, "flipped ActionMenu");
      expect(flipped.bottom, `${label}: the menu opens above a trigger with no room below`).toBeLessThanOrEqual((await bottom.boundingBox())!.y + 0.5);
      await page.locator(ROOT_MENU).getByRole("menuitem", { name: "Mover a" }).click();
      expectSurface(await readSurface(page, SUB_MENU), "flipped SubMenu");
      await expectDocumentUnchanged("flipped ActionMenu + SubMenu");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      // ContextMenu at the far end of a row: it flips back inside the viewport.
      const row = harness.locator('[data-c08-row="2"]');
      const rowBox = await row.boundingBox();
      await row.click({ button: "right", position: { x: rowBox!.width - 2, y: 24 } });
      expectSurface(await readSurface(page, ROOT_MENU), "ContextMenu");
      await expectDocumentUnchanged("ContextMenu");

      // A viewport change closes the menu instead of leaving it misplaced.
      await page.setViewportSize({ width: width - 8, height });
      await expect(page.getByRole("menu")).toHaveCount(0);
      expect(await readLog(page), `${label}: placement never runs an action`).toEqual([]);
    });
  }
});

let c09Harness: string;

// C09 harness: BulkActionMenu in the actions slot of the C07 toolbar, on the C06
// owner, inside the real B15 scaffold and the app CSS. No production collection
// has a bulk action contract yet (Auditoría is read-only; adoption is C17+), so
// the host below is a controlled stand-in: it records what it is handed and
// settles on request. It reaches no backend and proves no product operation.
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceScaffold } from "./src/components/dashboard/ModuleSurface.tsx";
import { BulkActionMenu, SelectionToolbar, useCollectionSelection } from "./src/features/dashboard/presentation/surfaces/index.ts";
const main = document.querySelector("main.dashboard-main");
const mount = document.createElement("div");
mount.setAttribute("data-c09-harness", "true");
mount.style.cssText = "position:absolute;inset:0;display:flex;min-height:0;min-width:0;background:white;z-index:2";
main.style.position = "relative";
main.append(mount);
const log = (window.__c09 = []);
const PAGES = [[1, 2, 3], [4, 5, 6]];
const HOST_HEIGHT = window.innerWidth >= 768 ? 36 : 53;
function Harness() {
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const selection = useCollectionSelection({ visibleIds: PAGES[page] });
  const record = (action) => (ids) => { log.push({ action, ids }); };
  const actions = [
    { id: "exportar", label: "Exportar", onSelect: record("exportar") },
    { id: "abrir", label: "Abrir detalle", requires: "single", onSelect: record("abrir") },
    { id: "reintentar", label: "Reintentar", onSelect: (ids) => {
      log.push({ action: "reintentar", ids });
      const failed = ids.filter((id) => id % 2 === 0);
      ids.filter((id) => id % 2 !== 0).forEach((id) => selection.deselect(id));
      setStatus((ids.length - failed.length) + " completados, " + failed.length + " con error");
    } },
    { id: "procesar", label: "Procesar", onSelect: (ids) => {
      log.push({ action: "procesar", ids });
      setPending(true);
      window.__c09Settle = () => { setPending(false); selection.clearSelection(); setStatus(ids.length + " procesados"); };
    } },
    { id: "asignar", label: "Asignar", disabledReason: "Sin permiso", onSelect: record("asignar") },
    { id: "eliminar", label: "Eliminar", destructive: true, confirmsBeforeRunning: false, onSelect: record("eliminar") },
  ];
  return (
    <section aria-label="Colección C09" style={{ display: "flex", flex: 1, minWidth: 0, minHeight: 0 }}>
      <WorkspaceScaffold kind="surface" ariaLabel="Arnés C09"
        toolbar={<div data-c09-host="true" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minWidth: 0, height: HOST_HEIGHT, boxSizing: "border-box" }}>
          <input type="checkbox" data-collection-selection="page" aria-label="Seleccionar página" checked={selection.allVisibleSelected} onChange={selection.toggleVisiblePage} />
          <SelectionToolbar selectedCount={selection.selectedCount} onClearSelection={selection.clearSelection}
            actions={<BulkActionMenu selectedIds={selection.selectedIds} actions={actions} pending={pending} />}>
            <span data-c09-default-toolbar="true">Registros</span>
          </SelectionToolbar>
        </div>}
        collection={<div data-c09-collection="true">
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {PAGES[page].map((row) => (
              <li key={row} data-c09-row={row} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "0 12px" }}>
                <input type="checkbox" aria-label={"Seleccionar registro " + row} checked={selection.isSelected(row)} onChange={() => selection.toggle(row)} />
                <span data-c09-row-label={row} style={{ flex: 1, minWidth: 0 }}>Registro {row}</span>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 8, padding: "0 12px" }}>
            <button type="button" onClick={() => setPage(0)}>Página 1</button>
            <button type="button" onClick={() => setPage(1)}>Página 2</button>
          </div>
          <p role="status" data-c09-status="true" style={{ margin: 0, padding: "0 12px" }}>{status}</p>
        </div>}
      />
    </section>
  );
}
createRoot(mount).render(<Harness />);`,
      resolveDir: resolve(process.cwd()),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    alias: { "@": resolve(process.cwd(), "src") },
  });
  c09Harness = result.outputFiles[0].text;
});

// C09 · BulkActionMenu sits in the SelectionToolbar's own group and opens the C08
// menu: it exists only with a selection, hands the host every selected ID once
// (across pages), keeps unavailable, unconfirmed destructive and in-flight
// actions disabled with their reason, and never clears the C06 owner itself.
test.describe("C09 · BulkActionMenu on the SelectionToolbar", () => {
  const auditSurface = DASHBOARD_GEOMETRY_SURFACES.find((surface) => surface.id === "admin-auditoria");
  if (!auditSurface) throw new Error("C09: missing canonical admin-auditoria surface");
  const HARNESS = '[data-c09-harness="true"]';
  const ROOT_MENU = '[data-action-menu-surface="root"]';
  const ACTIONS = ["Exportar", "Abrir detalle", "Reintentar", "Procesar", "Asignar", "Eliminar"] as const;
  type BulkCall = { action: string; ids: number[] };

  async function mountHarness(page: Page, width: number, height: number) {
    await page.setViewportSize({ width, height });
    await prepareSurface(page, auditSurface!);
    await openSurface(page, auditSurface!);
    await page.addScriptTag({ content: c09Harness });
    await expect(page.locator(`${HARNESS} [data-c09-row]`)).toHaveCount(3);
    await waitForLayoutSettled(page);
  }

  const readLog = (page: Page) => page.evaluate(() => [...((window as unknown as { __c09: BulkCall[] }).__c09)]);

  function controls(page: Page) {
    const harness = page.locator(HARNESS);
    const menu = page.getByRole("menu", { name: "Acciones", exact: true });
    return {
      harness,
      menu,
      group: harness.getByRole("group", { name: "Selección" }),
      trigger: harness.getByRole("button", { name: "Acciones", exact: true }),
      clear: harness.getByRole("button", { name: "Limpiar selección", exact: true }),
      defaultToolbar: harness.locator('[data-c09-default-toolbar="true"]'),
      pageSelector: harness.getByRole("checkbox", { name: "Seleccionar página", exact: true }),
      row: (id: number) => harness.getByRole("checkbox", { name: `Seleccionar registro ${id}`, exact: true }),
      goToPage: (number: 1 | 2) => harness.getByRole("button", { name: `Página ${number}`, exact: true }).click(),
      item: (name: string) => menu.getByRole("menuitem", { name, exact: true }),
    };
  }

  test("selection scope, exact IDs once, disabled reasons, cancellation, partial result, in-flight lock, keyboard, focus and axe @ 1366x768", async ({ page }) => {
    const label = "C09 @ 1366x768";
    await mountHarness(page, 1366, 768);
    const { harness, menu, group, trigger, clear, defaultToolbar, pageSelector, row, goToPage, item } = controls(page);
    const url = page.url();
    const historyLength = await page.evaluate(() => window.history.length);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));

    // No selection: the DefaultToolbar, no selection group and no bulk menu.
    await expect(defaultToolbar).toBeVisible();
    await expect(group).toHaveCount(0);
    await expect(trigger).toHaveCount(0);

    // One selected: the menu joins the toolbar's own group, after the clear control.
    await row(2).check();
    await expect(group).toContainText("1 seleccionado");
    await expect(defaultToolbar).toHaveCount(0);
    expect(await group.getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label"))),
      `${label}: one group, clear then actions`).toEqual(["Limpiar selección", "Acciones"]);
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Keyboard only: Tab from the clear control reaches the trigger, Enter opens on the first action.
    await clear.focus();
    await page.keyboard.press("Tab");
    await expect(trigger).toBeFocused();
    expect(await trigger.evaluate((button) => button.matches(":focus-visible")), `${label}: visible focus on the trigger`).toBe(true);
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Exportar", "Abrir detalle", "Reintentar", "Procesar", "Asignar · Sin permiso", "Eliminar · Requiere confirmación",
    ]);
    await expect(item("Exportar")).toBeFocused();

    // A destructive action with no confirmation contract and a host-refused action are announced, focusable and inert.
    await page.keyboard.press("End");
    const destructive = item("Eliminar · Requiere confirmación");
    await expect(destructive).toBeFocused();
    await expect(destructive).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await destructive.click({ force: true });
    await page.keyboard.press("ArrowUp");
    const refused = item("Asignar · Sin permiso");
    await expect(refused).toBeFocused();
    await expect(refused).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    expect(await readLog(page), `${label}: disabled actions never reach the host`).toEqual([]);
    await page.keyboard.press("Home");
    await expect(item("Exportar")).toBeFocused();

    const axe = await new AxeBuilder({ page })
      .include(HARNESS)
      .include("[data-action-menu-surface]")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`), `${label}: axe`).toEqual([]);

    // Cancelling runs nothing and keeps the selection: Escape, an outside click and Tab.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(menu).toBeVisible();
    await harness.locator('[data-c09-row-label="1"]').click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("menu")).toHaveCount(0);
    expect(await readLog(page), `${label}: a cancelled menu runs no action`).toEqual([]);
    await expect(group).toContainText("1 seleccionado");

    // Single selection: the single-item action runs once with that ID; focus returns to the trigger.
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await expect(item("Abrir detalle")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await readLog(page)).toEqual([{ action: "abrir", ids: [2] }]);

    // Multiple selection across pages: the count and the IDs cover both pages, not the visible one.
    await row(1).check();
    await goToPage(2);
    await expect(row(5)).toBeVisible();
    await expect(group).toContainText("2 seleccionados");
    await row(5).check();
    await expect(group).toContainText("3 seleccionados");
    await trigger.click();
    const singleOnly = item("Abrir detalle · Sólo un elemento");
    await expect(singleOnly).toHaveAttribute("aria-disabled", "true");
    await singleOnly.click({ force: true });
    await expect(menu).toBeVisible();
    await item("Exportar").click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await readLog(page), `${label}: every selected ID, in selection order, exactly once`).toEqual([
      { action: "abrir", ids: [2] },
      { action: "exportar", ids: [2, 1, 5] },
    ]);
    await expect(group, `${label}: running an action does not clear the selection`).toContainText("3 seleccionados");

    // Partial result: the host owns it. It keeps the failed ID selected and reports; the menu stays for a retry.
    await trigger.click();
    await item("Reintentar").click();
    await expect(group).toContainText("1 seleccionado");
    await expect(harness.locator('[data-c09-status="true"]')).toHaveText("2 completados, 1 con error");
    await expect(trigger).toBeFocused();
    await goToPage(1);
    await expect(row(2)).toBeChecked();
    await expect(row(1)).not.toBeChecked();

    // In flight: every action is disabled with its reason, the trigger keeps focus, nothing runs twice.
    await row(3).check();
    await trigger.click();
    await item("Procesar").click();
    await expect(trigger).toBeFocused();
    await expect(trigger).toBeEnabled();
    await page.keyboard.press("Enter");
    await expect(menu.getByRole("menuitem")).toHaveText(ACTIONS.map((name) => `${name} · Acción en curso`));
    expect(await menu.getByRole("menuitem").evaluateAll((items) => items.map((entry) => entry.getAttribute("aria-disabled"))))
      .toEqual(ACTIONS.map(() => "true"));
    await page.keyboard.press("Enter");
    await item("Procesar · Acción en curso").click({ force: true });
    await page.keyboard.press("Escape");
    expect(await readLog(page), `${label}: one run per activation, none while in flight`).toEqual([
      { action: "abrir", ids: [2] },
      { action: "exportar", ids: [2, 1, 5] },
      { action: "reintentar", ids: [2, 1, 5] },
      { action: "procesar", ids: [2, 3] },
    ]);

    // The host settles and clears: the toolbar swaps back and the bulk menu leaves with it.
    await page.evaluate(() => (window as unknown as { __c09Settle: () => void }).__c09Settle());
    await expect(group).toHaveCount(0);
    await expect(trigger).toHaveCount(0);
    await expect(defaultToolbar).toBeVisible();
    await expect(harness.locator('[data-c09-status="true"]')).toHaveText("2 procesados");
    await expect(row(2)).not.toBeChecked();

    // C07 clear with the menu in the group: whole owner cleared, focus on the page selector.
    await row(1).check();
    await goToPage(2);
    await row(4).check();
    await expect(group).toContainText("2 seleccionados");
    await clear.focus();
    await page.keyboard.press("Enter");
    await expect(pageSelector).toBeFocused();
    await expect(defaultToolbar).toBeVisible();
    await expect(trigger).toHaveCount(0);
    await goToPage(1);
    await expect(row(1)).not.toBeChecked();

    expect(page.url(), `${label}: no navigation`).toBe(url);
    expect(await page.evaluate(() => window.history.length), `${label}: no history entry`).toBe(historyLength);
    expect(requests, `${label}: the bulk menu issues no request`).toEqual([]);
    await expectNoOuterScroll(page, label);
  });

  for (const [width, height] of [[1920, 1080], [1366, 768], [1280, 720], [834, 1194], [768, 1024], [390, 844], [320, 568]] as const) {
    test(`the menu fits the frozen toolbar host and the viewport @ ${width}x${height}`, async ({ page }) => {
      const label = `C09 geometry @ ${width}x${height}`;
      const touch = width < 768;
      await mountHarness(page, width, height);
      const { group, trigger, pageSelector } = controls(page);
      const host = page.locator(`${HARNESS} [data-c09-host="true"]`);
      const idle = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      const idleHost = await host.boundingBox();
      expect(idleHost!.height, `${label}: host height of the adopted hosts (table header row 36px, mobile strip 53px)`).toBe(touch ? 53 : 36);

      await pageSelector.check();
      await expect(group).toContainText("3 seleccionados");
      const layout = await group.evaluate((node) => {
        const hostBox = node.closest('[data-c09-host="true"]')!.getBoundingClientRect();
        const count = node.querySelector<HTMLElement>('[data-selection-count="true"]')!;
        const buttons = [...node.querySelectorAll<HTMLElement>("button")];
        const boxes = [count, ...buttons].map((element) => element.getBoundingClientRect());
        return {
          hostHeight: hostBox.height,
          hostWidth: hostBox.width,
          inside: boxes.every((box) => box.left >= hostBox.left - 0.5 && box.right <= hostBox.right + 0.5 && box.top >= hostBox.top - 0.5 && box.bottom <= hostBox.bottom + 0.5),
          overlap: boxes.some((box, index) => boxes.slice(index + 1).some((other) => box.left < other.right - 0.5 && other.left < box.right - 0.5)),
          countTruncated: count.scrollWidth > count.clientWidth,
          buttons: buttons.map((button) => [button.getAttribute("aria-label"), Math.round(button.getBoundingClientRect().width * 100) / 100, button.getBoundingClientRect().height]),
        };
      });
      console.log(`[C09] ${label}: ${JSON.stringify(layout)}`);
      expect([layout.hostHeight, layout.hostWidth], `${label}: the swap with the bulk menu keeps the host box`).toEqual([idleHost!.height, idleHost!.width]);
      expect(layout.inside, `${label}: count, clear and actions stay inside the host`).toBe(true);
      expect(layout.overlap, `${label}: no control overlaps another`).toBe(false);
      expect(layout.countTruncated, `${label}: the count is not truncated`).toBe(false);
      const triggerBox = (await trigger.boundingBox())!;
      if (touch) expect([triggerBox.width, triggerBox.height], `${label}: 44px touch target`).toEqual([44, 44]);
      else expect(triggerBox.height, `${label}: 32px toolbar action`).toBe(32);

      // Keyboard and pointer both open it; the surface is the C08 one, clamped to the viewport.
      await trigger.focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.locator(ROOT_MENU)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await trigger.click();
      const surface = await page.locator(ROOT_MENU).evaluate((menu) => {
        const rect = menu.getBoundingClientRect();
        const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
        const items = [...menu.querySelectorAll<HTMLElement>(':scope > [role="menuitem"]')];
        return {
          inside: rect.left >= 8 - 0.5 && rect.top >= 8 - 0.5 && rect.right <= viewport.width - 8 + 0.5 && rect.bottom <= viewport.height - 8 + 0.5,
          width: rect.width,
          position: getComputedStyle(menu).position,
          scrollable: menu.scrollHeight > menu.clientHeight || menu.scrollWidth > menu.clientWidth,
          itemHeights: [...new Set(items.map((entry) => Math.round(entry.getBoundingClientRect().height * 100) / 100))],
          reasonsTruncated: items.some((entry) => {
            const text = entry.querySelector<HTMLElement>("span")!;
            return text.scrollWidth > text.clientWidth;
          }),
        };
      });
      console.log(`[C09] ${label} · menu: ${JSON.stringify(surface)}`);
      expect(surface.inside, `${label}: menu inside the viewport with an 8px margin`).toBe(true);
      expect(surface.position, `${label}: menu is fixed, outside the layout`).toBe("fixed");
      expect(surface.itemHeights, `${label}: item height (audit §46)`).toEqual([touch ? 48 : 32]);
      expect(surface.width, `${label}: menu min width`).toBeGreaterThanOrEqual(200);
      expect(surface.width, `${label}: menu never wider than the viewport`).toBeLessThanOrEqual(width - 16);
      expect(surface.scrollable, `${label}: no inner scroll`).toBe(false);
      expect(surface.reasonsTruncated, `${label}: disabled reasons are fully visible`).toBe(false);
      expect(await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      })), `${label}: the open menu does not grow the document`).toEqual(idle);
      await expectNoOuterScroll(page, label);
      expect(await readLog(page), `${label}: opening never runs an action`).toEqual([]);
    });
  }
});
