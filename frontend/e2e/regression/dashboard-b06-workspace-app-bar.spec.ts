import { expect, test, type Page } from "@playwright/test";

import {
  DARK_GRAY_THEME_MODE,
  NORMAL_THEME_MODE,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "../../src/lib/theme";
import {
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_COMBINATION_COUNT,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACE_COUNT,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_GEOMETRY_VIEWPORT_COUNT,
  DASHBOARD_GEOMETRY_VIEWPORTS,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
} from "../helpers/dashboard-geometry-matrix";

// ─────────────────────────────────────────────────────────────────────────────
// B06 · WorkspaceAppBar runtime contract — 21 surfaces × 13 viewports (273).
//
// Completeness comes from the SAME canonical matrix as A02/A08/B04
// (`../helpers/dashboard-geometry-matrix`); this spec declares no second
// census, so dropping a surface or a viewport there fails B06 in `beforeAll`.
//
// What it freezes, per combination:
//   · exactly one app bar exists and is the first row of the shell chrome;
//   · it is a SINGLE row — every visible direct child fits inside its box;
//   · full width, no radius, no elevation, one 1px bottom rule on the band;
//   · it never overlaps `main.dashboard-main`;
//   · its height sits inside the declared band.
//
// BOUNDARY WITH A08. Document/body/main scroll is NOT asserted here. A08
// (`dashboard-zero-scroll-baseline.spec.ts`) already freezes it over the SAME
// 21 × 13 matrix, at an exact 0px contract, in the same `ci` cohort — so
// re-asserting it would add no information and would force this spec to gate on
// the fully loaded module data it does not measure. B06 owns the band; A08 owns
// the frame. That split is also what keeps this spec inside the completeness
// cohort's runtime budget (see the note on the theme block below).
//
// HEIGHT BAND — two regimes, both asserted, neither aspirational:
//
//   >= 768px  WORKSPACE regime. This bar IS the workspace chrome and the audit
//             target applies: 56 ±2 px (audit §49/§57, row B06). Measured
//             54.328px on all eight desktop/tablet viewports, i.e. inside the
//             band with the shipped geometry.
//
//   <  768px  MOBILE regime. The admin and clinic mobile app bars keep their
//             shipped height tokens (44px / 52px). Raising them to 56 ±2 is NOT
//             a styling choice B06 can make: the bar is the first region of the
//             shell height ledger, and the A03 freeze leaves the phone canvases
//             0.672px of downward slack (`admin-pricing @375x812`), so +12px of
//             chrome re-pages consumers that A03 pins exactly. The mobile band
//             is therefore asserted at its shipped value — a real contract, not
//             a skip — and its unification is B09's. See
//             docs/implementation/dashboard-b06-workspace-app-bar.md.
//
// Dual theme is asserted on the two viewport classes B04 already uses, not on
// all 13: the band is a geometry contract and geometry is theme-invariant, so
// re-walking the matrix twice would buy no information and double the runtime.
// Only `dark-gray` gets its own pass: the matrix above already runs every
// surface in the default (`normal`) theme at those same two viewports, so a
// second `normal` pass was a literal duplicate — 21 surfaces × 2 viewports of
// re-measurement that could not disagree with the run that preceded it.
// ─────────────────────────────────────────────────────────────────────────────

const APP_ORIGIN = "http://127.0.0.1:3000";

const APP_BAR_SELECTOR = '[data-workspace-app-bar="true"]';
const APP_BAR_BAND_SELECTOR = '[data-dashboard-topbar-polish="true"]';

/** Audit target and tolerance. Mirrors `--dash-app-bar-h` / `--dash-app-bar-band`. */
const WORKSPACE_APP_BAR_TARGET_PX = 56;
const WORKSPACE_APP_BAR_TOLERANCE_PX = 2;

/** Breakpoint at which this bar becomes the workspace chrome (`md`). */
const WORKSPACE_REGIME_MIN_WIDTH_PX = 768;

/**
 * Shipped mobile app-bar bands, by role. Admin locks the band to
 * `--admin-mobile-appbar-h` (clamp 2.75rem–3rem); clinic derives it from the
 * mobile topbar block of `mobile-clinic.css`. Both are asserted as ranges so a
 * silent change of either token fails here.
 */
const MOBILE_APP_BAR_BAND_PX: Readonly<Record<"admin" | "clinic", readonly [number, number]>> =
  {
    admin: [44, 48],
    clinic: [48, 54],
  };

/**
 * The matrix above runs under {@link NORMAL_THEME_MODE}; this block only has to
 * prove the band survives the theme the matrix never sees.
 */
const THEMES: readonly ThemeMode[] = [DARK_GRAY_THEME_MODE];
const THEME_VIEWPORT_SLUGS = ["w1366x768", "w390x844"] as const;

type AppBarReading = {
  readonly present: boolean;
  readonly count: number;
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
  readonly width: number;
  readonly borderRadius: string;
  readonly boxShadow: string;
  readonly bandBorderBottomWidth: string;
  readonly overflowingChildren: readonly string[];
  readonly mainTop: number | null;
  readonly searchPresent: boolean;
};

async function installTheme(page: Page, theme: ThemeMode): Promise<void> {
  await page.addInitScript(
    ([key, mode]) => {
      try {
        window.localStorage.setItem(key, mode);
      } catch {
        /* localStorage unavailable: the theme assertion below reports it */
      }
    },
    [THEME_STORAGE_KEY, theme] as const,
  );
}

async function readAppBar(
  page: Page,
  barSelector: string,
  bandSelector: string,
): Promise<AppBarReading> {
  return page.evaluate(
    ({ barSelector: bar, bandSelector: band }) => {
      const bars = Array.from(document.querySelectorAll<HTMLElement>(bar));
      const node = bars[0] ?? null;
      const bandNode = document.querySelector<HTMLElement>(band);
      const main = document.querySelector<HTMLElement>("main.dashboard-main");

      if (!node) {
        return {
          present: false,
          count: bars.length,
          top: 0,
          bottom: 0,
          height: 0,
          width: 0,
          borderRadius: "",
          boxShadow: "",
          bandBorderBottomWidth: "",
          overflowingChildren: [] as string[],
          mainTop: main ? main.getBoundingClientRect().top : null,
          searchPresent: false,
        };
      }

      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);

      // Single row: no visible direct child may be laid out outside the band's
      // own box. A wrapped bar shows up here as a child below the bottom edge.
      const overflowingChildren: string[] = [];
      for (const child of Array.from(node.children)) {
        const childRect = child.getBoundingClientRect();
        const childStyle = window.getComputedStyle(child);
        if (
          childRect.width === 0 ||
          childRect.height === 0 ||
          childStyle.display === "none" ||
          childStyle.visibility === "hidden" ||
          childStyle.position === "absolute" ||
          childStyle.position === "fixed"
        ) {
          continue;
        }
        if (childRect.top < rect.top - 0.5 || childRect.bottom > rect.bottom + 0.5) {
          overflowingChildren.push(
            `${child.tagName.toLowerCase()}[${(child as HTMLElement).className || ""}] ` +
              `top=${childRect.top.toFixed(2)} bottom=${childRect.bottom.toFixed(2)}`,
          );
        }
      }

      return {
        present: true,
        count: bars.length,
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        width: rect.width,
        borderRadius: style.borderTopLeftRadius,
        boxShadow: style.boxShadow,
        bandBorderBottomWidth: bandNode
          ? window.getComputedStyle(bandNode).borderBottomWidth
          : "absent",
        overflowingChildren,
        mainTop: main ? main.getBoundingClientRect().top : null,
        searchPresent:
          node.querySelector('[data-workspace-app-bar-search-input="true"]') !== null,
      };
    },
    { barSelector, bandSelector },
  );
}

function collectViolations(
  reading: AppBarReading,
  label: string,
  viewportWidth: number,
  role: "admin" | "clinic",
): string[] {
  const violations: string[] = [];

  if (!reading.present) {
    return [`${label}: no element matches ${APP_BAR_SELECTOR}`];
  }
  if (reading.count !== 1) {
    violations.push(`${label}: expected exactly 1 app bar, found ${reading.count}`);
  }

  const [min, max] =
    viewportWidth >= WORKSPACE_REGIME_MIN_WIDTH_PX
      ? ([
          WORKSPACE_APP_BAR_TARGET_PX - WORKSPACE_APP_BAR_TOLERANCE_PX,
          WORKSPACE_APP_BAR_TARGET_PX + WORKSPACE_APP_BAR_TOLERANCE_PX,
        ] as const)
      : MOBILE_APP_BAR_BAND_PX[role];

  if (reading.height < min || reading.height > max) {
    violations.push(
      `${label}: app bar height ${reading.height.toFixed(3)}px is outside the declared band [${min}, ${max}]`,
    );
  }

  if (Math.abs(reading.width - viewportWidth) > 1) {
    violations.push(
      `${label}: app bar width ${reading.width.toFixed(3)}px != viewport width ${viewportWidth}px`,
    );
  }

  if (reading.overflowingChildren.length > 0) {
    violations.push(
      `${label}: app bar is not a single row — ${reading.overflowingChildren.join(" | ")}`,
    );
  }

  if (reading.borderRadius !== "0px") {
    violations.push(`${label}: app bar has a radius (${reading.borderRadius}), contract is 0`);
  }

  if (reading.boxShadow !== "none") {
    violations.push(
      `${label}: app bar paints elevation (${reading.boxShadow}), contract is none`,
    );
  }

  if (reading.bandBorderBottomWidth !== "1px") {
    violations.push(
      `${label}: the app-bar band must carry exactly a 1px bottom rule, got ${reading.bandBorderBottomWidth}`,
    );
  }

  if (reading.mainTop === null) {
    violations.push(`${label}: main.dashboard-main is absent`);
  } else if (reading.bottom > reading.mainTop + 0.5) {
    violations.push(
      `${label}: app bar overlaps main (bar bottom ${reading.bottom.toFixed(3)} > main top ${reading.mainTop.toFixed(3)})`,
    );
  }

  // The global module search is the workspace-regime affordance; below `md` the
  // mobile chrome owns navigation and the search is deliberately not mounted.
  if (viewportWidth >= WORKSPACE_REGIME_MIN_WIDTH_PX && !reading.searchPresent) {
    violations.push(`${label}: global module search is missing from the app bar`);
  }

  return violations;
}

test.beforeAll(() => {
  expect(DASHBOARD_GEOMETRY_SURFACES.length, "surface cardinality").toBe(
    DASHBOARD_GEOMETRY_SURFACE_COUNT,
  );
  expect(DASHBOARD_GEOMETRY_VIEWPORTS.length, "viewport cardinality").toBe(
    DASHBOARD_GEOMETRY_VIEWPORT_COUNT,
  );
  expect(
    DASHBOARD_GEOMETRY_SURFACES.length * DASHBOARD_GEOMETRY_VIEWPORTS.length,
    "expected app-bar combinations",
  ).toBe(DASHBOARD_GEOMETRY_COMBINATION_COUNT);
});

test.describe("B06 · workspace app bar contract 21x13", () => {
  for (const surface of DASHBOARD_GEOMETRY_SURFACES) {
    test(`${surface.id} keeps the workspace app bar band across 13 viewports`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(300_000);

      await suppressNextDevChrome(page);
      await clearDashboardModuleMemory(page);
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

      const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role];
      await page
        .context()
        .addCookies([{ name: cookie.name, value: cookie.value, url: APP_ORIGIN }]);
      await installSurfaceMocks(page, surface);

      const measured: Array<Record<string, unknown>> = [];
      const failures: string[] = [];

      for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS) {
        const label = `${surface.id} @ ${viewport.slug}`;

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(surface.route);

        // Readiness for THIS contract is the chrome, not the module payload: the
        // band is server-rendered and its height is a function of the shell and
        // the fonts, never of the collection below it. `waitForLayoutSettled`
        // awaits `document.fonts.ready` plus two frames, which is exactly the
        // condition a text-derived height needs. Gating on `networkidle` and on
        // the loaded-state markers instead would wait for data this spec does
        // not read — and A08 already measures every one of these surfaces in
        // its fully loaded state.
        await expect(
          page.locator(APP_BAR_SELECTOR).first(),
          `${label}: app bar mounted`,
        ).toBeVisible({ timeout: 25_000 });
        await waitForLayoutSettled(page);

        // Self-verifying dedup: the theme block below drops the `normal` pass
        // BECAUSE this matrix already runs it. Asserting it here once per
        // surface is what turns that claim into a checked fact instead of a
        // comment — if the default theme ever stops being `normal`, the theme
        // coverage becomes incomplete and this fails.
        if (viewport === DASHBOARD_GEOMETRY_VIEWPORTS[0]) {
          await expect(
            page.locator("html"),
            `${label}: the matrix runs the default theme`,
          ).toHaveAttribute("data-theme", NORMAL_THEME_MODE, { timeout: 10_000 });
        }

        const reading = await readAppBar(page, APP_BAR_SELECTOR, APP_BAR_BAND_SELECTOR);
        failures.push(...collectViolations(reading, label, viewport.width, surface.role));
        measured.push({
          surfaceId: surface.id,
          viewportSlug: viewport.slug,
          height: Number(reading.height.toFixed(3)),
          width: Number(reading.width.toFixed(3)),
          searchPresent: reading.searchPresent,
        });
      }

      expect(measured.length, `${surface.id}: measured viewports`).toBe(
        DASHBOARD_GEOMETRY_VIEWPORT_COUNT,
      );

      await testInfo.attach(`b06-app-bar-${surface.id}.json`, {
        contentType: "application/json",
        body: Buffer.from(`${JSON.stringify(measured, null, 2)}\n`, "utf8"),
      });

      expect(failures.join("\n"), `${surface.id}: app bar violations`).toBe("");
    });
  }
});

test.describe("B06 · workspace app bar in both themes", () => {
  for (const theme of THEMES) {
    test(`app bar keeps its band and flatness in ${theme}`, async ({ browser }) => {
      test.setTimeout(300_000);

      const failures: string[] = [];

      // One context PER ROLE, not per combination. The session cookie and the
      // theme seed are the only per-context state, and the role owns both, so 42
      // fresh contexts were 40 browser bootstraps that measured nothing extra.
      // Mocks and viewport are per-surface/per-viewport and stay in the loop.
      for (const role of ["admin", "clinic"] as const) {
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

          for (const surface of DASHBOARD_GEOMETRY_SURFACES) {
            if (surface.role !== role) continue;
            await installSurfaceMocks(page, surface);

            for (const slug of THEME_VIEWPORT_SLUGS) {
              const viewport = DASHBOARD_GEOMETRY_VIEWPORTS.find(
                (item) => item.slug === slug,
              );
              expect(
                viewport,
                `theme viewport ${slug} must exist in the canonical matrix`,
              ).toBeTruthy();
              if (!viewport) continue;

              const label = `${surface.id} @ ${slug} · ${theme}`;

              await page.setViewportSize({
                width: viewport.width,
                height: viewport.height,
              });
              await page.goto(surface.route);
              await expect(
                page.locator(APP_BAR_SELECTOR).first(),
                `${label}: app bar mounted`,
              ).toBeVisible({ timeout: 25_000 });
              await expect(
                page.locator("html"),
                `${label}: theme applied pre-paint`,
              ).toHaveAttribute("data-theme", theme, { timeout: 10_000 });
              await waitForLayoutSettled(page);

              const reading = await readAppBar(
                page,
                APP_BAR_SELECTOR,
                APP_BAR_BAND_SELECTOR,
              );
              failures.push(
                ...collectViolations(reading, label, viewport.width, surface.role),
              );
            }
          }
        } finally {
          await context.close();
        }
      }

      expect(failures.join("\n"), `${theme}: app bar violations`).toBe("");
    });
  }
});

test.describe("B06 · global module search", () => {
  test("Enter on a searched module navigates with the ?module= grammar", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await suppressNextDevChrome(page);
    await clearDashboardModuleMemory(page);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

    const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE.admin;
    await page
      .context()
      .addCookies([{ name: cookie.name, value: cookie.value, url: APP_ORIGIN }]);

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/dashboard/admin?hub=1");

    const input = page.locator('[data-workspace-app-bar-search-input="true"]');
    await expect(input, "search input mounts on the admin workspace").toBeVisible({
      timeout: 25_000,
    });

    // Keyboard-only path: focus, type, Enter. No mouse, no link.
    await input.focus();
    await input.pressSequentially("auditor");

    const options = page.locator('[data-workspace-app-bar-search-option]');
    await expect(options, "the catalog is really filtered").toHaveCount(1);
    await expect(options.first()).toHaveAttribute(
      "data-workspace-app-bar-search-option",
      "audit-log",
    );

    await input.press("Enter");

    await expect(page).toHaveURL(/\/dashboard\/admin\?module=audit-log$/, {
      timeout: 20_000,
    });
    await expect(
      page.locator('[data-dashboard-module-workspace="audit-log"]').first(),
      "the searched module really mounts",
    ).toBeVisible({ timeout: 25_000 });
  });

  test("arrow keys move the active option and Enter selects it", async ({ page }) => {
    test.setTimeout(180_000);

    await suppressNextDevChrome(page);
    await clearDashboardModuleMemory(page);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

    const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE.admin;
    await page
      .context()
      .addCookies([{ name: cookie.name, value: cookie.value, url: APP_ORIGIN }]);

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/dashboard/admin?hub=1");

    const input = page.locator('[data-workspace-app-bar-search-input="true"]');
    await expect(input).toBeVisible({ timeout: 25_000 });
    await input.focus();
    await input.pressSequentially("admin-");

    // The first match is the active option; one ArrowDown moves to the second.
    const options = page.locator('[data-workspace-app-bar-search-option]');
    const secondId = await options.nth(1).getAttribute("data-workspace-app-bar-search-option");
    expect(secondId, "second match must exist").toBeTruthy();

    await input.press("ArrowDown");
    await expect(options.nth(1), "ArrowDown moves the active option").toHaveAttribute(
      "aria-selected",
      "true",
    );

    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`\\?module=${secondId}$`), {
      timeout: 20_000,
    });
  });
});
