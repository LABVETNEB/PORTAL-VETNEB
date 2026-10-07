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
    /**
     * `continue` lets every held payload reach the fixture and waits until each
     * one has settled (a late response); `abort` fails them as a cancelled
     * request would. Either way nothing is left in flight when it resolves.
     */
    async release(mode: "continue" | "abort" = "continue") {
      armed = false;
      for (const route of held.splice(0)) {
        if (mode === "abort") {
          await route.abort().catch(() => {
            /* the router already dropped this request */
          });
          continue;
        }
        const continued = await route.continue().then(
          () => true,
          () => false /* the router aborted a superseded navigation */,
        );
        if (continued) await route.request().response();
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

// ─────────────────────────────────────────────────────────────────────────────
// Back/Forward during a PENDING activation. The stage swapped to B on the click
// while B's payload is still in flight; Back is an external, authoritative
// navigation, so it must win: the optimistic B is abandoned, URL, workspace and
// navigation follow history, and B's late answer (or its cancellation) can
// neither repaint B nor write B into history.
// ─────────────────────────────────────────────────────────────────────────────

async function recordHistoryWrites(page: Page) {
  await page.addInitScript(() => {
    const writes: string[] = [];
    Object.defineProperty(window, "__vetnebHistoryWrites", { value: writes });
    for (const method of ["pushState", "replaceState"] as const) {
      const original = window.history[method].bind(window.history);
      window.history[method] = (data, unused, url) => {
        writes.push(String(url ?? ""));
        return original(data, unused, url);
      };
    }
  });
}

function historyWrites(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...((window as unknown as { __vetnebHistoryWrites: string[] }).__vetnebHistoryWrites ?? []),
  ]);
}

/** Two frames: whatever a settled payload was going to paint has painted. */
async function flushPaint(page: Page) {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

function urlFor(role: Role, moduleId: string): RegExp {
  return role === "clinic" && moduleId === ROUTE.clinic.landing ? /\/dashboard$/ : moduleUrl(role, moduleId);
}

type PendingBackCase = {
  readonly name: string;
  readonly role: Role;
  readonly viewport: { readonly width: number; readonly height: number };
  /** Modules committed before the pending activation; Back lands on the one before the last. */
  readonly prime: readonly string[];
  readonly backTo: string;
  readonly target: string;
  readonly activate: (page: Page) => Promise<void>;
  /** The band matrix also cancels B; the other producers share its owner. */
  readonly modes: readonly ("continue" | "abort")[];
  /** Url of the last primed entry when it is not the module's canonical one. */
  readonly committedUrl?: RegExp;
};

const PENDING_BACK_REGIMES = [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;

const PENDING_BACK_CASES: PendingBackCase[] = [
  ...(["admin", "clinic"] as const).flatMap((role) =>
    PENDING_BACK_REGIMES.map((viewport): PendingBackCase => {
      const regime = regimeFor(viewport.width);
      const [first, second] = ROUTE[role].path;
      return {
        name: `${role} ${regime} ${viewport.width}x${viewport.height}`,
        role,
        viewport,
        prime: [first],
        backTo: ROUTE[role].landing,
        target: second,
        activate: (page) => navItem(page, role, regime, second).click(),
        modes: ["continue", "abort"],
      };
    }),
  ),
  ...(
    [
      { role: "admin", target: "admin-pricing", query: "Precios" },
      { role: "clinic", target: "tokens", query: "Tokens" },
    ] as const
  ).map(
    ({ role, target, query }): PendingBackCase => ({
      name: `${role} app-bar search`,
      role,
      viewport: { width: 1366, height: 768 },
      prime: [ROUTE[role].path[0]],
      backTo: ROUTE[role].landing,
      target,
      activate: async (page) => {
        await page.locator('[data-workspace-app-bar-search-input="true"]').fill(query);
        await page.locator(`[data-workspace-app-bar-search-option="${target}"]`).click();
      },
      modes: ["continue"],
    }),
  ),
  {
    name: "admin overview module link",
    role: "admin",
    viewport: { width: 1366, height: 768 },
    prime: ["admin-clinics", "admin"],
    backTo: "admin-clinics",
    target: "audit-log",
    activate: (page) =>
      page.getByRole("button", { name: "Ir a Auditoría" }).filter({ visible: true }).click(),
    modes: ["continue"],
  },
  // Back to an entry that carries the SAME module as the committed one
  // (`/dashboard` and `/dashboard?module=operaciones`): no module change reaches
  // the url effect, so only the history backstop can drop B.
  ...([
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ] as const).map(
    (viewport): PendingBackCase => ({
      name: `clinic ${regimeFor(viewport.width)} Back to the same committed module`,
      role: "clinic",
      viewport,
      prime: ["operaciones"],
      committedUrl: /\/dashboard\?module=operaciones$/,
      backTo: "operaciones",
      target: "logistica",
      activate: (page) => navItem(page, "clinic", regimeFor(viewport.width), "logistica").click(),
      modes: ["continue", "abort"],
    }),
  ),
  ...(
    [
      { role: "admin", trigger: "Menú de administración", target: "admin-sessions" },
      { role: "clinic", trigger: "Menú de la clínica", target: "perfil" },
    ] as const
  ).map(
    ({ role, trigger, target }): PendingBackCase => ({
      name: `${role} mobile kebab`,
      role,
      viewport: { width: 390, height: 844 },
      prime: [ROUTE[role].path[0]],
      backTo: ROUTE[role].landing,
      target,
      activate: async (page) => {
        await page.getByRole("button", { name: trigger }).filter({ visible: true }).click();
        await page.getByRole("button", { name: "Cambiar contraseña" }).filter({ visible: true }).click();
      },
      modes: ["continue"],
    }),
  ),
];

test.describe("DASHBOARD_GLOBAL_LIVE_SYNC · Back during a pending activation", () => {
  test.beforeEach(async ({ page }) => {
    await suppressNextDevChrome(page);
    await clearDashboardModuleMemory(page);
    await recordHistoryWrites(page);
  });

  for (const testCase of PENDING_BACK_CASES) {
    for (const mode of testCase.modes) {
      const outcome = mode === "continue" ? "answers late" : "is cancelled";
      test(`${testCase.name}: Back wins while the payload is held, and still wins when it ${outcome}`, async ({
        page,
      }) => {
        const { role, viewport, prime, backTo, target } = testCase;
        const regime = regimeFor(viewport.width);
        if (role === "admin") await setAdminSession(page, "populated");
        else await setClinicSession(page, "populated");
        await page.setViewportSize(viewport);
        const gate = holdServerNavigations(page);
        await gate.install();
        await openLanding(page, role);

        const committed = prime[prime.length - 1];
        const committedUrl = testCase.committedUrl ?? urlFor(role, committed);
        for (const moduleId of prime) {
          await navItem(page, role, regime, moduleId).click();
          await expect(page).toHaveURL(moduleId === committed ? committedUrl : urlFor(role, moduleId));
          await expectConverged(page, role, regime, moduleId);
        }
        const historyLength = await page.evaluate(() => window.history.length);
        const writesBefore = (await historyWrites(page)).length;

        // Pending activation: the stage and the navigation are already on B.
        gate.arm();
        await testCase.activate(page);
        await expectConverged(page, role, regime, target);
        await expect(page).toHaveURL(committedUrl);

        // Back while B is still in flight: history wins immediately.
        await page.goBack();
        await expect(page).toHaveURL(urlFor(role, backTo));
        await expectConverged(page, role, regime, backTo);

        // B's late answer (or its cancellation) cannot undo Back.
        await gate.release(mode);
        await page.waitForLoadState("networkidle");
        await flushPaint(page);
        await expect(page).toHaveURL(urlFor(role, backTo));
        await expectConverged(page, role, regime, backTo);
        expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
        const lateWrites = (await historyWrites(page)).slice(writesBefore);
        expect(
          lateWrites.filter((url) => url.includes(`module=${target}`)),
          "no history write may target the abandoned module",
        ).toEqual([]);
        expect(
          gate.requested.filter((moduleId) => moduleId === target),
          "one payload for the abandoned activation, never a reconciling replay",
        ).toHaveLength(1);

        // Forward restores exactly the entry Back left.
        await page.goForward();
        await expect(page).toHaveURL(committedUrl);
        await expectConverged(page, role, regime, committed);
      });
    }
  }
});
