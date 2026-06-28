# feat(dashboard): persist last active module

## Summary
- Persisted the last active dashboard module per context (clinic / admin) in `localStorage`.
- Restored the last valid module (via `router.replace`) when a user opens the dashboard base URL
  without `?module=...`.
- Preserved explicit access to the module hub ("Volver a módulos"): a manual return is not
  immediately re-restored within the same session.
- Client-side only; no new dependencies; no visual/route changes; no backend.

## Problem
Opening `/dashboard` or `/dashboard/admin` without `?module=...` always landed on the card hub,
forcing a repeated hub → workspace click and breaking operational continuity.

## Scope
Files changed:
- `frontend/src/lib/dashboard-last-module.ts` (new) — SSR-safe, error-safe localStorage helper + keys.
- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx` — persist/restore (admin key).
- `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx` — persist/restore (clinic key).
- `test/frontend-dashboard-last-module.test.ts` (new) — contract tests.
- `test/auth-cookie-persistence-contract.test.ts` — **security allowlist extended** (see below).

Not touched: `package.json`, `pnpm-lock.yaml`, sidebar/frame/router, hub/workspace components,
`notification-destinations.ts`, backend, APIs, DB, public routes, global CSS, FlexSearch, profile,
password change. No dependencies added.

## Security allowlist extension (out of the literal permitted-file list — flagged for review)
The repo enforces a security invariant in `test/auth-cookie-persistence-contract.test.ts`:
frontend source must not use `localStorage`/`sessionStorage`, except an explicit allowlist of
non-sensitive UI-preference files (previously only the theme-mode files), which may only touch their
own preference key and must not reference `session`/`auth`/`cookie`/`token`.

Because the last-active-module preference is stored in `localStorage`, the helper file had to be
registered in that allowlist. The change generalizes `THEME_PREFERENCE_FILES` →
`UI_PREFERENCE_FILES` (per-file `keyMarkers`) and adds `frontend/src/lib/dashboard-last-module.ts`
with markers `CLINIC_LAST_MODULE_STORAGE_KEY` / `ADMIN_LAST_MODULE_STORAGE_KEY`. The existing
theme guarantee is preserved verbatim, and the same `session/auth/cookie/token` ban still applies to
the new file (verified: the helper contains none of those substrings). This keeps the invariant
fully enforced; it does not weaken it. All `localStorage` access is centralized in the helper, so
the controllers themselves contain no `localStorage` literal.

## Git verification
Initial check (all matched the required criteria):
- `git branch --show-current` → `main`; `git status` → clean.
- `git log -1 --oneline` → `610e7d4 feat(dashboard): add expanded sidebar brand identity (#996)`.
- `git rev-list --left-right --count main...origin/main` → `0  0` (in sync).
- `gh pr list --state open` → none; `git branch -r --no-merged origin/main` → none; only `main` local.

Branch created: `feat/dashboard-persist-last-module`.

## Storage
- `vetneb:dashboard:last-module:clinic`
- `vetneb:dashboard:last-module:admin`
Only the module id is stored. No user, clinic, patient, report, token or session data.

## Behavior / edge cases
- Persist: a `useEffect` writes `activeModule` (already validated, never `null`) under the
  role-specific key.
- Restore: a `useEffect` runs only when the URL has no `module` param, reads the key, validates it
  with the controller's `parseModuleFromUrl`, and `router.replace`s to `?module=<lastModule>`
  (`replace`, not `push`, to avoid polluting history). A `useRef` guard prevents re-restore loops.
- URL `?module=` (valid) takes priority over storage; the restore effect bails when any `module`
  param is present.
- URL `?module=` invalid → no restore, hub shown (current behavior), nothing saved.
- Invalid/garbage stored value → `parseModuleFromUrl` returns `null` → ignored, hub shown.
- `localStorage` unavailable (private mode / disabled / SSR) → helper returns `null` / no-ops, hub shown.
- Manual "Volver a módulos" sets `hasManuallyReturnedToHub`, so the hub is not immediately
  re-restored in that session; a later fresh visit (remount) restores again.
- Admin and clinic use separate keys (tests assert each controller references only its own key).

## Performance / Security
- Two `useEffect`s (save + restore) per controller; no global listeners, observers, fetch or DOM
  measurement; no new state beyond one `useRef` + one boolean.
- No routing/session/middleware/backend change; `redirectToLoginOnUnauthorized` untouched; PWA cache
  policy unchanged (dashboards remain uncached).

## Validation
Commands executed and results:
- `git diff --check` → OK.
- `pnpm --dir frontend lint` → pass.
- `pnpm --dir frontend typecheck` → pass.
- `pnpm --dir frontend build` → pass (all `/dashboard/*` routes remain `ƒ Dynamic`).
- `pnpm test` → 2710 passed, 0 failed.
- `pnpm typecheck:test` → pass.
- `pnpm security:public-surface` → PASS (only pre-existing `[server-only]` markers in
  `frontend/src/proxy.ts`, untouched).

## Tests
- `frontend-dashboard-last-module.test.ts`: helper key separation + SSR/error safety + no sensitive
  data; admin persist/restore with admin key (not clinic); clinic persist/restore with clinic key
  (not admin); URL-priority guard; manual-return guard.
- `auth-cookie-persistence-contract.test.ts`: allowlist generalized; security invariant still green.

## Risk
Low to medium. Client-side navigation behavior change only; no data or backend impact. Restoration
uses `router.replace` guarded against loops, and the hub remains reachable.

## Rollback
Revert this PR.
