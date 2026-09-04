import { expect, test, type Page } from "@playwright/test";

import {
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_GEOMETRY_SURFACE_COUNT,
  DASHBOARD_GEOMETRY_VIEWPORTS,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
} from "../helpers/dashboard-geometry-matrix";

// ─────────────────────────────────────────────────────────────────────────────
// B10 · Clinic app-shell unification runtime contract.
//
// The static half is
// `test/architecture/dashboard-b10-clinic-shell-unification.test.ts`; this spec
// proves the DOM the six routes used to build by hand is the DOM the single
// `ClinicDashboardShell` builds for them.
//
// WHAT B10 CHANGED, AND WHAT THIS MEASURES. B08 and B09 had already removed the
// two bands P0-04 measured, so the six clinic routes did not differ in their
// chrome — they differed in who DECLARED it. B10 gives that declaration one
// owner. The observable contract is therefore an EQUIVALENCE: exactly one app
// bar, one lateral band, one `main.dashboard-main` per route, with `main`'s
// direct children unchanged.
//
// WHY DIRECT CHILDREN ARE ASSERTED. Two shipped rules read that position — the
// rhythm owl `.dashboard-main > :not([hidden]) ~ :not([hidden])`
// (responsive.css) and `.dashboard-main:has(> [data-sticky-action-bar="true"])`
// (zero-scroll.css). B09 already paid for forgetting this once: retiring the
// rail turned a second child into an only child and silently dropped one
// `--dash-rhythm` at all 13 viewports. A shell that re-parented `children`
// would repeat it, and no band assertion would notice.
//
// NO SECOND INVENTORY. The five full routes are DERIVED from the canonical
// A02/A08 matrix by shell type and the probe viewports are taken by slug, so a
// surface or viewport added there cannot silently escape this spec.
// `beforeAll` fails closed if either cardinality moves.
//
// BOUNDARY. A08 owns zero-scroll over the full 21x13 matrix and B06 owns the
// app-bar band over the same matrix; both stay green on their own and are not
// re-litigated here. What this spec re-checks is only what a change of shell
// OWNER can break: the count of each band, main's child structure, and that
// deep links, reload and Back/Forward still resolve.
//
// B09 FENCE. The mobile bar derives its active module from `?module=` alone,
// so on the five full routes it marks "Inicio" below 768px. B10 PRESERVES that
// behaviour deliberately and this spec pins it, so a later change to it is a
// decision and not an accident.
// ─────────────────────────────────────────────────────────────────────────────

const APP_ORIGIN = "http://127.0.0.1:3000";

const APP_BAR_SELECTOR = '[data-workspace-app-bar="true"]';
const TOPBAR_SELECTOR = 'header[data-dashboard-topbar-polish="true"]';
const FRAME_SELECTOR = '[data-dashboard-navigation-frame="clinic"]';
const DRAWER_SELECTOR = "[data-dashboard-navigation-drawer]";
const RAIL_SELECTOR = "[data-dashboard-navigation-rail]";
const MOBILE_NAV_SELECTOR = "[data-dashboard-mobile-nav]";
const MAIN_SELECTOR = "main.dashboard-main";
/**
 * A05 reservation root. The attribute has THREE owners in the tree —
 * `InformesReportsList` and `LogisticsRecentListCanvas` each mark their own
 * canvas with it, and `/dashboard/logistica` marks `main` itself. B10 only
 * moved the last one (route `<main>` -> shell `<main>`), so every assertion
 * here is scoped to `main` and never to the bare attribute, which would also
 * match the two canvas roots that predate B10 and are none of its business.
 */
const RESERVATION_SELECTOR = `${MAIN_SELECTOR}[data-dashboard-adaptive-reservation="true"]`;

const RAIL_MIN_WIDTH_PX = 768;
const DRAWER_MIN_WIDTH_PX = 1280;

/** Probe viewports, taken by slug from the canonical matrix. */
const PROBE_SLUGS = ["w390x844", "w1024x768", "w1920x1080"] as const;

type ClinicRoute = {
  readonly label: string;
  readonly path: string;
  /** Surface id of the canonical matrix used to stub this route's endpoints. */
  readonly surfaceId: string;
  /** Module the lateral band must mark, or null when the URL decides. */
  readonly activeModule: string | null;
  /** First direct child of `main`, by selector. */
  readonly firstChild: string;
  /** Expected number of direct children of `main`. */
  readonly directChildren: number;
};

/**
 * `/dashboard` plus the five full routes. The full routes are derived from the
 * canonical matrix rather than re-listed, so this census cannot drift from it.
 */
const CLINIC_MODULE_ROUTE: ClinicRoute = {
  label: "clinic module shell",
  path: "/dashboard?module=operaciones",
  surfaceId: "clinic-operaciones",
  activeModule: "operaciones",
  firstChild: '[data-dashboard-module-stage="true"]',
  directChildren: 1,
};

const FULL_ROUTE_EXPECTATIONS: Readonly<
  Record<string, Pick<ClinicRoute, "activeModule" | "firstChild" | "directChildren">>
> = Object.freeze({
  "clinic-informes-full": {
    activeModule: "informes",
    firstChild: 'main.dashboard-main > [data-dashboard-module-stage="true"]',
    directChildren: 1,
  },
  "clinic-logistica-full": {
    activeModule: "logistica",
    firstChild: 'main.dashboard-main > [data-dashboard-module-stage="true"]',
    directChildren: 1,
  },
  "clinic-log-metricas": {
    activeModule: "logistica",
    firstChild: 'main.dashboard-main > [data-dashboard-module-stage="true"]',
    directChildren: 1,
  },
  "clinic-log-rutas": {
    activeModule: "logistica",
    firstChild: 'main.dashboard-main > [data-dashboard-module-stage="true"]',
    directChildren: 1,
  },
  "clinic-log-visitas": {
    activeModule: "logistica",
    firstChild: 'main.dashboard-main > [data-dashboard-module-stage="true"]',
    directChildren: 1,
  },
});

const FULL_ROUTES: ClinicRoute[] = DASHBOARD_GEOMETRY_SURFACES.filter(
  (surface) => surface.shellType === "clinic-full-route",
).map((surface) => {
  const expectation = FULL_ROUTE_EXPECTATIONS[surface.id];
  if (!expectation) {
    throw new Error(
      `B10: clinic full route "${surface.id}" has no declared expectation — fail closed`,
    );
  }
  return {
    label: surface.id,
    path: surface.route,
    surfaceId: surface.id,
    ...expectation,
  };
});

const CLINIC_ROUTES: ClinicRoute[] = [CLINIC_MODULE_ROUTE, ...FULL_ROUTES];

const PROBES = PROBE_SLUGS.map((slug) => {
  const viewport = DASHBOARD_GEOMETRY_VIEWPORTS.find(
    (candidate) => candidate.slug === slug,
  );
  if (!viewport) {
    throw new Error(`B10: probe viewport "${slug}" left the canonical matrix`);
  }
  return viewport;
});

type Regime = "mobile" | "rail" | "drawer";

function regimeFor(width: number): Regime {
  if (width >= DRAWER_MIN_WIDTH_PX) return "drawer";
  if (width >= RAIL_MIN_WIDTH_PX) return "rail";
  return "mobile";
}

/**
 * The PAINTED band. `DashboardNavigationFrame` streams the url-derived
 * navigation through a Suspense boundary whose fallback mounts a SECOND copy
 * with the same attributes, so a bare selector can resolve to two nodes while
 * exactly one is visible. Filtering the OWNER does not relax the contract:
 * zero visible bands still fail, and two still fail on strictness.
 */
function painted(page: Page, selector: string) {
  return page.locator(selector).filter({ visible: true });
}

async function prepareClinic(page: Page): Promise<void> {
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

  const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE.clinic;
  await page
    .context()
    .addCookies([{ name: cookie.name, value: cookie.value, url: APP_ORIGIN }]);

  // Stub every clinic surface: this spec navigates between them, and a module
  // whose endpoint the shared fixture answers 404 for would render an error
  // card instead of its content.
  for (const surface of DASHBOARD_GEOMETRY_SURFACES) {
    if (surface.role !== "clinic") continue;
    await installSurfaceMocks(page, surface);
  }
}

async function gotoClinic(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator(MAIN_SELECTOR)).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  await waitForLayoutSettled(page);
}

/** Direct children of `main`, counted in the DOM rather than inferred. */
async function directChildCount(page: Page): Promise<number> {
  return page.evaluate((selector) => {
    const main = document.querySelector(selector);
    return main ? main.children.length : -1;
  }, MAIN_SELECTOR);
}

test.beforeAll(() => {
  expect(
    DASHBOARD_GEOMETRY_SURFACES.length,
    "A02 surface cardinality feeds this spec",
  ).toBe(DASHBOARD_GEOMETRY_SURFACE_COUNT);
  expect(FULL_ROUTES.length, "five clinic full routes are B10's").toBe(5);
  expect(CLINIC_ROUTES.length, "six clinic routes are B10's").toBe(6);
  expect(new Set(CLINIC_ROUTES.map((route) => route.path)).size).toBe(6);
  expect(PROBES.length, "three probe viewports").toBe(3);
});

// ── One owner per band, on every clinic route ────────────────────────────────

test.describe("B10 · one shell owner across the six clinic routes", () => {
  for (const route of CLINIC_ROUTES) {
    for (const probe of PROBES) {
      test(`${route.label} @ ${probe.slug}: exactly one topbar, one band, one main`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: probe.width,
          height: probe.height,
        });
        await prepareClinic(page);
        await gotoClinic(page, route.path);

        // Exactly one app bar and one topbar header, full width, painted once.
        await expect(
          painted(page, TOPBAR_SELECTOR),
          "one clinic topbar",
        ).toHaveCount(1);
        await expect(
          painted(page, APP_BAR_SELECTOR),
          "one workspace app bar",
        ).toHaveCount(1);

        // `main` is singular and is NOT duplicated by the shell.
        await expect(page.locator(MAIN_SELECTOR), "one main region").toHaveCount(
          1,
        );

        // Exactly one navigation frame; the band it paints depends on regime.
        await expect(
          painted(page, FRAME_SELECTOR),
          "one clinic navigation frame",
        ).toHaveCount(1);

        const regime = regimeFor(probe.width);
        if (regime === "drawer") {
          await expect(painted(page, DRAWER_SELECTOR)).toHaveCount(1);
          await expect(painted(page, RAIL_SELECTOR)).toHaveCount(0);
          await expect(painted(page, MOBILE_NAV_SELECTOR)).toHaveCount(0);
        } else if (regime === "rail") {
          await expect(painted(page, RAIL_SELECTOR)).toHaveCount(1);
          await expect(painted(page, DRAWER_SELECTOR)).toHaveCount(0);
          await expect(painted(page, MOBILE_NAV_SELECTOR)).toHaveCount(0);
        } else {
          await expect(painted(page, MOBILE_NAV_SELECTOR)).toHaveCount(1);
          await expect(painted(page, DRAWER_SELECTOR)).toHaveCount(0);
          await expect(painted(page, RAIL_SELECTOR)).toHaveCount(0);
        }
      });
    }
  }
});

// ── main's direct-child structure owns one canonical stage ───────────────────

test.describe("B10 · main owns one canonical module stage", () => {
  for (const route of CLINIC_ROUTES) {
    test(`${route.label}: main owns the canonical module stage`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await prepareClinic(page);
      await gotoClinic(page, route.path);

      expect(
        await directChildCount(page),
        `${route.label}: main's direct child count`,
      ).toBe(route.directChildren);

      await expect(
        page.locator(route.firstChild).first(),
        `${route.label}: canonical stage is the direct child of main`,
      ).toBeVisible();

      await expect(
        page.locator(
          'main.dashboard-main > [data-dashboard-module-stage="true"] > [data-dashboard-module-workspace]',
        ),
        `${route.label}: canonical stage owns one workspace`,
      ).toHaveCount(1);

      // The shell must not re-parent children behind a wrapper: `main` is the
      // element the rhythm owl and the sticky-action :has() rule read.
      const mainIsFrameChild = await page.evaluate(
        ({ mainSelector, frameSelector }) => {
          const main = document.querySelector(mainSelector);
          const frame = document.querySelector(frameSelector);
          return Boolean(main && frame && main.parentElement === frame);
        },
        { mainSelector: MAIN_SELECTOR, frameSelector: FRAME_SELECTOR },
      );
      expect(
        mainIsFrameChild,
        `${route.label}: main is a direct child of the navigation frame`,
      ).toBe(true);
    });
  }
});

test("B10 · the logistics hub keeps its reservation root without legacy sticky chrome", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await prepareClinic(page);
  await gotoClinic(page, "/dashboard/logistica");

  // The reservation attribute must land on `main` ITSELF (A05), read off the
  // element rather than matched by a selector, so a wrapper the shell might
  // have introduced could not satisfy it.
  const reservationOnMain = await page.evaluate((selector) => {
    const main = document.querySelector(selector);
    return main?.getAttribute("data-dashboard-adaptive-reservation") ?? null;
  }, MAIN_SELECTOR);
  expect(reservationOnMain, "main itself is the reservation root").toBe("true");

  await expect(
    page.locator('[data-sticky-action-bar="true"]'),
    "CMP-06 keeps logistics actions inside its module card",
  ).toHaveCount(0);
});

test("B10 · only the logistics hub claims the reservation root", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await prepareClinic(page);

  for (const route of CLINIC_ROUTES) {
    if (route.path === "/dashboard/logistica") continue;
    await gotoClinic(page, route.path);
    await expect(
      page.locator(RESERVATION_SELECTOR),
      `${route.label} must not claim the adaptive reservation root`,
    ).toHaveCount(0);
  }
});

// ── Deep links, reload and Back/Forward ──────────────────────────────────────

test.describe("B10 · navigation contracts survive the shared shell", () => {
  test("every clinic route answers its own deep link", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await prepareClinic(page);

    for (const route of CLINIC_ROUTES) {
      await gotoClinic(page, route.path);
      await expect(page).toHaveURL(new RegExp(escapeForUrl(route.path)));
      await expect(painted(page, TOPBAR_SELECTOR)).toHaveCount(1);
      await expect(page.locator(MAIN_SELECTOR)).toHaveCount(1);
    }
  });

  test("a deep-linked full route survives reload", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await prepareClinic(page);
    await gotoClinic(page, "/dashboard/informes");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(MAIN_SELECTOR)).toBeVisible({ timeout: 20_000 });
    await waitForLayoutSettled(page);

    await expect(page).toHaveURL(/\/dashboard\/informes/);
    await expect(painted(page, TOPBAR_SELECTOR)).toHaveCount(1);
    await expect(painted(page, FRAME_SELECTOR)).toHaveCount(1);
    await expect(page.locator(MAIN_SELECTOR)).toHaveCount(1);
  });

  test("Back and Forward move between the module shell and a full route", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await prepareClinic(page);

    await gotoClinic(page, "/dashboard?module=operaciones");
    await gotoClinic(page, "/dashboard/logistica/visitas");
    await expect(page).toHaveURL(/\/dashboard\/logistica\/visitas/);

    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page.locator(MAIN_SELECTOR)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard\?module=operaciones/);
    await expect(painted(page, TOPBAR_SELECTOR)).toHaveCount(1);
    await expect(page.locator(MAIN_SELECTOR)).toHaveCount(1);

    await page.goForward({ waitUntil: "domcontentloaded" });
    await expect(page.locator(MAIN_SELECTOR)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard\/logistica\/visitas/);
    await expect(painted(page, TOPBAR_SELECTOR)).toHaveCount(1);
    await expect(page.locator(MAIN_SELECTOR)).toHaveCount(1);
  });
});

// ── The lateral band still reports the module each route declares ────────────

test.describe("B10 · the declared active module reaches the lateral band", () => {
  for (const route of CLINIC_ROUTES) {
    test(`${route.label}: the band marks ${route.activeModule}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await prepareClinic(page);
      await gotoClinic(page, route.path);

      const band = painted(page, DRAWER_SELECTOR);
      await expect(band).toHaveCount(1);
      await expect(
        band.locator(
          `[data-dashboard-navigation-item="${route.activeModule}"]`,
        ),
        `${route.label}: ${route.activeModule} is aria-current`,
      ).toHaveAttribute("aria-current", "page", { timeout: 15_000 });
      await expect(
        band.locator("[aria-current='page']"),
        `${route.label}: exactly one module is current`,
      ).toHaveCount(1);
    });
  }
});

// ── B09 fence: the mobile bar's behaviour is preserved, not corrected ────────

test("B10 · the mobile bar still marks Inicio on a full route (preserved B09 behaviour)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareClinic(page);
  await gotoClinic(page, "/dashboard/informes");

  const bar = painted(page, MOBILE_NAV_SELECTOR);
  await expect(bar).toHaveCount(1);

  // The bar derives its active module from `?module=` alone, and a full route
  // carries none. B10 preserves this deliberately: the shell publishes its
  // module to the lateral frame only. Changing it is a declared follow-up, so
  // this assertion exists to make that change a decision rather than a
  // side effect.
  await expect(
    bar.locator('[data-dashboard-mobile-nav-item="home"]'),
    "the mobile bar marks Inicio on a full route",
  ).toHaveAttribute("aria-current", "page", { timeout: 15_000 });
  await expect(
    bar.locator("[aria-current='page']"),
    "exactly one mobile entry is current",
  ).toHaveCount(1);
});

function escapeForUrl(path: string): string {
  return path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
