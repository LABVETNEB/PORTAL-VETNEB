# TEST-ARCH-1 — PR-specific dashboard scope guards

## Problem

Eight legacy dashboard test suites ship a "scope guard" that reads the current
working-tree diff (`git diff --name-only`) and forbids the change from reaching
backend / auth / middleware / dependency surfaces:

- `frontend-dashboard-accessibility-focus-aria.test.ts` (PR-8)
- `frontend-dashboard-action-feedback-focus-polish.test.ts` (PR-4)
- `frontend-dashboard-admin-section-tabs.test.ts` (PR-7)
- `frontend-dashboard-filter-drawer-sticky-filters.test.ts` (PR-6)
- `frontend-dashboard-interaction-foundation.test.ts` (PR-1)
- `frontend-dashboard-logistics-hub.test.ts` (logistics hub)
- `frontend-dashboard-mobile-polish-bottom-actions.test.ts` (PR-9)
- `frontend-dashboard-workspace-layout-polish.test.ts` (PR-2)

These guards ran against the full diff unconditionally. An unrelated
architectural change — e.g. ARCH-4's docs-only domain shell under
`server/features/logistics/**` — matched the `server/` blocked prefix and tripped
every guard, even though the diff never touched the dashboard.

## Fix

The guards are PR-specific by intent. They only mean something when the diff
actually contains a dashboard-scoped file. A shared helper
`test/helpers/dashboard-scope-guard.ts` exposes:

```ts
dashboardScopeGuardApplies(changedFiles: readonly string[]): boolean
```

which returns `true` only when at least one changed file starts with a dashboard
scope prefix:

- `frontend/src/app/dashboard`
- `frontend/src/components/dashboard`
- `frontend/src/features/dashboard`
- `frontend/src/styles/dashboard`
- `frontend/e2e/dashboard`
- `test/frontend-dashboard`

Each guard now returns early (not-applicable, passes) when
`dashboardScopeGuardApplies(changedFiles)` is `false`.

## Non-applicability logic (exact)

- Diff touches **no** dashboard-scoped file (e.g. only
  `server/features/logistics/README.md` or `docs/**`) → guard **does not apply**,
  test passes without inspecting unrelated paths.
- Diff touches **at least one** dashboard-scoped file → guard **applies in full**,
  keeping every existing blocked prefix / blocked exact file / forbidden path.

## What this does NOT do

- It does **not** add a global allowlist for `server/features/logistics/**` (or any
  backend path) on dashboard PRs.
- It does **not** relax any prohibition when the diff touches the dashboard: a
  dashboard PR still cannot touch backend, auth, middleware, routes or dependency
  manifests.
- It only removes false positives on non-dashboard PRs.

The logistics-hub backend guard is triggered only by frontend
dashboard/logistics-hub files (`frontend/src/app/dashboard/logistica/**`), not by
the backend logistics feature shell under `server/features/logistics/**`.
