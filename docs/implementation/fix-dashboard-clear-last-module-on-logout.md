# fix(dashboard): clear last module preferences on logout

## Summary
- Added a safe helper to clear persisted dashboard module preferences.
- Invoked it from the client-side logout flow.
- Added regression coverage for key removal and failure-safe behavior.

## Problem
Last active module preferences were intentionally non-sensitive, but remained after logout.

## Scope
Files changed:
- frontend/src/lib/dashboard-last-module.ts
- frontend/src/context/AuthContext.tsx
- frontend/src/components/dashboard/DashboardTopbar.tsx
- test/frontend-dashboard-last-module.test.ts
- IMPLEMENTATION_NOTES/fix-dashboard-clear-last-module-on-logout.md

Out of scope:
- auth backend changes
- cookie/session changes
- visual changes
- dependencies

## Security
Only non-sensitive dashboard module preference keys are cleared. No auth/session/token/cookie state is stored or modified by the helper.

## Validation
- `pnpm exec tsx --test test/frontend-dashboard-last-module.test.ts` - pass (14 tests).
- `git diff --check` - pass.
- `pnpm --dir frontend lint` - pass.
- `pnpm --dir frontend typecheck` - pass.
- `pnpm --dir frontend build` - pass after keeping the dashboard topbar inside the client boundary.
- `pnpm test` - pass (2721 tests).
- `pnpm typecheck:test` - pass.
- `pnpm security:public-surface` - pass (existing server-only proxy findings reported by the script).

## Risk
Low. Client-side preference cleanup only.

## Rollback
Revert this PR.
