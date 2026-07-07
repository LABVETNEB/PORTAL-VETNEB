# TEST-ARCH-42 - Schema health domain test move

Moved test/schema-health.lib.test.ts to test/unit/domain/schema-health.lib.test.ts.
Updated import to ../../../server/lib/schema-health.ts.
Validation: pnpm typecheck:test; node --import tsx --test test\unit\domain\schema-health.lib.test.ts.
Safety: no runtime, API, database, schema, migration, dependency, lockfile, CI, or functional changes.
