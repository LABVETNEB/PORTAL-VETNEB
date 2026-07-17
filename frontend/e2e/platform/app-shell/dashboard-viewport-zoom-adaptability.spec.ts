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
type Locator = import("@playwright/test").Locator;

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
    label: "clinic operaciones (default, no hub)",
    surface: "clinic",
    path: "/dashboard",
    ready: '[data-dashboard-module-workspace="operaciones"]',
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

const MOCK_TOKENS = Array.from({ length: 10 }, (_, index) => {
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

async function mockParticularLoggedOut(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/particular/auth/me",
    async (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: "Particular no autenticado",
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

type InternalScrollContract = {
  selector: string | null;
  overflowY: number;
};

type TokensRegionContract = {
  bodyPresent: boolean;
  bodyClientHeight: number;
  bodyScrollHeight: number;
  bodyOverflowY: string;
  footerPresent: boolean;
  footerTop: number;
  visibleRowCount: number;
  maxRowHeight: number;
  lastRowBottom: number;
  rowsInsideBody: boolean;
};

type PublicParticularContract = {
  htmlScrollWidth: number;
  htmlClientWidth: number;
  bodyScrollWidth: number;
  bodyClientWidth: number;
  primaryPresent: boolean;
  primaryTop: number;
  primaryBottom: number;
  primaryHeight: number;
  viewportHeight: number;
  primaryOverflowY: number;
  tokenInputPresent: boolean;
  submitPresent: boolean;
  nextStepPresent: boolean;
};

type ViewportContainmentContract = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

async function readScrollContract(page: Page): Promise<ScrollContract> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector("main.dashboard-main") as HTMLElement | null;
    // Primary dashboard navigation: the admin surface keeps the horizontal nav,
    // while the clinic surface uses the single shared module rail. Either one
    // satisfies the "primary navigation stays visible" contract.
    const nav = document.querySelector(
      '[aria-label="Navegación principal"], [data-dashboard-module-rail="true"]',
    );
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

async function readWorstInternalVerticalScroll(
  page: Page,
): Promise<InternalScrollContract> {
  return page.evaluate(() => {
    const main = document.querySelector("main.dashboard-main");
    const worst = {
      selector: null as string | null,
      overflowY: 0,
    };

    const describeElement = (element: HTMLElement) => {
      const className =
        typeof element.className === "string"
          ? element.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".")
          : "";
      return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
        className ? `.${className}` : ""
      }`;
    };

    // VIS-MOBILE-001: `.dashboard-module-body` inside the clinic operaciones
    // or perfil mobile modules is a deliberate, single, reachable scroll
    // owner (their real content can exceed the flex-allocated body height at
    // low-height mobile portrait). It is intentionally exempt from this
    // "zero internal scroll" scan; every other element in `main` still must
    // not introduce its own scroll container.
    const isSanctionedScrollOwner = (element: HTMLElement) =>
      element.classList.contains("dashboard-module-body") &&
      (element.closest('[data-clinic-mobile-module="operaciones"]') !== null ||
        element.closest('[data-clinic-mobile-module="perfil"]') !== null);

    main?.querySelectorAll<HTMLElement>("*").forEach((element) => {
      if (isSanctionedScrollOwner(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      if (style.overflowY !== "auto" && style.overflowY !== "scroll") {
        return;
      }

      const overflowY = element.scrollHeight - element.clientHeight;
      if (overflowY > worst.overflowY) {
        worst.selector = describeElement(element);
        worst.overflowY = overflowY;
      }
    });

    return worst;
  });
}

function assertNoMeasuredInternalVerticalScroll(
  metrics: InternalScrollContract,
  label: string,
) {
  expect(
    metrics.overflowY,
    `${label}: internal vertical scroll on ${metrics.selector ?? "none"}`,
  ).toBeLessThanOrEqual(TOLERANCE);
}

async function readVisibleCount(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluateAll((elements) =>
    elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length,
  );
}

async function waitForSettledVisibleCount(
  page: Page,
  selector: string,
  label: string,
): Promise<number> {
  let previousCount = -1;
  let stableReads = 0;

  await expect(async () => {
    const currentCount = await readVisibleCount(page, selector);
    if (currentCount === previousCount) {
      stableReads += 1;
    } else {
      previousCount = currentCount;
      stableReads = 0;
    }

    expect(
      stableReads,
      `${label}: visible count must settle (currently ${currentCount})`,
    ).toBeGreaterThanOrEqual(3);
  }).toPass({ timeout: 8_000, intervals: [50] });

  return previousCount;
}

async function readTokensRegionContract(page: Page): Promise<TokensRegionContract> {
  return page.evaluate(() => {
    const tolerance = 2;
    const body = document.querySelector<HTMLElement>(
      '[data-clinic-access-list-body="true"]',
    );
    const footer = document.querySelector<HTMLElement>(
      '[data-clinic-access-pagination-footer="true"]',
    );
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          '[data-clinic-access-table-row="true"]',
          '[data-clinic-access-mobile-row="true"]',
        ].join(","),
      ),
    )
      .map((row) => row.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    const bodyRect = body?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const maxRowHeight = rows.reduce(
      (maxHeight, rect) => Math.max(maxHeight, rect.height),
      0,
    );
    const lastRow = rows.at(-1);

    return {
      bodyPresent: body !== null,
      bodyClientHeight: body?.clientHeight ?? 0,
      bodyScrollHeight: body?.scrollHeight ?? 0,
      bodyOverflowY: body ? window.getComputedStyle(body).overflowY : "missing",
      footerPresent: footer !== null && Boolean(footerRect?.width && footerRect.height),
      footerTop: footerRect?.top ?? 0,
      visibleRowCount: rows.length,
      maxRowHeight,
      lastRowBottom: lastRow?.bottom ?? 0,
      rowsInsideBody:
        Boolean(bodyRect) &&
        rows.every(
          (rect) =>
            rect.top >= bodyRect!.top - tolerance &&
            rect.bottom <= bodyRect!.bottom + tolerance,
        ),
    };
  });
}

function assertTokensRegionContract(
  metrics: TokensRegionContract,
  label: string,
) {
  expect(metrics.bodyPresent, `${label}: tokens list body present`).toBe(true);
  expect(metrics.footerPresent, `${label}: tokens pager/footer visible`).toBe(true);
  expect(metrics.visibleRowCount, `${label}: visible token rows/cards`).toBeGreaterThan(0);
  expect(
    metrics.visibleRowCount,
    `${label}: visible rows/cards bounded by fixture dataset`,
  ).toBeLessThanOrEqual(MOCK_TOKENS.length);
  expect(
    metrics.bodyScrollHeight,
    `${label}: tokens body must not clip hidden overflow`,
  ).toBeLessThanOrEqual(metrics.bodyClientHeight + TOLERANCE);
  expect(
    ["auto", "scroll"],
    `${label}: tokens body must not expose vertical scroll`,
  ).not.toContain(metrics.bodyOverflowY);
  expect(metrics.rowsInsideBody, `${label}: token rows/cards inside body`).toBe(true);

  if (metrics.visibleRowCount < MOCK_TOKENS.length) {
    const gap = metrics.footerTop - metrics.lastRowBottom;
    expect(gap, `${label}: list-to-footer gap must not overlap`).toBeGreaterThanOrEqual(
      -TOLERANCE,
    );
    expect(gap, `${label}: list-to-footer gap controlled`).toBeLessThanOrEqual(
      Math.max(metrics.maxRowHeight + 24, 72),
    );
  }
}

async function expectInsideViewport(locator: Locator, label: string) {
  await expect(locator, `${label}: visible`).toBeVisible();
  await expect(locator, `${label}: inside viewport`).toBeInViewport();
}

async function readViewportContainmentContract(
  locator: Locator,
): Promise<ViewportContainmentContract> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
}

function assertContainedInViewport(
  metrics: ViewportContainmentContract,
  label: string,
) {
  expect(metrics.width, `${label}: panel width`).toBeGreaterThan(0);
  expect(metrics.height, `${label}: panel height`).toBeGreaterThan(0);
  expect(metrics.top, `${label}: panel top in viewport`).toBeGreaterThanOrEqual(
    -TOLERANCE,
  );
  expect(metrics.left, `${label}: panel left in viewport`).toBeGreaterThanOrEqual(
    -TOLERANCE,
  );
  expect(
    metrics.right,
    `${label}: panel right in viewport`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + TOLERANCE);
  expect(
    metrics.bottom,
    `${label}: panel bottom in viewport`,
  ).toBeLessThanOrEqual(metrics.viewportHeight + TOLERANCE);
}

async function readPublicParticularContract(
  page: Page,
): Promise<PublicParticularContract> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const primary = document.querySelector<HTMLElement>(
      '[data-particulares-primary-action="true"]',
    );
    const tokenInput = document.querySelector<HTMLElement>("#particular-token");
    const submit = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Ingresar",
    );
    const nextStep = document.querySelector<HTMLElement>(
      '[data-particulares-next-step-zone="true"]',
    );
    const primaryRect = primary?.getBoundingClientRect();

    return {
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      primaryPresent: primary !== null,
      primaryTop: primaryRect?.top ?? 0,
      primaryBottom: primaryRect?.bottom ?? 0,
      primaryHeight: primaryRect?.height ?? 0,
      viewportHeight: window.innerHeight,
      primaryOverflowY: primary ? primary.scrollHeight - primary.clientHeight : 0,
      tokenInputPresent: tokenInput !== null && tokenInput.getBoundingClientRect().height > 0,
      submitPresent: submit !== undefined && submit.getBoundingClientRect().height > 0,
      nextStepPresent: nextStep !== null && nextStep.getBoundingClientRect().height > 0,
    };
  });
}

function assertPublicParticularContract(
  metrics: PublicParticularContract,
  label: string,
) {
  expect(
    metrics.htmlScrollWidth,
    `${label}: documentElement horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.htmlClientWidth + TOLERANCE);
  expect(
    metrics.bodyScrollWidth,
    `${label}: body horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.bodyClientWidth + TOLERANCE);
  expect(metrics.primaryPresent, `${label}: token gate panel present`).toBe(true);
  expect(metrics.tokenInputPresent, `${label}: token input present`).toBe(true);
  expect(metrics.submitPresent, `${label}: submit action present`).toBe(true);
  expect(metrics.nextStepPresent, `${label}: next step state present`).toBe(true);
  expect(
    metrics.primaryOverflowY,
    `${label}: token gate panel internal vertical overflow`,
  ).toBeLessThanOrEqual(TOLERANCE);
  expect(metrics.primaryTop, `${label}: token gate top inside viewport`).toBeGreaterThanOrEqual(
    -TOLERANCE,
  );
  expect(
    metrics.primaryBottom,
    `${label}: token gate bottom stays within controlled first-viewport fold`,
  ).toBeLessThanOrEqual(metrics.viewportHeight + 48);
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
          const internalScroll = await readWorstInternalVerticalScroll(page);
          assertNoMeasuredInternalVerticalScroll(
            internalScroll,
            `${viewport.name} ${surface.label}`,
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
          const internalScroll = await readWorstInternalVerticalScroll(page);
          assertNoMeasuredInternalVerticalScroll(
            internalScroll,
            `${viewport.name} ${surface.label}`,
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
          const internalScroll = await readWorstInternalVerticalScroll(page);
          assertNoMeasuredInternalVerticalScroll(
            internalScroll,
            `${viewport.name} ${surface.label}`,
          );
        }).toPass({ timeout: 10_000 });
      });
    }
  });
}

test("clinic Tokens adaptive rows baseline changes density without internal scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await gotoSurface(page, {
    label: "clinic Tokens particulares",
    surface: "clinic",
    path: "/dashboard?module=tokens",
    ready: '[data-dashboard-module-workspace="tokens"]',
    mockTokens: true,
  });

  const rowSelector = [
    '[data-clinic-access-table-row="true"]',
    '[data-clinic-access-mobile-row="true"]',
  ].join(",");
  const tallCount = await waitForSettledVisibleCount(
    page,
    rowSelector,
    "clinic Tokens tall viewport",
  );
  await expect(async () => {
    const metrics = await readTokensRegionContract(page);
    assertTokensRegionContract(metrics, "clinic Tokens tall viewport");
  }).toPass({ timeout: 10_000 });

  await page.setViewportSize({ width: 1280, height: 700 });
  const compactCount = await waitForSettledVisibleCount(
    page,
    rowSelector,
    "clinic Tokens compact effective viewport",
  );
  await expect(async () => {
    const metrics = await readTokensRegionContract(page);
    assertTokensRegionContract(metrics, "clinic Tokens compact effective viewport");
  }).toPass({ timeout: 10_000 });

  expect(
    compactCount,
    `compact viewport (${compactCount}) must render fewer token rows/cards than tall viewport (${tallCount})`,
  ).toBeLessThan(tallCount);
});

for (const viewport of DEMANDING_VIEWPORTS) {
  test(`particular token gate baseline fits primary viewport at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockParticularLoggedOut(page);
    await page.goto("/particulares");

    await expectInsideViewport(
      page.locator('[data-particulares-primary-action="true"]'),
      `${viewport.name}: particular token gate panel`,
    );
    await expectInsideViewport(
      page.locator("#particular-token"),
      `${viewport.name}: particular token input`,
    );

    await expect(async () => {
      const metrics = await readPublicParticularContract(page);
      assertPublicParticularContract(metrics, `${viewport.name}: particulares`);
    }).toPass({ timeout: 10_000 });
  });
}

// ── Adaptability proof ───────────────────────────────────────────────────────
// The whole point: the same surface must get DENSER as the effective viewport
// height shrinks (which is exactly what browser zoom produces). We measure real
// computed values (clamp() resolves to px) at a tall vs a short viewport. The
// panel floor may also be removed entirely when zero-scroll density is achieved
// without a min-height constraint.

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
test("master/detail panel floor adapts or remains floorless as the effective viewport height shrinks", async ({
  page,
}) => {
  await applySession(page, "clinic");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/dashboard/informes");
  const panel = page.locator(".dashboard-master-panel, .dashboard-detail-panel").first();
  await expect(panel).toBeVisible({ timeout: 15_000 });

  const readPanelMinHeight = () =>
    panel.evaluate((el) => parseFloat(window.getComputedStyle(el).minHeight));

  await expect(async () => {
    const tallMetrics = await readScrollContract(page);
    assertAdaptiveNoScroll(
      tallMetrics,
      "tall master/detail floor adaptability",
      1920,
    );
    const tallPanel = await readViewportContainmentContract(panel);
    assertContainedInViewport(tallPanel, "tall master/detail floor adaptability");
  }).toPass({ timeout: 10_000 });

  const tallMin = await readPanelMinHeight();

  await page.setViewportSize({ width: 1280, height: 700 });
  await expect(panel).toBeVisible();
  await expect(async () => {
    const compactMetrics = await readScrollContract(page);
    assertAdaptiveNoScroll(
      compactMetrics,
      "compact master/detail floor adaptability",
      1280,
    );
    const compactPanel = await readViewportContainmentContract(panel);
    assertContainedInViewport(
      compactPanel,
      "compact master/detail floor adaptability",
    );

    const shortMin = await readPanelMinHeight();

    if (tallMin > 0) {
      expect(
        shortMin,
        `compact panel min-height (${shortMin}px) < tall min-height (${tallMin}px)`,
      ).toBeLessThan(tallMin);
    } else {
      expect(tallMin, "tall panel min-height is floorless").toBe(0);
      expect(shortMin, "compact panel min-height remains floorless").toBe(0);
    }
  }).toPass({ timeout: 5_000 });
});
