# TEST-ARCH-74 — Backend and auth root contracts

## Scope

Moved a focused batch of root-level backend, auth, middleware and HTTP contract tests into:

- `test/unit/infrastructure/`

## Files moved

- `test/api-production-session-contract.test.ts`
- `test/auth-cookie-persistence-contract.test.ts`
- `test/auth-middleware.test.ts`
- `test/auth-security-edge.test.ts`
- `test/auth-security-rehash-policy.test.ts`
- `test/auth-security.test.ts`
- `test/backend-api-nosniff-responses-contract.test.ts`
- `test/contact-rate-limit.test.ts`
- `test/cors-headers-shared-helper.test.ts`
- `test/error-and-async-middleware.test.ts`
- `test/http-bootstrap.test.ts`
- `test/preflight.test.ts`
- `test/routes-runtime-timing-legacy-guard.test.ts`
- `test/trusted-origin-edge.test.ts`
- `test/trusted-origin-router-policy.test.ts`
- `test/trusted-origin.test.ts`

## Allowed changes

- Test file moves only.
- Relative import/path adjustments required by the new test depth.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
