## Summary
- Change type:
- Scope:
  - [ ] backend
  - [ ] frontend
  - [ ] workflows/ci
  - [ ] migrations/schema
  - [ ] docs
- Context / issue:

## Validation
- [ ] `pnpm typecheck`
- [ ] `pnpm typecheck:test`
- [ ] `pnpm test`
- [ ] `pnpm build` (if backend affected)
- [ ] `pnpm --dir frontend lint` (if frontend affected)
- [ ] `pnpm --dir frontend typecheck` (if frontend affected)
- [ ] `pnpm --dir frontend build` (if frontend affected)
- [ ] `pnpm audit --prod` (if dependencies affected)
- [ ] `pnpm audit` (if dependencies affected)

## Security
- [ ] No secret/token exposure in code, logs, or config.
- [ ] AuthZ/AuthN and data-access impact reviewed.
- [ ] Dependency and supply-chain impact reviewed.

## Migrations / Schema
- [ ] No migration/schema changes.
- [ ] If applies: migration + backward-compatibility notes included.

## Rollback
- Trigger:
- Steps:
- Data impact:
