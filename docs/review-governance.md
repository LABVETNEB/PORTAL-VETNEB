# Review Governance

## Required PR content
- Clear summary and context.
- Explicit scope (backend runtime, frontend runtime, workflows/ci, migrations/schema, docs, dependencies).
- Validation checklist completed with commands run.
- Security/regression checklist completed.
- Rollback trigger, steps, and data impact.

## Expected checks
- Backend scope: `pnpm typecheck`, `pnpm typecheck:test`, `pnpm test`, `pnpm build` (`Backend CI`).
- Frontend scope: `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build` (`Frontend CI`).
- Dependency scope: `pnpm audit --prod`, `pnpm audit`.

## Review routing
- CODEOWNERS at `.github/CODEOWNERS` defines default reviewers for the repository.

## Scope discipline
- Keep PR scope strict and avoid unrelated runtime, migration, schema, deploy, or credential changes.
- If scope expands, split into a separate PR whenever possible.

## Rollback expectation
- Every PR must define rollback trigger, rollback steps, and data impact.
- Any migration/schema change must include backward-compatibility and rollback notes.

## Branch protection
- Branch protection rules are external repository settings in GitHub.
- Do not attempt to configure branch protection through repository code changes.
