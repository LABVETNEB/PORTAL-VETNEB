import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

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
  runtimeEvidence: readonly string[];
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
      "test/reports.fastify.test.ts",
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
      "test/reports.fastify.test.ts",
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
      "test/reports.fastify.test.ts",
      "test/architecture/security/security-sensitive-log-redaction-boundaries.test.ts",
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
      "test/report-access-tokens.fastify.test.ts",
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
      "test/clinic-audit.fastify.test.ts",
      "test/architecture/security/security-resource-ownership-boundaries.test.ts",
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
      "test/reports-status.fastify.test.ts",
      "test/architecture/security/security-mutation-permission-surface.test.ts",
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
      "test/study-tracking.fastify.test.ts",
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
      "test/particular-tokens.fastify.test.ts",
      "test/architecture/security/security-mutation-permission-surface.test.ts",
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
      "test/particular-auth.fastify.test.ts",
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
      "test/public-report-access.fastify.test.ts",
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
      "test/admin-study-tracking.fastify.test.ts",
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
      "test/report-access-tokens.fastify.test.ts",
      "test/study-tracking.fastify.test.ts",
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
      "test/reports.fastify.test.ts",
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
      "test/study-tracking.fastify.test.ts",
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
      "test/supabase-upload-success.test.ts",
      "test/supabase-storage-boundaries.test.ts",
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
