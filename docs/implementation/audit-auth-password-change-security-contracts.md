# audit(auth): password change security contracts

## Executive summary
Apto para implementar en el proximo PR, con alcance acotado: password change self-service para usuarios password-backed (`admin_users` y `clinic_users`) y exclusion explicita de `particular`, que es token-backed y no tiene `password_hash`.

La implementacion no debe mezclar este flujo con reset password ni con la gestion admin existente de credenciales de clinicas. Debe agregarse como contrato autenticado por cookie/sesion server-side, con verificacion de contrasena actual, hash Argon2id, rate limit propio, CSRF/trusted-origin, auditoria sin secretos y comportamiento explicito de sesiones.

## Current auth model reviewed
- User roles
  - Admin: `admin_users`, protegido por `admin_session_id`, dashboard `/dashboard/admin`, rutas `/api/admin/*`.
  - Clinica: `clinic_users`, roles `clinic_owner` y `clinic_staff`, protegido por `app_session_id`, dashboard `/dashboard`, rutas clinic/logistics/report.
  - Particular: `particular_tokens`, protegido por `particular_session_id`, token-backed para acceso a informe/seguimiento; no tiene password propio.
- Login/session source of truth
  - Source of truth runtime: cookies HttpOnly separadas por superficie y sesiones server-side en DB.
  - Admin: `admin_sessions.token_hash` -> `admin_users`.
  - Clinica: `active_sessions.token_hash` -> `clinic_users`.
  - Particular: `particular_sessions.token_hash` -> `particular_tokens`.
  - Frontend no usa localStorage/sessionStorage como auth source; `AuthContext` hidrata con `/api/auth/me`, y particulares hacen `/api/particular/auth/me`.
- Logout flow
  - Clinica: `POST /api/auth/logout`, borra `active_sessions` por hash de cookie y limpia `app_session_id`.
  - Admin: `POST /api/admin/auth/logout`, borra `admin_sessions` por hash de cookie, limpia `admin_session_id` y limpia cache de auth request-scoped.
  - Particular: `POST /api/particular/auth/logout`, borra `particular_sessions` por hash de cookie y limpia `particular_session_id`.
- Password storage/hash evidence
  - `server/lib/auth-security.ts` usa Argon2id para `hashPassword`.
  - `verifyPassword` soporta hashes Argon2 y legacy SHA-256, y marca `needsRehash`.
  - `clinic_users.password_hash` y `admin_users.password_hash` existen en `drizzle/schema.ts`.
  - `particular_tokens` tiene `token_hash`, `token_last4` y metadatos de paciente/tutor, no `password_hash`.
  - Los session tokens son random hex de 64 chars y se guardan hasheados con SHA-256.
- Existing auth tests
  - `test/auth-security.test.ts` cubre hash legacy, Argon2, session token y verify.
  - `test/auth-security-rehash-policy.test.ts` fija opciones de Argon2/rehash.
  - `test/auth-cookie-persistence-contract.test.ts` fija cookies persistentes, logout Max-Age=0, y no localStorage/sessionStorage auth.
  - `test/security-session-cookie-boundaries.test.ts` fija separacion de cookies/sesiones por dominio de auth.
  - `test/architecture/security/security-sensitive-log-redaction-boundaries.test.ts` fija no logging de password/session/token/hash en rutas auth.
  - `test/security-csrf-mutating-route-coverage.test.ts` registra rutas mutantes y exige trusted-origin.
  - `test/backend-api-no-store-cache-contract.test.ts` fija `cache-control: no-store` para API sensible.
  - `test/frontend-pwa-global-operational-contract.test.ts` fija que SW no cachee `/api/`, dashboard ni rutas privadas.
- Existing frontend profile/settings surface
  - Clinica tiene modulo `perfil` en `frontend/src/app/dashboard/page.tsx` y `ClinicPublicProfileCard`, pero es perfil publico institucional, no cuenta/seguridad.
  - Admin tiene modulos de operaciones, clinicas, sesiones, roles y auditoria, pero no modulo propio de cuenta/seguridad.
  - Admin ya puede crear y actualizar credenciales de usuarios clinica desde `AdminClinicsManagementCard` / `ClinicEditDrawer` y backend `/api/admin/users-roles/clinic/:clinicUserId/credentials`.
  - Particular usa la pagina publica `ParticularesContent`; no hay perfil/password porque el acceso es por token.

## Proposed password change contract

### Eligible users
1. Admin users: eligible.
2. Clinic users: eligible for both `clinic_owner` and `clinic_staff`.
3. Particular users: not eligible in this feature. They are token-backed; token rotation/reissue should be a separate token lifecycle feature.

### Endpoint design
Use separate self-service endpoints to preserve role separation and cookie boundaries:

- `PATCH /api/auth/password` for authenticated clinic users.
- `PATCH /api/admin/auth/password` for authenticated admin users.

Do not add password change to `/api/particular/auth`.

Each route should:
- Register `OPTIONS /password`.
- Call local `enforceTrustedOrigin` and remain covered by global `requireTrustedOriginForFastify`.
- Authenticate with the existing surface-specific auth helper before reading/modifying DB.
- Resolve the authenticated user by ID from the session, not from a username in the request body.
- Verify `currentPassword` against the current `password_hash`.
- Hash `newPassword` with `hashPassword`.
- Update only the authenticated principal's own row.
- Rotate the current session token and invalidate other sessions for the same principal, or at minimum invalidate all other sessions and document why current session is retained.

### Request body
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

Rules:
- No `username`, `email`, `role`, `clinicId`, `adminUserId`, `clinicUserId` or target id in the body.
- Do not trim passwords silently. Either preserve exact bytes or reject leading/trailing whitespace explicitly.
- Recommended max length: 128 or 256 characters to avoid excessive Argon2 work.

### Response body
Success:
```json
{
  "success": true,
  "message": "Password updated"
}
```

If the route rotates the session, return the new cookie via `Set-Cookie`; do not return the token in JSON.

### Status codes
- `200`: password changed.
- `400`: malformed body or new password policy violation.
- `401`: missing/invalid/expired session, missing user, or current password verification failure if choosing fully generic auth-style failure.
- `403`: untrusted origin / CSRF boundary.
- `409`: optional, only for non-sensitive policy conflicts such as `newPassword` equals current password. Prefer `400` if avoiding extra branch semantics.
- `429`: password-change rate limit exceeded.
- `500`: generic unexpected failure; no DB internals, hashes, session tokens or password details.

For current password mismatch, prefer a generic public error such as `No se pudo actualizar la credencial.` Do not reveal whether user lookup, session, or current password verification failed beyond the normal auth failures already emitted by the session middleware.

### Validation rules
- `currentPassword`: required string, non-empty, max length enforced.
- `newPassword`: required string, recommended min 12, max 128/256.
- Reject if `newPassword === currentPassword`.
- Recommended policy without new dependencies:
  - at least 12 characters;
  - at least one letter and one number;
  - reject all-whitespace;
  - reject a tiny internal denylist of obvious values only if the repo accepts maintaining it.
- Do not reuse the admin-created clinic credential minimum of 8 chars as the self-service target unless product explicitly chooses that lower bar.

### Rate limiting
Add a route-specific rate limit distinct from login:
- Key by surface + authenticated principal id + IP hash.
- Suggested default: 5 failed attempts per 15 minutes.
- Increment on current password mismatch and malformed body that includes a session.
- Return `RateLimit-*` and `Retry-After` consistent with login rate limit behavior.
- Do not use raw username/password/currentPassword/newPassword in keys or metadata.

### Session behavior
Recommended strongest contract:
- On success, create a new session token for the current request, store only its hash, set the corresponding HttpOnly cookie, delete the old session hash, and delete all other sessions for the same admin/clinic user.
- If transactionally rotating is too large for the first implementation PR, minimally delete all other sessions for the same principal and keep current session, with a follow-up hardening PR for rotation.
- Do not affect sessions from other auth surfaces. Admin password change touches only `admin_sessions`; clinic password change touches only `active_sessions`; particular is untouched.

### Audit/logging behavior
- Add explicit success events, e.g. `auth.admin.password_changed` and `auth.clinic.password_changed`.
- Actor must be the authenticated principal.
- Metadata may include `sessionRotated: true`, `otherSessionsRevokedCount`, and `passwordPolicyVersion`.
- Metadata must not include `currentPassword`, `newPassword`, raw session token, token hash, password hash, Authorization header, cookie header or request body.
- Failed current-password attempts may be logged as security telemetry only if sanitized and rate limited; do not write password values or hashes.

### Frontend placement
- Clinica: add a minimal "Seguridad" or "Cuenta" section inside the existing `perfil` workspace, or a small dedicated card in that workspace. Do not redesign `ClinicPublicProfileCard`; a separate component is safer.
- Admin: add a small account/security card inside the `admin` overview workspace or a new minimal "Cuenta" module only if product wants a visible navigation item. Avoid mixing it with "Clinicas" or "Roles clinica", which manage other users.
- Particular: no UI for password change.
- Frontend API helpers should live in `frontend/src/lib/api.ts` near auth helpers and use `credentials: include` through existing `apiFetch`.

## Security requirements
- Current password verification
  - Fetch the authenticated principal by session-derived ID.
  - Verify with existing `verifyPassword(currentPassword, user.passwordHash)`.
  - Use a generic failure response for mismatch.
- New password policy
  - Enforce length and complexity server-side.
  - Keep client validation as UX only; never rely on frontend.
- Non-enumerative errors
  - Do not accept target identifiers.
  - Do not reveal whether a user exists, whether the session user disappeared, or whether only current password failed.
- No password logging
  - No console logs, request logs, audit metadata, test snapshots or error details may include password values.
  - Do not stringify request bodies in route logs.
- No localStorage/sessionStorage
  - Frontend must keep passwords only in React state/form controls and clear them after submit.
  - Do not persist password form state in dashboard last-module or theme preference storage.
- Cookie/session invariants
  - Cookies stay HttpOnly, Path=/, SameSite per ENV, Secure in production, positive Max-Age on login/rotation and Max-Age=0 only on logout/clear.
  - No JWT/bearer introduction.
- CSRF/same-site considerations
  - Production SameSite is `none`, so unsafe cookie-auth routes must require trusted Origin/Referer.
  - Add the new route to CSRF mutating route registry/tests.
- PWA/cache considerations
  - API route is under `/api/` and should inherit `cache-control: no-store`.
  - Service worker must continue network-only behavior for `/api/`, `/dashboard`, `/auth/`, `/admin`.
- Role separation
  - Admin self-change must not read/update clinic users.
  - Clinic self-change must not read/update admin users.
  - Particular token access must remain separate.
  - Admin-managed credential reset for clinic users remains a separate admin action.

## Findings
| ID | Severity | Area | Finding | Evidence | Recommendation | Suggested PR |
| --- | --- | --- | --- | --- | --- | --- |
| A9-01 | High | Auth feature gap | Password-backed users have login/logout/me but no authenticated self-service password change. | `server/routes/auth.fastify.ts` and `server/routes/admin-auth.fastify.ts` register login/me/logout only. | Add separate self-service password endpoints for admin and clinic. | backend contract/tests |
| A9-02 | High | Role modeling | Particular access is token-backed, not password-backed. Adding password change there would invent a new auth model. | `drizzle/schema.ts` has `particular_tokens.token_hash`, no `password_hash`; `particular-auth` verifies token hash. | Exclude particular from this feature; handle token reissue/rotation separately. | backend contract/tests |
| A9-03 | Medium | Existing admin credential management | Admin can update clinic credentials without current password because it is an admin-managed action, not self-service. | `/api/admin/users-roles/clinic/:clinicUserId/credentials` hashes new password and audits `clinic_user.credentials.updated`. | Do not reuse this endpoint for self-change; create session-derived self endpoints. | backend contract/tests |
| A9-04 | Medium | Password policy | Existing admin-created clinic credentials accept min 8 chars; self-service should decide a stricter policy before implementation. | `admin-clinics` and `admin-users-roles` validate password length >= 8. | Adopt explicit self-service policy, recommended min 12 with max length. | backend contract/tests |
| A9-05 | High | Session lifecycle | Credential update paths do not currently define session rotation/invalidation for password changes. | Session tables are per surface; logout deletes only current session hash. | On password change, rotate current session and revoke other sessions for same principal, or split into hardening PR. | backend contract/tests |
| A9-06 | Medium | CSRF surface | New password endpoints are unsafe cookie-auth routes and must join trusted-origin registries. | `security-csrf-mutating-route-coverage.test.ts` has exact mutating route counts. | Add route counts and integration coverage for blocked origins. | backend contract/tests |
| A9-07 | Medium | Logging/audit | Existing tests prevent direct secret logging, but new password route would introduce sensitive request fields. | `security-sensitive-log-redaction-boundaries.test.ts` covers auth route files. | Extend redaction tests for new route; audit only sanitized success/failure metadata. | backend contract/tests |
| A9-08 | Low | Frontend placement | Existing clinic `perfil` module is public profile, not account security; admin has no account settings module. | `ClinicDashboardWorkspaceController` has `perfil`; admin modules include sessions/roles/audit but no account. | Add a small security card/component, not a dashboard redesign. | frontend UI contract |
| A9-09 | Medium | Cache/PWA | Password change responses must not be cacheable and must not be captured by SW. | `sensitive-response-cache.ts` no-stores `/api/*`; SW tests exclude `/api/` and private routes. | Keep endpoint under `/api/` and extend contracts if any exception is introduced. | backend/frontend contracts |

## Required implementation PR plan
1. Backend contract/tests
   - Add route design tests for `PATCH /api/auth/password` and `PATCH /api/admin/auth/password`.
   - Add body validation, current password verification, hash update, rate limit, CSRF, no-store, log redaction, audit metadata and session behavior tests.
   - Add DB helpers for self password update and session invalidation/rotation per surface.
2. Frontend UI contract
   - Add `changeClinicPassword` and `changeAdminPassword` API helpers.
   - Add small password-change form components in clinic/admin appropriate surfaces.
   - Add source-level frontend contracts: no storage, password fields use `current-password` / `new-password`, generic errors, clear fields after success.
3. Optional UX polish
   - Add visibility toggles, strength hints, cooldown UI and success focus management.
   - Keep copy minimal and avoid visual redesign.
4. Optional additional hardening
   - Add current session token rotation if not done in PR 1.
   - Add audit export filters for password-change events if needed.
   - Align admin-created clinic credential policy with self-service policy in a separate product/security PR.

## Acceptance criteria for implementation
- [ ] Admin and clinic password-backed users can change their own password only after authenticating with their current password.
- [ ] Particular users/tokens have no password-change endpoint or UI.
- [ ] No request body accepts target user id, username, role, clinic id or admin id.
- [ ] New password is hashed with existing `hashPassword` Argon2id helper.
- [ ] Existing `verifyPassword` is used for current password.
- [ ] No raw password, password hash, session token, token hash, cookie or auth header appears in response, logs or audit metadata.
- [ ] Current password mismatch uses non-enumerative public error semantics.
- [ ] Route-specific rate limit returns `429` and safe headers.
- [ ] Unsafe routes enforce trusted origin and have OPTIONS coverage.
- [ ] Session behavior is tested: current session rotation or documented retention, plus other-session revocation.
- [ ] Cookies remain HttpOnly/SameSite/Secure/Max-Age consistent with existing auth contracts.
- [ ] Frontend stores password only in component state and clears it after success.
- [ ] API responses inherit `cache-control: no-store`; SW does not cache any password-change request/response.
- [ ] Backend, frontend source contracts, security public surface and smoke docs are updated only as needed.

## Out of scope
This PR does not implement code. It does not add routes, UI, tests, migrations, dependencies, reset password, email flows, password recovery, visual redesign, or changes to existing auth/server behavior.

## Validation
- `git branch --show-current`, `git status --short --untracked-files=all`, `git log -1 --oneline` - verified base before branch.
- `git switch main`, `git pull --ff-only`, `git fetch origin --prune` - main synchronized.
- `gh pr list --state open` - no open PRs.
- `git branch -r --no-merged origin/main` - no unmerged remote branches.
- `gh run list --branch main --commit <HEAD> --limit 10` - Backend CI and Frontend CI successful for `3b8d627`.
- Required `rg` inspections executed for auth/password/session, backend auth routes and frontend profile/settings/dashboard surfaces.
- Source files inspected: auth routes, auth middleware/helpers, schema, DB helpers, frontend dashboard/API surfaces, and security contract tests.
- `git status --short --untracked-files=all`, `git diff --stat`, `git diff --check` - pass; only `IMPLEMENTATION_NOTES/audit-auth-password-change-security-contracts.md` is present.

## Final verdict
Apto para implementar en el proximo PR if and only if the implementation is limited to admin + clinic self-service password change, keeps particular out of scope, and lands backend contracts before UI polish.
