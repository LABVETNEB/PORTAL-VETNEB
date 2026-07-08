# TEST-ARCH-83 — Study tracking domain root tests

## Scope

Moved focused root-level study tracking domain tests into the domain test tree.

## Files moved

- `test/study-tracking.test.ts`
- `test/study-tracking-clinic-schema.test.ts`
- `test/study-tracking-edge.test.ts`

## Destination

- `test/unit/domain/study-tracking/`

## Guardrail updated after validation failure

- `test/study-tracking-suite-completeness.test.ts`

The suite completeness guardrail had stale anchors pointing to the old root-level paths. Full local validation failed on those stale anchors, so the references were updated to the new test paths.

## Deferred from this batch

- `test/study-tracking-runtime-timing-contract.test.ts`
- `test/study-tracking-suite-completeness.test.ts`

These files have different suite/runtime guardrail semantics and should be handled as relocations in a separate focused batch.

## Allowed changes

- Test file moves only.
- Relative import/path adjustments required by the new test depth.
- Stale suite completeness guardrail path updates required by the move.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
