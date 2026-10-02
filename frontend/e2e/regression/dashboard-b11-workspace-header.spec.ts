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
