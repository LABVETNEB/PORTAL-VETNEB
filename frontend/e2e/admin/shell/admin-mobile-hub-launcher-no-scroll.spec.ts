import { expect, test, type Page } from "@playwright/test";
import { setAdminSession } from "../../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../helpers/zero-scroll-contract";

// Pre-C05 mobile space: below 768px the admin "Inicio" module — the hub and its
// two launcher pages — is retired. A hub request lands on the same module a
// bare route lands on, the bottom nav carries no Inicio slot, and every module
// stays reachable through the three promoted slots or "Más". >=768px keeps the
// hub untouched.

const MOBILE_VIEWPORTS = [
  { name: "android-short-360x640", width: 360, height: 640 },
  { name: "android-small-360x740", width: 360, height: 740 },
  { name: "iphone-standard-390x844", width: 390, height: 844 },
  { name: "android-large-412x915", width: 412, height: 915 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
] as const;

const ADMIN_MODULE_COUNT = 10;

async function suppressNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function expectNoDocumentScroll(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    html: {
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    },
    body: {
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.body.clientHeight,
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
    },
  }));
  for (const key of ["html", "body"] as const) {
    expect(metrics[key].scrollHeight, `${label}: ${key} vertical scroll`).toBeLessThanOrEqual(
      metrics[key].clientHeight + MAX_DOCUMENT_SCROLL_DELTA_PX,
    );
    expect(metrics[key].scrollWidth, `${label}: ${key} horizontal scroll`).toBeLessThanOrEqual(
      metrics[key].clientWidth + MAX_DOCUMENT_SCROLL_DELTA_PX,
    );
  }
}

async function expectHubRetired(page: Page, label: string) {
  await expect(page.locator('[data-admin-mobile-hub-launcher="true"]'), `${label}: launcher`).toBeHidden();
  await expect(page.locator('[data-admin-mobile-hub-pager="true"]'), `${label}: launcher pages`).toBeHidden();
  await expect(page.locator('[data-admin-mobile-hub-tile]').filter({ visible: true }), `${label}: tiles`).toHaveCount(0);
  await expect(page.locator('[data-dashboard-module-hub="true"]'), `${label}: desktop hub`).toBeHidden();
  await expect(page.locator('[data-dashboard-hub-root="true"]').filter({ visible: true }), `${label}: hub root`).toHaveCount(0);
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`Admin mobile Inicio (hub + its two pages) is retired at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setAdminSession(page, "populated");
    await page.goto("/dashboard/admin?hub=1");
    await suppressNextDevIndicator(page);

    // An explicit hub request lands where a bare route lands (no stored module
    // in a fresh context: the operational default), replacing the URL.
    await expect(page).toHaveURL(/\/dashboard\/admin\?module=admin$/, { timeout: 15_000 });
    await expect(page.locator('[data-dashboard-module-workspace="admin"]')).toBeVisible({ timeout: 15_000 });
    await expectHubRetired(page, viewport.name);

    const bottomNav = page.locator('[data-dashboard-mobile-nav="admin"]').filter({ visible: true });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.locator('[data-dashboard-mobile-nav-item="home"]')).toHaveCount(0);
    await expect(bottomNav.getByRole("link", { name: "Inicio", exact: true })).toHaveCount(0);
    await expect(bottomNav.getByRole("button", { name: "Inicio", exact: true })).toHaveCount(0);
    const slots = await bottomNav
      .locator("[data-dashboard-mobile-nav-item]")
      .evaluateAll((items) => items.map((item) => item.getAttribute("data-dashboard-mobile-nav-item")));
    expect(slots, `${viewport.name}: bottom nav slots`).toEqual([
      "admin-clinics",
      "audit-log",
      "admin-sessions",
      "overflow",
    ]);

    // Every admin module stays reachable without the hub.
    await bottomNav.locator('[data-dashboard-mobile-nav-item="overflow"]').click();
    const overflow = page.locator('[data-dashboard-mobile-nav-overflow="true"]');
    await expect(overflow).toBeVisible();
    const reachable = new Set<string>();
    for (;;) {
      for (const id of await overflow
        .locator("[data-dashboard-mobile-nav-overflow-link]")
        .evaluateAll((links) => links.map((link) => link.getAttribute("data-dashboard-mobile-nav-overflow-link") ?? ""))) {
        reachable.add(id);
      }
      const next = overflow.locator('[data-dashboard-mobile-nav-overflow-page="next"]');
      if (await next.isDisabled()) break;
      await next.click();
    }
    expect(reachable.size, `${viewport.name}: modules reachable from Más`).toBe(ADMIN_MODULE_COUNT);
    await page.keyboard.press("Escape");
    await expect(overflow).toBeHidden();

    await expectNoDocumentScroll(page, viewport.name);
  });
}

test("Admin mobile hub request lands on the persisted last module, never on the hub", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAdminSession(page, "populated");
  await page.goto("/dashboard/admin?module=audit-log");
  await expect(page.locator('[data-dashboard-module-workspace="audit-log"]')).toBeVisible({ timeout: 15_000 });

  await page.goto("/dashboard/admin?hub=1");
  await expect(page).toHaveURL(/\/dashboard\/admin\?module=audit-log$/, { timeout: 15_000 });
  await expect(page.locator('[data-dashboard-module-workspace="audit-log"]')).toBeVisible({ timeout: 15_000 });
  await expectHubRetired(page, "390x844 persisted");
});

for (const viewport of [
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
] as const) {
  test(`Admin desktop/tablet retires the hub, keeps lateral navigation and has no mobile launcher at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    // Desktop/tablet space pass: the hub is retired from 768px up too, so the
    // legacy URL lands on Resumen there exactly as it does on phones.
    await page.setViewportSize(viewport);
    await setAdminSession(page, "populated");
    await page.goto("/dashboard/admin?hub=1");
    await suppressNextDevIndicator(page);

    await expect(page).toHaveURL(/\/dashboard\/admin\?module=admin$/, { timeout: 15_000 });
    await expect(page.locator('[data-dashboard-module-workspace="admin"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-dashboard-module-hub="true"]')).toHaveCount(0);
    await expect(
      page.locator('[data-dashboard-navigation-rail="admin"], [data-dashboard-navigation-drawer="admin"]').filter({ visible: true }),
    ).toHaveCount(1);
    await expect(page.locator('[data-dashboard-navigation-item="home"]').filter({ visible: true })).toHaveCount(0);
    await expect(page.locator('[data-dashboard-mobile-nav="admin"]')).toBeHidden();
    await expect(page.locator('[data-admin-mobile-hub-launcher="true"]')).toBeHidden();
    await expect(page.getByText("Seleccione un módulo para acceder a sus funciones.", { exact: true })).toBeHidden();
  });
}
