import AxeBuilder from "@axe-core/playwright";
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
} from "../helpers/dashboard-geometry-matrix";
import { addAppCookies } from "../helpers/session";
import { DARK_GRAY_THEME_MODE, NORMAL_THEME_MODE, THEME_STORAGE_KEY, type ThemeMode } from "../../src/lib/theme";

// V7 · menus and tooltip, hard contracts (the V7 probe is evidence and never fails on a
// visual difference). Computed CSS of the menu surface in both themes, forced-colors,
// axe, keyboard and pointer behaviour of the menu and of the rail tooltip.

const DRIVE_MENU_SHADOW =
  "rgba(0, 0, 0, 0.2) 0px 2px 4px -1px, rgba(0, 0, 0, 0.14) 0px 4px 5px 0px, rgba(0, 0, 0, 0.12) 0px 1px 10px 0px";
const MENU = '[role="menu"][data-action-menu-surface="root"]';
const TOOLTIP = '[role="tooltip"][data-dashboard-tooltip="true"]';
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function load(page: Page, surfaceId: string, width: number, height: number, theme: ThemeMode) {
  const surface = DASHBOARD_GEOMETRY_SURFACES.find((candidate) => candidate.id === surfaceId);
  if (!surface) throw new Error(`V7: unknown surface ${surfaceId}`);
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [THEME_STORAGE_KEY, theme] as const);
  await page.emulateMedia({ colorScheme: theme === NORMAL_THEME_MODE ? "light" : "dark", reducedMotion: "reduce" });
  await addAppCookies(page, [DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role]]);
  await installSurfaceMocks(page, surface);
  const flight = trackDataRequests(page);
  await page.setViewportSize({ width, height });
  await page.goto(surface.route);
  await expect(page.locator(surface.readinessSelector).first()).toBeVisible({ timeout: 25_000 });
  await assertSurfaceLoaded(page, surface, `${surfaceId} V7`);
  await settleRenderAndData(page, flight, `${surfaceId} V7`, surfaceMeasurementRoots(surface));
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function openMenu(page: Page) {
  const trigger = page.locator('[data-action-menu-trigger="true"]').filter({ visible: true }).first();
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(MENU)).toBeVisible();
  return trigger;
}

const surfaceStyle = (page: Page) =>
  page.locator(MENU).evaluate((menu) => {
    const style = getComputedStyle(menu);
    const item = menu.querySelector('[role="menuitem"]')!;
    return {
      background: style.backgroundColor,
      radius: style.borderTopLeftRadius,
      shadow: style.boxShadow,
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      minWidth: style.minWidth,
      itemHeight: item.getBoundingClientRect().height,
      parentIsPortalRoot: menu.parentElement?.matches('[data-dashboard-portal-root="true"]') ?? false,
    };
  });

test.describe("V7 · ActionMenu surface", () => {
  test("light theme: Drive white, radius 4, exact three-layer shadow, 32 px items, min width 200 @ 1366x768", async ({ page }) => {
    await load(page, "admin-informes", 1366, 768, NORMAL_THEME_MODE);
    await openMenu(page);
    const style = await surfaceStyle(page);
    expect(style.background).toBe("rgb(255, 255, 255)");
    expect(style.radius).toBe("4px");
    expect(style.shadow).toBe(DRIVE_MENU_SHADOW);
    expect(style.itemHeight).toBe(32);
    expect(style.minWidth).toBe("200px");
    expect(style.parentIsPortalRoot, "the surface is portalled into the dashboard portal root").toBe(true);
  });

  test("dark theme keeps its popover palette and elevation until F0-D6 @ 1366x768", async ({ page }) => {
    await load(page, "admin-informes", 1366, 768, DARK_GRAY_THEME_MODE);
    await openMenu(page);
    const style = await surfaceStyle(page);
    expect(style.background).not.toBe("rgb(255, 255, 255)");
    expect(style.shadow).not.toBe(DRIVE_MENU_SHADOW);
    expect(style.radius, "geometry is theme independent").toBe("4px");
  });

  test("forced-colors: the surface keeps a visible outline where the shadow is dropped @ 1366x768", async ({ page }) => {
    await load(page, "admin-informes", 1366, 768, NORMAL_THEME_MODE);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce", forcedColors: "active" });
    await openMenu(page);
    const style = await surfaceStyle(page);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineColor, "a transparent outline resolves to a system colour").not.toBe("rgba(0, 0, 0, 0)");
  });

  test("keyboard, focus return, outside press and axe on the open menu @ 1920x945", async ({ page }) => {
    await load(page, "admin-informes", 1920, 945, NORMAL_THEME_MODE);
    const trigger = await openMenu(page);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("menuitem");
    const axe = await new AxeBuilder({ page }).include(MENU).withTags(AXE_TAGS).analyze();
    expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.locator(MENU)).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(page.locator(MENU)).toBeVisible();
    await page.mouse.click(2, 943);
    await expect(page.locator(MENU)).toHaveCount(0);
  });

  test("Tab closes the menu without trapping focus: it leaves the menu and moves on from the trigger @ 1366x768", async ({ page }) => {
    await load(page, "admin-informes", 1366, 768, NORMAL_THEME_MODE);
    const trigger = await openMenu(page);
    await page.keyboard.press("Tab");
    await expect(page.locator(MENU)).toHaveCount(0);
    await expect(trigger, "the browser moved on from the opener").not.toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  });
});

test.describe("V7 · rail tooltip", () => {
  test("keyboard focus shows it, aria-describedby links it, Escape closes it, no native title @ 1024x768", async ({ page }) => {
    await load(page, "admin-auditoria", 1024, 768, NORMAL_THEME_MODE);
    const item = page.locator('.dashboard-navigation-rail [data-dashboard-navigation-item]:not([aria-current="page"])').first();
    await expect(item).not.toHaveAttribute("title", /./);
    await page.keyboard.press("Shift");
    await item.focus();
    const tip = page.locator(TOOLTIP);
    await expect(tip).toBeVisible();
    const name = await item.getAttribute("aria-label");
    await expect(tip).toHaveText(name!);
    await expect(item).toHaveAttribute("aria-describedby", (await tip.getAttribute("id"))!);
    const axe = await new AxeBuilder({ page }).include(TOOLTIP).withTags(AXE_TAGS).analyze();
    expect(axe.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(tip).toHaveCount(0);
    await expect(item).toBeFocused();
    await expect(item).not.toHaveAttribute("aria-describedby", /./);
  });

  test("hover shows it after the delay, it stays while the pointer is over it, and leaving hides it @ 1024x768", async ({ page }) => {
    await load(page, "admin-auditoria", 1024, 768, NORMAL_THEME_MODE);
    const item = page.locator('.dashboard-navigation-rail [data-dashboard-navigation-item]:not([aria-current="page"])').first();
    const tip = page.locator(TOOLTIP);
    // Fake timers make the 300 ms open delay and the 120 ms leave grace observable without sleeping.
    await page.clock.install();
    await item.hover();
    await expect(tip, "nothing opens before the hover delay").toHaveCount(0);
    await page.clock.runFor(400);
    await expect(tip).toBeVisible();
    const box = (await tip.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.clock.runFor(500);
    await expect(tip, "WCAG 1.4.13: hoverable").toBeVisible();
    await page.mouse.move(1000, 760);
    await page.clock.runFor(500);
    await expect(tip).toHaveCount(0);
  });

  test("it stays inside the viewport and below 768 px no rail exists, so no tooltip @ 1024x768 and 600x900", async ({ page }) => {
    await load(page, "clinic-informes", 1024, 768, NORMAL_THEME_MODE);
    const items = page.locator(".dashboard-navigation-rail [data-dashboard-navigation-item]");
    await page.keyboard.press("Shift");
    await items.last().focus();
    const inside = await page.locator(TOOLTIP).evaluate((element) => {
      const r = element.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= document.documentElement.clientWidth && r.bottom <= document.documentElement.clientHeight;
    });
    expect(inside, "the tooltip of the last rail item stays inside the viewport").toBe(true);
    await page.setViewportSize({ width: 600, height: 900 });
    await expect(page.locator(TOOLTIP)).toHaveCount(0);
  });

  test("forced-colors: the tooltip keeps a visible outline @ 1024x768", async ({ page }) => {
    await load(page, "admin-auditoria", 1024, 768, NORMAL_THEME_MODE);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce", forcedColors: "active" });
    await page.keyboard.press("Shift");
    await page.locator(".dashboard-navigation-rail [data-dashboard-navigation-item]:not([aria-current=\"page\"])").first().focus();
    const outline = await page.locator(TOOLTIP).evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, color: style.outlineColor };
    });
    expect(outline.style).toBe("solid");
    expect(outline.color).not.toBe("rgba(0, 0, 0, 0)");
  });
});
