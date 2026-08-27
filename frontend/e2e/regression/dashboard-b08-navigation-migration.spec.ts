import { expect, test, type Page } from "@playwright/test";

import {
  DARK_GRAY_THEME_MODE,
  NORMAL_THEME_MODE,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "../../src/lib/theme";
import {
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACE_COUNT,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_GEOMETRY_VIEWPORT_COUNT,
  DASHBOARD_GEOMETRY_VIEWPORTS,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
  type DashboardGeometryShellType,
  type DashboardGeometrySurface,
} from "../helpers/dashboard-geometry-matrix";

// ─────────────────────────────────────────────────────────────────────────────
// B08 · Navigation migration runtime contract.
//
// B08 mounts the B07 primitives on every surface that depended on the
// desktop/tablet navigation and retires the legacy navigation from that regime.
// This spec is the runtime half; the static half is
// `test/architecture/dashboard-b08-navigation-migration.test.ts`.
//
// NO SECOND INVENTORY. The surfaces come from the canonical A02/A08/B04/B06
// matrix (`../helpers/dashboard-geometry-matrix`). This spec derives ONE
// representative per shell type from it and fails in `beforeAll` if the
// canonical cardinality moves or a shell type stops being covered — so a
// surface added there cannot silently escape B08.
//
// THE TWO RETIREMENTS ARE NOT SYMMETRIC, and the assertions below encode that:
//
//   LEGACY_HORIZONTAL_NAV_PHYSICAL_RETIREMENT = REQUIRED
//     `[data-dashboard-horizontal-nav-shell]` must not exist at ANY viewport.
//     The component was a pure >=768px surface, so nothing below 768px loses
//     navigation with it.
//
//   LEGACY_MODULE_RAIL_DESKTOP_RETIREMENT = REQUIRED
//   LEGACY_MODULE_RAIL_PHYSICAL_RETIREMENT = CLOSED_BY_B09
//     B08 could only hide `[data-dashboard-module-rail]` from 768px up: below
//     that it was the clinic `/dashboard` module navigation, because
//     `ClinicMobileBottomNav` returned null there. B09 shipped
//     `DashboardMobileNav`, removed that early return and deleted the rail, so
//     the selector must now resolve to NOTHING at any viewport — the same
//     assertion the horizontal nav already carries.
//
// REGIME LADDER (audit §49 / B07 §7):
//
//   <  768 px        DashboardMobileNav (B09) · both primitives hidden
//   768 – 1279 px    NavigationRail   80 ±1 px  · item 56 px
//   >= 1280 px       NavigationDrawer 256 ±1 px · item 40 px
//
// BOUNDARY WITH A08 AND B06. A08 owns zero-scroll over the full 21x13 matrix
// and B06 owns the app-bar band over the same matrix; both stay green on their
// own. What is re-asserted here is narrower and specific to this change: the
// lateral band must cost INLINE size and not vertical budget, so on every
// combination this spec measures, the document must still not scroll, `main`
// must still not be an operational scroll container, and the app bar must still
// be one full-width 56 ±2 px row that does not overlap `main`. Those four are
// exactly the invariants a lateral band can break.
// ─────────────────────────────────────────────────────────────────────────────

const APP_ORIGIN = "http://127.0.0.1:3000";

const DRAWER_SELECTOR = "[data-dashboard-navigation-drawer]";
const RAIL_SELECTOR = "[data-dashboard-navigation-rail]";
const FRAME_SELECTOR = "[data-dashboard-navigation-frame]";
const LEGACY_HORIZONTAL_NAV_SELECTOR = "[data-dashboard-horizontal-nav-shell]";
const LEGACY_MODULE_RAIL_SELECTOR = "[data-dashboard-module-rail]";
/** B09 mobile model: the single owner below 768px, on both roles. */
const MOBILE_NAV_SELECTOR = "[data-dashboard-mobile-nav]";
const APP_BAR_SELECTOR = '[data-workspace-app-bar="true"]';
const MAIN_SELECTOR = "main.dashboard-main";

/** Geometry ledger of tokens.css, mirrored. Never re-declared in `.tsx`. */
const DRAWER_WIDTH_PX = 256;
const RAIL_WIDTH_PX = 80;
const DRAWER_ITEM_HEIGHT_PX = 40;
const RAIL_ITEM_HEIGHT_PX = 56;
const BAND_TOLERANCE_PX = 1;
/** Items are pinned by min/max block-size, so they carry no band of their own. */
const ITEM_TOLERANCE_PX = 0.5;

const APP_BAR_TARGET_PX = 56;
const APP_BAR_TOLERANCE_PX = 2;

const RAIL_MIN_WIDTH_PX = 768;
const DRAWER_MIN_WIDTH_PX = 1280;

type Regime = "mobile" | "rail" | "drawer";

function regimeFor(viewportWidth: number): Regime {
  if (viewportWidth >= DRAWER_MIN_WIDTH_PX) return "drawer";
  if (viewportWidth >= RAIL_MIN_WIDTH_PX) return "rail";
  return "mobile";
}

/**
 * Breakpoint probes. Six are canonical viewports of the shared matrix, taken by
 * slug so a change there is a change here. `w1279x800` is the only local one:
 * it is the last pixel of the rail regime and the shared matrix has no
 * viewport on that edge — an off-by-one in the media query is invisible without
 * it.
 */
const CANONICAL_PROBE_SLUGS = [
  "w360x800",
  "w768x1024",
  "w1024x768",
  "w1280x720",
  "w1366x768",
  "w1920x1080",
] as const;

const RAIL_EDGE_PROBE = {
  slug: "w1279x800",
  name: "Rail regime upper edge 1279x800",
  width: 1279,
  height: 800,
} as const;

const VIEWPORT_PROBES = [
  ...CANONICAL_PROBE_SLUGS.map((slug) => {
    const viewport = DASHBOARD_GEOMETRY_VIEWPORTS.find((item) => item.slug === slug);
    if (!viewport) {
      throw new Error(
        `B08: canonical viewport ${slug} disappeared from the shared matrix`,
      );
    }
    return viewport;
  }),
  RAIL_EDGE_PROBE,
].sort((left, right) => left.width - right.width);

/**
 * One representative per shell type, derived from the canonical inventory in
 * declaration order. The derivation is asserted complete in `beforeAll`: a new
 * shell type in the shared matrix fails B08 instead of slipping past it.
 */
const SHELL_TYPES: readonly DashboardGeometryShellType[] = [
  "admin-hub",
  "admin-module",
  "clinic-module",
  "clinic-full-route",
];

const REPRESENTATIVES: readonly DashboardGeometrySurface[] = SHELL_TYPES.map(
  (shellType) => {
    const surface = DASHBOARD_GEOMETRY_SURFACES.find(
      (item) => item.shellType === shellType,
    );
    if (!surface) {
      throw new Error(`B08: no canonical surface for shell type ${shellType}`);
    }
    return surface;
  },
);

/** The clinic module shell, whose <768px navigation is the legacy rail. */
const CLINIC_MODULE_SURFACE = REPRESENTATIVES.find(
  (surface) => surface.shellType === "clinic-module",
)!;

const THEME_PROBE_SLUGS = ["w1366x768", "w768x1024"] as const;

type BandReading = {
  readonly drawerVisible: boolean;
  readonly railVisible: boolean;
  readonly legacyRailCount: number;
  readonly mobileNavVisible: boolean;
  readonly legacyHorizontalNavCount: number;
  readonly drawerCount: number;
  readonly railCount: number;
  readonly frameCount: number;
  readonly drawerWidth: number | null;
  readonly railWidth: number | null;
  readonly drawerItemHeights: readonly number[];
  readonly railItemHeights: readonly number[];
  readonly activeItems: readonly string[];
  readonly bandRight: number | null;
  readonly mainLeft: number | null;
  readonly mainTop: number | null;
  readonly bandPosition: string | null;
  // Frame invariants a lateral band can break.
  readonly htmlScrollTop: number;
  readonly bodyScrollTop: number;
  readonly mainScrollTop: number;
  readonly mainScrollHeight: number;
  readonly mainClientHeight: number;
  readonly htmlScrollWidth: number;
  readonly htmlClientWidth: number;
  // B06.
  readonly appBarCount: number;
  readonly appBarHeight: number | null;
  readonly appBarWidth: number | null;
  readonly appBarBottom: number | null;
  readonly appBarShadow: string | null;
};

async function installTheme(page: Page, theme: ThemeMode): Promise<void> {
  await page.addInitScript(
    ([key, mode]) => {
      try {
        window.localStorage.setItem(key, mode);
      } catch {
        /* localStorage unavailable: the theme assertion reports it */
      }
    },
    [THEME_STORAGE_KEY, theme] as const,
  );
}

async function readBand(page: Page): Promise<BandReading> {
  return page.evaluate(
    ({
      drawerSel,
      railSel,
      frameSel,
      legacyNavSel,
      legacyRailSel,
      mobileNavSel,
      appBarSel,
      mainSel,
    }) => {
      const isVisible = (element: Element | null): boolean => {
        if (!element) return false;
        const candidate = element as Element & {
          checkVisibility?: (options?: Record<string, boolean>) => boolean;
        };
        if (typeof candidate.checkVisibility === "function") {
          return candidate.checkVisibility({ checkVisibilityCSS: true });
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const drawer = document.querySelector<HTMLElement>(drawerSel);
      const rail = document.querySelector<HTMLElement>(railSel);
      const main = document.querySelector<HTMLElement>(mainSel);
      const appBar = document.querySelector<HTMLElement>(appBarSel);
      const html = document.documentElement;
      const body = document.body;

      const drawerVisible = isVisible(drawer);
      const railVisible = isVisible(rail);
      const band = drawerVisible ? drawer : railVisible ? rail : null;

      const heights = (root: HTMLElement | null, itemClass: string): number[] =>
        root
          ? Array.from(
              root.querySelectorAll<HTMLElement>(`.${itemClass}`),
            ).map((item) => Math.round(item.getBoundingClientRect().height * 100) / 100)
          : [];

      // Only the mounted band's active item counts: the two primitives coexist
      // in the DOM and both mark the same module, so counting both would report
      // a duplicate that the user can never see.
      const activeItems = band
        ? Array.from(
            band.querySelectorAll<HTMLElement>("[aria-current='page']"),
          ).map(
            (item) =>
              item.getAttribute("data-dashboard-navigation-item") ?? "<unnamed>",
          )
        : [];

      return {
        drawerVisible,
        railVisible,
        legacyRailCount: document.querySelectorAll(legacyRailSel).length,
        mobileNavVisible: isVisible(
          document.querySelector<HTMLElement>(mobileNavSel),
        ),
        legacyHorizontalNavCount: document.querySelectorAll(legacyNavSel).length,
        drawerCount: document.querySelectorAll(drawerSel).length,
        railCount: document.querySelectorAll(railSel).length,
        frameCount: document.querySelectorAll(frameSel).length,
        drawerWidth: drawer
          ? Math.round(drawer.getBoundingClientRect().width * 1000) / 1000
          : null,
        railWidth: rail
          ? Math.round(rail.getBoundingClientRect().width * 1000) / 1000
          : null,
        drawerItemHeights: heights(drawer, "dashboard-navigation-drawer-item"),
        railItemHeights: heights(rail, "dashboard-navigation-rail-item"),
        activeItems,
        bandRight: band ? band.getBoundingClientRect().right : null,
        mainLeft: main ? main.getBoundingClientRect().left : null,
        mainTop: main ? main.getBoundingClientRect().top : null,
        bandPosition: band ? window.getComputedStyle(band).position : null,
        htmlScrollTop: html.scrollTop,
        bodyScrollTop: body.scrollTop,
        mainScrollTop: main ? main.scrollTop : 0,
        mainScrollHeight: main ? main.scrollHeight : 0,
        mainClientHeight: main ? main.clientHeight : 0,
        htmlScrollWidth: html.scrollWidth,
        htmlClientWidth: html.clientWidth,
        appBarCount: document.querySelectorAll(appBarSel).length,
        appBarHeight: appBar ? appBar.getBoundingClientRect().height : null,
        appBarWidth: appBar ? appBar.getBoundingClientRect().width : null,
        appBarBottom: appBar ? appBar.getBoundingClientRect().bottom : null,
        appBarShadow: appBar ? window.getComputedStyle(appBar).boxShadow : null,
      };
    },
    {
      drawerSel: DRAWER_SELECTOR,
      railSel: RAIL_SELECTOR,
      frameSel: FRAME_SELECTOR,
      legacyNavSel: LEGACY_HORIZONTAL_NAV_SELECTOR,
      legacyRailSel: LEGACY_MODULE_RAIL_SELECTOR,
      mobileNavSel: MOBILE_NAV_SELECTOR,
      appBarSel: APP_BAR_SELECTOR,
      mainSel: MAIN_SELECTOR,
    },
  );
}

function collectViolations(
  reading: BandReading,
  label: string,
  viewportWidth: number,
): string[] {
  const violations: string[] = [];
  const regime = regimeFor(viewportWidth);

  // ── B08_LEGACY: the horizontal nav is gone at every viewport ───────────────
  if (reading.legacyHorizontalNavCount !== 0) {
    violations.push(
      `${label}: the retired horizontal nav is present (${reading.legacyHorizontalNavCount} node(s))`,
    );
  }

  // ── B08_NAVIGATION_MODEL ──────────────────────────────────────────────────
  if (reading.frameCount !== 1) {
    violations.push(
      `${label}: expected exactly one navigation frame, found ${reading.frameCount}`,
    );
  }
  if (reading.drawerCount !== 1 || reading.railCount !== 1) {
    violations.push(
      `${label}: both primitives must be mounted exactly once (drawer=${reading.drawerCount}, rail=${reading.railCount})`,
    );
  }

  if (regime === "drawer") {
    if (!reading.drawerVisible) violations.push(`${label}: drawer must be visible >=1280px`);
    if (reading.railVisible) violations.push(`${label}: rail must be hidden >=1280px`);
  } else if (regime === "rail") {
    if (!reading.railVisible) violations.push(`${label}: rail must be visible 768-1279px`);
    if (reading.drawerVisible) violations.push(`${label}: drawer must be hidden <1280px`);
  } else {
    if (reading.drawerVisible) violations.push(`${label}: drawer must be hidden <768px`);
    if (reading.railVisible) violations.push(`${label}: rail must be hidden <768px`);
  }

  // Exactly one lateral model at a time, in every regime.
  const lateralVisible = Number(reading.drawerVisible) + Number(reading.railVisible);
  const expectedLateral = regime === "mobile" ? 0 : 1;
  if (lateralVisible !== expectedLateral) {
    violations.push(
      `${label}: expected ${expectedLateral} visible lateral navigation(s), found ${lateralVisible}`,
    );
  }

  // ── LEGACY_MODULE_RAIL: B08 deferred the deletion, B09 closed it ───────────
  if (reading.legacyRailCount !== 0) {
    violations.push(
      `${label}: the retired module rail is present (${reading.legacyRailCount} node(s)). B08 only hid it >=768px because it was the clinic /dashboard navigation on phones; B09 replaced that with DashboardMobileNav and deleted it`,
    );
  }

  // Below 768px exactly one owner paints, and it is the B09 mobile model.
  if (regime === "mobile" && !reading.mobileNavVisible) {
    violations.push(
      `${label}: no mobile navigation owner is visible below 768px`,
    );
  }
  if (regime !== "mobile" && reading.mobileNavVisible) {
    violations.push(
      `${label}: the mobile navigation model must not paint at >=768px; the lateral model owns that regime`,
    );
  }

  // ── B08_GEOMETRY ──────────────────────────────────────────────────────────
  if (regime === "drawer") {
    if (
      reading.drawerWidth === null ||
      Math.abs(reading.drawerWidth - DRAWER_WIDTH_PX) > BAND_TOLERANCE_PX
    ) {
      violations.push(
        `${label}: drawer width ${reading.drawerWidth}px is outside ${DRAWER_WIDTH_PX} ±${BAND_TOLERANCE_PX}`,
      );
    }
    if (reading.drawerItemHeights.length === 0) {
      violations.push(`${label}: the drawer rendered no items`);
    }
    for (const height of reading.drawerItemHeights) {
      if (Math.abs(height - DRAWER_ITEM_HEIGHT_PX) > ITEM_TOLERANCE_PX) {
        violations.push(
          `${label}: drawer item height ${height}px != ${DRAWER_ITEM_HEIGHT_PX}px`,
        );
      }
    }
  }

  if (regime === "rail") {
    if (
      reading.railWidth === null ||
      Math.abs(reading.railWidth - RAIL_WIDTH_PX) > BAND_TOLERANCE_PX
    ) {
      violations.push(
        `${label}: rail width ${reading.railWidth}px is outside ${RAIL_WIDTH_PX} ±${BAND_TOLERANCE_PX}`,
      );
    }
    if (reading.railItemHeights.length === 0) {
      violations.push(`${label}: the rail rendered no items`);
    }
    for (const height of reading.railItemHeights) {
      if (Math.abs(height - RAIL_ITEM_HEIGHT_PX) > ITEM_TOLERANCE_PX) {
        violations.push(
          `${label}: rail item height ${height}px != ${RAIL_ITEM_HEIGHT_PX}px`,
        );
      }
    }
  }

  // ── B08_FRAME: the band takes inline size, never vertical budget ───────────
  if (regime !== "mobile") {
    if (reading.bandPosition === "fixed" || reading.bandPosition === "absolute") {
      violations.push(
        `${label}: the band is ${reading.bandPosition}-positioned; it must participate in the real layout`,
      );
    }
    if (
      reading.bandRight !== null &&
      reading.mainLeft !== null &&
      reading.mainLeft < reading.bandRight - 0.5
    ) {
      violations.push(
        `${label}: the band overlaps main (band right ${reading.bandRight.toFixed(2)} > main left ${reading.mainLeft.toFixed(2)})`,
      );
    }
  }

  if (reading.htmlScrollTop !== 0 || reading.bodyScrollTop !== 0) {
    violations.push(
      `${label}: document scrolled (html=${reading.htmlScrollTop}, body=${reading.bodyScrollTop}), contract is 0`,
    );
  }
  if (reading.mainScrollTop !== 0) {
    violations.push(`${label}: main scrolled ${reading.mainScrollTop}px, contract is 0`);
  }
  if (reading.mainScrollHeight > reading.mainClientHeight + 1) {
    violations.push(
      `${label}: main became an operational scroll container (${reading.mainScrollHeight} > ${reading.mainClientHeight})`,
    );
  }
  if (reading.htmlScrollWidth > reading.htmlClientWidth + 1) {
    violations.push(
      `${label}: horizontal overflow (${reading.htmlScrollWidth} > ${reading.htmlClientWidth}), contract is 0`,
    );
  }

  // ── B08_B06_APP_BAR ───────────────────────────────────────────────────────
  if (reading.appBarCount !== 1) {
    violations.push(`${label}: expected exactly one app bar, found ${reading.appBarCount}`);
  }
  if (reading.appBarWidth === null || Math.abs(reading.appBarWidth - viewportWidth) > 1) {
    violations.push(
      `${label}: app bar width ${reading.appBarWidth}px != viewport width ${viewportWidth}px`,
    );
  }
  if (reading.appBarShadow !== "none") {
    violations.push(`${label}: app bar paints elevation (${reading.appBarShadow})`);
  }
  if (
    reading.appBarBottom !== null &&
    reading.mainTop !== null &&
    reading.appBarBottom > reading.mainTop + 0.5
  ) {
    violations.push(
      `${label}: app bar overlaps main (bar bottom ${reading.appBarBottom.toFixed(2)} > main top ${reading.mainTop.toFixed(2)})`,
    );
  }
  if (regime !== "mobile") {
    if (
      reading.appBarHeight === null ||
      Math.abs(reading.appBarHeight - APP_BAR_TARGET_PX) > APP_BAR_TOLERANCE_PX
    ) {
      violations.push(
        `${label}: app bar height ${reading.appBarHeight}px is outside ${APP_BAR_TARGET_PX} ±${APP_BAR_TOLERANCE_PX}`,
      );
    }
  }

  return violations;
}

async function openSurface(
  page: Page,
  surface: DashboardGeometrySurface,
  route = surface.route,
  // The interaction blocks below navigate a representative surface to OTHER
  // modules, so readiness has to follow the route, not the representative.
  readinessSelector = surface.readinessSelector,
): Promise<void> {
  await page.goto(route);
  await expect(
    page.locator(readinessSelector).first(),
    `${route}: surface ready`,
  ).toBeVisible({ timeout: 25_000 });
  await waitForLayoutSettled(page);
}

/** Workspace readiness selector for any module id. */
function workspaceReady(moduleId: string): string {
  return `[data-dashboard-module-workspace="${moduleId}"]`;
}

async function prepare(
  page: Page,
  surface: DashboardGeometrySurface,
): Promise<void> {
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

  const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role];
  await page
    .context()
    .addCookies([{ name: cookie.name, value: cookie.value, url: APP_ORIGIN }]);
  await installSurfaceMocks(page, surface);
}

/**
 * Same as {@link prepare}, but stubs EVERY canonical surface of the role. The
 * navigation blocks move between modules, and a module whose endpoint the
 * shared fixture answers 404 for would render an error card instead of its
 * workspace.
 */
async function prepareRole(
  page: Page,
  role: "admin" | "clinic",
): Promise<void> {
  await suppressNextDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

  const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE[role];
  await page
    .context()
    .addCookies([{ name: cookie.name, value: cookie.value, url: APP_ORIGIN }]);

  for (const surface of DASHBOARD_GEOMETRY_SURFACES) {
    if (surface.role !== role) continue;
    await installSurfaceMocks(page, surface);
  }
}

/**
 * The PAINTED band. `DashboardNavigationFrame` streams the url-derived
 * navigation through a Suspense boundary whose fallback mounts a SECOND
 * `LateralNavigation` with the same attributes, so a bare band selector can
 * resolve to two nodes while exactly one is visible. Filtering the OWNER does
 * not relax the contract: zero visible bands still fail, and two still fail on
 * strictness.
 */
function paintedBand(page: Page, selector: string) {
  return page.locator(selector).filter({ visible: true });
}

/** The item of the CURRENTLY VISIBLE band, so clicks never hit a hidden twin. */
function bandItem(page: Page, moduleId: string, regime: Regime) {
  const band = regime === "drawer" ? DRAWER_SELECTOR : RAIL_SELECTOR;
  return paintedBand(page, band).locator(
    `[data-dashboard-navigation-item="${moduleId}"]`,
  );
}

async function expectActiveModule(
  page: Page,
  moduleId: string,
  regime: Regime,
  label: string,
): Promise<void> {
  await expect(
    bandItem(page, moduleId, regime),
    `${label}: ${moduleId} is aria-current`,
  ).toHaveAttribute("aria-current", "page", { timeout: 15_000 });

  const band = regime === "drawer" ? DRAWER_SELECTOR : RAIL_SELECTOR;
  await expect(
    paintedBand(page, band).locator("[aria-current='page']"),
    `${label}: exactly one module is current`,
  ).toHaveCount(1, { timeout: 15_000 });
}

test.beforeAll(() => {
  // Fail-closed against the shared inventory: B08 must not silently police a
  // narrower matrix than the one A02/A08/B04/B06 froze.
  expect(DASHBOARD_GEOMETRY_SURFACES.length, "canonical surface cardinality").toBe(
    DASHBOARD_GEOMETRY_SURFACE_COUNT,
  );
  expect(DASHBOARD_GEOMETRY_VIEWPORTS.length, "canonical viewport cardinality").toBe(
    DASHBOARD_GEOMETRY_VIEWPORT_COUNT,
  );

  const canonicalShellTypes = new Set(
    DASHBOARD_GEOMETRY_SURFACES.map((surface) => surface.shellType),
  );
  expect(
    [...canonicalShellTypes].sort(),
    "every canonical shell type has a B08 representative",
  ).toEqual([...SHELL_TYPES].sort());

  expect(REPRESENTATIVES.length, "representatives").toBe(SHELL_TYPES.length);
  expect(VIEWPORT_PROBES.length, "breakpoint probes").toBe(7);
  expect(
    VIEWPORT_PROBES.map((probe) => probe.width),
    "probes cover both sides of both breakpoints",
  ).toEqual([360, 768, 1024, 1279, 1280, 1366, 1920]);
});

// ── A/B/F/G · The band across the regime ladder ──────────────────────────────

test.describe("B08 · lateral navigation band across the regime ladder", () => {
  for (const surface of REPRESENTATIVES) {
    test(`${surface.id} resolves exactly one navigation model per regime`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(240_000);
      await prepare(page, surface);

      const measured: Array<Record<string, unknown>> = [];
      const failures: string[] = [];

      for (const viewport of VIEWPORT_PROBES) {
        const label = `${surface.id} @ ${viewport.slug}`;

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await openSurface(page, surface);

        if (viewport === VIEWPORT_PROBES[0]) {
          await expect(
            page.locator("html"),
            `${label}: the ladder runs the default theme`,
          ).toHaveAttribute("data-theme", NORMAL_THEME_MODE, { timeout: 10_000 });
        }

        const reading = await readBand(page);
        failures.push(
          ...collectViolations(reading, label, viewport.width),
        );

        measured.push({
          surfaceId: surface.id,
          viewportSlug: viewport.slug,
          regime: regimeFor(viewport.width),
          drawerVisible: reading.drawerVisible,
          railVisible: reading.railVisible,
          legacyRailCount: reading.legacyRailCount,
          mobileNavVisible: reading.mobileNavVisible,
          drawerWidth: reading.drawerWidth,
          railWidth: reading.railWidth,
          appBarHeight: reading.appBarHeight,
        });
      }

      expect(measured.length, `${surface.id}: measured probes`).toBe(
        VIEWPORT_PROBES.length,
      );

      await testInfo.attach(`b08-band-${surface.id}.json`, {
        contentType: "application/json",
        body: Buffer.from(`${JSON.stringify(measured, null, 2)}\n`, "utf8"),
      });

      expect(failures.join("\n"), `${surface.id}: B08 band violations`).toBe("");
    });
  }
});

// ── C · Admin: deep links, click, reload, Back/Forward, hub null state ───────

test.describe("B08 · admin module navigation", () => {
  const adminSurface = REPRESENTATIVES.find(
    (surface) => surface.shellType === "admin-module",
  )!;
  const adminHub = REPRESENTATIVES.find(
    (surface) => surface.shellType === "admin-hub",
  )!;

  for (const { regime, width, height } of [
    { regime: "drawer" as const, width: 1366, height: 768 },
    { regime: "rail" as const, width: 1024, height: 768 },
  ]) {
    test(`admin deep links, history and aria-current in the ${regime} regime`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await prepareRole(page, "admin");
      await page.setViewportSize({ width, height });

      // Deep link straight into a module: no click, no client transition.
      await openSurface(
        page,
        adminSurface,
        "/dashboard/admin?module=admin-sessions",
        workspaceReady("admin-sessions"),
      );
      await expectActiveModule(page, "admin-sessions", regime, `${regime}: deep link`);

      // Reload keeps it.
      await page.reload();
      await expect(
        page.locator('[data-dashboard-module-workspace="admin-sessions"]'),
        `${regime}: workspace after reload`,
      ).toBeVisible({ timeout: 25_000 });
      await expectActiveModule(page, "admin-sessions", regime, `${regime}: reload`);

      // Click another module: the URL must carry the canonical `?module=`.
      await bandItem(page, "audit-log", regime).click();
      await expect(page, `${regime}: click updates the URL`).toHaveURL(
        /\/dashboard\/admin\?module=audit-log$/,
        { timeout: 20_000 },
      );
      await expectActiveModule(page, "audit-log", regime, `${regime}: after click`);

      // Back returns to the previous module, Forward returns to the next.
      await page.goBack();
      await expect(page, `${regime}: Back restores the previous URL`).toHaveURL(
        /\/dashboard\/admin\?module=admin-sessions$/,
        { timeout: 20_000 },
      );
      await expectActiveModule(page, "admin-sessions", regime, `${regime}: Back`);

      await page.goForward();
      await expect(page, `${regime}: Forward restores the next URL`).toHaveURL(
        /\/dashboard\/admin\?module=audit-log$/,
        { timeout: 20_000 },
      );
      await expectActiveModule(page, "audit-log", regime, `${regime}: Forward`);

      // The legacy navigation must not have come back at any point.
      await expect(
        page.locator(LEGACY_HORIZONTAL_NAV_SELECTOR),
        `${regime}: retired horizontal nav absent`,
      ).toHaveCount(0);
      await expect(
        page.locator(LEGACY_MODULE_RAIL_SELECTOR),
        `${regime}: retired module rail absent`,
      ).toHaveCount(0);
    });
  }

  test("the explicit admin hub marks Inicio current and keeps every module reachable", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await prepareRole(page, "admin");
    await page.setViewportSize({ width: 1366, height: 768 });
    await openSurface(page, adminHub, "/dashboard/admin?hub=1");

    await expect(
      page.locator(`${DRAWER_SELECTOR} [aria-current='page']`),
      "hub: Inicio is the only current destination",
    ).toHaveCount(1);
    await expect(
      page.locator(`${DRAWER_SELECTOR} [data-dashboard-navigation-item='home']`),
    ).toHaveAttribute("aria-current", "page");

    // Every module stays reachable from the hub, alongside Inicio.
    await expect(
      paintedBand(page, DRAWER_SELECTOR).locator(
        "[data-dashboard-navigation-item]",
      ),
      "hub: the full admin module list stays reachable",
    ).toHaveCount(11);
    await expect(
      page.locator('[data-dashboard-hub-root="true"]'),
      "hub: DashboardModuleHub still renders",
    ).toBeVisible();

    // Entering a module from the hub gives it — and only it — aria-current.
    await bandItem(page, "admin-clinics", "drawer").click();
    await expect(page).toHaveURL(/\/dashboard\/admin\?module=admin-clinics$/, {
      timeout: 20_000,
    });
    await expectActiveModule(page, "admin-clinics", "drawer", "hub -> module");
  });
});

// ── D · Clinic: module shell and the full routes ────────────────────────────

test.describe("B08 · clinic module navigation", () => {
  test("clinic module shell keeps ?module=, history and the canonical route", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await prepareRole(page, "clinic");
    await page.setViewportSize({ width: 1366, height: 768 });

    await openSurface(
      page,
      CLINIC_MODULE_SURFACE,
      "/dashboard?module=informes",
      workspaceReady("informes"),
    );
    await expectActiveModule(page, "informes", "drawer", "clinic: deep link");

    await bandItem(page, "logistica", "drawer").click();
    await expect(page, "clinic: click uses the canonical route").toHaveURL(
      /\/dashboard\?module=logistica$/,
      { timeout: 20_000 },
    );
    // URL and stage converge: the controller swapped the workspace too.
    await expect(
      page.locator('[data-dashboard-module-workspace="logistica"]'),
      "clinic: stage follows the URL",
    ).toBeVisible({ timeout: 25_000 });
    await expectActiveModule(page, "logistica", "drawer", "clinic: after click");

    await page.goBack();
    await expect(page, "clinic: Back").toHaveURL(/\/dashboard\?module=informes$/, {
      timeout: 20_000,
    });
    await expectActiveModule(page, "informes", "drawer", "clinic: Back");

    await page.goForward();
    await expect(page, "clinic: Forward").toHaveURL(/\/dashboard\?module=logistica$/, {
      timeout: 20_000,
    });
    await expectActiveModule(page, "logistica", "drawer", "clinic: Forward");
  });

  // The clinic full routes B10 still owns. Each presents its own module as
  // active WITHOUT `?module=`, and navigating away from one re-enters the
  // canonical `/dashboard?module=` grammar.
  for (const { route, moduleId } of [
    { route: "/dashboard/informes", moduleId: "informes" },
    { route: "/dashboard/logistica", moduleId: "logistica" },
    { route: "/dashboard/logistica/metricas", moduleId: "logistica" },
    { route: "/dashboard/logistica/rutas", moduleId: "logistica" },
    { route: "/dashboard/logistica/visitas", moduleId: "logistica" },
  ]) {
    test(`${route} presents ${moduleId} as the active module`, async ({ page }) => {
      test.setTimeout(180_000);
      const fullRoute = REPRESENTATIVES.find(
        (surface) => surface.shellType === "clinic-full-route",
      )!;
      await prepareRole(page, "clinic");
      await page.setViewportSize({ width: 1366, height: 768 });

      await page.goto(route);
      await expect(page.locator(MAIN_SELECTOR), `${route}: main`).toBeVisible({
        timeout: 25_000,
      });
      await waitForLayoutSettled(page);

      await expectActiveModule(page, moduleId, "drawer", route);
      await expect(
        page.locator(LEGACY_HORIZONTAL_NAV_SELECTOR),
        `${route}: retired horizontal nav absent`,
      ).toHaveCount(0);
    });
  }

  test("navigating away from a full route re-enters the canonical ?module= grammar", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const fullRoute = REPRESENTATIVES.find(
      (surface) => surface.shellType === "clinic-full-route",
    )!;
    await prepareRole(page, "clinic");
    await page.setViewportSize({ width: 1366, height: 768 });

    await page.goto("/dashboard/logistica");
    await expect(page.locator(MAIN_SELECTOR)).toBeVisible({ timeout: 25_000 });
    await waitForLayoutSettled(page);
    await expectActiveModule(page, "logistica", "drawer", "full route");

    await bandItem(page, "tokens", "drawer").click();
    await expect(page, "full route -> canonical module route").toHaveURL(
      /\/dashboard\?module=tokens$/,
      { timeout: 20_000 },
    );
    await expect(
      page.locator('[data-dashboard-module-workspace="tokens"]'),
      "full route -> module workspace",
    ).toBeVisible({ timeout: 25_000 });
    await expectActiveModule(page, "tokens", "drawer", "full route -> tokens");
  });
});

// ── E · Dark-gray theme sample ──────────────────────────────────────────────

test.describe("B08 · lateral navigation in dark-gray", () => {
  const theme: ThemeMode = DARK_GRAY_THEME_MODE;

  test(`the band keeps its geometry and regime in ${theme}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const failures: string[] = [];

    // Geometry is theme-invariant, so this is a sample, not a second matrix:
    // one surface per role at the two probes that straddle the rail/drawer
    // split. The ladder above already runs every representative in `normal`.
    for (const role of ["admin", "clinic"] as const) {
      const surface = REPRESENTATIVES.find((item) => item.role === role)!;
      const context = await browser.newContext({ reducedMotion: "reduce" });

      try {
        const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE[role];
        await context.addCookies([
          { name: cookie.name, value: cookie.value, url: APP_ORIGIN },
        ]);

        const page = await context.newPage();
        await suppressNextDevChrome(page);
        await clearDashboardModuleMemory(page);
        await installTheme(page, theme);
        await installSurfaceMocks(page, surface);

        for (const slug of THEME_PROBE_SLUGS) {
          const viewport = VIEWPORT_PROBES.find((probe) => probe.slug === slug)!;
          const label = `${surface.id} @ ${slug} [${theme}]`;

          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await openSurface(page, surface);

          await expect(
            page.locator("html"),
            `${label}: theme applied`,
          ).toHaveAttribute("data-theme", theme, { timeout: 10_000 });

          const reading = await readBand(page);
          failures.push(
            ...collectViolations(reading, label, viewport.width),
          );
        }
      } finally {
        await context.close();
      }
    }

    expect(failures.join("\n"), `dark-gray band violations`).toBe("");
  });
});

// ── H · Short heights: every rail destination stays reachable ───────────────

const ADMIN_HUB_SURFACE = REPRESENTATIVES.find(
  (surface) => surface.shellType === "admin-hub",
)!;

/**
 * The rail is the only band whose intrinsic block size can exceed the frame.
 * Admin carries eleven 56px items, so it asks for 672px (11 items + 10 gaps + the
 * block padding) while the drawer's 40px items never come close. The probe
 * ladder above only samples tall viewports, so it cannot see this: 1024x600 is
 * a 1280x750 laptop at 125% zoom, lands inside the rail regime, and leaves the
 * frame ~544px — less than the band asks for.
 *
 * `.dashboard-navigation-frame` is `overflow: hidden`, so an unadapted band is
 * not merely tight: its last destinations are CLIPPED with no affordance, and
 * focusing one scrolls the frame, which drags `main` out of place because the
 * frame is the row that holds both. AGENTS.md §10 forbids exactly that pair —
 * clipping content and hiding critical actions — and names adaptive density,
 * not `overflow-y: auto`, as the sanctioned answer.
 */
const SHORT_RAIL_VIEWPORT = { width: 1024, height: 600 } as const;
const ADMIN_RAIL_ITEM_COUNT = 11;

test.describe("B08 · rail destinations at short heights", () => {
  test("every admin destination stays visible and focusable without scrolling the frame", async ({
    page,
  }) => {
    await prepareRole(page, "admin");
    await page.setViewportSize(SHORT_RAIL_VIEWPORT);
    await openSurface(page, ADMIN_HUB_SURFACE);

    await expect(
      paintedBand(page, RAIL_SELECTOR),
      "short height stays inside the rail regime",
    ).toBeVisible();
    await expect(
      page.locator(DRAWER_SELECTOR),
      "the drawer must not paint below 1280px",
    ).toBeHidden();

    const items = paintedBand(page, RAIL_SELECTOR).locator(
      "[data-dashboard-navigation-item]",
    );
    await expect(items, "every admin destination is mounted").toHaveCount(
      ADMIN_RAIL_ITEM_COUNT,
    );

    const geometry = await page.evaluate(
      ({ railSelector, frameSelector }) => {
        const rail = document.querySelector(railSelector) as HTMLElement;
        const frame = document.querySelector(frameSelector) as HTMLElement;
        const railBox = rail.getBoundingClientRect();
        const cells = Array.from(
          rail.querySelectorAll<HTMLElement>("[data-dashboard-navigation-item]"),
        );
        const last = cells[cells.length - 1]!;
        const lastBox = last.getBoundingClientRect();

        return {
          railTop: railBox.top,
          railBottom: railBox.bottom,
          railClientHeight: rail.clientHeight,
          railScrollHeight: rail.scrollHeight,
          frameScrollTop: frame.scrollTop,
          lastLabel: last.getAttribute("aria-label"),
          lastTop: lastBox.top,
          lastBottom: lastBox.bottom,
          viewportHeight: window.innerHeight,
        };
      },
      { railSelector: RAIL_SELECTOR, frameSelector: FRAME_SELECTOR },
    );

    const where = `rail ${geometry.railClientHeight}px (content ${geometry.railScrollHeight}px), last "${geometry.lastLabel}" at ${geometry.lastTop.toFixed(1)}–${geometry.lastBottom.toFixed(1)}, rail ends ${geometry.railBottom.toFixed(1)}`;

    // The band must fit its own box: an intrinsic height above the client box
    // is content the frame is already clipping.
    expect(
      geometry.railScrollHeight,
      `the rail overflows its own box — ${where}`,
    ).toBeLessThanOrEqual(geometry.railClientHeight + BAND_TOLERANCE_PX);

    // …and the last destination has to be inside it, not merely laid out.
    expect(
      geometry.lastBottom,
      `the last destination is clipped — ${where}`,
    ).toBeLessThanOrEqual(geometry.railBottom + BAND_TOLERANCE_PX);
    expect(
      geometry.lastBottom,
      `the last destination falls outside the viewport — ${where}`,
    ).toBeLessThanOrEqual(geometry.viewportHeight + BAND_TOLERANCE_PX);

    // Keyboard reach: focusing the last destination must not scroll the frame,
    // because the frame is the row that carries `main` too.
    const lastItem = items.nth(ADMIN_RAIL_ITEM_COUNT - 1);
    await lastItem.focus();

    const afterFocus = await page.evaluate(
      ({ frameSelector }) => {
        const frame = document.querySelector(frameSelector) as HTMLElement;
        const focused = document.activeElement as HTMLElement | null;
        const box = focused?.getBoundingClientRect() ?? null;
        return {
          frameScrollTop: frame.scrollTop,
          focusedModule: focused?.getAttribute("data-dashboard-navigation-item") ?? null,
          focusedBottom: box ? box.bottom : null,
          viewportHeight: window.innerHeight,
        };
      },
      { frameSelector: FRAME_SELECTOR },
    );

    expect(
      afterFocus.focusedModule,
      "the last destination takes keyboard focus",
    ).not.toBeNull();
    expect(
      afterFocus.frameScrollTop,
      "focusing a destination scrolled the navigation frame and displaced main",
    ).toBeLessThanOrEqual(BAND_TOLERANCE_PX);
    expect(
      afterFocus.focusedBottom,
      "the focused destination sits outside the viewport",
    ).toBeLessThanOrEqual(afterFocus.viewportHeight + BAND_TOLERANCE_PX);

    // The compaction is the contract here, not an accident: the band trades the
    // rail item height for the drawer's. That is why this block asserts the four
    // frame invariants directly instead of reusing `collectViolations` - that
    // helper polices the FULL-density ladder, where the rail item is 56px, and
    // it is right to keep doing so for the seven tall probes.
    const reading = await readBand(page);

    expect(
      reading.railItemHeights.length,
      "every destination is still measured",
    ).toBe(ADMIN_RAIL_ITEM_COUNT);
    for (const height of reading.railItemHeights) {
      expect(
        Math.abs(height - DRAWER_ITEM_HEIGHT_PX),
        `compact rail item height ${height}px != ${DRAWER_ITEM_HEIGHT_PX}px`,
      ).toBeLessThanOrEqual(ITEM_TOLERANCE_PX);
    }

    // The band keeps costing inline size only, and its width band is untouched.
    expect(
      Math.abs((reading.railWidth ?? 0) - RAIL_WIDTH_PX),
      `compact rail width ${reading.railWidth}px != ${RAIL_WIDTH_PX}px`,
    ).toBeLessThanOrEqual(BAND_TOLERANCE_PX);
    expect(reading.htmlScrollTop, "document scrolled (html)").toBe(0);
    expect(reading.bodyScrollTop, "document scrolled (body)").toBe(0);
    expect(
      reading.htmlScrollWidth,
      "horizontal overflow appeared",
    ).toBeLessThanOrEqual(reading.htmlClientWidth + 1);
    expect(
      reading.mainScrollHeight,
      "main became an operational scroll container",
    ).toBeLessThanOrEqual(reading.mainClientHeight + 1);
    expect(
      reading.appBarBottom ?? 0,
      "app bar overlaps main",
    ).toBeLessThanOrEqual((reading.mainTop ?? 0) + 0.5);
  });
});
