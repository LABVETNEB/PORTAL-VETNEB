# Review Governance

## Required PR content
- Clear scope and context.
- Validation checklist completed with commands run.
- Security review notes.
- Migration/schema impact stated (or explicit "no changes").
- Rollback trigger, steps, and data impact.

## Review routing
- CODEOWNERS defines required reviewers for:
  - backend (`/server/**`)
  - frontend (`/frontend/**`)
  - workflows (`/.github/workflows/**`)
  - migrations/schema (`/drizzle/**`, `drizzle.config.ts`)

## Merge criteria
- Required validations pass for the PR scope.
- Security-impacting changes are explicitly reviewed.
- Any migration/schema change includes compatibility and rollback notes.
