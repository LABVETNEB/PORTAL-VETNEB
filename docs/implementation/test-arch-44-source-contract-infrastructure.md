# TEST-ARCH-44 - Source contract infrastructure test move

Moved two source-contract infrastructure tests into the enterprise unit/infrastructure layout.

Moved test/request-logger-runtime-timing-contract.test.ts to test/unit/infrastructure/request-logger-runtime-timing-contract.test.ts.
Moved test/routes-session-last-access-contract.test.ts to test/unit/infrastructure/routes-session-last-access-contract.test.ts.
Updated docs/pr-history/PR-perf-admin-request-permission-cache.md for the moved routes session-last-access test path.
No import rewrites were required because both tests resolve source files from process.cwd().

Validation: pnpm typecheck:test; node --import tsx --test test\unit\infrastructure\request-logger-runtime-timing-contract.test.ts test\unit\infrastructure\routes-session-last-access-contract.test.ts.
Safety: no runtime, product, API, database, schema, migration, dependency, lockfile, CI, or functional changes.