# TEST-ARCH-40 - Token domain batch

## Summary

Moves a small pure token/domain test batch from root test/ into test/unit/domain.

## Files moved

- test/particular-token.test.ts -> test/unit/domain/particular-token.test.ts
- test/report-access-token.test.ts -> test/unit/domain/report-access-token.test.ts
- test/report-access-token-serializers.test.ts -> test/unit/domain/report-access-token-serializers.test.ts
- test/report-access-token-helpers.test.ts -> test/unit/domain/report-access-token-helpers.test.ts

## Imports adjusted

- ../server/lib/particular-token.ts -> ../../../server/lib/particular-token.ts
- ../server/lib/report-access-token.ts -> ../../../server/lib/report-access-token.ts

## Guardrails updated

- test/reports-suite-completeness.test.ts now points to the moved token/domain paths:
  - test/unit/domain/report-access-token.test.ts
  - test/unit/domain/particular-token.test.ts

## Scope

Test/docs only.

No runtime changes.
No functional rewrites.
No DB changes.
No schema or migrations.
No dependency changes.
No lockfile changes.
No CI changes.

## Rationale

The moved files exercise pure token schemas, helpers and serializers through node:test and node:assert/strict.

They do not use Fastify, app.inject, HTTP, DB, filesystem, network, Playwright or production credentials.

The reports suite completeness guardrail owns explicit report and particular token lifecycle anchors, so its registry must follow the mechanical file move.

## Validation

Required before commit:

- git diff --check
- pnpm typecheck:test
- pnpm exec node --experimental-strip-types --test test/reports-suite-completeness.test.ts
- pnpm exec node --experimental-strip-types --test test/unit/domain/particular-token.test.ts test/unit/domain/report-access-token.test.ts test/unit/domain/report-access-token-serializers.test.ts test/unit/domain/report-access-token-helpers.test.ts
- pnpm test
- pnpm build
- pnpm security:public-surface