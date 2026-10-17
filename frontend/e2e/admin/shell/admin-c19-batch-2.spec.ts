import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import { addAppCookies, sessionCookie } from "../../helpers/session";

const users = "#admin-users-roles";
const sessions = "#admin-sessions";

const MOCK_SESSIONS = Array.from({ length: 30 }, (_, index) => ({
  sessionType: (["admin", "clinic", "particular"] as const)[index % 3],
  sessionId: 8100 + index,
  actorType: (["admin_user", "clinic_user", "particular_token"] as const)[index % 3],
  actorId: 310 + index,
  createdAt: "2026-06-15T09:00:00.000Z",
  lastAccess: "2026-06-19T18:45:00.000Z",
  expiresAt: "2026-06-30T09:00:00.000Z",
  status: index % 4 === 0 ? ("expired" as const) : ("active" as const),
}));

const MOCK_FAILED_LOGIN_ALERTS = Array.from({ length: 30 }, (_, index) => ({
  id: 6100 + index,
  surface: (["admin", "clinic", "particular"] as const)[index % 3],
  username: index % 4 === 0 ? null : `intento_${index}`,
  reason: (["invalid_credentials", "missing_credentials", "rate_limited"] as const)[index % 3],
  ipAddress: `203.0.113.${10 + index}`,
  userAgent: "Mozilla/5.0 (e2e-c19)",
  createdAt: "2026-06-12T09:30:00.000Z",
}));

async function fulfillWindow(route: Route, pathname: string, body: (limit: number, offset: number) => object) {
  const url = new URL(route.request().url());
  if (route.request().method() !== "GET" || url.pathname !== pathname) {
    await route.fallback();
    return;
  }
  const limit = Number(url.searchParams.get("limit") ?? "10");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, limit, offset, ...body(limit, offset) }) });
}

async function mockSessions(page: Page, rows = MOCK_SESSIONS) {
  await page.route("**/api/admin/sessions**", (route) =>
    fulfillWindow(route, "/api/admin/sessions", (limit, offset) => ({
      sessions: rows.slice(offset, offset + limit),
      total: rows.length,
      currentAdminSessionId: 8100,
      checkedBy: { adminUserId: 41, username: "admin_operaciones" },
    })),
  );
}

async function mockFailedLogins(page: Page) {
  await page.route("**/api/admin/failed-login-alerts**", (route) =>
    fulfillWindow(route, "/api/admin/failed-login-alerts", (limit, offset) => ({
      failedLoginAlerts: MOCK_FAILED_LOGIN_ALERTS.slice(offset, offset + limit),
      total: MOCK_FAILED_LOGIN_ALERTS.length,
    })),
  );
}

async function documentOverflow(page: Page) {
  return page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
}

test.beforeEach(async ({ page }) => {
  await addAppCookies(page, [sessionCookie("admin", "populated")]);
});

test("C19 Usuarios composes the C01 table and C13 detail with the same role filter request and keyboard disclosure", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests: URLSearchParams[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/admin/users-roles") requests.push(url.searchParams);
  });
  await page.goto("/dashboard/admin?module=admin-users-roles");
  const card = page.locator(users);
  const table = card.getByRole("table", { name: "Tabla de usuarios y roles administrativos" });
  const rows = table.locator('tbody[data-content-list="true"] > tr[data-content-list-item="true"]');
  await expect(rows.first()).toBeVisible();
  await expect(card.locator('[data-collection-workspace="true"] thead[data-collection-header="true"]')).toBeVisible();
  await expect(card.getByRole("button", { name: "Cambiar rol" }).first()).toBeVisible();

  await card.locator("select").filter({ has: page.locator('option[value="clinic_owner"]') }).first().selectOption("clinic_owner");
  await expect.poll(() => requests.some((params) => params.get("role") === "clinic_owner" && params.get("offset") === "0")).toBe(true);
  await expect(card.getByRole("button", { name: "Actualizar" })).toBeEnabled();
  await expect(rows.first()).toContainText("Owner clínica");

  const trigger = rows.first().getByRole("button", { name: /^Ver detalle del usuario / });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /Usuario #/ });
  await expect(dialog.locator('[data-details-pane="true"] [data-details-metadata="true"]')).toBeVisible();
  for (const item of ["username", "clinic", "user-type", "role", "created", "updated"]) {
    await expect(dialog.locator(`[data-details-metadata-item="${item}"]`)).toHaveCount(1);
  }
  await expect(dialog.locator("select, input")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect((await new AxeBuilder({ page }).include(users).analyze()).violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("C19 Usuarios mobile Siguiente requests offset=limit and shows page 2 with zero document scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // The default 9-user pool fits one mobile page; the fixture's opt-in 5000-user
  // dataset is reached by rewriting only the wire URL (route.continue), so the
  // card's own limit/offset stay untouched.
  await page.route("**/api/admin/users-roles**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET" || url.pathname !== "/api/admin/users-roles") {
      await route.fallback();
      return;
    }
    url.searchParams.set("dataset", "high-volume");
    await route.continue({ url: url.toString() });
  });
  const isUsersRequest = (url: URL) => url.pathname === "/api/admin/users-roles";
  await page.goto("/dashboard/admin?module=admin-users-roles");
  const mobile = page.locator('[data-admin-mobile-ops-module="users"]');
  const items = mobile.locator('[data-content-list="true"] > article[data-content-list-item="true"][data-admin-mobile-ops-item="true"]');
  const pager = mobile.getByRole("navigation", { name: "Paginación de usuarios" });
  await expect(pager.getByText(/Pág\. 1 \/ (?:[2-9]|\d{2,})\b/)).toBeVisible({ timeout: 15_000 });
  await expect(items.first()).toBeVisible();

  await expect(async () => {
    const response = await page.waitForResponse((res) => isUsersRequest(new URL(res.url())), { timeout: 1_500 }).catch(() => null);
    expect(response, "the measured window has settled: no further page-1 refetch").toBeNull();
  }).toPass({ timeout: 15_000 });
  const firstPageItem = (await items.first().innerText()).trim();
  const firstPageCount = await items.count();

  const next = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return isUsersRequest(url) && url.searchParams.get("offset") !== "0";
  });
  await pager.getByRole("button", { name: "Siguiente" }).click();
  const nextUrl = new URL((await next).url());
  const limit = Number(nextUrl.searchParams.get("limit"));
  expect(limit).toBeGreaterThan(0);
  expect(Number(nextUrl.searchParams.get("offset")), "page 2 starts exactly one measured window later").toBe(limit);
  expect(firstPageCount, "page 1 rendered the same window the next request advances by").toBe(limit);

  await expect(pager.getByText(/Pág\. 2 \/ \d+/)).toBeVisible();
  await expect(items.first()).not.toHaveText(firstPageItem);
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });
});

test("C19 Sesiones keeps the current admin session unrevocable inside the C01 table and shows the C03 empty state", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await mockSessions(page);
  await page.goto("/dashboard/admin?module=admin-sessions");
  const card = page.locator(sessions);
  const rows = card.locator('tbody[data-content-list="true"] > tr[data-content-list-item="true"][data-admin-sesiones-row="true"]');
  await expect(rows.first()).toBeVisible();
  await expect(card.locator('thead[data-collection-header="true"]')).toBeVisible();
  await expect(card.getByRole("button", { name: /Sesión Admin #8100 actual, no se puede revocar/ }).locator("visible=true")).toBeDisabled();
  await expect(card.getByRole("button", { name: /^Revocar sesión Clínica #8101$/ }).locator("visible=true")).toBeEnabled();
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockSessions(page, []);
  await card.getByRole("button", { name: "Actualizar" }).locator("visible=true").click();
  const empty = card.locator('[data-collection-state="empty"]').locator("visible=true");
  await expect(empty).toContainText("No hay sesiones para los filtros seleccionados.");
});

test("C19 Intentos fallidos renders C01 rows and the C13 detail with missing values announced", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockFailedLogins(page);
  await page.goto("/dashboard/admin?module=admin");
  const alertas = page.getByRole("tab", { name: /^Alertas$/i }).or(page.getByRole("button", { name: /^Alertas$/i })).locator("visible=true").first();
  await alertas.click();
  const rows = page.locator('tbody[data-content-list="true"] > tr[data-content-list-item="true"]').filter({ hasText: "#61" });
  await expect(rows.first()).toBeVisible();
  await page.getByRole("button", { name: "Ver detalle del intento fallido 6100" }).locator("visible=true").click();
  const dialog = page.getByRole("dialog", { name: "Intento fallido #6100" });
  const pane = dialog.locator('[data-details-pane="true"]');
  await expect(pane.locator('[data-details-metadata-item="user-agent"]')).toContainText("Mozilla/5.0 (e2e-c19)");
  await expect(pane.locator('[data-details-metadata-item="username"] [data-details-metadata-missing="true"]')).toContainText("Sin dato");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("C19 Intentos fallidos mobile chip keeps C01 items with their pitch dividers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFailedLogins(page);
  await page.goto("/dashboard/admin?module=admin");
  const moduleRoot = page.locator('[data-admin-mobile-status-module="admin"]');
  await expect(moduleRoot).toBeVisible({ timeout: 15_000 });
  await moduleRoot.locator('[data-admin-mobile-status-chip="alertas"]').click();
  const panel = moduleRoot.locator('[data-admin-mobile-status-panel="alertas"]');
  const items = panel.locator('[data-content-list="true"] > article[data-content-list-item="true"][data-admin-mobile-status-item="true"]');
  await expect(items.nth(1)).toBeVisible({ timeout: 10_000 });
  // divide-y draws one 1px separator between consecutive items; it is part of the measured pitch.
  expect(await items.first().evaluate((item) => getComputedStyle(item).borderBottomWidth)).toBe("1px");
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });
});
