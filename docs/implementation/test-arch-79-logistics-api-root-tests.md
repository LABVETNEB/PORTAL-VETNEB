# TEST-ARCH-79 — Logistics API root tests

## Scope

Moved a focused batch of root-level logistics API/controller tests into:

- `test/integration/adapters/controllers/`

## Files moved

- `test/logistics-field-visits-api.test.ts`
- `test/logistics-route-events-api.test.ts`
- `test/logistics-route-plans-api.test.ts`
- `test/logistics-sla-routes-api.test.ts`

## Deferred from this batch

The following root-level logistics tests were inspected but intentionally left for later focused batches because they are DB, library or runtime tests rather than API/controller tests:

- `test/logistics-db.test.ts`
- `test/logistics-route-plans-cache.test.ts`
- `test/logistics-sla-breach-runtime.test.ts`

## Allowed changes

- Test file moves only.
- Relative import/path adjustments required by the new test depth, if any.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
