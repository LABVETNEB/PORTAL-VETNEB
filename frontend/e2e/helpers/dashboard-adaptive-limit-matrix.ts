import { expect, type Locator, type Page, type Route } from "@playwright/test";

import { DASHBOARD_GEOMETRY_VIEWPORTS } from "./dashboard-geometry-matrix";

// ─────────────────────────────────────────────────────────────────────────────
// A03 · Adaptive limit/offset baseline support (15 consumers × 13 viewports =
// 195 primary records · 234 leaf observations).
//
// Owns the canonical A03 registry (module ids, variants, semantic source), the
// cardinality guards, the hermetic stubs and the observation engine. It FREEZES
// the CURRENT limit/offset behaviour; it corrects nothing (audit §20.5): it is
// not A02 geometry, not the A05 stable geometric reserve, not the A06 unified
// hook.
//
// The viewport registry is IMPORTED from A02 (`DASHBOARD_GEOMETRY_VIEWPORTS`)
// and never redeclared. Nothing else is imported from A02, which stays CLOSED.
// ─────────────────────────────────────────────────────────────────────────────

const APP_ORIGIN = "http://127.0.0.1:3000";
const FIXTURE_API_ORIGIN = "http://127.0.0.1:3107";

// ── Canonical registry (audit §20.1, literal — never derived) ────────────────

export const A03_MODULE_IDS = [
  "admin-audit-log",
  "admin-report-upload",
  "admin-particular-tokens",
  "admin-clinics",
  "admin-users-roles",
  "admin-sessions",
  "admin-failed-login-alerts",
  "admin-pricing",
  "informes-reports-list",
  "admin-maintenance",
  "clinic-informes-summary",
  "clinic-logistica-summary",
  "clinic-particular-tokens",
  "logistics-recent-list",
  "logistics-bounded-canvas",
] as const;

export type A03ModuleId = (typeof A03_MODULE_IDS)[number];

/**
 * Variants exist ONLY for the two compound consumers of §20.2. For the other 13
 * modules the leaf identity collapses onto the primary key — which is what
 * "13 simple modules × 13 viewports = 169 leaves" already states. No synthetic
 * variant id is invented for them.
 */
export const A03_MODULE_VARIANTS: Readonly<
  Record<A03ModuleId, readonly string[]>
> = Object.freeze({
  "admin-audit-log": [],
  "admin-report-upload": [],
  "admin-particular-tokens": [],
  "admin-clinics": [],
  "admin-users-roles": [],
  "admin-sessions": [],
  "admin-failed-login-alerts": [],
  "admin-pricing": [],
  "informes-reports-list": [],
  "admin-maintenance": [],
  "clinic-informes-summary": [],
  "clinic-logistica-summary": [],
  "clinic-particular-tokens": [],
  "logistics-recent-list": ["recent-visits", "recent-plans"],
  "logistics-bounded-canvas": [
    "bounded-visitas",
    "bounded-rutas",
    "bounded-metricas",
  ],
});

export type A03SemanticSource = "server-request" | "url-query" | "client-slice";

/** §20.4 classification, confirmed against the runtime before being written. */
export const A03_SEMANTIC_SOURCE: Readonly<Record<A03ModuleId, A03SemanticSource>> =
  Object.freeze({
    "admin-audit-log": "server-request",
    "admin-report-upload": "server-request",
    "admin-particular-tokens": "client-slice",
    "admin-clinics": "server-request",
    "admin-users-roles": "server-request",
    "admin-sessions": "server-request",
    "admin-failed-login-alerts": "server-request",
    "admin-pricing": "client-slice",
    "informes-reports-list": "server-request",
    "admin-maintenance": "client-slice",
    "clinic-informes-summary": "client-slice",
    "clinic-logistica-summary": "client-slice",
    "clinic-particular-tokens": "client-slice",
    "logistics-recent-list": "client-slice",
    "logistics-bounded-canvas": "url-query",
  });

export const A03_MODULE_COUNT = 15;
export const A03_VIEWPORT_COUNT = 13;
export const A03_PRIMARY_RECORD_COUNT = 195;
export const A03_LEAF_OBSERVATION_COUNT = 234;

// ── Fail-closed identity ─────────────────────────────────────────────────────

const MODULE_ID_SET: ReadonlySet<string> = new Set(A03_MODULE_IDS);
const VIEWPORT_SLUG_SET: ReadonlySet<string> = new Set(
  DASHBOARD_GEOMETRY_VIEWPORTS.map((viewport) => viewport.slug),
);

export function assertKnownModuleId(moduleId: string): A03ModuleId {
  if (!MODULE_ID_SET.has(moduleId)) {
    throw new Error(`A03: unknown moduleId "${moduleId}" — fail closed (§20.1)`);
  }
  return moduleId as A03ModuleId;
}

export function assertKnownViewportSlug(viewportSlug: string): string {
  if (!VIEWPORT_SLUG_SET.has(viewportSlug)) {
    throw new Error(
      `A03: unknown viewportSlug "${viewportSlug}" — fail closed (§4.7/§20.1)`,
    );
  }
  return viewportSlug;
}

export function assertKnownVariantId(
  moduleId: string,
  variantId: string | null,
): string | null {
  const known = assertKnownModuleId(moduleId);
  const declared = A03_MODULE_VARIANTS[known];

  if (variantId === null) {
    if (declared.length > 0) {
      throw new Error(
        `A03: "${known}" is a compound consumer and requires a variantId — fail closed (§20.2)`,
      );
    }
    return null;
  }

  if (!declared.includes(variantId)) {
    throw new Error(
      `A03: unknown variantId "${variantId}" for moduleId "${known}" — fail closed (§20.2)`,
    );
  }
  return variantId;
}

export function primaryKey(moduleId: string, viewportSlug: string): string {
  return `${assertKnownModuleId(moduleId)}::${assertKnownViewportSlug(viewportSlug)}`;
}

export function leafKey(
  moduleId: string,
  viewportSlug: string,
  variantId: string | null,
): string {
  const base = primaryKey(moduleId, viewportSlug);
  const variant = assertKnownVariantId(moduleId, variantId);
  return variant === null ? base : `${base}::${variant}`;
}

export function assertA03Cardinality(): void {
  expect(A03_MODULE_IDS.length, "A03 modules").toBe(A03_MODULE_COUNT);
  expect(new Set(A03_MODULE_IDS).size, "A03 unique moduleIds").toBe(A03_MODULE_COUNT);
  expect(DASHBOARD_GEOMETRY_VIEWPORTS.length, "A03 viewports").toBe(A03_VIEWPORT_COUNT);
  expect(VIEWPORT_SLUG_SET.size, "A03 unique viewportSlugs").toBe(A03_VIEWPORT_COUNT);
  expect(A03_MODULE_COUNT * A03_VIEWPORT_COUNT, "A03 primary records").toBe(
    A03_PRIMARY_RECORD_COUNT,
  );
  expect(
    A03_MODULE_VARIANTS["logistics-recent-list"].length,
    "logistics-recent-list variants",
  ).toBe(2);
  expect(
    A03_MODULE_VARIANTS["logistics-bounded-canvas"].length,
    "logistics-bounded-canvas variants",
  ).toBe(3);
  expect(
    A03_MODULE_IDS.filter((id) => A03_MODULE_VARIANTS[id].length === 0).length,
    "A03 simple modules",
  ).toBe(13);

  const leaves = A03_MODULE_IDS.reduce(
    (total, moduleId) =>
      total + Math.max(1, A03_MODULE_VARIANTS[moduleId].length) * A03_VIEWPORT_COUNT,
    0,
  );
  expect(leaves, "A03 leaf observations").toBe(A03_LEAF_OBSERVATION_COUNT);

  for (const moduleId of A03_MODULE_IDS) {
    expect(A03_SEMANTIC_SOURCE[moduleId], `semantic source for ${moduleId}`).toBeTruthy();
    expect(A03_OBSERVERS[moduleId], `observer for ${moduleId}`).toBeTruthy();
    expect(
      A03_OBSERVERS[moduleId].leaves.length,
      `${moduleId}: leaf targets per viewport`,
    ).toBe(Math.max(1, A03_MODULE_VARIANTS[moduleId].length));
  }
}

// ── Observation model (§20.4 discriminated union) ────────────────────────────

type ObservationIdentity = {
  readonly moduleId: A03ModuleId;
  readonly viewportSlug: string;
  readonly variantId: string | null;
  readonly leafKey: string;
};

export type ServerRequestObservation = ObservationIdentity & {
  readonly source: "server-request";
  /** Target of the request actually observed at the Playwright boundary. */
  readonly endpoint: string;
  readonly method: string;
  readonly transport: "http" | "next-server-action";
  readonly limit: number;
  readonly offset: number;
  readonly secondPageCount: number;
  readonly provenance: string;
};

export type UrlQueryObservation = ObservationIdentity & {
  readonly source: "url-query";
  readonly pathname: string;
  readonly query: string;
  readonly limit: number;
  readonly offset: number;
  readonly secondPageCount: number;
  readonly provenance: string;
};

export type ClientSliceObservation = ObservationIdentity & {
  readonly source: "client-slice";
  readonly limit: number;
  readonly offset: number;
  readonly firstRenderedFixtureIndex: number;
  readonly secondPageFixtureIds: readonly string[];
  readonly pageItemCount: number;
  readonly secondPageCount: number;
  readonly provenance: string;
};

export type A03Observation =
  | ServerRequestObservation
  | UrlQueryObservation
  | ClientSliceObservation;

// ── Synthetic session cookies of the hermetic fixture API (port 3107) ────────

export const A03_ADMIN_SESSION_COOKIE = Object.freeze({
  name: "admin_session_id",
  value: "e2e_populated_admin_session",
});

export const A03_CLINIC_SESSION_COOKIE = Object.freeze({
  name: "app_session_id",
  value: "e2e_populated_clinic_session",
});

/**
 * Auxiliary opt-in cookie ALREADY shipped by the fixture server at the base
 * commit. A03 only consumes it; it introduces no new protocol cookie.
 */
export const A03_ADAPTIVE_DATASET_COOKIE = Object.freeze({
  name: "e2e_a03_adaptive_pagination",
  value: "1",
});

// ── Deep synthetic datasets ──────────────────────────────────────────────────
// Every value is synthetic and frozen: fixed ISO timestamps, synthetic ids,
// example.test addresses, no credential, no token, no real person or clinic.

const FIXED_CREATED_AT = "2026-06-12T09:15:00.000Z";
const FIXED_UPDATED_AT = "2026-06-17T16:20:00.000Z";
const FIXED_EXTRACTION_AT = "2026-06-10T10:00:00.000Z";
const FIXED_SHIPPING_AT = "2026-06-11T10:00:00.000Z";
const FIXED_UPLOAD_AT = "2026-06-15T12:00:00.000Z";
const FIXED_LAST_ACCESS = "2026-06-17T18:45:00.000Z";
const FIXED_EXPIRES_AT = "2026-07-17T18:45:00.000Z";

/** Deep enough that no adaptive page size in the matrix can exhaust it. */
export const A03_DEEP_DATASET_SIZE = 400;

const pad4 = (value: number) => String(value).padStart(4, "0");

const A03_REPORT_STAGES = [
  "sample_received",
  "processing",
  "evaluation",
  "report_development",
  "delivered",
] as const;

/**
 * Ordered synthetic tokens. `tokenLast4` is the zero-padded ordinal, so the
 * rendered `****NNNN` IS the ordered fixture identifier.
 */
export const A03_TOKENS = Array.from({ length: A03_DEEP_DATASET_SIZE }, (_, index) => ({
  id: 90_000 + index,
  clinicId: 12 + (index % 20),
  reportId: index % 3 === 0 ? 70_000 + index : null,
  tokenLast4: pad4(index),
  tutorLastName: `Apellido A03 ${pad4(index)}`,
  petName: `Paciente A03 ${pad4(index)}`,
  petAge: `${2 + (index % 10)} años`,
  petBreed: index % 2 === 0 ? "Mestizo" : "Labrador",
  petSex: index % 2 === 0 ? "female" : "male",
  petSpecies: index % 2 === 0 ? "canine" : "feline",
  sampleLocation: "Piel",
  sampleEvolution: `${3 + (index % 8)} semanas`,
  detailsLesion: "Lesión nodular sintética para observación adaptativa.",
  extractionDate: FIXED_EXTRACTION_AT,
  shippingDate: FIXED_SHIPPING_AT,
  isActive: index % 7 !== 0,
  lastLoginAt: index % 2 === 0 ? FIXED_UPDATED_AT : null,
  createdAt: FIXED_CREATED_AT,
  updatedAt: FIXED_UPDATED_AT,
  createdByAdminId: 41,
  createdByClinicUserId: null,
  hasLinkedReport: index % 3 === 0,
}));

export const A03_REPORT_WORKFLOW = Array.from(
  { length: A03_DEEP_DATASET_SIZE },
  (_, index) => ({
    id: 71_000 + index,
    clinicId: 12 + (index % 20),
    clinicName: `Clinica A03 ${pad4(index)}`,
    patientName: `Paciente A03 ${pad4(index)}`,
    fileName: `informe-a03-${pad4(index)}.pdf`,
    studyType: index % 2 === 0 ? "histopatologia" : "citologia",
    uploadDate: FIXED_UPLOAD_AT,
    createdAt: FIXED_CREATED_AT,
    workflowStage: A03_REPORT_STAGES[index % A03_REPORT_STAGES.length],
    specialStainRequested: index % 11 === 0,
    specialStainAt: index % 11 === 0 ? FIXED_UPDATED_AT : null,
    workflowUpdatedAt: FIXED_UPDATED_AT,
  }),
);

export const A03_CLINICS = Array.from({ length: A03_DEEP_DATASET_SIZE }, (_, index) => {
  const clinicId = 60_000 + index;
  const clinicName = `Clinica Adaptativa A03 ${pad4(index)}`;

  return {
    clinicId,
    clinicName,
    contactEmail: `clinica-a03-${pad4(index)}@example.test`,
    contactPhone: "+54 11 4000-0000",
    createdAt: FIXED_CREATED_AT,
    updatedAt: FIXED_UPDATED_AT,
    users: [
      {
        userType: "clinic" as const,
        userId: 61_000 + index,
        username: `clinica_a03_${pad4(index)}`,
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

const A03_SESSION_KINDS = [
  { sessionType: "admin" as const, actorType: "admin_user" as const },
  { sessionType: "clinic" as const, actorType: "clinic_user" as const },
  { sessionType: "particular" as const, actorType: "particular_token" as const },
];

export const A03_SESSIONS = Array.from({ length: A03_DEEP_DATASET_SIZE }, (_, index) => {
  const kind = A03_SESSION_KINDS[index % A03_SESSION_KINDS.length];

  return {
    sessionType: kind.sessionType,
    sessionId: 50_000 + index,
    actorType: kind.actorType,
    actorId: 51_000 + index,
    createdAt: FIXED_CREATED_AT,
    lastAccess: FIXED_LAST_ACCESS,
    expiresAt: FIXED_EXPIRES_AT,
    status: "active" as const,
  };
});

const A03_FAILED_LOGIN_SURFACES = ["admin", "clinic", "particular"] as const;
const A03_FAILED_LOGIN_REASONS = [
  "missing_credentials",
  "invalid_credentials",
  "rate_limited",
] as const;

export const A03_FAILED_LOGIN_ALERTS = Array.from(
  { length: A03_DEEP_DATASET_SIZE },
  (_, index) => ({
    id: 40_000 + index,
    surface: A03_FAILED_LOGIN_SURFACES[index % A03_FAILED_LOGIN_SURFACES.length],
    username: `usuario_a03_${pad4(index)}`,
    reason: A03_FAILED_LOGIN_REASONS[index % A03_FAILED_LOGIN_REASONS.length],
    ipAddress: null,
    userAgent: null,
    createdAt: FIXED_CREATED_AT,
  }),
);

/** One category keeps the module's tab contract trivial and deterministic. */
export const A03_PRICING_CATEGORY = "Adaptativa A03";
export const A03_PRICING_ITEMS = Array.from({ length: 60 }, (_, index) => ({
  id: 30_000 + index,
  category: A03_PRICING_CATEGORY,
  studyName: `Estudio A03 ${pad4(index)}`,
  priceLabel: `$ ${24 + index}.500`,
  displayOrder: index + 1,
  isActive: true,
  updatedAt: FIXED_UPDATED_AT,
}));

/**
 * `category` is the React key AND the identifier rendered under each label, so
 * it must be unique per group even though the production union has 4 members.
 */
export const A03_MAINTENANCE_CANDIDATES = Array.from({ length: 60 }, (_, index) => ({
  category: `expired_clinic_sessions_a03_${pad4(index)}`,
  label: `Grupo adaptativo A03 ${pad4(index)}`,
  count: 3 + (index % 17),
  supported: index % 5 !== 0,
  destructiveAction: index % 5 !== 0 ? "delete_expired_sessions" : null,
}));

const A03_MAINTENANCE_SNAPSHOT = {
  success: true,
  dryRun: true as const,
  generatedAt: FIXED_UPDATED_AT,
  checkedBy: { adminUserId: 41, username: "admin_operaciones" },
  candidates: A03_MAINTENANCE_CANDIDATES,
  totals: {
    candidateRecords: A03_MAINTENANCE_CANDIDATES.reduce((t, c) => t + c.count, 0),
    supportedCandidateRecords: A03_MAINTENANCE_CANDIDATES.filter((c) => c.supported).length,
    unsupportedGroups: A03_MAINTENANCE_CANDIDATES.filter((c) => !c.supported).length,
  },
};

function readWindow(url: URL, total: number, fallbackLimit: number) {
  const rawLimit = Number(url.searchParams.get("limit"));
  const rawOffset = Number(url.searchParams.get("offset"));
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : fallbackLimit;
  const offset =
    Number.isInteger(rawOffset) && rawOffset >= 0 ? Math.min(rawOffset, total) : 0;
  return { limit, offset };
}

type StubDefinition = {
  readonly urlPattern: string;
  readonly pathname: string;
  readonly method: "GET" | "POST";
  readonly body: (url: URL) => unknown;
};

const STUB_TOKENS: StubDefinition = {
  urlPattern: "**/api/admin/particular-tokens**",
  pathname: "/api/admin/particular-tokens",
  method: "GET",
  body: (url) => {
    const { limit, offset } = readWindow(url, A03_TOKENS.length, 9);
    const particularTokens = A03_TOKENS.slice(offset, offset + limit);
    return {
      success: true,
      count: particularTokens.length,
      particularTokens,
      pagination: { limit, offset },
      filters: { clinicId: null },
    };
  },
};

const STUB_CLINIC_TOKENS: StubDefinition = {
  urlPattern: "**/api/particular-tokens**",
  pathname: "/api/particular-tokens",
  method: "GET",
  body: (url) => {
    const { limit, offset } = readWindow(url, A03_TOKENS.length, 9);
    const particularTokens = A03_TOKENS.slice(offset, offset + limit);
    return {
      success: true,
      count: particularTokens.length,
      particularTokens,
      pagination: { limit, offset },
    };
  },
};

const STUB_STUDY_TRACKING: StubDefinition = {
  urlPattern: "**/api/study-tracking**",
  pathname: "/api/study-tracking",
  method: "GET",
  body: (url) => {
    const { limit, offset } = readWindow(url, 0, 20);
    return { success: true, count: 0, trackingCases: [], pagination: { limit, offset } };
  },
};

const STUB_REPORT_WORKFLOW: StubDefinition = {
  urlPattern: "**/api/admin/report-workflow**",
  pathname: "/api/admin/report-workflow",
  method: "GET",
  body: (url) => {
    const total = A03_REPORT_WORKFLOW.length;
    const { limit, offset } = readWindow(url, total, 9);
    return {
      success: true,
      reports: A03_REPORT_WORKFLOW.slice(offset, offset + limit),
      pagination: { limit, offset, hasMore: offset + limit < total },
    };
  },
};

const STUB_CLINICS: StubDefinition = {
  urlPattern: "**/api/admin/clinics**",
  pathname: "/api/admin/clinics",
  method: "GET",
  body: (url) => {
    const total = A03_CLINICS.length;
    const { limit, offset } = readWindow(url, total, 9);
    return {
      success: true,
      clinics: A03_CLINICS.slice(offset, offset + limit),
      total,
      limit,
      offset,
    };
  },
};

const STUB_SESSIONS: StubDefinition = {
  urlPattern: "**/api/admin/sessions**",
  pathname: "/api/admin/sessions",
  method: "GET",
  body: (url) => {
    const total = A03_SESSIONS.length;
    const { limit, offset } = readWindow(url, total, 9);
    return {
      success: true,
      sessions: A03_SESSIONS.slice(offset, offset + limit),
      total,
      limit,
      offset,
      currentAdminSessionId: A03_SESSIONS[0].sessionId,
      checkedBy: { adminUserId: 41, username: "admin_operaciones" },
    };
  },
};

const STUB_FAILED_LOGIN: StubDefinition = {
  urlPattern: "**/api/admin/failed-login-alerts**",
  pathname: "/api/admin/failed-login-alerts",
  method: "GET",
  body: (url) => {
    const total = A03_FAILED_LOGIN_ALERTS.length;
    const { limit, offset } = readWindow(url, total, 9);
    const failedLoginAlerts = A03_FAILED_LOGIN_ALERTS.slice(offset, offset + limit);
    return {
      success: true,
      failedLoginAlerts,
      count: failedLoginAlerts.length,
      total,
      limit,
      offset,
      filters: { surface: null, reason: null },
      checkedBy: { adminUserId: 41, username: "admin_operaciones" },
    };
  },
};

const STUB_PRICING: StubDefinition = {
  urlPattern: "**/api/admin/pricing**",
  pathname: "/api/admin/pricing",
  method: "GET",
  body: () => ({
    success: true,
    categories: [{ category: A03_PRICING_CATEGORY, items: A03_PRICING_ITEMS }],
  }),
};

const STUB_MAINTENANCE: StubDefinition = {
  urlPattern: "**/api/admin/system/maintenance/purge-dry-run**",
  pathname: "/api/admin/system/maintenance/purge-dry-run",
  method: "POST",
  body: () => A03_MAINTENANCE_SNAPSHOT,
};

/**
 * Test-only opt-in flag added to the wire URL of a real API call, exactly as
 * `e2e/admin/users/admin-users-workspace-5000.spec.ts` (CAP-A2) already does.
 * The application keeps issuing its own limit/offset — only the query string
 * gains the flag — so A03 still observes the runtime's real window and no
 * parallel dataset is created inside the harness.
 */
type RequestRewrite = {
  readonly pathname: string;
  readonly method: "GET" | "POST";
  readonly searchParams: Readonly<Record<string, string>>;
};

const REWRITE_USERS_ROLES_HIGH_VOLUME: RequestRewrite = {
  pathname: "/api/admin/users-roles",
  method: "GET",
  searchParams: { dataset: "high-volume" },
};

async function installRequestRewrites(
  page: Page,
  rewrites: readonly RequestRewrite[],
): Promise<void> {
  for (const rewrite of rewrites) {
    await page.route(
      (url: URL) => url.pathname === rewrite.pathname,
      async (route: Route) => {
        if (route.request().method() !== rewrite.method) {
          await route.continue();
          return;
        }

        const rewritten = new URL(route.request().url());
        for (const [name, value] of Object.entries(rewrite.searchParams)) {
          rewritten.searchParams.set(name, value);
        }
        await route.continue({ url: rewritten.toString() });
      },
    );
  }
}

async function installStubs(page: Page, stubs: readonly StubDefinition[]): Promise<void> {
  for (const stub of stubs) {
    await page.route(stub.urlPattern, async (route: Route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() !== stub.method || url.pathname !== stub.pathname) {
        return route.fallback();
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify(stub.body(url)),
      });
    });
  }
}

// ── Page hygiene ─────────────────────────────────────────────────────────────

export async function suppressDevChrome(page: Page): Promise<void> {
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

// ── Adaptive convergence (§20.3) ─────────────────────────────────────────────

/**
 * Consecutive identical renders required before the measurement is accepted.
 *
 * One drained cycle is NOT sufficient evidence. The dashboard consumers couple
 * TWO adaptive stages: the row-pitch probe (`LogisticsRecentListCanvas` and
 * peers) feeds `rowHeightPx` into `useAdaptiveDashboardPageSize`, whose layout
 * effect lists that value as a dependency. When a re-probe changes the pitch
 * WITHOUT changing the resulting page size, React commits a render that mutates
 * nothing inside the container and resizes nothing, then re-subscribes the
 * hook's `ResizeObserver`, whose fresh initial callback re-measures one or more
 * frames later. That window is silent to both observers below, so a single
 * drain can resolve inside it and read a cardinality the runtime is about to
 * replace — observed at 0–6 frames after the drain resolved (canvas descendants
 * 26 → 35 at an IDENTICAL 251.891px canvas height).
 *
 * Requiring the SAME render twice in a row, with a full drained cycle between
 * the observations, spans that window with a condition instead of a duration.
 */
const ADAPTIVE_STABLE_RENDER_REPEATS = 2;

/** Bounded fail-closed budget: a container that never stabilises throws. */
const ADAPTIVE_STABILITY_ATTEMPTS = 12;

/**
 * Drains the runtime's own re-measure pipeline once and returns the RENDER
 * SIGNATURE observed at the moment it went quiet.
 *
 * Every adaptive hook re-measures through exactly one path: a `ResizeObserver`
 * callback that schedules the measurement on the next `requestAnimationFrame`;
 * a changed measurement re-renders, which mutates the observed subtree, which
 * fires the observer again. The pipeline is quiet exactly when a full animation
 * frame elapses with NO resize callback and NO mutation inside the measured
 * container. Waiting for three consecutive quiet frames observes the ABSENCE of
 * pending work — it is not a sleep, a retry loop, a poll that selects a
 * convenient value, or an average. If the pipeline never goes quiet the call
 * THROWS instead of returning a mid-flight value.
 *
 * The signature is the rendered cardinality of the container plus its measured
 * block size: exactly the two quantities every A03/A05 observation reads.
 */
async function drainToRenderSignature(
  page: Page,
  containerSelector: string,
  label: string,
  containerIndex: number,
): Promise<string> {
  return page.evaluate(
    async ({ selector, index, quietFrames, frameBudget, context }) => {
      const matches = document.querySelectorAll(selector);
      const node = matches[index];
      if (!node) {
        throw new Error(
          `${context}: adaptive container "${selector}" index ${index} is not available (${matches.length} matches)`,
        );
      }

      await document.fonts.ready;

      await new Promise<void>((resolve, reject) => {
        let dirty = true;
        let quiet = 0;
        let frames = 0;

        const markDirty = () => {
          dirty = true;
        };

        const resizeObserver = new ResizeObserver(markDirty);
        resizeObserver.observe(node);
        const mutationObserver = new MutationObserver(markDirty);
        mutationObserver.observe(node, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });

        const stop = () => {
          resizeObserver.disconnect();
          mutationObserver.disconnect();
        };

        const tick = () => {
          frames += 1;
          if (frames > frameBudget) {
            stop();
            reject(
              new Error(
                `${context}: adaptive measurement never converged — the ResizeObserver/rAF pipeline was still firing after ${frameBudget} frames`,
              ),
            );
            return;
          }

          if (dirty) {
            dirty = false;
            quiet = 0;
            requestAnimationFrame(tick);
            return;
          }

          quiet += 1;
          if (quiet >= quietFrames) {
            stop();
            resolve();
            return;
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      });

      return `${node.querySelectorAll("*").length}|${Math.round(
        node.getBoundingClientRect().height * 1_000,
      )}`;
    },
    {
      selector: containerSelector,
      index: containerIndex,
      quietFrames: 3,
      frameBudget: 600,
      context: label,
    },
  );
}

/**
 * Proves the adaptive measurement has CONVERGED **and stayed converged**, by
 * requiring the same render signature from consecutive drained cycles instead
 * of trusting a single quiet window (see ADAPTIVE_STABLE_RENDER_REPEATS).
 *
 * Every observation is separated from the previous one by a real drained
 * measurement cycle — a render signal, never a duration. No value is selected
 * from a pool and no tolerance is applied: the signatures must be identical.
 * A container that never stabilises THROWS instead of returning a mid-flight
 * cardinality.
 *
 * `containerIndex` selects WHICH match of `containerSelector` is drained, for
 * the compound consumers of §20.2 whose instances each own a measured
 * container. It is an index over the selector's own matches — never a CSS
 * positional pseudo-class, which counts siblings by tag and does not express
 * "the nth match". A missing index fails closed; it never falls back to the
 * first match, which would silently drain another instance's container.
 */
export async function waitForAdaptiveConvergence(
  page: Page,
  containerSelector: string,
  label: string,
  containerIndex = 0,
): Promise<void> {
  if (!Number.isInteger(containerIndex) || containerIndex < 0) {
    throw new Error(
      `${label}: adaptive container index must be a non-negative integer, received ${containerIndex}`,
    );
  }

  let previous: string | null = null;
  let stableRenderCount = 0;

  for (let attempt = 0; attempt < ADAPTIVE_STABILITY_ATTEMPTS; attempt += 1) {
    const signature = await drainToRenderSignature(
      page,
      containerSelector,
      label,
      containerIndex,
    );

    // The budget counts identical RENDERS, not repetitions of a previous one:
    // the drained cycle that first produced a signature already contributes the
    // first of them. Counting transitions demanded THREE drains for the
    // documented "twice in a row" and spent one full cycle per convergence.
    if (signature === previous) {
      stableRenderCount += 1;
    } else {
      previous = signature;
      stableRenderCount = 1;
    }

    if (stableRenderCount >= ADAPTIVE_STABLE_RENDER_REPEATS) {
      return;
    }
  }

  throw new Error(
    `${label}: adaptive render never stabilised — ${ADAPTIVE_STABILITY_ATTEMPTS} drained cycles never produced ${ADAPTIVE_STABLE_RENDER_REPEATS} consecutive identical renders of "${containerSelector}" index ${containerIndex}`,
  );
}

// ── Pager semantics ──────────────────────────────────────────────────────────
// Four label grammars exist in the runtime: "Página N de M", "Página N",
// "Pág. N / M" and "Pág. N". One regex covers all four.

export function pageLabelPattern(pageNumber: number): RegExp {
  return new RegExp(
    `^[\\s\\u00a0]*(?:Página|Pág\\.)[\\s\\u00a0]*${pageNumber}(?:[\\s\\u00a0]*(?:de|/)[\\s\\u00a0]*\\d+)?[\\s\\u00a0]*$`,
  );
}

// ── Row resolution ───────────────────────────────────────────────────────────

/**
 * Resolves the collection rows across the desktop and mobile renders. Exactly
 * ONE candidate may have visible rows; zero or more than one is an ambiguous
 * read and fails closed.
 */
export async function resolveVisibleRows(
  page: Page,
  candidates: readonly string[],
  label: string,
): Promise<Locator> {
  const matches: Locator[] = [];

  for (const candidate of candidates) {
    const locator = page.locator(`${candidate} >> visible=true`);
    if ((await locator.count()) > 0) {
      matches.push(locator);
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `${label}: expected exactly one visible row collection, resolved ${matches.length} of [${candidates.join(", ")}]`,
    );
  }

  return matches[0];
}

export type RowIdentity =
  | { readonly kind: "text"; readonly pattern: RegExp }
  | { readonly kind: "inputValue"; readonly selector: string }
  /**
   * Same identifier, two real renderings. A module whose desktop and mobile
   * presentations expose the SAME fixture id through different markup (Precios:
   * a readonly input on desktop, the study name as row text on mobile) declares
   * both and the first one that resolves for every row wins. It is still a
   * semantic identity — never a position — and adds no data-* to the runtime.
   */
  | { readonly kind: "anyOf"; readonly options: readonly RowIdentity[] };

async function readRowIdentities(
  rows: Locator,
  identity: RowIdentity,
  label: string,
): Promise<string[]> {
  if (identity.kind === "anyOf") {
    const failures: string[] = [];
    for (const option of identity.options) {
      try {
        return await readRowIdentities(rows, option, label);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    throw new Error(
      `${label}: no declared row identity resolved — ${failures.join(" | ")}`,
    );
  }

  if (identity.kind === "inputValue") {
    const count = await rows.count();
    const values: string[] = [];
    for (let index = 0; index < count; index += 1) {
      // Bounded: under `anyOf` this strategy is tried against presentations
      // that do not ship the input at all, and an unbounded `inputValue()`
      // would block the whole matrix instead of falling through.
      values.push(
        await rows
          .nth(index)
          .locator(identity.selector)
          .first()
          .inputValue({ timeout: 2_000 }),
      );
    }
    return values;
  }

  const texts = await rows.allInnerTexts();
  return texts.map((text, index) => {
    const match = identity.pattern.exec(text.replace(/ /g, " "));
    if (!match || match[1] === undefined) {
      throw new Error(
        `${label}: row ${index} exposes no fixture identifier matching ${identity.pattern}`,
      );
    }
    return match[1];
  });
}

// ── Ordered dataset providers (client-slice evidence) ────────────────────────
// The ordered fixture ids come either from the synthetic array this helper
// serves through `page.route` (exact, in-process) or from an INDEPENDENT read
// of the same hermetic endpoint the runtime used. Neither derives the position
// from the rendered page, so `offset === limit` is never assumed.

type OrderedIdsProvider = (page: Page) => Promise<string[]>;

const datasetCache = new WeakMap<Page, Map<string, string[]>>();

const staticIds = (values: readonly string[]): OrderedIdsProvider => async () => [...values];

async function fixtureJson(page: Page, path: string): Promise<Record<string, unknown>> {
  const response = await page.request.get(`${FIXTURE_API_ORIGIN}${path}`);
  if (!response.ok()) {
    throw new Error(`A03: hermetic dataset read failed for ${path} (${response.status()})`);
  }
  return (await response.json()) as Record<string, unknown>;
}

const clinicReportIds: OrderedIdsProvider = async (page) => {
  // Mirrors CLINIC_DASHBOARD_ADAPTIVE_SUPERSET_LIMIT of /dashboard/page.tsx.
  const payload = await fixtureJson(page, "/api/reports?limit=100&offset=0");
  const reports = (payload.reports ?? []) as { id: number }[];
  return reports.map((report) => String(report.id));
};

const fieldVisitClinicNames: OrderedIdsProvider = async (page) => {
  const payload = await fixtureJson(page, "/api/logistics/field-visits");
  const visits = (payload.visits ?? []) as { clinicName: string | null; clinicId: number }[];
  return visits.map((visit) => visit.clinicName ?? `Clínica #${visit.clinicId}`);
};

const routePlanNames: OrderedIdsProvider = async (page) => {
  const payload = await fixtureJson(page, "/api/logistics/route-plans");
  const plans = (payload.routePlans ?? []) as { name: string }[];
  return plans.map((plan) => plan.name);
};

// ── Module observers ─────────────────────────────────────────────────────────

export type LeafTarget = {
  readonly variantId: string | null;
  readonly route: string;
  /** Awaited with `toBeVisible` before anything else. */
  readonly readinessSelector: string;
  /** Container whose re-measure pipeline is drained. */
  readonly convergenceSelector: string;
  /** Desktop / mobile row collections; exactly one must be visible. */
  readonly rowSelectors: readonly string[];
  /**
   * Pager state label, when the runtime ships one. `null` is admissible ONLY
   * for `server-request` consumers whose pager exposes a range instead of a
   * "Página N" caption (admin-clinics): there the transition is proven by the
   * real request the click emits (`offset > 0`) plus a complete, converged
   * second page — never by a label the runtime does not render. A
   * `client-slice` observer always needs one, because its page identity has no
   * request to fall back on.
   */
  readonly pageLabelSelector: string | null;
  readonly nextSelector: string;
  /** Optional 0-based disambiguation when the page renders N equal canvases. */
  readonly scopeNth?: number;
  /** Runtime-permitted interaction needed to reach the representative state. */
  readonly prepare?: (page: Page) => Promise<void>;
};

export type ModuleObserver = {
  readonly moduleId: A03ModuleId;
  readonly source: A03SemanticSource;
  readonly cookies: readonly { name: string; value: string }[];
  readonly stubs: readonly StubDefinition[];
  /** Wire-level opt-in flags for hermetic fixtures the repo already ships. */
  readonly rewrites?: readonly RequestRewrite[];
  /** Initial rewritten response that must succeed before DOM readiness is read. */
  readonly initialResponse?: RequestRewrite;
  readonly leaves: readonly LeafTarget[];
  /** server-request only. */
  readonly transport?: "http" | "next-server-action";
  readonly requestPathname?: string;
  readonly payloadShape?: "limit-offset" | "page-pagesize";
  /** client-slice only. */
  readonly rowIdentity?: RowIdentity;
  readonly orderedIds?: OrderedIdsProvider;
};

const adminRoute = (moduleId: string) => `/dashboard/admin?module=${moduleId}`;
const adminScope = (moduleId: string) => `[data-dashboard-module-workspace="${moduleId}"]`;

/**
 * Matches ONLY an element whose whole text is a page label, in the four
 * grammars the runtime ships. Anchoring both ends is what keeps a decorative
 * "Página" caption from being mistaken for the pager state.
 */
const PAGE_LABEL =
  'text=/^[\\s\\u00a0]*(?:Página|Pág\\.)[\\s\\u00a0]*\\d+(?:[\\s\\u00a0]*(?:de|\\/)[\\s\\u00a0]*\\d+)?[\\s\\u00a0]*$/';

/** Every next-page affordance shipped by the dashboard pagers. */
const NEXT_CONTROL =
  '[aria-label="Página siguiente"], [aria-label="Siguiente"], [data-dashboard-pager-next="true"], button:text-is("Siguiente")';

/**
 * Clicks the first candidate that is actually visible, with a bounded timeout
 * so a missing affordance fails in seconds instead of consuming the whole test
 * budget. Zero visible candidates fails closed with the exact selectors tried.
 */
async function clickFirstVisible(
  page: Page,
  selectors: readonly string[],
  label: string,
): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(`${selector} >> visible=true`).first();
    if ((await locator.count()) > 0) {
      await locator.click({ timeout: 15_000 });
      return;
    }
  }

  throw new Error(
    `${label}: no visible control among [${selectors.join(", ")}] — fail closed`,
  );
}

/** Desktop renders ModuleTabs, mobile the status-module chip row. */
const clickModuleTab = (tabId: string) => async (page: Page) => {
  await clickFirstVisible(
    page,
    [`[data-module-tab="${tabId}"]`, `[data-admin-mobile-status-chip="${tabId}"]`],
    `module tab "${tabId}"`,
  );
};

/**
 * Selects a section of the mobile config module when that chip row exists.
 * Desktop presentations of the same module ship no chip row, so the call is a
 * no-op there instead of a failure.
 */
const selectMobileConfigSection = (sectionId: string) => async (page: Page) => {
  const chip = page.locator(
    `[data-admin-mobile-config-chip="${sectionId}"] >> visible=true`,
  );
  if ((await chip.count()) > 0) {
    await chip.first().click({ timeout: 15_000 });
  }
};

const runMaintenanceDryRun = async (page: Page) => {
  // Desktop switches sections with ModuleTabs, mobile with the config chip row
  // of AdminMobileConfigModule — the dry-run section is not the default one, so
  // without selecting it "Analizar" is not mounted at all on phones.
  await clickFirstVisible(
    page,
    ['[data-module-tab="dry-run"]', '[data-admin-mobile-config-chip="dry-run"]'],
    "maintenance dry-run section",
  );
  // "Analizar limpieza" (desktop) / "Analizar" (mobile) — the only runtime path
  // that populates the candidate collection. No src change, no synthetic state.
  await clickFirstVisible(
    page,
    ['button:text-matches("^Analizar")'],
    "maintenance dry-run",
  );
};

const bounded = (
  variantId: string,
  canvas: string,
  extraRow: string,
): LeafTarget => ({
  variantId,
  route: `/dashboard/logistica/${canvas}`,
  readinessSelector: `[data-dashboard-table-canvas="${canvas}"]`,
  convergenceSelector: `[data-dashboard-table-canvas="${canvas}"]`,
  rowSelectors: [`[data-dashboard-table-canvas="${canvas}"] tbody tr`, extraRow],
  pageLabelSelector: '[data-dashboard-pager-state="true"]',
  nextSelector: '[data-dashboard-pager-next="true"] >> [aria-label="Página siguiente"]',
});

export const A03_OBSERVERS: Readonly<Record<A03ModuleId, ModuleObserver>> = Object.freeze({
  "admin-audit-log": {
    moduleId: "admin-audit-log",
    source: "server-request",
    transport: "next-server-action",
    requestPathname: "/dashboard/admin",
    payloadShape: "limit-offset",
    cookies: [A03_ADMIN_SESSION_COOKIE],
    stubs: [],
    leaves: [
      {
        variantId: null,
        route: adminRoute("audit-log"),
        readinessSelector: adminScope("audit-log"),
        convergenceSelector: adminScope("audit-log"),
        rowSelectors: [
          `${adminScope("audit-log")} table tbody tr`,
          `${adminScope("audit-log")} [data-admin-mobile-ops-item="true"]`,
        ],
        pageLabelSelector: `${adminScope("audit-log")} >> ${PAGE_LABEL}`,
        nextSelector: `${adminScope("audit-log")} >> ${NEXT_CONTROL}`,
      },
    ],
  },
  "admin-report-upload": {
    moduleId: "admin-report-upload",
    source: "server-request",
    transport: "http",
    requestPathname: "/api/admin/report-workflow",
    cookies: [A03_ADMIN_SESSION_COOKIE],
    stubs: [STUB_REPORT_WORKFLOW],
    leaves: [
      {
        variantId: null,
        route: adminRoute("admin-report-upload"),
        readinessSelector: adminScope("admin-report-upload"),
        convergenceSelector: adminScope("admin-report-upload"),
        rowSelectors: [
          `${adminScope("admin-report-upload")} tbody tr`,
          `${adminScope("admin-report-upload")} [data-admin-mobile-core-item="true"]`,
        ],
        pageLabelSelector: `${adminScope("admin-report-upload")} >> ${PAGE_LABEL}`,
        nextSelector: `${adminScope("admin-report-upload")} >> ${NEXT_CONTROL}`,
      },
    ],
  },
  "admin-particular-tokens": {
    moduleId: "admin-particular-tokens",
    source: "client-slice",
    cookies: [A03_ADMIN_SESSION_COOKIE],
    stubs: [STUB_TOKENS],
    rowIdentity: { kind: "text", pattern: /\*{4}(\d{4})/ },
    orderedIds: staticIds(A03_TOKENS.map((token) => token.tokenLast4)),
    leaves: [
      {
        variantId: null,
        route: adminRoute("admin-particular-tokens"),
        readinessSelector: adminScope("admin-particular-tokens"),
        convergenceSelector: adminScope("admin-particular-tokens"),
        rowSelectors: [
          `${adminScope("admin-particular-tokens")} tbody tr`,
          `${adminScope("admin-particular-tokens")} [data-admin-mobile-core-item="true"]`,
        ],
        pageLabelSelector: `${adminScope("admin-particular-tokens")} >> ${PAGE_LABEL}`,
        nextSelector: `${adminScope("admin-particular-tokens")} >> ${NEXT_CONTROL}`,
      },
    ],
  },
  "admin-clinics": {
    moduleId: "admin-clinics",
    source: "server-request",
    transport: "http",
    requestPathname: "/api/admin/clinics",
    cookies: [A03_ADMIN_SESSION_COOKIE],
    stubs: [STUB_CLINICS],
    leaves: [
      {
        variantId: null,
        route: adminRoute("admin-clinics"),
        readinessSelector: adminScope("admin-clinics"),
        convergenceSelector: adminScope("admin-clinics"),
        rowSelectors: [
          `${adminScope("admin-clinics")} tbody tr`,
          `${adminScope("admin-clinics")} [data-admin-mobile-core-item="true"]`,
        ],
        // The Clínicas pager ships a range ("N–M de T") plus prev/next, not a
        // "Página N" caption. A03 does not invent one: the transition is proven
        // by the single GET /api/admin/clinics the click emits (offset > 0) and
        // a complete converged second page.
        pageLabelSelector: null,
        nextSelector: `${adminScope("admin-clinics")} >> ${NEXT_CONTROL}`,
      },
    ],
  },
  "admin-users-roles": {
    moduleId: "admin-users-roles",
    source: "server-request",
    transport: "http",
    requestPathname: "/api/admin/users-roles",
    cookies: [A03_ADMIN_SESSION_COOKIE],
    stubs: [],
    // Without the opt-in the fixture serves the 9-user LEGACY_USERS pool, which
    // the adaptive limit swallows whole on the tall viewports — "Siguiente"
    // then renders disabled and there is no second page to observe. The 5000-
    // user hermetic dataset already in the repo removes that ceiling without
    // touching the limit/offset the card computes.
    rewrites: [REWRITE_USERS_ROLES_HIGH_VOLUME],
    initialResponse: REWRITE_USERS_ROLES_HIGH_VOLUME,
    leaves: [
      {
        variantId: null,
        route: adminRoute("admin-users-roles"),
        readinessSelector: adminScope("admin-users-roles"),
        convergenceSelector: adminScope("admin-users-roles"),
        rowSelectors: [
          `${adminScope("admin-users-roles")} tbody tr`,
          `${adminScope("admin-users-roles")} [data-admin-mobile-ops-item="true"]`,
        ],
        pageLabelSelector: `${adminScope("admin-users-roles")} >> ${PAGE_LABEL}`,
        nextSelector: `${adminScope("admin-users-roles")} >> ${NEXT_CONTROL}`,
      },
    ],
  },
  "admin-sessions": {
    moduleId: "admin-sessions",
    source: "server-request",
    transport: "http",
    requestPathname: "/api/admin/sessions",
    cookies: [A03_ADMIN_SESSION_COOKIE],
    stubs: [STUB_SESSIONS],
    leaves: [
      {
        variantId: null,
        route: adminRoute("admin-sessions"),
        readinessSelector: adminScope("admin-sessions"),
        convergenceSelector: adminScope("admin-sessions"),
        rowSelectors: [`${adminScope("admin-sessions")} [data-admin-sesiones-row="true"]`],
        pageLabelSelector: `${adminScope("admin-sessions")} >> ${PAGE_LABEL}`,
        nextSelector: `${adminScope("admin-sessions")} >> ${NEXT_CONTROL}`,
      },
    ],
  },
  "admin-failed-login-alerts": {
    moduleId: "admin-failed-login-alerts",
    source: "server-request",
    transport: "http",
    requestPathname: "/api/admin/failed-login-alerts",
    cookies: [A03_ADMIN_SESSION_COOKIE],
    stubs: [STUB_FAILED_LOGIN],
    leaves: [
      {
        variantId: null,
        // The consumer lives in the "alertas" tab of the admin overview module
        // (same tab id on the desktop ModuleTabs and the mobile command module).
        route: adminRoute("admin"),
        readinessSelector: adminScope("admin"),
        convergenceSelector: adminScope("admin"),
        prepare: clickModuleTab("alertas"),
        rowSelectors: [
          `${adminScope("admin")} tbody tr`,
          `${adminScope("admin")} [data-admin-mobile-status-item="true"]`,
        ],
        pageLabelSelector: `${adminScope("admin")} >> ${PAGE_LABEL}`,
        nextSelector: `${adminScope("admin")} >> ${NEXT_CONTROL}`,
      },
    ],
  },
  "admin-pricing": {
    moduleId: "admin-pricing",
    source: "client-slice",
    cookies: [A03_ADMIN_SESSION_COOKIE],
    stubs: [STUB_PRICING],
    // Desktop rows are edit forms whose readonly input carries the study name;
    // the mobile catalog row prints the same study name as its first line.
    rowIdentity: {
      kind: "anyOf",
      options: [
        { kind: "inputValue", selector: "input[readonly]" },
        { kind: "text", pattern: /^(.+?)(?:\n|$)/ },
      ],
    },
    orderedIds: staticIds(A03_PRICING_ITEMS.map((item) => item.studyName)),
    leaves: [
      {
        variantId: null,
        route: adminRoute("admin-pricing"),
        readinessSelector: adminScope("admin-pricing"),
        convergenceSelector: adminScope("admin-pricing"),
        // On phones the measured catalog lives in the "Catálogo" section of
        // AdminMobileConfigModule; "Editar" is the default one, so the paged
        // collection is not mounted until the chip is selected. Desktop has no
        // such chip and the click is a no-op there by construction.
        prepare: selectMobileConfigSection("catalogo"),
        rowSelectors: [
          `${adminScope("admin-pricing")} [data-admin-pricing-item-form]`,
          `${adminScope("admin-pricing")} [data-admin-mobile-config-item="true"]`,
        ],
        pageLabelSelector: `${adminScope("admin-pricing")} >> ${PAGE_LABEL}`,
        nextSelector: `${adminScope("admin-pricing")} >> ${NEXT_CONTROL}`,
      },
    ],
  },
  "informes-reports-list": {
    moduleId: "informes-reports-list",
    source: "server-request",
    transport: "next-server-action",
    requestPathname: "/dashboard/informes",
    payloadShape: "page-pagesize",
    cookies: [A03_CLINIC_SESSION_COOKIE],
    stubs: [],
    leaves: [
      {
        variantId: null,
        route: "/dashboard/informes",
        readinessSelector: '[data-informes-rows-canvas="true"]',
        convergenceSelector: '[data-informes-rows-canvas="true"]',
        rowSelectors: ['[data-informes-rows-canvas="true"] > *'],
        pageLabelSelector: '[data-dashboard-pager-state="true"]',
        nextSelector: '[data-dashboard-pager-next="true"] >> [aria-label="Página siguiente"]',
      },
    ],
  },
  "admin-maintenance": {
    moduleId: "admin-maintenance",
    source: "client-slice",
    cookies: [A03_ADMIN_SESSION_COOKIE],
    stubs: [STUB_MAINTENANCE],
    rowIdentity: { kind: "text", pattern: /(expired_clinic_sessions_a03_\d{4})/ },
    orderedIds: staticIds(A03_MAINTENANCE_CANDIDATES.map((group) => group.category)),
    leaves: [
      {
        variantId: null,
        route: adminRoute("admin-maintenance"),
        readinessSelector: adminScope("admin-maintenance"),
        convergenceSelector: adminScope("admin-maintenance"),
        prepare: runMaintenanceDryRun,
        rowSelectors: [
          '[data-admin-maintenance-candidates-list="true"] > *',
          '[data-admin-mobile-maintenance-candidate-row="true"]',
        ],
        pageLabelSelector: `${adminScope("admin-maintenance")} >> ${PAGE_LABEL}`,
        nextSelector: `${adminScope("admin-maintenance")} >> ${NEXT_CONTROL}`,
      },
    ],
  },
  "clinic-informes-summary": {
    moduleId: "clinic-informes-summary",
    source: "client-slice",
    cookies: [A03_CLINIC_SESSION_COOKIE],
    stubs: [],
    // Two real renderings of the SAME identifier: the desktop row prints
    // "Informe #<id>", the mobile row "#<id> · <paciente>". Both yield the
    // report id, so identity stays semantic (never positional) and the runtime
    // gains no data-* attribute for the harness's benefit.
    rowIdentity: { kind: "text", pattern: /(?:Informe\s*)?#(\d+)/ },
    orderedIds: clinicReportIds,
    leaves: [
      {
        variantId: null,
        route: "/dashboard?module=informes",
        readinessSelector: '[data-clinic-reports-list-body="true"]',
        convergenceSelector: '[data-clinic-reports-list-body="true"]',
        rowSelectors: [
          '[data-clinic-reports-table-row="true"]',
          '[data-clinic-reports-mobile-row="true"]',
        ],
        pageLabelSelector: '[data-clinic-reports-pagination-status="true"]',
        nextSelector:
          '[data-clinic-reports-pagination-controls="true"] >> [aria-label="Página siguiente"]',
      },
    ],
  },
  "clinic-logistica-summary": {
    moduleId: "clinic-logistica-summary",
    source: "client-slice",
    cookies: [A03_CLINIC_SESSION_COOKIE, A03_ADAPTIVE_DATASET_COOKIE],
    stubs: [],
    rowIdentity: { kind: "text", pattern: /^(.+?)(?:\n|$)/ },
    orderedIds: fieldVisitClinicNames,
    leaves: [
      {
        variantId: null,
        route: "/dashboard?module=logistica",
        readinessSelector: '[data-clinic-logistics-list-body="true"]',
        convergenceSelector: '[data-clinic-logistics-list-body="true"]',
        rowSelectors: ['[data-clinic-logistics-row="true"]'],
        pageLabelSelector:
          '[data-clinic-logistics-pagination-footer="true"] [data-dashboard-pager-state="true"]',
        nextSelector:
          '[data-clinic-logistics-pagination-footer="true"] [data-dashboard-pager-next="true"]',
      },
    ],
  },
  "clinic-particular-tokens": {
    moduleId: "clinic-particular-tokens",
    source: "client-slice",
    cookies: [A03_CLINIC_SESSION_COOKIE],
    stubs: [STUB_CLINIC_TOKENS, STUB_STUDY_TRACKING],
    rowIdentity: { kind: "text", pattern: /\*{4}(\d{4})/ },
    orderedIds: staticIds(A03_TOKENS.map((token) => token.tokenLast4)),
    leaves: [
      {
        variantId: null,
        route: "/dashboard?module=tokens",
        readinessSelector: '[data-clinic-access-list-body="true"]',
        convergenceSelector: '[data-clinic-access-list-body="true"]',
        rowSelectors: [
          '[data-clinic-access-table-row="true"]',
          '[data-clinic-access-mobile-row="true"]',
        ],
        pageLabelSelector: '[data-clinic-access-pagination-status="true"]',
        nextSelector:
          '[data-clinic-access-pagination-controls="true"] >> [aria-label="Página siguiente"]',
      },
    ],
  },
  "logistics-recent-list": {
    moduleId: "logistics-recent-list",
    source: "client-slice",
    cookies: [A03_CLINIC_SESSION_COOKIE, A03_ADAPTIVE_DATASET_COOKIE],
    stubs: [],
    rowIdentity: { kind: "text", pattern: /^(.+?)(?:\n|$)/ },
    leaves: [
      {
        variantId: "recent-visits",
        route: "/dashboard/logistica",
        readinessSelector: '[data-logistics-recent-list-canvas="true"]',
        convergenceSelector: '[data-logistics-recent-list-canvas="true"]',
        rowSelectors: [
          '[data-logistics-recent-list-canvas="true"] >> nth=0 >> [data-logistics-recent-row="visita"]',
        ],
        pageLabelSelector:
          'nav[aria-label="Paginación de visitas recientes"] [data-dashboard-pager-state="true"]',
        nextSelector:
          'nav[aria-label="Paginación de visitas recientes"] [data-dashboard-pager-next="true"]',
        scopeNth: 0,
      },
      {
        variantId: "recent-plans",
        route: "/dashboard/logistica",
        readinessSelector: '[data-logistics-recent-list-canvas="true"]',
        convergenceSelector: '[data-logistics-recent-list-canvas="true"]',
        rowSelectors: [
          '[data-logistics-recent-list-canvas="true"] >> nth=1 >> [data-logistics-recent-row="ruta"]',
        ],
        pageLabelSelector:
          'nav[aria-label="Paginación de planes recientes"] [data-dashboard-pager-state="true"]',
        nextSelector:
          'nav[aria-label="Paginación de planes recientes"] [data-dashboard-pager-next="true"]',
        scopeNth: 1,
      },
    ],
  },
  "logistics-bounded-canvas": {
    moduleId: "logistics-bounded-canvas",
    source: "url-query",
    cookies: [A03_CLINIC_SESSION_COOKIE, A03_ADAPTIVE_DATASET_COOKIE],
    stubs: [],
    leaves: [
      bounded("bounded-visitas", "visitas", '[data-logistics-mobile-row="visita"]'),
      bounded("bounded-rutas", "rutas", '[data-logistics-mobile-row="ruta"]'),
      bounded(
        "bounded-metricas",
        "metricas",
        // Both regimes of the bounded canvas: the desktop pane keeps the 168px
        // metric block, the mobile pane renders the canonical operational row
        // (`data-logistics-metric-row`), exactly as the visitas/rutas leaves
        // above already name their mobile row. Row resolution is visible-
        // filtered, so exactly one regime answers at any viewport.
        '[data-dashboard-table-canvas="metricas"] [data-logistics-metric-block="true"], [data-dashboard-table-canvas="metricas"] [data-logistics-metric-row="true"]',
      ),
    ],
  },
});

/** Ordered id provider that depends on the variant (compound consumers). */
const VARIANT_ORDERED_IDS: Readonly<Record<string, OrderedIdsProvider>> = Object.freeze({
  "logistics-recent-list::recent-visits": fieldVisitClinicNames,
  "logistics-recent-list::recent-plans": routePlanNames,
});

// ── Observation engine ───────────────────────────────────────────────────────

function parseServerActionPayload(
  body: string,
  shape: "limit-offset" | "page-pagesize",
  label: string,
): { limit: number; offset: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`${label}: server action payload is not JSON — fail closed`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || typeof parsed[0] !== "object") {
    throw new Error(`${label}: unexpected server action argument list — fail closed`);
  }

  const args = parsed[0] as Record<string, unknown>;

  if (shape === "limit-offset") {
    const limit = args.limit;
    const offset = args.offset;
    if (!Number.isInteger(limit) || (limit as number) <= 0) {
      throw new Error(`${label}: payload has no positive integer "limit" — fail closed`);
    }
    if (!Number.isInteger(offset) || (offset as number) < 0) {
      throw new Error(`${label}: payload has no non-negative integer "offset" — fail closed`);
    }
    return { limit: limit as number, offset: offset as number };
  }

  const page = args.page;
  const pageSize = args.pageSize;
  if (!Number.isInteger(page) || (page as number) < 1) {
    throw new Error(`${label}: payload has no integer "page" >= 1 — fail closed`);
  }
  if (!Number.isInteger(pageSize) || (pageSize as number) <= 0) {
    throw new Error(`${label}: payload has no positive integer "pageSize" — fail closed`);
  }
  return {
    limit: pageSize as number,
    offset: ((page as number) - 1) * (pageSize as number),
  };
}

export async function prepareContext(page: Page, observer: ModuleObserver): Promise<void> {
  await suppressDevChrome(page);
  await clearDashboardModuleMemory(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.context().addCookies(
    observer.cookies.map((cookie) => ({ ...cookie, url: APP_ORIGIN })),
  );
  await installRequestRewrites(page, observer.rewrites ?? []);
  await installStubs(page, observer.stubs);
}

export async function observeLeaf(
  page: Page,
  observer: ModuleObserver,
  leaf: LeafTarget,
  viewportSlug: string,
): Promise<A03Observation> {
  const label = leafKey(observer.moduleId, viewportSlug, leaf.variantId);
  const identity = {
    moduleId: observer.moduleId,
    viewportSlug,
    variantId: leaf.variantId,
    leafKey: label,
  };

  const initialResponsePromise = observer.initialResponse
    ? page.waitForResponse((response) => {
        const expected = observer.initialResponse!;
        const url = new URL(response.url());
        return (
          response.request().method() === expected.method &&
          url.pathname === expected.pathname &&
          Object.entries(expected.searchParams).every(
            ([name, value]) => url.searchParams.get(name) === value,
          )
        );
      })
    : null;

  await page.goto(leaf.route);
  if (initialResponsePromise) {
    const initialResponse = await initialResponsePromise;
    expect(initialResponse.ok(), `${label}: rewritten initial response must be HTTP 2xx`).toBe(
      true,
    );
  }
  await expect(
    page.locator(`${leaf.readinessSelector} >> visible=true`).first(),
    `${label}: readiness`,
  ).toBeVisible({ timeout: 30_000 });

  if (leaf.prepare) await leaf.prepare(page);

  const rowsProbe = page.locator(`${leaf.rowSelectors.join(", ")} >> visible=true`).first();
  await expect(rowsProbe, `${label}: first data row`).toBeVisible({ timeout: 30_000 });

  // §20.2: each compound instance owns its measured container, so the leaf's
  // own container is the one drained — on page 1 as well as after the
  // transition. Simple modules resolve to index 0, their only match.
  const convergenceIndex = leaf.scopeNth ?? 0;
  await waitForAdaptiveConvergence(page, leaf.convergenceSelector, label, convergenceIndex);

  const pageLabel = leaf.pageLabelSelector
    ? page.locator(`${leaf.pageLabelSelector} >> visible=true`).first()
    : null;
  const nextControl = page.locator(`${leaf.nextSelector} >> visible=true`).first();

  if (observer.source === "url-query") {
    return observeUrlQueryLeaf(page, leaf, identity, label, nextControl);
  }

  if (pageLabel) {
    await expect(pageLabel, `${label}: page 1`).toHaveText(pageLabelPattern(1));
  }

  if (observer.source === "client-slice") {
    await page.waitForLoadState("networkidle");
    await waitForAdaptiveConvergence(page, leaf.convergenceSelector, label, convergenceIndex);
  }

  const firstPageRows = await resolveVisibleRows(page, leaf.rowSelectors, label);
  const firstPageCount = await firstPageRows.count();
  expect(firstPageCount, `${label}: converged first page must render rows`).toBeGreaterThan(0);

  if (observer.source === "server-request") {
    return observeServerRequestLeaf(
      page,
      observer,
      leaf,
      identity,
      label,
      pageLabel,
      nextControl,
    );
  }

  if (!pageLabel) {
    throw new Error(
      `${label}: a client-slice observer requires a pageLabelSelector — fail closed`,
    );
  }

  return observeClientSliceLeaf(
    page,
    observer,
    leaf,
    identity,
    label,
    pageLabel,
    nextControl,
    firstPageCount,
    convergenceIndex,
  );
}

async function observeUrlQueryLeaf(
  page: Page,
  leaf: LeafTarget,
  identity: ObservationIdentity,
  label: string,
  nextControl: Locator,
): Promise<UrlQueryObservation> {
  const pathname = new URL(leaf.route, APP_ORIGIN).pathname;

  // The bounded canvas replaces the URL ONCE with the measured page size.
  // Navigation completion is the convergence signal of this contract.
  await page.waitForURL(
    (url) =>
      url.pathname === pathname &&
      url.searchParams.get("offset") === "0" &&
      url.searchParams.get("limit") !== null,
    { timeout: 30_000 },
  );
  await waitForAdaptiveConvergence(page, leaf.convergenceSelector, label);

  const firstPageUrl = new URL(page.url());
  const firstPageLimit = Number(firstPageUrl.searchParams.get("limit"));
  expect(
    Number.isInteger(firstPageLimit) && firstPageLimit > 0,
    `${label}: converged first page must expose a positive integer limit`,
  ).toBe(true);

  const firstPageRows = await resolveVisibleRows(page, leaf.rowSelectors, label);
  expect(
    await firstPageRows.count(),
    `${label}: first page must be full before a second page can be observed`,
  ).toBe(firstPageLimit);

  await expect(nextControl, `${label}: next-page control`).toBeEnabled();
  await nextControl.click();

  await page.waitForURL(
    (url) => url.pathname === pathname && url.searchParams.get("offset") !== "0",
    { timeout: 30_000 },
  );
  await waitForAdaptiveConvergence(page, leaf.convergenceSelector, `${label} page 2`);

  const secondPageUrl = new URL(page.url());
  const limit = Number(secondPageUrl.searchParams.get("limit"));
  const offset = Number(secondPageUrl.searchParams.get("offset"));
  expect(Number.isInteger(limit) && limit > 0, `${label}: second page limit`).toBe(true);
  expect(Number.isInteger(offset) && offset > 0, `${label}: second page offset`).toBe(true);

  const secondPageRows = await resolveVisibleRows(page, leaf.rowSelectors, label);
  const secondPageCount = await secondPageRows.count();
  expect(
    secondPageCount,
    `${label}: second page must be COMPLETE (rendered rows === limit)`,
  ).toBe(limit);

  return {
    ...identity,
    source: "url-query",
    pathname: secondPageUrl.pathname,
    query: secondPageUrl.search,
    limit,
    offset,
    secondPageCount,
    provenance: `URL after one Página siguiente navigation from the adaptively replaced first page (${firstPageUrl.search})`,
  };
}

async function observeServerRequestLeaf(
  page: Page,
  observer: ModuleObserver,
  leaf: LeafTarget,
  identity: ObservationIdentity,
  label: string,
  pageLabel: Locator | null,
  nextControl: Locator,
): Promise<ServerRequestObservation> {
  const transport = observer.transport ?? "http";
  const pathname = observer.requestPathname ?? "";
  const wantedMethod = transport === "http" ? "GET" : "POST";

  // A slow server-action render can leave its page-1 request in flight after
  // the adaptive container itself is quiet. Drain it before arming the
  // transition listener so only the explicit page-2 action is observed.
  await page.waitForLoadState("networkidle");
  await waitForAdaptiveConvergence(
    page,
    leaf.convergenceSelector,
    `${label} before page 2`,
    leaf.scopeNth ?? 0,
  );

  // The expectation is armed BEFORE the click, so the observation is bound to
  // the transition and never selected afterwards from a pool.
  const captured: { url: string; body: string; hasNextAction: boolean }[] = [];
  const collect = (request: {
    method: () => string;
    url: () => string;
    postData: () => string | null;
    headers: () => Record<string, string>;
  }) => {
    if (request.method() !== wantedMethod) return;
    const url = new URL(request.url());
    if (url.pathname !== pathname) return;
    if (transport === "next-server-action") {
      const headers = request.headers();
      const hasNextAction = Object.keys(headers).some(
        (name) => name.toLowerCase() === "next-action",
      );
      if (!hasNextAction) return;
      captured.push({ url: request.url(), body: request.postData() ?? "", hasNextAction });
      return;
    }
    captured.push({ url: request.url(), body: "", hasNextAction: false });
  };
  page.on("request", collect);

  const transitionResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === pathname,
    { timeout: 30_000 },
  );

  await expect(nextControl, `${label}: next-page control`).toBeEnabled();
  await nextControl.click();

  await transitionResponse;
  if (pageLabel) {
    await expect(pageLabel, `${label}: second page reached`).toHaveText(pageLabelPattern(2));
  }

  const snapshotWindows = () =>
    captured.map((request) => {
      if (transport === "next-server-action") {
        const payload = parseServerActionPayload(
          request.body,
          observer.payloadShape ?? "limit-offset",
          label,
        );
        return { limit: payload.limit, offset: payload.offset };
      }

      const url = new URL(request.url);
      return {
        limit: Number(url.searchParams.get("limit")),
        offset: Number(url.searchParams.get("offset")),
      };
    });

  const assertExactlyOneTransitionRequest = () => {
    expect(
      captured.length,
      `${label}: one transition must produce exactly one ${wantedMethod} ${pathname} request; observed ${JSON.stringify(snapshotWindows())} (more than one is limit thrash — §20.3 records it, A03 never picks a convenient one)`,
    ).toBe(1);
  };

  // The window is read from the transition request BEFORE the DOM is examined,
  // so `limit` is always the value the runtime asked for and never a value read
  // back from whatever the page happens to be showing.
  assertExactlyOneTransitionRequest();

  let limit: number;
  let offset: number;
  let endpoint: string;

  if (transport === "next-server-action") {
    const parsedPayload = parseServerActionPayload(
      captured[0].body,
      observer.payloadShape ?? "limit-offset",
      label,
    );
    limit = parsedPayload.limit;
    offset = parsedPayload.offset;
    const url = new URL(captured[0].url);
    endpoint = `${url.pathname}${url.search}`;
  } else {
    const url = new URL(captured[0].url);
    limit = Number(url.searchParams.get("limit"));
    offset = Number(url.searchParams.get("offset"));
    endpoint = url.pathname;
  }

  expect(
    Number.isInteger(limit) && limit > 0,
    `${label}: transition must carry a positive integer limit`,
  ).toBe(true);
  expect(
    Number.isInteger(offset) && offset >= 0,
    `${label}: transition must carry a non-negative integer offset`,
  ).toBe(true);

  // Label-less pager: the ONLY thing standing between "page 2" and "page 1
  // re-rendered" is the request the click emitted, so it has to have advanced.
  // With a label, `Página 2` already carries that proof and `offset > 0` is
  // implied by the same request.
  if (!pageLabel) {
    expect(
      offset,
      `${label}: without a page label the transition request must advance the window (offset > 0)`,
    ).toBeGreaterThan(0);
  }

  // Geometric convergence proves the canvas stopped moving; it does NOT prove
  // the requested dataset reached the DOM — a canvas still holding the previous
  // window is perfectly stable. So the requested window is awaited web-first
  // and only then is convergence demanded of the render that resulted. The
  // request listener stays armed across both waits, so a second request emitted
  // while the window materialises is still recorded as thrash.
  const secondPageRows = await resolveVisibleRows(page, leaf.rowSelectors, label);
  await expect(
    secondPageRows,
    `${label}: second page window committed (rendered rows === requested limit ${limit})`,
  ).toHaveCount(limit, { timeout: 30_000 });

  await waitForAdaptiveConvergence(page, leaf.convergenceSelector, `${label} page 2`);
  page.off("request", collect);

  assertExactlyOneTransitionRequest();

  const secondPageCount = await secondPageRows.count();
  expect(
    secondPageCount,
    `${label}: second page must be COMPLETE (rendered rows === limit)`,
  ).toBe(limit);

  const pageProof = pageLabel
    ? "the second-page label"
    : `the advanced window of that request (offset ${offset} > 0) and the converged second-page render`;

  return {
    ...identity,
    source: "server-request",
    endpoint,
    method: wantedMethod,
    transport,
    limit,
    offset,
    secondPageCount,
    provenance:
      transport === "next-server-action"
        ? `single ${wantedMethod} ${pathname} server action (next-action header present) observed between the next-page click and the second-page render; page 2 proven by ${pageProof}`
        : `single ${wantedMethod} ${pathname} observed between the next-page click and the second-page render; page 2 proven by ${pageProof}`,
  };
}

async function observeClientSliceLeaf(
  page: Page,
  observer: ModuleObserver,
  leaf: LeafTarget,
  identity: ObservationIdentity,
  label: string,
  pageLabel: Locator,
  nextControl: Locator,
  firstPageCount: number,
  convergenceIndex: number,
): Promise<ClientSliceObservation> {
  const rowIdentity = observer.rowIdentity;
  if (!rowIdentity) {
    throw new Error(`${label}: client-slice observer without rowIdentity — fail closed`);
  }

  const cacheKey = `${observer.moduleId}::${leaf.variantId ?? ""}`;
  const provider = VARIANT_ORDERED_IDS[cacheKey] ?? observer.orderedIds;
  if (!provider) {
    throw new Error(`${label}: client-slice observer without ordered dataset — fail closed`);
  }

  // The hermetic dataset is invariant across viewports; read it once per page.
  let cache = datasetCache.get(page);
  if (!cache) {
    cache = new Map<string, string[]>();
    datasetCache.set(page, cache);
  }
  let orderedIds = cache.get(cacheKey);
  if (!orderedIds) {
    orderedIds = await provider(page);
    cache.set(cacheKey, orderedIds);
  }
  expect(orderedIds.length, `${label}: ordered dataset must not be empty`).toBeGreaterThan(0);
  expect(
    new Set(orderedIds).size,
    `${label}: ordered dataset identifiers must be unique (ambiguous identity cannot locate a slice)`,
  ).toBe(orderedIds.length);

  // The adaptive page size is the CARDINALITY of the converged first page,
  // never a superset request limit (audit §20.4, tokens deriva D-03).
  const limit = firstPageCount;

  await expect(nextControl, `${label}: next-page control`).toBeEnabled();
  await nextControl.click();

  await expect(pageLabel, `${label}: second page reached`).toHaveText(pageLabelPattern(2));
  await waitForAdaptiveConvergence(
    page,
    leaf.convergenceSelector,
    `${label} page 2`,
    convergenceIndex,
  );

  const secondPageRows = await resolveVisibleRows(page, leaf.rowSelectors, label);
  const secondPageIds = await readRowIdentities(secondPageRows, rowIdentity, `${label} page 2`);

  const firstRenderedFixtureIndex = orderedIds.indexOf(secondPageIds[0]);
  expect(
    firstRenderedFixtureIndex,
    `${label}: first rendered row of page 2 must exist in the ordered dataset`,
  ).toBeGreaterThanOrEqual(0);

  const expectedSlice = orderedIds.slice(
    firstRenderedFixtureIndex,
    firstRenderedFixtureIndex + secondPageIds.length,
  );
  expect(secondPageIds, `${label}: second page must be an exact contiguous slice`).toEqual(
    expectedSlice,
  );
  expect(
    new Set(secondPageIds).size,
    `${label}: second page must have no duplicate ids`,
  ).toBe(secondPageIds.length);
  expect(
    secondPageIds.length,
    `${label}: second page must be COMPLETE (pageItemCount === limit)`,
  ).toBe(limit);

  return {
    ...identity,
    source: "client-slice",
    limit,
    offset: firstRenderedFixtureIndex,
    firstRenderedFixtureIndex,
    secondPageFixtureIds: secondPageIds,
    pageItemCount: secondPageIds.length,
    secondPageCount: secondPageIds.length,
    provenance: `rendered rows after one next-page transition; position located in an independently read ordered dataset of ${orderedIds.length} items`,
  };
}

/** Canonical ordering: module → viewport → variant. */
export function sortObservations(
  observations: readonly A03Observation[],
): A03Observation[] {
  const moduleOrder = new Map<string, number>(
    A03_MODULE_IDS.map((id, index) => [id, index]),
  );
  const viewportOrder = new Map<string, number>(
    DASHBOARD_GEOMETRY_VIEWPORTS.map((viewport, index) => [viewport.slug, index]),
  );

  return [...observations].sort((a, b) => {
    const byModule = moduleOrder.get(a.moduleId)! - moduleOrder.get(b.moduleId)!;
    if (byModule !== 0) return byModule;
    const byViewport = viewportOrder.get(a.viewportSlug)! - viewportOrder.get(b.viewportSlug)!;
    if (byViewport !== 0) return byViewport;
    const variants = A03_MODULE_VARIANTS[a.moduleId];
    return variants.indexOf(a.variantId ?? "") - variants.indexOf(b.variantId ?? "");
  });
}

// ── Frozen baseline (§20.1–§20.4) ────────────────────────────────────────────

export const A03_BASELINE_SCHEMA = "a03-adaptive-limit-baseline/1";
/** Commit whose runtime produced the frozen observations. */
export const A03_BASELINE_COMMIT = "11e735c5613bb8869186a228ffec0588c463a669";

export type A03BaselineFile = {
  readonly schema: string;
  readonly baseCommit: string;
  readonly capturedAt: string;
  readonly environment: {
    /**
     * `process.platform` of the run that produced `observations`. Capture
     * PROVENANCE, not a runtime invariant: the adaptive limit is derived from
     * measured heights, and text rasterization differs enough between Windows
     * and Linux that one set cannot be assumed to hold on both. A platform
     * without a real capture fails closed instead of borrowing another's.
     */
    readonly platform: string;
    readonly browser: string;
    readonly devicePixelRatio: number;
    readonly colorScheme: string;
    readonly reducedMotion: string;
  };
  readonly moduleCount: number;
  readonly viewportCount: number;
  readonly primaryRecordCount: number;
  readonly leafObservationCount: number;
  /** The set captured on `environment.platform`. */
  readonly observations: readonly A03Observation[];
  /** Real captures from other platforms, keyed by `process.platform`. */
  readonly platformObservations: Readonly<
    Record<string, readonly A03Observation[]>
  >;
};

export function resolveBaselineObservations(
  file: A03BaselineFile,
  platform: string,
): { readonly observations: readonly A03Observation[]; readonly provenance: string } | null {
  if (platform === file.environment.platform) {
    return { observations: file.observations, provenance: file.environment.platform };
  }

  const platformSet = file.platformObservations[platform];
  if (platformSet && platformSet.length === file.leafObservationCount) {
    return { observations: platformSet, provenance: platform };
  }

  return null;
}

/**
 * Compares a fresh matrix against the frozen one, leaf by leaf. The comparison
 * is exact: `limit` and `offset` are integers derived from the runtime, so a
 * tolerance would only hide the drift the baseline exists to catch.
 */
export function assertMatchesBaseline(
  observations: readonly A03Observation[],
  baseline: readonly A03Observation[],
  provenance: string,
): void {
  const frozen = new Map(baseline.map((entry) => [entry.leafKey, entry]));
  const observed = new Map(observations.map((entry) => [entry.leafKey, entry]));

  const missing = [...frozen.keys()].filter((key) => !observed.has(key));
  const unexpected = [...observed.keys()].filter((key) => !frozen.has(key));
  expect(missing, `${provenance}: leaves present in the baseline but not observed`).toEqual(
    [],
  );
  expect(unexpected, `${provenance}: leaves observed but absent from the baseline`).toEqual(
    [],
  );

  for (const [leafKey, expected] of frozen) {
    const actual = observed.get(leafKey)!;
    expect(
      {
        source: actual.source,
        limit: actual.limit,
        offset: actual.offset,
        secondPageCount: actual.secondPageCount,
      },
      `${leafKey}: frozen adaptive window (${provenance})`,
    ).toEqual({
      source: expected.source,
      limit: expected.limit,
      offset: expected.offset,
      secondPageCount: expected.secondPageCount,
    });
  }
}

/** Full-matrix guards (§20.1–§20.2), asserted over the real observation set. */
export function assertMatrixIntegrity(observations: readonly A03Observation[]): void {
  expect(observations.length, "leaf observations").toBe(A03_LEAF_OBSERVATION_COUNT);
  expect(new Set(observations.map((o) => o.leafKey)).size, "unique leaf keys").toBe(
    A03_LEAF_OBSERVATION_COUNT,
  );

  const primaryKeys = observations.map((o) => primaryKey(o.moduleId, o.viewportSlug));
  expect(new Set(primaryKeys).size, "unique primary keys").toBe(A03_PRIMARY_RECORD_COUNT);

  for (const moduleId of A03_MODULE_IDS) {
    const moduleLeaves = observations.filter((o) => o.moduleId === moduleId);
    const modulePrimaries = new Set(
      moduleLeaves.map((o) => primaryKey(o.moduleId, o.viewportSlug)),
    );
    expect(modulePrimaries.size, `${moduleId}: primary records`).toBe(A03_VIEWPORT_COUNT);

    const expectedLeaves = Math.max(1, A03_MODULE_VARIANTS[moduleId].length) * A03_VIEWPORT_COUNT;
    expect(moduleLeaves.length, `${moduleId}: leaf observations`).toBe(expectedLeaves);
  }

  for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS) {
    const viewportPrimaries = new Set(
      observations
        .filter((o) => o.viewportSlug === viewport.slug)
        .map((o) => primaryKey(o.moduleId, o.viewportSlug)),
    );
    expect(viewportPrimaries.size, `${viewport.slug}: primary records`).toBe(A03_MODULE_COUNT);
  }

  for (const observation of observations) {
    expect(
      Number.isInteger(observation.limit) && observation.limit > 0,
      `${observation.leafKey}: limit`,
    ).toBe(true);
    expect(
      Number.isInteger(observation.offset) && observation.offset >= 0,
      `${observation.leafKey}: offset`,
    ).toBe(true);
    expect(observation.secondPageCount, `${observation.leafKey}: complete second page`).toBe(
      observation.limit,
    );
    expect(observation.provenance.length, `${observation.leafKey}: provenance`).toBeGreaterThan(0);
    expect(A03_SEMANTIC_SOURCE[observation.moduleId], `${observation.leafKey}: source`).toBe(
      observation.source,
    );
  }
}
