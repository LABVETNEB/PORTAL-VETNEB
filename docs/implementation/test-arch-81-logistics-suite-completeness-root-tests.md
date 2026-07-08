# TEST-ARCH-81 — Logistics suite completeness root tests

## Scope

Moved focused logistics suite-completeness tests out of the root test directory.

## Files moved

- `test/logistics-metrics-suite-completeness.test.ts`
- `test/logistics-schema-suite-completeness.test.ts`

## Destinations

- `test/unit/domain/logistics/logistics-metrics-suite-completeness.test.ts`
- `test/unit/migrations/logistics/logistics-schema-suite-completeness.test.ts`

## Deferred from this batch

- `test/logistics-rbac-permission-contract.test.ts`

This file is a logistics RBAC/security permission contract and should be handled in a separate focused security/permissions batch.

## Allowed changes

- Test file moves only.
- Relative import/path adjustments required by the new test depth.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
