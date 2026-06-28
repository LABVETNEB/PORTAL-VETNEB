# feat(auth): authenticated password change endpoints

## Scope

- Added `POST /api/auth/change-password` for authenticated clinic users.
- Added `POST /api/admin/auth/change-password` for authenticated admin users.
- Request body: `{ currentPassword, newPassword }`.
- Success body: `{ success: true }`.
- Particular auth remains excluded because it is token-backed and has no password hash contract.

## Security contracts

- Both endpoints require the existing cookie-backed authenticated session.
- Both endpoints enforce the existing trusted-origin/CORS boundary before auth deps are touched.
- `currentPassword` is verified with the existing `verifyPassword` helper.
- `newPassword` is hashed with the existing `hashPassword` helper.
- Legacy/current hashes that return `needsRehash` do not block the flow; changing the password writes a fresh hash.
- New passwords follow the existing backend minimum: at least 8 characters and at least 8 non-whitespace-trimmed characters.
- New password equal to the current credential is rejected after the current password has been verified.
- Public failure responses for invalid body/current password/policy/same-password use the same generic error.
- No password/hash is returned in responses or included in audit metadata.
- Sensitive response no-store remains delegated to the global `/api/*` backend hook.

## Rate limit

The endpoints reuse the existing auth rate-limit store with keys scoped as
`password-change:<userId>` plus IP and the current auth surface (`clinic` or
`admin`). This avoids schema or migration changes while preserving per-user/IP
throttling. Failed attempts increment the store; success clears the endpoint key
when the store supports delete.

## Audit and session behavior

- Clinic self-service changes write `clinic_user.credentials.updated` with actor,
  target clinic user, username, role, `selfService`, and `sessionMaintained`.
- Admin self-service changes write `auth.admin.password.changed` with actor,
  target admin user, username, `selfService`, and `sessionMaintained`.
- The current session is maintained. Invalidating other active sessions remains
  a future hardening step because this PR intentionally avoids session schema or
  broad DB helper changes.
- The admin event is written to the existing varchar audit table without adding
  a schema/migration/catalog change; formal catalog inclusion can be handled in
  a later audit taxonomy PR.

## Test coverage

- `test/auth-password-change.test.ts` covers clinic/admin success, login with the
  new password, generic failures, auth requirement, rate limit behavior, audit
  secret boundaries, and particular exclusion.
- CSRF mutation counts were updated for `auth.fastify.ts` and
  `admin-auth.fastify.ts`; particular remains unchanged.
- Trusted-origin/preflight coverage now includes both change-password endpoints.
- Backend no-store cache contract includes both endpoints.
