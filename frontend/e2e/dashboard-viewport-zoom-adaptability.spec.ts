import { expect, test } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Global Viewport-aware Adaptive App Shell contract for BOTH dashboards.
//
// Governing implementation: docs/implementation/dashboard-global-viewport-zoom-adaptability.md
// Builds on PR-A/#1014 (main never an operational scroll container) and
// #1015 (global masked master-detail). This spec proves the *density* layer:
//
//   1. No global scroll (html/body/main) across the real screen-size matrix AND
//      the "effective viewport" sizes produced by browser zoom (a 1920×1080 panel
//      at high zoom behaves like ~1280×720 / 1536×864 of CSS pixels).
//   2. The density tokens actually ADAPT: page padding + master/detail panel floor
//      shrink as the effective viewport height shrinks (so the layout fits at 100%
//      zoom without the user dropping Chrome to 50%).
//
// The e2e server runs with NEXT_PUBLIC_API_URL="" so modules render their
// degraded/empty frame; the adaptive composition must still hold without scroll.
// ─────────────────────────────────────────────────────────────────────────────

type Page = import("@playwright/test").Page;

const TOLERANCE = 2;

// Real desktop sizes + effective-viewport approximations of browser zoom.
const ALL_VIEWPORTS = [
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "desktop-1600x900", width: 1600, height: 900 },
  { name: "zoom-eff-1536x864", width: 1536, height: 864 },
  { name: "laptop-1366x768", width: 1366, height: 768 },
  { name: "zoom-eff-1280x720", width: 1280, height: 720 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

// The most demanding sizes (low effective height) used for the extra surfaces.
const DEMANDING_VIEWPORTS = ALL_VIEWPORTS.filter((v) =>
  ["laptop-1366x768", "zoom-eff-1280x720", "mobile-390x844"].includes(v.name),
);

// Desktop + effective-zoom sizes (≥1024px wide). This is the matrix that maps to
// the user's real "100% zoom on a laptop/desktop" complaint. Strict no-scroll on
// the shell + in-shell modules is asserted at EVERY viewport (incl. tablet/mobile)
// below; the full-page deep-link routes (the "complete page" twins of the in-shell
// modules) are asserted across this desktop/zoom matrix, while their strict
// mobile no-scroll guarantee is delivered by the in-shell `?module=…` surfaces.
const DESKTOP_ZOOM_VIEWPORTS = ALL_VIEWPORTS.filter((v) => v.width >= 1024);

type Surface = "clinic" | "admin";

type SurfaceCase = {
  label: string;
  surface: Surface;
  path: string;
  /** Selector that must be visible once the surface is ready. */
  ready: string;
  /** Whether the clinic Tokens API must be mocked for this surface. */
  mockTokens?: boolean;
};

const CORE_SURFACES: SurfaceCase[] = [
  {
    label: "clinic hub (cockpit)",
    surface: "clinic",
    path: "/dashboard",
    ready: "main.dashboard-main",
  },
  {
    label: "clinic Informes (in-shell master-detail)",
    surface: "clinic",
    path: "/dashboard?module=informes",
    ready: '[data-dashboard-module-workspace="informes"]',
  },
  {
    label: "clinic Tokens particulares (master-detail + dialog)",
    surface: "clinic",
    path: "/dashboard?module=tokens",
    ready: '[data-dashboard-module-workspace="tokens"]',
    mockTokens: true,
  },
  {
    label: "admin hub (launcher)",
    surface: "admin",
    path: "/dashboard/admin",
    ready: "main.dashboard-main",
  },
  {
    label: "admin Resumen/Alertas (tabs)",
    surface: "admin",
    path: "/dashboard/admin?module=admin",
    ready: '[data-dashboard-module-workspace="admin"]',
  },
];

const EXTRA_SURFACES: SurfaceCase[] = [
  {
    label: "clinic Logística (in-shell master-detail)",
    surface: "clinic",
    path: "/dashboard?module=logistica",
    ready: '[data-dashboard-module-workspace="logistica"]',
  },
  {
    label: "admin Mantenimiento (tabs)",
    surface: "admin",
    path: "/dashboard/admin?module=admin-maintenance",
    ready: '[data-dashboard-module-workspace="admin-maintenance"]',
  },
  {
    label: "admin Roles clínica",
    surface: "admin",
    path: "/dashboard/admin?module=admin-users-roles",
    ready: '[data-dashboard-module-workspace="admin-users-roles"]',
  },
];

// Full-page deep-link routes ("complete page" twins of the in-shell modules).
// Validated across the desktop + effective-zoom matrix.
const FULL_PAGE_DEEPLINKS: SurfaceCase[] = [
  {
    label: "clinic Informes full route",
    surface: "clinic",
    path: "/dashboard/informes",
    ready: "main.dashboard-main",
  },
  {
    label: "clinic Logística full route",
    surface: "clinic",
    path: "/dashboard/logistica",
    ready: "main.dashboard-main",
  },
];

const MOCK_TOKENS = Array.from({ length: 6 }, (_, index) => {
  const id = index + 1;
  return {
    id,
    clinicId: 10,
    reportId: id % 2 === 0 ? 200 + id : null,
    tokenLast4: String(9000 + id).slice(-4),
    tutorLastName: `Tutor ${id}`,
    petName: `Paciente ${id}`,
    petAge: `${id + 1} años`,
    petBreed: "Mestizo",
    petSex: id % 2 === 0 ? "Hembra" : "Macho",
    petSpecies: id % 2 === 0 ? "Felinos" : "Caninos",
    sampleLocation: "Piel",
    sampleEvolution: "Subaguda",
    detailsLesion: "Lesión nodular compatible con seguimiento.",
    extractionDate: "2026-06-01T00:00:00.000Z",
    shippingDate: "2026-06-02T00:00:00.000Z",
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
    createdByAdminId: null,
    createdByClinicUserId: 77,
    hasLinkedReport: id % 2 === 0,
  };
});

async function mockClinicTokens(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/particular-tokens",
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          count: MOCK_TOKENS.length,
          particularTokens: MOCK_TOKENS,
          pagination: { limit: 10, offset: 0 },
          filters: { clinicId: null },
        }),
      }),
  );
}

async function applySession(page: Page, surface: Surface) {
  await page.context().addCookies([
    {
      name: surface === "clinic" ? "app_session_id" : "admin_session_id",
      value: surface === "clinic" ? "e2e_test_clinic_session" : "e2e_test_admin_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

type ScrollContract = {
  htmlScrollHeight: number;
  htmlClientHeight: number;
  bodyScrollHeight: number;
  bodyClientHeight: number;
  mainScrollHeight: number;
  mainClientHeight: number;
  mainOverflowY: string;
  hasMain: boolean;
  navVisible: boolean;
  topbarVisible: boolean;
};

async function readScrollContract(page: Page): Promise<ScrollContract> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector("main.dashboard-main") as HTMLElement | null;
    const nav = document.querySelector('[aria-label="Navegación principal"]');
    const topbar = document.querySelector('[aria-label="Barra superior del dashboard"]');

    const isVisible = (el: Element | null) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    return {
      htmlScrollHeight: html.scrollHeight,
      htmlClientHeight: html.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientHeight: body.clientHeight,
      mainScrollHeight: main?.scrollHeight ?? 0,
      mainClientHeight: main?.clientHeight ?? 0,
      mainOverflowY: main ? window.getComputedStyle(main).overflowY : "none",
      hasMain: main !== null,
      navVisible: isVisible(nav),
      topbarVisible: isVisible(topbar),
    };
  });
}

function assertAdaptiveNoScroll(
  metrics: ScrollContract,
  label: string,
  width: number,
) {
  expect(metrics.hasMain, `${label}: main.dashboard-main present`).toBe(true);

  expect(
    metrics.mainOverflowY,
    `${label}: main must not be a scroll container (overflow-y=${metrics.mainOverflowY})`,
  ).not.toBe("auto");
  expect(metrics.mainOverflowY, `${label}: main overflow not scroll`).not.toBe(
    "scroll",
  );

  expect(
    metrics.mainScrollHeight,
    `${label}: main scrolled (${metrics.mainScrollHeight} > ${metrics.mainClientHeight})`,
  ).toBeLessThanOrEqual(metrics.mainClientHeight + TOLERANCE);
  expect(
    metrics.bodyScrollHeight,
    `${label}: body scrolled (${metrics.bodyScrollHeight} > ${metrics.bodyClientHeight})`,
  ).toBeLessThanOrEqual(metrics.bodyClientHeight + TOLERANCE);
  expect(
    metrics.htmlScrollHeight,
    `${label}: documentElement scrolled (${metrics.htmlScrollHeight} > ${metrics.htmlClientHeight})`,
  ).toBeLessThanOrEqual(metrics.htmlClientHeight + TOLERANCE);

  // Critical chrome must stay visible (no collapse) on desktop widths.
  if (width >= 1024) {
    expect(metrics.navVisible, `${label}: sidebar nav visible`).toBe(true);
    expect(metrics.topbarVisible, `${label}: dashboard header visible`).toBe(true);
  }
}

async function gotoSurface(page: Page, surface: SurfaceCase) {
  await applySession(page, surface.surface);
  if (surface.mockTokens) {
    await mockClinicTokens(page);
  }
  await page.goto(surface.path);
  await expect(page.locator(surface.ready).first()).toBeVisible({
    timeout: 15_000,
  });
}

for (const viewport of ALL_VIEWPORTS) {
  test.describe(`adaptive app shell — ${viewport.name}`, () => {
    for (const surface of CORE_SURFACES) {
      test(`${surface.label} fits without global scroll`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoSurface(page, surface);

        await expect(async () => {
          const metrics = await readScrollContract(page);
          assertAdaptiveNoScroll(
            metrics,
            `${viewport.name} ${surface.label}`,
            viewport.width,
          );
        }).toPass({ timeout: 10_000 });
      });
    }
  });
}

for (const viewport of DEMANDING_VIEWPORTS) {
  test.describe(`adaptive app shell extras — ${viewport.name}`, () => {
    for (const surface of EXTRA_SURFACES) {
      test(`${surface.label} fits without global scroll`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoSurface(page, surface);

        await expect(async () => {
          const metrics = await readScrollContract(page);
          assertAdaptiveNoScroll(
            metrics,
            `${viewport.name} ${surface.label}`,
            viewport.width,
          );
        }).toPass({ timeout: 10_000 });
      });
    }
  });
}

for (const viewport of DESKTOP_ZOOM_VIEWPORTS) {
  test.describe(`full-page deep-link routes — ${viewport.name}`, () => {
    for (const surface of FULL_PAGE_DEEPLINKS) {
      test(`${surface.label} fits without global scroll`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoSurface(page, surface);

        await expect(async () => {
          const metrics = await readScrollContract(page);
          assertAdaptiveNoScroll(
            metrics,
            `${viewport.name} ${surface.label}`,
            viewport.width,
          );
        }).toPass({ timeout: 10_000 });
      });
    }
  });
}

// ── Adaptability proof ───────────────────────────────────────────────────────
// The whole point: the same surface must get DENSER as the effective viewport
// height shrinks (which is exactly what browser zoom produces). We measure real
// computed values (clamp() resolves to px) at a tall vs a short viewport.

async function readMainPaddingBottom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const main = document.querySelector("main.dashboard-main");
    if (!main) return -1;
    return parseFloat(window.getComputedStyle(main).paddingBottom);
  });
}

test("clinic page padding compacts as the effective viewport height shrinks", async ({
  page,
}) => {
  await applySession(page, "clinic");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/dashboard");
  await expect(page.locator("main.dashboard-main")).toBeVisible({ timeout: 15_000 });
  const tallPadding = await readMainPaddingBottom(page);

  await page.setViewportSize({ width: 1280, height: 700 });
  await expect(async () => {
    const shortPadding = await readMainPaddingBottom(page);
    expect(
      shortPadding,
      `compact page padding (${shortPadding}px) < tall padding (${tallPadding}px)`,
    ).toBeLessThan(tallPadding);
    expect(shortPadding).toBeGreaterThan(0);
  }).toPass({ timeout: 5_000 });
});
test("master/detail panel floor compacts as the effective viewport height shrinks", async ({
  page,
}) => {
  await applySession(page, "clinic");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/dashboard/informes");
  const panel = page.locator(".dashboard-master-panel, .dashboard-detail-panel").first();
  await expect(panel).toBeVisible({ timeout: 15_000 });

  const readPanelMinHeight = () =>
    panel.evaluate((el) => parseFloat(window.getComputedStyle(el).minHeight));

  const tallMin = await readPanelMinHeight();

  await page.setViewportSize({ width: 1280, height: 700 });
  await expect(async () => {
    const shortMin = await readPanelMinHeight();
    expect(
      shortMin,
      `compact panel min-height (${shortMin}px) < tall min-height (${tallMin}px)`,
    ).toBeLessThan(tallMin);
  }).toPass({ timeout: 5_000 });
});
