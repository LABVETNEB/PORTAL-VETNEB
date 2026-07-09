import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function exists(path: string): boolean {
  return existsSync(join(root, path));
}

function assertIncludes(source: string, marker: string, context: string): void {
  assert.ok(
    source.includes(marker),
    `${context} must include marker: ${marker}`,
  );
}

const REQUIRED_SECURITY_DOCS = [
  "docs/security/security-sessions-tenant-rls-audit.md",
  "docs/security/rls-enforcement-matrix.md",
  "docs/security/RBAC_MATRIX.md",
  "docs/security/ENDPOINT_PERMISSION_MATRIX.md",
  "docs/security/ENDPOINT_TEST_MATRIX.md",
  "docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md",
] as const;

const REQUIRED_GUARDRAIL_TESTS = [
  "test/architecture/security/security-critical-route-surface-registry.test.ts",
  "test/security-boundary-suite-completeness.test.ts",
  "test/architecture/security/security-cross-tenant-idor-contract.test.ts",
  "test/architecture/security/security-resource-ownership-boundaries.test.ts",
  "test/architecture/security/security-response-disclosure-boundaries.test.ts",
  "test/architecture/security/security-session-cookie-boundaries.test.ts",
  "test/architecture/security/security-mutation-permission-surface.test.ts",
  "test/security/security-trusted-origin-cors-boundaries.test.ts",
  "test/architecture/security/security-sensitive-log-redaction-boundaries.test.ts",
] as const;

const CRITICAL_ENDPOINT_MARKERS = [
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/reports",
  "/api/reports/:reportId/download-url",
  "/api/reports/:reportId/status",
  "/api/particular-tokens",
  "/api/particular/auth/login",
  "/api/particular/auth/me",
  "/api/particular/auth/report/preview-url",
  "/api/particular/auth/report/download-url",
  "/api/public/report-access/:token",
  "/api/admin/auth/login",
  "/api/admin/auth/me",
  "/api/admin/auth/logout",
  "/api/admin/system/schema-health",
  "/api/admin/audit-log",
  "/api/clinic/audit-log",
  "/api/admin/report-workflow",
  "/api/contact",
] as const;

test("security docs matrix drift guard keeps required source-of-truth docs present", () => {
  for (const path of REQUIRED_SECURITY_DOCS) {
    assert.equal(exists(path), true, `missing security source-of-truth doc: ${path}`);
  }
});

test("security docs matrix drift guard keeps runtime evidence and no-go anchors explicit", () => {
  const sessionsAudit = read("docs/security/security-sessions-tenant-rls-audit.md");
  const rlsMatrix = read("docs/security/rls-enforcement-matrix.md");
  const rbacMatrix = read("docs/security/RBAC_MATRIX.md");
  const endpointPermissionMatrix = read("docs/security/ENDPOINT_PERMISSION_MATRIX.md");
  const endpointTestMatrix = read("docs/security/ENDPOINT_TEST_MATRIX.md");
  const crossTenantRunbook = read("docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md");

  for (const [context, source] of [
    ["sessions audit", sessionsAudit],
    ["rls matrix", rlsMatrix],
    ["rbac matrix", rbacMatrix],
    ["cross tenant runbook", crossTenantRunbook],
  ] as const) {
    assertIncludes(source, "NO-GO", context);
  }

  assertIncludes(endpointPermissionMatrix, "Evidencia runtime requerida", "endpoint permission matrix");
  assertIncludes(endpointTestMatrix, "Abierto - pendiente evidencia runtime/staging", "endpoint test matrix");

  assertIncludes(sessionsAudit, "tenant isolation", "sessions audit");
  assertIncludes(sessionsAudit, "runtime/staging", "sessions audit");
  assertIncludes(sessionsAudit, "signed URLs", "sessions audit");
  assertIncludes(sessionsAudit, "cookies", "sessions audit");
  assertIncludes(sessionsAudit, "tokens", "sessions audit");

  assertIncludes(rlsMatrix, "Boundary esperado", "rls matrix");
  assertIncludes(rlsMatrix, "Enforcement esperado", "rls matrix");
  assertIncludes(rlsMatrix, "Evidencia runtime requerida", "rls matrix");
  assertIncludes(rlsMatrix, "clinicId", "rls matrix");
  assertIncludes(rlsMatrix, "particularTokenId", "rls matrix");
  assertIncludes(rlsMatrix, "tokenHash", "rls matrix");

  assertIncludes(rbacMatrix, "tenant isolation", "rbac matrix");
  assertIncludes(rbacMatrix, "no cross-tenant reads", "rbac matrix");
  assertIncludes(rbacMatrix, "no cross-tenant writes", "rbac matrix");
  assertIncludes(rbacMatrix, "no signed URL leak", "rbac matrix");

  assertIncludes(endpointPermissionMatrix, "Scope tenant/resource", "endpoint permission matrix");
  assertIncludes(endpointPermissionMatrix, "Respuesta esperada cross-tenant", "endpoint permission matrix");
  assertIncludes(endpointPermissionMatrix, "Evidencia runtime requerida", "endpoint permission matrix");

  assertIncludes(endpointTestMatrix, "Smoke runtime requerido", "endpoint test matrix");
  assertIncludes(endpointTestMatrix, "Guardrails base de inventario", "endpoint test matrix");
  assertIncludes(endpointTestMatrix, "test/architecture/security/security-critical-route-surface-registry.test.ts", "endpoint test matrix");
  assertIncludes(endpointTestMatrix, "test/architecture/security/security-cross-tenant-idor-contract.test.ts", "endpoint test matrix");

  assertIncludes(crossTenantRunbook, "CT-01", "cross tenant runbook");
  assertIncludes(crossTenantRunbook, "CT-16", "cross tenant runbook");
  assertIncludes(crossTenantRunbook, "signedUrl=present", "cross tenant runbook");
  assertIncludes(crossTenantRunbook, "signedUrl=absent", "cross tenant runbook");
  assertIncludes(crossTenantRunbook, "cookies", "cross tenant runbook");
  assertIncludes(crossTenantRunbook, "tokens", "cross tenant runbook");
});

test("security docs matrix drift guard keeps critical endpoint inventory documented", () => {
  const endpointPermissionMatrix = read("docs/security/ENDPOINT_PERMISSION_MATRIX.md");

  for (const endpoint of CRITICAL_ENDPOINT_MARKERS) {
    assertIncludes(endpointPermissionMatrix, endpoint, "endpoint permission matrix");
  }
});

test("security docs matrix drift guard keeps referenced guardrail tests present", () => {
  const combinedSecurityDocs = REQUIRED_SECURITY_DOCS.map((path) => read(path)).join("\n");

  for (const path of REQUIRED_GUARDRAIL_TESTS) {
    assert.equal(exists(path), true, `missing guardrail test file: ${path}`);

    const basename = path.slice("test/".length);
    assert.ok(
      combinedSecurityDocs.includes(path) || combinedSecurityDocs.includes(basename),
      `security docs must reference guardrail test: ${path}`,
    );
  }
});

test("security docs matrix drift guard keeps cross-tenant runtime evidence tied to CTIDOR registry", () => {
  const crossTenantRunbook = read("docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md");
  const crossTenantIdorContract = read("test/architecture/security/security-cross-tenant-idor-contract.test.ts");
  const rlsMatrix = read("docs/security/rls-enforcement-matrix.md");

  assertIncludes(crossTenantIdorContract, "CROSS_TENANT_IDOR_CONTRACTS", "ctidor registry");
  assertIncludes(crossTenantIdorContract, "cross-tenant IDOR contract matrix has unique IDs", "ctidor registry");
  assertIncludes(crossTenantIdorContract, "runtimeEvidence", "ctidor registry");
    assertIncludes(
    crossTenantIdorContract,
    "test/architecture/security/security-resource-ownership-boundaries.test.ts",
    "ctidor registry",
  );
  assertIncludes(
    crossTenantIdorContract,
    "test/architecture/security/security-response-disclosure-boundaries.test.ts",
    "ctidor registry",
  );

  for (const marker of [
    "Reports",
    "Report access tokens",
    "Particular tokens",
    "Audit log",
    "Workflow",
    "Clinic avatar / logo storage",
  ] as const) {
    assertIncludes(rlsMatrix, marker, "rls matrix");
  }

  for (const marker of ["CT-04", "CT-06", "CT-08", "CT-10", "CT-14", "CT-16"] as const) {
    assertIncludes(crossTenantRunbook, marker, "cross tenant runbook");
  }
});
