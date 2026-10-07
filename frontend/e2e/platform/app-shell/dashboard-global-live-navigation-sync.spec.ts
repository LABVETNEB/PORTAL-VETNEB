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
// DASHBOARD_GLOBAL_LIVE_SYNC — a module switch is visible in the SAME client
// session, before the server answers.
//
// A `?module=` switch is a same-page navigation of a dynamic, `no-store`
// page: the router only commits the new URL once the whole server payload
// (every backend read the page does) has arrived. On a slow backend that is
// seconds, and every surface that waited for that commit kept painting the
// module the operator had just left: the admin workspace and the lateral
// navigation's current item on both roles. The operator saw a click that did
// nothing until a reload.
//
// THE GATE IS THE SERVER, NOT A CLOCK. Instead of sleeping, the spec holds every
// router navigation payload (`_rsc` requests) in flight while it asserts the
// live DOM, then releases them and asserts URL convergence. A surface that
// still depends on the commit cannot pass the held phase on any machine.
// Nothing is fabricated: held requests are continued to the fixture API.
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

/** Landing + three destinations; mobile ones are promoted to the bar. */
const ROUTE: Record<Role, { readonly base: string; readonly landing: string; readonly path: readonly [string, string, string] }> = {
  admin: {
    base: "/dashboard/admin",
    landing: "admin",
    path: ["admin-clinics", "audit-log", "admin-sessions"],
  },
  clinic: {
    base: "/dashboard",
    landing: "operaciones",
    path: ["informes", "logistica", "tokens"],
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

function navItem(page: Page, role: Role, regime: Regime, moduleId: string): Locator {
  const attribute =
    regime === "mobile" ? "data-dashboard-mobile-nav-item" : "data-dashboard-navigation-item";
  return paintedNav(page, role, regime).locator(`[${attribute}="${moduleId}"]`);
}

function moduleUrl(role: Role, moduleId: string): RegExp {
  const escaped = ROUTE[role].base.replace(/\//g, "\\/");
  return new RegExp(`${escaped}\\?module=${moduleId}$`);
}

/** Holds router navigation payloads until released, in arrival order. */
function holdServerNavigations(page: Page) {
  const held: Route[] = [];
  let armed = false;
  const requested: string[] = [];

  return {
    async install() {
      await page.route(
        (url) => url.searchParams.has("_rsc"),
        async (route) => {
          requested.push(new URL(route.request().url()).searchParams.get("module") ?? "");
          if (armed) {
            held.push(route);
            return;
          }
          await route.continue();
        },
      );
    },
    arm() {
      armed = true;
      requested.length = 0;
    },
    async release() {
      armed = false;
      for (const route of held.splice(0)) {
        await route.continue().catch(() => {
          /* the router aborted a superseded navigation: nothing to continue */
        });
      }
    },
    requested,
  };
}

async function expectConverged(page: Page, role: Role, regime: Regime, moduleId: string) {
  await expect(page.locator(`[data-dashboard-module-workspace="${moduleId}"]`)).toBeVisible();
  await expect(page.locator("[data-dashboard-module-workspace]")).toHaveCount(1);
  const current = paintedNav(page, role, regime).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  if (regime === "mobile") {
    const primary: readonly string[] =
      role === "admin" ? ADMIN_MOBILE_PRIMARY_MODULE_IDS : CLINIC_MOBILE_PRIMARY_MODULE_IDS;
    const slot = primary.includes(moduleId) ? moduleId : "overflow";
    await expect(current).toHaveAttribute("data-dashboard-mobile-nav-item", slot);
  } else {
    await expect(current).toHaveAttribute("data-dashboard-navigation-item", moduleId);
  }
}

async function openLanding(page: Page, role: Role) {
  const { base, landing } = ROUTE[role];
  await page.goto(base);
  await expect(page.locator(`[data-dashboard-module-workspace="${landing}"]`)).toBeVisible();
  // Settled landing: the admin landing restore and any mount-time navigation
  // must have finished before payloads start being held.
  await page.waitForLoadState("networkidle");
}

for (const role of ["admin", "clinic"] as const) {
  test.describe(`DASHBOARD_GLOBAL_LIVE_SYNC · ${role}`, () => {
    test.beforeEach(async ({ page }) => {
      await suppressNextDevChrome(page);
      await clearDashboardModuleMemory(page);
      if (role === "admin") await setAdminSession(page, "populated");
      else await setClinicSession(page, "populated");
    });

    for (const viewport of VIEWPORTS) {
      const regime = regimeFor(viewport.width);
      const label = `${viewport.width}x${viewport.height} (${regime})`;

      test(`${label}: a module switch paints before the server answers and converges with the URL`, async ({
        page,
      }) => {
        const hydrationErrors: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error" && /hydrat/i.test(message.text())) {
            hydrationErrors.push(message.text());
          }
        });
        await page.setViewportSize(viewport);
        const gate = holdServerNavigations(page);
        await gate.install();
        await openLanding(page, role);
        await expectConverged(page, role, regime, ROUTE[role].landing);

        const [first, second] = ROUTE[role].path;

        // Single switch, server held: workspace AND navigation are live.
        gate.arm();
        await navItem(page, role, regime, first).click();
        await expectConverged(page, role, regime, first);
        await gate.release();
        await expect(page).toHaveURL(moduleUrl(role, first));
        await expectConverged(page, role, regime, first);
        expect(gate.requested, "one server payload per switch").toEqual([first]);

        // Interaction immediately after a cold load (no networkidle wait).
        await page.reload();
        await navItem(page, role, regime, second).click();
        await expectConverged(page, role, regime, second);
        await expect(page).toHaveURL(moduleUrl(role, second));
        await expectConverged(page, role, regime, second);

        expect(hydrationErrors).toEqual([]);
      });

      test(`${label}: rapid A→B→C under a held server, then Back/Back/Forward`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const gate = holdServerNavigations(page);
        await gate.install();
        await openLanding(page, role);

        const { landing } = ROUTE[role];
        const [first, second, third] = ROUTE[role].path;

        gate.arm();
        await navItem(page, role, regime, first).click();
        await expectConverged(page, role, regime, first);
        await navItem(page, role, regime, second).click();
        await expectConverged(page, role, regime, second);
        await navItem(page, role, regime, third).click();
        await expectConverged(page, role, regime, third);
        await gate.release();

        // No superseded payload may win: URL, workspace and navigation agree on C.
        await expect(page).toHaveURL(moduleUrl(role, third));
        await expectConverged(page, role, regime, third);

        // History from the converged state: every step agrees on all three.
        await navItem(page, role, regime, first).click();
        await expect(page).toHaveURL(moduleUrl(role, first));
        await expectConverged(page, role, regime, first);
        await page.goBack();
        await expect(page).toHaveURL(moduleUrl(role, third));
        await expectConverged(page, role, regime, third);
        await page.goBack();
        await expect(page).not.toHaveURL(moduleUrl(role, third));
        const backTarget = new URL(page.url()).searchParams.get("module") ?? landing;
        await expectConverged(page, role, regime, backTarget);
        await page.goForward();
        await expect(page).toHaveURL(moduleUrl(role, third));
        await expectConverged(page, role, regime, third);
      });
    }
  });
}

// Destinations outside the navigation band go through the same activation, so
// they are held to the same contract: one representative regime each.
test.describe("DASHBOARD_GLOBAL_LIVE_SYNC · destinations outside the band", () => {
  test.beforeEach(async ({ page }) => {
    await suppressNextDevChrome(page);
    await clearDashboardModuleMemory(page);
  });

  for (const { role, target, query } of [
    { role: "admin", target: "admin-pricing", query: "Precios" },
    { role: "clinic", target: "logistica", query: "Logística" },
  ] as const) {
    test(`${role} app-bar module search paints before the server answers`, async ({ page }) => {
      if (role === "admin") await setAdminSession(page, "populated");
      else await setClinicSession(page, "populated");
      await page.setViewportSize({ width: 1366, height: 768 });
      const gate = holdServerNavigations(page);
      await gate.install();
      await openLanding(page, role);

      gate.arm();
      await page.locator('[data-workspace-app-bar-search-input="true"]').fill(query);
      await page.locator(`[data-workspace-app-bar-search-option="${target}"]`).click();
      await expectConverged(page, role, "drawer", target);
      await gate.release();
      await expect(page).toHaveURL(moduleUrl(role, target));
      await expectConverged(page, role, "drawer", target);
    });
  }

  test("admin overview module link paints before the server answers", async ({ page }) => {
    await setAdminSession(page, "populated");
    await page.setViewportSize({ width: 1366, height: 768 });
    const gate = holdServerNavigations(page);
    await gate.install();
    await openLanding(page, "admin");

    gate.arm();
    await page.getByRole("button", { name: "Ir a Clínicas" }).filter({ visible: true }).click();
    await expectConverged(page, "admin", "drawer", "admin-clinics");
    await gate.release();
    await expect(page).toHaveURL(moduleUrl("admin", "admin-clinics"));
    await expectConverged(page, "admin", "drawer", "admin-clinics");
  });

  for (const { role, trigger, target } of [
    { role: "admin", trigger: "Menú de administración", target: "admin-sessions" },
    { role: "clinic", trigger: "Menú de la clínica", target: "perfil" },
  ] as const) {
    test(`${role} mobile kebab password destination paints before the server answers`, async ({ page }) => {
      if (role === "admin") await setAdminSession(page, "populated");
      else await setClinicSession(page, "populated");
      await page.setViewportSize({ width: 390, height: 844 });
      const gate = holdServerNavigations(page);
      await gate.install();
      await openLanding(page, role);

      gate.arm();
      await page.getByRole("button", { name: trigger }).filter({ visible: true }).click();
      await page.getByRole("button", { name: "Cambiar contraseña" }).filter({ visible: true }).click();
      await expectConverged(page, role, "mobile", target);
      await gate.release();
      await expect(page).toHaveURL(moduleUrl(role, target));
      await expectConverged(page, role, "mobile", target);
    });
  }
});
