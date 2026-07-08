# TEST-ARCH-73 — Infrastructure, production and smoke root tests

## Scope

Moved a small batch of root-level infrastructure, production-readiness and smoke contract tests into:

- `test/unit/infrastructure/`

## Files moved

- `test/app-version-gate-contract.test.ts`
- `test/env.test.ts`
- `test/global-e2e-production-readiness-contract.test.ts`
- `test/global-performance-resilience-contract.test.ts`
- `test/mobile-production-parity-invariants.test.ts`
- `test/package-scripts-contract.test.ts`
- `test/production-env-contracts.test.ts`
- `test/production-readiness.test.ts`
- `test/progress-production-invariants.test.ts`
- `test/public-staging-config-contract.test.ts`
- `test/smoke-env-contract.test.ts`
- `test/smoke-local-contract.test.ts`
- `test/smoke-staging-script-contract.test.ts`
- `test/smoke-upload-script-contract.test.ts`

## Allowed changes

- Test file moves only.
- Relative import/path adjustments required by the new test depth.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
