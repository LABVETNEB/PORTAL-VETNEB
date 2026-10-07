import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { setAdminSession } from "../../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../helpers/zero-scroll-contract";

// C04 (P2-09, rector §7.8): the Clínicas admin table orders by column through
// the server contract of GET /api/admin/clinics (sort = name | createdAt,
// direction = asc | desc, sent together). The route stub reproduces that
// contract — filter, global sort with an id tie-breaker in the same direction,
// then slice — so a page only matches when the client sent the order and
// rendered the response as received.

type SortKey = "name" | "createdAt";
type Direction = "asc" | "desc";
type ClinicsRequest = {
  limit: number;
  offset: number;
  search: string | null;
  sort: string | null;
  direction: string | null;
};

const NAMES = ["Zorzal", "Alba", "Mirlo", "Ceibo", "Benteveo", "Tala", "Hornero", "Quebracho", "Jacaranda"] as const;

// 30 clinics: more than any desktop page, names and dates out of id order,
// repeated names and repeated creation dates so only the id tie-breaker makes
// the order total.
const CLINICS = Array.from({ length: 30 }, (_, index) => {
  const clinicId = index + 1;
  const createdAt = new Date(Date.UTC(2026, 0, 1 + ((clinicId * 5) % 11), 9, 0, 0)).toISOString();
  return {
    clinicId,
    clinicName: `${NAMES[(clinicId * 4) % NAMES.length]} ${String.fromCharCode(65 + (clinicId % 3))}`,
    contactEmail: `clinica${clinicId}@${clinicId % 3 === 0 ? "vet" : "centro"}.example.test`,
    contactPhone: null,
    createdAt,
    // Distinct from createdAt and not monotone with it, so what the Fechas cell
    // shows can be told apart from what the server sorts by.
    updatedAt: new Date(Date.UTC(2026, 5, 1 + ((clinicId * 7) % 13), 8 + (clinicId % 5), 0, 0)).toISOString(),
    users: [
      {
        userType: "clinic" as const,
        userId: 500 + clinicId,
        username: `owner-${clinicId}`,
        role: "clinic_owner" as const,
        clinicId,
        clinicName: "",
        createdAt,
        updatedAt: createdAt,
      },
    ],
  };
});

type Clinic = (typeof CLINICS)[number];

function compare(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function serverResult(request: ClinicsRequest): { total: number; ids: number[] } {
  const term = request.search?.toLowerCase() ?? "";
  const matched = CLINICS.filter((clinic) =>
    !term ||
    clinic.clinicName.toLowerCase().includes(term) ||
    clinic.contactEmail.toLowerCase().includes(term) ||
    clinic.users.some((user) => user.username.toLowerCase().includes(term)),
  );
  const key: SortKey = (request.sort as SortKey | null) ?? "name";
  const direction: Direction = (request.direction as Direction | null) ?? "asc";
  const value = (clinic: Clinic) => (key === "name" ? clinic.clinicName : clinic.createdAt);
  const ordered = [...matched].sort((a, b) => {
    const order = compare(value(a), value(b)) || compare(a.clinicId, b.clinicId);
    return direction === "asc" ? order : -order;
  });
  return {
    total: ordered.length,
    ids: ordered.slice(request.offset, request.offset + request.limit).map((clinic) => clinic.clinicId),
  };
}

// A held request is answered only when its gate resolves, so a test can
// observe the UI while that request is in flight.
type Hold = (request: ClinicsRequest) => Promise<void> | undefined;

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function stubClinics(page: Page, hold?: Hold): Promise<ClinicsRequest[]> {
  const requests: ClinicsRequest[] = [];
  await page.route(
    (url) => url.pathname === "/api/admin/clinics",
    async (route) => {
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

      const pairBroken = (request.sort === null) !== (request.direction === null);
      const invalid =
        (request.sort !== null && !["name", "createdAt"].includes(request.sort)) ||
        (request.direction !== null && !["asc", "desc"].includes(request.direction));
      if (pairBroken || invalid) {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ success: false, error: "Query inválida." }) });
        return;
      }

      await hold?.(request);
      const { total, ids } = serverResult(request);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          clinics: ids.map((id) => CLINICS[id - 1]),
          total,
          limit: request.limit,
          offset: request.offset,
        }),
      });
    },
  );
  return requests;
}

const CARD = "#admin-clinics";

async function visibleIds(page: Page): Promise<number[]> {
  return page.locator(`${CARD} tbody tr td:first-child`).evaluateAll((cells) =>
    cells.map((cell) => Number(/#(\d+)/.exec(cell.textContent ?? "")?.[1] ?? Number.NaN)),
  );
}

// Waits until the table shows exactly the page the server returned for the
// latest request, and returns that request.
async function settled(page: Page, requests: ClinicsRequest[]): Promise<ClinicsRequest> {
  await expect
    .poll(async () => {
      const last = requests.at(-1);
      if (!last) return "no request";
      const ids = await visibleIds(page);
      return JSON.stringify(ids) === JSON.stringify(serverResult(last).ids) && ids.length > 0 ? "settled" : JSON.stringify({ last, ids });
    }, { timeout: 10_000 })
    .toBe("settled");
  return requests.at(-1)!;
}

function sortButton(page: Page, name: "Clínica" | "Fechas") {
  return page.locator(`${CARD} thead`).getByRole("button", { name, exact: true });
}

function header(page: Page, name: "Clínica" | "Contacto" | "Usuario" | "Fechas" | "Acciones") {
  return page.locator(`${CARD} thead th`).filter({ hasText: new RegExp(`^${name}$`, "i") });
}

async function headerGeometry(page: Page) {
  return page.locator(CARD).evaluate((card) => {
    const th = card.querySelector("thead th");
    const row = card.querySelector("tbody tr");
    const buttons = [...card.querySelectorAll<HTMLButtonElement>("thead th button")];
    const wrapper = card.querySelector("table")?.parentElement;
    const canvas = card.querySelector('[data-dashboard-canvas-reserve="table-head-dense"]');
    return {
      thHeight: th?.getBoundingClientRect().height ?? 0,
      reservedHeadHeight: canvas ? Number.parseFloat(getComputedStyle(canvas).getPropertyValue("--dash-table-head-h")) : Number.NaN,
      rowHeight: row?.getBoundingClientRect().height ?? 0,
      buttons: buttons.map((button) => {
        const box = button.getBoundingClientRect();
        const cell = button.closest("th")!.getBoundingClientRect();
        // The 2px ring plus 2px offset must stay inside the clipping th.
        const ringRoom = Math.min(box.top - cell.top, cell.bottom - box.bottom, box.left - cell.left);
        return { width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10, ringFits: ringRoom >= 4 };
      }),
      tableOverflowX: wrapper ? wrapper.scrollWidth - wrapper.clientWidth : -1,
      documentScroll: {
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      },
    };
  });
}

// What the Fechas cells show against the same dates formatted independently, in
// the browser locale the app uses. The column keeps showing updatedAt (dates are
// frozen by the rector); the title carries both dates explicitly.
async function visibleFechas(page: Page): Promise<{ shown: string[]; updated: string[]; created: string[]; titles: string[]; expectedTitles: string[] }> {
  const ids = await visibleIds(page);
  const cells = page.locator(`${CARD} tbody tr td:nth-child(4)`);
  const shown = await cells.allTextContents();
  const titles = await cells.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("title") ?? ""));
  const formatted = await page.evaluate(
    (rows) => {
      const format = (iso: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
      return rows.map((row) => ({ created: format(row.createdAt), updated: format(row.updatedAt) }));
    },
    ids.map((id) => ({ createdAt: CLINICS[id - 1].createdAt, updatedAt: CLINICS[id - 1].updatedAt })),
  );
  return {
    shown: shown.map((text) => text.trim()),
    updated: formatted.map((row) => row.updated),
    created: formatted.map((row) => row.created),
    titles,
    expectedTitles: formatted.map((row) => `Creada: ${row.created} · Actualizada: ${row.updated}`),
  };
}

async function committedFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function openClinics(page: Page, hold?: Hold): Promise<ClinicsRequest[]> {
  await setAdminSession(page, "default");
  const requests = await stubClinics(page, hold);
  await page.goto("/dashboard/admin?module=admin-clinics");
  await expect(page.locator(CARD)).toBeVisible({ timeout: 10_000 });
  return requests;
}

test.describe("C04 · Clínicas admin column sort (desktop table)", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("server-side global order: baseline, name asc/desc, createdAt, paging, aria-sort and frozen geometry", async ({ page }) => {
    const requests = await openClinics(page);

    // Case 1 — baseline: no order requested, historical server order.
    const baseline = await settled(page, requests);
    expect(requests.every((request) => request.sort === null && request.direction === null)).toBe(true);
    expect(baseline.offset).toBe(0);
    expect(baseline.search).toBeNull();
    expect(baseline.limit).toBeLessThan(CLINICS.length);
    const limit = baseline.limit;
    const baselineIndex = requests.length - 1;
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "none");
    await expect(header(page, "Fechas")).toHaveAttribute("aria-sort", "none");
    for (const plain of ["Contacto", "Usuario", "Acciones"] as const) {
      await expect(header(page, plain)).not.toHaveAttribute("aria-sort", /.*/);
      await expect(header(page, plain).getByRole("button")).toHaveCount(0);
    }
    await expect(page.locator(`${CARD} [aria-sort]`)).toHaveCount(2);
    const geometry = await headerGeometry(page);
    // The dense A03 head reserve sizes the header; the sort control fits in it.
    expect(Math.abs(geometry.thHeight - geometry.reservedHeadHeight)).toBeLessThanOrEqual(0.5);
    expect(geometry.buttons.map((button) => button.ringFits)).toEqual([true, true]);
    expect(geometry.tableOverflowX).toBeLessThanOrEqual(0);
    expect(Math.max(geometry.documentScroll.x, geometry.documentScroll.y)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);

    // Case 2 — name asc.
    await sortButton(page, "Clínica").click();
    let request = await settled(page, requests);
    expect(request).toMatchObject({ sort: "name", direction: "asc", limit, offset: 0, search: null });
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "ascending");
    await expect(header(page, "Fechas")).toHaveAttribute("aria-sort", "none");

    // Case 3 — name desc.
    await sortButton(page, "Clínica").click();
    request = await settled(page, requests);
    expect(request).toMatchObject({ sort: "name", direction: "desc", limit, offset: 0, search: null });
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "descending");

    // Case 4 — createdAt restarts ascending; Clínica returns to none.
    await sortButton(page, "Fechas").click();
    request = await settled(page, requests);
    expect(request).toMatchObject({ sort: "createdAt", direction: "asc", limit, offset: 0, search: null });
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "none");
    await expect(header(page, "Fechas")).toHaveAttribute("aria-sort", "ascending");
    const firstPage = await visibleIds(page);

    // Dates stay frozen: the column keeps showing updatedAt while the server
    // orders by createdAt, and the title tells both apart.
    const fechas = await visibleFechas(page);
    expect(fechas.shown).toEqual(fechas.updated);
    expect(fechas.shown).not.toEqual(fechas.created);
    expect(fechas.titles).toEqual(fechas.expectedTitles);
    await expect(sortButton(page, "Fechas")).toHaveAttribute("title", "Ordenar por fecha de creación");
    const createdOrder = firstPage.map((id) => CLINICS[id - 1].createdAt);
    expect(createdOrder).toEqual([...createdOrder].sort());

    // Case 5 — paging keeps sort, direction and limit and advances only the offset.
    const sortedRequests = requests.length;
    await page.locator(`${CARD} [aria-label="Página siguiente"]:visible`).click();
    request = await settled(page, requests);
    expect(request).toEqual({ limit, offset: limit, search: null, sort: "createdAt", direction: "asc" });
    expect(requests.slice(sortedRequests).every((sent) => sent.sort === "createdAt" && sent.direction === "asc" && sent.limit === limit)).toBe(true);
    const secondPage = await visibleIds(page);
    expect(new Set([...firstPage, ...secondPage]).size).toBe(firstPage.length + secondPage.length);

    // Page 2 is the second slice of the globally ordered dataset, which the
    // fixture makes different from re-ordering the unsorted page 2 locally.
    const unsortedPageTwo = serverResult({ limit, offset: limit, search: null, sort: null, direction: null }).ids;
    const pageOnlyOrder = [...unsortedPageTwo].sort((a, b) => compare(CLINICS[a - 1].createdAt, CLINICS[b - 1].createdAt) || a - b);
    expect(secondPage).not.toEqual(pageOnlyOrder);
    expect(secondPage).toEqual(serverResult(request).ids);
    // Admin desktop/tablet space pass: the pager paints Anterior/Siguiente only,
    // so page 2 is proven by the rendered slice and the enabled Anterior.
    await expect(page.locator(`${CARD} [aria-label="Página anterior"]:visible`)).toBeEnabled();
    await expect(page.locator(CARD).getByText(/\d+–\d+ de \d+/)).toHaveCount(0);

    // A new order restarts at the first page with the same limit.
    await sortButton(page, "Fechas").click();
    request = await settled(page, requests);
    expect(request).toEqual({ limit, offset: 0, search: null, sort: "createdAt", direction: "desc" });
    await expect(header(page, "Fechas")).toHaveAttribute("aria-sort", "descending");
    await expect(page.locator(`${CARD} [aria-sort="ascending"], ${CARD} [aria-sort="descending"]`)).toHaveCount(1);

    // C04 adds no geometry: header, row, sort controls and scroll are unchanged.
    const sortedGeometry = await headerGeometry(page);
    expect(Math.abs(sortedGeometry.thHeight - geometry.thHeight)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(sortedGeometry.rowHeight - geometry.rowHeight)).toBeLessThanOrEqual(0.5);
    expect(sortedGeometry.buttons).toEqual(geometry.buttons);
    expect(sortedGeometry.tableOverflowX).toBeLessThanOrEqual(0);
    expect(Math.max(sortedGeometry.documentScroll.x, sortedGeometry.documentScroll.y)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);
    expect(requests.slice(baselineIndex).every((sent) => sent.limit === limit)).toBe(true);
  });

  test("aria-sort follows the applied order: unchanged while the request is in flight, and a stale response never wins", async ({ page }) => {
    const ascGate = deferred();
    const requests = await openClinics(page, (request) =>
      request.sort === "name" && request.direction === "asc" ? ascGate.promise : undefined);
    const baseline = await settled(page, requests);
    const baselineIds = await visibleIds(page);

    // 1–4. The asc request is in flight: old rows stay and aria-sort does not claim the new order.
    await sortButton(page, "Clínica").click();
    await expect.poll(() => JSON.stringify([requests.at(-1)?.sort, requests.at(-1)?.direction])).toBe('["name","asc"]');
    await committedFrames(page);
    expect(await visibleIds(page)).toEqual(baselineIds);
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "none");
    await expect(page.locator(`${CARD} [aria-sort="ascending"], ${CARD} [aria-sort="descending"]`)).toHaveCount(0);

    // A newer request (desc) answers first and is applied with its rows.
    await sortButton(page, "Clínica").click();
    const desc = await settled(page, requests);
    expect(desc).toEqual({ limit: baseline.limit, offset: 0, search: null, sort: "name", direction: "desc" });
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "descending");
    const descIds = await visibleIds(page);

    // The superseded asc response arrives last and is discarded: rows and aria-sort keep desc.
    const staleResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/admin/clinics" && url.searchParams.get("direction") === "asc";
    });
    ascGate.release();
    await (await staleResponse).finished();
    await committedFrames(page);
    expect(await visibleIds(page)).toEqual(descIds);
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "descending");
  });

  test("search stays server-side and debounced while an order is active", async ({ page }) => {
    const requests = await openClinics(page);
    const { limit } = await settled(page, requests);

    await sortButton(page, "Clínica").click();
    await settled(page, requests);
    await sortButton(page, "Clínica").click();
    await settled(page, requests);

    const before = requests.length;
    await page.locator(`${CARD} input[aria-label="Buscar clínicas"]:visible`).fill("  vet ");
    await expect.poll(() => requests.at(-1)?.search ?? null).toBe("vet");
    const request = await settled(page, requests);
    expect(request).toEqual({ limit, offset: 0, search: "vet", sort: "name", direction: "desc" });
    expect(requests.slice(before).filter((sent) => sent.search === null)).toEqual([]);
    const expected = serverResult(request);
    expect(await visibleIds(page)).toEqual(expected.ids);
    await expect(page.locator(CARD).getByText(/\d+–\d+ de \d+/)).toHaveCount(0);
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "descending");

    // Changing the order keeps the submitted search.
    await sortButton(page, "Fechas").click();
    expect(await settled(page, requests)).toEqual({ limit, offset: 0, search: "vet", sort: "createdAt", direction: "asc" });
  });

  test("native keyboard activation with visible focus, and axe clean when sorted", async ({ page }) => {
    const requests = await openClinics(page);
    const { limit } = await settled(page, requests);

    await page.locator(`${CARD} input[aria-label="Buscar clínicas"]:visible`).focus();
    const clinica = sortButton(page, "Clínica");
    for (let step = 0; step < 6 && !(await clinica.evaluate((node) => node === document.activeElement)); step += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(clinica).toBeFocused();
    await expect(clinica).toHaveJSProperty("tagName", "BUTTON");
    await expect(clinica).toHaveAttribute("type", "button");
    expect(await clinica.evaluate((node) => node.matches(":focus-visible") && getComputedStyle(node).boxShadow !== "none")).toBe(true);

    await page.keyboard.press("Enter");
    expect(await settled(page, requests)).toMatchObject({ sort: "name", direction: "asc", limit, offset: 0 });
    await expect(clinica).toBeFocused();
    await page.keyboard.press("Space");
    expect(await settled(page, requests)).toMatchObject({ sort: "name", direction: "desc", limit, offset: 0 });
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "descending");
    await expect(clinica).toBeFocused();

    const axe = await new AxeBuilder({ page })
      .include(CARD)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((violation) => violation.id)).toEqual([]);
  });
});

test.describe("C04 · Clínicas admin mobile list keeps the historical order", () => {
  test("no sort UI below md and no hidden order after a desktop sort", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const requests = await openClinics(page);
    await settled(page, requests);
    await sortButton(page, "Clínica").click();
    await sortButton(page, "Clínica").click();
    await expect.poll(() => requests.at(-1)?.direction).toBe("desc");

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileItems = page.locator(`${CARD} [data-admin-mobile-core-item="true"]`);
    await expect
      .poll(async () => {
        const last = requests.at(-1);
        if (!last || last.sort !== null || last.direction !== null) return "sorted request";
        const names = await mobileItems.locator("h3").allTextContents();
        const expected = serverResult(last).ids.map((id) => CLINICS[id - 1].clinicName);
        return JSON.stringify(names) === JSON.stringify(expected) && names.length > 0 ? "historical" : JSON.stringify({ last, names });
      }, { timeout: 10_000 })
      .toBe("historical");
    await expect(page.locator(`${CARD} [aria-sort]:visible`)).toHaveCount(0);
    await expect(page.locator(`${CARD} [data-admin-clinics-sort-button="true"]:visible`)).toHaveCount(0);
    const scroll = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    expect(Math.max(scroll.x, scroll.y)).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);

    // Back on the table the requested order is the one the header shows.
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect.poll(() => JSON.stringify([requests.at(-1)?.sort, requests.at(-1)?.direction])).toBe('["name","desc"]');
    await settled(page, requests);
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "descending");
  });

  test("crossing between the table and the list restarts at the first page in both directions, keeping limit and the chosen order", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const requests = await openClinics(page);
    const { limit: desktopLimit } = await settled(page, requests);

    // Desktop: name desc, then page 2 of that order.
    await sortButton(page, "Clínica").click();
    await settled(page, requests);
    await sortButton(page, "Clínica").click();
    expect(await settled(page, requests)).toEqual({ limit: desktopLimit, offset: 0, search: null, sort: "name", direction: "desc" });
    await page.locator(`${CARD} [aria-label="Página siguiente"]:visible`).click();
    expect(await settled(page, requests)).toEqual({ limit: desktopLimit, offset: desktopLimit, search: null, sort: "name", direction: "desc" });

    // Desktop → mobile: the list has no order, so its window is the first historical page.
    const toMobile = requests.length;
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => requests.length > toMobile && requests.at(-1)?.sort === null).toBe(true);
    const mobileFirst = await settled(page, requests);
    const afterMobileSwitch = requests.slice(toMobile);
    expect(afterMobileSwitch.map((request) => [request.sort, request.direction, request.offset])).toEqual(afterMobileSwitch.map(() => [null, null, 0]));
    expect(mobileFirst).toMatchObject({ offset: 0, search: null, sort: null, direction: null });
    const mobileLimit = mobileFirst.limit;
    const mobileNames = await page.locator(`${CARD} [data-admin-mobile-core-item="true"] h3`).allTextContents();
    expect(mobileNames).toEqual(serverResult(mobileFirst).ids.map((id) => CLINICS[id - 1].clinicName));
    expect(mobileNames.length).toBe(mobileLimit);

    // Mobile page 2 of the historical order, then back to the table.
    await page.locator(`${CARD} [data-admin-mobile-core-pager] [aria-label="Página siguiente"]`).click();
    expect(await settled(page, requests)).toEqual({ limit: mobileLimit, offset: mobileLimit, search: null, sort: null, direction: null });

    const toDesktop = requests.length;
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect.poll(() => requests.length > toDesktop && requests.at(-1)?.sort === "name").toBe(true);
    const desktopFirst = await settled(page, requests);
    expect(requests.slice(toDesktop).map((request) => request.offset)).toEqual(requests.slice(toDesktop).map(() => 0));
    expect(desktopFirst).toEqual({ limit: desktopLimit, offset: 0, search: null, sort: "name", direction: "desc" });
    await expect(header(page, "Clínica")).toHaveAttribute("aria-sort", "descending");
    expect(await visibleIds(page)).toEqual(serverResult(desktopFirst).ids);
  });
});
