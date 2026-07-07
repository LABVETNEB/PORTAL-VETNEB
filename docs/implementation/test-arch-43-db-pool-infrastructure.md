# TEST-ARCH-43 - DB pool infrastructure test move

Moved db-pool infrastructure tests into the enterprise unit/infrastructure layout.

Moved test/db-pool-contract.test.ts to test/unit/infrastructure/db-pool-contract.test.ts.
Moved test/env-db-pool.test.ts to test/unit/infrastructure/env-db-pool.test.ts.
No import rewrites were required because both tests resolve from process.cwd() or explicit child-process cwd.

Validation: pnpm typecheck:test; node --import tsx --test test\unit\infrastructure\db-pool-contract.test.ts test\unit\infrastructure\env-db-pool.test.ts.
Safety: no runtime, product, API, database, schema, migration, dependency, lockfile, CI, or functional changes.