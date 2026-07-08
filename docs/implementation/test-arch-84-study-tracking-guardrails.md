# TEST-ARCH-84 — Study tracking guardrail root tests

## Scope

Moved the remaining root-level study tracking guardrail tests into the contracts test tree.

## Files moved

- `test/study-tracking-runtime-timing-contract.test.ts`
- `test/study-tracking-suite-completeness.test.ts`

## Destination

- `test/unit/contracts/study-tracking/`

## Guardrail updates

- Updated the suite completeness `REPO_ROOT` resolver for the new test depth.
- Updated the suite completeness self-reference to the new path.

## Allowed changes

- Test file moves only.
- Relative repo-root/path adjustments required by the new test depth.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
