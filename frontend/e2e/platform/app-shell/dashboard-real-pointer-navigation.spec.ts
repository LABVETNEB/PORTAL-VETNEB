import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

import {
  clearDashboardModuleMemory,
  suppressNextDevChrome,
  waitForLayoutSettled,
} from "../../helpers/dashboard-geometry-matrix";
import { setAdminSession, setClinicSession } from "../../helpers/session";
import {
  ADMIN_MOBILE_PRIMARY_MODULE_IDS,
  ADMIN_MODULE_NAV_LABELS,
  CLINIC_MOBILE_PRIMARY_MODULE_IDS,
  CLINIC_MODULE_NAV_LABELS,
} from "../../../src/features/dashboard/config/dashboardModules";

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD_REAL_POINTER_NAVIGATION — a real pointer click on a module moves
// focus AND the current item AND the workspace, then the URL, without reload.
//
// Focus is asserted on its own on purpose: the reported defect was a click that
// focused the pressed item while the previous module stayed current and on
// stage. A spec that only proves the control is clickable cannot see it.
//
// The clinic full routes (`/dashboard/informes`, `/dashboard/logistica`) are the
// surfaces the live-sync contract never visited: their band was pinned to the
// route's own module and no stage owner heard the activation, so a click there
// showed nothing until the whole `/dashboard` server render arrived. That phase
// is made observable by holding router payloads (continued, never stubbed), the
// same gate the live-sync spec uses; the module-shell matrix runs on real,
// unheld traffic.
// ─────────────────────────────────────────────────────────────────────────────

type Role = "admin" | "clinic";
type Regime = "mobile" | "rail" | "drawer";

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1536, height: 960 },
  { width: 1920, height: 1080 },
] as const;

/** Landing + two destinations promoted to the mobile bar on each role. */
const SHELL: Record<Role, { readonly base: string; readonly landing: string; readonly path: readonly [string, string] }> = {
  admin: { base: "/dashboard/admin", landing: "admin", path: ["admin-sessions", "admin-clinics"] },
  clinic: { base: "/dashboard", landing: "operaciones", path: ["tokens", "logistica"] },
};

const CLINIC_FULL_ROUTES = [
  { path: "/dashboard/logistica", module: "logistica", stage: "logistica-full", target: "tokens" },
  { path: "/dashboard/informes", module: "informes", stage: "informes-full", target: "logistica" },
] as const;

const CLINIC_FULL_ROUTE_HANDOVERS = [
  { path: "/dashboard/logistica", stage: "logistica-full", first: "tokens", second: "perfil" },
  { path: "/dashboard/informes", stage: "informes-full", first: "logistica", second: "tokens" },
] as const;

// A `?module=` navigate action completes before the server answers (Next 16
// segment cache), so the router queue never discards a superseded push: under
// a slow server its payload can commit ahead of the latest one, as a history
// push of the superseded url. When React folds it into the latest commit or
// lets it land first depends on payload timing, so the spec injects that push
// itself, deterministically. The second destination is a bar slot below 768px,
// so the bar's own current item is the one under test there.
const SUPERSEDED: Record<Role, { readonly first: string; readonly second: Record<Regime, string> }> = {
  admin: {
    first: "admin-particular-tokens",
    second: { mobile: "admin-clinics", rail: "admin-pricing", drawer: "admin-pricing" },
  },
  clinic: {
    first: "tokens",
    second: { mobile: "logistica", rail: "logistica", drawer: "logistica" },
  },
};

function regimeFor(width: number): Regime {
  if (width >= 1280) return "drawer";
  if (width >= 768) return "rail";
  return "mobile";
}

function paintedNav(page: Page, role: Role, regime: Regime): Locator {
  const selector =
    regime === "drawer"
      ? `[data-dashboard-navigation-drawer="${role}"]`
      : regime === "rail"
        ? `[data-dashboard-navigation-rail="${role}"]`
        : `[data-dashboard-mobile-nav="${role}"]`;
  return page.locator(selector).filter({ visible: true });
}

function slotFor(role: Role, regime: Regime, moduleId: string): string {
  if (regime !== "mobile") return moduleId;
  const primary: readonly string[] =
    role === "admin" ? ADMIN_MOBILE_PRIMARY_MODULE_IDS : CLINIC_MOBILE_PRIMARY_MODULE_IDS;
  return primary.includes(moduleId) ? moduleId : "overflow";
}

function navItem(page: Page, role: Role, regime: Regime, moduleId: string): Locator {
  const attribute =
    regime === "mobile" ? "data-dashboard-mobile-nav-item" : "data-dashboard-navigation-item";
  return paintedNav(page, role, regime).locator(`[${attribute}="${moduleId}"]`);
}

function moduleUrl(base: string, moduleId: string): RegExp {
  return new RegExp(`${base.replace(/\//g, "\\/")}\\?module=${moduleId}$`);
}

async function expectCurrent(page: Page, role: Role, regime: Regime, moduleId: string) {
  const current = paintedNav(page, role, regime).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute(
    regime === "mobile" ? "data-dashboard-mobile-nav-item" : "data-dashboard-navigation-item",
    slotFor(role, regime, moduleId),
  );
}

async function expectStage(page: Page, workspaceId: string) {
  await expect(page.locator(`[data-dashboard-module-workspace="${workspaceId}"]`)).toBeVisible();
  await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(1);
}

/** Every document request after `arm()` is a reload the client router gave up to. */
function watchDocuments(page: Page) {
  const documents: string[] = [];
  let armed = false;
  page.on("request", (request) => {
    if (armed && request.resourceType() === "document") documents.push(request.url());
  });
  return {
    arm() {
      armed = true;
    },
    documents,
  };
}

/** Holds router navigation payloads until released; held routes are continued. */
async function holdServerNavigations(page: Page) {
  const held: Route[] = [];
  const requested: string[] = [];
  let armed = false;
  await page.route(
    (url) => url.searchParams.has("_rsc"),
    async (route) => {
      if (armed) {
        requested.push(new URL(route.request().url()).searchParams.get("module") ?? "");
        held.push(route);
        return;
      }
      await route.continue();
    },
  );
  return {
    arm() {
      armed = true;
    },
    /** Module of every router payload requested while armed, in order. */
    requested: () => [...requested],
    /** Lets through only the held payloads of one destination, in order. */
    async releaseModule(moduleId: string) {
      const target = held.filter(
        (route) => new URL(route.request().url()).searchParams.get("module") === moduleId,
      );
      for (const route of target) {
        held.splice(held.indexOf(route), 1);
        const continued = await route.continue().then(
          () => true,
          () => false /* the router aborted a superseded navigation */,
        );
        if (continued) await route.request().response();
      }
      return target.length;
    },
    async release() {
      armed = false;
      for (const route of held.splice(0)) {
        const continued = await route.continue().then(
          () => true,
          () => false /* the router aborted a superseded navigation */,
        );
        if (continued) await route.request().response();
      }
    },
  };
}

/**
 * Records, on every DOM mutation from now on, any stage or current item that
 * shows `moduleId`: a transient paint between two commits is caught too.
 */
async function recordPaintsOf(page: Page, moduleId: string) {
  await page.evaluate((id) => {
    const paints: string[] = [];
    const record = () => {
      if (document.querySelector(`[data-dashboard-module-workspace="${id}"]`)) paints.push("stage");
      const current = document.querySelector(
        `[aria-current="page"][data-dashboard-navigation-item="${id}"], [aria-current="page"][data-dashboard-mobile-nav-item="${id}"]`,
      );
      if (current) paints.push("current");
    };
    new MutationObserver(record).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-current", "data-dashboard-module-workspace"],
    });
    (window as Window & { __stalePaints?: string[] }).__stalePaints = paints;
  }, moduleId);
  return () =>
    page.evaluate(() => [
      ...new Set((window as Window & { __stalePaints?: string[] }).__stalePaints ?? ["unrecorded"]),
    ]);
}

async function signIn(page: Page, role: Role) {
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  if (role === "admin") await setAdminSession(page, "populated");
  else await setClinicSession(page, "populated");
}

function moduleLabel(role: Role, moduleId: string): string {
  const labels: readonly { readonly moduleId: string; readonly label: string }[] =
    role === "admin" ? ADMIN_MODULE_NAV_LABELS : CLINIC_MODULE_NAV_LABELS;
  const entry = labels.find((candidate) => candidate.moduleId === moduleId);
  if (!entry) throw new Error(`no catalog label for ${moduleId}`);
  return entry.label;
}

/**
 * Records, on every DOM mutation from now on, any state whose current item,
 * stage or mobile context title is not `moduleId`: a transient regression
 * between two commits counts.
 */
async function recordDivergenceFrom(page: Page, role: Role, regime: Regime, moduleId: string) {
  const selector =
    regime === "drawer"
      ? `[data-dashboard-navigation-drawer="${role}"]`
      : regime === "rail"
        ? `[data-dashboard-navigation-rail="${role}"]`
        : `[data-dashboard-mobile-nav="${role}"]`;
  const attribute =
    regime === "mobile" ? "data-dashboard-mobile-nav-item" : "data-dashboard-navigation-item";
  await page.evaluate(
    ({ selector, attribute, slot, moduleId, label }) => {
      const divergence: string[] = [];
      const record = () => {
        const nav = [...document.querySelectorAll(selector)].find(
          (node) => node.getClientRects().length > 0,
        );
        const current = nav?.querySelector('[aria-current="page"]')?.getAttribute(attribute) ?? "none";
        const stage = [...document.querySelectorAll("[data-dashboard-module-workspace]")]
          .map((node) => node.getAttribute("data-dashboard-module-workspace"))
          .join(",");
        const title = document.querySelector(".dashboard-mobile-context-title")?.textContent ?? "none";
        if (current !== slot || stage !== moduleId || title !== label) {
          divergence.push(`current=${current} stage=${stage} title=${title}`);
        }
      };
      new MutationObserver(record).observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["aria-current", "data-dashboard-module-workspace"],
      });
      (window as Window & { __divergence?: string[] }).__divergence = divergence;
    },
    { selector, attribute, slot: slotFor(role, regime, moduleId), moduleId, label: moduleLabel(role, moduleId) },
  );
  return () =>
    page.evaluate(() => [
      ...new Set((window as Window & { __divergence?: string[] }).__divergence ?? ["unrecorded"]),
    ]);
}

/** Real pointer click; focus is proven separately from navigation. */
async function pointerClick(item: Locator) {
  await item.click();
  await expect(item).toBeFocused();
}

/** Reaches a module through its bar slot, or through "Más" when it has none. */
async function selectModule(page: Page, role: Role, regime: Regime, moduleId: string) {
  if (slotFor(role, regime, moduleId) !== "overflow") {
    await pointerClick(navItem(page, role, regime, moduleId));
    return;
  }
  await pointerClick(navItem(page, role, regime, "overflow"));
  // The sheet closes on the click, so the link takes no focus to assert.
  await page.locator(`[data-dashboard-mobile-nav-overflow-link="${moduleId}"]`).click();
}

for (const role of ["admin", "clinic"] as const) {
  test.describe(`DASHBOARD_REAL_POINTER_NAVIGATION · ${role} module shell`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, role);
    });

    for (const viewport of VIEWPORTS) {
      const regime = regimeFor(viewport.width);

      test(`${viewport.width}x${viewport.height} (${regime}): click, A→B→A, reload and click again on real traffic`, async ({
        page,
      }) => {
        const { base, landing, path } = SHELL[role];
        const [a, b] = path;
        const runtimeErrors: string[] = [];
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        await page.setViewportSize(viewport);
        await page.goto(base);
        await expectStage(page, landing);
        await expectCurrent(page, role, regime, landing);

        const reloads = watchDocuments(page);
        reloads.arm();

        for (const moduleId of [a, b, a]) {
          await pointerClick(navItem(page, role, regime, moduleId));
          await expectCurrent(page, role, regime, moduleId);
          await expectStage(page, moduleId);
          await expect(page).toHaveURL(moduleUrl(base, moduleId));
        }
        expect(reloads.documents, "client navigation, never a reload").toEqual([]);

        await page.reload();
        await expectStage(page, a);
        await pointerClick(navItem(page, role, regime, b));
        await expectCurrent(page, role, regime, b);
        await expectStage(page, b);
        await expect(page).toHaveURL(moduleUrl(base, b));

        expect(runtimeErrors).toEqual([]);
      });
    }
  });
}

test.describe("DASHBOARD_REAL_POINTER_NAVIGATION · clinic full routes", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "clinic");
  });

  for (const route of CLINIC_FULL_ROUTES) {
    for (const viewport of VIEWPORTS) {
      const regime = regimeFor(viewport.width);

      test(`${route.path} ${viewport.width}x${viewport.height} (${regime}): the click moves band and stage before the server answers`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        const gate = await holdServerNavigations(page);
        await page.goto(route.path);
        await expectStage(page, route.stage);
        await expectCurrent(page, "clinic", regime, route.module);
        await page.waitForLoadState("networkidle");

        const reloads = watchDocuments(page);
        reloads.arm();
        gate.arm();
        await pointerClick(navItem(page, "clinic", regime, route.target));
        await expectCurrent(page, "clinic", regime, route.target);
        await expectStage(page, route.target);
        await expect(page).toHaveURL(new RegExp(`${route.path.replace(/\//g, "\\/")}$`));

        await gate.release();
        await expect(page).toHaveURL(moduleUrl("/dashboard", route.target));
        await expectCurrent(page, "clinic", regime, route.target);
        await expectStage(page, route.target);
        expect(reloads.documents, "client navigation, never a reload").toEqual([]);
      });
    }
  }

  // The full-route stage hands the stage over to the `/dashboard` controller on
  // the first commit. A second destination clicked before that commit used to
  // stay with the unmounted stage, so the new owner opened the first one.
  for (const route of CLINIC_FULL_ROUTE_HANDOVERS) {
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
      const regime = regimeFor(viewport.width);

      test(`${route.path} ${viewport.width}x${viewport.height} (${regime}): A then B before A commits keeps B across the owner handoff`, async ({
        page,
      }) => {
        const runtimeErrors: string[] = [];
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        await page.setViewportSize(viewport);
        const gate = await holdServerNavigations(page);
        await page.goto(route.path);
        await expectStage(page, route.stage);
        await page.waitForLoadState("networkidle");

        const reloads = watchDocuments(page);
        reloads.arm();
        gate.arm();
        await pointerClick(navItem(page, "clinic", regime, route.first));
        await expectStage(page, route.first);
        await pointerClick(navItem(page, "clinic", regime, route.second));
        await expectCurrent(page, "clinic", regime, route.second);
        await expectStage(page, route.second);

        const stalePaints = await recordPaintsOf(page, route.first);

        // A's payload lands first. Whether the router commits A or discards it,
        // the owner that ends up on stage must keep B; no frame may paint A.
        expect(await gate.releaseModule(route.first)).toBeGreaterThan(0);
        await expectCurrent(page, "clinic", regime, route.second);
        await expectStage(page, route.second);

        await gate.release();
        await expect(page).toHaveURL(moduleUrl("/dashboard", route.second));
        await expectCurrent(page, "clinic", regime, route.second);
        await expectStage(page, route.second);
        expect(await stalePaints(), `${route.first} painted after ${route.second} was chosen`).toEqual([]);
        expect(reloads.documents, "client navigation, never a reload").toEqual([]);
        expect(runtimeErrors).toEqual([]);
      });
    }
  }
});

// A then B before A commits, on the module shell. The stage owner classifies
// A's early commit as superseded and keeps B; the band, the bar and the mobile
// title used to read that commit on their own, so they jumped back to A while B
// stayed on stage, for as long as B's server render took.
for (const role of ["admin", "clinic"] as const) {
  test.describe(`DASHBOARD_REAL_POINTER_NAVIGATION · ${role} superseded commit`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, role);
    });

    for (const viewport of [VIEWPORTS[0], VIEWPORTS[2], VIEWPORTS[3]]) {
      const regime = regimeFor(viewport.width);

      test(`${viewport.width}x${viewport.height} (${regime}): a superseded payload that lands first never repaints its module`, async ({
        page,
      }) => {
        const { base, landing } = SHELL[role];
        const first = SUPERSEDED[role].first;
        const second = SUPERSEDED[role].second[regime];
        const runtimeErrors: string[] = [];
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        await page.setViewportSize(viewport);
        const gate = await holdServerNavigations(page);
        // A document on an explicit `?module=` url: the early commit depends on
        // the route entry it seeds (the bare url's restore takes another path).
        await page.goto(`${base}?module=${landing}`);
        await expectStage(page, landing);
        await page.waitForLoadState("networkidle");

        const reloads = watchDocuments(page);
        reloads.arm();
        gate.arm();
        await selectModule(page, role, regime, first);
        await expectStage(page, first);
        await selectModule(page, role, regime, second);
        await expectCurrent(page, role, regime, second);
        await expectStage(page, second);
        const divergence = await recordDivergenceFrom(page, role, regime, second);

        // A's early commit, while B's payload is still held: the history push
        // of A's url the router itself performs, which Next syncs into
        // `useSearchParams`. The URL passes through A; the band, the bar, the
        // mobile title and the stage may not.
        await page.evaluate((url) => window.history.pushState(null, "", url), `${base}?module=${first}`);
        await expect(page).toHaveURL(moduleUrl(base, first));
        await waitForLayoutSettled(page);
        await expectCurrent(page, role, regime, second);
        await expectStage(page, second);

        await gate.release();
        // The owner reconciles the superseded commit to B's url (single flight).
        await expect(page).toHaveURL(moduleUrl(base, second));
        await expectCurrent(page, role, regime, second);
        await expectStage(page, second);
        expect(await divergence(), `${first} repainted after ${second} was chosen`).toEqual([]);
        expect(reloads.documents, "client navigation, never a reload").toEqual([]);
        expect(runtimeErrors).toEqual([]);
      });
    }
  });
}

// SINGLE FLIGHT. Every committed router state writes one history entry, so two
// module pushes in flight left either [A, B, C] - B committed on its own and
// Back landed on the module the user had abandoned - or [A, C], depending on
// payload timing. While A is in flight a newer choice is claimed by the stage
// owner instead of pushed, and replaces A's entry once A lands: one payload in
// flight at a time, and history is always [origin, C].
for (const role of ["admin", "clinic"] as const) {
  test.describe(`DASHBOARD_REAL_POINTER_NAVIGATION · ${role} single flight`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, role);
    });

    for (const viewport of [VIEWPORTS[0], VIEWPORTS[2], VIEWPORTS[3]]) {
      const regime = regimeFor(viewport.width);

      test(`${viewport.width}x${viewport.height} (${regime}): A then B in flight leaves one history entry and Back returns to the origin`, async ({
        page,
      }) => {
        const { base, landing } = SHELL[role];
        const first = SUPERSEDED[role].first;
        const second = SUPERSEDED[role].second[regime];
        const runtimeErrors: string[] = [];
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        await page.setViewportSize(viewport);
        const gate = await holdServerNavigations(page);
        await page.goto(`${base}?module=${landing}`);
        await expectStage(page, landing);
        await page.waitForLoadState("networkidle");
        const originLength = await page.evaluate(() => window.history.length);

        const reloads = watchDocuments(page);
        reloads.arm();
        gate.arm();
        await selectModule(page, role, regime, first);
        await expectStage(page, first);
        await selectModule(page, role, regime, second);
        await expectCurrent(page, role, regime, second);
        await expectStage(page, second);
        const divergence = await recordDivergenceFrom(page, role, regime, second);
        expect(gate.requested(), `${second} must wait for ${first} instead of a second push`).toEqual([first]);

        // A lands: the owner issues B as the one follow-up navigation.
        expect(await gate.releaseModule(first)).toBeGreaterThan(0);
        await expect.poll(() => gate.requested()).toEqual([first, second]);
        await gate.release();
        await expect(page).toHaveURL(moduleUrl(base, second));
        await expectCurrent(page, role, regime, second);
        await expectStage(page, second);
        expect(await divergence(), `${first} repainted after ${second} was chosen`).toEqual([]);
        expect(
          await page.evaluate(() => window.history.length),
          "one entry for the whole A-then-B burst",
        ).toBe(originLength + 1);

        await page.goBack();
        await expect(page).toHaveURL(moduleUrl(base, landing));
        await expectCurrent(page, role, regime, landing);
        await expectStage(page, landing);
        await page.goForward();
        await expect(page).toHaveURL(moduleUrl(base, second));
        await expectCurrent(page, role, regime, second);
        await expectStage(page, second);
        expect(reloads.documents, "client navigation, never a reload").toEqual([]);
        expect(runtimeErrors).toEqual([]);
      });
    }
  });
}

// "Abrir módulo completo" leaves the module shell for a full route, another page
// whose server render can take seconds. It used to stay unchanged for that whole
// wait, so the click looked ignored; it now shows its pending state until the
// full route commits.
test.describe("DASHBOARD_REAL_POINTER_NAVIGATION · clinic full-module control", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "clinic");
  });

  for (const { module, path, stage, name } of [
    { module: "logistica", path: "/dashboard/logistica", stage: "logistica-full", name: "Abrir módulo completo de logística" },
    { module: "informes", path: "/dashboard/informes", stage: "informes-full", name: "Abrir módulo completo de informes" },
  ] as const) {
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
      test(`${module} ${viewport.width}x${viewport.height}: the click shows its pending state until ${path} commits`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        const gate = await holdServerNavigations(page);
        await page.goto(`/dashboard?module=${module}`);
        await expectStage(page, module);
        await page.waitForLoadState("networkidle");

        const reloads = watchDocuments(page);
        reloads.arm();
        gate.arm();
        const control = page.getByRole("button", { name }).filter({ visible: true });
        await pointerClick(control);
        await expect(control).toHaveAttribute("aria-busy", "true");
        await expect(control).toContainText("Abriendo módulo");
        await expect(page).toHaveURL(new RegExp(`\\/dashboard\\?module=${module}$`));

        await gate.release();
        await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
        await expectStage(page, stage);
        expect(reloads.documents, "client navigation, never a reload").toEqual([]);
      });
    }
  }
});

// SINGLE FLIGHT · back to the committed module while another one is in flight.
// B's push lands after the person already chose A again; replacing B's entry
// with A left [A, A], so the next Back changed nothing. The owner steps back
// onto A's own entry instead: no duplicate, and B stays as the Forward entry
// the person did visit.
for (const role of ["admin", "clinic"] as const) {
  test.describe(`DASHBOARD_REAL_POINTER_NAVIGATION · ${role} return to the committed module`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, role);
    });

    for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
      const regime = regimeFor(viewport.width);

      test(`${viewport.width}x${viewport.height} (${regime}): A, then B in flight, then A again leaves no duplicate history entry`, async ({
        page,
      }) => {
        const { base, landing } = SHELL[role];
        const committed = SUPERSEDED[role].second[regime];
        const abandoned = SUPERSEDED[role].first;
        const runtimeErrors: string[] = [];
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        await page.setViewportSize(viewport);
        const gate = await holdServerNavigations(page);
        await page.goto(`${base}?module=${landing}`);
        await expectStage(page, landing);
        await page.waitForLoadState("networkidle");
        const originLength = await page.evaluate(() => window.history.length);

        await selectModule(page, role, regime, committed);
        await expect(page).toHaveURL(moduleUrl(base, committed));
        await expectStage(page, committed);

        // The router writes each committed entry with history.pushState; the
        // recorder is what proves B landed, since the url shows A before and after.
        await page.evaluate(() => {
          const pushes: string[] = [];
          const push = window.history.pushState;
          window.history.pushState = function (...args: Parameters<History["pushState"]>) {
            pushes.push(String(args[2] ?? ""));
            return push.apply(this, args);
          };
          (window as Window & { __pushes?: string[] }).__pushes = pushes;
        });
        const pushed = () =>
          page.evaluate(() => [...((window as Window & { __pushes?: string[] }).__pushes ?? [])]);

        const reloads = watchDocuments(page);
        reloads.arm();
        gate.arm();
        await selectModule(page, role, regime, abandoned);
        await expectStage(page, abandoned);
        await selectModule(page, role, regime, committed);
        await expectCurrent(page, role, regime, committed);
        await expectStage(page, committed);
        expect(gate.requested(), "the return to the committed module starts no payload").toEqual([abandoned]);

        const divergence = await recordDivergenceFrom(page, role, regime, committed);
        expect(await gate.releaseModule(abandoned)).toBeGreaterThan(0);
        await expect
          .poll(async () => (await pushed()).some((url) => url.includes(`module=${abandoned}`)))
          .toBe(true);
        await expect(page).toHaveURL(moduleUrl(base, committed));
        await waitForLayoutSettled(page);
        await gate.release();
        await expectCurrent(page, role, regime, committed);
        await expectStage(page, committed);
        expect(await divergence(), `${abandoned} repainted after the return to ${committed}`).toEqual([]);
        expect(gate.requested(), "no reconciling replay after the step back").toEqual([abandoned]);
        expect(
          await page.evaluate(() => window.history.length),
          "the landing, the committed module and the visited one: nothing duplicated",
        ).toBe(originLength + 2);

        // Back leaves the committed module for the landing, never for a copy of itself.
        await page.goBack();
        await expect(page).toHaveURL(moduleUrl(base, landing));
        await expectCurrent(page, role, regime, landing);
        await expectStage(page, landing);
        await page.goForward();
        await expect(page).toHaveURL(moduleUrl(base, committed));
        await expectCurrent(page, role, regime, committed);
        await expectStage(page, committed);
        await page.goForward();
        await expect(page).toHaveURL(moduleUrl(base, abandoned));
        await expectCurrent(page, role, regime, abandoned);
        await expectStage(page, abandoned);
        expect(reloads.documents, "client navigation, never a reload").toEqual([]);
        expect(runtimeErrors).toEqual([]);
      });
    }
  });
}
