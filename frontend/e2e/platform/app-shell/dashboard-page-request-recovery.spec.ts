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
