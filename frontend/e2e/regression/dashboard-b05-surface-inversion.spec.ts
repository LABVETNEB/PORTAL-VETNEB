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
  DASHBOARD_GEOMETRY_SURFACES,
  installSurfaceMocks,
  suppressNextDevChrome,
  waitForLayoutSettled,
  type DashboardGeometrySurface,
} from "../helpers/dashboard-geometry-matrix";

// ─────────────────────────────────────────────────────────────────────────────
// B05 · filter-field surface inversion (roadmap §49/§54: "campo teñido,
// contenedor transparente").
//
// A static grep can prove the CSS rule exists; it cannot prove a CSS custom
// property actually painted anything. This gate reads the RESOLVED
// `background-color` of one field and its container per surface, in both
// themes, and asserts the relationship the audit names:
//
//   CONTAINER   fully transparent (alpha 0)
//   FIELD       not transparent, and its resolved colour differs from the
//               container's — the field is the only thing painting a fill
//   BOTH THEMES the field's resolved colour differs between normal and
//               dark-gray, proving `--dash-color-field` (a THEME_VARIANT
//               token) genuinely resolves per theme instead of being an inert
//               alias that exists but never changes what got painted
//
// SCOPE — 7 super searchers, not the 21-surface B04 matrix:
//   SHARED (S1 admin-auditoria, S2 admin-tokens, S3 admin-informes,
//           S6 clinic-informes, S7 clinic-tokens) render through the shared
//           `FilterBar`; only the desktop ("compact" density) instance is
//           tested. The "comfortable" density instance renders exclusively
//           inside a Radix `Dialog.Portal`, which mounts at `document.body` —
//           OUTSIDE `.dashboard-app-shell`, the only element that declares
//           `--dash-color-field`. That gap predates B04 and B05 (the B04
//           elevation rule has the exact same reach) and is out of scope to
//           fix here: doing so would mean giving `ModuleDialog` a portal
//           container ref, a change to a component shared far beyond the 7
//           super searchers. It is recorded, not silently worked around.
//   DIRECT (S4 admin-clinicas, S5 admin-usuarios) have no shared wrapper and
//           real, simultaneously-mounted desktop/mobile markup (toggled by
//           `hidden`/`md:hidden`, not by a portal), so both viewport classes
//           are tested for real.
//
// S7 (clinic-tokens) is expected BLOCKED, not skipped silently: the hermetic
// fixture server never implements `/api/particular-tokens`, so
// `ClinicParticularTokensCard` never has `tokens.length > 0` and its
// `FilterBar` never mounts. `test.skip(...)` below states that cause inline
// per AGENTS §6 (BLOCKED must name why, never infer PASSED).
// ─────────────────────────────────────────────────────────────────────────────

const APP_ORIGIN = "http://127.0.0.1:3000";

const THEMES: readonly ThemeMode[] = [NORMAL_THEME_MODE, DARK_GRAY_THEME_MODE];

const VIEWPORT_CLASSES = [
  { slug: "w1366x768", width: 1366, height: 768 },
  { slug: "w390x844", width: 390, height: 844 },
] as const;

type ViewportClass = (typeof VIEWPORT_CLASSES)[number];

type SurfaceKind = "SHARED" | "DIRECT";

type B05Surface = {
  readonly id: string;
  readonly kind: SurfaceKind;
  readonly viewports: readonly ViewportClass[];
  readonly expectBlocked?: string;
};

const B05_SURFACES: readonly B05Surface[] = [
  { id: "admin-auditoria", kind: "SHARED", viewports: [VIEWPORT_CLASSES[0]] },
  { id: "admin-tokens", kind: "SHARED", viewports: [VIEWPORT_CLASSES[0]] },
  { id: "admin-informes", kind: "SHARED", viewports: [VIEWPORT_CLASSES[0]] },
  { id: "admin-clinicas", kind: "DIRECT", viewports: VIEWPORT_CLASSES },
  { id: "admin-usuarios", kind: "DIRECT", viewports: VIEWPORT_CLASSES },
  { id: "clinic-informes", kind: "SHARED", viewports: [VIEWPORT_CLASSES[0]] },
  {
    id: "clinic-tokens",
    kind: "SHARED",
    viewports: [VIEWPORT_CLASSES[0]],
    expectBlocked:
      "the hermetic fixture server (admin-populated-api-server.mjs) implements no handler for /api/particular-tokens; ClinicParticularTokensCard only mounts its FilterBar when tokens.length > 0, so the field never renders under this fixture",
  },
];

function findGeometrySurface(id: string): DashboardGeometrySurface {
  const surface = DASHBOARD_GEOMETRY_SURFACES.find((entry) => entry.id === id);
  if (!surface) {
    throw new Error(
      `${id}: not found in DASHBOARD_GEOMETRY_SURFACES — the B04/A02 owner and this B05 manifest must name the same surfaces`,
    );
  }
  return surface;
}

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

type ColorReading = {
  readonly fieldColor: string;
  readonly containerColor: string;
};

/**
 * Reads the resolved `background-color` of one visible field and the nearest
 * ancestor that is really its B05 container — not just its immediate DOM
 * parent, which for the DIRECT surfaces is a plain positioning wrapper that
 * was never tinted. Walking up to the first ancestor whose className still
 * contains `border-b` finds the actual band whose fill B05 removed; SHARED
 * surfaces instead walk to the `[data-dashboard-filter-bar="true"]` anchor
 * directly, since that anchor IS the container.
 */
async function readFieldAndContainer(
  page: Page,
  kind: SurfaceKind,
): Promise<ColorReading | null> {
  return page.evaluate((surfaceKind: SurfaceKind) => {
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

    const fieldSelector =
      surfaceKind === "SHARED"
        ? '[data-dashboard-filter-bar="true"] input, [data-dashboard-filter-bar="true"] select'
        : '[data-dashboard-filter-field="true"]';

    const field = Array.from(document.querySelectorAll(fieldSelector)).find(
      (element) => isVisible(element),
    );
    if (!field) return null;

    let container: Element | null;
    if (surfaceKind === "SHARED") {
      container = field.closest('[data-dashboard-filter-bar="true"]');
    } else {
      container = field.parentElement;
      let probe: Element | null = field.parentElement;
      let depth = 0;
      while (probe && depth < 6) {
        if (
          probe instanceof HTMLElement &&
          probe.className.includes("border-b")
        ) {
          container = probe;
          break;
        }
        probe = probe.parentElement;
        depth += 1;
      }
    }
    if (!container) return null;

    return {
      fieldColor: window.getComputedStyle(field).backgroundColor,
      containerColor: window.getComputedStyle(container).backgroundColor,
    };
  }, kind);
}

/** `rgb(r, g, b)` has an implicit alpha of 1; only `rgba(...)` carries one. */
function alphaOf(color: string): number {
  const match = /rgba?\(([^)]+)\)/.exec(color.trim());
  if (!match) return color.trim() === "transparent" ? 0 : 1;
  const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  return parts.length === 4 ? parts[3] : 1;
}

test.beforeAll(() => {
  expect(B05_SURFACES.length, "B05 surface cardinality").toBe(7);
  for (const surface of B05_SURFACES) {
    findGeometrySurface(surface.id);
  }
});

test.describe("B05 · field tinted, container transparent, both themes", () => {
  for (const b05Surface of B05_SURFACES) {
    test(`${b05Surface.id} inverts its filter-field surface relationship`, async ({
      browser,
    }, testInfo) => {
      test.setTimeout(180_000);

      const geometrySurface = findGeometrySurface(b05Surface.id);
      const readings: Array<{
        theme: ThemeMode;
        viewport: string;
        fieldColor: string;
        containerColor: string;
      }> = [];
      const byTheme = new Map<ThemeMode, string[]>();

      for (const theme of THEMES) {
        for (const viewport of b05Surface.viewports) {
          const label = `${b05Surface.id} @ ${theme} @ ${viewport.slug}`;

          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            reducedMotion: "reduce",
            colorScheme: "light",
          });

          try {
            const cookie = DASHBOARD_GEOMETRY_SESSION_COOKIE[geometrySurface.role];
            await context.addCookies([
              { name: cookie.name, value: cookie.value, url: APP_ORIGIN },
            ]);

            const page = await context.newPage();
            await suppressNextDevChrome(page);
            await clearDashboardModuleMemory(page);
            await installTheme(page, theme);
            await installSurfaceMocks(page, geometrySurface);

            await page.goto(geometrySurface.route);

            await expect(
              page.locator(geometrySurface.readinessSelector).first(),
              `${label}: readiness`,
            ).toBeVisible({ timeout: 25_000 });

            await expect(
              page.locator("html"),
              `${label}: theme applied pre-paint`,
            ).toHaveAttribute("data-theme", theme, { timeout: 10_000 });

            await page.waitForLoadState("networkidle", { timeout: 20_000 });
            await assertSurfaceLoaded(page, geometrySurface, label);
            await waitForLayoutSettled(page);

            let reading: ColorReading | null = null;
            try {
              await expect
                .poll(
                  async () => {
                    reading = await readFieldAndContainer(page, b05Surface.kind);
                    return reading !== null;
                  },
                  { timeout: 5_000 },
                )
                .toBe(true);
            } catch {
              reading = null;
            }

            if (!reading) {
              if (b05Surface.expectBlocked) {
                await context.close();
                test.skip(
                  true,
                  `BLOCKED — ${b05Surface.id}: ${b05Surface.expectBlocked}`,
                );
                return;
              }
              throw new Error(
                `${label}: no visible filter field found — expected the B05 field anchor to render`,
              );
            }

            const { fieldColor, containerColor } = reading;
            readings.push({ theme, viewport: viewport.slug, fieldColor, containerColor });
            byTheme.set(theme, [...(byTheme.get(theme) ?? []), fieldColor]);
          } finally {
            await context.close();
          }
        }
      }

      await testInfo.attach(`b05-field-inversion-${b05Surface.id}.json`, {
        contentType: "application/json",
        body: JSON.stringify({ surfaceId: b05Surface.id, readings }, null, 2),
      });

      for (const { theme, viewport, fieldColor, containerColor } of readings) {
        const label = `${b05Surface.id} @ ${theme} @ ${viewport}`;

        expect(alphaOf(containerColor), `${label}: container must be transparent (got ${containerColor})`).toBe(0);
        expect(
          alphaOf(fieldColor),
          `${label}: field must not be transparent (got ${fieldColor})`,
        ).toBeGreaterThan(0);
        expect(
          fieldColor,
          `${label}: field and container resolved to the same colour — the tint is not distinguishable from its surroundings`,
        ).not.toBe(containerColor);
      }

      const normalColors = new Set(byTheme.get(NORMAL_THEME_MODE) ?? []);
      const darkColors = new Set(byTheme.get(DARK_GRAY_THEME_MODE) ?? []);
      if (normalColors.size > 0 && darkColors.size > 0) {
        const overlap = [...normalColors].some((color) => darkColors.has(color));
        expect(
          overlap,
          `${b05Surface.id}: the field's resolved colour is identical in both themes (${[...normalColors].join(", ")} vs ${[...darkColors].join(", ")}) — --dash-color-field is a THEME_VARIANT token and must resolve differently per theme`,
        ).toBe(false);
      }
    });
  }
});
