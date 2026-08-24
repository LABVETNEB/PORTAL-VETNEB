import { expect, test, type Page } from "@playwright/test";
import { suppressNextDevIndicator } from "../helpers/admin-mobile-contracts";

// ─────────────────────────────────────────────────────────────────────────────
// B09 · Mobile navigation unification — runtime contract.
//
// WHAT B09 CHANGED. Below 768px the dashboard had FOUR navigation components
// for one function:
//
//   AdminMobileBottomNav   +  AdminMobileModuleMenu   (admin)
//   ClinicMobileBottomNav                             (clinic, EXCEPT /dashboard)
//   DashboardModuleRail                               (clinic /dashboard only)
//
// The clinic bottom nav returned null on `/dashboard`, which is why B08 could
// not delete the rail: that surface would have been left with no way to change
// module on a phone. B09 ships one owner, `DashboardMobileNav`, mounted once at
// shell level for both roles, removes the early return and retires all four.
//
// WHAT THIS SPEC MEASURES, and why each item is here:
//
//   ONE OWNER PER REGIME     the whole point of the block. Below 768px exactly
//                            one navigation model must be visible; from 768px
//                            up it must be the lateral band and NOT this one.
//                            The retired rail must not exist at any viewport.
//   PRIMARY DESTINATIONS     admin ships Inicio + a curated cut + "Más"; clinic
//                            ships Inicio + its five modules
//                            (B09_CLINIC_HOME_ITEM = PRESERVE). A regression
//                            here is a lost destination, not a cosmetic diff.
//   OVERFLOW REACHABILITY    every admin module outside the bar must still be
//                            reachable. The retired menu paginated the WHOLE
//                            catalog, so the overflow does too.
//   DEEP LINK / BACK / FWD   `?module=` is the shipped grammar; the bar builds
//                            its hrefs from it and must survive history.
//   UNKNOWN `?module=`       the retired admin bar read the query RAW, so an
//                            unknown value lit `aria-current` on "Más" while
//                            the controller painted the hub. Parsing first is
//                            what makes both converge on Inicio.
//   TOUCH TARGETS >= 44x44   B09_TOUCH_POLICY = OPTION_A, measured on the
//                            surfaces B09 owns (bar, overflow, kebab), never
//                            inferred from a class name.
//   SAFE AREA                the inset is added to the band and subtracted as
//                            padding, so the touch row keeps its full height.
//   ZERO SCROLL / OVERFLOW   the bar is a flow sibling of `main`, so the shell
//                            must SUBTRACT its height. A fixed bar would leave
//                            `main` at full height and cover its last row —
//                            exactly what the rail never risked, because it
//                            lived inside `main`.
//
// BOUNDARY WITH A08 AND B06. A08 owns zero-scroll over the full 21x13 matrix
// and B06 owns the app-bar band over the same matrix. What is re-asserted here
// is narrower: the four invariants a bottom band can break on the surfaces it
// actually mounts on.
// ─────────────────────────────────────────────────────────────────────────────

const APP_ORIGIN = "http://127.0.0.1:3000";

const NAV = "[data-dashboard-mobile-nav]";
const NAV_ADMIN = '[data-dashboard-mobile-nav="admin"]';
const NAV_CLINIC = '[data-dashboard-mobile-nav="clinic"]';
const NAV_ITEM = "[data-dashboard-mobile-nav-item]";
const OVERFLOW = '[data-dashboard-mobile-nav-overflow="true"]';
const OVERFLOW_LINK = "[data-dashboard-mobile-nav-overflow-link]";
const LEGACY_RAIL = "[data-dashboard-module-rail]";
const LATERAL = "[data-dashboard-navigation-drawer], [data-dashboard-navigation-rail]";
const MAIN = "main.dashboard-main";
const KEBAB_TRIGGER = ".admin-mobile-kebab-trigger";

/**
 * The PAINTED bar. `DashboardMobileNav` streams through a Suspense boundary
 * whose fallback mounts a SECOND `DashboardMobileNavBar` carrying the same
 * attributes, so a bare selector can resolve to two nodes while exactly one is
 * visible. Filtering the OWNER does not relax anything: zero visible bars still
 * fail, two visible bars still fail on strictness, and every slot / aria-current
 * count below keeps measuring the bar the user actually sees.
 */
function paintedNav(page: Page, selector: string = NAV) {
  return page.locator(selector).filter({ visible: true });
}

/** B09_TOUCH_POLICY = OPTION_A. */
const TOUCH_MIN_PX = 44;
const TOLERANCE_PX = 2;

/** The catalog's admin order, mirrored. Never re-derived from the DOM. */
const ADMIN_MODULE_LABELS = [
  "Resumen",
  "Informes",
  "Estado",
  "Clínicas",
  "Tokens",
  "Precios",
  "Sesiones",
  "Usuarios",
  "Auditoría",
  "Mantenimiento",
] as const;

/** The curated primary cut: `ADMIN_MOBILE_PRIMARY_MODULE_IDS`. */
const ADMIN_PRIMARY_ITEMS = [
  "home",
  "admin-clinics",
  "audit-log",
  "admin-sessions",
  "overflow",
] as const;

/** B09_CLINIC_HOME_ITEM = PRESERVE: Inicio plus the five clinic modules. */
const CLINIC_PRIMARY_ITEMS = [
  "home",
  "operaciones",
  "informes",
  "logistica",
  "perfil",
  "tokens",
] as const;

const PHONE_VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
] as const;

/** The 768px boundary: the mobile model stops, the lateral band takes over. */
const BOUNDARY_VIEWPORT = { name: "768x1024", width: 768, height: 1024 } as const;

type Role = "admin" | "clinic";

async function prepareRole(page: Page, role: Role) {
  await page.context().addCookies([
    {
      name: role === "admin" ? "admin_session_id" : "app_session_id",
      value:
        role === "admin"
          ? "e2e_populated_admin_session"
          : "e2e_populated_clinic_session",
      url: APP_ORIGIN,
    },
  ]);
}

async function gotoSurface(page: Page, role: Role, path: string) {
  await prepareRole(page, role);
  await page.goto(path);
  await expect(page.locator(MAIN)).toBeVisible({ timeout: 25_000 });
  // `next dev` paints its overlay portal over the bottom-left corner, which is
  // exactly where the first bar destination sits on a phone. It does not exist
  // under the production runner CI uses, so suppressing it removes a local-only
  // interception without weakening anything the contract measures.
  await suppressNextDevIndicator(page);
}

type BandReading = {
  readonly navCount: number;
  readonly navVisible: boolean;
  readonly navTop: number | null;
  readonly navBottom: number | null;
  readonly navPosition: string | null;
  readonly navPaddingBottom: string | null;
  readonly navHeightDeclaration: string | null;
  readonly lateralVisible: number;
  readonly legacyRailCount: number;
  readonly mainBottom: number | null;
  readonly documentScrollY: number;
  readonly bodyScrollY: number;
  readonly documentScrollX: number;
  readonly currentCount: number;
  readonly undersized: { label: string; width: number; height: number }[];
};

async function readBand(page: Page): Promise<BandReading> {
  return page.evaluate(
    ({ navSel, lateralSel, legacyRailSel, mainSel, kebabSel, overflowSel, touchMin }) => {
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

      const nav = document.querySelector<HTMLElement>(navSel);
      const navRect = nav?.getBoundingClientRect() ?? null;
      const navStyle = nav ? window.getComputedStyle(nav) : null;
      const main = document.querySelector<HTMLElement>(mainSel);
      const html = document.documentElement;
      const body = document.body;

      // Every control B09 owns, measured — never inferred from a class name.
      const owned = Array.from(
        document.querySelectorAll<HTMLElement>(
          `${navSel} a, ${navSel} button, ${overflowSel} a, ${overflowSel} button, ${kebabSel}`,
        ),
      ).filter(isVisible);

      return {
        navCount: document.querySelectorAll(navSel).length,
        navVisible: isVisible(nav),
        navTop: navRect ? navRect.top : null,
        navBottom: navRect ? navRect.bottom : null,
        navPosition: navStyle ? navStyle.position : null,
        navPaddingBottom: navStyle ? navStyle.paddingBottom : null,
        navHeightDeclaration: navStyle ? navStyle.height : null,
        lateralVisible: Array.from(
          document.querySelectorAll<HTMLElement>(lateralSel),
        ).filter(isVisible).length,
        legacyRailCount: document.querySelectorAll(legacyRailSel).length,
        mainBottom: main ? main.getBoundingClientRect().bottom : null,
        documentScrollY: html.scrollHeight - html.clientHeight,
        bodyScrollY: body.scrollHeight - body.clientHeight,
        documentScrollX: html.scrollWidth - html.clientWidth,
        currentCount: nav
          ? nav.querySelectorAll("[aria-current='page']").length
          : 0,
        undersized: owned
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < touchMin || rect.height < touchMin;
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              label:
                element.getAttribute("aria-label") ||
                element.getAttribute("data-dashboard-mobile-nav-item") ||
                element.tagName.toLowerCase(),
              width: Math.round(rect.width * 100) / 100,
              height: Math.round(rect.height * 100) / 100,
            };
          }),
      };
    },
    {
      navSel: NAV,
      lateralSel: LATERAL,
      legacyRailSel: LEGACY_RAIL,
      mainSel: MAIN,
      kebabSel: KEBAB_TRIGGER,
      overflowSel: OVERFLOW,
      touchMin: TOUCH_MIN_PX,
    },
  );
}

function assertMobileRegime(reading: BandReading, label: string) {
  expect(reading.navCount, `${label}: exactly one mobile navigation owner`).toBe(1);
  expect(reading.navVisible, `${label}: mobile navigation visible`).toBe(true);
  expect(
    reading.lateralVisible,
    `${label}: no lateral band may paint below 768px`,
  ).toBe(0);
  expect(
    reading.legacyRailCount,
    `${label}: the retired module rail must not exist`,
  ).toBe(0);

  // Flow sibling, not an overlay: `main` must END where the bar BEGINS. A
  // fixed bar would leave `main` at full height and cover its last row.
  expect(reading.navPosition, `${label}: the bar is in flow`).not.toBe("fixed");
  expect(reading.navPosition, `${label}: the bar is in flow`).not.toBe("absolute");
  expect(reading.mainBottom, `${label}: main rect resolved`).not.toBeNull();
  expect(reading.navTop, `${label}: nav rect resolved`).not.toBeNull();
  expect(
    reading.mainBottom!,
    `${label}: main must end at or above the bar (${reading.mainBottom} vs ${reading.navTop})`,
  ).toBeLessThanOrEqual(reading.navTop! + TOLERANCE_PX);

  // Safe area: the inset is subtracted again as bottom padding, so the touch
  // row keeps its full height. The emulator reports 0px, which is the correct
  // reading for a device with no inset — what matters is that the declaration
  // exists and resolves.
  expect(
    reading.navPaddingBottom,
    `${label}: the bar reserves the safe-area inset as bottom padding`,
  ).not.toBeNull();

  expect(
    reading.documentScrollY,
    `${label}: document must not scroll`,
  ).toBeLessThanOrEqual(TOLERANCE_PX);
  expect(reading.bodyScrollY, `${label}: body must not scroll`).toBeLessThanOrEqual(
    TOLERANCE_PX,
  );
  expect(
    reading.documentScrollX,
    `${label}: no horizontal overflow`,
  ).toBeLessThanOrEqual(TOLERANCE_PX);

  expect(
    reading.undersized,
    `${label}: every control B09 owns must be >= ${TOUCH_MIN_PX}x${TOUCH_MIN_PX}`,
  ).toEqual([]);
}

async function expectPrimaryItems(
  page: Page,
  navSelector: string,
  expected: readonly string[],
  label: string,
) {
  const nav = paintedNav(page, navSelector);
  await expect(nav, `${label}: navigation visible`).toBeVisible();
  await expect(
    nav.locator(NAV_ITEM),
    `${label}: primary slot count`,
  ).toHaveCount(expected.length);

  for (const item of expected) {
    await expect(
      nav.locator(`[data-dashboard-mobile-nav-item="${item}"]`),
      `${label}: primary destination ${item}`,
    ).toHaveCount(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// One owner per regime
// ─────────────────────────────────────────────────────────────────────────────

test.describe("B09 · one mobile navigation owner per regime", () => {
  const SURFACES: { role: Role; path: string; label: string }[] = [
    { role: "admin", path: "/dashboard/admin?module=admin-clinics", label: "admin module" },
    { role: "admin", path: "/dashboard/admin", label: "admin hub" },
    // `/dashboard` is THE surface B08 could not touch: the clinic bottom nav
    // returned null here and the rail was the only navigation.
    { role: "clinic", path: "/dashboard?module=operaciones", label: "clinic module shell" },
    // A clinic FULL route: same owner, same shell mount, no B10 conversion.
    { role: "clinic", path: "/dashboard/informes", label: "clinic full route" },
  ];

  for (const viewport of PHONE_VIEWPORTS) {
    for (const surface of SURFACES) {
      test(`${surface.label} resolves one owner at ${viewport.name}`, async ({
        page,
      }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await gotoSurface(page, surface.role, surface.path);

        await expect(async () => {
          assertMobileRegime(
            await readBand(page),
            `${viewport.name} ${surface.label}`,
          );
        }).toPass({ timeout: 20_000 });
      });
    }
  }

  test(`the mobile model stops at the ${BOUNDARY_VIEWPORT.name} boundary`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({
      width: BOUNDARY_VIEWPORT.width,
      height: BOUNDARY_VIEWPORT.height,
    });
    await gotoSurface(page, "clinic", "/dashboard?module=operaciones");

    await expect(async () => {
      const reading = await readBand(page);
      expect(
        reading.navVisible,
        "768px: the mobile model must not paint; the lateral band owns this regime",
      ).toBe(false);
      expect(reading.lateralVisible, "768px: exactly one lateral band").toBe(1);
      expect(reading.legacyRailCount, "768px: retired rail absent").toBe(0);
      expect(
        reading.documentScrollX,
        "768px: no horizontal overflow",
      ).toBeLessThanOrEqual(TOLERANCE_PX);
    }).toPass({ timeout: 20_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Destinations
// ─────────────────────────────────────────────────────────────────────────────

test.describe("B09 · admin destinations", () => {
  test("the bar ships the curated primary cut and reaches every module through the overflow", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 360, height: 740 });
    await gotoSurface(page, "admin", "/dashboard/admin?module=admin-clinics");

    await expectPrimaryItems(page, NAV_ADMIN, ADMIN_PRIMARY_ITEMS, "admin 360x740");

    // Every module stays reachable. The retired menu paginated the WHOLE
    // catalog rather than "the rest", and the overflow keeps that: a user who
    // opens it sees the same list wherever they are.
    await paintedNav(page)
      .locator('[data-dashboard-mobile-nav-item="overflow"]')
      .click();
    const overflow = page.locator(OVERFLOW);
    await expect(overflow).toBeVisible();

    const seen: string[] = [];
    for (let guard = 0; guard < ADMIN_MODULE_LABELS.length; guard += 1) {
      seen.push(
        ...(await overflow.locator(OVERFLOW_LINK).allTextContents()).map((text) =>
          text.trim(),
        ),
      );
      const next = overflow.getByRole("button", {
        name: "Página siguiente de módulos",
        exact: true,
      });
      if (await next.isDisabled()) break;
      await next.click();
    }

    expect(new Set(seen), "the overflow reaches the whole admin catalog").toEqual(
      new Set(ADMIN_MODULE_LABELS),
    );

    // Escape closes it, and the trigger reports its state.
    await page.keyboard.press("Escape");
    await expect(overflow).toHaveCount(0);
    await expect(
      paintedNav(page).locator('[data-dashboard-mobile-nav-item="overflow"]'),
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("an overflow module opens and marks the overflow entry current", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSurface(page, "admin", "/dashboard/admin?module=admin-clinics");

    await paintedNav(page)
      .locator('[data-dashboard-mobile-nav-item="overflow"]')
      .click();
    await page
      .locator('[data-dashboard-mobile-nav-overflow-link="admin-health"]')
      .click();

    await expect(page).toHaveURL(/\/dashboard\/admin\?module=admin-health$/, {
      timeout: 15_000,
    });
    await expect(
      page.locator('[data-dashboard-module-workspace="admin-health"]'),
    ).toBeVisible({ timeout: 20_000 });

    // A module that is NOT on the bar reports through "Más" — and only then.
    await expect(
      paintedNav(page).locator('[data-dashboard-mobile-nav-item="overflow"]'),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      paintedNav(page, NAV_ADMIN).locator("[aria-current='page']"),
    ).toHaveCount(1);
  });

  test("an unknown ?module= resolves to the hub, not to the overflow", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });

    // The retired bar read `?module=` RAW: an unknown value produced a non-null
    // active module that matched no primary destination, so "Más" claimed
    // `aria-current` while the controller painted the hub. Parsing through the
    // catalog makes both land on the hub.
    await gotoSurface(page, "admin", "/dashboard/admin?module=not-a-real-module");

    const nav = paintedNav(page, NAV_ADMIN);
    await expect(nav).toBeVisible();
    await expect(
      nav.locator('[data-dashboard-mobile-nav-item="home"]'),
      "Inicio is current for an unknown module",
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.locator('[data-dashboard-mobile-nav-item="overflow"]'),
      "the overflow must not claim an unknown module",
    ).not.toHaveAttribute("aria-current", "page");
    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
  });

  test("the admin alias table lights the real destination", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });

    // `?module=maintenance` is a catalog ALIAS for `admin-maintenance`. The
    // retired bar never resolved it, so the bar and the workspace disagreed.
    await gotoSurface(page, "admin", "/dashboard/admin?module=maintenance");

    await expect(
      page.locator('[data-dashboard-module-workspace="admin-maintenance"]'),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      paintedNav(page).locator('[data-dashboard-mobile-nav-item="overflow"]'),
      "an aliased module lives off the bar, so the overflow reports it",
    ).toHaveAttribute("aria-current", "page");
  });
});

test.describe("B09 · clinic destinations", () => {
  test("the bar preserves Inicio plus the five modules and needs no overflow", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 360, height: 740 });
    await gotoSurface(page, "clinic", "/dashboard?module=operaciones");

    // B09_CLINIC_HOME_ITEM = PRESERVE.
    await expectPrimaryItems(
      page,
      NAV_CLINIC,
      CLINIC_PRIMARY_ITEMS,
      "clinic 360x740",
    );
    await expect(
      page.locator('[data-dashboard-mobile-nav-item="overflow"]'),
      "five modules and six slots: clinic never grows an overflow",
    ).toHaveCount(0);
  });

  test("every clinic module is reachable from /dashboard on a phone", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSurface(page, "clinic", "/dashboard?module=operaciones");

    // This is the regression B08 explicitly refused to risk: before B09 the
    // clinic bottom nav returned null here and only the rail could change
    // module. The owner that replaced it has to do the same job.
    for (const moduleId of ["informes", "logistica", "perfil", "tokens"]) {
      await paintedNav(page, NAV_CLINIC)
        .locator(`[data-dashboard-mobile-nav-item="${moduleId}"]`)
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/dashboard\\?module=${moduleId}$`),
        { timeout: 15_000 },
      );
      await expect(
        page.locator(`[data-dashboard-module-workspace="${moduleId}"]`),
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        paintedNav(page, NAV_CLINIC).locator(
          `[data-dashboard-mobile-nav-item="${moduleId}"]`,
        ),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        paintedNav(page, NAV_CLINIC).locator("[aria-current='page']"),
      ).toHaveCount(1);
    }
  });

  test("a clinic full route keeps its own shell and the same navigation owner", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSurface(page, "clinic", "/dashboard/informes");

    // B10 fence: the full routes were NOT folded into the module controller.
    // They reach the bar because it is mounted at SHELL level, which is where
    // it already was before B09.
    await expectPrimaryItems(
      page,
      NAV_CLINIC,
      CLINIC_PRIMARY_ITEMS,
      "clinic full route",
    );
    await expect(
      page.locator('[data-dashboard-module-stage="true"]'),
      "the full route keeps its own shell, not the clinic module stage",
    ).toHaveCount(0);

    // And it can navigate back into the canonical `?module=` grammar.
    await paintedNav(page, NAV_CLINIC)
      .locator('[data-dashboard-mobile-nav-item="tokens"]')
      .click();
    await expect(page).toHaveURL(/\/dashboard\?module=tokens$/, {
      timeout: 15_000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// History and hub reset
// ─────────────────────────────────────────────────────────────────────────────

test.describe("B09 · deep links, history and hub reset", () => {
  test("admin deep link, Back and Forward keep aria-current honest", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSurface(page, "admin", "/dashboard/admin?module=admin-sessions");

    const nav = paintedNav(page, NAV_ADMIN);
    await expect(
      nav.locator('[data-dashboard-mobile-nav-item="admin-sessions"]'),
    ).toHaveAttribute("aria-current", "page", { timeout: 15_000 });

    await nav.locator('[data-dashboard-mobile-nav-item="audit-log"]').click();
    await expect(page).toHaveURL(/\/dashboard\/admin\?module=audit-log$/, {
      timeout: 15_000,
    });
    await expect(
      nav.locator('[data-dashboard-mobile-nav-item="audit-log"]'),
    ).toHaveAttribute("aria-current", "page", { timeout: 15_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\/admin\?module=admin-sessions$/, {
      timeout: 15_000,
    });
    await expect(
      nav.locator('[data-dashboard-mobile-nav-item="admin-sessions"]'),
      "Back must move the highlight with the URL",
    ).toHaveAttribute("aria-current", "page", { timeout: 15_000 });

    await page.goForward();
    await expect(page).toHaveURL(/\/dashboard\/admin\?module=audit-log$/, {
      timeout: 15_000,
    });
    await expect(
      nav.locator('[data-dashboard-mobile-nav-item="audit-log"]'),
      "Forward must move the highlight with the URL",
    ).toHaveAttribute("aria-current", "page", { timeout: 15_000 });

    await expect(nav.locator("[aria-current='page']")).toHaveCount(1);
  });

  test("Inicio returns the admin workspace to the hub", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSurface(page, "admin", "/dashboard/admin?module=admin-clinics");

    await paintedNav(page, NAV_ADMIN)
      .locator('[data-dashboard-mobile-nav-item="home"]')
      .click();

    // The hub-reset signal is synchronous on purpose: the controller paints
    // from local state ahead of the URL commit, so a same-URL no-op push would
    // otherwise strand it on the previous module.
    await expect(
      page.locator('[data-admin-mobile-hub-launcher="true"]'),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      paintedNav(page, NAV_ADMIN).locator(
        '[data-dashboard-mobile-nav-item="home"]',
      ),
    ).toHaveAttribute("aria-current", "page");
  });

  test("a reload restores the deep-linked module, not the last one visited", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSurface(page, "clinic", "/dashboard?module=perfil");

    await page.reload();
    await expect(page.locator(MAIN)).toBeVisible({ timeout: 25_000 });
    await expect(
      paintedNav(page, NAV_CLINIC).locator(
        '[data-dashboard-mobile-nav-item="perfil"]',
      ),
    ).toHaveAttribute("aria-current", "page", { timeout: 20_000 });
    await expect(
      paintedNav(page, NAV_CLINIC).locator("[aria-current='page']"),
    ).toHaveCount(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Touch targets and the action overflow
// ─────────────────────────────────────────────────────────────────────────────

test.describe("B09 · touch targets and the action overflow", () => {
  for (const viewport of PHONE_VIEWPORTS) {
    test(`every control B09 owns is >= 44x44 at ${viewport.name}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await gotoSurface(page, "admin", "/dashboard/admin?module=admin-clinics");

      // Bar closed.
      await expect(async () => {
        const reading = await readBand(page);
        expect(
          reading.undersized,
          `${viewport.name}: bar + kebab trigger`,
        ).toEqual([]);
      }).toPass({ timeout: 20_000 });

      // Destination overflow open: links, pagination and the close control.
      await paintedNav(page)
        .locator('[data-dashboard-mobile-nav-item="overflow"]')
        .click();
      await expect(page.locator(OVERFLOW)).toBeVisible();
      await expect(async () => {
        const reading = await readBand(page);
        expect(
          reading.undersized,
          `${viewport.name}: destination overflow`,
        ).toEqual([]);
        expect(
          reading.documentScrollY,
          `${viewport.name}: the overflow must not introduce a document scroll`,
        ).toBeLessThanOrEqual(TOLERANCE_PX);
      }).toPass({ timeout: 20_000 });
      await page.keyboard.press("Escape");

      // ACTION overflow: a separate owner, and the only carrier of theme,
      // notifications, password, public site and logout on admin mobile.
      await page.locator(KEBAB_TRIGGER).click();
      const kebab = page.locator('[data-admin-mobile-kebab-menu="true"]');
      await expect(kebab).toBeVisible();

      const undersizedActions = await kebab.evaluate((menu, min) => {
        return Array.from(
          menu.querySelectorAll<HTMLElement>(
            ".admin-mobile-kebab-row, .admin-mobile-kebab-action, .admin-mobile-kebab-row button",
          ),
        )
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              label:
                element.getAttribute("aria-label") ||
                (element.textContent || "").trim().slice(0, 40),
              width: Math.round(rect.width * 100) / 100,
              height: Math.round(rect.height * 100) / 100,
            };
          })
          .filter((metric) => metric.height < min);
      }, TOUCH_MIN_PX);

      expect(
        undersizedActions,
        `${viewport.name}: kebab rows and actions must be >= ${TOUCH_MIN_PX}px tall`,
      ).toEqual([]);

      for (const action of [
        "Apariencia",
        "Notificaciones",
        "Cambiar contraseña",
        "Ver sitio público",
        "Cerrar sesión",
      ]) {
        await expect(
          kebab.getByText(action, { exact: true }),
          `${viewport.name}: ${action} survives B09`,
        ).toBeVisible();
      }
    });
  }

  test("the admin mobile app bar is 48px and seats the trigger with margin", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSurface(page, "admin", "/dashboard/admin?module=admin-clinics");

    // B09_ADMIN_MOBILE_APPBAR_H = 48px. The band resolved to 44px before, and a
    // 44x44 trigger exactly filled it, leaving its border to overflow.
    const geometry = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>(
        '[data-admin-mobile-app-bar="true"]',
      );
      const trigger = document.querySelector<HTMLElement>(
        ".admin-mobile-kebab-trigger",
      );
      const barRect = bar?.getBoundingClientRect() ?? null;
      const triggerRect = trigger?.getBoundingClientRect() ?? null;
      return {
        barHeight: barRect ? barRect.height : null,
        triggerWidth: triggerRect ? triggerRect.width : null,
        triggerHeight: triggerRect ? triggerRect.height : null,
        triggerTop: triggerRect ? triggerRect.top : null,
        triggerBottom: triggerRect ? triggerRect.bottom : null,
        barBottom: barRect ? barRect.bottom : null,
      };
    });

    expect(geometry.barHeight, "app bar height").toBeGreaterThanOrEqual(
      48 - TOLERANCE_PX,
    );
    expect(geometry.triggerWidth, "trigger width").toBeGreaterThanOrEqual(
      TOUCH_MIN_PX,
    );
    expect(geometry.triggerHeight, "trigger height").toBeGreaterThanOrEqual(
      TOUCH_MIN_PX,
    );
    expect(
      geometry.triggerTop!,
      "the trigger must not overflow the band",
    ).toBeGreaterThanOrEqual(-TOLERANCE_PX);
    expect(
      geometry.triggerBottom!,
      "the trigger must not overflow the band",
    ).toBeLessThanOrEqual(geometry.barBottom! + TOLERANCE_PX);
  });
});
