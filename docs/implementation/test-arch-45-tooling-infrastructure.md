# TEST-ARCH-45 - Tooling infrastructure test move

Moved three tooling and repository infrastructure tests into the enterprise unit/infrastructure layout.

Moved test/backend-ci-workflow.test.ts to test/unit/infrastructure/backend-ci-workflow.test.ts.
Moved test/frontend-ci-workflow.test.ts to test/unit/infrastructure/frontend-ci-workflow.test.ts.
Moved test/package-scripts.test.ts to test/unit/infrastructure/package-scripts.test.ts.
Kept test/package-scripts-contract.test.ts in the root test directory because it has broad historical documentation references.
Updated hardcoded references in test/security-critical-route-surface-registry.test.ts and docs/implementation/IMPLEMENTATION_PRODUCTION_OBSERVABILITY_READINESS.md.
No import rewrites were required.

Validation: pnpm typecheck:test; node --import tsx --test test\unit\infrastructure\backend-ci-workflow.test.ts test\unit\infrastructure\frontend-ci-workflow.test.ts test\unit\infrastructure\package-scripts.test.ts.
Safety: no runtime, product, API, database, schema, migration, dependency, lockfile, CI, or functional changes.