import { expect, test, type Locator, type Page } from "@playwright/test";
import { DASHBOARD_GEOMETRY_VIEWPORTS, waitForLayoutSettled } from "../helpers/dashboard-geometry-matrix";
import { setSession, type SessionRole } from "../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../helpers/zero-scroll-contract";

// C23a · responsive integral of the dashboard shell over the 13 canonical A02
// viewports: one navigation owner per band, role-bounded destinations, the
// global search only where it is painted, and the two phone overlays of the
// shell (destination overflow, action kebab) with exclusive opening, light
// dismiss, breakpoint closure and focus return. Geometry and pagination stay
// owned by A02/A03/A08; this spec reads no baseline.

const DRAWER = "[data-dashboard-navigation-drawer]";
const RAIL = "[data-dashboard-navigation-rail]";
const BOTTOM_NAV = "[data-dashboard-mobile-nav]";
const MORE = '[data-dashboard-mobile-nav-item="overflow"]';
const SHEET = '[data-dashboard-mobile-nav-overflow="true"]';
const SHEET_CLOSE = "[data-dashboard-mobile-nav-overflow-close]";
const KEBAB = ".dashboard-mobile-kebab-trigger";
const KEBAB_MENU = '[data-dashboard-mobile-kebab-menu="true"]';
const SEARCH_INPUT = '[data-workspace-app-bar-search-input="true"]';
const MAIN = "main.dashboard-main";
const TOUCH_MIN_PX = 44;
const PHONE = { width: 390, height: 844 };
const clinicModuleIds = new Set(["operaciones", "informes", "logistica", "perfil", "tokens"]);

const route: Record<SessionRole, string> = {
  admin: "/dashboard/admin?module=admin-clinics",
  clinic: "/dashboard?module=informes",
};
const activeModule: Record<SessionRole, string> = { admin: "admin-clinics", clinic: "informes" };

const painted = (page: Page, selector: string) => page.locator(selector).filter({ visible: true });

async function openSurface(page: Page, role: SessionRole, path = route[role]) {
  await setSession(page, role, "populated");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await expect(page.locator(MAIN)).toBeVisible({ timeout: 25_000 });
  await expect
    .poll(() => page.locator(MAIN).evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactFiber$"))), { timeout: 15_000 })
    .toBe(true);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

async function focused(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return "body";
    return element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName;
  });
}

async function documentScroll(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    return Math.max(html.scrollHeight - html.clientHeight, html.scrollWidth - html.clientWidth);
  });
}

async function expectOneCurrent(nav: Locator, itemAttribute: string, moduleId: string, label: string) {
  await expect(nav.locator('[aria-current="page"]'), `${label}: one current destination`).toHaveCount(1);
  await expect(nav.locator('[aria-current="page"]'), `${label}: current destination`).toHaveAttribute(itemAttribute, moduleId);
}

async function navigationIds(nav: Locator, itemAttribute: string) {
  return nav.locator(`[${itemAttribute}]`).evaluateAll(
    (items, attribute) => items.map((item) => item.getAttribute(attribute) ?? ""),
    itemAttribute,
  );
}

function expectRoleBounded(role: SessionRole, ids: readonly string[], label: string) {
  const crossing = ids.filter((id) => id !== "overflow" && clinicModuleIds.has(id) !== (role === "clinic"));
  expect(crossing, `${label}: destinations stay inside the ${role} catalog`).toEqual([]);
}

test.describe("C23a · one navigation owner per band in the 13 canonical viewports", () => {
  for (const role of ["admin", "clinic"] as const) {
    test(`${role} keeps drawer, rail or bottom bar exclusive with role-bounded destinations`, async ({ page }) => {
      test.setTimeout(180_000);
      const [entry] = DASHBOARD_GEOMETRY_VIEWPORTS;
      await page.setViewportSize({ width: entry.width, height: entry.height });
      await openSurface(page, role);

      const measured = new Set<string>();
      for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS) {
        const label = `${role} @ ${viewport.slug}`;
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await waitForLayoutSettled(page);

        const band = viewport.width >= 1280 ? DRAWER : viewport.width >= 768 ? RAIL : BOTTOM_NAV;
        for (const selector of [DRAWER, RAIL, BOTTOM_NAV]) {
          await expect(painted(page, selector), `${label}: ${selector}`).toHaveCount(selector === band ? 1 : 0);
        }
        await expect(painted(page, SEARCH_INPUT), `${label}: global search`).toHaveCount(viewport.width >= 768 ? 1 : 0);
        await expect(painted(page, KEBAB), `${label}: action kebab`).toHaveCount(viewport.width >= 768 ? 0 : 1);
        await expect(page.locator(`${SHEET}, ${KEBAB_MENU}`), `${label}: no overlay left open`).toHaveCount(0);

        const nav = painted(page, band);
        const itemAttribute = band === BOTTOM_NAV ? "data-dashboard-mobile-nav-item" : "data-dashboard-navigation-item";
        await expectOneCurrent(nav, itemAttribute, activeModule[role], label);
        expectRoleBounded(role, await navigationIds(nav, itemAttribute), label);

        const box = await nav.boundingBox();
        expect(box, `${label}: band box`).not.toBeNull();
        if (band === DRAWER) expect(Math.abs(box!.width - 256), `${label}: drawer 256 ±1`).toBeLessThanOrEqual(1);
        if (band === RAIL) expect(Math.abs(box!.width - 80), `${label}: rail 80 ±1`).toBeLessThanOrEqual(1);
        if (band === BOTTOM_NAV) {
          const mainBox = await page.locator(MAIN).boundingBox();
          expect(box!.y + 1, `${label}: the bar sits below main`).toBeGreaterThanOrEqual(mainBox!.y + mainBox!.height);
          const undersized = await nav.locator("[data-dashboard-mobile-nav-item]").evaluateAll((items, min) =>
            items
              .map((item) => item.getBoundingClientRect())
              .filter((rect) => rect.width < min || rect.height < min)
              .map((rect) => `${Math.round(rect.width)}x${Math.round(rect.height)}`),
            TOUCH_MIN_PX,
          );
          expect(undersized, `${label}: bar slots >= ${TOUCH_MIN_PX}px`).toEqual([]);
        }
        expect(await documentScroll(page), `${label}: document scroll`).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
        measured.add(viewport.slug);
      }
      expect(measured.size, `${role}: distinct viewports measured`).toBe(DASHBOARD_GEOMETRY_VIEWPORTS.length);
    });
  }

  test("the global search lists only the role catalog and is driven by keyboard", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1024, height: 768 });
    for (const role of ["clinic", "admin"] as const) {
      await openSurface(page, role);
      const input = painted(page, SEARCH_INPUT);
      await input.focus();
      const options = page.locator("[data-workspace-app-bar-search-option]");
      await expect(options.first()).toBeVisible();
      expectRoleBounded(role, await navigationIds(page.locator('[data-workspace-app-bar-search-results="true"]'), "data-workspace-app-bar-search-option"), `${role} search`);
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-workspace-app-bar-search-results="true"]')).toBeHidden();
      await expect(input, `${role}: Escape keeps focus in the search`).toBeFocused();
    }
    const input = painted(page, SEARCH_INPUT);
    await input.fill("audit");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/[?&]module=audit-log/);
    await expectOneCurrent(painted(page, RAIL), "data-dashboard-navigation-item", "audit-log", "admin search");
  });
});

test.describe("C23a · phone overlays of the shell", () => {
  test("the destination overflow returns focus to Más on Escape and on Cerrar", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSurface(page, "admin");
    const more = painted(page, MORE);

    await more.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(SHEET)).toBeVisible();
    await page.locator(SHEET_CLOSE).focus();
    await page.keyboard.press("Escape");
    await expect(page.locator(SHEET)).toHaveCount(0);
    await expect(more).toHaveAttribute("aria-expanded", "false");
    expect(await focused(page), "Escape from inside the sheet").toBe("Más");

    await more.click();
    await page.locator(SHEET_CLOSE).click();
    await expect(page.locator(SHEET)).toHaveCount(0);
    expect(await focused(page), "Cerrar").toBe("Más");
  });

  for (const role of ["admin", "clinic"] as const) {
    test(`${role} kebab returns focus on Escape and closes on an outside press`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await openSurface(page, role);
      const kebab = painted(page, KEBAB);
      const triggerLabel = await kebab.getAttribute("aria-label");

      await kebab.click();
      await expect(page.locator(KEBAB_MENU)).toBeVisible();
      await page.locator(KEBAB_MENU).locator("button").first().focus();
      await page.keyboard.press("Escape");
      await expect(page.locator(KEBAB_MENU)).toHaveCount(0);
      expect(await focused(page), "Escape from inside the menu").toBe(triggerLabel);

      await kebab.click();
      await expect(page.locator(KEBAB_MENU)).toBeVisible();
      await page.locator(MAIN).click({ position: { x: 12, y: 160 } });
      await expect(page.locator(KEBAB_MENU), "outside press").toHaveCount(0);
      await expect(kebab).toHaveAttribute("aria-expanded", "false");
      expect(await documentScroll(page)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
    });
  }

  test("the overflow and the kebab never stay open together, by keyboard or pointer", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSurface(page, "admin");
    const more = painted(page, MORE);
    const kebab = painted(page, KEBAB);

    await kebab.click();
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(SHEET)).toBeVisible();
    await expect(page.locator(KEBAB_MENU), "keyboard-opened overflow closes the kebab").toHaveCount(0);
    await expect(kebab).toHaveAttribute("aria-expanded", "false");

    await kebab.click();
    await expect(page.locator(KEBAB_MENU)).toBeVisible();
    await expect(page.locator(SHEET), "pointer-opened kebab closes the overflow").toHaveCount(0);
    await expect(more).toHaveAttribute("aria-expanded", "false");
  });

  test("an open overlay closes when the viewport leaves the phone regime", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSurface(page, "admin");

    await painted(page, MORE).click();
    await expect(page.locator(SHEET)).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator(SHEET)).toHaveCount(0);
    await expectOneCurrent(painted(page, RAIL), "data-dashboard-navigation-item", "admin-clinics", "rail after resize");

    await page.setViewportSize(PHONE);
    await expect(painted(page, BOTTOM_NAV)).toHaveCount(1);
    await expect(page.locator(SHEET), "the sheet does not reappear").toHaveCount(0);
    await expect(painted(page, MORE)).toHaveAttribute("aria-expanded", "false");
  });

  test("the audit filter sheet keeps its own Escape, returns focus and leaves the shell overlays closed", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSurface(page, "admin", "/dashboard/admin?module=audit-log");
    const filters = painted(page, "button").filter({ hasText: /^Filtros$/ });

    await filters.click();
    const sheet = page.getByRole("dialog", { name: "Filtrar auditoría" });
    await expect(sheet).toBeVisible();
    await expect(page.locator(`${SHEET}, ${KEBAB_MENU}`)).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(filters, "focus returns to Filtros").toBeFocused();
    await expect(painted(page, BOTTOM_NAV)).toHaveCount(1);
    expect(await documentScroll(page)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  });
});

// PR #1888 P1: the kebab hosts DashboardNotificationsBell, whose phone dialog is
// portaled to document.body. A press inside that dialog is inside the overlay.
const NOTIFICATIONS_DIALOG = '[data-dashboard-notifications-mobile-panel="true"]';
const NOTIFICATIONS_OVERLAY = '[data-dashboard-notifications-mobile-overlay="true"]';
const NOTIFICATIONS_READ = "/api/admin/study-tracking/notifications";

async function openNotificationsFromKebab(page: Page) {
  await painted(page, KEBAB).click();
  await expect(page.locator(KEBAB_MENU)).toBeVisible();
  const loaded = page.waitForResponse((response) => new URL(response.url()).pathname === NOTIFICATIONS_READ);
  await page.locator(KEBAB_MENU).getByRole("button", { name: "Notificaciones", exact: true }).click();
  await loaded;
  const dialog = page.locator(NOTIFICATIONS_DIALOG);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function windowPointerDownListeners(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  let count = 0;
  for (const expression of ["window", "document"]) {
    const { result } = await cdp.send("Runtime.evaluate", { expression });
    const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId! });
    count += listeners.filter((listener) => listener.type === "pointerdown").length;
  }
  await cdp.detach();
  return count;
}

test.describe("C23a · the kebab keeps its portaled Notificaciones panel operable", () => {
  test("pressing inside the portaled dialog runs its actions against the fixture and keeps both overlays", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSurface(page, "admin");
    const dialog = await openNotificationsFromKebab(page);

    const refreshed = page.waitForRequest((request) => new URL(request.url()).pathname === NOTIFICATIONS_READ);
    await dialog.getByRole("button", { name: "Actualizar", exact: true }).click();
    await refreshed;
    await expect(dialog, "Actualizar keeps the dialog").toBeVisible();
    await expect(page.locator(KEBAB_MENU), "Actualizar keeps the kebab").toBeVisible();

    const enabled = page.waitForRequest((request) => new URL(request.url()).pathname === NOTIFICATIONS_READ);
    await dialog.getByRole("button", { name: "Activar notificaciones", exact: true }).click();
    await enabled;
    await expect(dialog.getByRole("button", { name: "Notificaciones activadas", exact: true })).toBeDisabled();

    // The fixture serves an empty list: no item and no page to press, and
    // "Marcar todo como leído" stays disabled with no unread notification.
    await expect(dialog.getByText("No hay notificaciones.", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Marcar todo como leído", exact: true })).toBeDisabled();
    await expect(dialog.getByLabel("Paginación de notificaciones")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Cerrar panel de notificaciones", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(KEBAB_MENU), "Cerrar closes only the dialog").toBeVisible();

    const reloaded = page.waitForResponse((response) => new URL(response.url()).pathname === NOTIFICATIONS_READ);
    await page.locator(KEBAB_MENU).getByRole("button", { name: "Notificaciones", exact: true }).click();
    await reloaded;
    await expect(dialog.getByRole("button", { name: "Actualizar", exact: true })).toBeEnabled();
    const backdropY = PHONE.height - 8;
    const panel = await dialog.boundingBox();
    expect(panel!.y + panel!.height, "the backdrop press lands outside the panel").toBeLessThan(backdropY);
    await page.locator(NOTIFICATIONS_OVERLAY).click({ position: { x: PHONE.width / 2, y: backdropY } });
    await expect(dialog, "the backdrop closes the dialog").toHaveCount(0);
    await expect(page.locator(KEBAB_MENU), "the backdrop belongs to the kebab").toBeVisible();
    expect(await documentScroll(page)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  });

  test("Escape, a real outside press and the overflow still close the kebab and return focus", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSurface(page, "admin");
    const kebab = painted(page, KEBAB);
    const triggerLabel = await kebab.getAttribute("aria-label");

    const dialog = await openNotificationsFromKebab(page);
    await dialog.getByRole("button", { name: "Actualizar", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(KEBAB_MENU)).toHaveCount(0);
    expect(await focused(page), "Escape from the dialog").toBe(triggerLabel);

    await kebab.click();
    await page.locator(MAIN).click({ position: { x: 12, y: 160 } });
    await expect(page.locator(KEBAB_MENU), "a press outside the tree still closes").toHaveCount(0);

    await openNotificationsFromKebab(page);
    await page.keyboard.press("Escape");
    await kebab.click();
    await painted(page, MORE).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(SHEET)).toBeVisible();
    await expect(page.locator(KEBAB_MENU), "opening Más closes the kebab").toHaveCount(0);
    await kebab.click();
    await expect(page.locator(SHEET), "opening the kebab closes Más").toHaveCount(0);
    await expect(page.locator(KEBAB_MENU)).toBeVisible();
  });

  test("leaving the phone regime unmounts the kebab and its dialog and leaves no listener behind", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSurface(page, "admin");
    const idle = await windowPointerDownListeners(page);

    const dialog = await openNotificationsFromKebab(page);
    expect(await windowPointerDownListeners(page), "one dismissal listener while open").toBe(idle + 1);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator(KEBAB_MENU)).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(NOTIFICATIONS_OVERLAY)).toHaveCount(0);
    expect(await windowPointerDownListeners(page), "closed at 1024").toBe(idle);

    await page.setViewportSize(PHONE);
    await expect(painted(page, KEBAB)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(`${KEBAB_MENU}, ${NOTIFICATIONS_DIALOG}`), "nothing reappears").toHaveCount(0);

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await openNotificationsFromKebab(page);
      await page.keyboard.press("Escape");
      await painted(page, MORE).click();
      await page.locator(SHEET_CLOSE).click();
    }
    expect(await windowPointerDownListeners(page), "no orphan listener after open/close cycles").toBe(idle);
  });
});

test.describe("C23a · role boundary of the responsive shell", () => {
  test("without a session every viewport band redirects to the login, and a clinic session never paints admin navigation", async ({ page }) => {
    for (const viewport of [{ width: 1366, height: 768 }, { width: 834, height: 1194 }, PHONE]) {
      await page.setViewportSize(viewport);
      await page.goto("/dashboard?module=informes");
      await expect(page, `${viewport.width}: no session`).toHaveURL(/\/login/);
      await expect(page.locator(`${DRAWER}, ${RAIL}, ${BOTTOM_NAV}`)).toHaveCount(0);
    }

    await setSession(page, "clinic", "populated");
    await page.setViewportSize(PHONE);
    await page.goto(route.clinic);
    await expect(painted(page, BOTTOM_NAV)).toHaveCount(1);
    await expect(painted(page, BOTTOM_NAV)).toHaveAttribute("data-dashboard-mobile-nav", "clinic");
    await expect(page.locator(MORE), "clinic ships no destination overflow").toHaveCount(0);
    expectRoleBounded("clinic", await navigationIds(painted(page, BOTTOM_NAV), "data-dashboard-mobile-nav-item"), "clinic phone bar");
  });
});
