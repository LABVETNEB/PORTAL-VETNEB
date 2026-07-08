# TEST-ARCH-85 — Reports domain root test

## Scope

Moved the focused root-level reports domain test into the domain test tree.

## File moved

- `test/reports.test.ts`

## Destination

- `test/unit/domain/reports/reports.test.ts`

## Deferred from this batch

- `test/reports-runtime-timing-contract.test.ts`
- `test/reports-session-last-access-contract.test.ts`
- `test/reports-status-runtime-timing-contract.test.ts`
- `test/reports-status-session-last-access-contract.test.ts`
- `test/reports-suite-completeness.test.ts`

These files have runtime, session or suite guardrail semantics and should be handled in separate focused batches.

## Allowed changes

- Test file move only.
- Relative import/path adjustments required by the new test depth.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
