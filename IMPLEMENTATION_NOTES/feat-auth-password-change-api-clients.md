# feat(auth): add password change API clients

## Summary
- Added frontend API client `changeClinicPassword` for the authenticated clinic
  password change endpoint.
- Added frontend API client `changeAdminPassword` for the authenticated admin
  password change endpoint.
- Added a shared `ChangePasswordInput` / `ChangePasswordResponse` contract and
  static test contracts for endpoint, method, payload, credentials, error
  pattern and surface scope.
- No UI was added. This PR is API-client wrappers + tests + note only.

## Scope
Files changed:
- `frontend/src/lib/api.ts` — new `ChangePasswordInput`, `ChangePasswordResponse`
  types and `changeClinicPassword` / `changeAdminPassword` clients.

Files added:
- `test/frontend-api-password-change.test.ts` — contract tests for both clients.
- `IMPLEMENTATION_NOTES/feat-auth-password-change-api-clients.md` — this note.

Out of scope (intentionally untouched):
- UI / forms / dashboard / profile / settings components.
- Backend routes, `server/**`, drizzle / database / migrations.
- Reset password flow.
- Particular auth (token-backed, no password-hash contract — `change-password`
  intentionally absent for the particular surface).
- `package.json` / `pnpm-lock.yaml` / dependencies.
- PWA / service worker / FlexSearch.

## Implementation
- Both clients delegate to the existing shared `apiFetch<T>` helper, inheriting:
  - `credentials: "include"` (cookie-backed session, same as other auth clients).
  - `Content-Type: application/json` (auto-set by `apiFetch` for JSON bodies).
  - The existing `ApiResponseError` / generic-message error path (429 rate-limit
    handling, `BACKEND_OPERATION_ERROR_MESSAGE` for 5xx, etc.).
- Endpoints:
  - clinic: `POST /api/auth/change-password`
  - admin:  `POST /api/admin/auth/change-password`
- Body is built explicitly as `{ currentPassword, newPassword }` so only those
  two fields are serialized (no incidental field leakage).
- Response type mirrors the backend success body `{ success: true }`.

## Security
- No `localStorage` / `sessionStorage` / `document.cookie` writes; verified for
  the new clients and for the whole API client module.
- No frontend logging of password material (no `console.*` in the clients).
- Error handling follows the existing `apiFetch` pattern; no new enumerative
  failure messages were introduced.
- No tokens or hashes are exposed; only the generic `{ success: true }` is read.
- Particular surface is not touched; no `/api/particular/auth/change-password`
  client exists.

## Validation
Commands run on branch `feat/auth-password-change-api-clients` (results):
- `pnpm --dir frontend lint` -> PASS (exit 0)
- `pnpm --dir frontend typecheck` -> PASS (exit 0)
- `pnpm --dir frontend build` -> PASS (exit 0)
- `pnpm test` -> PASS (2735 passed, 0 failed)
- `pnpm typecheck:test` -> PASS (exit 0)
- `pnpm security:public-surface` -> PASS (no public devtools exposure findings;
  only pre-existing `server-only` markers in `frontend/src/proxy.ts`)
- Isolated `test/frontend-api-password-change.test.ts` -> 8 passed, 0 failed
- `git diff --check` -> clean (exit 0)

## Risk
Low. API-client wrappers and static contract tests only. No runtime backend,
schema, dependency or UI changes.

## Rollback
Revert this PR.
