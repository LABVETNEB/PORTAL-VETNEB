# TEST-ARCH-75 — Clinic root contracts

## Scope

Moved a focused batch of root-level clinic contract tests into:

- `test/unit/contracts/clinic/`

## Files moved

- `test/clinic-audit-runtime-timing-contract.test.ts`
- `test/clinic-audit-session-last-access-contract.test.ts`
- `test/clinic-audit.test.ts`
- `test/clinic-auth-runtime-timing-contract.test.ts`
- `test/clinic-management-route-policy.test.ts`
- `test/clinic-permissions-middleware.test.ts`
- `test/clinic-public-profile-runtime-timing-contract.test.ts`
- `test/frontend-clinic-public-profile.test.ts`

## Allowed changes

- Test file moves only.
- Relative import/path adjustments required by the new test depth.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
