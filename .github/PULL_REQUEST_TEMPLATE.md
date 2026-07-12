## Summary
- Change type:
- Context / issue:
- What changed:

## Scope
Select every affected **primary** scope. Documentation and tests that only support one primary scope do not need an additional checkbox.

- [ ] backend runtime
- [ ] frontend runtime
- [ ] tests
- [ ] workflows/ci
- [ ] migrations/schema
- [ ] docs
- [ ] dependencies
- [ ] scripts/tooling
- [ ] repository configuration
- [ ] other
- [ ] mixed-scope exception (requires every affected primary scope above and a substantive justification below)

## Mixed-Scope Justification
Required only when the mixed-scope exception is checked. Explain why the domains cannot be delivered safely as independent PRs, the coupling boundary, and the rollback boundary.

Not applicable for a single-scope PR.

## Other Scope Detail
Required only when `other` is selected. Identify the paths and explain why no standard scope applies.

Not applicable when `other` is not selected.

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
- [ ] Relevant CI checks passed (`PR Governance`, `Backend CI`, `Frontend CI` when applicable)

## Security / Regression Checklist
- [ ] No secret/token exposure in code, logs, or config.
- [ ] AuthN/AuthZ and data-access impact reviewed.
- [ ] Dependency and supply-chain impact reviewed.
- [ ] No unintended regression in out-of-scope domains.
- [ ] Migration/schema impact documented or explicitly not applicable.

## Rollback
- Trigger:
- Steps:
- Data impact:
