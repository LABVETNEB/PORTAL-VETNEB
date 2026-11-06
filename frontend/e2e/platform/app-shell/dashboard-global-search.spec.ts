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
  ...SERIES,
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

  test("a record outside the first page opens directly and deep-links into its module", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const observed = await installSearchStub(page);
    await openWorkspace(page, "clinic");
    const input = await hydratedInput(page);

    await input.fill("serie");
    await page.locator('[data-global-search-see-all="true"]').click();
    const dialog = page.locator(DIALOG);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Buscar en VETNEB" })).toBeVisible();

    await dialog.locator('[data-global-search-more="report"]').click();
    await expect(dialog.locator('[data-global-search-kind-filter="report"]')).toHaveAttribute("aria-pressed", "true");
    await dialog.locator('[data-global-search-page="next"]').click();
    await expect.poll(() => observed.at(-1)?.params).toMatchObject({ kinds: "report", limit: "20", offset: "20" });
    await dialog.locator('[data-global-search-page="next"]').click();
    await expect.poll(() => observed.at(-1)?.params).toMatchObject({ offset: "40" });

    const target = dialog.locator('[data-global-search-result="report:9355"]');
    await expect(target).toContainText("Paciente Serie 56");
    await target.click();
    const record = dialog.locator('[data-global-search-record="report:9355"]');
    await expect(record).toBeVisible();
    await expect(record.getByRole("heading", { name: "Paciente Serie 56" })).toBeVisible();
    await expect(record.getByRole("button", { name: "Ver informe" })).toBeEnabled();
    await expect(record).toContainText("Histopatología");

    await record.locator('[data-global-search-open-module="true"]').click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard\/informes#report-9355$/, { timeout: 25_000 });
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
