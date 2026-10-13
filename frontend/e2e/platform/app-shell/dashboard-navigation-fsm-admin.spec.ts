import { expect, test, type Page, type Route } from "@playwright/test";

import { suppressNextDevChrome, waitForLayoutSettled } from "../../helpers/dashboard-geometry-matrix";
import { setAdminSession } from "../../helpers/session";

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD_NAVIGATION_FSM_ADMIN (PR-NAV-03) — the admin dashboard navigates
// through the navigation machine and its interpreter, in a real browser.
//
// The nominal contracts (one payload per switch, single flight, superseded
// commit, abandoned flight, Back during a pending activation) stay where they
// were, untouched: dashboard-real-pointer-navigation and
// dashboard-global-live-navigation-sync. This spec holds what only the machine
// introduces or fixes, row by row of the FSM roadmap (§16, PR-NAV-03):
// restore as option C, normalization of an entry without a module, STALLED and
// its recovery, the error boundary as the only way in and out of FAILED, and
// the rev. 2.3 rows for a click over a pending restore.
//
// Router payloads are held and then CONTINUED, never aborted; a failing
// payload is the real 200 response cut short (the PR-NAV-01 pattern). The
// budget is driven with the page clock, so "nothing happens after the budget"
// is checked after the budget has actually elapsed, not after a sleep.
// ─────────────────────────────────────────────────────────────────────────────

const VIEWPORT = { width: 1366, height: 768 } as const;
const BASE = "/dashboard/admin";
const BARE = "(bare)";
const LAST_MODULE_KEY = "vetneb:dashboard:last-module:admin";
/** DT-5: the navigation budget, plus a margin for the timer to fire. */
const PAST_THE_BUDGET_MS = 10_500;

const BARE_URL = /\/dashboard\/admin$/;
const INTERNAL_DETAIL = /digest|stack|Error:|Connection closed|\bat \S+ \(|This page couldn.t load/i;

type DebugRouter = { push(href: string): void; refresh(): void };
type WindowWithRouter = Window & { next?: { router?: DebugRouter } };

function moduleUrl(moduleId: string): RegExp {
  return new RegExp(`\\/dashboard\\/admin\\?module=${moduleId}$`);
}

function drawer(page: Page) {
  return page.locator('[data-dashboard-navigation-drawer="admin"]').filter({ visible: true });
}

function navItem(page: Page, moduleId: string) {
  return drawer(page).locator(`[data-dashboard-navigation-item="${moduleId}"]`);
}

function errorBoundary(page: Page) {
  return page.locator('[data-route-error-boundary="dashboard"]');
}

function stalledNotice(page: Page) {
  return page.locator('[data-dashboard-navigation-stalled="true"]');
}

/** Stage and navigation agree on one module. */
async function expectShown(page: Page, moduleId: string) {
  await expect(page.locator(`[data-dashboard-module-workspace="${moduleId}"]`)).toBeVisible();
  await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(1);
  const current = drawer(page).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("data-dashboard-navigation-item", moduleId);
}

/** `display = none`: the neutral stage, with no current item. */
async function expectNoModule(page: Page) {
  await expect(page.locator("[data-dashboard-module-stage]")).toBeVisible();
  await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(0);
  await expect(drawer(page).locator('[aria-current="page"]')).toHaveCount(0);
}

function historyLength(page: Page): Promise<number> {
  return page.evaluate(() => window.history.length);
}

function storedModule(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), LAST_MODULE_KEY);
}

/** Stores a last module before the first document only; later loads keep what the app wrote. */
async function seedLastModule(page: Page, moduleId: string) {
  await page.addInitScript(
    ([key, value]) => {
      if (window.sessionStorage.getItem("e2e:last-module-seeded")) return;
      window.sessionStorage.setItem("e2e:last-module-seeded", "1");
      window.localStorage.setItem(key, value);
    },
    [LAST_MODULE_KEY, moduleId] as const,
  );
}

/** A navigation the machine did not issue: the router's own instance. */
function routerPush(page: Page, href: string) {
  return page.evaluate((url) => (window as WindowWithRouter).next?.router?.push(url), href);
}

/** Every main-frame document request after `arm()` is a reload the client router gave up to. */
function watchDocuments(page: Page) {
  const documents: string[] = [];
  let armed = false;
  page.on("request", (request) => {
    if (armed && request.resourceType() === "document" && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  return {
    arm() {
      armed = true;
    },
    documents,
  };
}

/**
 * Router payloads of `/dashboard/admin`, by `?module=`. While recording, every
 * request is listed in order; a held one waits until released and is then
 * continued; a cut one is answered with the leading part of its real 200 body.
 * The matcher names the page path literally: no fixture API route matches it.
 */
async function controlRouterPayloads(page: Page) {
  const held: Route[] = [];
  const requested: string[] = [];
  const cut = new Map<string, number>();
  let recording = false;
  let holding = false;
  const keyOf = (route: Route) => new URL(route.request().url()).searchParams.get("module") ?? BARE;

  await page.route(
    (url) => url.pathname === "/dashboard/admin" && url.searchParams.has("_rsc"),
    async (route) => {
      const key = keyOf(route);
      if (recording) requested.push(key);
      if (cut.has(key)) {
        const response = await route.fetch();
        const body = await response.body();
        const headers = { ...response.headers() };
        delete headers["content-length"];
        delete headers["content-encoding"];
        await route.fulfill({
          status: 200,
          headers,
          body: body.subarray(0, Math.floor(body.length * (cut.get(key) ?? 0.5))),
        });
        return;
      }
      if (holding) {
        held.push(route);
        return;
      }
      await route.continue();
    },
  );

  async function letThrough(routes: Route[]) {
    for (const route of routes) {
      held.splice(held.indexOf(route), 1);
      const continued = await route.continue().then(
        () => true,
        () => false /* the router dropped that navigation */,
      );
      if (continued) await route.request().response();
    }
    return routes.length;
  }

  return {
    record() {
      recording = true;
    },
    hold() {
      recording = true;
      holding = true;
    },
    /** Answers that destination with the leading `fraction` of its real body. */
    cut(moduleId: string, fraction = 0.5) {
      cut.set(moduleId, fraction);
    },
    uncut() {
      cut.clear();
    },
    /** Module of every payload requested while recording, in order. */
    requested: () => [...requested],
    releaseModule: (moduleId: string) => letThrough(held.filter((route) => keyOf(route) === moduleId)),
    async release() {
      holding = false;
      await letThrough([...held]);
    },
  };
}

/**
 * Records, on every DOM mutation from now on, any state whose stage or current
 * item is not `moduleId`: a transient repaint between two commits counts.
 */
async function recordDivergenceFrom(page: Page, moduleId: string) {
  await page.evaluate((id) => {
    const divergence: string[] = [];
    const record = () => {
      const nav = [...document.querySelectorAll('[data-dashboard-navigation-drawer="admin"]')].find(
        (node) => node.getClientRects().length > 0,
      );
      const current =
        nav?.querySelector('[aria-current="page"]')?.getAttribute("data-dashboard-navigation-item") ?? "none";
      const stage = [...document.querySelectorAll("[data-dashboard-module-workspace]")]
        .map((node) => node.getAttribute("data-dashboard-module-workspace"))
        .join(",");
      if (current !== id || stage !== id) divergence.push(`current=${current} stage=${stage}`);
    };
    new MutationObserver(record).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-current", "data-dashboard-module-workspace"],
    });
    (window as Window & { __divergence?: string[] }).__divergence = divergence;
  }, moduleId);
  return () =>
    page.evaluate(() => [...new Set((window as Window & { __divergence?: string[] }).__divergence ?? ["unrecorded"])]);
}

test.describe("DASHBOARD_NAVIGATION_FSM_ADMIN", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await suppressNextDevChrome(page);
    await setAdminSession(page, "populated");
  });

  // ── Restore as option C (DT-8): rows #1–#3 ─────────────────────────────────

  test("restore: a bare entry keeps the neutral stage until the stored module commits, and adds no history entry (R-1, R-5, R-6, S10)", async ({
    page,
  }) => {
    await seedLastModule(page, "admin-pricing");
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto("/");
    payloads.hold();
    await page.goto(BASE);

    // The restore left as one router.replace; until it commits the URL is the
    // bare entry and the stage shows no module, never another module's content.
    await expect.poll(() => payloads.requested()).toEqual(["admin-pricing"]);
    await expect(page).toHaveURL(BARE_URL);
    await expectNoModule(page);
    const length = await historyLength(page);

    reloads.arm();
    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    await expectShown(page, "admin-pricing");
    expect(await historyLength(page), "a restore adds no history entry").toBe(length);
    expect(payloads.requested(), "one payload for the whole restore").toEqual(["admin-pricing"]);
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);

    // R-5: the restored URL is a document of its own, served with one shell,
    // one stage and one workspace (the owner wraps nothing in a boundary whose
    // fallback the server would send next to the page).
    await page.reload();
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    await expectShown(page, "admin-pricing");
    const served = await (await page.request.get(`${BASE}?module=admin-pricing`)).text();
    for (const marker of [
      "data-vetneb-app-shell-surface=",
      "data-dashboard-module-stage=",
      'data-dashboard-module-workspace="admin-pricing"',
    ]) {
      expect(served.split(marker).length - 1, `${marker} in the served document`).toBe(1);
    }

    // R-6: Back leaves for the previous page; Forward returns to the restored module.
    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await page.goForward();
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    await expectShown(page, "admin-pricing");
  });

  for (const { name, stored, entry, landing, restores } of [
    { name: "nothing stored lands on the default module (R-3)", stored: null, entry: BASE, landing: "admin", restores: true },
    { name: "a stored alias lands on its canonical module (R-4)", stored: "maintenance", entry: BASE, landing: "admin-maintenance", restores: true },
    { name: "a stored unknown module lands on the default (R-4)", stored: "bogus", entry: BASE, landing: "admin", restores: true },
    { name: "an explicit module wins over storage and asks for nothing (R-8)", stored: "admin-pricing", entry: `${BASE}?module=admin-sessions`, landing: "admin-sessions", restores: false },
    { name: "a legacy ?hub=1 is normalized to the stored module (R-8)", stored: "admin-pricing", entry: `${BASE}?hub=1`, landing: "admin-pricing", restores: true },
    { name: "an unknown ?module= is normalized to the stored module (R-8)", stored: "admin-pricing", entry: `${BASE}?module=bogus`, landing: "admin-pricing", restores: true },
  ] as const) {
    test(`entry: ${name}`, async ({ page }) => {
      if (stored !== null) await seedLastModule(page, stored);
      const payloads = await controlRouterPayloads(page);
      payloads.record();
      await page.goto(entry);

      await expect(page).toHaveURL(moduleUrl(landing));
      await expectShown(page, landing);
      await page.waitForLoadState("networkidle");
      expect(payloads.requested(), "one router.replace for a restore, none for an explicit module").toEqual(
        restores ? [landing] : [],
      );
      expect(await storedModule(page), "the module the entry confirmed is the one stored").toBe(landing);
    });
  }

  test("L5: Back to an entry without a module is normalized again, and a payload beyond the budget stalls instead of resting there", async ({
    page,
  }) => {
    await page.clock.install();
    await seedLastModule(page, "admin-pricing");
    const payloads = await controlRouterPayloads(page);
    payloads.hold();
    await page.goto(BASE);
    await expect.poll(() => payloads.requested()).toEqual(["admin-pricing"]);

    // A click over the pending restore leaves at once (#10) and lands; the
    // restore is never released, so the bare entry stays behind it in history.
    await navItem(page, "admin-clinics").click();
    await expectShown(page, "admin-clinics");
    await expect.poll(() => payloads.requested()).toEqual(["admin-pricing", "admin-clinics"]);
    expect(await payloads.releaseModule("admin-clinics")).toBeGreaterThan(0);
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    const length = await historyLength(page);

    await page.goBack();
    await expect(page).toHaveURL(BARE_URL);
    await expectNoModule(page);
    // Normalized to the last module the session confirmed, by a replace.
    await expect
      .poll(() => payloads.requested().filter((moduleId) => moduleId === "admin-clinics").length)
      .toBe(2);
    await expect(stalledNotice(page)).toHaveCount(0);

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toBeVisible();
    await expectNoModule(page);

    // The late answer of the stalled normalization is still obeyed (#14).
    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(await historyLength(page), "the normalization replaced the bare entry").toBe(length);
  });

  // ── Budget, STALLED and its recovery (rows #12, #14, #15, #31) ─────────────

  test("STALLED: a payload that never answers shows a recoverable notice within the budget, and Reintentar reloads the destination (L2, L3)", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");

    payloads.hold();
    await navItem(page, "admin-clinics").click();
    await expectShown(page, "admin-clinics");
    await expect(page).toHaveURL(moduleUrl("admin"));
    await expect(stalledNotice(page)).toHaveCount(0);

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    const notice = stalledNotice(page);
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute("role", "status");
    await expectShown(page, "admin-clinics");
    expect(payloads.requested(), "the budget re-issues nothing by itself").toEqual(["admin-clinics"]);

    reloads.arm();
    await notice.getByRole("button", { name: "Reintentar" }).click();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(reloads.documents.length, "the retry is one document navigation to the destination").toBe(1);
    expect(reloads.documents[0]).toMatch(moduleUrl("admin-clinics"));
  });

  test("STALLED with a claimed selection: the relay leaves at the first budget and the notice at the second; the late answer is still obeyed (#31, #12, #14)", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");

    reloads.arm();
    payloads.hold();
    await navItem(page, "admin-clinics").click();
    await navItem(page, "admin-pricing").click();
    await expectShown(page, "admin-pricing");
    expect(payloads.requested(), "the second choice is claimed, not navigated").toEqual(["admin-clinics"]);

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect.poll(() => payloads.requested()).toEqual(["admin-clinics", "admin-pricing"]);
    await expect(stalledNotice(page)).toHaveCount(0);

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toBeVisible();
    expect(payloads.requested(), "a selection is relayed at most once").toEqual(["admin-clinics", "admin-pricing"]);

    expect(await payloads.releaseModule("admin-pricing")).toBeGreaterThan(0);
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    await expectShown(page, "admin-pricing");
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("H-08: a selection behind a pending router.refresh() keeps URL and stage consistent and stalls within the budget, then converges", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");

    // The admin surface mounts no refresh control; this is the same call
    // `DashboardRefreshButton` makes on the clinic surface.
    payloads.hold();
    await page.evaluate(() => (window as WindowWithRouter).next?.router?.refresh());
    await expect.poll(() => payloads.requested()).toEqual(["admin"]);

    await navItem(page, "admin-clinics").click();
    await expectShown(page, "admin-clinics");
    await expect(page).toHaveURL(moduleUrl("admin"));

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toBeVisible();
    await expectShown(page, "admin-clinics");

    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
    await expect(stalledNotice(page)).toHaveCount(0);
  });

  // ── The error boundary is the way in and out of FAILED (rows #20, #21) ─────

  test("boundary: a truncated payload leaves no budget behind, Reintentar recovers without a reload and the next click navigates", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");

    payloads.cut("admin-sessions");
    reloads.arm();
    await navItem(page, "admin-sessions").click();
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).not.toContainText(INTERNAL_DETAIL);
    await expect(page).toHaveURL(moduleUrl("admin-sessions"));

    // The flight's budget was cancelled with the failure: past it, no STALLED.
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(errorBoundary(page)).toBeVisible();
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect(page).toHaveURL(moduleUrl("admin-sessions"));

    payloads.uncut();
    await errorBoundary(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(page).toHaveURL(moduleUrl("admin-sessions"));
    await expectShown(page, "admin-sessions");
    expect(reloads.documents, "recovery is retry(), never a reload").toEqual([]);

    // The owner left FAILED with the boundary: it takes the next selection.
    payloads.record();
    await navItem(page, "admin-clinics").click();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
    expect(payloads.requested()).toEqual(["admin-clinics"]);
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(reloads.documents).toEqual([]);
  });

  test("boundary on the bare entry: the normalization of a failed commit never leaves, and Reintentar issues exactly one (C-9, C-6, C-4)", async ({
    page,
  }) => {
    await page.clock.install();
    await seedLastModule(page, "admin-pricing");
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Entering the dashboard by a client navigation whose payload is cut: the
    // owner's store is created and the boundary mounts in the same commit. The
    // leading third of the payload carries the layout and not the page; a cut
    // at half still renders the entry.
    payloads.cut(BARE, 0.35);
    payloads.record();
    reloads.arm();
    await routerPush(page, BASE);
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-route-error-boundary]")).toHaveCount(1);
    await expect(page).toHaveURL(BARE_URL);

    // HYDRATED opened the restore (#2) and the boundary's NAV_FAILED reached
    // the machine before anything was drained (§12.5.1): the router.replace of
    // that restore was discarded, not issued, and no budget was armed.
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(errorBoundary(page)).toBeVisible();
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect(page).toHaveURL(BARE_URL);
    expect(payloads.requested(), "no restore payload was issued, before or after the failure").toEqual([BARE]);

    payloads.uncut();
    await errorBoundary(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    await expectShown(page, "admin-pricing");
    await page.waitForLoadState("networkidle");
    // C-4: the stored module survived the failure, because HYDRATED reached
    // the machine first. C-6: "Reintentar" resets and the unmount that follows
    // resets again; one normalization leaves, not two.
    expect(
      payloads.requested().filter((moduleId) => moduleId === "admin-pricing"),
      "Reintentar and the unmount that follows issue one normalization, to the stored module",
    ).toEqual(["admin-pricing"]);

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expectShown(page, "admin-pricing");
    expect(reloads.documents, "recovery is retry(), never a reload").toEqual([]);
  });

  test("boundary in a later commit than the restore: its budget is cancelled and the late commit does not leave FAILED (C-9)", async ({
    page,
  }) => {
    await page.clock.install();
    await seedLastModule(page, "admin-pricing");
    const payloads = await controlRouterPayloads(page);
    payloads.hold();
    await page.goto(BASE);
    await expect.poll(() => payloads.requested()).toEqual(["admin-pricing"]);

    payloads.cut("admin-sessions");
    await navItem(page, "admin-sessions").click();
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);

    // The restore answers now. Whether the router still commits it or not, the
    // boundary stays (the pathname did not change) and so does FAILED.
    await payloads.release();
    await waitForLayoutSettled(page);
    await expect(errorBoundary(page)).toBeVisible();
    await expect(stalledNotice(page)).toHaveCount(0);

    payloads.uncut();
    await errorBoundary(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    const landed = new URL(page.url()).searchParams.get("module");
    expect(landed, "the owner rests on a module, not on the bare entry").not.toBeNull();
    await expectShown(page, String(landed));
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
  });

  test("boundary: Back inside the admin dashboard keeps it mounted, and Reintentar lands on the URL Back chose (C-6)", async ({
    page,
  }) => {
    const payloads = await controlRouterPayloads(page);
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");
    await navItem(page, "admin-clinics").click();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
    await page.waitForLoadState("networkidle");

    payloads.cut("admin-sessions");
    await navItem(page, "admin-sessions").click();
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });

    // A query change without a pathname change does not reset the boundary.
    await page.goBack();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await waitForLayoutSettled(page);
    await expect(errorBoundary(page)).toBeVisible();

    payloads.uncut();
    await errorBoundary(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
  });

  test("boundary: a click on the navigation is not dead while it is visible, and the owner reconciles on Reintentar (C-6, DT-10)", async ({
    page,
  }) => {
    // Below 768px the mobile bar belongs to the shell, not to the page, so it
    // is the navigation that stays on screen next to the boundary. From 768px
    // up the boundary replaces the whole page, band and app bar included.
    await page.setViewportSize({ width: 390, height: 844 });
    const bar = page.locator('[data-dashboard-mobile-nav="admin"]').filter({ visible: true });
    const barItem = (moduleId: string) => bar.locator(`[data-dashboard-mobile-nav-item="${moduleId}"]`);
    const payloads = await controlRouterPayloads(page);
    await page.goto(`${BASE}?module=admin`);
    await expect(page.locator('[data-dashboard-module-workspace="admin"]')).toBeVisible();
    await page.waitForLoadState("networkidle");

    payloads.cut("admin-sessions");
    await barItem("admin-sessions").click();
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });

    // The owner does not claim in FAILED, so the control navigates on its own.
    payloads.uncut();
    await barItem("admin-clinics").click();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await page.waitForLoadState("networkidle");
    await waitForLayoutSettled(page);
    await expect(errorBoundary(page)).toBeVisible();

    await errorBoundary(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expect(page.locator('[data-dashboard-module-workspace="admin-clinics"]')).toBeVisible();
    await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(1);
    const current = bar.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("data-dashboard-mobile-nav-item", "admin-clinics");
  });

  test("leaving the dashboard with a restore in flight or with the boundary visible leaves nothing running (C-9, C-6)", async ({
    page,
  }) => {
    await page.clock.install();
    await seedLastModule(page, "admin-pricing");
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    payloads.hold();
    await page.goto(BASE);
    await expect.poll(() => payloads.requested()).toEqual(["admin-pricing"]);

    // The restore is in flight and its budget armed when the owner unmounts.
    reloads.arm();
    await routerPush(page, "/");
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL((url) => url.pathname === "/");
    expect(payloads.requested(), "the unmounted owner issues nothing").toEqual(["admin-pricing"]);

    // Back in with a fresh owner, then out again with the boundary visible.
    await payloads.release();
    await routerPush(page, `${BASE}?module=admin`);
    await expect(page).toHaveURL(moduleUrl("admin"));
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");
    payloads.cut("admin-sessions");
    await navItem(page, "admin-sessions").click();
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });

    const before = payloads.requested().length;
    await routerPush(page, "/");
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL((url) => url.pathname === "/");
    expect(payloads.requested().length, "the boundary's exit navigates nothing").toBe(before);
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });

  // ── Traversals (rows #17, #18, #24, #28; C-8, C-10) ────────────────────────

  test("Back then Forward, and Back then the committed module, never stall (C-8, L6)", async ({ page }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");
    await navItem(page, "admin-clinics").click();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
    await page.waitForLoadState("networkidle");

    payloads.hold();
    await page.goBack();
    await page.goForward();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expectShown(page, "admin-clinics");

    await page.goBack();
    await expect(page).toHaveURL(moduleUrl("admin"));
    await navItem(page, "admin").click();
    await expectShown(page, "admin");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect(page).toHaveURL(moduleUrl("admin"));
    await expectShown(page, "admin");
    await payloads.release();
  });

  test("Back and two clicks before any payload: the last click lands and nothing normalizes over it (C-10, S13)", async ({
    page,
  }) => {
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");
    await navItem(page, "admin-clinics").click();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
    await page.waitForLoadState("networkidle");
    const length = await historyLength(page);

    reloads.arm();
    payloads.hold();
    await page.goBack();
    await navItem(page, "admin-sessions").click();
    await navItem(page, "admin-pricing").click();
    await expectShown(page, "admin-pricing");
    const divergence = await recordDivergenceFrom(page, "admin-pricing");

    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    await expectShown(page, "admin-pricing");
    expect(await divergence(), "the view passed through another module after the last click").toEqual([]);
    expect(payloads.requested().includes(BARE), "no normalization of a bare entry").toBe(false);
    expect(await historyLength(page), "the burst replaced the entry Back had left ahead").toBe(length);

    await page.goBack();
    await expect(page).toHaveURL(moduleUrl("admin"));
    await expectShown(page, "admin");
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("Back and Forward: no painted frame shows a URL and a stage that disagree (S1)", async ({ page }) => {
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");
    await navItem(page, "admin-clinics").click();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
    await page.waitForLoadState("networkidle");

    await page.evaluate(() => {
      const mismatches: string[] = [];
      const sample = () => {
        const url = new URLSearchParams(window.location.search).get("module") ?? "none";
        const stage =
          document.querySelector("[data-dashboard-module-workspace]")?.getAttribute("data-dashboard-module-workspace") ??
          "none";
        if (url !== stage) mismatches.push(`url=${url} stage=${stage}`);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      (window as Window & { __mismatches?: string[] }).__mismatches = mismatches;
    });

    await page.goBack();
    await expect(page).toHaveURL(moduleUrl("admin"));
    await expectShown(page, "admin");
    await page.goForward();
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
    await waitForLayoutSettled(page);
    expect(
      await page.evaluate(() => (window as Window & { __mismatches?: string[] }).__mismatches ?? ["unrecorded"]),
    ).toEqual([]);
  });

  // ── Rev. 2.3: a click over a pending restore (rows #10, #11, #32) ──────────

  for (const first of ["the click", "the restore"] as const) {
    test(`a click over the pending restore adds one entry when ${first} answers first (C-11, E7)`, async ({
      page,
    }) => {
      await seedLastModule(page, "admin-pricing");
      const payloads = await controlRouterPayloads(page);
      const reloads = watchDocuments(page);
      payloads.hold();
      await page.goto(BASE);
      await expect.poll(() => payloads.requested()).toEqual(["admin-pricing"]);
      const length = await historyLength(page);

      reloads.arm();
      await navItem(page, "admin-clinics").click();
      await expectShown(page, "admin-clinics");
      await expect
        .poll(() => payloads.requested(), { message: "over a restore the click leaves at once" })
        .toEqual(["admin-pricing", "admin-clinics"]);
      const divergence = await recordDivergenceFrom(page, "admin-clinics");

      expect(
        await payloads.releaseModule(first === "the click" ? "admin-clinics" : "admin-pricing"),
      ).toBeGreaterThan(0);
      await waitForLayoutSettled(page);
      await payloads.release();
      await expect(page).toHaveURL(moduleUrl("admin-clinics"));
      await expectShown(page, "admin-clinics");
      expect(await divergence(), "the restored module repainted after the click").toEqual([]);
      expect(await historyLength(page), "one entry for the click, none for the restore").toBe(length + 1);
      expect(await storedModule(page)).toBe("admin-clinics");
      expect(reloads.documents, "client navigation, never a reload").toEqual([]);
    });
  }

  test("a click over the pending restore and then the restored module rests on it with no extra entry (C-11, #32)", async ({
    page,
  }) => {
    await seedLastModule(page, "admin-pricing");
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    payloads.hold();
    await page.goto(BASE);
    await expect.poll(() => payloads.requested()).toEqual(["admin-pricing"]);
    const length = await historyLength(page);

    reloads.arm();
    await navItem(page, "admin-clinics").click();
    await expectShown(page, "admin-clinics");
    await navItem(page, "admin-pricing").click();
    await expectShown(page, "admin-pricing");
    expect(payloads.requested(), "the second choice is claimed by the click in flight").toEqual([
      "admin-pricing",
      "admin-clinics",
    ]);
    const divergence = await recordDivergenceFrom(page, "admin-pricing");

    // The restore answers first. If the router still commits it, it commits
    // the very module the flight had claimed and the owner rests there (#32);
    // if the click's push had already discarded it, the click lands and the
    // claimed module replaces its entry (#30). Either way the view never
    // leaves the module chosen last and the burst adds at most the click's
    // one entry.
    expect(await payloads.releaseModule("admin-pricing")).toBeGreaterThan(0);
    await waitForLayoutSettled(page);
    await expectShown(page, "admin-pricing");
    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    await expectShown(page, "admin-pricing");
    await page.waitForLoadState("networkidle");
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    await expectShown(page, "admin-pricing");
    expect(await divergence(), "the abandoned click repainted its module").toEqual([]);

    const added = (await historyLength(page)) - length;
    test.info().annotations.push({
      type: "H1 for a push over a pending restore",
      description: `entries added: ${added} (0 = the restore committed, row #32; 1 = the push discarded it, row #30)`,
    });
    expect([0, 1]).toContain(added);
    expect(await storedModule(page)).toBe("admin-pricing");
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("another navigation commits the claimed selection: the owner rests on it and drops its own flight (#32)", async ({
    page,
  }) => {
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");

    reloads.arm();
    payloads.hold();
    await navItem(page, "admin-clinics").click();
    await navItem(page, "admin-pricing").click();
    await expectShown(page, "admin-pricing");
    expect(payloads.requested(), "the second choice is claimed").toEqual(["admin-clinics"]);
    const divergence = await recordDivergenceFrom(page, "admin-pricing");

    // A commit of the claimed module that the owner did not issue: the history
    // write the router itself performs for a navigation, synced into the
    // search params (the same injection the superseded-commit block uses).
    await page.evaluate((url) => window.history.pushState(null, "", url), `${BASE}?module=admin-pricing`);
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    // #32 rests there and discards the flight in the router with a push to the
    // URL it already shows, which asks for one payload of its own.
    await expect.poll(() => payloads.requested()).toEqual(["admin-clinics", "admin-pricing"]);
    expect(await storedModule(page), "the commit the owner rests on is stored").toBe("admin-pricing");

    await payloads.release();
    await page.waitForLoadState("networkidle");
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    await expectShown(page, "admin-pricing");
    expect(await divergence(), "the dropped flight repainted its module").toEqual([]);
    expect(payloads.requested(), "no continuation after resting").toEqual(["admin-clinics", "admin-pricing"]);
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("residual, recorded as it is: a payload held past the budget that answers before its relay may leave its own entry (C-11, DT-15)", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");
    const length = await historyLength(page);

    reloads.arm();
    payloads.hold();
    await navItem(page, "admin-clinics").click();
    await navItem(page, "admin-pricing").click();
    await expectShown(page, "admin-pricing");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect.poll(() => payloads.requested()).toEqual(["admin-clinics", "admin-pricing"]);
    const divergence = await recordDivergenceFrom(page, "admin-pricing");

    // The abandoned payload answers first. It is never painted; whether it
    // also writes an entry depends on how the router folds the two commits.
    expect(await payloads.releaseModule("admin-clinics")).toBeGreaterThan(0);
    await waitForLayoutSettled(page);
    await expectShown(page, "admin-pricing");
    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("admin-pricing"));
    await expectShown(page, "admin-pricing");
    expect(await divergence(), "the abandoned module repainted").toEqual([]);

    const added = (await historyLength(page)) - length;
    test.info().annotations.push({
      type: "residual DT-15",
      description: `entries added by the burst: ${added} (1 = folded, 2 = the abandoned navigation left its own)`,
    });
    expect([1, 2]).toContain(added);
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  // ── Persistence on acceptance (row #25, C-11b) ─────────────────────────────

  test("S15: returning to a module that committed while another was claimed stores it, and a bare entry restores it", async ({
    page,
  }) => {
    const payloads = await controlRouterPayloads(page);
    await page.goto(`${BASE}?module=admin`);
    await expectShown(page, "admin");
    await page.waitForLoadState("networkidle");
    expect(await storedModule(page)).toBe("admin");

    payloads.hold();
    await navItem(page, "admin-clinics").click();
    await navItem(page, "admin-pricing").click();
    await expectShown(page, "admin-pricing");
    // The flight lands and its continuation leaves: the URL is the landed
    // module, recorded but not stored, and the stage is the claimed one.
    expect(await payloads.releaseModule("admin-clinics")).toBeGreaterThan(0);
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expect.poll(() => payloads.requested()).toEqual(["admin-clinics", "admin-pricing"]);
    await expectShown(page, "admin-pricing");
    expect(await storedModule(page), "a module nobody accepted is not stored").toBe("admin");

    await navItem(page, "admin-clinics").click();
    await expectShown(page, "admin-clinics");
    await expect.poll(() => storedModule(page)).toBe("admin-clinics");
    await payloads.release();
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");

    await page.goto(BASE);
    await expect(page).toHaveURL(moduleUrl("admin-clinics"));
    await expectShown(page, "admin-clinics");
  });
});
