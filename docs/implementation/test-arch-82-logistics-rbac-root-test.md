# TEST-ARCH-82 — Logistics RBAC root contract

## Scope

Moved the remaining root-level logistics RBAC permission contract into the clinic contracts test area.

## File moved

- `test/logistics-rbac-permission-contract.test.ts`

## Destination

- `test/unit/contracts/clinic/logistics-rbac-permission-contract.test.ts`

## Rationale

The test validates clinic permission exposure and RBAC enforcement across logistics route modules, so it belongs with clinic contract tests rather than root-level logistics domain or migration tests.

## Allowed changes

- Test file move only.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
