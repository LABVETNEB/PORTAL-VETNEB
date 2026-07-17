// Applicability gate for the legacy per-PR dashboard scope guards.
//
// Several historical dashboard PRs (PR-1/PR-2/PR-4/PR-6/PR-7/PR-8/PR-9 and the
// logistics hub) shipped a scope guard that inspects the current working-tree
// diff and forbids reaching into backend / auth / middleware / dependency
// surfaces. Those guards ran against the full diff unconditionally, so an
// unrelated architectural change — e.g. a docs-only domain shell under
// server/features/logistics/** — tripped every one of them even though it never
// touched the dashboard.
//
// The guards are PR-specific by intent: they only mean something when the diff
// actually contains dashboard-scoped files. When the changed set has no
// dashboard file the guard is not-applicable and must pass as a no-op instead
// of policing unrelated paths.
//
// This does NOT relax the guards for real dashboard PRs. Whenever a
// dashboard-scoped file is present in the diff the guard applies in full, so a
// dashboard PR still cannot touch backend, auth, middleware, routes or
// dependency manifests. The gate only removes false positives on
// non-dashboard PRs.

// A changed file belongs to the dashboard scope when it lives under one of the
// dashboard source/asset/e2e trees or is one of the dashboard test suites.
const DASHBOARD_SCOPE_PREFIXES = [
  "frontend/src/app/dashboard",
  "frontend/src/components/dashboard",
  "frontend/src/features/dashboard",
  "frontend/src/styles/dashboard",
  "frontend/e2e/clinic",
  "frontend/e2e/platform",
  "test/frontend-dashboard",
] as const;

export function isDashboardScopedFile(file: string): boolean {
  const normalized = file.trim();
  return DASHBOARD_SCOPE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * A legacy dashboard scope guard only applies when the current diff touches at
 * least one dashboard-scoped file. Returns `false` for diffs that leave the
 * dashboard untouched (e.g. a server/features/logistics/** docs-only PR), in
 * which case the caller should treat the guard as not-applicable and pass.
 */
export function dashboardScopeGuardApplies(
  changedFiles: readonly string[],
): boolean {
  return changedFiles.some((file) => isDashboardScopedFile(file));
}
