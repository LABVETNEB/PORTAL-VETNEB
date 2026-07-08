# TEST-ARCH-76 — Email and logger root contracts

## Scope

Moved a focused batch of root-level email, logger and request logger contract tests into:

- `test/unit/infrastructure/`

## Files moved

- `test/email-gmail-api.test.ts`
- `test/email-html-templates.test.ts`
- `test/email-safe-metadata.test.ts`
- `test/email-success.test.ts`
- `test/logger-and-email.test.ts`
- `test/request-logger-edge.test.ts`
- `test/request-logger-middleware.test.ts`
- `test/request-logger.test.ts`

## Allowed changes

- Test file moves only.
- Relative import/path adjustments required by the new test depth.
- Documentation under `docs/implementation/`.

## Explicit non-scope

No runtime, product, API, auth, database, schema, migrations, dependency, lockfile or CI changes.
