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
const TARGET_HEIGHT_PX = 40;
const TOLERANCE_PX = 2;

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
  const desktopCard = '#audit-log > section[aria-labelledby="admin-audit-register-title"]';

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

        const isMobile = viewport.width < 768;
        if (isMobile) {
          await expect(
            allHeaders,
            `${label}: mobile app bar owns the contextual header`,
          ).toBeHidden();
        } else {
          const header = allHeaders;
          await expect(header, `${label}: painted canonical header`).toBeVisible();

          const geometry = await header.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const title = element.querySelector<HTMLElement>("h2");
            const titleStyle = title ? getComputedStyle(title) : null;
            return {
              height: rect.height,
              width: rect.width,
              parentWidth: element.parentElement?.getBoundingClientRect().width ?? -1,
              paddingLeft: Number.parseFloat(style.paddingLeft),
              paddingRight: Number.parseFloat(style.paddingRight),
              borderRadius: style.borderRadius,
              boxShadow: style.boxShadow,
              titleFontSize: titleStyle?.fontSize ?? "absent",
              titleLineHeight: titleStyle?.lineHeight ?? "absent",
              titleWeight: titleStyle?.fontWeight ?? "absent",
            };
          });

          expect(geometry.height, `${label}: A02 target height`).toBeGreaterThanOrEqual(
            TARGET_HEIGHT_PX - TOLERANCE_PX,
          );
          expect(geometry.height, `${label}: A02 target height`).toBeLessThanOrEqual(
            TARGET_HEIGHT_PX + TOLERANCE_PX,
          );
          expect(Math.abs(geometry.width - geometry.parentWidth), `${label}: full width`).toBeLessThanOrEqual(0.5);
          expect(geometry.paddingLeft).toBe(16);
          expect(geometry.paddingRight).toBe(16);
          expect(geometry.borderRadius).toBe("0px");
          expect(geometry.boxShadow).toBe("none");
          expect(geometry.titleFontSize).toBe("14px");
          expect(geometry.titleLineHeight).toBe("20px");
          expect(geometry.titleWeight).toBe("600");

          const heading = header.locator("h2");
          const description = header.locator(DESCRIPTION_SELECTOR);
          await expect(heading).toHaveCount(1);
          await expect(description).toHaveCount(1);
          const accessibility = await workspace.evaluate((element) => {
            const description = element.querySelector<HTMLElement>(
              '[data-workspace-header-description="true"]',
            );
            const rect = description?.getBoundingClientRect();
            return {
              labelledBy: element.getAttribute("aria-labelledby"),
              describedBy: element.getAttribute("aria-describedby"),
              headingId: element.querySelector("h2")?.id ?? null,
              descriptionId: description?.id ?? null,
              descriptionPosition: description ? getComputedStyle(description).position : null,
              descriptionWidth: rect?.width ?? -1,
              descriptionHeight: rect?.height ?? -1,
              descriptionText: description?.textContent?.trim() ?? "",
            };
          });

          expect(accessibility.labelledBy).toBe(accessibility.headingId);
          expect(accessibility.describedBy).toBe(accessibility.descriptionId);
          expect(accessibility.descriptionPosition).toBe("absolute");
          expect(accessibility.descriptionWidth).toBeLessThanOrEqual(1);
          expect(accessibility.descriptionHeight).toBeLessThanOrEqual(1);
          expect(accessibility.descriptionText.length).toBeGreaterThan(0);
        }

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
  test("compact variant (CompactPager) on Precios @ 1366x768", async ({ page }) => {
    const label = "C02 admin-precios @ 1366x768";
    const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === "admin-precios");
    if (!surface) throw new Error("C02: missing canonical admin-precios surface");
    await page.setViewportSize({ width: 1366, height: 768 });
    await prepareSurface(page, surface);
    await openSurface(page, surface);

    const pagerSelector = '[data-collection-pager="compact"]';
    const pager = page.locator(pagerSelector).filter({ visible: true });
    await expect(pager).toHaveCount(1);
    await expect(pager).toHaveAttribute("data-dashboard-compact-pager", "true");
    await expect(pager).toHaveAttribute("data-dashboard-pager", "compact");
    await expect(pager).toHaveAttribute("data-dashboard-adaptive-reserved-region", "pager");

    const rowSelector = "form[data-admin-pricing-item-form]";
    const before = await readC02Pager(page, pagerSelector, rowSelector);
    console.log(`[C02] ${label}: ${JSON.stringify(before)}`);
    expectExactReservation(before, label);
    expect(before.controlHeights, `${label}: icon controls keep h-8`).toEqual([32, 32]);

    const live = pager.locator('[aria-live="polite"][aria-atomic="true"]');
    const state = pager.locator('[data-dashboard-pager-state="true"]');
    const first = parseRange(await live.textContent(), label);
    expect(await live.textContent()).toMatch(/ estudios$/);
    expect(first.start).toBe(1);
    expect(first.size, `${label}: rendered forms equal the announced range`).toBe(before.rows);
    const pageCount = Math.ceil(first.total / first.size);
    expect(pageCount, `${label}: the fixture paginates`).toBeGreaterThan(1);
    await expect(state).toHaveText(`Pág. 1 / ${pageCount}`);
    const prev = pager.getByRole("button", { name: "Página anterior" });
    const next = pager.getByRole("button", { name: "Página siguiente" });
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();

    const requests = trackApiRequests(page);
    await next.click();
    await expect(state).toHaveText(`Pág. 2 / ${pageCount}`);
    const second = parseRange(await live.textContent(), `${label} page 2`);
    expect(second.start, `${label}: page 2 starts after page 1`).toBe(first.end + 1);
    expect(second.total).toBe(first.total);
    if (pageCount > 2) expect(second.size, `${label}: page size invariant across pages`).toBe(first.size);
    await expect(prev).toBeEnabled();

    await prev.focus();
    await page.keyboard.press("Enter");
    await expect(state).toHaveText(`Pág. 1 / ${pageCount}`);
    await expect(live).toHaveText(`1–${first.end} de ${first.total} estudios`);
    expect(requests, `${label}: client pagination issues no request`).toEqual([]);
    expectExactReservation(await readC02Pager(page, pagerSelector, rowSelector), `${label} after paging`);
    await expectNoOuterScroll(page, label);
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
      await expect(state).toHaveText(`Pág. 1 / ${pageCount}`);
      const prev = pager.getByRole("button", { name: "Página anterior" });
      const next = pager.getByRole("button", { name: "Página siguiente" });
      await expect(prev).toBeDisabled();
      await expect(next).toBeEnabled();

      const requests = trackApiRequests(page);
      await next.focus();
      await page.keyboard.press("Enter");
      await expect(state).toHaveText(`Pág. 2 / ${pageCount}`);
      await expect(live).toHaveText(`${first.end + 1}–${first.end + first.size} de 256`);
      await prev.click();
      await expect(state).toHaveText(`Pág. 1 / ${pageCount}`);
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
  const desktopCard = '#audit-log > section[aria-labelledby="admin-audit-register-title"]';
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

  for (const slug of ["w1920x1080", "w1280x720", "w1024x768", "w834x1194", "w768x1024", "w390x844"] as const) {
    const viewport = DASHBOARD_GEOMETRY_VIEWPORTS.find((candidate) => candidate.slug === slug);
    if (!viewport) throw new Error(`C06: missing canonical viewport ${slug}`);

    test(`selector column fits the frozen geometry @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const label = `C06 admin-auditoria @ ${viewport.width}x${viewport.height}`;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareSurface(page, auditSurface);
      await openSurface(page, auditSurface);
      if (viewport.width < 768) {
        await expect(page.locator('[data-admin-mobile-ops-module="audit"] [data-content-list-item="true"]').first()).toBeVisible();
        await expect(page.locator("[data-collection-selection]").filter({ visible: true })).toHaveCount(0);
        await expectNoOuterScroll(page, label);
        return;
      }
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
