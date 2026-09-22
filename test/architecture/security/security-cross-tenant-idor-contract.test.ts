import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, posix } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { listTrackedFiles } from "../../helpers/tracked-source-files.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const REGISTRY_PATH =
  "test/architecture/security/security-cross-tenant-idor-contract.test.ts";

type ExpectedFailure = {
  status: 200 | 403 | 404;
  noDisclosure: boolean;
  reason: string;
};

type CrossTenantIdorContract = {
  id: string;
  actor: string;
  resource: string;
  operation: string;
  requiredOwnerKey: string;
  expectedFailure: ExpectedFailure;
  protectedSurface: string;
  // PENDING_RUNTIME_EVIDENCE: staging probes still to be collected (AGENTS.md
  // section 17). Descriptive only: nothing in this file executes them.
  runtimeEvidence: readonly string[];
  // Dereferenced by CTIDOR_EVIDENCE_CLAIMS: every path must carry a material claim.
  requiredTestEvidence: readonly string[];
  productionReadinessStatus: "pending_runtime_staging_evidence";
};

const CROSS_TENANT_IDOR_CONTRACTS: readonly CrossTenantIdorContract[] = [
  {
    id: "CTIDOR-001",
    actor: "clinic_a_session",
    resource: "reports_list",
    operation: "clinic A must not list reports from clinic B",
    requiredOwnerKey: "clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_or_missing_report_scope",
    },
    protectedSurface: "server/routes/reports.fastify.ts",
    runtimeEvidence: [
      "staging smoke with clinic A and clinic B sessions",
      "request and response pair proving clinic A cannot list clinic B reports",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/reports.fastify.test.ts",
      "test/architecture/security/security-resource-ownership-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-002",
    actor: "clinic_a_session",
    resource: "report_download",
    operation: "clinic A must not download report from clinic B",
    requiredOwnerKey: "clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_or_missing_cross_tenant_report_download",
    },
    protectedSurface: "server/routes/reports.fastify.ts",
    runtimeEvidence: [
      "staging download attempt with foreign report id",
      "log review without report payload disclosure",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/reports.fastify.test.ts",
      "test/architecture/security/security-response-disclosure-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-003",
    actor: "clinic_a_session",
    resource: "report_download_signed_url",
    operation: "clinic A must not generate signed URL for clinic B report",
    requiredOwnerKey: "clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_or_missing_cross_tenant_signed_url",
    },
    protectedSurface: "server/routes/reports.fastify.ts",
    runtimeEvidence: [
      "staging preview-url and download-url attempts for foreign report",
      "logs sanitized with no signed URL disclosure",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/reports.fastify.test.ts",
      "test/architecture/security/security-response-disclosure-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-004",
    actor: "clinic_a_session",
    resource: "report_access_tokens",
    operation: "clinic A must not revoke report access token owned by clinic B",
    requiredOwnerKey: "clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_or_missing_token_scope",
    },
    protectedSurface: "server/routes/report-access-tokens.fastify.ts",
    runtimeEvidence: [
      "staging revoke attempt with foreign token id",
      "no token metadata disclosure in error body",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/report-access-tokens.fastify.test.ts",
      "test/architecture/security/security-response-disclosure-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-005",
    actor: "clinic_a_session",
    resource: "clinic_audit_log",
    operation: "clinic A must not view audit log events from clinic B",
    requiredOwnerKey: "clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_or_filtered_cross_tenant_audit_events",
    },
    protectedSurface: "server/routes/clinic-audit.fastify.ts",
    runtimeEvidence: [
      "staging clinic audit listing with seeded events for two clinics",
      "verify only clinic A events are returned",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/clinic-audit.fastify.test.ts",
      "test/unit/contracts/clinic/clinic-audit.test.ts",
      "test/architecture/security/security-response-disclosure-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-006",
    actor: "clinic_a_session",
    resource: "report_status_update",
    operation: "clinic A must not modify report status from clinic B",
    requiredOwnerKey: "clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_or_missing_cross_tenant_report_status_update",
    },
    protectedSurface: "server/routes/reports-status.fastify.ts",
    runtimeEvidence: [
      "staging PATCH status attempt with foreign report id",
      "no report details leaked in failure payload",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/reports-status.fastify.test.ts",
      "test/architecture/security/security-resource-ownership-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-007",
    actor: "clinic_a_session",
    resource: "study_tracking_workflow",
    operation: "clinic A must not modify workflow for report from clinic B",
    requiredOwnerKey: "clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_or_missing_cross_tenant_workflow_case",
    },
    protectedSurface: "server/routes/study-tracking.fastify.ts",
    runtimeEvidence: [
      "staging PATCH study tracking case attempt for foreign clinic case",
      "verify no workflow transition for foreign case",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/study-tracking.fastify.test.ts",
      "test/architecture/security/security-resource-ownership-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-008",
    actor: "clinic_a_session",
    resource: "particular_tokens",
    operation: "clinic A must not link particular token to report from clinic B",
    requiredOwnerKey: "clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_or_missing_cross_tenant_particular_token_linking",
    },
    protectedSurface: "server/routes/particular-tokens.fastify.ts",
    runtimeEvidence: [
      "staging create or relink particular token attempt to foreign report",
      "verify operation fails before token write",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/particular-tokens.fastify.test.ts",
      "test/architecture/security/security-resource-ownership-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-009",
    actor: "particular_token_session",
    resource: "particular_report_access",
    operation: "particular token must not access report from another clinic context",
    requiredOwnerKey: "particularTokenId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_or_unlinked_particular_report",
    },
    protectedSurface: "server/routes/particular-auth.fastify.ts",
    runtimeEvidence: [
      "staging /api/particular/auth/report/* attempt for unlinked report",
      "verify no report data leaks in failure response",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/particular-auth.fastify.test.ts",
      "test/architecture/security/security-response-disclosure-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-010",
    actor: "public_report_token",
    resource: "public_report_tokens",
    operation: "public report token must not access another report or revoked token payload",
    requiredOwnerKey: "tokenHash",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_or_missing_public_report_token",
    },
    protectedSurface: "server/routes/public-report-access.fastify.ts",
    runtimeEvidence: [
      "staging access attempt with revoked or expired token",
      "verify generic 404 response with no report payload disclosure",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/public-report-access.fastify.test.ts",
      "test/architecture/security/security-response-disclosure-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-011",
    actor: "admin_session",
    resource: "admin_linking_targets",
    operation: "admin must validate target clinicId before linking report token or tracking",
    requiredOwnerKey: "clinicId",
    expectedFailure: {
      status: 403,
      noDisclosure: true,
      reason: "forbidden_mismatched_admin_target_clinic",
    },
    protectedSurface: "server/routes/admin-study-tracking.fastify.ts",
    runtimeEvidence: [
      "staging admin create/link actions with mismatched clinicId and report",
      "verify no foreign-link persistence",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts",
      "test/architecture/security/security-resource-ownership-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-012",
    actor: "clinic_a_session",
    resource: "clinic_scoped_lists",
    operation: "clinic-scoped list endpoints must filter by authenticated clinicId",
    requiredOwnerKey: "auth.clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_cross_tenant_list_results",
    },
    protectedSurface: "server/routes/report-access-tokens.fastify.ts",
    runtimeEvidence: [
      "staging list API checks for reports tokens and tracking surfaces",
      "verify all rows belong to authenticated clinic",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/report-access-tokens.fastify.test.ts",
      "test/integration/adapters/controllers/study-tracking.fastify.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-013",
    actor: "clinic_a_session",
    resource: "clinic_scoped_search",
    operation: "clinic-scoped search endpoints must filter by authenticated clinicId",
    requiredOwnerKey: "auth.clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_cross_tenant_search_results",
    },
    protectedSurface: "server/routes/reports.fastify.ts",
    runtimeEvidence: [
      "staging report search checks using report ids from two clinics",
      "verify search does not disclose foreign records",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/reports.fastify.test.ts",
      "test/architecture/security/security-resource-ownership-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-014",
    actor: "clinic_a_session",
    resource: "dashboard_counts",
    operation: "tenant counts and dashboard metrics must not mix clinics",
    requiredOwnerKey: "clinicId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_cross_tenant_metrics_rows",
    },
    protectedSurface: "server/routes/study-tracking.fastify.ts",
    runtimeEvidence: [
      "staging metrics or dashboard checks with two clinics",
      "verify clinic A totals do not include clinic B values",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/study-tracking.fastify.test.ts",
      "test/integration/adapters/controllers/reports.fastify.test.ts",
      "test/architecture/security/security-resource-ownership-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-015",
    actor: "clinic_a_session",
    resource: "avatar_storage_paths",
    operation: "avatar or logo storage path must keep clinic prefix and block foreign path traversal",
    requiredOwnerKey: "clinicId_storage_prefix",
    expectedFailure: {
      status: 403,
      noDisclosure: true,
      reason: "forbidden_cross_tenant_avatar_storage_path",
    },
    protectedSurface: "server/lib/supabase.ts",
    runtimeEvidence: [
      "staging avatar upload with crafted filename and foreign prefix",
      "verify resulting path remains under authenticated clinic namespace",
    ],
    requiredTestEvidence: [
      "test/unit/infrastructure/supabase-upload-success.test.ts",
      "test/unit/infrastructure/supabase-storage-boundaries.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-016",
    actor: "clinic_a_session",
    resource: "clinics_public_profile",
    operation:
      "foreign clinicId and avatar paths in query or body must not replace the authenticated clinic for GET PATCH POST avatar or DELETE avatar",
    requiredOwnerKey: "session.clinicUser.clinicId",
    expectedFailure: {
      status: 200,
      noDisclosure: true,
      reason:
        "foreign_tenant_selector_ignored_authenticated_clinic_returned",
    },
    protectedSurface:
      "server/routes/clinic-public-profile.fastify.ts",
    runtimeEvidence: [
      "staging four-operation probe with clinic A session and clinic B selectors",
      "verify profile rows search rows signed URLs and storage actions remain clinic A scoped",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts",
      "test/unit/clinics/clinic-public-profile-query-service.test.ts",
      "test/unit/clinics/clinic-public-profile-command-service.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-017",
    actor: "clinic_or_particular_session",
    resource: "study_tracking_cases_and_notifications",
    operation:
      "clinic and particular actors must derive scope from their authenticated realm and must not read or acknowledge foreign tracking resources",
    requiredOwnerKey: "auth.clinicId_or_particularTokenId",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_cross_tenant_study_tracking_resource",
    },
    protectedSurface: "server/routes/study-tracking.fastify.ts",
    runtimeEvidence: [
      "staging clinic and particular probes with foreign tracking and notification identifiers",
      "verify foreign selectors never replace the authenticated clinic or particular token",
    ],
    requiredTestEvidence: [
      "test/integration/adapters/controllers/study-tracking.fastify.test.ts",
      "test/integration/adapters/controllers/particular-study-tracking.fastify.test.ts",
      "test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts",
      "test/unit/application/study-tracking/clinic-study-tracking-operations.test.ts",
      "test/unit/application/study-tracking/particular-study-tracking-operations.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
  {
    id: "CTIDOR-018",
    actor: "clinic_session_and_public_report_token",
    resource: "particular_and_public_report_token_access",
    operation:
      "Particular and Report Access must hide missing foreign and cross-realm resources while ignoring hostile tenant selectors",
    requiredOwnerKey: "auth.clinicId_and_token_hash",
    expectedFailure: {
      status: 404,
      noDisclosure: true,
      reason: "hidden_missing_foreign_or_cross_realm_token_resource",
    },
    protectedSurface: "server/routes/public-report-access.fastify.ts",
    runtimeEvidence: [
      "staging probes across clinic and public access domains remain pending",
      "verify hostile selectors cannot replace authenticated clinic ownership",
    ],
    requiredTestEvidence: [
      "test/security/token-access-enumeration-disclosure-regression.test.ts",
    ],
    productionReadinessStatus: "pending_runtime_staging_evidence",
  },
] as const;

// TEST-GLOBAL-02: the registry above is a ledger. What makes it executable is
// CTIDOR_EVIDENCE_CLAIMS, which ties every requiredTestEvidence path to a real
// top-level test() and to the fragments inside that test body that bind actor,
// operation, owner scope and the asserted isolation outcome. None of this is
// runtime or staging evidence: it proves the ledger points at real tests.

type EvidenceClass =
  | "EXECUTABLE_TEST_EVIDENCE"
  | "STATIC_SOURCE_EVIDENCE"
  | "PENDING_RUNTIME_EVIDENCE"
  | "LEDGER_METADATA";

const CONTRACT_FIELD_CLASSES: {
  readonly [Field in Exclude<keyof CrossTenantIdorContract, "requiredTestEvidence">]: EvidenceClass;
} = {
  id: "LEDGER_METADATA",
  actor: "LEDGER_METADATA",
  resource: "LEDGER_METADATA",
  operation: "LEDGER_METADATA",
  requiredOwnerKey: "LEDGER_METADATA",
  expectedFailure: "LEDGER_METADATA",
  protectedSurface: "LEDGER_METADATA",
  runtimeEvidence: "PENDING_RUNTIME_EVIDENCE",
  productionReadinessStatus: "LEDGER_METADATA",
};

type IsolationBehavior =
  | "HIDDEN_AS_MISSING_404"
  | "REJECTED_403"
  | "REJECTED_400"
  | "CROSS_REALM_REJECTED_401"
  | "SCOPED_TO_AUTHENTICATED_OWNER"
  | "STORAGE_PATH_CONFINED";

const BEHAVIOR_STATUS: Readonly<Record<IsolationBehavior, number | null>> = {
  HIDDEN_AS_MISSING_404: 404,
  REJECTED_403: 403,
  REJECTED_400: 400,
  CROSS_REALM_REJECTED_401: 401,
  SCOPED_TO_AUTHENTICATED_OWNER: 200,
  STORAGE_PATH_CONFINED: null,
};

type ClaimAnchors = {
  // Exact title of a plain top-level test() in the evidence file.
  test: string;
  // Fragments that must appear inside that test body.
  operation: string;
  owner: string;
  fixture?: readonly string[];
  // Fragments that must appear inside an assertion statement of that body.
  isolation: readonly string[];
};

type ExecutableClaim = ClaimAnchors & {
  kind: "EXECUTABLE_TEST_EVIDENCE";
  path: string;
  // Server module the evidence file imports and the test executes.
  surface: string;
  invokes: string;
  actor: string;
  behavior: IsolationBehavior;
};

type StaticClaim = ClaimAnchors & {
  kind: "STATIC_SOURCE_EVIDENCE";
  path: string;
  // Server module the evidence file reads as source.
  surface: string;
  actor?: string;
};

type EvidenceClaim = ExecutableClaim | StaticClaim;

type StatusDivergence = {
  observed: readonly IsolationBehavior[];
  reason: string;
};

// The composition root registers every route plugin, so an app.inject() over
// createFastifyApp exercises the protected route through real routing.
const COMPOSITION_ROOT = "server/fastify-app.ts";

const IT = {
  reports: "test/integration/adapters/controllers/reports.fastify.test.ts",
  reportsStatus: "test/integration/adapters/controllers/reports-status.fastify.test.ts",
  reportAccessTokens:
    "test/integration/adapters/controllers/report-access-tokens.fastify.test.ts",
  clinicAudit: "test/integration/adapters/controllers/clinic-audit.fastify.test.ts",
  particularTokens: "test/integration/adapters/controllers/particular-tokens.fastify.test.ts",
  particularAuth: "test/integration/adapters/controllers/particular-auth.fastify.test.ts",
  publicReportAccess:
    "test/integration/adapters/controllers/public-report-access.fastify.test.ts",
  adminStudyTracking:
    "test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts",
  studyTracking: "test/integration/adapters/controllers/study-tracking.fastify.test.ts",
  particularStudyTracking:
    "test/integration/adapters/controllers/particular-study-tracking.fastify.test.ts",
  clinicPublicProfile:
    "test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts",
} as const;

const GUARD = {
  ownership: "test/architecture/security/security-resource-ownership-boundaries.test.ts",
  disclosure: "test/architecture/security/security-response-disclosure-boundaries.test.ts",
} as const;

const CLINIC_COOKIE = "ENV.cookieName}=session-token";
const PARTICULAR_COOKIE = "ENV.particularCookieName}=particular-session-token";
const ADMIN_COOKIE = "ENV.adminCookieName}=admin-session-token";

const ROUTE = {
  reports: "server/routes/reports.fastify.ts",
  reportsStatus: "server/routes/reports-status.fastify.ts",
  reportAccessTokens: "server/routes/report-access-tokens.fastify.ts",
  clinicAudit: "server/routes/clinic-audit.fastify.ts",
  particularTokens: "server/routes/particular-tokens.fastify.ts",
  particularAuth: "server/routes/particular-auth.fastify.ts",
  publicReportAccess: "server/routes/public-report-access.fastify.ts",
  adminStudyTracking: "server/routes/admin-study-tracking.fastify.ts",
  studyTracking: "server/routes/study-tracking.fastify.ts",
  particularStudyTracking: "server/routes/particular-study-tracking.fastify.ts",
  clinicPublicProfile: "server/routes/clinic-public-profile.fastify.ts",
} as const;

function injected(
  path: string,
  surface: string,
  claim: Omit<ExecutableClaim, "kind" | "path" | "surface" | "invokes">,
): ExecutableClaim {
  return { kind: "EXECUTABLE_TEST_EVIDENCE", path, surface, invokes: ".inject", ...claim };
}

function staticGuard(
  path: string,
  surface: string,
  claim: Omit<StaticClaim, "kind" | "path" | "surface" | "operation">,
): StaticClaim {
  return {
    kind: "STATIC_SOURCE_EVIDENCE",
    path,
    surface,
    operation: `readSource("${surface}")`,
    ...claim,
  };
}

const REPORTS_FOREIGN_HIDDEN_TEST =
  "reportsNativeRoutes unifica informe ajeno e inexistente como 404 seguro";
const REPORTS_FOREIGN_HIDDEN_ISOLATION = [
  "foreignResponse.statusCode, 404",
  "foreignResponse.body, missingResponse.body",
  'foreignResponse.body.includes("storagePath"), false',
] as const;
const REPORTS_FOREIGN_OWNER =
  "getReportById: async () => createReportFixture({ clinicId: 99 })";
const REPORTS_COUNT_CLAIM = injected(IT.reports, ROUTE.reports, {
  test: "reportsNativeRoutes GET / countReportsByClinicId recibe clinicId de la sesion autenticada",
  actor: CLINIC_COOKIE,
  operation: 'url: "/api/reports",',
  owner: "countCalls.push(clinicId)",
  isolation: ["countCalls, [3]"],
  behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
});
const OWNERSHIP_TEST =
  "clinic-owned resources reject cross-clinic reports tokens and tracking cases";
const OWNERSHIP_REPORTS_CLAIM = staticGuard(GUARD.ownership, ROUTE.reports, {
  test: OWNERSHIP_TEST,
  owner: "scope.clinicId",
  isolation: ["getReadClinicScope", "findClinicScopedReportById"],
});
const OWNERSHIP_STUDY_TRACKING_CLAIM = staticGuard(GUARD.ownership, ROUTE.studyTracking, {
  test: OWNERSHIP_TEST,
  owner: "clinicId: auth.clinicId",
  isolation: [
    "getClinicScopedStudyTrackingCase",
    "particularToken.clinicId !== input.actor.clinicId",
  ],
});
const DISCLOSURE_CLINIC_TEST =
  "clinic report and token surfaces do not disclose cross-scope resources as readable data";
const DISCLOSURE_REPORTS_CLAIM = staticGuard(GUARD.disclosure, ROUTE.reports, {
  test: DISCLOSURE_CLINIC_TEST,
  owner: "findClinicScopedReportById",
  isolation: ["reply.code(404).send", "Informe no encontrado"],
});
const STUDY_TRACKING_CROSS_CLINIC_CLAIM = injected(IT.studyTracking, ROUTE.studyTracking, {
  test: "studyTrackingNativeRoutes responde 404 gen\u00e9rico en PATCH /notifications/:notificationId/read cross-clinic",
  actor: CLINIC_COOKIE,
  operation: '"/api/study-tracking/notifications/999/read"',
  owner: "markCalls, [{ id: 999, clinicId: 3 }]",
  isolation: ["response.statusCode, 404"],
  behavior: "HIDDEN_AS_MISSING_404",
});
const STUDY_TRACKING_SELECTOR_CLAIM = injected(IT.studyTracking, ROUTE.studyTracking, {
  test: "studyTrackingNativeRoutes ignora clinicId de input y usa la cl\u00ednica autenticada",
  actor: CLINIC_COOKIE,
  operation: '"/api/study-tracking?clinicId=999&limit=5&offset=2"',
  owner: "calls[0]?.clinicId, 3",
  isolation: ['JSON.stringify(calls).includes("999"), false'],
  behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
});
const REPORT_ACCESS_TOKENS_DISCLOSURE_CLAIM = staticGuard(
  GUARD.disclosure,
  ROUTE.reportAccessTokens,
  {
    test: DISCLOSURE_CLINIC_TEST,
    owner: "getClinicScopedReportAccessToken",
    isolation: ["clinic hidden or missing token response"],
  },
);

const CTIDOR_EVIDENCE_CLAIMS: Readonly<Record<string, readonly EvidenceClaim[]>> = {
  "CTIDOR-001": [
    injected(IT.reports, ROUTE.reports, {
      test: "reportsNativeRoutes bloquea clinicId ajeno",
      actor: CLINIC_COOKIE,
      operation: '"/api/reports?clinicId=5"',
      owner: "clinicId=5",
      isolation: ["response.statusCode, 403", '"No autorizado para consultar otra clinica"'],
      behavior: "REJECTED_403",
    }),
    REPORTS_COUNT_CLAIM,
    OWNERSHIP_REPORTS_CLAIM,
  ],
  "CTIDOR-002": [
    injected(IT.reports, ROUTE.reports, {
      test: REPORTS_FOREIGN_HIDDEN_TEST,
      actor: CLINIC_COOKIE,
      operation: '"/api/reports/55/download-url"',
      owner: REPORTS_FOREIGN_OWNER,
      isolation: REPORTS_FOREIGN_HIDDEN_ISOLATION,
      behavior: "HIDDEN_AS_MISSING_404",
    }),
    DISCLOSURE_REPORTS_CLAIM,
  ],
  "CTIDOR-003": [
    injected(IT.reports, ROUTE.reports, {
      test: REPORTS_FOREIGN_HIDDEN_TEST,
      actor: CLINIC_COOKIE,
      operation: '"/api/reports/55/preview-url"',
      owner: REPORTS_FOREIGN_OWNER,
      fixture: ['"foreign report preview must not be signed"'],
      isolation: REPORTS_FOREIGN_HIDDEN_ISOLATION,
      behavior: "HIDDEN_AS_MISSING_404",
    }),
    DISCLOSURE_REPORTS_CLAIM,
  ],
  "CTIDOR-004": [
    injected(IT.reportAccessTokens, ROUTE.reportAccessTokens, {
      test: "reportAccessTokensNativeRoutes oculta revocacion de token ajeno antes de mutar",
      actor: 'ENV.cookieName + "=session-token"',
      operation: 'url: "/api/report-access-tokens/9/revoke"',
      owner: "clinicId, 3",
      isolation: ["response.statusCode, 404", "revokeCalled, false", "auditCalled, false"],
      behavior: "HIDDEN_AS_MISSING_404",
    }),
    REPORT_ACCESS_TOKENS_DISCLOSURE_CLAIM,
  ],
  "CTIDOR-005": [
    injected(IT.clinicAudit, ROUTE.clinicAudit, {
      test: "clinicAuditNativeRoutes expone GET / con payload estable y filtros clinic-scoped",
      actor: CLINIC_COOKIE,
      operation: '"/api/clinic/audit-log?event=report.public_accessed&limit=25&offset=5"',
      owner: "filterCalls.push({ query, clinicId })",
      isolation: ["filterCalls[0].clinicId, 3", "listCalls[0].clinicId, 3"],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    }),
    {
      kind: "EXECUTABLE_TEST_EVIDENCE",
      path: "test/unit/contracts/clinic/clinic-audit.test.ts",
      surface: "server/lib/admin-audit.ts",
      invokes: "buildClinicAuditListFilters",
      test: "buildClinicAuditListFilters fuerza clinicId de sesion",
      actor: "buildClinicAuditListFilters(",
      operation: 'event: "report.public_accessed",',
      owner: 'clinicId: "999",',
      isolation: ["filters.clinicId, 4"],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    },
    staticGuard(GUARD.disclosure, ROUTE.clinicAudit, {
      test: "audit export surfaces force auth scope rather than leaking cross-scope filters",
      actor: "authenticateFastifyClinicUser",
      owner: "clinicId: auth.clinicId",
      isolation: ["clinic audit forced clinic scope"],
    }),
  ],
  "CTIDOR-006": [
    injected(IT.reportsStatus, ROUTE.reportsStatus, {
      test: "reportsStatusNativeRoutes unifica informe ajeno e inexistente como 404 seguro",
      actor: CLINIC_COOKIE,
      operation: 'url: "/api/reports/55/status"',
      owner: REPORTS_FOREIGN_OWNER,
      isolation: [
        "foreignResponse.statusCode, 404",
        "foreignUpdateCalls, 0",
        "foreignResponse.body, missingResponse.body",
      ],
      behavior: "HIDDEN_AS_MISSING_404",
    }),
    staticGuard(GUARD.ownership, ROUTE.reportsStatus, {
      test: OWNERSHIP_TEST,
      owner: "auth.clinicId",
      isolation: ["transitionClinicReportStatus"],
    }),
  ],
  "CTIDOR-007": [
    STUDY_TRACKING_CROSS_CLINIC_CLAIM,
    injected(IT.studyTracking, ROUTE.studyTracking, {
      test: "studyTrackingNativeRoutes bloquea POST / porque el workflow es admin-only",
      actor: CLINIC_COOKIE,
      operation: 'url: "/api/study-tracking",',
      owner: "reportId: 55,",
      isolation: [
        "response.statusCode, 403",
        "createCalls.length, 0",
        '"Solo administraci\u00f3n puede crear seguimientos"',
      ],
      behavior: "REJECTED_403",
    }),
    OWNERSHIP_STUDY_TRACKING_CLAIM,
  ],
  "CTIDOR-008": [
    injected(IT.particularTokens, ROUTE.particularTokens, {
      test: "particularTokensNativeRoutes unifica informe ajeno e inexistente al vincular",
      actor: CLINIC_COOKIE,
      operation: 'url: "/api/particular-tokens/7/report"',
      owner: "createReportFixture({ clinicId: 99 })",
      isolation: [
        "foreignResponse.statusCode, 404",
        "updateCalls, 0",
        "foreignResponse.body, missingResponse.body",
      ],
      behavior: "HIDDEN_AS_MISSING_404",
    }),
    injected(IT.particularTokens, ROUTE.particularTokens, {
      test: "particularTokensNativeRoutes ignora clinicId de body y query frente a la sesi\u00f3n",
      actor: CLINIC_COOKIE,
      operation: 'url: "/api/particular-tokens?clinicId=99"',
      owner: "persistedClinicIds.push(input.clinicId)",
      isolation: ["persistedClinicIds, [3]", "listClinicIds, [3]"],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    }),
    staticGuard(GUARD.ownership, ROUTE.particularTokens, {
      test: OWNERSHIP_TEST,
      owner: "getClinicScopedReportById",
      isolation: ["clinic particular token report ownership", "getClinicScopedParticularToken"],
    }),
  ],
  "CTIDOR-009": [
    injected(IT.particularAuth, ROUTE.particularAuth, {
      test: "particularAuthNativeRoutes unifica informe ajeno e inexistente como 404 seguro",
      actor: PARTICULAR_COOKIE,
      operation: 'url: "/api/particular/auth/report/preview-url"',
      owner: "getReportById: async () => createReportFixture({ clinicId: 99 })",
      isolation: [
        "foreignResponse.statusCode, 404",
        "foreignResponse.body, missingResponse.body",
        'foreignResponse.body.includes("reportId"), false',
      ],
      behavior: "HIDDEN_AS_MISSING_404",
    }),
    staticGuard(GUARD.disclosure, ROUTE.particularAuth, {
      test: "particular surfaces keep unauthenticated inactive missing and unlinked states distinct",
      owner: "getClinicScopedReportById",
      isolation: ["particular hidden or missing linked report response"],
    }),
  ],
  "CTIDOR-010": [
    injected(IT.publicReportAccess, ROUTE.publicReportAccess, {
      test: "publicReportAccessNativeRoutes oculta token vinculado a clinica ajena como informe no encontrado",
      actor: 'const rawToken = "f".repeat(64);',
      operation: "url: `/api/public/report-access/${rawToken}`",
      owner: "const report = createReportFixture({ clinicId: 99 });",
      isolation: ["response.statusCode, 404", 'response.body.includes("token"), false'],
      behavior: "HIDDEN_AS_MISSING_404",
    }),
    staticGuard(GUARD.disclosure, ROUTE.publicReportAccess, {
      test: "public report access unifies unusable tokens as 404 and preserves 409 and 429",
      owner: "getReportAccessTokenWithReportByTokenHash",
      isolation: ["REPORT_NOT_FOUND_RESPONSE", "public unknown token response"],
    }),
  ],
  "CTIDOR-011": [
    injected(IT.adminStudyTracking, ROUTE.adminStudyTracking, {
      test: "adminStudyTrackingNativeRoutes mapea faltantes y ownership inv\u00e1lido al crear",
      actor: ADMIN_COOKIE,
      operation: 'url: "/api/admin/study-tracking",',
      owner: "getReportById: async () => ({ id: 55, clinicId: 9 })",
      fixture: ["statusCode: 400,", '"El informe no pertenece a la cl\u00ednica indicada"'],
      isolation: [
        "response.statusCode, scenario.statusCode",
        "JSON.parse(response.body).error, scenario.error",
      ],
      behavior: "REJECTED_400",
    }),
    injected(IT.adminStudyTracking, ROUTE.adminStudyTracking, {
      test: "adminStudyTrackingNativeRoutes conserva 404 antes de Zod y clinicId body sobre query en PATCH",
      actor: "ENV.adminCookieName}=admin-session-token",
      operation: 'url: "/api/admin/study-tracking/11?clinicId=3"',
      owner: "notFoundLookups, [{ trackingCaseId: 11, clinicId: 4 }]",
      isolation: ["notFound.statusCode, 404", "notFoundUpdates, []"],
      behavior: "HIDDEN_AS_MISSING_404",
    }),
    staticGuard(GUARD.ownership, ROUTE.adminStudyTracking, {
      test: "admin-owned linking validates target clinic before binding resources",
      owner: "report.clinicId !== input.data.clinicId",
      isolation: [
        "particularToken.clinicId !== input.data.clinicId",
        "belongsToClinic(report.clinicId, data.clinicId)",
      ],
    }),
  ],
  "CTIDOR-012": [
    injected(IT.reportAccessTokens, ROUTE.reportAccessTokens, {
      test: "reportAccessTokensNativeRoutes expone GET / con lista, filtros y paginaci\u00f3n",
      actor: CLINIC_COOKIE,
      operation: '"/api/report-access-tokens?reportId=55&limit=5&offset=2"',
      owner: "listCalls.push(params)",
      isolation: ["listCalls[0].clinicId, 3"],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    }),
    STUDY_TRACKING_SELECTOR_CLAIM,
  ],
  "CTIDOR-013": [
    injected(IT.reports, ROUTE.reports, {
      test: "reportsNativeRoutes expone GET /search con filtros normalizados",
      actor: CLINIC_COOKIE,
      operation: '"/api/reports/search?query= Luna &studyType= histopatologia &status=ready&limit=10&offset=4"',
      owner: "calls.push({ clinicId, query, studyType, limit, offset, currentStatus })",
      isolation: ["clinicId: 3,", 'response.body.includes("storagePath"), false'],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    }),
    OWNERSHIP_REPORTS_CLAIM,
  ],
  "CTIDOR-014": [
    injected(IT.studyTracking, ROUTE.studyTracking, {
      test: "studyTrackingNativeRoutes expone GET / con lista clinic-scoped",
      actor: CLINIC_COOKIE,
      operation: '"/api/study-tracking?reportId=55&particularTokenId=7&limit=5&offset=2"',
      owner: "listCalls.push(params)",
      isolation: ["clinicId: 3,", "body.count, 1", "body.trackingCases[0].clinicId, 3"],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    }),
    REPORTS_COUNT_CLAIM,
    OWNERSHIP_STUDY_TRACKING_CLAIM,
  ],
  "CTIDOR-015": [
    {
      kind: "EXECUTABLE_TEST_EVIDENCE",
      path: "test/unit/infrastructure/supabase-upload-success.test.ts",
      surface: "server/lib/supabase.ts",
      invokes: "uploadClinicAvatar",
      test: "uploadClinicAvatar neutraliza path traversal y separadores de ruta en fileName",
      actor: "clinicId: 21,",
      operation: 'fileName: "../avatar final.png",',
      owner: '"clinic-avatars/21/1710000000101-aabbccddeeff-avatar_final.png"',
      isolation: [
        'result.split("/").length, 3',
        'result.includes(".."), false',
        "capturedPath, result",
      ],
      behavior: "STORAGE_PATH_CONFINED",
    },
    {
      kind: "STATIC_SOURCE_EVIDENCE",
      path: "test/unit/infrastructure/supabase-storage-boundaries.test.ts",
      surface: "server/lib/supabase.ts",
      test: "storage boundaries sanitizan nombres antes de construir paths persistibles",
      operation: "sanitizeFileName\\(fileName: string, fallback: string\\)",
      owner: 'sanitizeFileName\\(fileName,\\s*"avatar"\\)',
      isolation: ["return sanitized \\|\\| fallback;"],
    },
  ],
  "CTIDOR-016": [
    injected(IT.clinicPublicProfile, ROUTE.clinicPublicProfile, {
      test: "clinicPublicProfileNativeRoutes mantiene GET en la cl\u00ednica de sesi\u00f3n ante selectores tenant extranjeros",
      actor: CLINIC_COOKIE,
      operation: '"/api/clinic/profile?clinicId=999"',
      owner: "snapshotClinicIds, [3]",
      isolation: [
        "response.statusCode, 200",
        'signedPaths, ["avatars/3/avatar.png"]',
        'response.body.includes("avatars/999"), false',
      ],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    }),
    injected(IT.clinicPublicProfile, ROUTE.clinicPublicProfile, {
      test: "clinicPublicProfileNativeRoutes mantiene PATCH en la cl\u00ednica de sesi\u00f3n sin persistir ni publicar input extranjero",
      actor: CLINIC_COOKIE,
      operation: '"/api/clinic/profile?clinicId=999"',
      owner: "patchClinicIds, [3]",
      isolation: [
        'Object.hasOwn(patchInput ?? {}, "clinicId"), false',
        'response.body.includes("avatars/999"), false',
      ],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    }),
    injected(IT.clinicPublicProfile, ROUTE.clinicPublicProfile, {
      test: "clinicPublicProfileNativeRoutes mantiene POST avatar en la cl\u00ednica de sesi\u00f3n y deriva todos los paths",
      actor: CLINIC_COOKIE,
      operation: '"/api/clinic/profile/avatar?clinicId=999"',
      owner: "uploadClinicIds, [3]",
      isolation: ["response.statusCode, 201", 'response.body.includes("avatars/999"), false'],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    }),
    injected(IT.clinicPublicProfile, ROUTE.clinicPublicProfile, {
      test: "clinicPublicProfileNativeRoutes mantiene DELETE avatar en la cl\u00ednica de sesi\u00f3n sin borrar path extranjero",
      actor: CLINIC_COOKIE,
      operation: '"/api/clinic/profile/avatar?clinicId=999"',
      owner: "removeClinicIds, [3]",
      isolation: ['["avatars/3/avatar.png"]', 'response.body.includes("avatars/999"), false'],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    }),
    {
      kind: "EXECUTABLE_TEST_EVIDENCE",
      path: "test/unit/clinics/clinic-public-profile-query-service.test.ts",
      surface: "server/features/clinics/clinic-public-profile-query-service.ts",
      invokes: "getClinicPublicProfileQuery",
      test: "query limita snapshot y firma al tenant recibido sin aceptar selectores alternativos",
      actor: "getClinicPublicProfileQuery(",
      operation: "createSignedStorageUrl: async (storagePath) =>",
      owner: "snapshotClinicIds.push(clinicId)",
      isolation: ["snapshotClinicIds, [37]", 'JSON.stringify(result).includes("avatars/999")'],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    },
    {
      kind: "EXECUTABLE_TEST_EVIDENCE",
      path: "test/unit/clinics/clinic-public-profile-command-service.test.ts",
      surface: "server/features/clinics/clinic-public-profile-command-service.ts",
      invokes: "patchClinicPublicProfileCommand",
      test: "commands a\u00edslan persistencia publicaci\u00f3n b\u00fasqueda firma y storage de selectores extranjeros",
      actor: "clinicId: 37,",
      operation: "uploadClinicPublicAvatarCommand(",
      owner: "clinicId: 999,",
      isolation: [
        "new Set([37])",
        'JSON.stringify(patchInputs).includes("999")',
        '"avatars/37/generated.png"',
      ],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    },
  ],
  "CTIDOR-017": [
    STUDY_TRACKING_CROSS_CLINIC_CLAIM,
    STUDY_TRACKING_SELECTOR_CLAIM,
    injected(IT.studyTracking, ROUTE.studyTracking, {
      test: "studyTrackingNativeRoutes no acepta sesiones admin o particular como cl\u00ednica",
      actor: "ENV.adminCookieName}=admin-session; ${ENV.particularCookieName}=particular-session",
      operation: 'url: "/api/study-tracking",',
      owner: "ENV.particularCookieName}=particular-session",
      isolation: ["response.statusCode, 401"],
      behavior: "CROSS_REALM_REJECTED_401",
    }),
    injected(IT.particularStudyTracking, ROUTE.particularStudyTracking, {
      test: "particularStudyTrackingNativeRoutes responde 404 gen\u00e9rico en PATCH /notifications/:notificationId/read cross-token",
      actor: PARTICULAR_COOKIE,
      operation: '"/api/particular/study-tracking/notifications/999/read"',
      owner: "markCalls, [{ id: 999, particularTokenId: 7 }]",
      isolation: ["response.statusCode, 404"],
      behavior: "HIDDEN_AS_MISSING_404",
    }),
    injected(IT.particularStudyTracking, ROUTE.particularStudyTracking, {
      test: "particularStudyTrackingNativeRoutes ignora selectores de input y usa el token autenticado",
      actor: PARTICULAR_COOKIE,
      operation: '"/api/particular/study-tracking/me?particularTokenId=999&clinicId=999"',
      owner: "calls.push(particularTokenId)",
      isolation: ["calls, [7]"],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    }),
    injected(IT.particularStudyTracking, ROUTE.particularStudyTracking, {
      test: "particularStudyTrackingNativeRoutes no acepta sesiones admin o cl\u00ednica como particular",
      actor: "ENV.adminCookieName}=admin-session; ${ENV.cookieName}=clinic-session",
      operation: 'url: "/api/particular/study-tracking/me",',
      owner: "ENV.cookieName}=clinic-session",
      isolation: ["response.statusCode, 401"],
      behavior: "CROSS_REALM_REJECTED_401",
    }),
    injected(IT.adminStudyTracking, ROUTE.adminStudyTracking, {
      test: "adminStudyTrackingNativeRoutes no acepta sesiones cl\u00ednica o particular como admin",
      actor: "ENV.cookieName}=clinic-session; ${ENV.particularCookieName}=particular-session",
      operation: 'url: "/api/admin/study-tracking",',
      owner: "ENV.cookieName}=clinic-session",
      isolation: ["response.statusCode, 401"],
      behavior: "CROSS_REALM_REJECTED_401",
    }),
    {
      kind: "EXECUTABLE_TEST_EVIDENCE",
      path: "test/unit/application/study-tracking/clinic-study-tracking-operations.test.ts",
      surface: "server/features/study-tracking/application/index.ts",
      invokes: "operations.acknowledgeClinicStudyTrackingNotification",
      test: "clinic operations aplican scope y preservan identidad en lecturas y acuses",
      actor: "clinicId: 7,",
      operation: "operations.getClinicStudyTrackingCase(",
      owner: '["mark-read", { id: 202, clinicId: 7 }]',
      isolation: ['["mark-all", { clinicId: 7 }]'],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    },
    {
      kind: "EXECUTABLE_TEST_EVIDENCE",
      path: "test/unit/application/study-tracking/particular-study-tracking-operations.test.ts",
      surface: "server/features/study-tracking/application/index.ts",
      invokes: "operations.acknowledgeParticularStudyTrackingNotification",
      test: "particular operations derivan todo el scope del token autenticado",
      actor: "particularTokenId: 13,",
      operation: "operations.getParticularStudyTrackingForToken(13)",
      owner: '["mark-read", { id: 11, particularTokenId: 13 }]',
      isolation: ['["mark-all", { particularTokenId: 13 }]'],
      behavior: "SCOPED_TO_AUTHENTICATED_OWNER",
    },
  ],
  "CTIDOR-018": [
    injected(
      "test/security/token-access-enumeration-disclosure-regression.test.ts",
      COMPOSITION_ROOT,
      {
        test: "Particular Access unifica missing y foreign, ignora selectores hostiles y redacta secretos",
        actor: "ENV.cookieName}=clinic-session-m35b",
        operation: 'url: "/api/particular-tokens/71",',
        owner: "lookup:${scenario}:71:${clinicId}",
        isolation: [
          "hiddenResponses[0].status, 404",
          "hiddenResponses[0].body, hiddenResponses[1].body",
          "listCalls, [{ clinicId, limit: 50, offset: 0 }]",
        ],
        behavior: "HIDDEN_AS_MISSING_404",
      },
    ),
    injected(
      "test/security/token-access-enumeration-disclosure-regression.test.ts",
      COMPOSITION_ROOT,
      {
        test: "Report Access publico ejecuta la matriz M35b sin enumeracion ni disclosure",
        actor: "scenario.rawToken",
        operation: "url: `/api/public/report-access/${scenario.rawToken}`",
        owner: "report: report({ clinicId: 999 })",
        isolation: [
          "response.statusCode, scenario.expectedStatus, scenario.name",
          "generic404.length, 5",
        ],
        behavior: "HIDDEN_AS_MISSING_404",
      },
    ),
  ],
};

// Ledger expectedFailure.status values that no executable claim demonstrates.
// They stay as declared (changing them is a security-policy decision, not a
// test change); this map makes each divergence explicit and exact.
const DECLARED_STATUS_DIVERGENCES: Readonly<Record<string, StatusDivergence>> = {
  "CTIDOR-001": {
    observed: ["REJECTED_403", "SCOPED_TO_AUTHENTICATED_OWNER"],
    reason: "list rejects a foreign clinicId selector with 403 and scopes counts to the session",
  },
  "CTIDOR-005": {
    observed: ["SCOPED_TO_AUTHENTICATED_OWNER"],
    reason: "audit listing forces the session clinicId filter and answers 200",
  },
  "CTIDOR-011": {
    observed: ["HIDDEN_AS_MISSING_404", "REJECTED_400"],
    reason: "admin target mismatch answers 400 on create and 404 on clinic-scoped update lookup",
  },
  "CTIDOR-012": {
    observed: ["SCOPED_TO_AUTHENTICATED_OWNER"],
    reason: "clinic lists filter by the authenticated clinic and answer 200",
  },
  "CTIDOR-013": {
    observed: ["SCOPED_TO_AUTHENTICATED_OWNER"],
    reason: "report search filters by the authenticated clinic and answers 200",
  },
  "CTIDOR-014": {
    observed: ["SCOPED_TO_AUTHENTICATED_OWNER"],
    reason: "counts and lists are computed for the authenticated clinic and answer 200",
  },
  "CTIDOR-015": {
    observed: ["STORAGE_PATH_CONFINED"],
    reason: "avatar paths are rebuilt under the clinic prefix; no HTTP rejection is involved",
  },
};

type EvidenceViolationCode =
  | "CONTRACT_WITHOUT_CLAIMS"
  | "CLAIMS_FOR_UNKNOWN_CONTRACT"
  | "PROTECTED_SURFACE_NOT_TRACKED"
  | "EVIDENCE_EMPTY"
  | "EVIDENCE_DUPLICATED"
  | "EVIDENCE_NOT_TRACKED"
  | "EVIDENCE_NOT_A_SPEC"
  | "EVIDENCE_SELF_REFERENCE"
  | "EVIDENCE_UNREADABLE"
  | "EVIDENCE_WITHOUT_CLAIM"
  | "CLAIM_OUTSIDE_EVIDENCE"
  | "CLAIM_SURFACE_NOT_TRACKED"
  | "CLAIM_SURFACE_NOT_IMPORTED"
  | "CLAIM_SURFACE_NOT_REFERENCED"
  | "CLAIM_TEST_MISSING"
  | "CLAIM_TEST_AMBIGUOUS"
  | "CLAIM_TEST_SKIPPED"
  | "CLAIM_NOT_EXERCISED"
  | "CLAIM_ANCHOR_MISSING"
  | "CLAIM_ISOLATION_NOT_ASSERTED"
  | "CLAIM_BEHAVIOR_NOT_EVIDENCED"
  | "CONTRACT_WITHOUT_EXECUTABLE_SURFACE_CLAIM"
  | "STATUS_DIVERGENCE_UNDECLARED"
  | "STATUS_DIVERGENCE_MISMATCH"
  | "STATUS_DIVERGENCE_STALE"
  | "PENDING_RUNTIME_AS_PATH"
  | "READINESS_PROMOTED";

type EvidenceViolation = {
  contractId: string;
  code: EvidenceViolationCode;
  detail: string;
};

type EvidenceCorpus = {
  readonly tracked: ReadonlySet<string>;
  read(path: string): string;
};

type TestBlock = {
  title: string;
  modifier: string | undefined;
  header: string;
  body: string;
};

const TEST_DECLARATION = /^test(?:\.([A-Za-z]+))?\(\s*(["'`])((?:\\.|(?!\2)[\s\S])*?)\2/gm;
const ASSERTION_STATEMENT = /\bassert(?:\.[A-Za-z]+|[A-Z][A-Za-z]*)\s*\([\s\S]*?\);/g;
const MODULE_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;
const REPO_PATH_SHAPE = /\b(?:server|frontend|shared|drizzle|scripts|test|docs)\/[A-Za-z0-9._\-/]+/;

function decodeLiteral(raw: string): string {
  return raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|.)/g, (_, escape: string) => {
    if (escape.startsWith("u{")) {
      return String.fromCodePoint(Number.parseInt(escape.slice(2, -1), 16));
    }
    if (escape.startsWith("u") && escape.length === 5) {
      return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    }
    return escape === "n" ? "\n" : escape;
  });
}

function parseTestBlocks(source: string): TestBlock[] {
  const declarations = [...source.matchAll(TEST_DECLARATION)];

  return declarations.map((declaration, index) => {
    const start = declaration.index ?? 0;
    const end = declarations[index + 1]?.index ?? source.length;
    const block = source.slice(start, end);
    const afterTitle = block.slice(declaration[0].length);
    const headerEnd = afterTitle.search(/=>|\bfunction\b/);

    return {
      title: decodeLiteral(declaration[3] ?? ""),
      modifier: declaration[1],
      header: headerEnd === -1 ? afterTitle : afterTitle.slice(0, headerEnd),
      body: block,
    };
  });
}

function importedModules(evidencePath: string, source: string): Set<string> {
  const modules = new Set<string>();

  for (const match of source.matchAll(MODULE_SPECIFIER)) {
    const specifier = match[1] ?? "";

    if (specifier.startsWith(".")) {
      modules.add(posix.normalize(posix.join(posix.dirname(evidencePath), specifier)));
    }
  }

  return modules;
}

function verifyClaim(
  contractId: string,
  claim: EvidenceClaim,
  corpus: EvidenceCorpus,
  sources: Map<string, string | null>,
  violations: EvidenceViolation[],
): boolean {
  const before = violations.length;
  const report = (code: EvidenceViolationCode, detail: string) =>
    violations.push({ contractId, code, detail: `${claim.path} :: ${detail}` });
  const source = sources.get(claim.path);

  if (typeof source !== "string") {
    return false;
  }

  if (!claim.surface.startsWith("server/") || !corpus.tracked.has(claim.surface)) {
    report("CLAIM_SURFACE_NOT_TRACKED", claim.surface);
  }

  if (claim.kind === "EXECUTABLE_TEST_EVIDENCE") {
    if (!importedModules(claim.path, source).has(claim.surface)) {
      report("CLAIM_SURFACE_NOT_IMPORTED", claim.surface);
    }
  } else if (
    !source.includes(`"${claim.surface}"`) &&
    !source.includes(`'${claim.surface}'`)
  ) {
    report("CLAIM_SURFACE_NOT_REFERENCED", claim.surface);
  }

  const matches = parseTestBlocks(source).filter((block) => block.title === claim.test);

  if (matches.length === 0) {
    report("CLAIM_TEST_MISSING", claim.test);
    return false;
  }

  if (matches.length > 1) {
    report("CLAIM_TEST_AMBIGUOUS", claim.test);
    return false;
  }

  const [block] = matches;

  if (block.modifier !== undefined || /\b(?:skip|todo)\b/.test(block.header)) {
    report("CLAIM_TEST_SKIPPED", claim.test);
    return false;
  }

  if (claim.kind === "EXECUTABLE_TEST_EVIDENCE" && !block.body.includes(`${claim.invokes}(`)) {
    report("CLAIM_NOT_EXERCISED", `${claim.test} :: ${claim.invokes}(`);
  }

  const bodyAnchors = [
    claim.actor,
    claim.operation,
    claim.owner,
    ...(claim.fixture ?? []),
  ].filter((anchor): anchor is string => anchor !== undefined);

  for (const anchor of bodyAnchors) {
    if (anchor.trim() === "" || !block.body.includes(anchor)) {
      report("CLAIM_ANCHOR_MISSING", `${claim.test} :: ${anchor}`);
    }
  }

  const assertions = [...block.body.matchAll(ASSERTION_STATEMENT)].map((match) => match[0]);

  if (claim.isolation.length === 0) {
    report("CLAIM_ISOLATION_NOT_ASSERTED", `${claim.test} :: <no isolation anchors>`);
  }

  for (const anchor of claim.isolation) {
    if (anchor.trim() === "" || !assertions.some((statement) => statement.includes(anchor))) {
      report("CLAIM_ISOLATION_NOT_ASSERTED", `${claim.test} :: ${anchor}`);
    }
  }

  if (claim.kind === "EXECUTABLE_TEST_EVIDENCE") {
    const status = BEHAVIOR_STATUS[claim.behavior];

    if (
      status !== null &&
      status !== 200 &&
      ![...claim.isolation, ...(claim.fixture ?? [])].some((anchor) =>
        anchor.includes(String(status)),
      )
    ) {
      report("CLAIM_BEHAVIOR_NOT_EVIDENCED", `${claim.test} :: ${claim.behavior}`);
    }
  }

  return violations.length === before;
}

function verifyIdorEvidence(
  contracts: readonly CrossTenantIdorContract[],
  claimsByContract: Readonly<Record<string, readonly EvidenceClaim[]>>,
  divergences: Readonly<Record<string, StatusDivergence>>,
  corpus: EvidenceCorpus,
): EvidenceViolation[] {
  const violations: EvidenceViolation[] = [];
  const sources = new Map<string, string | null>();
  const contractIds = new Set(contracts.map((contract) => contract.id));

  for (const id of Object.keys(claimsByContract)) {
    if (!contractIds.has(id)) {
      violations.push({ contractId: id, code: "CLAIMS_FOR_UNKNOWN_CONTRACT", detail: id });
    }
  }

  for (const id of Object.keys(divergences)) {
    if (!contractIds.has(id)) {
      violations.push({ contractId: id, code: "STATUS_DIVERGENCE_STALE", detail: "unknown contract" });
    }
  }

  for (const contract of contracts) {
    const report = (code: EvidenceViolationCode, detail: string) =>
      violations.push({ contractId: contract.id, code, detail });
    const claims = claimsByContract[contract.id] ?? [];
    const declared = contract.requiredTestEvidence;

    if (!corpus.tracked.has(contract.protectedSurface)) {
      report("PROTECTED_SURFACE_NOT_TRACKED", contract.protectedSurface);
    }

    if (contract.productionReadinessStatus !== "pending_runtime_staging_evidence") {
      report("READINESS_PROMOTED", String(contract.productionReadinessStatus));
    }

    for (const line of contract.runtimeEvidence) {
      if (REPO_PATH_SHAPE.test(line)) {
        report("PENDING_RUNTIME_AS_PATH", line);
      }
    }

    if (declared.length === 0) {
      report("EVIDENCE_EMPTY", "requiredTestEvidence");
    }

    if (new Set(declared).size !== declared.length) {
      report("EVIDENCE_DUPLICATED", declared.join(", "));
    }

    if (claims.length === 0) {
      report("CONTRACT_WITHOUT_CLAIMS", contract.id);
    }

    for (const path of declared) {
      if (typeof path !== "string" || path.trim() === "") {
        report("EVIDENCE_EMPTY", String(path));
        continue;
      }

      if (path === REGISTRY_PATH) {
        report("EVIDENCE_SELF_REFERENCE", path);
        continue;
      }

      if (!corpus.tracked.has(path)) {
        report("EVIDENCE_NOT_TRACKED", path);
        continue;
      }

      if (!path.startsWith("test/") || !path.endsWith(".test.ts")) {
        report("EVIDENCE_NOT_A_SPEC", path);
        continue;
      }

      if (!sources.has(path)) {
        try {
          sources.set(path, corpus.read(path));
        } catch {
          sources.set(path, null);
        }
      }

      if (sources.get(path) === null) {
        report("EVIDENCE_UNREADABLE", path);
        continue;
      }

      if (!claims.some((claim) => claim.path === path)) {
        report("EVIDENCE_WITHOUT_CLAIM", path);
      }
    }

    const executable: ExecutableClaim[] = [];

    for (const claim of claims) {
      if (!declared.includes(claim.path)) {
        report("CLAIM_OUTSIDE_EVIDENCE", `${claim.path} :: ${claim.test}`);
        continue;
      }

      const valid = verifyClaim(contract.id, claim, corpus, sources, violations);

      if (valid && claim.kind === "EXECUTABLE_TEST_EVIDENCE") {
        executable.push(claim);
      }
    }

    if (
      !executable.some(
        (claim) =>
          claim.surface === contract.protectedSurface || claim.surface === COMPOSITION_ROOT,
      )
    ) {
      report("CONTRACT_WITHOUT_EXECUTABLE_SURFACE_CLAIM", contract.protectedSurface);
    }

    const observed = [...new Set(executable.map((claim) => claim.behavior))].sort();
    const consistent = executable.some(
      (claim) => BEHAVIOR_STATUS[claim.behavior] === contract.expectedFailure.status,
    );
    const divergence = divergences[contract.id];

    if (consistent && divergence) {
      report("STATUS_DIVERGENCE_STALE", `declared ${contract.expectedFailure.status} is evidenced`);
    } else if (!consistent && !divergence) {
      report(
        "STATUS_DIVERGENCE_UNDECLARED",
        `declared ${contract.expectedFailure.status}, observed ${observed.join(" | ")}`,
      );
    } else if (!consistent && divergence) {
      const expected = [...new Set(divergence.observed)].sort();

      if (
        expected.join("|") !== observed.join("|") ||
        divergence.reason.trim().length < 20
      ) {
        report(
          "STATUS_DIVERGENCE_MISMATCH",
          `registered ${expected.join(" | ")}, observed ${observed.join(" | ")}`,
        );
      }
    }
  }

  return violations;
}

function createTreeCorpus(): EvidenceCorpus {
  return {
    tracked: new Set(listTrackedFiles()),
    read: (path) => readSource(path),
  };
}

function withMutations(
  base: EvidenceCorpus,
  mutation: {
    sources?: Readonly<Record<string, (source: string) => string>>;
    untrack?: readonly string[];
  },
): EvidenceCorpus {
  const tracked = new Set(base.tracked);

  for (const path of mutation.untrack ?? []) {
    tracked.delete(path);
  }

  return {
    tracked,
    read: (path) => {
      const source = base.read(path);
      const mutate = mutation.sources?.[path];
      return mutate ? mutate(source) : source;
    },
  };
}

function violationCodes(violations: readonly EvidenceViolation[]): EvidenceViolationCode[] {
  return [...new Set(violations.map((violation) => violation.code))].sort();
}

function contractById(id: string): CrossTenantIdorContract {
  const contract = CROSS_TENANT_IDOR_CONTRACTS.find((candidate) => candidate.id === id);
  assert.ok(contract, `missing contract ${id}`);
  return contract;
}

function replaceContract(
  id: string,
  patch: Partial<CrossTenantIdorContract>,
): CrossTenantIdorContract[] {
  return CROSS_TENANT_IDOR_CONTRACTS.map((contract) =>
    contract.id === id ? { ...contract, ...patch } : contract,
  );
}

function replaceOnce(source: string, from: string, to: string): string {
  assert.equal(source.includes(from), true, `mutation target must exist: ${from}`);
  return source.replace(from, to);
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function assertHasText(value: string, label: string): void {
  assert.equal(value.trim().length > 0, true, `${label} must not be blank`);
}

test("cross-tenant IDOR contract matrix has unique IDs", () => {
  const ids = CROSS_TENANT_IDOR_CONTRACTS.map((contract) => contract.id);

  assert.deepEqual(ids, uniqueValues(ids));
  assert.equal(ids.length >= 18, true);

  for (const id of ids) {
    assert.match(id, /^CTIDOR-\d{3}$/);
  }
});

test("every cross-tenant IDOR contract includes actor resource operation and protected surface", () => {
  for (const contract of CROSS_TENANT_IDOR_CONTRACTS) {
    assertHasText(contract.actor, `${contract.id} actor`);
    assertHasText(contract.resource, `${contract.id} resource`);
    assertHasText(contract.operation, `${contract.id} operation`);
    assertHasText(contract.protectedSurface, `${contract.id} protected surface`);
    assert.match(contract.protectedSurface, /^server\/[a-z0-9\-./]+\.ts$/);
  }
});

test("every cross-tenant IDOR contract uses explicit isolation semantics", () => {
  for (const contract of CROSS_TENANT_IDOR_CONTRACTS) {
    const { expectedFailure } = contract;
    assert.ok(
      expectedFailure.status === 200 ||
      expectedFailure.status === 403 ||
        expectedFailure.status === 404,
      `${contract.id} expected isolation status must be 200, 403 or 404`,
    );
    assert.equal(expectedFailure.noDisclosure, true, `${contract.id} must avoid disclosure`);
    assertHasText(expectedFailure.reason, `${contract.id} expected failure reason`);

    if (expectedFailure.status === 200) {
      assert.equal(
        contract.id,
        "CTIDOR-016",
        `${contract.id} may return 200 only when foreign selectors are ignored`,
      );
      assert.equal(
        expectedFailure.reason,
        "foreign_tenant_selector_ignored_authenticated_clinic_returned",
      );
    }
  }
});

test("every cross-tenant IDOR contract defines owner key runtime evidence and test evidence", () => {
  for (const contract of CROSS_TENANT_IDOR_CONTRACTS) {
    assertHasText(contract.requiredOwnerKey, `${contract.id} owner key`);
    assert.equal(contract.runtimeEvidence.length > 0, true, `${contract.id} runtime evidence required`);
    assert.equal(contract.requiredTestEvidence.length > 0, true, `${contract.id} test evidence required`);
    assert.equal(
      contract.productionReadinessStatus,
      "pending_runtime_staging_evidence",
      `${contract.id} readiness status`,
    );

    for (const evidenceLine of contract.runtimeEvidence) {
      assertHasText(evidenceLine, `${contract.id} runtime evidence line`);
      assert.equal(
        evidenceLine.trim().length >= 20,
        true,
        `${contract.id} runtime evidence must stay concrete`,
      );
    }
  }
});

test("cross-tenant IDOR matrix covers critical production attack surfaces", () => {
  const resources = CROSS_TENANT_IDOR_CONTRACTS.map((contract) => contract.resource.toLowerCase());
  const operations = CROSS_TENANT_IDOR_CONTRACTS.map((contract) => contract.operation.toLowerCase());

  const coverageChecks = [
    {
      name: "reports",
      covered: resources.some((value) => value.includes("report")),
    },
    {
      name: "report download signed url",
      covered: resources.some((value) => value.includes("signed_url")) || operations.some((value) => value.includes("signed url")),
    },
    {
      name: "report access tokens",
      covered: resources.some((value) => value.includes("report_access_token")),
    },
    {
      name: "particular tokens",
      covered: resources.some((value) => value.includes("particular_token")),
    },
    {
      name: "public report tokens",
      covered: resources.some((value) => value.includes("public_report_token")),
    },
    {
      name: "audit log",
      covered: resources.some((value) => value.includes("audit")),
    },
    {
      name: "workflow or status",
      covered: resources.some((value) => value.includes("workflow") || value.includes("status")),
    },
    {
      name: "avatar storage",
      covered: resources.some((value) => value.includes("avatar") || value.includes("storage")),
    },
    {
      name: "admin linking",
      covered: resources.some((value) => value.includes("admin_linking")) || operations.some((value) => value.includes("admin")),
    },
    {
      name: "clinics public profile",
      covered: resources.some((value) => value.includes("clinics_public_profile")),
    },
  ] as const;

  for (const check of coverageChecks) {
    assert.equal(check.covered, true, `missing cross-tenant IDOR coverage: ${check.name}`);
  }
});

test("Clinics contract links executable GET PATCH POST and DELETE tenant evidence", () => {
  const contract = CROSS_TENANT_IDOR_CONTRACTS.find(
    (candidate) => candidate.id === "CTIDOR-016",
  );

  assert.ok(contract);
  assert.equal(
    contract.protectedSurface,
    "server/routes/clinic-public-profile.fastify.ts",
  );
  assert.deepEqual(contract.requiredTestEvidence, [
    "test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts",
    "test/unit/clinics/clinic-public-profile-query-service.test.ts",
    "test/unit/clinics/clinic-public-profile-command-service.test.ts",
  ]);

  const integration = readSource(
    "test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts",
  );
  const queryService = readSource(
    "test/unit/clinics/clinic-public-profile-query-service.test.ts",
  );
  const commandService = readSource(
    "test/unit/clinics/clinic-public-profile-command-service.test.ts",
  );

  for (const marker of [
    "mantiene GET en la cl\u00ednica de sesi\u00f3n ante selectores tenant extranjeros",
    "mantiene PATCH en la cl\u00ednica de sesi\u00f3n sin persistir ni publicar input extranjero",
    "mantiene POST avatar en la cl\u00ednica de sesi\u00f3n y deriva todos los paths",
    "mantiene DELETE avatar en la cl\u00ednica de sesi\u00f3n sin borrar path extranjero",
  ]) {
    assert.equal(
      integration.includes(marker),
      true,
      `Clinics integration evidence must contain: ${marker}`,
    );
  }

  assert.equal(
    queryService.includes(
      "query limita snapshot y firma al tenant recibido sin aceptar selectores alternativos",
    ),
    true,
  );
  assert.equal(
    commandService.includes(
      "commands a\u00edslan persistencia publicaci\u00f3n b\u00fasqueda firma y storage de selectores extranjeros",
    ),
    true,
  );
});

test("Study Tracking contract links executable tenant and cross-realm evidence", () => {
  const contract = CROSS_TENANT_IDOR_CONTRACTS.find(
    (candidate) => candidate.id === "CTIDOR-017",
  );

  assert.ok(contract);
  assert.deepEqual(contract.requiredTestEvidence, [
    "test/integration/adapters/controllers/study-tracking.fastify.test.ts",
    "test/integration/adapters/controllers/particular-study-tracking.fastify.test.ts",
    "test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts",
    "test/unit/application/study-tracking/clinic-study-tracking-operations.test.ts",
    "test/unit/application/study-tracking/particular-study-tracking-operations.test.ts",
  ]);

  const clinicIntegration = readSource(contract.requiredTestEvidence[0]);
  const particularIntegration = readSource(contract.requiredTestEvidence[1]);
  const adminIntegration = readSource(contract.requiredTestEvidence[2]);
  const clinicOperations = readSource(contract.requiredTestEvidence[3]);
  const particularOperations = readSource(contract.requiredTestEvidence[4]);

  for (const marker of [
    "responde 404 gen\u00e9rico en PATCH /notifications/:notificationId/read cross-clinic",
    "ignora clinicId de input y usa la cl\u00ednica autenticada",
    "no acepta sesiones admin o particular como cl\u00ednica",
  ]) {
    assert.equal(clinicIntegration.includes(marker), true, marker);
  }

  for (const marker of [
    "responde 404 gen\u00e9rico en PATCH /notifications/:notificationId/read cross-token",
    "ignora selectores de input y usa el token autenticado",
    "no acepta sesiones admin o cl\u00ednica como particular",
  ]) {
    assert.equal(particularIntegration.includes(marker), true, marker);
  }

  assert.equal(
    adminIntegration.includes(
      "no acepta sesiones cl\u00ednica o particular como admin",
    ),
    true,
  );
  assert.equal(
    clinicOperations.includes(
      "clinic operations aplican scope y preservan identidad en lecturas y acuses",
    ),
    true,
  );
  assert.equal(
    particularOperations.includes(
      "particular operations derivan todo el scope del token autenticado",
    ),
    true,
  );
});

test("Token Access contract links joint non-enumeration and hostile-selector evidence", () => {
  const contract = CROSS_TENANT_IDOR_CONTRACTS.find(
    (candidate) => candidate.id === "CTIDOR-018",
  );

  assert.ok(contract);
  assert.deepEqual(contract.requiredTestEvidence, [
    "test/security/token-access-enumeration-disclosure-regression.test.ts",
  ]);
  assert.equal(
    contract.productionReadinessStatus,
    "pending_runtime_staging_evidence",
  );

  const jointEvidence = readSource(contract.requiredTestEvidence[0]);
  for (const marker of [
    "Particular Access unifica missing y foreign, ignora selectores hostiles y redacta secretos",
    "Particular Access unifica report foreign y missing y redacta fallos repository",
    "Report Access publico ejecuta la matriz M35b sin enumeracion ni disclosure",
  ]) {
    assert.equal(jointEvidence.includes(marker), true, marker);
  }
});

test("cross-tenant IDOR contract file does not contain dangerous inline secrets or real credentials", () => {
  const source = readSource("test/architecture/security/security-cross-tenant-idor-contract.test.ts");
  const replacementCharacter = String.fromCharCode(0xfffd);

  assert.equal(
    source.includes(replacementCharacter),
    false,
    "cross-tenant idor contract source must not contain replacement characters",
  );

  const forbiddenMarkers = [
    "SUPABASE_" + "SERVICE_ROLE_KEY",
    "DATABASE_" + "URL=",
    "SMTP_" + "PASS=",
    "token" + " real",
    "password" + " real",
  ] as const;

  for (const marker of forbiddenMarkers) {
    assert.equal(
      source.includes(marker),
      false,
      `cross-tenant idor contract source must not contain forbidden marker: ${marker}`,
    );
  }

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `cross-tenant idor contract source must stay ascii-only at index ${index}`,
    );
  }
});

test("cross-tenant IDOR requiredTestEvidence dereferences tracked specs with material claims", () => {
  const violations = verifyIdorEvidence(
    CROSS_TENANT_IDOR_CONTRACTS,
    CTIDOR_EVIDENCE_CLAIMS,
    DECLARED_STATUS_DIVERGENCES,
    createTreeCorpus(),
  );

  assert.deepEqual(violations, []);

  for (const contract of CROSS_TENANT_IDOR_CONTRACTS) {
    const claims = CTIDOR_EVIDENCE_CLAIMS[contract.id] ?? [];
    assert.equal(
      claims.some((claim) => claim.kind === "EXECUTABLE_TEST_EVIDENCE"),
      true,
      `${contract.id} must be backed by executable test evidence`,
    );
  }

  assert.deepEqual(
    Object.keys(CTIDOR_EVIDENCE_CLAIMS).sort(),
    CROSS_TENANT_IDOR_CONTRACTS.map((contract) => contract.id).sort(),
  );
});

test("cross-tenant IDOR ledger separates metadata, pending runtime evidence and test evidence", () => {
  assert.equal(CONTRACT_FIELD_CLASSES.runtimeEvidence, "PENDING_RUNTIME_EVIDENCE");

  for (const contract of CROSS_TENANT_IDOR_CONTRACTS) {
    for (const field of Object.keys(contract)) {
      assert.equal(
        field === "requiredTestEvidence" || Object.hasOwn(CONTRACT_FIELD_CLASSES, field),
        true,
        `${contract.id} field ${field} must be classified`,
      );
    }

    assert.equal(contract.productionReadinessStatus, "pending_runtime_staging_evidence");

    for (const line of contract.runtimeEvidence) {
      assert.doesNotMatch(line, REPO_PATH_SHAPE, `${contract.id} pending runtime evidence is not a test path`);
      assert.equal(
        contract.requiredTestEvidence.includes(line),
        false,
        `${contract.id} pending runtime evidence must not double as test evidence`,
      );
    }

    for (const claim of CTIDOR_EVIDENCE_CLAIMS[contract.id] ?? []) {
      const kind: EvidenceClass = claim.kind;
      assert.equal(
        kind === "EXECUTABLE_TEST_EVIDENCE" || kind === "STATIC_SOURCE_EVIDENCE",
        true,
        `${contract.id} claim kind ${kind}`,
      );
    }
  }
});

test("negative proof: an invented requiredTestEvidence path fails the evidence guard", () => {
  const invented = ["test", "security", "ctidor-invented-evidence.test.ts"].join("/");
  const contract = contractById("CTIDOR-002");
  const violations = verifyIdorEvidence(
    replaceContract(contract.id, {
      requiredTestEvidence: [...contract.requiredTestEvidence, invented],
    }),
    CTIDOR_EVIDENCE_CLAIMS,
    DECLARED_STATUS_DIVERGENCES,
    createTreeCorpus(),
  );

  assert.deepEqual(violationCodes(violations), ["EVIDENCE_NOT_TRACKED"]);
  assert.equal(violations[0]?.contractId, "CTIDOR-002");
  assert.equal(violations[0]?.detail, invented);

  const retiredRootPath = ["test", "reports.fastify.test.ts"].join("/");
  const stale = verifyIdorEvidence(
    replaceContract("CTIDOR-013", {
      requiredTestEvidence: [retiredRootPath, GUARD.ownership],
    }),
    CTIDOR_EVIDENCE_CLAIMS,
    DECLARED_STATUS_DIVERGENCES,
    createTreeCorpus(),
  );

  assert.deepEqual(violationCodes(stale), [
    "CLAIM_OUTSIDE_EVIDENCE",
    "CONTRACT_WITHOUT_EXECUTABLE_SURFACE_CLAIM",
    "EVIDENCE_NOT_TRACKED",
    "STATUS_DIVERGENCE_MISMATCH",
  ]);

  const untracked = verifyIdorEvidence(
    CROSS_TENANT_IDOR_CONTRACTS,
    CTIDOR_EVIDENCE_CLAIMS,
    DECLARED_STATUS_DIVERGENCES,
    withMutations(createTreeCorpus(), { untrack: [IT.particularAuth] }),
  );

  assert.deepEqual(violationCodes(untracked), [
    "CONTRACT_WITHOUT_EXECUTABLE_SURFACE_CLAIM",
    "EVIDENCE_NOT_TRACKED",
    "STATUS_DIVERGENCE_UNDECLARED",
  ]);
  assert.deepEqual(
    [...new Set(untracked.map((violation) => violation.contractId))],
    ["CTIDOR-009"],
  );
});

test("negative proof: materially invalid evidence fails the evidence guard", () => {
  const tree = createTreeCorpus();
  const verify = (
    corpus: EvidenceCorpus,
    contracts: readonly CrossTenantIdorContract[] = CROSS_TENANT_IDOR_CONTRACTS,
    claims: Readonly<Record<string, readonly EvidenceClaim[]>> = CTIDOR_EVIDENCE_CLAIMS,
    divergences: Readonly<Record<string, StatusDivergence>> = DECLARED_STATUS_DIVERGENCES,
  ) => violationCodes(verifyIdorEvidence(contracts, claims, divergences, corpus));

  const weakenedIsolation = withMutations(tree, {
    sources: {
      [IT.reportsStatus]: (source) =>
        replaceOnce(source, "assert.equal(foreignUpdateCalls, 0);", "void foreignUpdateCalls;"),
    },
  });
  assert.deepEqual(verify(weakenedIsolation), [
    "CLAIM_ISOLATION_NOT_ASSERTED",
    "CONTRACT_WITHOUT_EXECUTABLE_SURFACE_CLAIM",
    "STATUS_DIVERGENCE_UNDECLARED",
  ]);

  const renamedTest = withMutations(tree, {
    sources: {
      [IT.particularAuth]: (source) =>
        replaceOnce(source, "unifica informe ajeno e inexistente como 404 seguro", "renamed"),
    },
  });
  assert.deepEqual(verify(renamedTest), [
    "CLAIM_TEST_MISSING",
    "CONTRACT_WITHOUT_EXECUTABLE_SURFACE_CLAIM",
    "STATUS_DIVERGENCE_UNDECLARED",
  ]);

  const skippedTest = withMutations(tree, {
    sources: {
      [IT.publicReportAccess]: (source) =>
        replaceOnce(
          source,
          '"publicReportAccessNativeRoutes oculta token vinculado a clinica ajena como informe no encontrado",',
          '"publicReportAccessNativeRoutes oculta token vinculado a clinica ajena como informe no encontrado",\n  { skip: true },',
        ),
    },
  });
  assert.deepEqual(verify(skippedTest), [
    "CLAIM_TEST_SKIPPED",
    "CONTRACT_WITHOUT_EXECUTABLE_SURFACE_CLAIM",
    "STATUS_DIVERGENCE_UNDECLARED",
  ]);

  const detachedSurface = withMutations(tree, {
    sources: {
      [IT.clinicAudit]: (source) =>
        replaceOnce(
          source,
          '"../../../../server/routes/clinic-audit.fastify.ts"',
          '"../../../../server/routes/particular-audit.fastify.ts"',
        ),
    },
  });
  assert.deepEqual(verify(detachedSurface), [
    "CLAIM_SURFACE_NOT_IMPORTED",
    "CONTRACT_WITHOUT_EXECUTABLE_SURFACE_CLAIM",
  ]);

  const movedAnchor = withMutations(tree, {
    sources: {
      [IT.reports]: (source) =>
        replaceOnce(source, '"/api/reports?clinicId=5"', '"/api/reports"'),
    },
  });
  assert.deepEqual(verify(movedAnchor), ["CLAIM_ANCHOR_MISSING", "STATUS_DIVERGENCE_MISMATCH"]);

  const duplicatedTitle = withMutations(tree, {
    sources: {
      [IT.particularTokens]: (source) =>
        `${source}\ntest("particularTokensNativeRoutes unifica informe ajeno e inexistente al vincular", () => {});\n`,
    },
  });
  assert.deepEqual(verify(duplicatedTitle), [
    "CLAIM_TEST_AMBIGUOUS",
    "STATUS_DIVERGENCE_UNDECLARED",
  ]);

  const selfReference = replaceContract("CTIDOR-018", {
    requiredTestEvidence: [
      ...contractById("CTIDOR-018").requiredTestEvidence,
      REGISTRY_PATH,
    ],
  });
  assert.deepEqual(verify(tree, selfReference), ["EVIDENCE_SELF_REFERENCE"]);

  const nonSpec = replaceContract("CTIDOR-004", {
    requiredTestEvidence: [
      ...contractById("CTIDOR-004").requiredTestEvidence,
      contractById("CTIDOR-004").protectedSurface,
    ],
  });
  assert.deepEqual(verify(tree, nonSpec), ["EVIDENCE_NOT_A_SPEC"]);

  assert.deepEqual(verify(tree, replaceContract("CTIDOR-010", { requiredTestEvidence: [] })), [
    "CLAIM_OUTSIDE_EVIDENCE",
    "CONTRACT_WITHOUT_EXECUTABLE_SURFACE_CLAIM",
    "EVIDENCE_EMPTY",
    "STATUS_DIVERGENCE_UNDECLARED",
  ]);

  const staticOnly = {
    ...CTIDOR_EVIDENCE_CLAIMS,
    "CTIDOR-013": [OWNERSHIP_REPORTS_CLAIM],
  };
  assert.deepEqual(verify(tree, CROSS_TENANT_IDOR_CONTRACTS, staticOnly), [
    "CONTRACT_WITHOUT_EXECUTABLE_SURFACE_CLAIM",
    "EVIDENCE_WITHOUT_CLAIM",
    "STATUS_DIVERGENCE_MISMATCH",
  ]);

  const unclaimedEvidence = {
    ...CTIDOR_EVIDENCE_CLAIMS,
    "CTIDOR-002": (CTIDOR_EVIDENCE_CLAIMS["CTIDOR-002"] ?? []).filter(
      (claim) => claim.kind === "EXECUTABLE_TEST_EVIDENCE",
    ),
  };
  assert.deepEqual(verify(tree, CROSS_TENANT_IDOR_CONTRACTS, unclaimedEvidence), [
    "EVIDENCE_WITHOUT_CLAIM",
  ]);

  const undeclaredDivergence = replaceContract("CTIDOR-002", {
    expectedFailure: { ...contractById("CTIDOR-002").expectedFailure, status: 403 },
  });
  assert.deepEqual(verify(tree, undeclaredDivergence), ["STATUS_DIVERGENCE_UNDECLARED"]);

  const staleDivergence: Record<string, StatusDivergence> = {
    ...DECLARED_STATUS_DIVERGENCES,
    "CTIDOR-002": {
      observed: ["HIDDEN_AS_MISSING_404"],
      reason: "stale divergence kept after the ledger became consistent",
    },
  };
  assert.deepEqual(
    verify(tree, CROSS_TENANT_IDOR_CONTRACTS, CTIDOR_EVIDENCE_CLAIMS, staleDivergence),
    ["STATUS_DIVERGENCE_STALE"],
  );

  const promoted = replaceContract("CTIDOR-003", {
    runtimeEvidence: [GUARD.disclosure],
    productionReadinessStatus: "passed" as unknown as "pending_runtime_staging_evidence",
  });
  assert.deepEqual(verify(tree, promoted), ["PENDING_RUNTIME_AS_PATH", "READINESS_PROMOTED"]);
});
