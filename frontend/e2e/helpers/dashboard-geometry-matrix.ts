import { expect, type Page, type Route } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// A02 · Dashboard geometry baseline support (21 surfaces × 13 viewports = 273).
//
// This module owns the canonical surface/viewport matrix, the measurement model
// and the tolerance-aware comparator. It FREEZES the geometry the dashboard has
// today; it is not the target geometry of the audit's §46, it is not the
// zero-scroll contract of A08 and it deliberately measures no limit/offset/page
// size (that is A03).
// ─────────────────────────────────────────────────────────────────────────────

export const DASHBOARD_GEOMETRY_BASELINE_SCHEMA = "a02-geometry-baseline/1";
export const DASHBOARD_GEOMETRY_BASELINE_COMMIT =
  "553d5c7d37058b34fdb75e717675f841b3116942";

export type DashboardGeometryRole = "admin" | "clinic";

export type DashboardGeometryShellType =
  | "admin-hub"
  | "admin-module"
  | "clinic-module"
  | "clinic-full-route";

/**
 * A hermetic, deterministic JSON stub for ONE endpoint of ONE surface.
 *
 * `urlPattern` only narrows which requests reach the handler; `method` and
 * `pathname` are validated inside it, and anything that does not match is
 * handed back with `route.fallback()` so an unexpected request still surfaces
 * as a real (failing) call instead of being silently swallowed.
 */
export type DashboardGeometryMock = {
  readonly urlPattern: string;
  readonly method: "GET" | "POST";
  readonly pathname: string;
  /** Pure function of the request URL — no clock, no randomness, no network. */
  readonly body: (url: URL) => unknown;
};

/**
 * Semantic loaded-state contract. It is asserted AFTER the readiness selector
 * and BEFORE measuring, so a surface can never freeze a 404/empty/loading
 * geometry: at least one loaded marker must be visible, every error/loading
 * marker must be gone. Markers are tied to the mocked payload, so they cannot
 * be satisfied by an error, empty or loading render.
 */
export type DashboardGeometryLoadedState = {
  /** At least one must be visible (desktop and mobile render different trees). */
  readonly anyVisible: readonly string[];
  /** Must resolve to zero VISIBLE elements. */
  readonly forbidden: readonly string[];
};

export type DashboardGeometrySurface = {
  /** Stable id; also the Playwright test title and half of the baseline key. */
  readonly id: string;
  readonly role: DashboardGeometryRole;
  readonly route: string;
  readonly shellType: DashboardGeometryShellType;
  /** Unambiguous readiness selector awaited with `toBeVisible` before measuring. */
  readonly readinessSelector: string;
  /** Workspace / main content root. Every region below is scoped to it. */
  readonly contentRootSelector: string;
  /** Semantics of the first measurable content block for this surface. */
  readonly primaryContentSemantics: string;
  /** Endpoints the shared fixture server does not serve for this surface. */
  readonly mocks?: readonly DashboardGeometryMock[];
  readonly loadedState?: DashboardGeometryLoadedState;
};

/** Synthetic sessions already served by the hermetic fixture API (port 3107). */
export const DASHBOARD_GEOMETRY_SESSION_COOKIE: Readonly<
  Record<DashboardGeometryRole, { readonly name: string; readonly value: string }>
> = Object.freeze({
  admin: { name: "admin_session_id", value: "e2e_populated_admin_session" },
  clinic: { name: "app_session_id", value: "e2e_populated_clinic_session" },
});

// ── Hermetic surface stubs ───────────────────────────────────────────────────
// `frontend/e2e/fixtures/admin-populated-api-server.mjs` (shared, untouched)
// answers 404 for five surfaces' endpoints. Without these stubs A02 would
// freeze the accidental geometry of an error card instead of the operational
// one. Every value below is synthetic and frozen: fixed ISO timestamps (never
// derived from Date.now()), synthetic ids, example.test addresses, no
// credential, no token and no real person or clinic.

const FIXED_CREATED_AT = "2026-01-05T09:00:00.000Z";
const FIXED_UPDATED_AT = "2026-02-10T15:30:00.000Z";
const FIXED_LAST_ACCESS = "2026-02-10T18:45:00.000Z";
const FIXED_EXPIRES_AT = "2026-03-12T15:30:00.000Z";
const GEOMETRY_ADMIN_ACTOR = Object.freeze({
  adminUserId: 9401,
  username: "admin_geometria_e2e",
});

const pad2 = (value: number) => String(value).padStart(2, "0");

function readPagination(url: URL, total: number, fallbackLimit: number) {
  const rawLimit = Number(url.searchParams.get("limit"));
  const rawOffset = Number(url.searchParams.get("offset"));
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, total) : fallbackLimit;
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? Math.min(rawOffset, total) : 0;
  return { limit, offset };
}

/** 60 clinics: deeper than the tallest viewport's adaptive row capacity. */
const GEOMETRY_ADMIN_CLINICS = Array.from({ length: 60 }, (_, index) => {
  const suffix = pad2(index + 1);
  const clinicId = 9001 + index;
  const clinicName = `Clinica Geometria E2E ${suffix}`;

  return {
    clinicId,
    clinicName,
    contactEmail: `clinica-geometria-${suffix}@example.test`,
    contactPhone: "+54 11 4000-0000",
    createdAt: FIXED_CREATED_AT,
    updatedAt: FIXED_UPDATED_AT,
    users: [
      {
        userType: "clinic" as const,
        userId: 9100 + index + 1,
        username: `clinica_geometria_${suffix}`,
        role: index % 2 === 0 ? ("clinic_owner" as const) : ("clinic_staff" as const),
        clinicId,
        clinicName,
        clinicLocality: "Buenos Aires",
        createdAt: FIXED_CREATED_AT,
        updatedAt: FIXED_UPDATED_AT,
      },
    ],
  };
});

const GEOMETRY_ADMIN_SESSION_KINDS = [
  { sessionType: "admin" as const, actorType: "admin_user" as const },
  { sessionType: "clinic" as const, actorType: "clinic_user" as const },
  { sessionType: "particular" as const, actorType: "particular_token" as const },
];

/** 60 sessions, all active, cycling the three real session types. */
const GEOMETRY_ADMIN_SESSIONS = Array.from({ length: 60 }, (_, index) => {
  const kind = GEOMETRY_ADMIN_SESSION_KINDS[index % GEOMETRY_ADMIN_SESSION_KINDS.length];

  return {
    sessionType: kind.sessionType,
    sessionId: 9301 + index,
    actorType: kind.actorType,
    actorId: 9501 + index,
    createdAt: FIXED_CREATED_AT,
    lastAccess: FIXED_LAST_ACCESS,
    expiresAt: FIXED_EXPIRES_AT,
    status: "active" as const,
  };
});

const pricingItems = (categoryOffset: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: categoryOffset + index,
    studyName: `Estudio Geometria E2E ${pad2(index + 1)}`,
    priceLabel: `$ ${24 + index}.500`,
    displayOrder: index + 1,
    isActive: true,
    updatedAt: FIXED_UPDATED_AT,
  }));

const GEOMETRY_ADMIN_PRICING = {
  success: true,
  categories: [
    { category: "Histopatologia E2E", items: pricingItems(9201, 8) },
    { category: "Citologia E2E", items: pricingItems(9301, 6) },
  ],
};

const GEOMETRY_ADMIN_SCHEMA_HEALTH = {
  success: true,
  checkedBy: GEOMETRY_ADMIN_ACTOR,
  status: "ok" as const,
  generatedAt: FIXED_UPDATED_AT,
  summary: {
    requiredTables: 3,
    requiredColumns: 24,
    presentColumns: 24,
    missingColumns: 0,
  },
  tables: ["clinics", "reports", "field_visits"].map((table) => ({
    schema: "public",
    table,
    status: "ok" as const,
    requiredColumns: 8,
    presentColumns: 8,
    missingColumns: 0,
    columns: Array.from({ length: 8 }, (_, index) => ({
      name: `columna_${pad2(index + 1)}`,
      present: true,
    })),
    missingColumnNames: [],
  })),
  missing: [],
};

const GEOMETRY_CLINIC_PROFILE_DISPLAY_NAME = "Clinica Geometria E2E Perfil";

const GEOMETRY_CLINIC_PROFILE = {
  success: true,
  profile: {
    clinicId: 9001,
    clinicName: GEOMETRY_CLINIC_PROFILE_DISPLAY_NAME,
    displayName: GEOMETRY_CLINIC_PROFILE_DISPLAY_NAME,
    avatarUrl: null,
    avatarStoragePath: null,
    aboutText:
      "Perfil institucional sintetico y completo usado para congelar la geometria del modulo Perfil.",
    specialtyText: "Anatomia patologica veterinaria",
    servicesText: "Citologia, histopatologia e inmunohistoquimica diagnostica.",
    email: "perfil-geometria@example.test",
    phone: "+54 11 4000-0000",
    publicAddress: "Avenida Sintetica 1234, Buenos Aires",
    mapLink: "https://example.test/mapa",
    locality: "Buenos Aires",
    country: "Argentina",
    isPublic: true,
    createdAt: FIXED_CREATED_AT,
    updatedAt: FIXED_UPDATED_AT,
    publication: {
      hasRequiredPublicFields: true,
      hasQualitySupplement: true,
      qualityScore: 95,
      minimumQualityScore: 75,
      isSearchEligible: true,
      missingRequiredFields: [],
      missingRecommendedFields: [],
      publicationErrors: [],
    },
  },
  search: {
    clinicId: 9001,
    isPublic: true,
    hasRequiredPublicFields: true,
    isSearchEligible: true,
    profileQualityScore: 95,
    updatedAt: FIXED_UPDATED_AT,
  },
};

/** Error banner shared by every card of the five affected surfaces. */
const CLINICAL_ERROR_ALERT = ".clinical-alert-error";

const adminModule = (
  id: string,
  moduleId: string,
  primaryContentSemantics: string,
  extra: Pick<Partial<DashboardGeometrySurface>, "mocks" | "loadedState"> = {},
): DashboardGeometrySurface => ({
  id,
  role: "admin",
  route: `/dashboard/admin?module=${moduleId}`,
  shellType: "admin-module",
  readinessSelector: `[data-dashboard-module-workspace="${moduleId}"]`,
  contentRootSelector: `[data-dashboard-module-workspace="${moduleId}"]`,
  primaryContentSemantics,
  ...extra,
});

const clinicModule = (
  id: string,
  moduleId: string,
  primaryContentSemantics: string,
  extra: Pick<Partial<DashboardGeometrySurface>, "mocks" | "loadedState"> = {},
): DashboardGeometrySurface => ({
  id,
  role: "clinic",
  route: `/dashboard?module=${moduleId}`,
  shellType: "clinic-module",
  readinessSelector: `[data-dashboard-module-workspace="${moduleId}"]`,
  contentRootSelector: `[data-dashboard-module-workspace="${moduleId}"]`,
  primaryContentSemantics,
  ...extra,
});

const clinicFullRoute = (
  id: string,
  route: string,
  primaryContentSemantics: string,
): DashboardGeometrySurface => ({
  id,
  role: "clinic",
  route,
  shellType: "clinic-full-route",
  readinessSelector: "main.dashboard-main",
  contentRootSelector: "main.dashboard-main",
  primaryContentSemantics,
});

/**
 * The 21 authenticated dashboard surfaces of the audit matrix.
 *
 * `clinic-informes` / `clinic-informes-full` and `clinic-logistica` /
 * `clinic-logistica-full` are NOT collapsed: today they render through
 * different shells (module workspace vs. full route `main`), so they are
 * distinct geometric surfaces.
 */
export const DASHBOARD_GEOMETRY_SURFACES = [
  {
    id: "admin-hub",
    role: "admin",
    route: "/dashboard/admin",
    shellType: "admin-hub",
    readinessSelector: '[data-dashboard-hub-root="true"]',
    contentRootSelector: '[data-dashboard-hub-root="true"]',
    primaryContentSemantics: "first module launcher tile of the admin hub",
  },
  adminModule("admin-resumen", "admin", "first block of the admin overview module"),
  adminModule("admin-informes", "admin-report-upload", "first report workflow block"),
  adminModule("admin-estado", "admin-health", "first system health block"),
  adminModule("admin-clinicas", "admin-clinics", "first clinic management row", {
    mocks: [
      {
        urlPattern: "**/api/admin/clinics**",
        method: "GET",
        pathname: "/api/admin/clinics",
        body: (url) => {
          const total = GEOMETRY_ADMIN_CLINICS.length;
          const { limit, offset } = readPagination(url, total, total);
          return {
            success: true,
            clinics: GEOMETRY_ADMIN_CLINICS.slice(offset, offset + limit),
            total,
            limit,
            offset,
          };
        },
      },
    ],
    loadedState: {
      anyVisible: [`text=${GEOMETRY_ADMIN_CLINICS[0].clinicName}`],
      forbidden: [CLINICAL_ERROR_ALERT, "text=Sin clínicas"],
    },
  }),
  adminModule("admin-tokens", "admin-particular-tokens", "first particular token block"),
  adminModule("admin-precios", "admin-pricing", "first pricing editor block", {
    mocks: [
      {
        urlPattern: "**/api/admin/pricing**",
        method: "GET",
        pathname: "/api/admin/pricing",
        body: () => GEOMETRY_ADMIN_PRICING,
      },
    ],
    loadedState: {
      anyVisible: [`text=${GEOMETRY_ADMIN_PRICING.categories[0].category}`],
      forbidden: [
        CLINICAL_ERROR_ALERT,
        "text=Sin precios configurados",
        "text=Cargando precios",
      ],
    },
  }),
  adminModule("admin-sesiones", "admin-sessions", "first session row", {
    mocks: [
      {
        urlPattern: "**/api/admin/sessions**",
        method: "GET",
        pathname: "/api/admin/sessions",
        body: (url) => {
          const total = GEOMETRY_ADMIN_SESSIONS.length;
          const { limit, offset } = readPagination(url, total, total);
          return {
            success: true,
            sessions: GEOMETRY_ADMIN_SESSIONS.slice(offset, offset + limit),
            total,
            limit,
            offset,
            currentAdminSessionId: GEOMETRY_ADMIN_SESSIONS[0].sessionId,
            checkedBy: GEOMETRY_ADMIN_ACTOR,
          };
        },
      },
    ],
    loadedState: {
      anyVisible: ["[data-admin-sesiones-row]"],
      forbidden: [CLINICAL_ERROR_ALERT, "text=Cargando sesiones"],
    },
  }),
  adminModule("admin-usuarios", "admin-users-roles", "first users/roles block"),
  adminModule("admin-auditoria", "audit-log", "first audit log data row"),
  // The dry-run POST is an explicit operator action (button), never a load, so
  // the representative loaded state of this module is the schema-health panel
  // that both the desktop tab and the mobile pager open first.
  adminModule("admin-mantenimiento", "admin-maintenance", "first maintenance block", {
    mocks: [
      {
        urlPattern: "**/api/admin/system/schema-health**",
        method: "GET",
        pathname: "/api/admin/system/schema-health",
        body: () => GEOMETRY_ADMIN_SCHEMA_HEALTH,
      },
    ],
    loadedState: {
      anyVisible: [`text=${GEOMETRY_ADMIN_ACTOR.username}`],
      forbidden: [CLINICAL_ERROR_ALERT, "text=Consultando estado de esquema"],
    },
  }),
  clinicModule("clinic-operaciones", "operaciones", "first operations block"),
  clinicModule("clinic-informes", "informes", "first reports block of the module shell"),
  clinicModule("clinic-logistica", "logistica", "first logistics block of the module shell"),
  clinicModule("clinic-perfil", "perfil", "first public profile block", {
    mocks: [
      {
        urlPattern: "**/api/clinic/profile**",
        method: "GET",
        pathname: "/api/clinic/profile",
        body: () => GEOMETRY_CLINIC_PROFILE,
      },
    ],
    // "Visible en banco" is rendered only when a profile is loaded AND its
    // publication is search-eligible — exactly the mocked payload. The unloaded
    // branch of the same badge reads "Sin cargar" and is forbidden.
    loadedState: {
      anyVisible: ["text=Visible en banco"],
      forbidden: [
        CLINICAL_ERROR_ALERT,
        "text=Cargando perfil público",
        "text=Sin cargar",
      ],
    },
  }),
  clinicModule("clinic-tokens", "tokens", "first particular token block"),
  clinicFullRoute(
    "clinic-informes-full",
    "/dashboard/informes",
    "first reports block of the full route shell",
  ),
  clinicFullRoute(
    "clinic-logistica-full",
    "/dashboard/logistica",
    "first logistics block of the full route shell",
  ),
  clinicFullRoute(
    "clinic-log-metricas",
    "/dashboard/logistica/metricas",
    "first route-plan metrics block",
  ),
  clinicFullRoute(
    "clinic-log-rutas",
    "/dashboard/logistica/rutas",
    "first route-plan block",
  ),
  clinicFullRoute(
    "clinic-log-visitas",
    "/dashboard/logistica/visitas",
    "first field visit block",
  ),
] as const satisfies readonly DashboardGeometrySurface[];

export type DashboardGeometryViewport = {
  readonly slug: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
};

/** The 13 canonical viewports of the audit matrix. */
export const DASHBOARD_GEOMETRY_VIEWPORTS = [
  { slug: "w1920x1080", name: "Desktop 1920x1080", width: 1920, height: 1080 },
  { slug: "w1600x900", name: "Desktop 1600x900", width: 1600, height: 900 },
  { slug: "w1440x900", name: "Laptop 1440x900", width: 1440, height: 900 },
  { slug: "w1366x768", name: "Laptop 1366x768", width: 1366, height: 768 },
  { slug: "w1280x720", name: "Laptop 1280x720", width: 1280, height: 720 },
  { slug: "w1024x768", name: "Small desktop 1024x768", width: 1024, height: 768 },
  { slug: "w834x1194", name: "Tablet 834x1194", width: 834, height: 1194 },
  { slug: "w768x1024", name: "Tablet 768x1024", width: 768, height: 1024 },
  { slug: "w430x932", name: "Phone 430x932", width: 430, height: 932 },
  { slug: "w412x915", name: "Phone 412x915", width: 412, height: 915 },
  { slug: "w390x844", name: "Phone 390x844", width: 390, height: 844 },
  { slug: "w375x812", name: "Phone 375x812", width: 375, height: 812 },
  { slug: "w360x800", name: "Phone 360x800", width: 360, height: 800 },
] as const satisfies readonly DashboardGeometryViewport[];

export const DASHBOARD_GEOMETRY_SURFACE_COUNT = 21;
export const DASHBOARD_GEOMETRY_VIEWPORT_COUNT = 13;
export const DASHBOARD_GEOMETRY_COMBINATION_COUNT = 273;

export function geometryKey(surfaceId: string, viewportSlug: string): string {
  return `${surfaceId}::${viewportSlug}`;
}

export type Bounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type DashboardGeometryRecord = {
  readonly surfaceId: string;
  readonly viewportSlug: string;
  /** Which ordered candidate resolved the primary content block, or null. */
  readonly primaryContentAnchor: string | null;
  readonly viewport: {
    readonly innerWidth: number;
    readonly innerHeight: number;
    readonly devicePixelRatio: number;
  };
  readonly document: {
    readonly htmlClientWidth: number;
    readonly htmlClientHeight: number;
    readonly htmlScrollWidth: number;
    readonly htmlScrollHeight: number;
    readonly bodyClientWidth: number;
    readonly bodyClientHeight: number;
    readonly bodyScrollWidth: number;
    readonly bodyScrollHeight: number;
  };
  readonly shell: {
    readonly topbar: Bounds | null;
    readonly horizontalNav: Bounds | null;
    readonly moduleRail: Bounds | null;
    readonly bottomNav: Bounds | null;
    readonly main: Bounds | null;
    readonly workspace: Bounds | null;
  };
  readonly regions: {
    readonly moduleHeader: Bounds | null;
    readonly metrics: Bounds | null;
    readonly filters: Bounds | null;
    readonly collection: Bounds | null;
    readonly collectionHeader: Bounds | null;
    readonly primaryContent: Bounds | null;
    readonly pager: Bounds | null;
    readonly sidePanel: Bounds | null;
  };
  readonly derived: {
    readonly chromeBeforePrimaryContentPx: number | null;
    readonly chromeBeforePrimaryContentRatio: number | null;
    readonly workspaceWidth: number | null;
    readonly workspaceHeight: number | null;
    readonly primaryContentWidth: number | null;
    readonly primaryContentHeight: number | null;
    /** First data ROW height; null when the anchor is not a row-like block. */
    readonly primaryBlockHeight: number | null;
    readonly collectionCanvasHeight: number | null;
  };
};

export type DashboardGeometryBaselineFile = {
  readonly schema: string;
  readonly baseCommit: string;
  readonly capturedAt: string;
  readonly environment: {
    /** Capture OS — Linux font rasterization can legitimately differ. */
    readonly platform: string;
    readonly browser: string;
    readonly devicePixelRatio: number;
    readonly zoom: number;
    readonly colorScheme: string;
    readonly reducedMotion: string;
  };
  readonly surfaceCount: number;
  readonly viewportCount: number;
  readonly combinationCount: number;
  readonly records: readonly DashboardGeometryRecord[];
};

// ── Selectors ────────────────────────────────────────────────────────────────
// Every selector below already exists in the runtime. A02 adds no data-*
// attribute and no selector hook to `frontend/src/**`.

const SHELL_SELECTORS = {
  topbar: 'header[data-dashboard-topbar-polish="true"]',
  horizontalNav: "[data-dashboard-horizontal-nav-shell]",
  moduleRail: "[data-dashboard-module-rail]",
  bottomNav: "[data-admin-mobile-bottom-nav], [data-clinic-mobile-bottom-nav]",
  main: "main.dashboard-main",
} as const;

const REGION_SELECTORS = {
  moduleHeader: ".dashboard-workspace-header",
  metrics: "[data-dashboard-metric-strip]",
  filters: "[data-dashboard-filter-bar]",
  collection:
    "[data-dashboard-table-surface], [data-dashboard-table-canvas], [data-informes-rows-canvas], [data-logistics-recent-list-canvas], [data-logistics-mobile-list], table",
  pager:
    '[data-dashboard-pager]:not([data-dashboard-pager="module"]), [data-dashboard-compact-pager]',
  sidePanel:
    "[data-informes-detail-sections], [data-informes-selected-report-summary], aside",
} as const;

/**
 * Primary-content resolution, in two ordered passes:
 *
 * 1. When the surface renders a collection, the primary content is its FIRST
 *    DATA ROW (`collection:<selector>` anchors).
 * 2. Otherwise it is the first measurable content block of the workspace
 *    (`content:<selector>` anchors), skipping the workspace header chrome by
 *    preferring the module viewport over the workspace root.
 *
 * The resolved anchor string is frozen in the baseline, so a surface silently
 * losing its collection — and falling back to a generic block — fails.
 */
const COLLECTION_ROW_CANDIDATES = [
  "tbody > tr",
  "[data-logistics-mobile-row]",
  '[role="row"]',
  ":scope > *",
] as const;

const CONTENT_BLOCK_CANDIDATES = [
  "[data-dashboard-module-card]",
  "[data-dashboard-metric-strip]",
  "[data-dashboard-module-surface]",
  "[data-dashboard-module-viewport] > *",
  ":scope > *",
] as const;

export async function suppressNextDevChrome(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const inject = () => {
      const style = document.createElement("style");
      style.textContent =
        "#nextjs-portal,nextjs-portal,[data-nextjs-toast],[data-nextjs-toast-wrapper],.__next-dev-overlay{display:none !important;opacity:0 !important;pointer-events:none !important;}";
      document.documentElement.appendChild(style);
    };
    if (document.documentElement) inject();
    else document.addEventListener("DOMContentLoaded", inject, { once: true });
  });
}

/** Keeps the last-module restore effects out of the measured navigation. */
export async function clearDashboardModuleMemory(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem("vetneb:dashboard:last-module:clinic");
      window.localStorage.removeItem("vetneb:dashboard:last-module:admin");
    } catch {
      /* localStorage unavailable: nothing to clear */
    }
  });
}

/**
 * Installs only the stubs the surface actually needs. Method and pathname are
 * validated inside the handler: a request that does not match is passed on with
 * `route.fallback()`, so no wildcard ever hides an unexpected call.
 */
export async function installSurfaceMocks(
  page: Page,
  surface: DashboardGeometrySurface,
): Promise<void> {
  for (const mock of surface.mocks ?? []) {
    await page.route(mock.urlPattern, async (route: Route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() !== mock.method || url.pathname !== mock.pathname) {
        return route.fallback();
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify(mock.body(url)),
      });
    });
  }
}

/**
 * Asserts the surface reached its representative LOADED state before the
 * geometry is read. Fails explicitly if an error/loading banner is back, which
 * is exactly what a regressed or un-stubbed 404 looks like.
 */
export async function assertSurfaceLoaded(
  page: Page,
  surface: DashboardGeometrySurface,
  label: string,
): Promise<void> {
  const loadedState = surface.loadedState;
  if (!loadedState) return;

  await expect(async () => {
    let visibleMarkers = 0;
    for (const selector of loadedState.anyVisible) {
      visibleMarkers += await page.locator(`${selector} >> visible=true`).count();
    }
    expect(visibleMarkers, `${label}: loaded marker`).toBeGreaterThan(0);
  }).toPass({ timeout: 25_000 });

  for (const selector of loadedState.forbidden) {
    await expect(
      page.locator(`${selector} >> visible=true`),
      `${label}: forbidden error/loading marker ${selector}`,
    ).toHaveCount(0);
  }
}

/** Waits for fonts and two committed frames — no timeout-based readiness. */
export async function waitForLayoutSettled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      document.fonts.ready.then(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      ),
  );
}

type RawGeometry = Omit<DashboardGeometryRecord, "surfaceId" | "viewportSlug">;

async function evaluateGeometry(
  page: Page,
  surface: DashboardGeometrySurface,
): Promise<RawGeometry> {
  return page.evaluate(
    ({ contentRootSelector, shellSelectors, regionSelectors, rowCandidates, blockCandidates }) => {
      const round = (value: number) => Math.round(value * 100) / 100;

      const isVisible = (element: Element): boolean => {
        const candidate = element as Element & {
          checkVisibility?: (options?: Record<string, boolean>) => boolean;
        };
        if (typeof candidate.checkVisibility === "function") {
          return candidate.checkVisibility({ checkVisibilityCSS: true });
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
      };

      const firstVisible = (root: ParentNode, selector: string): Element | null => {
        for (const element of Array.from(root.querySelectorAll(selector))) {
          if (isVisible(element)) return element;
        }
        return null;
      };

      const boundsOf = (element: Element | null) => {
        if (!element || !isVisible(element)) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: round(rect.x),
          y: round(rect.y),
          width: round(rect.width),
          height: round(rect.height),
        };
      };

      const documentBounds = (selector: string) => boundsOf(firstVisible(document, selector));

      const contentRoot = document.querySelector(contentRootSelector);
      const scoped = (selector: string) =>
        contentRoot ? boundsOf(firstVisible(contentRoot, selector)) : null;

      const collectionElement = contentRoot
        ? firstVisible(contentRoot, regionSelectors.collection)
        : null;
      const collectionHeaderElement = collectionElement
        ? firstVisible(collectionElement, "thead")
        : null;

      let primaryContentAnchor: string | null = null;
      let primaryContentElement: Element | null = null;
      let primaryContentIsRow = false;

      if (collectionElement) {
        for (const candidate of rowCandidates) {
          const match = firstVisible(collectionElement, candidate);
          if (match) {
            primaryContentAnchor = `collection:${candidate}`;
            primaryContentElement = match;
            primaryContentIsRow = true;
            break;
          }
        }
      }

      if (!primaryContentElement && contentRoot) {
        for (const candidate of blockCandidates) {
          const match = firstVisible(contentRoot, candidate);
          if (match) {
            primaryContentAnchor = `content:${candidate}`;
            primaryContentElement = match;
            break;
          }
        }
      }

      const workspace = boundsOf(contentRoot);
      const primaryContent = boundsOf(primaryContentElement);
      const collection = boundsOf(collectionElement);
      const innerHeight = window.innerHeight;

      return {
        primaryContentAnchor,
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
        document: {
          htmlClientWidth: document.documentElement.clientWidth,
          htmlClientHeight: document.documentElement.clientHeight,
          htmlScrollWidth: document.documentElement.scrollWidth,
          htmlScrollHeight: document.documentElement.scrollHeight,
          bodyClientWidth: document.body.clientWidth,
          bodyClientHeight: document.body.clientHeight,
          bodyScrollWidth: document.body.scrollWidth,
          bodyScrollHeight: document.body.scrollHeight,
        },
        shell: {
          topbar: documentBounds(shellSelectors.topbar),
          horizontalNav: documentBounds(shellSelectors.horizontalNav),
          moduleRail: documentBounds(shellSelectors.moduleRail),
          bottomNav: documentBounds(shellSelectors.bottomNav),
          main: documentBounds(shellSelectors.main),
          workspace,
        },
        regions: {
          moduleHeader: scoped(regionSelectors.moduleHeader),
          metrics: scoped(regionSelectors.metrics),
          filters: scoped(regionSelectors.filters),
          collection,
          collectionHeader: boundsOf(collectionHeaderElement),
          primaryContent,
          pager: scoped(regionSelectors.pager),
          sidePanel: scoped(regionSelectors.sidePanel),
        },
        derived: {
          chromeBeforePrimaryContentPx: primaryContent ? primaryContent.y : null,
          chromeBeforePrimaryContentRatio: primaryContent
            ? round((primaryContent.y / innerHeight) * 1000) / 1000
            : null,
          workspaceWidth: workspace ? workspace.width : null,
          workspaceHeight: workspace ? workspace.height : null,
          primaryContentWidth: primaryContent ? primaryContent.width : null,
          primaryContentHeight: primaryContent ? primaryContent.height : null,
          primaryBlockHeight:
            primaryContent && primaryContentIsRow ? primaryContent.height : null,
          collectionCanvasHeight: collection ? collection.height : null,
        },
      };
    },
    {
      contentRootSelector: surface.contentRootSelector,
      shellSelectors: SHELL_SELECTORS,
      regionSelectors: REGION_SELECTORS,
      rowCandidates: COLLECTION_ROW_CANDIDATES as readonly string[],
      blockCandidates: CONTENT_BLOCK_CANDIDATES as readonly string[],
    },
  );
}

/**
 * Measures one combination once the geometry is quiescent.
 *
 * Readiness is owned by the caller (`toBeVisible` + idle network +
 * `waitForLayoutSettled`). This loop only absorbs the adaptive re-measure pass
 * that several modules run after their first paint (measure viewport → derive
 * row capacity → refetch → repaint): it requires three consecutive identical
 * reads, so a mid-flight loading state can never be frozen as the baseline.
 */
export async function measureSurfaceGeometry(
  page: Page,
  surface: DashboardGeometrySurface,
  viewport: DashboardGeometryViewport,
): Promise<DashboardGeometryRecord> {
  const requiredStableReads = 3;
  let current = await evaluateGeometry(page, surface);
  let serialized = JSON.stringify(current);
  let stableReads = 0;

  for (let attempt = 0; attempt < 24 && stableReads < requiredStableReads; attempt += 1) {
    await waitForLayoutSettled(page);
    // Settle poll interval — secondary to the caller's selector/idle readiness.
    await page.waitForTimeout(80);
    const next = await evaluateGeometry(page, surface);
    const nextSerialized = JSON.stringify(next);

    if (nextSerialized === serialized) {
      stableReads += 1;
      continue;
    }

    stableReads = 0;
    current = next;
    serialized = nextSerialized;
  }

  if (stableReads < requiredStableReads) {
    throw new Error(
      `${surface.id} @ ${viewport.slug}: geometry never settled after 24 reads`,
    );
  }

  return { surfaceId: surface.id, viewportSlug: viewport.slug, ...current };
}

// ── Tolerances ───────────────────────────────────────────────────────────────
// Structural bounds: 2 px nominal. The only 4 px exceptions are the metrics
// whose value is a rasterized TEXT box (module/collection heading heights, the
// first content block height and the chrome offset that sits directly below
// those headings): their height is a font line-box sum and legitimately
// rounds one extra pixel per stacked line across viewports. Ratios use 0.01.
// Viewport values are set by Playwright, so they are compared exactly.

export const GEOMETRY_DEFAULT_TOLERANCE_PX = 2;
export const GEOMETRY_TEXT_TOLERANCE_PX = 4;
export const GEOMETRY_RATIO_TOLERANCE = 0.01;

const EXACT_PATHS = new Set<string>([
  "viewport.innerWidth",
  "viewport.innerHeight",
  "viewport.devicePixelRatio",
]);

const TEXT_DEPENDENT_PATHS = new Set<string>([
  "regions.moduleHeader.height",
  "regions.collectionHeader.height",
  "regions.primaryContent.y",
  "regions.primaryContent.height",
  "derived.chromeBeforePrimaryContentPx",
  "derived.primaryContentHeight",
  "derived.primaryBlockHeight",
]);

export function toleranceForMetric(path: string): number {
  if (EXACT_PATHS.has(path)) return 0;
  if (path === "derived.chromeBeforePrimaryContentRatio") return GEOMETRY_RATIO_TOLERANCE;
  if (TEXT_DEPENDENT_PATHS.has(path)) return GEOMETRY_TEXT_TOLERANCE_PX;
  return GEOMETRY_DEFAULT_TOLERANCE_PX;
}

type FlatValue = number | string | null;

function flattenRecord(record: DashboardGeometryRecord): Map<string, FlatValue> {
  const flat = new Map<string, FlatValue>();

  flat.set("primaryContentAnchor", record.primaryContentAnchor);

  for (const [key, value] of Object.entries(record.viewport)) {
    flat.set(`viewport.${key}`, value);
  }
  for (const [key, value] of Object.entries(record.document)) {
    flat.set(`document.${key}`, value);
  }
  for (const group of ["shell", "regions"] as const) {
    for (const [key, bounds] of Object.entries(record[group])) {
      const typedBounds = bounds as Bounds | null;
      flat.set(`${group}.${key}.present`, typedBounds === null ? "absent" : "present");
      for (const axis of ["x", "y", "width", "height"] as const) {
        flat.set(`${group}.${key}.${axis}`, typedBounds ? typedBounds[axis] : null);
      }
    }
  }
  for (const [key, value] of Object.entries(record.derived)) {
    flat.set(`derived.${key}`, value as FlatValue);
  }

  return flat;
}

export type GeometryDifference = {
  readonly surfaceId: string;
  readonly viewportSlug: string;
  readonly metric: string;
  readonly expected: FlatValue;
  readonly actual: FlatValue;
  readonly tolerance: number | null;
  readonly delta: number | null;
};

export function compareGeometryRecords(
  expected: DashboardGeometryRecord,
  actual: DashboardGeometryRecord,
): GeometryDifference[] {
  const expectedFlat = flattenRecord(expected);
  const actualFlat = flattenRecord(actual);
  const differences: GeometryDifference[] = [];

  for (const [metric, expectedValue] of expectedFlat) {
    const actualValue = actualFlat.get(metric) ?? null;

    if (typeof expectedValue === "number" && typeof actualValue === "number") {
      const tolerance = toleranceForMetric(metric);
      const delta = Math.round(Math.abs(actualValue - expectedValue) * 1000) / 1000;
      if (delta > tolerance) {
        differences.push({
          surfaceId: actual.surfaceId,
          viewportSlug: actual.viewportSlug,
          metric,
          expected: expectedValue,
          actual: actualValue,
          tolerance,
          delta,
        });
      }
      continue;
    }

    if (expectedValue !== actualValue) {
      differences.push({
        surfaceId: actual.surfaceId,
        viewportSlug: actual.viewportSlug,
        metric,
        expected: expectedValue,
        actual: actualValue,
        tolerance: null,
        delta: null,
      });
    }
  }

  return differences;
}

export function formatGeometryDifferences(differences: readonly GeometryDifference[]): string {
  return differences
    .map(
      (difference) =>
        `${difference.surfaceId} | ${difference.viewportSlug} | ${difference.metric} | ` +
        `expected=${String(difference.expected)} actual=${String(difference.actual)} ` +
        `tolerance=${difference.tolerance === null ? "exact" : difference.tolerance} ` +
        `delta=${difference.delta === null ? "n/a" : difference.delta}`,
    )
    .join("\n");
}
