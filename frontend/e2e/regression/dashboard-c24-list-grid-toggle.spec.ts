import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { A03_ADMIN_SESSION_COOKIE, A03_ADAPTIVE_DATASET_COOKIE } from "../helpers/dashboard-adaptive-limit-matrix";
import { DASHBOARD_GEOMETRY_VIEWPORTS } from "../helpers/dashboard-geometry-matrix";
import { settleInformesRows, trackInformesWindowRequests } from "../helpers/informes-adaptive-settle";
import { applyColorMode } from "../helpers/admin-mobile-contracts";
import { addAppCookies, setAdminSession, setClinicSession } from "../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../helpers/zero-scroll-contract";

// C24 · list/grid alternation where it adds value: Informes clínica (full
// route), Informes admin and Clínicas admin. The grid is a second presentation
// of the SAME page on the SAME measured canvas: switching never requests,
// never moves limit/offset, and keeps filters, order and selection. Below
// 768px the list is the only view; the preference lives in memory.

const LIST = "Vista de lista";
const GRID = "Vista de cuadrícula";
const REPORTS = '[data-dashboard-module-workspace="admin-report-upload"]';
const REPORTS_CANVAS = `${REPORTS} [data-dashboard-canvas-reserve="table-head-dense"]`;
const CLINICS = "#admin-clinics";
const CLINICS_CANVAS = `${CLINICS} [data-dashboard-canvas-reserve="table-head-dense"]`;

async function expectNoDocumentScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.vertical, `${label}: vertical document scroll`).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
  expect(overflow.horizontal, `${label}: horizontal document scroll`).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
}

async function expectHydrated(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactFiber$"))), { timeout: 15_000 })
    .toBe(true);
}

async function expectNoSeriousAxe(page: Page, include: string) {
  const { violations } = await new AxeBuilder({ page }).include(include).analyze();
  expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => violation.id)).toEqual([]);
}

async function expectPressed(toggle: Locator, view: "list" | "grid") {
  await expect(toggle.getByRole("button", { name: LIST })).toHaveAttribute("aria-pressed", String(view === "list"));
  await expect(toggle.getByRole("button", { name: GRID })).toHaveAttribute("aria-pressed", String(view === "grid"));
}

/** Columns of the grid and every card inside the measured canvas, with no inner horizontal overflow. */
async function gridGeometry(canvas: Locator) {
  return canvas.evaluate((element) => {
    const grid = element.querySelector<HTMLElement>('[data-content-grid="true"]');
    const box = element.getBoundingClientRect();
    const cards = [...element.querySelectorAll<HTMLElement>('[data-content-grid-item="true"]')];
    return {
      columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0,
      innerWidth: grid ? grid.clientWidth - parseFloat(getComputedStyle(grid).paddingLeft) - parseFloat(getComputedStyle(grid).paddingRight) : 0,
      gap: grid ? parseFloat(getComputedStyle(grid).columnGap) : 0,
      radius: cards[0] ? parseFloat(getComputedStyle(cards[0]).borderTopLeftRadius) : 0,
      rows: grid ? getComputedStyle(grid).gridTemplateRows.split(" ").length : 0,
      rowsSum: grid ? getComputedStyle(grid).gridTemplateRows.split(" ").reduce((sum, track) => sum + (parseFloat(track) || 0), 0) : 0,
      padY: grid ? parseFloat(getComputedStyle(grid).paddingTop) + parseFloat(getComputedStyle(grid).paddingBottom) : 0,
      clientH: grid ? grid.clientHeight : 0,
      truncated: cards.filter((card) => [...card.querySelectorAll<HTMLElement>("*")].some((child) => child.scrollWidth > child.clientWidth + 1 && getComputedStyle(child).overflow !== "visible")).length,
      minCardWidth: cards.length ? Math.min(...cards.map((card) => card.getBoundingClientRect().width)) : 0,
      clipped: cards.filter((card) => {
        const bottom = card.getBoundingClientRect().bottom;
        return card.scrollHeight > card.clientHeight + 1 || [...card.querySelectorAll<HTMLElement>("*")].some((child) => child.getBoundingClientRect().height > 0 && child.getBoundingClientRect().bottom > bottom + 0.5);
      }).length,
      // F0-D9(B): a tile is as tall as its own content; one stretched past it by the track is a defect.
      stretched: cards.filter((card) => {
        const painted = card.getBoundingClientRect().height;
        const previous = card.style.alignSelf;
        card.style.alignSelf = "start";
        const content = card.getBoundingClientRect().height;
        card.style.alignSelf = previous;
        return painted > content + 0.5;
      }).length,
      cards: cards.length,
      escaping: cards.filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5 || rect.left < box.left - 0.5 || rect.right > box.right + 0.5;
      }).length,
      innerOverflowX: cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length,
      canvasHeight: Math.round(box.height * 10) / 10,
    };
  });
}

// V5 · Clínicas admin lays its tiles out by the width its grid really has: the Drive fit
// floor((w + 16) / 236), never below the C24 floor of 3 columns.
const CLINICS_GRID_FLOOR = 3;
const clinicsGridColumns = (innerWidth: number) => Math.max(CLINICS_GRID_FLOOR, Math.floor((innerWidth + 16) / 236));
const gridInnerWidth = async (canvas: Locator) => (await gridGeometry(canvas)).innerWidth;

// V5 · the Drive tile geometry is viable only where the container fits the floor's tracks of the
// measured `minTrack` AND the (auto) rows still fit the canvas at a 16 px gap; elsewhere the frozen
// geometry stays (explicit fallback). Columns are max(floor, fit) at the same measured track.
type MeasuredGrid = Awaited<ReturnType<typeof gridGeometry>>;
const expectedLayout = (grid: MeasuredGrid, floor: number, minTrack: number, driveTrack: number = minTrack) => {
  const fit = Math.floor((grid.innerWidth + 16) / (minTrack + 16));
  const driveFit = Math.floor((grid.innerWidth + 16) / (driveTrack + 16));
  const needed = grid.rowsSum + 16 * Math.max(0, grid.rows - 1) + grid.padY;
  const drive = driveFit >= floor && needed <= grid.clientH + 0.5;
  return { columns: Math.max(floor, fit), drive, gap: drive ? 16 : 8, radius: drive ? 12 : 8 };
};

const ids = (locator: Locator, attribute: string, pattern: RegExp) =>
  locator.evaluateAll((elements, [name, source]) => elements.map((element) => Number(new RegExp(source).exec(element.getAttribute(name) ?? element.textContent ?? "")?.[1] ?? Number.NaN)), [attribute, pattern.source] as const);

test.describe("C24 · Informes clínica (full route)", () => {
  test("list → grid → list keeps the page, the window, the selection and the pager", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setClinicSession(page, "populated");
    const requests = trackInformesWindowRequests(page);
    await page.goto("/dashboard/informes");
    const count = await settleInformesRows(page, requests, "list", 15_000);
    const canvas = page.locator('[data-informes-rows-canvas="true"]');
    const items = page.locator("#reports-master-list [id^='report-']");
    const toggle = page.getByRole("group", { name: "Vista de informes" });
    await expect(toggle).toBeVisible();
    await expectHydrated(toggle);
    await expectPressed(toggle, "list");

    const listIds = await ids(items, "id", /report-(\d+)/);
    const listGeometry = await gridGeometry(canvas);
    const startedBefore = requests.started();
    await items.nth(1).click();
    const selectedId = listIds[1];
    await expect(page.locator("#report-detail h2#report-detail-heading")).toContainText(`Informe #${selectedId}`);

    await toggle.getByRole("button", { name: GRID }).click();
    await expectPressed(toggle, "grid");
    await expect(canvas.locator('[data-informes-grid="true"]')).toBeVisible();
    await expect(canvas.locator('[data-dashboard-adaptive-row="true"]')).toHaveCount(0);
    expect(await ids(items, "id", /report-(\d+)/), "same page, same order").toEqual(listIds);
    const grid = await gridGeometry(canvas);
    expect(grid).toMatchObject({ columns: 2, cards: count, escaping: 0, innerOverflowX: 0, canvasHeight: listGeometry.canvasHeight });
    expect(requests.started(), "switching the view never requests").toBe(startedBefore);
    await expect(page.locator(`#report-${selectedId}`)).toHaveAttribute("aria-current", "true");
    await expect(page.locator("#report-detail h2#report-detail-heading")).toContainText(`Informe #${selectedId}`);

    // Keyboard: a card is a native button and activates with Enter.
    await page.locator(`#report-${listIds[0]}`).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`#report-${listIds[0]}`)).toHaveAttribute("aria-current", "true");
    await expectNoDocumentScroll(page, "informes grid");
    await expectNoSeriousAxe(page, "main.dashboard-main");

    const pager = page.getByRole("navigation", { name: "Paginación de informes" });
    const state = pager.locator(".dashboard-pagination-context");
    await pager.getByRole("button", { name: "Página siguiente" }).click();
    await expect(state).toContainText("Pág. 2 /");
    const secondCount = await settleInformesRows(page, requests, "grid page 2", 15_000);
    const secondIds = await ids(items, "id", /report-(\d+)/);
    expect(secondIds.filter((id) => listIds.includes(id)), "no record repeated across pages").toEqual([]);
    expect(secondCount).toBeLessThanOrEqual(count);
    await expect(canvas.locator('[data-informes-grid="true"]')).toBeVisible();

    await toggle.getByRole("button", { name: LIST }).click();
    await expectPressed(toggle, "list");
    await expect(canvas.locator('[data-informes-grid="true"]')).toHaveCount(0);
    expect(await ids(items, "id", /report-(\d+)/), "the list shows the grid's page").toEqual(secondIds);
    await expect(state).toContainText("Pág. 2 /");
  });

  test("the empty result and the load failure keep the C03 states without a toggle", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setClinicSession(page, "populated");
    await page.goto("/dashboard/informes?query=zz-c24-sin-coincidencias");
    await expect(page.locator('[data-collection-state="empty"]')).toContainText("No hay informes disponibles.");
    await expect(page.getByRole("group", { name: "Vista de informes" })).toHaveCount(0);

    await setClinicSession(page, "default");
    await page.goto("/dashboard/informes");
    await expect(page.locator('[data-collection-state="error"]')).toContainText("No se pudieron cargar los informes. Intente nuevamente.");
    await expect(page.getByRole("group", { name: "Vista de informes" })).toHaveCount(0);
    await expectNoDocumentScroll(page, "informes states");
  });
});

test.describe("C24 · Informes admin", () => {
  test.beforeEach(async ({ page }) => {
    await addAppCookies(page, [A03_ADMIN_SESSION_COOKIE, A03_ADAPTIVE_DATASET_COOKIE]);
  });

  test("the grid keeps the server window, filters, page selection, actions and the pager", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const requests: Array<{ limit: number; offset: number }> = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/admin/report-workflow") requests.push({ limit: Number(url.searchParams.get("limit")), offset: Number(url.searchParams.get("offset")) });
    });
    await page.goto("/dashboard/admin?module=admin-report-upload");
    const reports = page.locator(REPORTS);
    const canvas = page.locator(REPORTS_CANVAS);
    const itemBoxes = canvas.locator('[data-collection-selection="item"]');
    await expect(canvas.locator("tbody tr")).toHaveCount(11);
    const window = requests.at(-1);
    expect(window).toEqual({ limit: 11, offset: 0 });
    const toggle = reports.getByRole("group", { name: "Vista de informes" });
    await expectHydrated(toggle);
    await expectPressed(toggle, "list");
    const listIds = await ids(itemBoxes, "aria-label", /#(\d+)/);
    const requestCount = requests.length;

    await toggle.getByRole("button", { name: GRID }).click();
    await expectPressed(toggle, "grid");
    await expect(canvas.locator('[data-content-grid-item="true"]')).toHaveCount(11);
    expect(await ids(itemBoxes, "aria-label", /#(\d+)/), "same page, same order").toEqual(listIds);
    expect(await gridGeometry(canvas)).toMatchObject({ columns: 3, cards: 11, escaping: 0, innerOverflowX: 0 });
    const head = await canvas.evaluate((element) => ({
      reserved: parseFloat(getComputedStyle(element).getPropertyValue("--dash-canvas-reserved")),
      head: element.querySelector('[data-collection-grid-head="true"]')!.getBoundingClientRect().height,
    }));
    expect(Math.abs(head.head - head.reserved), "the grid head paints exactly the A03 reserve").toBeLessThanOrEqual(0.5);
    expect(requests.length, "switching the view never requests").toBe(requestCount);
    // xl (1366 ≥ 1280): the list shows Fecha, Archivo and the action menu, so the card does too.
    const firstCard = canvas.locator('[data-content-grid-item="true"]').first();
    await expect(firstCard.getByRole("button", { name: /Acciones del informe/ })).toBeVisible();

    await canvas.getByRole("checkbox", { name: "Seleccionar página de informes" }).check();
    await expect(reports.locator('[data-selection-count="true"]')).toContainText("11 seleccionados");
    await toggle.getByRole("button", { name: LIST }).click();
    await expect(reports.locator('[data-selection-count="true"]'), "selection survives the switch").toContainText("11 seleccionados");
    await expect(canvas.getByRole("checkbox", { name: "Seleccionar página de informes" })).toBeChecked();
    await reports.getByRole("button", { name: "Limpiar selección" }).click();
    await toggle.getByRole("button", { name: GRID }).click();

    const search = reports.getByRole("searchbox", { name: "Buscar informe" });
    await search.fill(`#${listIds[0]}`);
    await reports.getByRole("button", { name: "Aplicar" }).click();
    await expect(canvas.locator('[data-content-grid-item="true"]')).toHaveCount(1);
    expect(requests.at(-1), "client filters keep the window").toEqual({ limit: 11, offset: 0 });
    await toggle.getByRole("button", { name: LIST }).click();
    await expect(canvas.locator("tbody tr"), "the applied filter survives the switch").toHaveCount(1);
    await reports.getByRole("button", { name: "Limpiar", exact: true }).click();
    await toggle.getByRole("button", { name: GRID }).click();
    await expect(canvas.locator('[data-content-grid-item="true"]')).toHaveCount(11);

    const ver = firstCard.getByRole("button", { name: "Ver", exact: true });
    await ver.click();
    const dialog = page.getByRole("dialog", { name: /Informe #/ });
    await expect(dialog.locator('[data-details-pane="true"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(ver).toBeFocused();

    await page.getByRole("navigation", { name: "Paginación de informes admin" }).getByRole("button", { name: /siguiente/i }).click();
    await expect.poll(() => requests.at(-1)).toEqual({ limit: 11, offset: 11 });
    await expect(canvas.locator('[data-content-grid="true"]')).toBeVisible();
    // The request is emitted before its page paints: wait for the rendered page, then compare.
    await expect.poll(async () => (await ids(itemBoxes, "aria-label", /#(\d+)/))[0]).not.toBe(listIds[0]);
    const pageTwo = await ids(itemBoxes, "aria-label", /#(\d+)/);
    expect(pageTwo.filter((id) => listIds.includes(id)), "no record repeated across pages").toEqual([]);
    await expectNoDocumentScroll(page, "admin reports grid");
    await expectNoSeriousAxe(page, REPORTS);
  });

  test("at lg the card hides Archivo and the action menu exactly like the list", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/dashboard/admin?module=admin-report-upload");
    const canvas = page.locator(REPORTS_CANVAS);
    await expect(canvas.locator("tbody tr").first()).toBeVisible();
    const toggle = page.locator(REPORTS).getByRole("group", { name: "Vista de informes" });
    await expectHydrated(toggle);
    const listVisibility = await canvas.evaluate((element) => ({
      fecha: [...element.querySelectorAll("thead th")].some((th) => th.textContent === "Fecha" && getComputedStyle(th).display !== "none"),
      archivo: [...element.querySelectorAll("thead th")].some((th) => th.textContent === "Archivo" && getComputedStyle(th).display !== "none"),
    }));
    await toggle.getByRole("button", { name: GRID }).click();
    const card = canvas.locator('[data-content-grid-item="true"]').first();
    await expect(card).toBeVisible();
    const cardVisibility = await card.evaluate((element) => {
      const spans = [...element.querySelectorAll("p > span")] as HTMLElement[];
      return { fecha: getComputedStyle(spans[0]).display !== "none", archivo: getComputedStyle(spans[1]).display !== "none" };
    });
    expect(cardVisibility).toEqual(listVisibility);
    await expect(card.getByRole("button", { name: /Acciones del informe/ })).toBeHidden();
    expect(await gridGeometry(canvas)).toMatchObject({ columns: 3, escaping: 0, innerOverflowX: 0 });
  });
});

// Same server contract as the C04 spec (filter, global order with id tie-break, slice).
const NAMES = ["Zorzal", "Alba", "Mirlo", "Ceibo", "Benteveo", "Tala", "Hornero", "Quebracho", "Jacaranda"] as const;
const STUB_CLINICS = Array.from({ length: 30 }, (_, index) => {
  const clinicId = index + 1;
  const createdAt = new Date(Date.UTC(2026, 0, 1 + ((clinicId * 5) % 11), 9, 0, 0)).toISOString();
  return {
    clinicId,
    clinicName: `${NAMES[(clinicId * 4) % NAMES.length]} ${String.fromCharCode(65 + (clinicId % 3))}`,
    contactEmail: `clinica${clinicId}@centro.example.test`,
    contactPhone: null,
    createdAt,
    updatedAt: new Date(Date.UTC(2026, 5, 1 + ((clinicId * 7) % 13), 8, 0, 0)).toISOString(),
    users: [{ userType: "clinic" as const, userId: 500 + clinicId, username: `owner-${clinicId}`, role: "clinic_owner" as const, clinicId, clinicName: "", createdAt, updatedAt: createdAt }],
  };
});
type ClinicsRequest = { limit: number; offset: number; search: string | null; sort: string | null; direction: string | null };

function clinicsPage(request: ClinicsRequest) {
  const term = request.search?.toLowerCase() ?? "";
  const matched = STUB_CLINICS.filter((clinic) => !term || clinic.clinicName.toLowerCase().includes(term) || clinic.contactEmail.includes(term) || clinic.users[0].username.includes(term));
  const key = request.sort === "createdAt" ? "createdAt" : "clinicName";
  const sign = request.direction === "desc" ? -1 : 1;
  const ordered = [...matched].sort((a, b) => sign * ((a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) || a.clinicId - b.clinicId));
  return { total: ordered.length, clinics: ordered.slice(request.offset, request.offset + request.limit) };
}

async function openClinics(page: Page): Promise<ClinicsRequest[]> {
  const requests: ClinicsRequest[] = [];
  await setAdminSession(page, "default");
  await page.route((url) => url.pathname === "/api/admin/clinics", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    const params = new URL(route.request().url()).searchParams;
    const request: ClinicsRequest = {
      limit: Number(params.get("limit") ?? "50"),
      offset: Number(params.get("offset") ?? "0"),
      search: params.get("search"),
      sort: params.get("sort"),
      direction: params.get("direction"),
    };
    requests.push(request);
    const { total, clinics } = clinicsPage(request);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, clinics, total, limit: request.limit, offset: request.offset }) });
  });
  await page.goto("/dashboard/admin?module=admin-clinics");
  await expect(page.locator(CLINICS)).toBeVisible({ timeout: 10_000 });
  return requests;
}

const shownClinicIds = (page: Page, view: "list" | "grid") =>
  ids(page.locator(view === "list" ? `${CLINICS_CANVAS} tbody tr td:first-child` : `${CLINICS_CANVAS} [data-content-grid-item="true"]`), "data-none", /#(\d+)/);

async function expectClinicsPage(page: Page, requests: ClinicsRequest[], view: "list" | "grid") {
  await expect.poll(async () => {
    const last = requests.at(-1);
    if (!last) return "no request";
    const shown = await shownClinicIds(page, view);
    const expected = clinicsPage(last).clinics.map((clinic) => clinic.clinicId);
    return JSON.stringify(shown) === JSON.stringify(expected) && shown.length > 0 ? "settled" : JSON.stringify({ last, shown });
  }, { timeout: 10_000 }).toBe("settled");
  return requests.at(-1)!;
}

test.describe("C24 · Clínicas admin", () => {
  test("the grid keeps the C04 order, the search, the per-clinic action and the pager", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const requests = await openClinics(page);
    const first = await expectClinicsPage(page, requests, "list");
    const toggle = page.locator(CLINICS).getByRole("group", { name: "Vista de clínicas" });
    await expectHydrated(toggle);
    await expectPressed(toggle, "list");
    const count = requests.length;

    await toggle.getByRole("button", { name: GRID }).click();
    await expectPressed(toggle, "grid");
    await expectClinicsPage(page, requests, "grid");
    expect(requests.length, "switching the view never requests").toBe(count);
    const canvas = page.locator(CLINICS_CANVAS);
    expect(await gridGeometry(canvas)).toMatchObject({ columns: clinicsGridColumns(await gridInnerWidth(canvas)), cards: first.limit, escaping: 0, innerOverflowX: 0, clipped: 0, stretched: 0 });

    const sortStrip = canvas.getByRole("group", { name: "Ordenar clínicas" });
    await sortStrip.getByRole("button", { name: /^Clínica/ }).click();
    const sorted = await expectClinicsPage(page, requests, "grid");
    expect(sorted).toMatchObject({ sort: "name", direction: "asc", offset: 0, limit: first.limit });
    await expect(sortStrip.getByRole("button", { name: /^Clínica/ })).toHaveAccessibleName(/orden ascendente/);
    await sortStrip.getByRole("button", { name: /^Clínica/ }).click();
    expect(await expectClinicsPage(page, requests, "grid")).toMatchObject({ sort: "name", direction: "desc" });

    await toggle.getByRole("button", { name: LIST }).click();
    await expect(page.locator(`${CLINICS} thead th`).filter({ hasText: /^Clínica$/i }), "the order survives the switch").toHaveAttribute("aria-sort", "descending");
    await expectClinicsPage(page, requests, "list");
    await toggle.getByRole("button", { name: GRID }).click();

    await page.locator(CLINICS).getByRole("textbox", { name: "Buscar clínicas" }).fill("owner-1");
    // The search is debounced: settle against the request that carries it, not the previous page.
    await expect.poll(() => requests.at(-1)?.search ?? null).toBe("owner-1");
    const searched = await expectClinicsPage(page, requests, "grid");
    expect(searched).toMatchObject({ search: "owner-1", sort: "name", direction: "desc" });
    const beforeSwitch = requests.length;
    await toggle.getByRole("button", { name: LIST }).click();
    await expectClinicsPage(page, requests, "list");
    expect(requests.length, "the search survives the switch without a request").toBe(beforeSwitch);
    await page.locator(CLINICS).getByRole("textbox", { name: "Buscar clínicas" }).fill("");
    await expectClinicsPage(page, requests, "list");
    await toggle.getByRole("button", { name: GRID }).click();

    const card = canvas.locator('[data-content-grid-item="true"]').first();
    const edit = card.getByRole("button", { name: /^Editar clínica / });
    await edit.click();
    await expect(page.getByRole("dialog", { name: "Editar clínica" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Editar clínica" })).toHaveCount(0);

    await page.getByRole("navigation", { name: "Paginación de clínicas" }).getByRole("button", { name: "Página siguiente" }).click();
    const second = await expectClinicsPage(page, requests, "grid");
    expect(second.offset).toBe(first.limit);
    await expectNoDocumentScroll(page, "clinics grid");
    await expectNoSeriousAxe(page, CLINICS);
  });
});

test.describe("V5 · Clínicas admin grid follows its container", () => {
  const WIDTHS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1279, height: 720 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 834, height: 1194 },
    { width: 768, height: 1024 },
  ] as const;

  for (const theme of ["light", "dark"] as const) {
    test(`columns, tile geometry and capacity at ${WIDTHS.length} widths (${theme})`, async ({ page }) => {
      test.setTimeout(240_000);
      await applyColorMode(page, theme);
      for (const viewport of WIDTHS) {
        const label = `${viewport.width}x${viewport.height}`;
        await page.goto("about:blank");
        await page.setViewportSize(viewport);
        const requests = await openClinics(page);
        const first = await expectClinicsPage(page, requests, "list");
        const canvas = page.locator(CLINICS_CANVAS);
        const toggle = page.locator(CLINICS).getByRole("group", { name: "Vista de clínicas" });
        await expectHydrated(toggle);
        const before = requests.length;
        await toggle.getByRole("button", { name: GRID }).click();
        await expectClinicsPage(page, requests, "grid");
        expect(requests.length, `${label}: switching never requests`).toBe(before);
        // The first grid commit reads its width in a layout effect: wait for the settled geometry.
        let grid = await gridGeometry(canvas);
        await expect.poll(async () => {
          grid = await gridGeometry(canvas);
          return grid.columns === clinicsGridColumns(grid.innerWidth) && grid.gap === expectedLayout(grid, CLINICS_GRID_FLOOR, 220).gap;
        }, { message: `${label}: settled grid` }).toBe(true);
        const { drive } = expectedLayout(grid, CLINICS_GRID_FLOOR, 220);
        expect(grid, label).toMatchObject({
          columns: clinicsGridColumns(grid.innerWidth),
          cards: first.limit,
          escaping: 0,
          innerOverflowX: 0,
          clipped: 0, stretched: 0,
          gap: drive ? 16 : 8,
          radius: drive ? 12 : 8,
        });
        if (drive) expect(grid.minCardWidth, `${label}: no tile under the ~220 px track`).toBeGreaterThanOrEqual(219.5);
        expect(requests.at(-1), `${label}: the window is the list's`).toMatchObject({ limit: first.limit, offset: 0 });
        await expectNoDocumentScroll(page, label);
      }
    });
  }
});

test.describe("C24 · 13 canonical viewports", () => {
  test("the toggle exists only from 768px, the grid fits its canvas and the preference survives the phone regime", async ({ page }) => {
    test.setTimeout(240_000);
    await addAppCookies(page, [A03_ADMIN_SESSION_COOKIE, A03_ADAPTIVE_DATASET_COOKIE]);
    const requests: Array<{ limit: number; offset: number }> = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/admin/report-workflow") requests.push({ limit: Number(url.searchParams.get("limit")), offset: Number(url.searchParams.get("offset")) });
    });
    const measured = new Set<string>();
    for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/dashboard/admin?module=admin-report-upload");
      const reports = page.locator(REPORTS);
      const toggle = reports.getByRole("group", { name: "Vista de informes" });
      if (viewport.width < 768) {
        await expect(reports.locator('[data-admin-mobile-core-item="true"]').first(), `${viewport.slug}: phone list`).toBeVisible();
        await expect(toggle, `${viewport.slug}: no toggle on phones`).toBeHidden();
        await expect(reports.locator('[data-content-grid="true"]')).toHaveCount(0);
      } else {
        const canvas = page.locator(REPORTS_CANVAS);
        await expect(canvas.locator("tbody tr").first()).toBeVisible();
        await expectHydrated(toggle);
        const rows = await canvas.locator("tbody tr").count();
        const window = requests.at(-1);
        await toggle.getByRole("button", { name: GRID }).click();
        await expect(canvas.locator('[data-content-grid-item="true"]'), `${viewport.slug}: one card per row`).toHaveCount(rows);
        const measured3 = await gridGeometry(canvas);
        expect(measured3, `${viewport.slug}: grid inside the canvas`).toMatchObject({ columns: expectedLayout(measured3, 3, 390, 250).columns, cards: rows, escaping: 0, innerOverflowX: 0 });
        expect(requests.at(-1), `${viewport.slug}: window unchanged`).toEqual(window);
      }
      await expectNoDocumentScroll(page, viewport.slug);
      measured.add(viewport.slug);
    }
    expect(measured.size, "distinct viewports measured").toBe(DASHBOARD_GEOMETRY_VIEWPORTS.length);

    // Crossing 768px: the phone forces the list, the preference comes back.
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/dashboard/admin?module=admin-report-upload");
    const reports = page.locator(REPORTS);
    const toggle = reports.getByRole("group", { name: "Vista de informes" });
    await expectHydrated(toggle);
    await toggle.getByRole("button", { name: GRID }).click();
    await expect(page.locator(`${REPORTS_CANVAS} [data-content-grid="true"]`)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(reports.locator('[data-admin-mobile-core-item="true"]').first()).toBeVisible();
    await expect(reports.locator('[data-content-grid="true"]')).toHaveCount(0);
    await expectNoDocumentScroll(page, "crossed to phone");
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(page.locator(`${REPORTS_CANVAS} [data-content-grid="true"]`), "the grid preference survives").toBeVisible();
    await expectPressed(toggle, "grid");
  });

  test("the clinic full route offers the grid from 768px and forces the list below", async ({ page }) => {
    test.setTimeout(240_000);
    await setClinicSession(page, "populated");
    const measured = new Set<string>();
    for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS) {
      // Resizing a live informes page re-measures it and starts a window request the next navigation orphans.
      await page.goto("about:blank");
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const requests = trackInformesWindowRequests(page);
      await page.goto("/dashboard/informes");
      const count = await settleInformesRows(page, requests, viewport.slug, 15_000);
      const toggle = page.getByRole("group", { name: "Vista de informes" });
      const canvas = page.locator('[data-informes-rows-canvas="true"]');
      if (viewport.width < 768) {
        await expect(toggle, `${viewport.slug}: no toggle on phones`).toBeHidden();
        await expect(canvas.locator('[data-informes-grid="true"]')).toHaveCount(0);
      } else {
        await expectHydrated(toggle);
        const started = requests.started();
        await toggle.getByRole("button", { name: GRID }).click();
        await expect(canvas.locator('[data-informes-grid="true"]')).toBeVisible();
        expect(await gridGeometry(canvas), `${viewport.slug}: grid inside the canvas`).toMatchObject({ columns: 2, cards: count, escaping: 0, innerOverflowX: 0 });
        expect(requests.started(), `${viewport.slug}: no window request`).toBe(started);
      }
      await expectNoDocumentScroll(page, viewport.slug);
      measured.add(viewport.slug);
    }
    expect(measured.size, "distinct viewports measured").toBe(DASHBOARD_GEOMETRY_VIEWPORTS.length);
  });
});

// V5 · every adopter, every width: the grid keeps columns and rows in step, paints no clipped
// card and never truncates more than the frozen C24 geometry does ON THE SAME RUN (font metrics
// differ per platform, so the frozen geometry is re-measured inline, never hard-coded).
const ADOPTER_WIDTHS = {
  "informes-admin": ["1920x1080", "1366x768", "1279x720", "1280x720", "1024x768", "834x1194", "768x1024"],
  "informes-clinica": ["1920x1080", "1440x900", "1366x768", "1279x720", "1024x768", "1023x768", "768x1024"],
} as const;

/** Truncated cards the frozen geometry (floor columns, 8 px gap) paints for the very same page. */
async function frozenTruncation(canvas: Locator, floor: number) {
  return canvas.locator('[data-content-grid="true"]').evaluate((element, columns) => {
    const grid = element as HTMLElement;
    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    grid.style.gap = "8px";
    const cards = [...grid.querySelectorAll<HTMLElement>('[data-content-grid-item="true"]')];
    return cards.filter((card) => [...card.querySelectorAll<HTMLElement>("*")].some((child) => child.scrollWidth > child.clientWidth + 1 && getComputedStyle(child).overflow !== "visible")).length;
  }, floor);
}
const sizeOf = (slug: string) => {
  const [width, height] = slug.split("x").map(Number);
  return { width, height };
};

test.describe("V5 · the three adopters never clip, truncate more, or desync columns and rows", () => {
  test("Informes admin: columns by its 390 px measured track, Drive tiles from 250 px where viable", async ({ page }) => {
    test.setTimeout(240_000);
    await addAppCookies(page, [A03_ADMIN_SESSION_COOKIE, A03_ADAPTIVE_DATASET_COOKIE]);
    for (const slug of ADOPTER_WIDTHS["informes-admin"]) {
      await page.goto("about:blank");
      await page.setViewportSize(sizeOf(slug));
      await page.goto("/dashboard/admin?module=admin-report-upload");
      const canvas = page.locator(REPORTS_CANVAS);
      await expect(canvas.locator("tbody tr").first()).toBeVisible({ timeout: 25_000 });
      const toggle = page.locator(REPORTS).getByRole("group", { name: "Vista de informes" });
      await expectHydrated(toggle);
      const rows = await canvas.locator("tbody tr").count();
      await toggle.getByRole("button", { name: GRID }).click();
      await expect(canvas.locator('[data-content-grid-item="true"]')).toHaveCount(rows);
      const grid = await gridGeometry(canvas);
      const layout = expectedLayout(grid, 3, 390, 250);
      expect(grid, slug).toMatchObject({ columns: layout.columns, rows: Math.ceil(rows / layout.columns), cards: rows, escaping: 0, innerOverflowX: 0, clipped: 0, stretched: 0, gap: layout.gap, radius: layout.radius });
      if (layout.drive) expect(grid.minCardWidth, `${slug}: no tile under the measured track`).toBeGreaterThanOrEqual(249.5);
      expect(grid.truncated, `${slug}: truncation`).toBeLessThanOrEqual(await frozenTruncation(canvas, 3));
      await expectNoDocumentScroll(page, slug);
    }
  });

  test("Informes clínica: columns by its 320 px measured track, Drive tiles only where viable", async ({ page }) => {
    test.setTimeout(240_000);
    await setClinicSession(page, "populated");
    for (const slug of ADOPTER_WIDTHS["informes-clinica"]) {
      await page.goto("about:blank");
      await page.setViewportSize(sizeOf(slug));
      const requests = trackInformesWindowRequests(page);
      await page.goto("/dashboard/informes");
      const count = await settleInformesRows(page, requests, slug, 20_000);
      const toggle = page.getByRole("group", { name: "Vista de informes" });
      await expectHydrated(toggle);
      await toggle.getByRole("button", { name: GRID }).click();
      const canvas = page.locator('[data-informes-rows-canvas="true"]');
      await expect(canvas.locator('[data-informes-grid="true"]')).toBeVisible();
      const grid = await gridGeometry(canvas);
      const layout = expectedLayout(grid, 2, 320);
      expect(grid, slug).toMatchObject({ columns: layout.columns, rows: Math.ceil(count / layout.columns), cards: count, escaping: 0, innerOverflowX: 0, clipped: 0, stretched: 0, gap: layout.gap, radius: layout.radius });
      if (layout.drive) expect(grid.minCardWidth, `${slug}: no tile under the measured track`).toBeGreaterThanOrEqual(319.5);
      expect(grid.truncated, `${slug}: truncation`).toBeLessThanOrEqual(await frozenTruncation(canvas, 2));
      await expectNoDocumentScroll(page, slug);
    }
  });

  test("Clínicas admin: columns and rows stay in step through resize A-B-A and list/grid toggling, with no extra request", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1366, height: 768 });
    const requests = await openClinics(page);
    await expectClinicsPage(page, requests, "list");
    const canvas = page.locator(CLINICS_CANVAS);
    const toggle = page.locator(CLINICS).getByRole("group", { name: "Vista de clínicas" });
    await expectHydrated(toggle);
    await toggle.getByRole("button", { name: GRID }).click();
    const synced = async (label: string) => {
      let grid = await gridGeometry(canvas);
      await expect
        .poll(async () => {
          grid = await gridGeometry(canvas);
          return grid.columns === clinicsGridColumns(grid.innerWidth) && grid.rows === Math.ceil(grid.cards / grid.columns);
        }, { message: `${label}: columns and rows in step` })
        .toBe(true);
      expect(grid, label).toMatchObject({ escaping: 0, clipped: 0, stretched: 0, innerOverflowX: 0 });
      return grid;
    };
    const first = await synced("A 1366");
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect.poll(async () => (await gridGeometry(canvas)).columns).toBe(3);
    await expectClinicsPage(page, requests, "grid");
    const second = await synced("B 1024");
    expect(second.columns).toBe(3);
    await page.setViewportSize({ width: 1366, height: 768 });
    await expectClinicsPage(page, requests, "grid");
    const again = await synced("A 1366 again");
    expect({ columns: again.columns, cards: again.cards }, "A-B-A returns to the same layout").toEqual({ columns: first.columns, cards: first.cards });
    for (let turn = 0; turn < 3; turn += 1) {
      await toggle.getByRole("button", { name: LIST }).click();
      await expect(canvas.locator("tbody tr").first()).toBeVisible();
      const before = requests.length;
      await toggle.getByRole("button", { name: GRID }).click();
      await synced(`toggle ${turn}`);
      expect(requests.length, "toggling never requests").toBe(before);
    }
  });

  test("Clínicas admin tile: hover, keyboard focus and tone", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const requests = await openClinics(page);
    await expectClinicsPage(page, requests, "list");
    const toggle = page.locator(CLINICS).getByRole("group", { name: "Vista de clínicas" });
    await expectHydrated(toggle);
    await toggle.getByRole("button", { name: GRID }).click();
    const tile = page.locator(`${CLINICS_CANVAS} [data-content-grid-item="true"]`).first();
    const fill = () => tile.evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.mouse.move(0, 0);
    await expect.poll(fill).toBe("rgb(240, 244, 249)");
    await tile.hover();
    await expect.poll(fill, "hover repaints the tile").not.toBe("rgb(240, 244, 249)");
    await page.mouse.move(0, 0);
    const edit = tile.getByRole("button", { name: /^Editar clínica / });
    await edit.focus();
    await expect(edit).toBeFocused();
    const ring = await edit.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    });
    expect(ring, "visible keyboard focus").toBe(true);
    await expectNoSeriousAxe(page, CLINICS);
  });
});
