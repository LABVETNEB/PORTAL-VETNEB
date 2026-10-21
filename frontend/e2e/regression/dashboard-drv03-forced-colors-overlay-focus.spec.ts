import { expect, test, type Locator, type Page } from "@playwright/test";
import { setSession, type SessionRole } from "../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../helpers/zero-scroll-contract";

// PR-DRV-03 · focus stays visible in forced-colors inside the dashboard
// overlays that portal to document.body, outside `.dashboard-app-shell` and so
// outside the C25 outline rule. Their controls ship `focus-visible:outline-none`
// and paint focus only as a box-shadow ring, which forced-colors drops. Every
// enabled, painted, tabbable control of each overlay must carry a real outline
// while it matches `:focus-visible`. Geometry stays owned by A02/A08.

const MAIN = "main.dashboard-main";
const KEBAB = ".dashboard-mobile-kebab-trigger";
const KEBAB_MENU = '[data-dashboard-mobile-kebab-menu="true"]';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const SYNTHETIC_CLINICS = {
  success: true,
  clinics: [{ clinicId: 1, clinicName: "Clínica Test", contactEmail: null, contactPhone: null, createdAt: "2025-01-15T10:00:00.000Z", updatedAt: "2025-01-20T12:00:00.000Z", users: [] }],
  total: 1,
  limit: 50,
  offset: 0,
};
const PIXEL_PNG ="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xuoAAAAASUVORK5CYII=";

async function openSurface(page: Page, role: SessionRole, path: string) {
  await setSession(page, role, "populated");
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto(path);
  await expect(page.locator(MAIN)).toBeVisible({ timeout: 25_000 });
  await expect
    .poll(() => page.locator(MAIN).evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactFiber$"))), { timeout: 15_000 })
    .toBe(true);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

type FocusRecord = { control: string; matchesFocusVisible: boolean; outlineStyle: string; outlineWidth: number };

// Focuses every tabbable control of the overlay with a keyboard-modality focus
// and reports the ones whose focus indicator is not a real outline.
async function focusWithoutOutline(overlay: Locator) {
  const records = await overlay.evaluate((root) => {
    const selector = "a[href], button, input, select, textarea, summary, [role='button'], [role='tab'], [role='checkbox'], [tabindex]";
    const out: FocusRecord[] = [];
    const tabbable = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0,
    );
    for (const [index, element] of tabbable.entries()) {
      // The dialog's auto-focused control holds pointer-modality focus; moving
      // focus away first lets the keyboard-modality focus re-evaluate it.
      if (document.activeElement === element && tabbable.length > 1) {
        tabbable[(index + 1) % tabbable.length].focus({ focusVisible: true } as FocusOptions);
      }
      element.focus({ focusVisible: true } as FocusOptions);
      if (document.activeElement !== element) continue;
      const style = getComputedStyle(element);
      out.push({
        control: `${element.tagName.toLowerCase()}[${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 24) ?? ""}]`,
        matchesFocusVisible: element.matches(":focus-visible"),
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
      });
    }
    return out;
  });
  expect(records.length, "the overlay exposes tabbable controls").toBeGreaterThan(0);
  expect(records.filter((record) => !record.matchesFocusVisible).map((record) => record.control), "keyboard modality reaches :focus-visible").toEqual([]);
  return records.filter((record) => record.outlineStyle === "none" || record.outlineWidth === 0).map((record) => record.control);
}

async function documentScroll(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    return Math.max(html.scrollHeight - html.clientHeight, html.scrollWidth - html.clientWidth);
  });
}

test.describe("PR-DRV-03 · forced-colors focus inside body-portaled dashboard overlays", () => {
  test("ModuleDialog without the scoped portal (Tokens admin detail)", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await openSurface(page, "admin", "/dashboard/admin?module=admin-particular-tokens");
    const card = page.locator('[data-dashboard-module-workspace="admin-particular-tokens"]');
    await card.locator("tbody tr").first().getByRole("button", { name: "Ver detalle" }).click();
    const dialog = page.locator('[data-module-dialog="true"]');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => el.closest(".dashboard-app-shell") === null), "portaled outside the shell").toBe(true);
    expect(await focusWithoutOutline(dialog)).toEqual([]);
    expect(await documentScroll(page)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  });

  test("ClinicEditDrawer (Clínicas admin)", async ({ page }) => {
    // The fixture serves no clinic list; one synthetic clinic opens the drawer.
    await page.route((url) => url.pathname === "/api/admin/clinics", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SYNTHETIC_CLINICS) })
        : route.continue(),
    );
    await page.setViewportSize(DESKTOP);
    await openSurface(page, "admin", "/dashboard/admin?module=admin-clinics");
    await page.getByRole("button", { name: /^Editar clínica/ }).filter({ visible: true }).first().click();
    const drawer = page.locator('[data-clinic-edit-drawer="true"]');
    await expect(drawer).toBeVisible();
    expect(await drawer.evaluate((el) => el.closest(".dashboard-app-shell") === null), "portaled outside the shell").toBe(true);
    expect(await focusWithoutOutline(drawer)).toEqual([]);
    expect(await documentScroll(page)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  });

  test("AdvancedFilterSheet without the scoped portal (Informes admin phone)", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSurface(page, "admin", "/dashboard/admin?module=admin-report-upload");
    await page.getByRole("button", { name: "Filtros", exact: true }).filter({ visible: true }).click();
    const sheet = page.locator('[data-advanced-filter-sheet="true"]');
    await expect(sheet).toBeVisible();
    expect(await sheet.evaluate((el) => el.closest(".dashboard-app-shell") === null), "portaled outside the shell").toBe(true);
    expect(await focusWithoutOutline(sheet)).toEqual([]);
    expect(await documentScroll(page)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  });

  test("DocumentViewer (Informes admin)", async ({ page }) => {
    await page.route(/^https:\/\/example\.supabase\.co\/storage\/v1\/object\/sign\//, (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(PIXEL_PNG, "base64") }));
    await page.setViewportSize(DESKTOP);
    await openSurface(page, "admin", "/dashboard/admin?module=admin-report-upload");
    const reports = page.locator('[data-dashboard-module-workspace="admin-report-upload"]');
    await reports.locator("tbody tr").first().getByRole("button", { name: /Acciones del informe/ }).click();
    await page.getByRole("menuitem", { name: "Ver detalle" }).click();
    await page.getByRole("dialog", { name: /Informe #/ }).getByRole("button", { name: "Ver informe" }).click();
    const viewer = page.locator('[data-c15-viewer="true"]');
    await expect(viewer.getByRole("img", { name: /Informe #/ })).toBeVisible();
    expect(await viewer.evaluate((el) => el.closest(".dashboard-app-shell") === null), "portaled outside the shell").toBe(true);
    expect(await focusWithoutOutline(viewer)).toEqual([]);
  });

  test("Notifications phone panel (kebab)", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openSurface(page, "admin", "/dashboard/admin?module=admin-clinics");
    await page.locator(KEBAB).filter({ visible: true }).click();
    await expect(page.locator(KEBAB_MENU)).toBeVisible();
    await page.locator(KEBAB_MENU).getByRole("button", { name: "Notificaciones", exact: true }).click();
    const panel = page.locator('[data-dashboard-notifications-mobile-panel="true"]');
    await expect(panel).toBeVisible();
    expect(await panel.evaluate((el) => el.closest(".dashboard-app-shell") === null), "portaled outside the shell").toBe(true);
    expect(await focusWithoutOutline(panel)).toEqual([]);
    expect(await documentScroll(page)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  });

  test("normal color mode keeps the overlays' box-shadow ring and adds no outline", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await setSession(page, "admin", "populated");
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
    await page.goto("/dashboard/admin?module=admin-particular-tokens");
    const card = page.locator('[data-dashboard-module-workspace="admin-particular-tokens"]');
    await card.locator("tbody tr").first().getByRole("button", { name: "Ver detalle" }).click();
    const dialog = page.locator('[data-module-dialog="true"]');
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: /Cerrar/ }).first();
    await close.evaluate((el) => (el as HTMLElement).focus({ focusVisible: true } as FocusOptions));
    await expect(close).toHaveCSS("outline-style", "none");
  });
});
