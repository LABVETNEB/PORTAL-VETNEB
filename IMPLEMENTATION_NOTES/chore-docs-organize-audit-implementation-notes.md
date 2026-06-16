# chore(docs): organize audit and implementation notes

## Summary
- Moved 7 root-level `AUDIT_*.md` files into `docs/audits/`.
- Moved 16 root-level `IMPLEMENTATION_*.md` files into `IMPLEMENTATION_NOTES/`.
- Preserved documentation history with `git mv` (all 23 tracked as renames).
- Updated documentation references where needed (one broken relative link).
- Updated one reference-only documentation path in a test (authorized — see below).
- Only `README.md` and `SETUP.md` remain as root-level Markdown.

## Reason
The repository root had accumulated 23 historical audit and implementation
Markdown files, making the project root harder to navigate. They are now grouped
by type without losing traceability.

## Scope
Changed:
- `docs/audits/**` — 7 audit notes moved here (new directory).
- `IMPLEMENTATION_NOTES/**` — 16 implementation notes moved here, alongside the
  pre-existing kebab-case notes; plus this PR note (new).
- `IMPLEMENTATION_NOTES/IMPLEMENTATION_EXTREME_VISUAL_FIXES.md` — fixed the one
  real relative Markdown link to the moved audit file
  (`../docs/audits/AUDIT_EXTREME_VISUAL_PRODUCTION_READINESS.md`).
- `test/production-readiness.test.ts` — reference-only: the documentation path
  read by the "documentation lists env names" assertion was updated from
  `IMPLEMENTATION_PRODUCTION_OBSERVABILITY_READINESS.md` to
  `IMPLEMENTATION_NOTES/IMPLEMENTATION_PRODUCTION_OBSERVABILITY_READINESS.md`.
  No test logic, no product code changed. This single change was explicitly
  authorized because the file is read by path from the repo root.

Out of scope (untouched):
- product code, backend, frontend behavior.
- API clients, routes, dashboard modules.
- `package.json`, `pnpm-lock.yaml`, dependencies.
- `.github/**`, PWA / service worker, public pages.
- Prose/backtick filename mentions inside the moved notes were left as-is: they
  name files (not paths/links) and remain accurate after the move.

## Notes
- The destination `docs/audits/` (plural) was requested explicitly; a separate
  pre-existing `docs/audit/` (singular) directory is unrelated and left untouched.
- No documents were deleted; this PR only moves/organizes.

## Validation
Commands run on branch `chore/docs-organize-audit-implementation-notes`:
- `git diff --check` -> clean (exit 0)
- `pnpm test` -> PASS (2749 passed, 0 failed)
- `pnpm typecheck:test` -> PASS (exit 0)
- `pnpm --dir frontend lint` -> PASS (exit 0)
- `pnpm --dir frontend typecheck` -> PASS (exit 0)
- `pnpm --dir frontend build` -> PASS (exit 0)
- `pnpm security:public-surface` -> PASS

## Risk
Low. Documentation organization only, plus one reference-only test path update.

## Rollback
Revert this PR.
