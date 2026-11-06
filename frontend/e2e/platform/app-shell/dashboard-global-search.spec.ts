import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

import { DARK_GRAY_THEME_MODE, THEME_STORAGE_KEY } from "../../../src/lib/theme";
import { clearDashboardModuleMemory, suppressNextDevChrome } from "../../helpers/dashboard-geometry-matrix";
import { addAppCookies, sessionCookie } from "../../helpers/session";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL-SEARCH-2 · "Buscar en VETNEB" in real Chromium.
//
// The record search is a CLIENT component, so its GET /api/search and
// GET /api/admin/search are served here by `page.route` (the fixture API owns
// none of them). The stub reproduces the GLOBAL-SEARCH-1 contract instead of
// echoing canned payloads: the tenant is derived from the session cookie the
// browser sends, a clinicId that is not the session's own is answered 403
// before anything is read, report filters narrow to reports, `limit + 1`
// drives hasMore and offset pages one kind. Cross-tenant isolation itself is
// enforced and proven server-side against PostgreSQL by GLOBAL-SEARCH-1
// (`test/integration/app/global-search-postgres-isolation.fastify.test.ts`);
// this spec proves the UI asks only for its own tenant and renders only what
// the server returned. All records are synthetic.
// ─────────────────────────────────────────────────────────────────────────────

type Kind = "clinic" | "report" | "particular_token" | "tracking_case" | "clinic_user";

type Row = {
  readonly kind: Kind;
  readonly id: number;
  readonly clinicId: number;
  readonly title: string;
  readonly subtitle: string | null;
  readonly status: string | null;
  readonly studyType?: string;
  readonly date: string;
  readonly reportId?: number;
};

const CLINIC_A = { id: 77, name: "Clínica Sintética Norte" };
const CLINIC_B = { id: 78, name: "Clínica Sintética Sur" };
const CLINIC_KINDS: readonly Kind[] = ["report", "particular_token", "tracking_case"];
const ADMIN_KINDS: readonly Kind[] = ["clinic", "report", "particular_token", "tracking_case", "clinic_user"];

function day(offset: number): string {
  return new Date(Date.UTC(2026, 9, 30 - offset, 12)).toISOString();
}

const SERIES = Array.from({ length: 60 }, (_, index): Row => ({
  kind: "report",
  id: 9300 + index,
  clinicId: CLINIC_A.id,
  title: `Paciente Serie ${String(index + 1).padStart(2, "0")}`,
  subtitle: `serie-${index + 1}.pdf`,
  status: index % 2 === 0 ? "ready" : "delivered",
  studyType: index % 2 === 0 ? "citologia" : "histopatologia",
  date: day(index),
}));

const TOKEN_SERIES = Array.from({ length: 14 }, (_, index): Row => ({
  kind: "particular_token",
  id: 600 + index,
  clinicId: CLINIC_A.id,
  title: `Serie mascota ${index + 1}`,
  subtitle: "Tutor sintético",
  status: "active",
  date: day(index * 3 + 1),
}));

const TRACKING_SERIES = Array.from({ length: 9 }, (_, index): Row => ({
  kind: "tracking_case",
  id: 400 + index,
  clinicId: CLINIC_A.id,
  title: `Serie seguimiento ${index + 1}`,
  subtitle: `Seguimiento #${400 + index}`,
  status: "processing",
  date: day(index * 5 + 2),
}));

/** Clinic B rows of the same series: never visible to clinic A. */
const FOREIGN_SERIES = Array.from({ length: 5 }, (_, index): Row => ({
  kind: "report",
  id: 9500 + index,
  clinicId: CLINIC_B.id,
  title: `Paciente Serie ajena ${index + 1}`,
  subtitle: null,
  status: "ready",
  studyType: "citologia",
  date: day(index),
}));

/** Every «serie» record clinic A may read: the full «Todo» traversal. */
const CLINIC_A_SERIES_KEYS = [...SERIES, ...TOKEN_SERIES, ...TRACKING_SERIES].map((row) => `${row.kind}:${row.id}`).sort();

const ROWS: readonly Row[] = [
  { kind: "clinic", id: CLINIC_A.id, clinicId: CLINIC_A.id, title: "Clínica Sintética Norte", subtitle: "norte@example.test", status: null, date: day(400) },
  { kind: "clinic", id: CLINIC_B.id, clinicId: CLINIC_B.id, title: "Clínica Sintética Sur", subtitle: "sur@example.test", status: null, date: day(401) },
  { kind: "report", id: 9101, clinicId: CLINIC_A.id, title: "Luna Pérez", subtitle: "luna-perez.pdf", status: "ready", studyType: "citologia", date: day(2) },
  { kind: "report", id: 9102, clinicId: CLINIC_A.id, title: "Lunático Gómez", subtitle: "lunatico.pdf", status: "processing", studyType: "histopatologia", date: day(5) },
  { kind: "report", id: 9201, clinicId: CLINIC_B.id, title: "Luna Pérez", subtitle: "luna-perez-sur.pdf", status: "ready", studyType: "citologia", date: day(1) },
  { kind: "particular_token", id: 501, clinicId: CLINIC_A.id, title: "Luna", subtitle: "Pérez", status: "active", date: day(3), reportId: 9101 },
  { kind: "particular_token", id: 502, clinicId: CLINIC_B.id, title: "Luna", subtitle: "Pérez", status: "active", date: day(3) },
  { kind: "tracking_case", id: 301, clinicId: CLINIC_A.id, title: "Luna Pérez", subtitle: "Seguimiento #301", status: "evaluation", date: day(4), reportId: 9101 },
  { kind: "tracking_case", id: 302, clinicId: CLINIC_B.id, title: "Luna Pérez", subtitle: "Seguimiento #302", status: "evaluation", date: day(4) },
  { kind: "clinic_user", id: 801, clinicId: CLINIC_A.id, title: "luna.recepcion", subtitle: CLINIC_A.name, status: "clinic_staff", date: day(30) },
  // Present in the admin fixture datasets (A03), far beyond the queue's first page.
  { kind: "report", id: 7435, clinicId: CLINIC_B.id, title: "Paciente lejano", subtitle: null, status: "ready", date: day(90) },
  ...SERIES,
  ...TOKEN_SERIES,
  ...TRACKING_SERIES,
  ...FOREIGN_SERIES,
];

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function clinicName(clinicId: number): string {
  return clinicId === CLINIC_A.id ? CLINIC_A.name : CLINIC_B.name;
}

type Observed = { readonly surface: "clinic" | "admin"; readonly params: Record<string, string> };

type StubOptions = {
  /** Answers every request with this status (error-state cases). */
  readonly failWith?: number;
  /** Holds the answer of a given `q` until the returned promise settles. */
  readonly holdFor?: Readonly<Record<string, Promise<void>>>;
  /** Called once the held answer was fulfilled or rejected by the page. */
  readonly onReleased?: (q: string) => void;
};

async function installSearchStub(page: Page, options: StubOptions = {}): Promise<Observed[]> {
  const observed: Observed[] = [];
  const clinicCookie = sessionCookie("clinic", "populated");
  const adminCookie = sessionCookie("admin", "populated");

  await page.route(/\/api\/(admin\/)?search(\?|$)/, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" || !/^\/api\/(admin\/)?search$/.test(url.pathname)) {
      await route.fallback();
      return;
    }
    const surface = url.pathname.startsWith("/api/admin/") ? "admin" : "clinic";
    const params = Object.fromEntries(url.searchParams);
    observed.push({ surface, params });

    const cookies = (await request.allHeaders()).cookie ?? "";
    const sessionValue = surface === "admin" ? `${adminCookie.name}=${adminCookie.value}` : `${clinicCookie.name}=${clinicCookie.value}`;
    const respond = async (status: number, body: unknown) => {
      const hold = options.holdFor?.[params.q ?? ""];
      if (hold) await hold;
      try {
        await route.fulfill({
          status,
          contentType: "application/json",
          headers: { "cache-control": "no-store" },
          body: JSON.stringify(body),
        });
      } catch {
        // The page aborted a superseded request: that is the contract under test.
      }
      if (hold) options.onReleased?.(params.q ?? "");
    };

    if (!cookies.split(";").map((part) => part.trim()).includes(sessionValue)) {
      await respond(401, { success: false, error: "No autenticado" });
      return;
    }
    if (options.failWith) {
      await respond(options.failWith, { success: false, error: "Error interno" });
      return;
    }
    if (surface === "clinic" && params.clinicId !== undefined && params.clinicId !== String(CLINIC_A.id)) {
      await respond(403, { success: false, error: "No autorizado para consultar otra clinica" });
      return;
    }

    const allowed = surface === "admin" ? ADMIN_KINDS : CLINIC_KINDS;
    const reportFilters = Boolean(params.status || params.studyType || params.from || params.to);
    const requestedKinds = (params.kinds ? params.kinds.split(",") : allowed) as Kind[];
    if (requestedKinds.some((kind) => !allowed.includes(kind))) {
      await respond(400, { success: false, error: "Tipo de busqueda no permitido" });
      return;
    }
    const kinds = reportFilters ? (["report"] as Kind[]) : requestedKinds;
    const limit = Number(params.limit ?? 5);
    const offset = Number(params.offset ?? 0);
    // GLOBAL-SEARCH-1 rules: offset pages one kind, up to 500; limit 1..25.
    if ((offset > 0 && kinds.length !== 1) || offset > 500 || limit < 1 || limit > 25) {
      await respond(400, { success: false, error: "Paginación inválida" });
      return;
    }
    const needle = fold(params.q ?? "");
    const numeric = /^#?(\d{1,9})$/.exec(params.q ?? "");
    const tenant = surface === "clinic" ? CLINIC_A.id : params.clinicId ? Number(params.clinicId) : null;

    const hits: unknown[] = [];
    const groups: unknown[] = [];
    for (const kind of kinds) {
      const rows = ROWS.filter((row) => row.kind === kind)
        .filter((row) => tenant === null || row.clinicId === tenant)
        .filter((row) =>
          numeric ? row.id === Number(numeric[1]) : fold(`${row.title} ${row.subtitle ?? ""}`).includes(needle),
        )
        .filter((row) => !params.status || row.status === params.status)
        .filter((row) => !params.studyType || row.studyType === params.studyType)
        .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id);
      const window = rows.slice(offset, offset + limit + 1);
      const visible = window.slice(0, limit);
      groups.push({ kind, returned: visible.length, hasMore: window.length > limit });
      for (const row of visible) {
        hits.push({
          kind: row.kind,
          id: row.id,
          title: row.title,
          subtitle: row.subtitle,
          status: row.status,
          date: row.date,
          facts: row.studyType ? [{ label: "studyType", value: row.studyType }] : [],
          clinic: surface === "admin" ? { id: row.clinicId, name: clinicName(row.clinicId) } : null,
          target: {
            reportId: row.kind === "report" ? row.id : row.reportId ?? null,
            particularTokenId: row.kind === "particular_token" ? row.id : null,
            studyTrackingCaseId: row.kind === "tracking_case" ? row.id : null,
            clinicId: row.clinicId,
            clinicUserId: row.kind === "clinic_user" ? row.id : null,
          },
          rank: 3,
        });
      }
    }
    await respond(200, { success: true, query: params.q, hits, groups, limit, offset });
  });

  return observed;
}

const INPUT = '[data-workspace-app-bar-search-input="true"]';
const PANEL = '[data-workspace-app-bar-search-results="true"]';
const DIALOG = "[data-dashboard-global-search-dialog]";

async function openWorkspace(page: Page, role: "clinic" | "admin", options: { dark?: boolean } = {}) {
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: options.dark ? "dark" : "light" });
  if (options.dark) {
    await page.addInitScript(
      ([key, mode]) => {
        try {
          window.localStorage.setItem(key, mode);
        } catch {
          /* storage unavailable */
        }
      },
      [THEME_STORAGE_KEY, DARK_GRAY_THEME_MODE] as const,
    );
  }
  await addAppCookies(page, [sessionCookie(role, "populated")]);
  await page.goto(role === "admin" ? "/dashboard/admin?hub=1" : "/dashboard");
}

/** Typing before hydration is lost: wait until React owns the input. */
async function hydratedInput(page: Page) {
  const input = page.locator(INPUT).filter({ visible: true });
  await expect(input).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      () =>
        input.evaluate((node) => Object.keys(node).some((key) => key.startsWith("__reactProps"))),
      { timeout: 30_000 },
    )
    .toBe(true);
  return input;
}

async function documentScroll(page: Page) {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return {
      vertical: Math.max(0, root.scrollHeight - root.clientHeight),
      horizontal: Math.max(0, root.scrollWidth - root.clientWidth),
    };
  });
}

async function expectNoSeriousAxe(page: Page, include: string, label: string) {
  const result = await new AxeBuilder({ page })
    .include(include)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
  expect(blocking, label).toEqual([]);
}

test.describe("GLOBAL-SEARCH-2 · Buscar en VETNEB", () => {
  test.describe.configure({ timeout: 120_000 });

  test("clinic A finds its own records, never clinic B's, and never sends a tenant", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const observed = await installSearchStub(page);
    await openWorkspace(page, "clinic");
    const input = await hydratedInput(page);

    await expect(input).toHaveAttribute("placeholder", "Buscar en VETNEB");
    await input.fill("LUNA perez");

    const panel = page.locator(PANEL);
    await expect(panel.locator('[data-global-search-group="report"]')).toBeVisible();
    await expect(panel.locator('[data-global-search-hit="report:9101"]')).toContainText("Luna Pérez");
    await expect(panel.locator('[data-global-search-hit="tracking_case:301"]')).toBeVisible();
    for (const foreign of ["report:9201", "particular_token:502", "tracking_case:302"]) {
      await expect(panel.locator(`[data-global-search-hit="${foreign}"]`)).toHaveCount(0);
    }
    await expect(panel.locator('[data-global-search-group="clinic_user"]')).toHaveCount(0);

    expect(observed.length, "the server was really asked").toBeGreaterThan(0);
    expect(observed.every((entry) => entry.surface === "clinic")).toBe(true);
    expect(observed.some((entry) => "clinicId" in entry.params), "the clinic tenant is the session, never a parameter").toBe(false);
    expect(observed.at(-1)?.params).toMatchObject({ q: "LUNA perez", limit: "5" });
  });

  test("typing is debounced and a superseded answer never overwrites the latest one", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let releasedQuery: string | null = null;
    const observed = await installSearchStub(page, {
      holdFor: { lun: held },
      onReleased: (q) => {
        releasedQuery = q;
      },
    });
    await openWorkspace(page, "clinic");
    const input = await hydratedInput(page);

    // Fast typing reaches the server once, with the settled text.
    await input.pressSequentially("lun", { delay: 20 });
    await expect.poll(() => observed.map((entry) => entry.params.q)).toEqual(["lun"]);

    // "lun" is still unanswered when the user keeps typing.
    await input.pressSequentially("ático", { delay: 20 });
    const panel = page.locator(PANEL);
    await expect(panel.locator('[data-global-search-hit="report:9102"]')).toBeVisible();
    expect(observed.map((entry) => entry.params.q)).toEqual(["lun", "lunático"]);

    release();
    await expect.poll(() => releasedQuery).toBe("lun");
    await expect(panel.locator('[data-global-search-hit="report:9101"]'), "the late 'lun' answer was discarded").toHaveCount(0);
    await expect(panel.locator('[data-global-search-hit="report:9102"]')).toBeVisible();
  });

  test("a report pages past the first pages and opens in its module by id, even off the loaded page", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const observed = await installSearchStub(page);
    await openWorkspace(page, "clinic");
    const input = await hydratedInput(page);

    await input.fill("serie");
    await page.locator('[data-global-search-see-all="true"]').click();
    const dialog = page.locator(DIALOG);
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-global-search-kind-filter="report"]').click();
    const results = dialog.locator("[data-global-search-result]");
    await expect(results.first()).toBeVisible();
    const pageSize = Number(await dialog.locator("[data-global-search-results-region]").getAttribute("data-global-search-page-size"));
    expect(pageSize).toBeGreaterThan(1);

    // Walk forward until the target appears (series sorted by recency: 9355 is deep).
    const target = dialog.locator('[data-global-search-result="report:9355"]');
    for (let step = 0; step < 60 && (await target.count()) === 0; step += 1) {
      await dialog.locator('[data-global-search-page="next"]').click();
      await expect(dialog.locator("[data-global-search-page-number]")).toHaveAttribute(
        "data-global-search-page-number",
        String(step + 2),
      );
    }
    await expect(target).toContainText("Paciente Serie 56");
    const offsets = observed.filter((entry) => entry.params.kinds === "report").map((entry) => Number(entry.params.offset ?? 0));
    expect(offsets.every((offset) => offset % pageSize === 0), "each request starts at a page boundary").toBe(true);
    expect(Math.max(...offsets)).toBeGreaterThanOrEqual(pageSize * 2);

    await target.click();
    const record = dialog.locator('[data-global-search-record="report:9355"]');
    await expect(record.getByRole("heading", { name: "Paciente Serie 56" })).toBeVisible();
    await expect(record.getByRole("button", { name: "Ver informe" })).toBeEnabled();
    const open = record.locator('[data-global-search-open-module="true"]');
    await expect(open).toHaveAttribute("data-global-search-opens-record", "true");
    await open.click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard\/informes\?reportId=9355$/, { timeout: 25_000 });

    // The module resolves the id on the server (fixture GET /api/reports/9355),
    // although its first page does not hold it.
    const focused = page.locator('[data-informes-focused-report="9355"]').filter({ visible: true });
    await expect(focused).toBeVisible({ timeout: 25_000 });
    await expect(page.locator("#report-detail-heading").filter({ visible: true })).toHaveText("Paciente E2E 0955 · Informe #9355");
    await expect(page.locator("#report-9355"), "the report is not a row of the loaded page").toHaveCount(0);

    // Reload keeps the record open; Back and Forward move between the two places.
    await page.reload();
    await expect(page.locator('[data-informes-focused-report="9355"]').filter({ visible: true })).toBeVisible({ timeout: 25_000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard(\?|$)/, { timeout: 25_000 });
    await page.goForward();
    await expect(page).toHaveURL(/\/dashboard\/informes\?reportId=9355$/, { timeout: 25_000 });
    await expect(page.locator('[data-informes-focused-report="9355"]').filter({ visible: true })).toBeVisible({ timeout: 25_000 });
  });

  test("coming back to the search restores query, category, page and the open record", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await installSearchStub(page);
    await openWorkspace(page, "clinic");
    const input = await hydratedInput(page);

    await input.fill("serie");
    await page.locator('[data-global-search-see-all="true"]').click();
    const dialog = page.locator(DIALOG);
    await dialog.locator('[data-global-search-kind-filter="report"]').click();
    await expect(dialog.locator("[data-global-search-result]").first()).toBeVisible();
    await dialog.locator('[data-global-search-page="next"]').click();
    await expect(dialog.locator("[data-global-search-page-number]")).toHaveAttribute("data-global-search-page-number", "2");
    const chosen = dialog.locator("[data-global-search-result]").first();
    const chosenKey = await chosen.getAttribute("data-global-search-result");
    await chosen.click();
    await dialog.locator('[data-global-search-open-module="true"]').click();
    await expect(page).toHaveURL(/\/dashboard\/informes\?reportId=/, { timeout: 25_000 });

    const bar = await hydratedInput(page);
    await expect(bar, "the bar keeps the query").toHaveValue("serie");
    await bar.focus();
    await page.locator('[data-global-search-see-all="true"]').click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-global-search-kind-filter="report"]')).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.locator("[data-global-search-page-number]")).toHaveAttribute("data-global-search-page-number", "2");
    await expect(dialog.locator(`[data-global-search-record="${chosenKey}"]`)).toBeVisible();
  });

  test("a deep link to a missing or foreign report says so instead of opening another one", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openWorkspace(page, "clinic");
    await page.goto("/dashboard/informes?reportId=999999");
    await expect(page.locator('[data-informes-requested-report-unavailable="true"]').filter({ visible: true })).toContainText(
      "El informe #999999 no existe o no está disponible para esta clínica.",
      { timeout: 25_000 },
    );
    await expect(page.locator("[data-informes-focused-report]")).toHaveCount(0);
  });

  test("combined report filters reach the API and narrow to reports", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const observed = await installSearchStub(page);
    await openWorkspace(page, "clinic");
    const input = await hydratedInput(page);

    await input.fill("serie");
    await input.press("ArrowUp");
    await page.locator('[data-global-search-see-all="true"]').click();
    const dialog = page.locator(DIALOG);
    await dialog.locator('[data-global-search-filters-toggle="true"]').click();
    await dialog.locator('[data-global-search-filter="status"]').selectOption("ready");
    await dialog.locator('[data-global-search-filter="studyType"]').selectOption("citologia");
    await dialog.locator('[data-global-search-filter="from"]').fill("2026-09-01");

    await expect
      .poll(() => observed.at(-1)?.params)
      .toMatchObject({ q: "serie", kinds: "report", status: "ready", studyType: "citologia", from: "2026-09-01" });
    await expect(dialog.locator('[data-global-search-kind-filter="particular_token"]')).toBeDisabled();
    await expect(dialog.locator('[data-global-search-filters-toggle="true"]')).toHaveText("Filtros activos");
    await dialog.locator('[data-global-search-filters-apply="true"]').click();
    const results = dialog.locator("[data-global-search-result]");
    await expect(results.first()).toBeVisible();
    const keys = await results.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-global-search-result") ?? ""));
    expect(keys.every((key) => key.startsWith("report:"))).toBe(true);
    expect(keys.every((key) => Number(key.split(":")[1]) % 2 === 0), "only even (ready, citología) series rows").toBe(true);
  });

  test("empty and error states are explicit and the error can be retried", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await installSearchStub(page);
    await openWorkspace(page, "clinic");
    const input = await hydratedInput(page);

    await input.fill("zzzz");
    await expect(page.locator('[data-global-search-status="ready"]')).toContainText("Sin registros para «zzzz».");

    await page.unroute(/\/api\/(admin\/)?search(\?|$)/);
    await installSearchStub(page, { failWith: 500 });
    await input.fill("luna");
    const status = page.locator('[data-global-search-status="error"]');
    await expect(status).toContainText("No se pudo completar la búsqueda");
    await expect(page.locator(PANEL)).not.toContainText("Error interno");

    await page.unroute(/\/api\/(admin\/)?search(\?|$)/);
    await installSearchStub(page);
    await status.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.locator('[data-global-search-hit="report:9101"]')).toBeVisible();
  });

  test("admin finds every authorized entity and the clinic filter only narrows", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const observed = await installSearchStub(page);
    await openWorkspace(page, "admin");
    const input = await hydratedInput(page);

    await input.fill("luna");
    const panel = page.locator(PANEL);
    for (const kind of ["report", "particular_token", "tracking_case", "clinic_user"]) {
      await expect(panel.locator(`[data-global-search-group="${kind}"]`)).toBeVisible();
    }
    await expect(panel.locator('[data-global-search-hit="report:9201"]')).toContainText(CLINIC_B.name);
    expect(observed.at(-1)?.surface).toBe("admin");

    await input.fill("sintética");
    await expect(panel.locator('[data-global-search-hit="clinic:78"]')).toBeVisible();

    await input.fill("luna");
    await page.locator('[data-global-search-see-all="true"]').click();
    const dialog = page.locator(DIALOG);
    await dialog.locator('[data-global-search-filters-toggle="true"]').click();
    await dialog.locator('[data-global-search-filter="clinicId"]').fill("78");
    await expect.poll(() => observed.at(-1)?.params).toMatchObject({ q: "luna", clinicId: "78" });
    await dialog.locator('[data-global-search-filters-apply="true"]').click();
    await expect(dialog.locator('[data-global-search-result="report:9201"]')).toBeVisible();
    await expect(dialog.locator('[data-global-search-result="report:9101"]')).toHaveCount(0);

    await dialog.locator('[data-global-search-result="particular_token:502"]').click();
    const record = dialog.locator('[data-global-search-record="particular_token:502"]');
    await expect(record).toContainText(CLINIC_B.name);
    await record.locator('[data-global-search-open-module="true"]').click();
    await expect(page).toHaveURL(/\/dashboard\/admin\?module=admin-particular-tokens#admin-particular-token-502$/, {
      timeout: 25_000,
    });
  });

  test("keyboard only: arrows, Enter on a record, Escape restores focus; module shortcuts still work", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await installSearchStub(page);
    await openWorkspace(page, "clinic");
    const input = await hydratedInput(page);

    await input.focus();
    await input.pressSequentially("luna p");
    const hit = page.locator('[data-global-search-hit="report:9101"]');
    await expect(hit).toBeVisible();
    await expectNoSeriousAxe(page, '[data-workspace-app-bar-search="true"]', "suggestions, light");

    // No module matches "luna p", so the first option is the first record.
    await expect(hit).toHaveAttribute("aria-selected", "true");
    await expect(input).toHaveAttribute("aria-activedescendant", (await hit.getAttribute("id")) ?? "");
    await input.press("ArrowDown");
    await expect(hit).toHaveAttribute("aria-selected", "false");
    await input.press("ArrowUp");
    await input.press("Enter");

    const dialog = page.locator(DIALOG);
    await expect(dialog.locator('[data-global-search-record="report:9101"]')).toBeVisible();
    await expectNoSeriousAxe(page, DIALOG, "dialog, light");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(input, "focus returns to the search").toBeFocused();

    await input.fill("informes");
    await expect(page.locator('[data-workspace-app-bar-search-option="informes"]')).toBeVisible();
    await input.press("Enter");
    await expect(page).toHaveURL(/[?&]module=informes|\/dashboard\/informes/, { timeout: 25_000 });

    await page.keyboard.press("Control+k");
    await expect(page.locator(INPUT).filter({ visible: true })).toBeFocused();
  });

  test("dark theme keeps suggestions and dialog accessible, with zero document scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await installSearchStub(page);
    await openWorkspace(page, "admin", { dark: true });
    const input = await hydratedInput(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", DARK_GRAY_THEME_MODE);

    await input.fill("luna");
    await expect(page.locator('[data-global-search-hit="report:9101"]')).toBeVisible();
    await expectNoSeriousAxe(page, '[data-workspace-app-bar-search="true"]', "suggestions, dark");
    expect(await documentScroll(page)).toEqual({ vertical: 0, horizontal: 0 });

    await page.locator('[data-global-search-see-all="true"]').click();
    const dialog = page.locator(DIALOG);
    await dialog.locator('[data-global-search-result="report:9101"]').click();
    await expectNoSeriousAxe(page, DIALOG, "dialog, dark");
    expect(await documentScroll(page)).toEqual({ vertical: 0, horizontal: 0 });
  });

  test("«Todo» walks every authorized result across pages: no duplicates, no omissions, never clinic B", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const observed = await installSearchStub(page);
    await openWorkspace(page, "clinic");
    const input = await hydratedInput(page);
    await input.fill("serie");
    await page.locator('[data-global-search-see-all="true"]').click();
    const dialog = page.locator(DIALOG);
    await expect(dialog.locator('[data-global-search-kind-filter="all"]')).toHaveAttribute("aria-pressed", "true");
    const results = dialog.locator("[data-global-search-result]");
    await expect(results.first()).toBeVisible();
    const pageSize = Number(await dialog.locator("[data-global-search-results-region]").getAttribute("data-global-search-page-size"));
    const next = dialog.locator('[data-global-search-page="next"]');
    const previous = dialog.locator('[data-global-search-page="previous"]');
    await expect(previous, "first page: Anterior is disabled").toBeDisabled();

    const seen: string[] = [];
    const firstPage = await results.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-global-search-result") ?? ""));
    for (let pageNumber = 1; pageNumber < 100; pageNumber += 1) {
      await expect(dialog.locator("[data-global-search-page-number]")).toHaveAttribute("data-global-search-page-number", String(pageNumber));
      await expect(dialog.locator('[data-global-search-dialog-status="ready"]')).toHaveCount(1);
      const keys = await results.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-global-search-result") ?? ""));
      expect(keys.length, `page ${pageNumber} fits the measured capacity`).toBeLessThanOrEqual(pageSize);
      seen.push(...keys);
      if (await next.isDisabled()) break;
      expect(keys.length, `page ${pageNumber} is full while more pages exist`).toBe(pageSize);
      await next.click();
    }
    expect(new Set(seen).size, "no record appears twice").toBe(seen.length);
    expect([...seen].sort(), "every authorized record, and only those").toEqual(CLINIC_A_SERIES_KEYS);
    expect(seen.some((key) => key.startsWith("report:95")), "clinic B's series never appears").toBe(false);

    // Every request honoured the API: offset only with one kind.
    expect(observed.every((entry) => Number(entry.params.offset ?? 0) === 0 || !String(entry.params.kinds ?? "").includes(","))).toBe(true);

    // Anterior returns to cached pages without asking again.
    const requestsBefore = observed.length;
    for (let back = 0; back < 50 && !(await previous.isDisabled()); back += 1) await previous.click();
    await expect(dialog.locator("[data-global-search-page-number]")).toHaveAttribute("data-global-search-page-number", "1");
    await expect.poll(() => results.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-global-search-result") ?? ""))).toEqual(firstPage);
    expect(observed.length, "cached pages are not requested again").toBe(requestsBefore);

    // A new query starts again at page 1.
    await dialog.locator('[data-global-search-dialog-input="true"]').fill("lunático");
    await expect(dialog.locator("[data-global-search-page-number]")).toHaveAttribute("data-global-search-page-number", "1");
    await expect(dialog.locator('[data-global-search-result="report:9102"]')).toBeVisible();
  });

  test("every category pages on its own with the same pager", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await installSearchStub(page);
    await openWorkspace(page, "clinic");
    const input = await hydratedInput(page);
    await input.fill("serie");
    await page.locator('[data-global-search-see-all="true"]').click();
    const dialog = page.locator(DIALOG);
    const results = dialog.locator("[data-global-search-result]");
    for (const [kind, expected] of [
      ["report", SERIES.length],
      ["particular_token", TOKEN_SERIES.length],
      ["tracking_case", TRACKING_SERIES.length],
    ] as const) {
      await dialog.locator(`[data-global-search-kind-filter="${kind}"]`).click();
      await expect(dialog.locator("[data-global-search-page-number]")).toHaveAttribute("data-global-search-page-number", "1");
      await expect(results.first()).toBeVisible();
      const seen = new Set<string>();
      for (let step = 0; step < 50; step += 1) {
        await expect(dialog.locator('[data-global-search-dialog-status="ready"]')).toHaveCount(1);
        await expect(dialog.locator("[data-global-search-page-number]")).toHaveAttribute("data-global-search-page-number", String(step + 1));
        for (const key of await results.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-global-search-result") ?? ""))) {
          expect(key.startsWith(`${kind}:`)).toBe(true);
          seen.add(key);
        }
        const next = dialog.locator('[data-global-search-page="next"]');
        if (await next.isDisabled()) break;
        await next.click();
      }
      expect(seen.size, `${kind}: every record reached`).toBe(expected);
    }
  });

  test("admin opens a report of the queue by id although the loaded queue page does not hold it", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await installSearchStub(page);
    await openWorkspace(page, "admin");
    const input = await hydratedInput(page);
    await input.fill("lejano");
    await page.locator('[data-global-search-hit="report:7435"]').click();
    const dialog = page.locator(DIALOG);
    await dialog.locator('[data-global-search-open-module="true"]').click();
    await expect(page).toHaveURL(/\/dashboard\/admin\?module=admin-report-upload&reportId=7435$/, { timeout: 25_000 });
    const detail = page.locator('[data-module-dialog="true"]').filter({ hasText: "Informe #7435" });
    await expect(detail).toBeVisible({ timeout: 25_000 });
    await expect(detail).toContainText("Clínica Informe 36");

    await page.reload();
    await expect(page.locator('[data-module-dialog="true"]').filter({ hasText: "Informe #7435" })).toBeVisible({ timeout: 25_000 });

    await page.goto("/dashboard/admin?module=admin-report-upload&reportId=999999");
    await expect(page.getByText("El informe #999999 no existe o no está disponible.")).toBeVisible({ timeout: 25_000 });
  });

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 360, height: 740 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    test(`capacity ${viewport.width}x${viewport.height}: a full page fits, the pager stays visible, nothing scrolls`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await installSearchStub(page);
      await openWorkspace(page, "clinic");
      const dialog = page.locator(DIALOG);
      if (viewport.width < 768) {
        const trigger = page.getByRole("button", { name: "Menú de la clínica" });
        await expect(trigger).toBeVisible({ timeout: 30_000 });
        await expect
          .poll(() => trigger.evaluate((node) => Object.keys(node).some((key) => key.startsWith("__reactProps"))), { timeout: 30_000 })
          .toBe(true);
        await trigger.click();
        await page.locator('[data-dashboard-mobile-global-search="true"]').click();
        await dialog.locator('[data-global-search-dialog-input="true"]').fill("serie");
        await dialog.locator('[data-global-search-dialog-input="true"]').press("Enter");
      } else {
        const input = await hydratedInput(page);
        await input.fill("serie");
        await page.locator('[data-global-search-see-all="true"]').click();
      }
      const results = dialog.locator("[data-global-search-result]");
      await expect(results.first()).toBeVisible();

      const geometry = await dialog.evaluate((node) => {
        const region = node.querySelector<HTMLElement>("[data-global-search-results-region]")!;
        const pager = node.querySelector<HTMLElement>("[data-global-search-pager]")!;
        const next = node.querySelector<HTMLElement>('[data-global-search-page="next"]')!;
        const rows = [...node.querySelectorAll<HTMLElement>("[data-global-search-result]")];
        const filters = node.querySelector<HTMLElement>('[data-global-search-filters-toggle="true"]')!;
        const chips = [...node.querySelectorAll<HTMLElement>("[data-global-search-kind-filter]")];
        const lastChip = chips[chips.length - 1].getBoundingClientRect();
        const regionBox = region.getBoundingClientRect();
        const pagerBox = pager.getBoundingClientRect();
        const nextBox = next.getBoundingClientRect();
        const filtersBox = filters.getBoundingClientRect();
        return {
          pageSize: Number(region.dataset.globalSearchPageSize),
          rows: rows.length,
          regionOverflow: region.scrollHeight - region.clientHeight,
          lastRowBottom: rows.length ? Math.max(...rows.map((row) => row.getBoundingClientRect().bottom)) : 0,
          regionBottom: regionBox.bottom,
          freeBelowRows: regionBox.bottom - (rows.length ? Math.max(...rows.map((row) => row.getBoundingClientRect().bottom)) : regionBox.top),
          pagerTop: pagerBox.top,
          pagerBottom: pagerBox.bottom,
          nextHeight: nextBox.height,
          viewportHeight: window.innerHeight,
          dialogOverflowX: node.scrollWidth - node.clientWidth,
          overflowing: [...node.querySelectorAll<HTMLElement>("*")]
            .filter((element) => element.getBoundingClientRect().right > node.getBoundingClientRect().right + 0.5)
            .slice(0, 5)
            .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)} → ${Math.round(element.getBoundingClientRect().right)}`),
          visibleCounter: [...node.querySelectorAll("p,span")].some(
            (element) => /resultados en \d+ categor/.test(element.textContent ?? "") && !element.closest(".sr-only") && !element.classList.contains("sr-only"),
          ),
          // Hit-test: nothing of the shell chrome paints over the dialog's controls.
          obscured: [
            ["title", node.querySelector<HTMLElement>("h2")],
            ["close", node.querySelector<HTMLElement>('[aria-label="Cerrar búsqueda"]')],
            ["next", next],
            ["previous", node.querySelector<HTMLElement>('[data-global-search-page="previous"]')],
            ["last row", rows[rows.length - 1] ?? null],
          ]
            .filter(([, element]) => {
              if (!(element instanceof HTMLElement)) return true;
              // A disabled button takes no pointer input by design (pointer-events: none).
              if (element.matches(":disabled")) return false;
              const box = element.getBoundingClientRect();
              const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
              return !hit || !element.contains(hit);
            })
            .map(([label]) => label),
          filtersRightAfterLastChip:
            Math.abs(filtersBox.top - lastChip.top) < 2 ? filtersBox.left - lastChip.right : filtersBox.left,
        };
      });
      testInfo.annotations.push({ type: "geometry", description: JSON.stringify({ viewport, ...geometry }) });
      await page.screenshot({ path: testInfo.outputPath(`global-search-${viewport.width}x${viewport.height}.png`) });

      expect(geometry.rows, "the page holds exactly the measured capacity").toBe(geometry.pageSize);
      expect(geometry.regionOverflow, "the results list never scrolls").toBeLessThanOrEqual(0);
      expect(geometry.lastRowBottom).toBeLessThanOrEqual(geometry.regionBottom + 0.5);
      expect(geometry.freeBelowRows, "no room left for one more row").toBeLessThan(52);
      expect(geometry.pagerBottom, "the pager is inside the viewport").toBeLessThanOrEqual(geometry.viewportHeight + 0.5);
      expect(geometry.nextHeight, "touch target").toBeGreaterThanOrEqual(44);
      expect(geometry.obscured, "title, close, pager and rows are on top and tappable").toEqual([]);
      expect(geometry.dialogOverflowX, `no horizontal overflow: ${geometry.overflowing.join(" | ")}`).toBeLessThanOrEqual(0);
      expect(geometry.visibleCounter, "the visual counter is gone").toBe(false);
      expect(geometry.filtersRightAfterLastChip, "Filtros follows the last category in the same flow").toBeLessThanOrEqual(12);
      expect(await documentScroll(page)).toEqual({ vertical: 0, horizontal: 0 });

      // Opening the filters keeps the list state and still never scrolls the document.
      await dialog.locator('[data-global-search-filters-toggle="true"]').click();
      await expect(dialog.locator('[data-global-search-filters-panel="true"]')).toBeVisible();
      await dialog.locator('[data-global-search-filters-apply="true"]').click();
      await expect(results.first()).toBeVisible();
      expect(await documentScroll(page)).toEqual({ vertical: 0, horizontal: 0 });
    });
  }

  for (const viewport of [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
  ]) {
    test(`mobile ${viewport.width}x${viewport.height}: the overflow menu opens a full-screen search`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await installSearchStub(page);
      await openWorkspace(page, "clinic");

      const trigger = page.getByRole("button", { name: "Menú de la clínica" });
      await expect(trigger).toBeVisible({ timeout: 30_000 });
      await expect
        .poll(() => trigger.evaluate((node) => Object.keys(node).some((key) => key.startsWith("__reactProps"))), {
          timeout: 30_000,
        })
        .toBe(true);
      await trigger.click();
      await page.locator('[data-dashboard-mobile-global-search="true"]').click();

      const dialog = page.locator(DIALOG);
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box?.width).toBe(viewport.width);
      expect(box?.height).toBe(viewport.height);

      const field = dialog.locator('[data-global-search-dialog-input="true"]');
      await expect(field).toBeFocused();
      await field.fill("luna");
      const result = dialog.locator('[data-global-search-result="report:9101"]');
      await expect(result).toBeVisible();
      await result.click();
      const record = dialog.locator('[data-global-search-record="report:9101"]');
      await expect(record).toBeVisible();
      await expect(result, "single pane: the list yields to the record").toBeHidden();
      await expectNoSeriousAxe(page, DIALOG, `mobile ${viewport.width}`);
      await record.getByRole("button", { name: "Volver a resultados" }).click();
      await expect(result).toBeVisible();

      const overflow = await dialog.evaluate((node) => node.scrollWidth - node.clientWidth);
      expect(overflow, "no horizontal overflow inside the dialog").toBeLessThanOrEqual(0);
      expect(await documentScroll(page)).toEqual({ vertical: 0, horizontal: 0 });
    });
  }
});
