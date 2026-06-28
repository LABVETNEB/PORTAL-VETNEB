# test(dashboard): lock persisted module contracts

## Summary
- Added regression coverage for the persisted dashboard module behavior shipped in PR #997.
- Locked the storage keys, SSR/error safety, invalid-storage handling and non-sensitive
  `localStorage` usage with real runtime tests on the helper.
- Locked admin/clinic separation, URL-over-storage priority, replace-only restore (no loops) and
  hub accessibility via source-level controller contracts.
- Test-only: no implementation change was needed (no bug found).

## Problem
PR #997 introduced last-active-module persistence/restoration. The behavior was only covered by
light source-level assertions, leaving the security and navigation invariants under-protected
against future regressions.

## Scope
Files changed:
- `test/frontend-dashboard-last-module.test.ts` (reinforced: runtime helper tests + contract tests)

Not changed (no need):
- `test/auth-cookie-persistence-contract.test.ts` — its localStorage allowlist already covers the
  helper (added in PR #997) and the security invariant is green.
- Implementation files (`dashboard-last-module.ts`, both controllers) — behavior verified correct
  by the new runtime tests; no bug found, so nothing was modified.

Out of scope (untouched): `package.json`, `pnpm-lock.yaml`, `server/**`, `shared/**`,
`migrations/**`, `frontend/src/proxy.ts`, public routes, sidebar/frame/router/hub/workspace
components, `notification-destinations.ts`, CSS, FlexSearch, profile, password change. No
dependencies added; no UI/route/copy changes.

## What is locked
Helper (runtime tests — the helper is dependency-free, imported via `await import`):
- `readDashboardLastModule` returns `null` when `window` is unavailable (SSR).
- `readDashboardLastModule` returns `null` when `localStorage.getItem` throws.
- `writeDashboardLastModule` does not throw when `localStorage.setItem` throws.
- write→read round-trips a module id under the exact role key and isolates roles.
- exact keys: `vetneb:dashboard:last-module:clinic` / `vetneb:dashboard:last-module:admin`.

Security (source-level):
- The helper references none of: `session`, `auth`, `cookie`, `token`, `password`, `secret`,
  `jwt`, `bearer`, `clinicid`, `userid` — only a module id is stored.

Navigation (source-level controller contracts, both admin and clinic):
- URL `?module=` takes priority over storage (`if (searchParams.get("module")) return;`).
- Invalid stored value is ignored (`if (!lastModule) return;` after `parseModuleFromUrl`).
- Restore uses `router.replace`, never `router.push` (asserted both ways) → no history pollution,
  no loop (also guarded by `hasRestoredLastModule` / `hasManuallyReturnedToHub`).
- Manual "Volver a módulos" keeps the hub accessible (`setHasManuallyReturnedToHub(true)`).
- Admin uses only the admin key; clinic uses only the clinic key (cross-references asserted absent).
- Controllers contain no `localStorage` literal — storage stays centralized in the allowlisted helper.

Scope (source-level):
- The helper imports nothing; helper + both controllers reference none of `next/server`, `/api/`,
  `server/`, `fetch(`, `proxy` — the persisted-module surface stays client-side and self-contained.

## Security
The persisted value is only a module ID. No auth/session/token/cookie/user/clinic/patient data is
stored, and the tests fail fast if that ever changes.

## Validation
Commands executed and results:
- `git diff --check` → OK.
- `pnpm --dir frontend lint` → pass.
- `pnpm --dir frontend typecheck` → pass.
- `pnpm --dir frontend build` → pass.
- `pnpm test` → 2716 passed, 0 failed.
- `pnpm typecheck:test` → pass.
- `pnpm security:public-surface` → PASS (only pre-existing `[server-only]` markers in
  `frontend/src/proxy.ts`, untouched).

## Risk
Low. Test/contract hardening only; no runtime behavior changed.

## Rollback
Revert this PR.
