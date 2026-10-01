export type SecurityGovernanceEntry = {
  id: string;
  path: string;
  category: "security" | "storage" | "public-search" | "validation";
  owner: "boundary" | "critical-route" | "docs-matrix";
  boundarySuite?: boolean;
  docsMatrix?: boolean;
  criticalRoute?: boolean;
};

// Canonical membership registry for the three TEST-GLOBAL-11 governance views.
export const SECURITY_GOVERNANCE_REGISTRY: readonly SecurityGovernanceEntry[] = [
  { id: "actor-relationship", path: "test/architecture/security/security-actor-relationship-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, criticalRoute: true },
  { id: "resource-ownership", path: "test/architecture/security/security-resource-ownership-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, docsMatrix: true, criticalRoute: true },
  { id: "write-attribution", path: "test/architecture/security/security-write-attribution-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, criticalRoute: true },
  { id: "access-lifecycle", path: "test/architecture/security/security-access-lifecycle-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, criticalRoute: true },
  { id: "response-disclosure", path: "test/architecture/security/security-response-disclosure-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, docsMatrix: true, criticalRoute: true },
  { id: "session-cookie", path: "test/architecture/security/security-session-cookie-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, docsMatrix: true, criticalRoute: true },
  { id: "cross-auth-surface", path: "test/architecture/security/security-cross-auth-surface-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, criticalRoute: true },
  { id: "sensitive-log-redaction", path: "test/architecture/security/security-sensitive-log-redaction-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, docsMatrix: true, criticalRoute: true },
  { id: "trusted-origin-cors", path: "test/security/security-trusted-origin-cors-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, docsMatrix: true, criticalRoute: true },
  { id: "audit-logging-phase", path: "test/security/security-audit-logging-phase-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, criticalRoute: true },
  { id: "rate-limit-isolation", path: "test/architecture/security/security-rate-limit-isolation-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, criticalRoute: true },
  { id: "validation-cutoff", path: "test/architecture/security/security-validation-cutoff-boundaries.test.ts", category: "security", owner: "boundary", boundarySuite: true, criticalRoute: true },
  { id: "boundary-suite", path: "test/architecture/security/security-boundary-suite-completeness.test.ts", category: "security", owner: "critical-route", docsMatrix: true, criticalRoute: true },
  { id: "critical-route", path: "test/architecture/security/security-critical-route-surface-registry.test.ts", category: "security", owner: "docs-matrix", docsMatrix: true },
  { id: "cross-tenant-idor", path: "test/architecture/security/security-cross-tenant-idor-contract.test.ts", category: "security", owner: "critical-route", docsMatrix: true, criticalRoute: true },
  { id: "production-invariants", path: "test/architecture/security/security-production-invariants.test.ts", category: "security", owner: "critical-route", criticalRoute: true },
  { id: "mutation-permission", path: "test/architecture/security/security-mutation-permission-surface.test.ts", category: "security", owner: "critical-route", docsMatrix: true, criticalRoute: true },
  { id: "storage-boundaries", path: "test/unit/infrastructure/supabase-storage-boundaries.test.ts", category: "storage", owner: "critical-route", criticalRoute: true },
  { id: "public-professionals-route", path: "test/integration/adapters/controllers/public-professionals-route-surface-invariants.test.ts", category: "public-search", owner: "critical-route", criticalRoute: true },
  { id: "public-professionals-fixtures", path: "test/architecture/public-professionals-fixture-suite-completeness-invariants.test.ts", category: "public-search", owner: "critical-route", criticalRoute: true },
  { id: "backend-ci-workflow", path: "test/unit/infrastructure/backend-ci-workflow.test.ts", category: "validation", owner: "critical-route", criticalRoute: true },
  { id: "package-scripts", path: "test/unit/infrastructure/package-scripts.test.ts", category: "validation", owner: "critical-route", criticalRoute: true },
];

export type GovernanceView = "boundarySuite" | "criticalRoute" | "docsMatrix";

export function governanceEntries(view: GovernanceView): readonly SecurityGovernanceEntry[] {
  return SECURITY_GOVERNANCE_REGISTRY.filter((entry) => entry[view]);
}

export function governancePaths(view: GovernanceView): string[] {
  return governanceEntries(view).map((entry) => entry.path);
}

export function assertSecurityGovernanceRegistry(
  entries: readonly SecurityGovernanceEntry[] = SECURITY_GOVERNANCE_REGISTRY,
): void {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id)) throw new Error(`duplicate or empty governance id: ${entry.id}`);
    if (!entry.path || paths.has(entry.path)) throw new Error(`duplicate or empty governance path: ${entry.path}`);
    if (!entry.boundarySuite && !entry.criticalRoute && !entry.docsMatrix) throw new Error(`unassigned governance entry: ${entry.id}`);
    ids.add(entry.id);
    paths.add(entry.path);
  }
  for (const view of ["boundarySuite", "criticalRoute", "docsMatrix"] as const) {
    if (!entries.some((entry) => entry[view])) throw new Error(`empty governance projection: ${view}`);
  }
}
