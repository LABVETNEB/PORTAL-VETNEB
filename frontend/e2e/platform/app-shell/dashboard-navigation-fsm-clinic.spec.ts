import { expect, test, type Page, type Route } from "@playwright/test";

import { suppressNextDevChrome, waitForLayoutSettled } from "../../helpers/dashboard-geometry-matrix";
import { setClinicSession } from "../../helpers/session";

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD_NAVIGATION_FSM_CLINIC (PR-NAV-04) — the clinic shell and its hub
// navigate through the navigation machine and its interpreter, in a real
// browser.
//
// The nominal contracts (one payload per switch, single flight, superseded
// commit, abandoned flight, the burst that leaves the hub, the full-route
// hand-over, Back during a pending activation) stay where they were:
// dashboard-real-pointer-navigation and dashboard-global-live-navigation-sync.
// This spec holds what only the machine introduces or fixes on the clinic
// surface, row by row of the FSM roadmap (§16, PR-NAV-04): the restore of the
// last module (D-12, dead until now), STALLED and its recovery, the error
// boundary across a pathname change (C-6), a failure during the initial
// restore (C-9, with DT-13 still pending and recorded as it is), and the
// rev. 2.3 rows for a click over a pending restore.
//
// Router payloads are held and then CONTINUED, never aborted; a failing
// payload is the real 200 response cut short (the PR-NAV-01 pattern). The
// budget is driven with the page clock, so "nothing happens after the budget"
// is checked after the budget has actually elapsed, not after a sleep.
// ─────────────────────────────────────────────────────────────────────────────

const VIEWPORT = { width: 1366, height: 768 } as const;
const BASE = "/dashboard";
/** Payload of the bare `/dashboard`: the canonical URL of the default module. */
const BARE = "(bare)";
const HUB = "(hub)";
const DEFAULT_MODULE = "operaciones";
const INFORMES_ROUTE = "/dashboard/informes";
const LOGISTICA_ROUTE = "/dashboard/logistica";
const LAST_MODULE_KEY = "vetneb:dashboard:last-module:clinic";
/** DT-5: the navigation budget, plus a margin for the timer to fire. */
const PAST_THE_BUDGET_MS = 10_500;

const BARE_URL = /\/dashboard$/;
const HUB_URL = /\/dashboard\?hub=1$/;
const INTERNAL_DETAIL = /digest|stack|Error:|Connection closed|\bat \S+ \(|This page couldn.t load/i;

type DebugRouter = { push(href: string): void; refresh(): void };
type WindowWithRouter = Window & { next?: { router?: DebugRouter } };

function moduleUrl(moduleId: string): RegExp {
  return new RegExp(`\\/dashboard\\?module=${moduleId}$`);
}

function routeUrl(path: string): RegExp {
  return new RegExp(`${path.replace(/\//g, "\\/")}$`);
}

function drawer(page: Page) {
  return page.locator('[data-dashboard-navigation-drawer="clinic"]').filter({ visible: true });
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

/** The hub is a stage without a module. */
async function expectHub(page: Page) {
  await expect(page.locator("[data-clinic-dashboard-stage]")).toBeVisible();
  await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(0);
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
 * Router payloads of the clinic pages. On `/dashboard` the key is its
 * `?module=`, `(hub)` or `(bare)`; on a full route, its path. While recording,
 * every navigation payload is listed in order; a held one waits until released
 * and is then continued; a cut one is answered with the leading part of its
 * real 200 body. Prefetches are let through and never listed. The matcher
 * names the page paths literally: no fixture API route matches it.
 */
async function controlRouterPayloads(page: Page) {
  const held: Route[] = [];
  const requested: string[] = [];
  const cut = new Map<string, number>();
  let recording = false;
  let holding = false;
  const keyOf = (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/dashboard") return url.pathname;
    if (url.searchParams.get("hub") === "1") return HUB;
    return url.searchParams.get("module") ?? BARE;
  };

  await page.route(
    (url) =>
      (url.pathname === "/dashboard" ||
        url.pathname === "/dashboard/informes" ||
        url.pathname === "/dashboard/logistica") &&
      url.searchParams.has("_rsc"),
    async (route) => {
      if (route.request().headers()["next-router-prefetch"] !== undefined) {
        await route.continue();
        return;
      }
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
    cut(key: string, fraction = 0.5) {
      cut.set(key, fraction);
    },
    uncut() {
      cut.clear();
    },
    /** Key of every navigation payload requested while recording, in order. */
    requested: () => [...requested],
    releaseOnly: (key: string) => letThrough(held.filter((route) => keyOf(route) === key)),
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
      const nav = [...document.querySelectorAll('[data-dashboard-navigation-drawer="clinic"]')].find(
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

test.describe("DASHBOARD_NAVIGATION_FSM_CLINIC", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await suppressNextDevChrome(page);
    await setClinicSession(page, "populated");
  });

  // ── Restore as option C (DT-8): rows #1 and #2. Closes D-12 ────────────────

  test("restore: a bare entry shows the default module until the stored one commits, and adds no history entry (R-2, R-5, R-6, D-12, S10)", async ({
    page,
  }) => {
    await seedLastModule(page, "logistica");
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto("/");
    payloads.hold();
    await page.goto(BASE);

    // The restore left as one router.replace; until it commits the URL is the
    // bare entry and the stage shows what that URL means, the default module.
    await expect.poll(() => payloads.requested()).toEqual(["logistica"]);
    await expect(page).toHaveURL(BARE_URL);
    await expectShown(page, DEFAULT_MODULE);
    expect(await storedModule(page), "a pending restore does not overwrite the stored module").toBe("logistica");
    const length = await historyLength(page);

    reloads.arm();
    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("logistica"));
    await expectShown(page, "logistica");
    expect(await historyLength(page), "a restore adds no history entry").toBe(length);
    expect(payloads.requested(), "one payload for the whole restore").toEqual(["logistica"]);
    expect(await storedModule(page)).toBe("logistica");
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);

    // R-5: the restored URL is a document of its own, served with one stage
    // and one workspace, the restored one.
    await page.reload();
    await expect(page).toHaveURL(moduleUrl("logistica"));
    await expectShown(page, "logistica");
    const served = await (await page.request.get(`${BASE}?module=logistica`)).text();
    for (const marker of ["data-clinic-dashboard-stage=", 'data-dashboard-module-workspace="logistica"']) {
      expect(served.split(marker).length - 1, `${marker} in the served document`).toBe(1);
    }

    // R-6: Back leaves for the previous page; Forward returns to the restored module.
    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await page.goForward();
    await expect(page).toHaveURL(moduleUrl("logistica"));
    await expectShown(page, "logistica");
  });

  for (const { name, stored, entry, url, shown, storedAfter } of [
    { name: "nothing stored rests on the default module (R-3)", stored: null, entry: BASE, url: BARE_URL, shown: DEFAULT_MODULE, storedAfter: DEFAULT_MODULE },
    { name: "the default module stored is not a navigation (R-3)", stored: DEFAULT_MODULE, entry: BASE, url: BARE_URL, shown: DEFAULT_MODULE, storedAfter: DEFAULT_MODULE },
    { name: "a stored unknown module rests on the default (R-4)", stored: "bogus", entry: BASE, url: BARE_URL, shown: DEFAULT_MODULE, storedAfter: DEFAULT_MODULE },
    { name: "an explicit module wins over storage (R-8)", stored: "logistica", entry: `${BASE}?module=informes`, url: moduleUrl("informes"), shown: "informes", storedAfter: "informes" },
    { name: "an unknown ?module= keeps its URL and shows the default (R-8)", stored: "logistica", entry: `${BASE}?module=bogus`, url: moduleUrl("bogus"), shown: DEFAULT_MODULE, storedAfter: DEFAULT_MODULE },
    { name: "the hub is not restored over and stores nothing (R-8)", stored: "logistica", entry: `${BASE}?hub=1`, url: HUB_URL, shown: null, storedAfter: "logistica" },
  ] as const) {
    test(`entry: ${name}`, async ({ page }) => {
      if (stored !== null) await seedLastModule(page, stored);
      const payloads = await controlRouterPayloads(page);
      payloads.record();
      await page.goto(entry);

      await expect(page).toHaveURL(url);
      if (shown === null) await expectHub(page);
      else await expectShown(page, shown);
      await expect.poll(() => storedModule(page)).toBe(storedAfter);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(url);
      expect(payloads.requested(), "an entry that restores nothing asks for nothing").toEqual([]);
    });
  }

  test("R-5: the module chosen in one visit is the one the next bare entry restores", async ({ page }) => {
    const payloads = await controlRouterPayloads(page);
    await page.goto(BASE);
    await expectShown(page, DEFAULT_MODULE);
    await page.waitForLoadState("networkidle");

    await navItem(page, "tokens").click();
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
    await expect.poll(() => storedModule(page)).toBe("tokens");

    payloads.record();
    await page.goto(BASE);
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
    expect(payloads.requested()).toEqual(["tokens"]);
  });

  // ── Hub ↔ module, and the history a visit leaves (rows #5, #17, #18, #22) ──

  test("hub: hub → module → Back returns to the hub, module → hub rests there, and A→B→A leaves one entry per choice", async ({
    page,
  }) => {
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?hub=1`);
    await expectHub(page);
    await page.locator("[data-public-route-control-hydrated]").first().waitFor({ state: "attached" });
    await page.waitForLoadState("networkidle");
    const length = await historyLength(page);

    reloads.arm();
    payloads.record();
    await navItem(page, "informes").click();
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");
    expect(await historyLength(page)).toBe(length + 1);

    await page.goBack();
    await expect(page).toHaveURL(HUB_URL);
    await expectHub(page);
    await page.goForward();
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");

    // Module → hub: the hub URL commits by a navigation the owner did not
    // issue (no control of the product links to the hub) and the stage follows.
    await routerPush(page, `${BASE}?hub=1`);
    await expect(page).toHaveURL(HUB_URL);
    await expectHub(page);
    expect(await storedModule(page), "the hub stores nothing").toBe("informes");

    // A → B → A from the hub: one payload and one entry per choice.
    const before = await historyLength(page);
    const asked = payloads.requested().length;
    for (const moduleId of ["tokens", "logistica", "tokens"]) {
      await navItem(page, moduleId).click();
      await expect(page).toHaveURL(moduleUrl(moduleId));
      await expectShown(page, moduleId);
    }
    expect(payloads.requested().slice(asked)).toEqual(["tokens", "logistica", "tokens"]);
    expect(await historyLength(page)).toBe(before + 3);
    await page.goBack();
    await expect(page).toHaveURL(moduleUrl("logistica"));
    await expectShown(page, "logistica");
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("the default module is navigated to as the bare URL, and returning to it while it is committed adds no entry (#5, #25)", async ({
    page,
  }) => {
    const payloads = await controlRouterPayloads(page);
    await page.goto(`${BASE}?module=tokens`);
    await expectShown(page, "tokens");
    await page.waitForLoadState("networkidle");

    await navItem(page, DEFAULT_MODULE).click();
    await expect(page).toHaveURL(BARE_URL);
    await expectShown(page, DEFAULT_MODULE);
    await page.waitForLoadState("networkidle");
    const length = await historyLength(page);

    // Informes in flight, then the committed module again: row #25 pushes the
    // URL the router already shows, which discards Informes and writes nothing.
    payloads.hold();
    await navItem(page, "informes").click();
    await expectShown(page, "informes");
    await navItem(page, DEFAULT_MODULE).click();
    await expectShown(page, DEFAULT_MODULE);
    await expect.poll(() => payloads.requested()).toEqual(["informes", BARE]);
    await payloads.release();
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL(BARE_URL);
    await expectShown(page, DEFAULT_MODULE);
    expect(await historyLength(page), "the return added no entry").toBe(length);
    await page.goBack();
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
  });

  test("the default module committed as ?module=operaciones is returned to by a push of that very URL, with no entry (#25)", async ({
    page,
  }) => {
    const payloads = await controlRouterPayloads(page);
    await page.goto(`${BASE}?module=${DEFAULT_MODULE}`);
    await expectShown(page, DEFAULT_MODULE);
    await page.waitForLoadState("networkidle");
    const length = await historyLength(page);

    // The committed location has two spellings. Row #25 pushes the one the
    // router shows: the bare one would be another URL and would add an entry.
    payloads.hold();
    await navItem(page, "informes").click();
    await expectShown(page, "informes");
    await navItem(page, DEFAULT_MODULE).click();
    await expectShown(page, DEFAULT_MODULE);
    await expect.poll(() => payloads.requested()).toEqual(["informes", DEFAULT_MODULE]);
    await payloads.release();
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL(moduleUrl(DEFAULT_MODULE));
    await expectShown(page, DEFAULT_MODULE);
    expect(await historyLength(page), "the return added no entry").toBe(length);
  });

  test("a full route entered directly stores its module, and the next bare entry restores it (§12.1, #1)", async ({
    page,
  }) => {
    await seedLastModule(page, "tokens");
    const payloads = await controlRouterPayloads(page);
    payloads.record();
    await page.goto(INFORMES_ROUTE);
    await expect(page.locator('[data-dashboard-module-workspace="informes-full"]')).toBeVisible();
    await expect.poll(() => storedModule(page)).toBe("informes");
    await page.waitForLoadState("networkidle");
    expect(payloads.requested(), "a full route restores nothing").toEqual([]);

    await page.goto(BASE);
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");
    expect(payloads.requested()).toEqual(["informes"]);
  });

  // ── Budget, STALLED and its recovery (rows #12, #14, #15, #31) ─────────────

  test("STALLED: a payload that never answers shows a recoverable notice within the budget, and Reintentar reloads the destination (L2, L3)", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(BASE);
    await expectShown(page, DEFAULT_MODULE);
    await page.waitForLoadState("networkidle");

    payloads.hold();
    await navItem(page, "informes").click();
    await expectShown(page, "informes");
    await expect(page).toHaveURL(BARE_URL);
    await expect(stalledNotice(page)).toHaveCount(0);

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    const notice = stalledNotice(page);
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute("role", "status");
    await expectShown(page, "informes");
    expect(payloads.requested(), "the budget re-issues nothing by itself").toEqual(["informes"]);

    reloads.arm();
    await notice.getByRole("button", { name: "Reintentar" }).click();
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(reloads.documents.length, "the retry is one document navigation to the destination").toBe(1);
    expect(reloads.documents[0]).toMatch(moduleUrl("informes"));
  });

  test("STALLED with a claimed selection: the relay leaves at the first budget and the notice at the second; the late answer is still obeyed (#31, #12, #14)", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(BASE);
    await expectShown(page, DEFAULT_MODULE);
    await page.waitForLoadState("networkidle");

    reloads.arm();
    payloads.hold();
    await navItem(page, "informes").click();
    await navItem(page, "tokens").click();
    await expectShown(page, "tokens");
    expect(payloads.requested(), "the second choice is claimed, not navigated").toEqual(["informes"]);

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect.poll(() => payloads.requested()).toEqual(["informes", "tokens"]);
    await expect(stalledNotice(page)).toHaveCount(0);

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toBeVisible();
    expect(payloads.requested(), "a selection is relayed at most once").toEqual(["informes", "tokens"]);

    expect(await payloads.releaseOnly("tokens")).toBeGreaterThan(0);
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("H-08: a selection behind a pending router.refresh() keeps URL and stage consistent and stalls within the budget, then converges", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    await page.goto(`${BASE}?module=informes`);
    await expectShown(page, "informes");
    await page.waitForLoadState("networkidle");

    // The call `DashboardRefreshButton` and `UploadReportModal` make. The
    // machine never issues one (DT-2); it only has to survive it.
    payloads.hold();
    await page.evaluate(() => (window as WindowWithRouter).next?.router?.refresh());
    await expect.poll(() => payloads.requested()).toEqual(["informes"]);

    await navItem(page, "tokens").click();
    await expectShown(page, "tokens");
    await expect(page).toHaveURL(moduleUrl("informes"));

    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toBeVisible();
    await expectShown(page, "tokens");

    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
    await expect(stalledNotice(page)).toHaveCount(0);
  });

  // ── The error boundary is the way in and out of FAILED (rows #20, #21) ─────

  test("boundary: a truncated module payload leaves no budget behind, Reintentar recovers without a reload and the next click navigates", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(BASE);
    await expectShown(page, DEFAULT_MODULE);
    await page.waitForLoadState("networkidle");

    payloads.cut("tokens");
    reloads.arm();
    await navItem(page, "tokens").click();
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).not.toContainText(INTERNAL_DETAIL);
    await expect(page).toHaveURL(moduleUrl("tokens"));

    // The flight's budget was cancelled with the failure: past it, no STALLED.
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(errorBoundary(page)).toBeVisible();
    await expect(stalledNotice(page)).toHaveCount(0);

    payloads.uncut();
    await errorBoundary(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
    expect(reloads.documents, "recovery is retry(), never a reload").toEqual([]);

    // The owner left FAILED with the boundary: it takes the next selection.
    payloads.record();
    await navItem(page, "informes").click();
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");
    expect(payloads.requested()).toEqual(["informes"]);
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(reloads.documents).toEqual([]);
  });

  test("boundary: a click on the navigation is not dead while it is visible, and the owner reconciles on Reintentar (C-6, DT-10)", async ({
    page,
  }) => {
    // Below 768px the mobile bar belongs to the shell, not to the page, so it
    // is the navigation that stays on screen next to the boundary. From 768px
    // up the boundary replaces the whole page, band and app bar included.
    await page.setViewportSize({ width: 390, height: 844 });
    const bar = page.locator('[data-dashboard-mobile-nav="clinic"]').filter({ visible: true });
    const barItem = (moduleId: string) => bar.locator(`[data-dashboard-mobile-nav-item="${moduleId}"]`);
    const payloads = await controlRouterPayloads(page);
    await page.goto(`${BASE}?module=informes`);
    await expect(page.locator('[data-dashboard-module-workspace="informes"]')).toBeVisible();
    await page.waitForLoadState("networkidle");

    payloads.cut("tokens");
    await barItem("tokens").click();
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });

    // The owner does not claim in FAILED, so the control navigates on its own.
    payloads.uncut();
    await barItem("logistica").click();
    await expect(page).toHaveURL(moduleUrl("logistica"));
    await page.waitForLoadState("networkidle");
    await waitForLayoutSettled(page);
    await expect(errorBoundary(page)).toBeVisible();

    await errorBoundary(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(page).toHaveURL(moduleUrl("logistica"));
    await expect(page.locator('[data-dashboard-module-workspace="logistica"]')).toBeVisible();
    await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(1);
    const current = bar.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("data-dashboard-mobile-nav-item", "logistica");
  });

  test("C-6: a truncated payload on a full route mounts the boundary; Back to /dashboard drops it without Reintentar and the owner navigates again", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?module=informes`);
    await expectShown(page, "informes");
    await page.waitForLoadState("networkidle");

    // "Abrir módulo completo" is the control's own push, not migrated here.
    payloads.cut(INFORMES_ROUTE);
    reloads.arm();
    await page.getByRole("button", { name: "Abrir módulo completo de informes" }).filter({ visible: true }).click();
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(routeUrl(INFORMES_ROUTE));
    await expect(page.locator("body")).not.toContainText(INTERNAL_DETAIL);
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);

    // The pathname changes: Next drops the boundary on its own, with no retry.
    payloads.uncut();
    payloads.record();
    await page.goBack();
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    await expectShown(page, "informes");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);

    // The owner is out of FAILED: it takes the next click, and a second one
    // made before the first lands is claimed instead of pushed (#29).
    payloads.hold();
    const asked = payloads.requested().length;
    await navItem(page, "tokens").click();
    await navItem(page, "perfil").click();
    await expectShown(page, "perfil");
    expect(payloads.requested().slice(asked), "the owner navigates the click and claims the next").toEqual(["tokens"]);
    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("perfil"));
    await expectShown(page, "perfil");
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("C-6, symmetric: a failure on /dashboard is left behind by navigating to a full route, and the owner navigates from there", async ({
    page,
  }) => {
    await page.clock.install();
    const runtimeErrors: string[] = [];
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(LOGISTICA_ROUTE);
    await expect(page.locator('[data-dashboard-module-workspace="logistica-full"]')).toBeVisible();
    await page.waitForLoadState("networkidle");
    await navItem(page, "tokens").click();
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
    await page.waitForLoadState("networkidle");

    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    payloads.cut("perfil");
    reloads.arm();
    await navItem(page, "perfil").click();
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(moduleUrl("perfil"));

    // Back inside /dashboard: a query change does not reset the boundary.
    await page.goBack();
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await waitForLayoutSettled(page);
    await expect(errorBoundary(page)).toBeVisible();

    // Back again leaves /dashboard for the full route: the boundary goes.
    payloads.uncut();
    await page.goBack();
    await expect(page).toHaveURL(routeUrl(LOGISTICA_ROUTE));
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('[data-dashboard-module-workspace="logistica-full"]')).toBeVisible();
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);

    payloads.hold();
    const asked = payloads.requested().length;
    await navItem(page, "informes").click();
    await navItem(page, "perfil").click();
    expect(payloads.requested().slice(asked), "the owner navigates the click and claims the next").toEqual(["informes"]);
    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("perfil"));
    await expectShown(page, "perfil");
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("C-9: a failed entry drops the pending restore; Reintentar rests on the default module and, with DT-13 pending, stores it", async ({
    page,
  }) => {
    await page.clock.install();
    await seedLastModule(page, "logistica");
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Entering the dashboard by a client navigation whose payload is cut: the
    // owner's store is created and the boundary mounts in the same commit. The
    // cut has to fall inside the page: measured, the boundary mounts for a cut
    // between 15 % and 30 % of this payload; from 35 % up the entry renders.
    payloads.cut(BARE, 0.22);
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
    await expect(page).toHaveURL(BARE_URL);
    await expectShown(page, DEFAULT_MODULE);
    await page.waitForLoadState("networkidle");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect(page).toHaveURL(BARE_URL);
    await expectShown(page, DEFAULT_MODULE);
    expect(
      payloads.requested().filter((key) => key === "logistica"),
      "RESET does not go through the restore: it is not retried",
    ).toEqual([]);
    // DT-13 (pending): leaving FAILED rests on the URL it finds and stores its
    // module, which overwrites the preference the restore was going to honour.
    // Recorded as it is; changing it needs a decision on row #21.
    expect(await storedModule(page), "known limitation, DT-13 pending").toBe(DEFAULT_MODULE);
    expect(reloads.documents, "recovery is retry(), never a reload").toEqual([]);
  });

  test("C-9 on a full route: a failed entry rests on the route after Reintentar and, with DT-13 pending, stores the route's module", async ({
    page,
  }) => {
    await page.clock.install();
    await seedLastModule(page, "tokens");
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Measured window for this payload: 35 % to 90 %.
    payloads.cut(INFORMES_ROUTE, 0.55);
    payloads.record();
    reloads.arm();
    await routerPush(page, INFORMES_ROUTE);
    await expect(errorBoundary(page)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(routeUrl(INFORMES_ROUTE));
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    expect(payloads.requested(), "a full route restores nothing").toEqual([INFORMES_ROUTE]);

    payloads.uncut();
    await errorBoundary(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(errorBoundary(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(page).toHaveURL(routeUrl(INFORMES_ROUTE));
    await expect(page.locator('[data-dashboard-module-workspace="informes-full"]')).toBeVisible();
    expect(await storedModule(page), "known limitation, DT-13 pending").toBe("informes");
    expect(reloads.documents, "recovery is retry(), never a reload").toEqual([]);
  });

  test("boundary in a later commit than the restore: its budget is cancelled and the late commit does not leave FAILED (C-9)", async ({
    page,
  }) => {
    await page.clock.install();
    await seedLastModule(page, "logistica");
    const payloads = await controlRouterPayloads(page);
    payloads.hold();
    await page.goto(BASE);
    await expect.poll(() => payloads.requested()).toEqual(["logistica"]);

    payloads.cut("tokens");
    await navItem(page, "tokens").click();
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
    const landed = new URL(page.url()).searchParams.get("module") ?? DEFAULT_MODULE;
    await expectShown(page, landed);
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expectShown(page, landed);
  });

  test("leaving the dashboard with a restore in flight or with the boundary visible leaves nothing running (C-9, C-6)", async ({
    page,
  }) => {
    await page.clock.install();
    await seedLastModule(page, "logistica");
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    payloads.hold();
    await page.goto(BASE);
    await expect.poll(() => payloads.requested()).toEqual(["logistica"]);

    // The restore is in flight and its budget armed when the owner unmounts.
    reloads.arm();
    await routerPush(page, "/");
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL((url) => url.pathname === "/");
    expect(payloads.requested(), "the unmounted owner issues nothing").toEqual(["logistica"]);

    // Back in with a fresh owner, then out again with the boundary visible.
    await payloads.release();
    await routerPush(page, `${BASE}?module=informes`);
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");
    await page.waitForLoadState("networkidle");
    payloads.cut("tokens");
    await navItem(page, "tokens").click();
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

  test("Back then Forward, and Back then the committed module, never stall — with the hub as the entry behind (C-8, L6)", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    await page.goto(`${BASE}?hub=1`);
    await expectHub(page);
    await page.locator("[data-public-route-control-hydrated]").first().waitFor({ state: "attached" });
    await page.waitForLoadState("networkidle");
    await navItem(page, "informes").click();
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");
    await page.waitForLoadState("networkidle");
    await navItem(page, "tokens").click();
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
    await page.waitForLoadState("networkidle");

    payloads.hold();
    await page.goBack();
    await page.goForward();
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expectShown(page, "tokens");

    await page.goBack();
    await expect(page).toHaveURL(moduleUrl("informes"));
    await navItem(page, "informes").click();
    await expectShown(page, "informes");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");

    // And onto the hub entry itself.
    await page.goBack();
    await expect(page).toHaveURL(HUB_URL);
    await expectHub(page);
    await page.goForward();
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect(stalledNotice(page)).toHaveCount(0);
    await payloads.release();
  });

  test("Back and two clicks before any payload: the last click lands and the burst replaces the entry Back left ahead (C-10, S13)", async ({
    page,
  }) => {
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?module=informes`);
    await expectShown(page, "informes");
    await page.waitForLoadState("networkidle");
    await navItem(page, "tokens").click();
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
    await page.waitForLoadState("networkidle");
    const length = await historyLength(page);

    reloads.arm();
    payloads.hold();
    await page.goBack();
    await navItem(page, "logistica").click();
    await navItem(page, "perfil").click();
    await expectShown(page, "perfil");
    const divergence = await recordDivergenceFrom(page, "perfil");

    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("perfil"));
    await expectShown(page, "perfil");
    expect(await divergence(), "the view passed through another module after the last click").toEqual([]);
    expect(await historyLength(page), "the burst replaced the entry Back had left ahead").toBe(length);

    await page.goBack();
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("Back and Forward: no painted frame shows a URL and a stage that disagree (S1)", async ({ page }) => {
    await page.goto(`${BASE}?module=informes`);
    await expectShown(page, "informes");
    await page.waitForLoadState("networkidle");
    await navItem(page, "tokens").click();
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
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
    await expect(page).toHaveURL(moduleUrl("informes"));
    await expectShown(page, "informes");
    await page.goForward();
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
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
      await seedLastModule(page, "logistica");
      const payloads = await controlRouterPayloads(page);
      const reloads = watchDocuments(page);
      payloads.hold();
      await page.goto(BASE);
      await expect.poll(() => payloads.requested()).toEqual(["logistica"]);
      const length = await historyLength(page);

      reloads.arm();
      await navItem(page, "tokens").click();
      await expectShown(page, "tokens");
      await expect
        .poll(() => payloads.requested(), { message: "over a restore the click leaves at once" })
        .toEqual(["logistica", "tokens"]);
      const divergence = await recordDivergenceFrom(page, "tokens");

      expect(await payloads.releaseOnly(first === "the click" ? "tokens" : "logistica")).toBeGreaterThan(0);
      await waitForLayoutSettled(page);
      await payloads.release();
      await expect(page).toHaveURL(moduleUrl("tokens"));
      await expectShown(page, "tokens");
      expect(await divergence(), "the restored module repainted after the click").toEqual([]);
      expect(await historyLength(page), "one entry for the click, none for the restore").toBe(length + 1);
      expect(await storedModule(page)).toBe("tokens");
      expect(reloads.documents, "client navigation, never a reload").toEqual([]);
    });
  }

  test("a click over the pending restore and then the restored module rests on it with no extra entry (C-11, #32)", async ({
    page,
  }) => {
    await seedLastModule(page, "logistica");
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    payloads.hold();
    await page.goto(BASE);
    await expect.poll(() => payloads.requested()).toEqual(["logistica"]);
    const length = await historyLength(page);

    reloads.arm();
    await navItem(page, "tokens").click();
    await expectShown(page, "tokens");
    await navItem(page, "logistica").click();
    await expectShown(page, "logistica");
    expect(payloads.requested(), "the second choice is claimed by the click in flight").toEqual(["logistica", "tokens"]);
    const divergence = await recordDivergenceFrom(page, "logistica");

    // The restore answers first. If the router still commits it, it commits
    // the very module the flight had claimed and the owner rests there (#32);
    // if the click's push had already discarded it, the click lands and the
    // claimed module replaces its entry (#30). Either way the view never
    // leaves the module chosen last and the burst adds at most one entry.
    expect(await payloads.releaseOnly("logistica")).toBeGreaterThan(0);
    await waitForLayoutSettled(page);
    await expectShown(page, "logistica");
    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("logistica"));
    await expectShown(page, "logistica");
    await page.waitForLoadState("networkidle");
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL(moduleUrl("logistica"));
    await expectShown(page, "logistica");
    expect(await divergence(), "the abandoned click repainted its module").toEqual([]);

    const added = (await historyLength(page)) - length;
    test.info().annotations.push({
      type: "H1 for a push over a pending restore",
      description: `entries added: ${added} (0 = the restore committed, row #32; 1 = the push discarded it, row #30)`,
    });
    expect([0, 1]).toContain(added);
    expect(await storedModule(page)).toBe("logistica");
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("another navigation commits the claimed selection: the owner rests on it and drops its own flight (#32)", async ({
    page,
  }) => {
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?module=informes`);
    await expectShown(page, "informes");
    await page.waitForLoadState("networkidle");

    reloads.arm();
    payloads.hold();
    await navItem(page, "tokens").click();
    await navItem(page, "perfil").click();
    await expectShown(page, "perfil");
    expect(payloads.requested(), "the second choice is claimed").toEqual(["tokens"]);
    const divergence = await recordDivergenceFrom(page, "perfil");

    // A commit of the claimed module that the owner did not issue: the history
    // write the router itself performs for a navigation, synced into the
    // search params (the same injection the superseded-commit block uses).
    await page.evaluate((url) => window.history.pushState(null, "", url), `${BASE}?module=perfil`);
    await expect(page).toHaveURL(moduleUrl("perfil"));
    // #32 rests there and discards the flight in the router with a push to the
    // URL it already shows, which asks for one payload of its own.
    await expect.poll(() => payloads.requested()).toEqual(["tokens", "perfil"]);
    expect(await storedModule(page), "the commit the owner rests on is stored").toBe("perfil");

    await payloads.release();
    await page.waitForLoadState("networkidle");
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL(moduleUrl("perfil"));
    await expectShown(page, "perfil");
    expect(await divergence(), "the dropped flight repainted its module").toEqual([]);
    expect(payloads.requested(), "no continuation after resting").toEqual(["tokens", "perfil"]);
    expect(reloads.documents, "client navigation, never a reload").toEqual([]);
  });

  test("residual, recorded as it is: a payload held past the budget that answers before its relay may leave its own entry (C-11, DT-15)", async ({
    page,
  }) => {
    await page.clock.install();
    const payloads = await controlRouterPayloads(page);
    const reloads = watchDocuments(page);
    await page.goto(`${BASE}?module=informes`);
    await expectShown(page, "informes");
    await page.waitForLoadState("networkidle");
    const length = await historyLength(page);

    reloads.arm();
    payloads.hold();
    await navItem(page, "tokens").click();
    await navItem(page, "perfil").click();
    await expectShown(page, "perfil");
    await page.clock.fastForward(PAST_THE_BUDGET_MS);
    await expect.poll(() => payloads.requested()).toEqual(["tokens", "perfil"]);
    const divergence = await recordDivergenceFrom(page, "perfil");

    // The abandoned payload answers first. It is never painted; whether it
    // also writes an entry depends on how the router folds the two commits.
    expect(await payloads.releaseOnly("tokens")).toBeGreaterThan(0);
    await waitForLayoutSettled(page);
    await expectShown(page, "perfil");
    await payloads.release();
    await expect(page).toHaveURL(moduleUrl("perfil"));
    await expectShown(page, "perfil");
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
    await page.goto(`${BASE}?module=informes`);
    await expectShown(page, "informes");
    await page.waitForLoadState("networkidle");
    await expect.poll(() => storedModule(page)).toBe("informes");

    payloads.hold();
    await navItem(page, "tokens").click();
    await navItem(page, "perfil").click();
    await expectShown(page, "perfil");
    // The flight lands and its continuation leaves: the URL is the landed
    // module, recorded but not stored, and the stage is the claimed one.
    expect(await payloads.releaseOnly("tokens")).toBeGreaterThan(0);
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expect.poll(() => payloads.requested()).toEqual(["tokens", "perfil"]);
    await expectShown(page, "perfil");
    expect(await storedModule(page), "a module nobody accepted is not stored").toBe("informes");

    await navItem(page, "tokens").click();
    await expectShown(page, "tokens");
    await expect.poll(() => storedModule(page)).toBe("tokens");
    await payloads.release();
    await waitForLayoutSettled(page);
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");

    await page.goto(BASE);
    await expect(page).toHaveURL(moduleUrl("tokens"));
    await expectShown(page, "tokens");
  });
});
