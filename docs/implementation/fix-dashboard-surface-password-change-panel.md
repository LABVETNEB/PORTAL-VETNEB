# fix(dashboard): surface password change panel in workspaces

## Summary
- Moved the password change security panel above existing workspace content.
- Clinic: security panel now appears before the public profile card.
- Admin: security panel now appears before the sessions card.

## Reason
The PR #1004 UI existed but was too hidden inside existing workspaces, below
other cards. On opening the workspace the user saw the pre-existing card first
and the "Seguridad" panel sat below the fold, so the change looked absent from
the dashboard. Reordering the JSX surfaces the panel immediately, without adding
any new module, navigation, route or behavior.

## Scope
Changed:
- `frontend/src/app/dashboard/page.tsx` — clinic `perfil` workspace renders
  `<PasswordChangePanel variant="clinic" />` before `<ClinicPublicProfileCard />`.
- `frontend/src/app/dashboard/admin/page.tsx` — admin `admin-sessions` workspace
  renders `<PasswordChangePanel variant="admin" />` before
  `<AdminSessionsReadOnlyCard />`. The `id="admin-sessions"` anchor and the
  sessions card are preserved.
- `test/frontend-dashboard-password-change-ui.test.ts` — added static order
  contracts (panel before the existing card on each surface) and a guard that no
  new "Seguridad" module is introduced.
- `IMPLEMENTATION_NOTES/fix-dashboard-surface-password-change-panel.md` (new) —
  this note.

Out of scope (intentionally untouched):
- backend / `server/**`
- API clients (`changeClinicPassword` / `changeAdminPassword` unchanged)
- routes / workspace controllers / module routing
- new dashboard module ("Seguridad")
- sidebar / hub / cards navigation
- particular auth
- dependencies / `package.json` / `pnpm-lock.yaml`
- PWA / service worker / public pages / GitHub workflows

## Behavior preserved
- Same imports, same `variant` props, same API clients, same copy, same module,
  same validation, success and error states. Only JSX order changed.

## Validation
Commands run on branch `fix/dashboard-surface-password-change-panel` (results):
- `pnpm --dir frontend lint` -> PASS (exit 0)
- `pnpm --dir frontend typecheck` -> PASS (exit 0)
- `pnpm --dir frontend build` -> PASS (exit 0)
- `pnpm test` -> PASS (2749 passed, 0 failed)
- `pnpm typecheck:test` -> PASS (exit 0)
- `pnpm security:public-surface` -> PASS (no public devtools exposure findings;
  only the pre-existing `server-only` markers in `frontend/src/proxy.ts`)
- `git diff --check` -> clean (exit 0)

## Risk
Low. JSX order only, no behavior, copy or routing changes.

## Rollback
Revert this PR.
