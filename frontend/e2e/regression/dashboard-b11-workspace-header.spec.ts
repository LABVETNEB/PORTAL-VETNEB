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
import { addAppCookies } from "../helpers/session";

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
