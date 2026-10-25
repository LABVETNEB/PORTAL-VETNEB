import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type Request, type Route } from "@playwright/test";
import { waitForAdaptiveConvergence } from "../../helpers/dashboard-adaptive-limit-matrix";
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

// C25 F-T2: int4-range synthetic ids and the longest actor label, so the
// compact table and the mobile line really truncate them.
const LONG_SESSIONS = Array.from({ length: 30 }, (_, index) => ({
  sessionType: (["admin", "particular", "clinic"] as const)[index % 3],
  sessionId: 2_147_480_100 + index,
  actorType: (["admin_user", "particular_token", "clinic_user"] as const)[index % 3],
  actorId: 2_147_470_300 + index,
  createdAt: "2026-06-15T09:00:00.000Z",
  lastAccess: index % 5 === 4 ? null : "2026-06-19T18:45:00.000Z",
  expiresAt: "2026-06-30T09:00:00.000Z",
  status: index % 4 === 0 ? ("expired" as const) : ("active" as const),
}));

async function mockSessions(
  page: Page,
  rows: ReadonlyArray<(typeof MOCK_SESSIONS)[number] | (typeof LONG_SESSIONS)[number]> = MOCK_SESSIONS,
  currentAdminSessionId = 8100,
) {
  await page.route("**/api/admin/sessions**", (route) =>
    fulfillWindow(route, "/api/admin/sessions", (limit, offset) => ({
      sessions: rows.slice(offset, offset + limit),
      total: rows.length,
      currentAdminSessionId,
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
  await expect(card.getByRole("search", { name: "Filtros de usuarios y roles" })).toHaveCount(1);
  await expect(card.getByRole("search")).toHaveCount(1);
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
  await expect(mobile.getByRole("search", { name: "Buscar usuarios y roles" })).toHaveCount(1);
  await expect(page.locator(users).getByRole("search")).toHaveCount(1);
  const pager = mobile.getByRole("navigation", { name: "Paginación de usuarios" });
  await expect(pager.getByText(/Pág\. 1 \/ (?:[2-9]|\d{2,})\b/)).toBeVisible({ timeout: 15_000 });
  await expect(items.first()).toBeVisible();

  await waitForAdaptiveConvergence(page, '[data-admin-mobile-ops-module="users"] [data-dashboard-adaptive-rows-canvas="true"]', "C19 users mobile page 1");
  await expect(mobile.locator('[aria-busy="true"]'), "no page-1 refetch in flight").toHaveCount(0);
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
  await expect(card.getByRole("button", { name: /^Sesión actual: Admin #8100, no se puede revocar$/ }).locator("visible=true")).toBeDisabled();
  await expect(card.getByRole("button", { name: /^Revocar sesión Clínica #8101$/ }).locator("visible=true")).toBeEnabled();
  // G11-e: the visible "Sesión actual" / "Revocar" text is contained in each name.
  expect((await new AxeBuilder({ page }).include(sessions).analyze()).violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
  expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockSessions(page, []);
  await card.getByRole("button", { name: "Actualizar" }).locator("visible=true").click();
  const empty = card.locator('[data-collection-state="empty"]').locator("visible=true");
  await expect(empty).toContainText("No hay sesiones para los filtros seleccionados.");
});

type LongSession = (typeof LONG_SESSIONS)[number];
const SESSION_TYPE_LABEL = { admin: "Admin", clinic: "Clínica", particular: "Particular" } as const;
const ACTOR_TYPE_LABEL = { admin_user: "Admin", clinic_user: "Clínica", particular_token: "Token particular" } as const;

async function hydrated(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactFiber$"))), { timeout: 15_000 })
    .toBe(true);
}

// Opens by keyboard, checks every field whole and unclipped, closes with
// Escape and returns focus to the trigger.
async function discloseSession(page: Page, trigger: Locator, session: LongSession, key: "Enter" | " ", label: string) {
  await hydrated(trigger);
  const dialog = page.getByRole("dialog", { name: `Sesión ${SESSION_TYPE_LABEL[session.sessionType]} #${session.sessionId}`, exact: true });
  await expect(async () => {
    await trigger.focus();
    await page.keyboard.press(key);
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  expect(await dialog.evaluate((element) => element.contains(document.activeElement)), `${label}: focus moves into the dialog`).toBe(true);

  const pane = dialog.locator('[data-details-pane="true"]');
  const item = (id: string) => pane.locator(`[data-details-metadata-item="${id}"] dd`);
  await expect(item("session-type")).toHaveText(SESSION_TYPE_LABEL[session.sessionType]);
  await expect(item("session-id")).toHaveText(`#${session.sessionId}`);
  await expect(item("actor-type")).toHaveText(ACTOR_TYPE_LABEL[session.actorType]);
  await expect(item("actor-id")).toHaveText(`ID ${session.actorId}`);
  await expect(item("status")).toHaveText(session.status === "active" ? "Activa" : "Expirada");
  for (const [id, value] of [["created", session.createdAt], ["last-access", session.lastAccess], ["expires", session.expiresAt]] as const) {
    if (value === null) {
      await expect(item(id)).toHaveAttribute("data-details-metadata-missing", "true");
      await expect(item(id)).toContainText("Sin dato");
    } else {
      await expect(item(id)).not.toHaveAttribute("data-details-metadata-missing", "true");
      await expect(item(id)).toHaveText(/\d/);
    }
  }
  await expect(dialog.locator("button, select, input").filter({ hasText: /Revocar/ })).toHaveCount(0);

  const geometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const values = [...element.querySelectorAll<HTMLElement>(".dashboard-detail-value")];
    const scrollers = [...element.querySelectorAll<HTMLElement>("*")].filter((node) => {
      const overflowY = getComputedStyle(node).overflowY;
      return (overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight + 1;
    });
    return {
      inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      values: values.length,
      clipped: values.filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1).length,
      selectable: values.every((node) => getComputedStyle(node).userSelect !== "none"),
      scrollers: scrollers.length,
      bodyIsOwner: scrollers.every((node) => node.dataset.moduleDialogBody === "true"),
    };
  });
  expect(geometry, `${label}: the dialog shows every value whole`).toEqual({ inViewport: true, values: 8, clipped: 0, selectable: true, scrollers: geometry.scrollers, bodyIsOwner: true });
  expect(geometry.scrollers, `${label}: at most one internal scroll owner`).toBeLessThanOrEqual(1);

  // No session or actor id lands in a data-* or title attribute.
  const leaks = await page.evaluate((ids) => {
    const found: string[] = [];
    for (const node of document.querySelectorAll("*")) {
      for (const attribute of node.attributes) {
        const watched = attribute.name === "title" || attribute.name.startsWith("data-");
        if (watched && ids.some((id) => attribute.value.includes(id))) found.push(`${node.tagName}[${attribute.name}]`);
      }
    }
    return found;
  }, [String(session.sessionId), String(session.actorId)]);
  expect(leaks, `${label}: no id in a data-* or title attribute`).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await trigger.evaluate((element) => getComputedStyle(element).outlineStyle), `${label}: focus returns visibly`).toBe("solid");
}

function watchSessionTraffic(page: Page) {
  const traffic = { reads: [] as URLSearchParams[], writes: [] as string[], confirms: 0 };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/admin/sessions")) return;
    if (request.method() === "GET") traffic.reads.push(url.searchParams);
    else traffic.writes.push(`${request.method()} ${url.pathname}`);
  });
  page.on("dialog", (dialog) => {
    traffic.confirms += 1;
    void dialog.dismiss();
  });
  return traffic;
}

const isSessionsPage2 = (request: Request) => {
  const url = new URL(request.url());
  return request.method() === "GET" && url.pathname === "/api/admin/sessions" && url.searchParams.get("status") === "active" && url.searchParams.get("offset") !== "0";
};

for (const viewport of [
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "desktop-1024x768", width: 1024, height: 768 },
  { name: "tablet-834x1194", width: 834, height: 1194 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
] as const) {
  test(`C25 F-T2 Sesiones desktop id discloses the full session by keyboard, keeping revocation, filters and paging at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const [current] = LONG_SESSIONS;
    await mockSessions(page, LONG_SESSIONS, current.sessionId);
    const traffic = watchSessionTraffic(page);
    await page.goto("/dashboard/admin?module=admin-sessions");
    const card = page.locator(sessions);
    const table = card.getByRole("table", { name: "Tabla de sesiones administrativas" });
    const rows = table.locator('tbody[data-content-list="true"] > tr[data-admin-sesiones-row="true"]');
    await expect(rows.first()).toBeVisible();
    await expect(table.locator("thead th")).toHaveCount(7);

    // Current admin session: its detail opens, its revocation stays locked.
    const sessionTrigger = (session: LongSession) =>
      rows.getByRole("button", { name: `${SESSION_TYPE_LABEL[session.sessionType]} #${session.sessionId}, ver detalle de la sesión`, exact: true });
    const currentTrigger = sessionTrigger(current);
    await expect(currentTrigger).toContainText(`#${current.sessionId}`);
    // The id truncates up to 1024 px (0 px wide after a "Particular" badge at
    // 768) and Expira/Creada hide below 1280/1024; at 1366 nothing is hidden.
    if (viewport.width <= 1024) {
      const ids = await rows.locator("td:first-child button > span:last-child").evaluateAll((nodes) => nodes.map((node) => node.scrollWidth > node.clientWidth));
      expect(ids.every(Boolean), `${viewport.name}: the row truncates every id`).toBe(true);
    }
    const hiddenColumns = await table.locator("thead th").evaluateAll((cells) => cells.filter((cell) => getComputedStyle(cell).display === "none").length);
    expect(hiddenColumns, `${viewport.name}: Creada/Expira hidden below lg/xl`).toBe(viewport.width < 1024 ? 2 : viewport.width < 1280 ? 1 : 0);
    expect(await rows.locator("[title]").count(), `${viewport.name}: no hover-only title`).toBe(0);
    await discloseSession(page, currentTrigger, current, "Enter", `${viewport.name} current`);
    await expect(card.getByRole("dialog")).toHaveCount(0);
    await expect(rows.first().getByRole("button", { name: `Sesión actual: Admin #${current.sessionId}, no se puede revocar` })).toBeDisabled();

    // Filter + page 2, then the detail never re-requests or moves the window.
    await card.getByLabel("Estado").locator("visible=true").selectOption("active");
    await expect.poll(() => traffic.reads.some((params) => params.get("status") === "active" && params.get("offset") === "0")).toBe(true);
    await expect(card.getByRole("button", { name: "Actualizar" }).locator("visible=true")).toBeEnabled();
    const next = page.waitForRequest(isSessionsPage2);
    await card.getByRole("button", { name: "Siguiente" }).locator("visible=true").click();
    const limit = Number(new URL((await next).url()).searchParams.get("limit"));
    const target = LONG_SESSIONS[limit];
    const trigger = sessionTrigger(target);
    await expect(trigger).toBeVisible();
    await expect(card.getByRole("button", { name: "Actualizar" }).locator("visible=true")).toBeEnabled();
    const readsBefore = traffic.reads.length;

    await discloseSession(page, trigger, target, " ", `${viewport.name} page 2`);
    expect(traffic.reads.length, `${viewport.name}: opening the detail fetches nothing`).toBe(readsBefore);
    expect(traffic.writes, `${viewport.name}: no revocation was sent`).toEqual([]);
    expect(traffic.confirms, `${viewport.name}: no revocation confirm was raised`).toBe(0);
    await expect(card.getByLabel("Estado").locator("visible=true")).toHaveValue("active");
    await expect(rows.first().getByRole("button", { name: `Revocar sesión ${SESSION_TYPE_LABEL[target.sessionType]} #${target.sessionId}` })).toBeEnabled();
    expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });
    expect((await new AxeBuilder({ page }).include(sessions).analyze()).violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
  });
}

for (const viewport of [
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-360x800", width: 360, height: 800 },
  { name: "mobile-320x568", width: 320, height: 568 },
] as const) {
  test(`C25 F-T2 Sesiones mobile summary line discloses the full session, keeping revocation, filters and paging at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const [current] = LONG_SESSIONS;
    await mockSessions(page, LONG_SESSIONS, current.sessionId);
    const traffic = watchSessionTraffic(page);
    await page.goto("/dashboard/admin?module=admin-sessions");
    const mobile = page.locator('[data-admin-mobile-ops-module="sessions"]');
    const items = mobile.locator('[data-content-list="true"] > article[data-admin-sesiones-row="true"]');
    await expect(items.first()).toBeVisible({ timeout: 15_000 });
    await waitForAdaptiveConvergence(page, '[data-admin-mobile-ops-module="sessions"] [data-dashboard-adaptive-rows-canvas="true"]', `F-T2 sessions ${viewport.name}`);
    const pitch = await items.first().evaluate((item) => item.getBoundingClientRect().height);

    const sessionTrigger = (session: LongSession) =>
      items.getByRole("button", {
        name: `${SESSION_TYPE_LABEL[session.sessionType]} ${session.status === "active" ? "Activa" : "Expirada"} ${ACTOR_TYPE_LABEL[session.actorType]} · #${session.sessionId}, ver detalle de la sesión`,
        exact: true,
      });
    const currentTrigger = sessionTrigger(current);
    await expect(currentTrigger).toContainText(`${ACTOR_TYPE_LABEL[current.actorType]} · #${current.sessionId}`);
    await discloseSession(page, currentTrigger, current, "Enter", `${viewport.name} current`);
    await expect(items.first().getByRole("button", { name: `Sesión actual: Admin #${current.sessionId}, no se puede revocar` })).toBeDisabled();

    await mobile.getByLabel("Estado").selectOption("active");
    await expect.poll(() => traffic.reads.some((params) => params.get("status") === "active" && params.get("offset") === "0")).toBe(true);
    await expect(mobile.getByRole("button", { name: "Actualizar" })).toBeEnabled();
    const next = page.waitForRequest(isSessionsPage2);
    await mobile.getByRole("navigation", { name: "Paginación de sesiones" }).getByRole("button", { name: "Siguiente" }).click();
    const limit = Number(new URL((await next).url()).searchParams.get("limit"));
    const target = LONG_SESSIONS[limit];
    const trigger = sessionTrigger(target);
    await expect(trigger).toBeVisible();
    await expect(mobile.getByRole("button", { name: "Actualizar" })).toBeEnabled();
    const longest = items.filter({ hasText: "Token particular" }).first().locator("button > span:last-child");
    expect(await longest.evaluate((element) => element.scrollWidth > element.clientWidth), `${viewport.name}: the mobile line truncates`).toBe(true);
    expect(await items.locator("[title]").count(), `${viewport.name}: no hover-only title`).toBe(0);
    const readsBefore = traffic.reads.length;

    // Touch-sized activation by tap, then Space by keyboard.
    await hydrated(trigger);
    const dialog = page.getByRole("dialog", { name: `Sesión ${SESSION_TYPE_LABEL[target.sessionType]} #${target.sessionId}`, exact: true });
    await expect(async () => {
      await trigger.click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await discloseSession(page, trigger, target, " ", `${viewport.name} page 2`);
    const ring = await trigger.evaluate((element) => {
      const button = element.getBoundingClientRect();
      const row = element.closest("article")!.getBoundingClientRect();
      const reach = parseFloat(getComputedStyle(element).outlineWidth) + parseFloat(getComputedStyle(element).outlineOffset);
      return button.top - reach >= row.top && button.bottom + reach <= row.bottom && button.left - reach >= row.left;
    });
    expect(ring, `${viewport.name}: the focus ring stays inside the clipped row`).toBe(true);

    expect(traffic.reads.length, `${viewport.name}: opening the detail fetches nothing`).toBe(readsBefore);
    expect(traffic.writes, `${viewport.name}: no revocation was sent`).toEqual([]);
    expect(traffic.confirms, `${viewport.name}: no revocation confirm was raised`).toBe(0);
    await expect(mobile.getByLabel("Estado")).toHaveValue("active");
    await expect(mobile.getByRole("navigation", { name: "Paginación de sesiones" }).getByText(/Pág\. 2 \/ \d+/)).toBeVisible();
    expect(await items.first().evaluate((item) => item.getBoundingClientRect().height), `${viewport.name}: the row pitch is unchanged`).toBe(pitch);
    expect(await documentOverflow(page)).toEqual({ x: 0, y: 0 });
    // G11-e: the visible identity line (badges included) is part of each name.
    expect((await new AxeBuilder({ page }).include('[data-admin-mobile-ops-module="sessions"]').analyze()).violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
  });
}

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
