import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

import {
  clearDashboardModuleMemory,
  suppressNextDevChrome,
} from "../../helpers/dashboard-geometry-matrix";
import { setAdminSession, setClinicSession } from "../../helpers/session";
import {
  ADMIN_MOBILE_PRIMARY_MODULE_IDS,
  CLINIC_MOBILE_PRIMARY_MODULE_IDS,
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
  let armed = false;
  await page.route(
    (url) => url.searchParams.has("_rsc"),
    async (route) => {
      if (armed) {
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

/** Real pointer click; focus is proven separately from navigation. */
async function pointerClick(item: Locator) {
  await item.click();
  await expect(item).toBeFocused();
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
