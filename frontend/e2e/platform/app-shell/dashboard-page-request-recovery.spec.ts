import { expect, test, type Locator, type Page, type Request } from "@playwright/test";

import { waitForLayoutSettled } from "../../helpers/dashboard-geometry-matrix";
import { setSession, type SessionRole } from "../../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../helpers/zero-scroll-contract";

// A1-7 — a list paged through a Server Action whose request fails. The id of a
// Server Action belongs to one build, so a tab that outlives a deploy calls an
// id the server no longer knows: the request is rejected, and calling it again
// can never succeed. Before this contract the rejection was unhandled, the
// pager advanced over the rows of the previous page and nothing told the user.
//
// The rejection is the server's own: the request is continued to the
// application with a rewritten header or body, never fulfilled or aborted here.
//
// Not proven here: that the assets of an earlier build stay available to an
// open tab (the retention half of A1-7).

const SURFACES = [
  {
    name: "clinic informes",
    role: "clinic",
    url: "/dashboard/informes?status=ready",
    pager: "Paginación de informes",
    rows: "#reports-master-list [id^='report-']",
  },
  {
    name: "admin audit",
    role: "admin",
    url: "/dashboard/admin?module=audit-log",
    pager: "Paginación de auditoría",
    rows: "#audit-log tbody tr, #audit-log [data-admin-mobile-ops-item]",
  },
] as const satisfies readonly { name: string; role: SessionRole; url: string; pager: string; rows: string }[];

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

const UNKNOWN_ACTION_ID = "0".repeat(42);
const RANGE = /\d+–\d+ de \d+/;

function isServerAction(request: Request): boolean {
  return request.method() === "POST" && Boolean(request.headers()["next-action"]);
}

type Surface = (typeof SURFACES)[number];

function controls(page: Page, surface: Surface) {
  const pager = page.locator(`[aria-label="${surface.pager}"]:visible`);

  return {
    next: pager.getByRole("button", { name: /siguiente/i }),
    range: pager.getByText(RANGE).first(),
    firstRow: page.locator(surface.rows).locator("visible=true").first(),
    recovery: page.locator("[data-page-request-recovery]:visible"),
  };
}

// Where the list stands: its first row and the whole range, row count
// included. The notice is laid over the list and takes no room from the rows
// canvas, so the page size may not move while it is shown or dismissed.
async function readList(page: Page, surface: Surface) {
  const { range, firstRow } = controls(page, surface);
  const shown = (await range.textContent()) ?? "";

  return { range: shown, start: /(\d+)–/.exec(shown)?.[1], firstRow: await firstRow.textContent() };
}

// The measured page size settles after mount and re-fetches through the same
// Server Action: the list is read only once two reads apart agree.
async function settledList(page: Page, surface: Surface) {
  let previous = "";

  await expect(async () => {
    const current = JSON.stringify(await readList(page, surface));
    const settled = current === previous;
    previous = current;
    expect(settled, "the list is still settling").toBe(true);
  }).toPass({ timeout: 15_000, intervals: [700] });

  return readList(page, surface);
}

async function openSurface(page: Page, surface: Surface) {
  await setSession(page, surface.role, "populated");
  await page.goto(surface.url);
  await expect(controls(page, surface).next).toBeEnabled({ timeout: 15_000 });

  return settledList(page, surface);
}

function observeTab(page: Page) {
  const observed = { actions: 0, documents: 0, errors: [] as string[] };

  page.on("request", (request) => {
    if (isServerAction(request)) observed.actions += 1;
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) observed.documents += 1;
  });
  page.on("pageerror", (error) => observed.errors.push(error.name));

  return observed;
}

async function expectNoDocumentScroll(page: Page, recovery: Locator) {
  await expect(recovery).toBeVisible();

  const { scrollHeight, clientHeight, scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(scrollHeight).toBeLessThanOrEqual(clientHeight + MAX_DOCUMENT_SCROLL_DELTA_PX);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + MAX_DOCUMENT_SCROLL_DELTA_PX);
}

test.describe("a page request the server no longer recognizes", () => {
  for (const surface of SURFACES) {
    for (const viewport of VIEWPORTS) {
      test(`${surface.name} at ${viewport.name} keeps its page, says so and recovers by loading the current document`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const loaded = await openSurface(page, surface);
        const observed = observeTab(page);
        const { next, recovery } = controls(page, surface);

        await page.route(
          (url) => url.pathname.startsWith("/dashboard"),
          (route) =>
            isServerAction(route.request())
              ? route.continue({ headers: { ...route.request().headers(), "next-action": UNKNOWN_ACTION_ID } })
              : route.fallback(),
        );

        await next.click();

        await expect(recovery).toHaveAttribute("data-page-request-recovery", "outdated");
        await expect(recovery).toHaveRole("alert");
        await expect(recovery).toContainText("versión nueva");
        await expect(recovery.getByRole("button", { name: "Recargar página" })).toBeVisible();
        // The same id would be rejected again: no retry is offered for it.
        await expect(recovery.getByRole("button", { name: "Reintentar" })).toHaveCount(0);

        // The pager did not move over rows that never changed, and it is not
        // left waiting on a request that already failed.
        expect(await readList(page, surface)).toEqual(loaded);
        await expect(next).toBeEnabled();
        await expectNoDocumentScroll(page, recovery);

        // One click is one request: nothing asks again, nothing reloads.
        expect(observed.actions).toBe(1);
        await waitForLayoutSettled(page);
        expect(observed).toEqual({ actions: 1, documents: 0, errors: [] });

        await next.click();
        await expect.poll(() => observed.actions).toBe(2);
        await expect(recovery).toBeVisible();
        expect(await readList(page, surface)).toEqual(loaded);
        expect(observed.documents).toBe(0);

        await page.unrouteAll({ behavior: "wait" });

        await recovery.getByRole("button", { name: "Recargar página" }).click();
        await expect.poll(() => observed.documents).toBe(1);

        // The document of the current build: same URL, same session, the
        // applied filters still in it, and a pager that pages again.
        await expect(page).toHaveURL(surface.url);
        await expect(next).toBeEnabled({ timeout: 15_000 });
        await expect(recovery).toHaveCount(0);
        const reloaded = await settledList(page, surface);

        await next.click();
        await expect.poll(async () => (await readList(page, surface)).start).not.toBe(reloaded.start);
        await expect(recovery).toHaveCount(0);
        expect(observed.errors).toEqual([]);
      });
    }
  }
});

test.describe("a page request that fails for another reason", () => {
  for (const surface of SURFACES) {
    test(`${surface.name} keeps its page and the retry asks for the page that failed`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const loaded = await openSurface(page, surface);
      const observed = observeTab(page);
      const { next, recovery } = controls(page, surface);

      // The action is known, its arguments are not readable: the server fails.
      await page.route(
        (url) => url.pathname.startsWith("/dashboard"),
        (route) => (isServerAction(route.request()) ? route.continue({ postData: "[" }) : route.fallback()),
      );

      await next.click();

      await expect(recovery).toHaveAttribute("data-page-request-recovery", "failed");
      await expect(recovery).toHaveRole("alert");
      await expect(recovery).toContainText("No se pudo cargar la página pedida");
      await expect(recovery.getByRole("button", { name: "Recargar página" })).toBeVisible();
      expect(await readList(page, surface)).toEqual(loaded);
      await waitForLayoutSettled(page);
      expect(observed).toEqual({ actions: 1, documents: 0, errors: [] });

      await page.unrouteAll({ behavior: "wait" });
      await recovery.getByRole("button", { name: "Reintentar" }).click();

      await expect.poll(async () => (await readList(page, surface)).start).not.toBe(loaded.start);
      await expect(recovery).toHaveCount(0);
      expect(observed).toEqual({ actions: 2, documents: 0, errors: [] });
    });
  }
});

// -- The same failure where no page had to be turned --------------------------
// A list also asks again when the measured canvas changes its capacity: after
// mount, on a resize, on a rotation. Those requests fail the same way.

const INFORMES = SURFACES[0];
const AUDIT = SURFACES[1];
const EMPTY_INFORMES_URL = "/dashboard/informes?query=sin-coincidencias-a17";

async function rejectAsUnrecognized(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith("/dashboard"),
    (route) =>
      isServerAction(route.request())
        ? route.continue({ headers: { ...route.request().headers(), "next-action": UNKNOWN_ACTION_ID } })
        : route.fallback(),
  );
}

async function rejectAsUnreadable(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith("/dashboard"),
    (route) => (isServerAction(route.request()) ? route.continue({ postData: "[" }) : route.fallback()),
  );
}

// No request is still on its way once two reads apart count the same.
async function settledRequests(observed: { actions: number }) {
  let previous = -1;

  await expect(async () => {
    const settled = observed.actions === previous;
    previous = observed.actions;
    expect(settled, "a page request is still being issued").toBe(true);
  }).toPass({ timeout: 15_000, intervals: [700] });

  return observed.actions;
}

test.describe("a capacity request that fails over an empty list", () => {
  for (const failure of ["outdated", "failed"] as const) {
    test(`clinic informes with no results shows the ${failure} recovery and keeps the empty state`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await setSession(page, INFORMES.role, "populated");
      const observed = observeTab(page);
      await page.goto(EMPTY_INFORMES_URL);

      const emptyState = page.getByText("No hay informes disponibles.");
      const recovery = page.locator("[data-page-request-recovery]");
      await expect(emptyState).toBeVisible({ timeout: 15_000 });
      const settled = await settledRequests(observed);
      await expect(recovery).toHaveCount(0);

      await (failure === "outdated" ? rejectAsUnrecognized(page) : rejectAsUnreadable(page));
      await page.setViewportSize({ width: 1440, height: 600 });

      // One notice, over a list that is still genuinely empty.
      await expect(recovery).toHaveCount(1);
      await expect(recovery).toBeVisible();
      await expect(recovery).toHaveAttribute("data-page-request-recovery", failure);
      await expect(recovery).toHaveRole("alert");
      await expect(emptyState).toBeVisible();
      await expect(recovery.getByRole("button", { name: "Reintentar" })).toHaveCount(failure === "failed" ? 1 : 0);
      await expectNoDocumentScroll(page, recovery);

      await waitForLayoutSettled(page);
      expect(observed).toEqual({ actions: settled + 1, documents: 1, errors: [] });

      await page.unrouteAll({ behavior: "wait" });

      if (failure === "failed") {
        await recovery.getByRole("button", { name: "Reintentar" }).click();
        await expect(recovery).toHaveCount(0);
        await expect(emptyState).toBeVisible();
        expect(observed).toEqual({ actions: settled + 2, documents: 1, errors: [] });
        return;
      }

      // Reachable and operable from the keyboard alone.
      const reload = recovery.getByRole("button", { name: "Recargar página" });
      await reload.focus();
      await expect(reload).toBeFocused();
      await page.keyboard.press("Enter");

      await expect.poll(() => observed.documents).toBe(2);
      await expect(page).toHaveURL(EMPTY_INFORMES_URL);
      await expect(emptyState).toBeVisible({ timeout: 15_000 });
      await expect(recovery).toHaveCount(0);
      expect(observed.errors).toEqual([]);
    });
  }
});

function auditEventIds(page: Page): Promise<number[]> {
  return page
    .locator("#audit-log [aria-label^='Seleccionar evento ']")
    .locator("visible=true")
    .evaluateAll((nodes) => nodes.map((node) => Number((node.getAttribute("aria-label") ?? "").replace(/\D+/g, ""))));
}

// Rows of the visible presentation that end below the canvas that holds them.
function clippedAuditRows(page: Page): Promise<number> {
  return page.evaluate(() => {
    const shown = (node: Element) => node.getClientRects().length > 0;
    const canvas = [...document.querySelectorAll("#audit-log [data-dashboard-adaptive-rows-canvas]")].find(shown);
    const rows = [...document.querySelectorAll("#audit-log tbody tr, #audit-log [data-admin-mobile-ops-item]")].filter(shown);
    const floor = canvas?.getBoundingClientRect().bottom ?? 0;

    return rows.filter((row) => row.getBoundingClientRect().bottom > floor + 1).length;
  });
}

async function auditWindow(page: Page) {
  const { range } = controls(page, AUDIT);
  const [, start, end, total] = /(\d+)–(\d+) de (\d+)/.exec((await range.textContent()) ?? "") ?? [];

  return { ids: await auditEventIds(page), start: Number(start), end: Number(end), total: Number(total) };
}

test.describe("a resize whose page request fails on the audit log", () => {
  test("shrinking keeps one coherent window, and the next page starts right after the last row shown", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSurface(page, AUDIT);
    const loaded = await auditWindow(page);
    const observed = observeTab(page);
    const { next, recovery } = controls(page, AUDIT);

    await rejectAsUnrecognized(page);
    await page.setViewportSize({ width: 1440, height: 460 });
    await expect(recovery).toHaveAttribute("data-page-request-recovery", "outdated");
    await waitForLayoutSettled(page);

    // Fewer rows fit: the ones kept are the first of the loaded page, the
    // range counts exactly them and none is cut by the canvas.
    const kept = await auditWindow(page);
    expect(kept.ids.length).toBeGreaterThan(0);
    expect(kept.ids.length, "the shorter viewport must fit fewer rows for this case to mean anything").toBeLessThan(loaded.ids.length);
    expect(kept.ids).toEqual(loaded.ids.slice(0, kept.ids.length));
    expect({ start: kept.start, end: kept.end, total: kept.total }).toEqual({ start: 1, end: kept.ids.length, total: loaded.total });
    expect(await clippedAuditRows(page)).toBe(0);
    await expectNoDocumentScroll(page, recovery);
    expect(observed).toEqual({ actions: 1, documents: 0, errors: [] });

    await page.unrouteAll({ behavior: "wait" });
    await next.click();

    // No record repeated, none skipped: the fixture's own next record leads.
    await expect.poll(async () => (await auditWindow(page)).ids[0]).toBe(loaded.ids[kept.ids.length]);
    const following = await auditWindow(page);
    expect(following.start).toBe(kept.ids.length + 1);
    expect(following.ids.filter((id) => kept.ids.includes(id))).toEqual([]);
    expect(following.end - following.start + 1).toBe(following.ids.length);
    expect(await clippedAuditRows(page)).toBe(0);
    await expect(recovery).toHaveCount(0);
    expect(observed).toEqual({ actions: 2, documents: 0, errors: [] });
  });

  test("growing on a phone keeps the loaded rows, and the next page neither skips nor repeats a record", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSurface(page, AUDIT);
    const tall = await auditWindow(page);

    await page.setViewportSize({ width: 390, height: 600 });
    await expect.poll(async () => (await auditWindow(page)).ids.length).toBeLessThan(tall.ids.length);
    await settledList(page, AUDIT);
    const loaded = await auditWindow(page);
    expect(loaded.ids).toEqual(tall.ids.slice(0, loaded.ids.length));

    const observed = observeTab(page);
    const { next, recovery } = controls(page, AUDIT);

    await rejectAsUnrecognized(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(recovery).toHaveAttribute("data-page-request-recovery", "outdated");
    await waitForLayoutSettled(page);

    const kept = await auditWindow(page);
    expect(kept).toEqual(loaded);
    expect(await clippedAuditRows(page)).toBe(0);
    await expectNoDocumentScroll(page, recovery);
    expect(observed).toEqual({ actions: 1, documents: 0, errors: [] });

    await page.unrouteAll({ behavior: "wait" });
    await next.click();

    await expect.poll(async () => (await auditWindow(page)).ids[0]).toBe(tall.ids[loaded.ids.length]);
    const following = await auditWindow(page);
    expect(following.start).toBe(loaded.ids.length + 1);
    expect(following.ids.filter((id) => loaded.ids.includes(id))).toEqual([]);
    expect(following.end - following.start + 1).toBe(following.ids.length);
    expect(await clippedAuditRows(page)).toBe(0);
    expect(observed).toEqual({ actions: 2, documents: 0, errors: [] });
  });

  test("the retry asks for the window that failed and lands on the measured page size", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSurface(page, AUDIT);
    const loaded = await auditWindow(page);
    const observed = observeTab(page);
    const { recovery } = controls(page, AUDIT);

    await rejectAsUnreadable(page);
    await page.setViewportSize({ width: 1440, height: 460 });
    await expect(recovery).toHaveAttribute("data-page-request-recovery", "failed");
    await waitForLayoutSettled(page);
    const kept = await auditWindow(page);
    expect(observed).toEqual({ actions: 1, documents: 0, errors: [] });

    await page.unrouteAll({ behavior: "wait" });
    await recovery.getByRole("button", { name: "Reintentar" }).click();

    await expect(recovery).toHaveCount(0);
    const retried = await auditWindow(page);
    expect(retried.ids).toEqual(loaded.ids.slice(0, kept.ids.length));
    expect({ start: retried.start, end: retried.end }).toEqual({ start: 1, end: retried.ids.length });
    expect(await clippedAuditRows(page)).toBe(0);
    expect(observed).toEqual({ actions: 2, documents: 0, errors: [] });
  });
});

function informesReportIds(page: Page): Promise<string[]> {
  return page
    .locator(INFORMES.rows)
    .locator("visible=true")
    .evaluateAll((nodes) => nodes.map((node) => node.id));
}

test.describe("a resize whose page request fails on clinic informes", () => {
  test("growing on a phone keeps the loaded rows, and the next page does not skip the records after them", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSurface(page, INFORMES);
    const tall = await informesReportIds(page);

    await page.setViewportSize({ width: 390, height: 600 });
    await expect.poll(async () => (await informesReportIds(page)).length).toBeLessThan(tall.length);
    await settledList(page, INFORMES);
    const loaded = await informesReportIds(page);
    expect(loaded).toEqual(tall.slice(0, loaded.length));

    const observed = observeTab(page);
    const { next, recovery } = controls(page, INFORMES);

    await rejectAsUnrecognized(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(recovery).toHaveAttribute("data-page-request-recovery", "outdated");
    await waitForLayoutSettled(page);
    expect(await informesReportIds(page)).toEqual(loaded);
    expect(observed).toEqual({ actions: 1, documents: 0, errors: [] });

    await page.unrouteAll({ behavior: "wait" });
    await next.click();

    // Pages are aligned to the page size, so the page that holds the record
    // after the last one shown is asked for: that record is on screen.
    await expect.poll(() => informesReportIds(page)).toContain(tall[loaded.length]);
    await expect(recovery).toHaveCount(0);
    expect(observed).toEqual({ actions: 2, documents: 0, errors: [] });
  });
});

test.describe("more resizes while the audit log keeps a window", () => {
  test("the kept window stays on its own page, and the next page continues from its last row", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSurface(page, AUDIT);
    const first = await auditWindow(page);
    const { next, recovery } = controls(page, AUDIT);

    await next.click();
    await expect.poll(async () => (await auditWindow(page)).start).toBe(first.ids.length + 1);
    await settledList(page, AUDIT);
    const second = await auditWindow(page);
    expect(second.ids.filter((id) => first.ids.includes(id))).toEqual([]);
    const observed = observeTab(page);

    await rejectAsUnrecognized(page);
    await page.setViewportSize({ width: 1440, height: 520 });
    await expect(recovery).toHaveAttribute("data-page-request-recovery", "outdated");
    await waitForLayoutSettled(page);
    const afterFirstResize = await auditWindow(page);

    // A second capacity change while the notice is up: no request, and the
    // window is neither moved to another page nor allowed to overflow.
    await page.setViewportSize({ width: 1440, height: 470 });
    await expect.poll(async () => (await auditWindow(page)).ids.length).toBeLessThan(afterFirstResize.ids.length);
    await waitForLayoutSettled(page);
    const kept = await auditWindow(page);
    expect(kept.ids).toEqual(second.ids.slice(0, kept.ids.length));
    expect({ start: kept.start, end: kept.end }).toEqual({ start: second.start, end: second.start + kept.ids.length - 1 });
    expect(await clippedAuditRows(page)).toBe(0);
    expect(observed).toEqual({ actions: 1, documents: 0, errors: [] });

    await page.unrouteAll({ behavior: "wait" });
    await next.click();

    await expect.poll(async () => (await auditWindow(page)).ids[0]).toBe(second.ids[kept.ids.length]);
    const following = await auditWindow(page);
    expect(following.start).toBe(kept.end + 1);
    expect(following.ids.filter((id) => kept.ids.includes(id))).toEqual([]);
    expect(await clippedAuditRows(page)).toBe(0);
    expect(observed).toEqual({ actions: 2, documents: 0, errors: [] });
  });
});
