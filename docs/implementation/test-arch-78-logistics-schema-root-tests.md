# TEST-ARCH-78 — Logistics schema root tests

## Scope

Moved a focused batch of root-level logistics schema tests into:

- `test/unit/migrations/logistics/`

## Files moved

- `test/logistics-field-visits-schema.test.ts`
- `test/logistics-route-events-schema.test.ts`
- `test/logistics-route-plans-stops-schema.test.ts`
- `test/logistics-sla-schema.test.ts`
- `test/logistics-time-windows-schema.test.ts`

## Allowed changes

- Test file moves only.
- Relative import/path adjustments required by the new test depth.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
