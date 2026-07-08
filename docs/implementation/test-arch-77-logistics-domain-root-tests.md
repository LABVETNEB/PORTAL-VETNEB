# TEST-ARCH-77 — Logistics domain root tests

## Scope

Moved a focused batch of root-level logistics domain and pure logic tests into:

- `test/unit/domain/logistics/`

## Files moved

- `test/logistics-domain-barrel.test.ts`
- `test/logistics-pagination.test.ts`
- `test/logistics-route-planning.test.ts`
- `test/logistics-sla-compliance.test.ts`
- `test/logistics-metrics.test.ts`
- `test/logistics-route-event-aggregation.test.ts`
- `test/logistics-heuristic-field-visit-ids.test.ts`

## Allowed changes

- Test file moves only.
- Relative import/path adjustments required by the new test depth.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
