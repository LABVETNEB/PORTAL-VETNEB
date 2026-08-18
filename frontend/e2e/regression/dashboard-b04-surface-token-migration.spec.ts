import { expect, test, type Page } from "@playwright/test";

import {
  DARK_GRAY_THEME_MODE,
  NORMAL_THEME_MODE,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "../../src/lib/theme";
import {
  assertSurfaceLoaded,
  clearDashboardModuleMemory,
  DASHBOARD_GEOMETRY_SESSION_COOKIE,
  DASHBOARD_GEOMETRY_SURFACE_COUNT,
  DASHBOARD_GEOMETRY_SURFACES,
  DASHBOARD_PERSISTENT_CHROME,
  DASHBOARD_SHELL_FRAME_SELECTOR,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
} from "../helpers/dashboard-geometry-matrix";

// ─────────────────────────────────────────────────────────────────────────────
// B04 · persistent-chrome elevation gate (audit gate G6), both themes.
//
// G6 closes as "0 sombras en chrome persistente". This gate proves it at
// RUNTIME, on the resolved cascade, which is the only place the claim is real:
// the elevation of a band can come from a CSS rule, from a Tailwind utility, or
// from a responsive or theme variant of either, and only the computed style sees
// all of them at once.
//
// SCOPE, stated as a boundary rather than a sweep:
//
//   * The 21 canonical surfaces come from the SAME owner as A02 and A08
//     (`../helpers/dashboard-geometry-matrix`). Dropping one there fails this
//     gate in `beforeAll`, so completeness cannot rot independently.
//   * The chrome anchors come from that owner too
//     (`DASHBOARD_PERSISTENT_CHROME`), so the static contract in
//     `test/architecture/dashboard-b04-surface-token-migration.test.ts` and this
//     one cannot drift into policing different inventories.
//   * Both themes (R9: from B04 the dashboard is dual-theme or it is unproven).
//   * Two viewport classes, laptop and phone, because the chrome differs between
//     them: the horizontal nav is `md:block`, the bottom navs are mobile-only,
//     and the sticky action bar is `fixed` below `md` and `sticky` above it. One
//     viewport class would leave half the chrome unobserved.
//
// 21 surfaces x 2 themes x 2 viewport classes = 84 contractual states.
//
// It does NOT assert flatness on transient overlays (a closed menu is not part
// of the persistent chrome, and an open one is SUPPOSED to be elevated), and it
// never touches focus rings: a chrome band that is not focused computes no ring,
// and one that is focused must keep it.
// ─────────────────────────────────────────────────────────────────────────────

const APP_ORIGIN = "http://127.0.0.1:3000";

const THEMES: readonly ThemeMode[] = [NORMAL_THEME_MODE, DARK_GRAY_THEME_MODE];

/**
 * Laptop and phone. 1366x768 is the worst chrome ratio the audit measured
 * (P1-19) and the desktop chrome model; 390x844 is the mobile chrome model.
 */
const VIEWPORT_CLASSES = [
  { slug: "w1366x768", width: 1366, height: 768 },
  { slug: "w390x844", width: 390, height: 844 },
] as const;

const EXPECTED_STATE_COUNT =
  DASHBOARD_GEOMETRY_SURFACE_COUNT * THEMES.length * VIEWPORT_CLASSES.length;

type ChromeObservation = {
  readonly surfaceId: string;
  readonly theme: ThemeMode;
  readonly viewportSlug: string;
  readonly anchor: string;
  readonly selector: string;
  readonly boxShadow: string;
  readonly elevated: boolean;
};

/**
 * Is a computed `box-shadow` an ELEVATION layer?
 *
 * `none` is the flat answer this migration states explicitly. Tailwind's
 * `shadow-none` resolves to `rgba(0,0,0,0) 0px 0px 0px 0px` instead — visually
 * identical, textually not — so a fully transparent layer counts as flat too.
 * Anything else with a real colour and a real offset, blur or spread is
 * elevation and fails.
 *
 * Parsing is deliberately conservative: an unrecognised value is treated as
 * ELEVATED, so a shadow syntax this helper does not understand fails the gate
 * instead of slipping through it.
 */
function readsAsElevation(boxShadow: string): boolean {
  const value = boxShadow.trim();
  if (value === "" || value === "none") return false;

  // Split on commas that are not inside a colour function.
  const layers: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      layers.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  layers.push(current);

  return layers.some((layer) => {
    const trimmed = layer.trim();
    if (trimmed === "") return false;

    // A fully transparent layer paints nothing.
    if (/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*0\s*\)/.test(trimmed)) {
      return false;
    }

    const lengths = trimmed.match(/-?[\d.]+px/g) ?? [];
    if (lengths.length === 0) return true; // unparsed: fail closed
    return lengths.some((length) => Number.parseFloat(length) !== 0);
  });
}

/** Writes the theme pre-paint, the way `public/theme-init.js` reads it. */
async function installTheme(page: Page, theme: ThemeMode): Promise<void> {
  await page.addInitScript(
    ([key, mode]) => {
      try {
        window.localStorage.setItem(key, mode);
      } catch {
        /* localStorage unavailable: the assertion below reports it */
      }
    },
    [THEME_STORAGE_KEY, theme] as const,
  );
}

async function readChrome(
  page: Page,
  anchors: readonly { readonly label: string; readonly selector: string }[],
  frameSelector: string,
): Promise<Array<Omit<ChromeObservation, "surfaceId" | "theme" | "viewportSlug">>> {
  return page.evaluate(
    ({ anchors: probes, frameSelector: frame }) => {
      const isVisible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      };

      const observations: Array<{
        anchor: string;
        selector: string;
        boxShadow: string;
      }> = [];

      for (const probe of probes) {
        for (const element of Array.from(
          document.querySelectorAll(probe.selector),
        )) {
          if (!isVisible(element)) continue;
          observations.push({
            anchor: probe.anchor,
            selector: probe.selector,
            boxShadow: window.getComputedStyle(element).boxShadow,
          });
        }
      }

      // The shell frame paints its chrome through ::before, which no element
      // query reaches; it is persistent chrome by definition and the first
      // thing the audit names, so it is read explicitly.
      const shell = document.querySelector(frame);
      if (shell) {
        observations.push({
          anchor: "shell-frame::before",
          selector: `${frame}::before`,
          boxShadow: window.getComputedStyle(shell, "::before").boxShadow,
        });
      }

      return observations;
    },
    {
      anchors: anchors.map((anchor) => ({
        anchor: anchor.label,
        selector: anchor.selector,
      })),
      frameSelector,
    },
  ) as Promise<
    Array<Omit<ChromeObservation, "surfaceId" | "theme" | "viewportSlug">>
  >;
}

test.beforeAll(() => {
  expect(DASHBOARD_GEOMETRY_SURFACES.length, "surface cardinality").toBe(
    DASHBOARD_GEOMETRY_SURFACE_COUNT,
  );
  expect(
    new Set(DASHBOARD_GEOMETRY_SURFACES.map((surface) => surface.id)).size,
    "surface ids must be unique",
  ).toBe(DASHBOARD_GEOMETRY_SURFACE_COUNT);
  expect(DASHBOARD_PERSISTENT_CHROME.length, "chrome anchors").toBeGreaterThan(0);
  expect(EXPECTED_STATE_COUNT, "contractual states").toBe(84);
});

test.describe("B04 · persistent chrome paints no elevation (G6), light + dark", () => {
  for (const surface of DASHBOARD_GEOMETRY_SURFACES) {
    test(`${surface.id} keeps its persistent chrome flat in both themes`, async ({
      browser,
    }, testInfo) => {
      test.setTimeout(300_000);

      const observations: ChromeObservation[] = [];
      const failures: string[] = [];
      let statesMeasured = 0;

      for (const theme of THEMES) {
        for (const viewport of VIEWPORT_CLASSES) {
          const label = `${surface.id} @ ${theme} @ ${viewport.slug}`;

          // A fresh context per state: the theme is written pre-paint, so it
          // must be installed before the very first navigation of the page it
          // applies to. Reusing one page would require a reload to re-read
          // localStorage and would leave the previous theme's paint on screen.
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            reducedMotion: "reduce",
            colorScheme: "light",
          });

          try {
            const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE[surface.role];
            await context.addCookies([
              { name: cookie.name, value: cookie.value, url: APP_ORIGIN },
            ]);

            const page = await context.newPage();
            await suppressNextDevChrome(page);
            await clearDashboardModuleMemory(page);
            await installTheme(page, theme);
            await installSurfaceMocks(page, surface);

            await page.goto(surface.route);

            await expect(
              page.locator(surface.readinessSelector).first(),
              `${label}: readiness`,
            ).toBeVisible({ timeout: 25_000 });

            // The theme must be the one under test BEFORE anything is read:
            // a baseline captured mid-toggle proves nothing about either theme.
            await expect(
              page.locator("html"),
              `${label}: theme applied pre-paint`,
            ).toHaveAttribute("data-theme", theme, { timeout: 10_000 });

            await page.waitForLoadState("networkidle", { timeout: 20_000 });
            await assertSurfaceLoaded(page, surface, label);
            await waitForLayoutSettled(page);

            const measured = await readChrome(
              page,
              DASHBOARD_PERSISTENT_CHROME,
              DASHBOARD_SHELL_FRAME_SELECTOR,
            );

            // Every surface renders at least the shell frame; zero anchors means
            // the probe missed the tree, not that the chrome is flat.
            expect(
              measured.length,
              `${label}: persistent chrome anchors observed`,
            ).toBeGreaterThan(0);

            for (const observation of measured) {
              const elevated = readsAsElevation(observation.boxShadow);
              observations.push({
                surfaceId: surface.id,
                theme,
                viewportSlug: viewport.slug,
                ...observation,
                elevated,
              });

              if (elevated) {
                failures.push(
                  `${label}: ${observation.anchor} (${observation.selector}) paints elevation "${observation.boxShadow}" — gate G6 requires the persistent chrome to compute to no elevation shadow`,
                );
              }
            }

            statesMeasured += 1;
          } finally {
            await context.close();
          }
        }
      }

      // Fail-closed on execution: a state that silently stops running can never
      // leave this test green.
      expect(statesMeasured, `${surface.id}: states measured`).toBe(
        THEMES.length * VIEWPORT_CLASSES.length,
      );

      await testInfo.attach(`b04-chrome-elevation-${surface.id}.json`, {
        contentType: "application/json",
        body: JSON.stringify(
          {
            surfaceId: surface.id,
            themes: THEMES,
            viewports: VIEWPORT_CLASSES.map((viewport) => viewport.slug),
            statesMeasured,
            observations,
          },
          null,
          2,
        ),
      });

      expect(failures.join("\n"), `${surface.id}: G6 persistent chrome`).toBe("");
    });
  }
});
