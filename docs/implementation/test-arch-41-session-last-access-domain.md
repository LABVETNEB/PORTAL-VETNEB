# TEST-ARCH-41 - Session last access domain test move

Moved one pure session last-access domain test into the enterprise unit/domain layout.

## Changes

- Moved test/session-last-access.test.ts to test/unit/domain/session-last-access.test.ts.
- Updated import to ../../../server/lib/session-last-access.ts.
- Updated docs/security/rls-enforcement-matrix.md hardcoded reference.

## Validation

- pnpm typecheck:test
- node --import tsx --test test\unit\domain\session-last-access.test.ts

## Safety

- No runtime/product changes.
- No API changes.
- No database, schema, migration, dependency, lockfile, or CI changes.
- No functional rewrite.
