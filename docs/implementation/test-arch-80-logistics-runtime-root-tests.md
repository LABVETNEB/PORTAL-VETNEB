# TEST-ARCH-80 — Logistics runtime root tests

## Scope

Moved a focused batch of root-level logistics DB, infrastructure and runtime tests into:

- `test/unit/infrastructure/logistics/`

## Files moved

- `test/logistics-db.test.ts`
- `test/logistics-route-plans-cache.test.ts`
- `test/logistics-sla-breach-runtime.test.ts`

## Allowed changes

- Test file moves only.
- Relative import/path adjustments required by the new test depth.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
