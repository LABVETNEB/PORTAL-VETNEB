# Review Governance

| Campo | Valor |
| --- | --- |
| Document owner | Repository owner / Engineering governance |
| Domain | Change Control and Pull Request Governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | Human-readable PR review and merge-governance policy |
| Effective date | 2026-07-11 |
| Last verified date | 2026-07-11 |
| Review cadence | Trimestral y ante cambios de branch protection, checks o maintainers |
| Supersedes | Previous implicit multi-account review routing |
| Superseded by | None |
| Related controls or gaps | ERM-CHG-001; ERM-CHG-002; ERM-GOV-001; ERM-OWN-001 |
| Evidence or approval reference | Administrative single-maintainer transition on 2026-07-11; branch `chore/single-maintainer-governance`; PR #1445 closed without merge |

## Required PR content

- Clear summary and context.
- Explicit scope covering backend runtime, frontend runtime, workflows/CI, migrations/schema, docs and dependencies.
- Validation section with commands or checks actually executed.
- Security and regression assessment.
- Rollback trigger, steps and data impact.
- Explicit exclusions when scope could be ambiguous.

## Expected checks

- All PRs: required `validate-pr-governance` check.
- Backend scope: `pnpm typecheck`, `pnpm typecheck:test`, `pnpm test`, `pnpm build` and applicable Backend CI.
- Frontend scope: `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build` and applicable Frontend CI.
- Dependency scope: `pnpm audit --prod`, `pnpm audit` and lockfile review.
- Documentation or repository-configuration scope: Markdown, links, lifecycle metadata, scope and diff-integrity validation.

## Review model

VETNEB currently uses a single-maintainer operating model:

- `LABVETNEB` is the only repository maintainer and administrator;
- CODEOWNERS maps accountability to `@LABVETNEB`;
- zero approving reviews are required;
- required CODEOWNER review is disabled;
- self-approval is neither required nor represented as independent review;
- a second personal account must not be used to simulate segregation of duties;
- external human review may be requested for high-risk changes without becoming a universal merge gate.

The absence of a required human approval is compensated partially by protected PR flow, mandatory automated governance validation and administrator enforcement. This is a transparent single-maintainer compromise, not an enterprise segregation-of-functions claim.

## Review routing

- `.github/CODEOWNERS` identifies the accountable maintainer for repository paths.
- Automated checks provide the mandatory merge gate.
- Security-sensitive, destructive, data, authentication, migration, CI and dependency changes should receive external human review when feasible.
- A future independent maintainer requires a dedicated governance change before enabling required approvals or required CODEOWNER review.

## Scope discipline

- Keep PR scope strict and avoid unrelated runtime, migration, schema, deploy or credential changes.
- If scope expands, split it into a separate PR whenever possible.
- A mixed-scope PR must explain why separation is not practical and identify all affected domains.
- Historical audit documents must not be rewritten to represent a later state.

## Rollback expectation

- Every PR must define rollback trigger, rollback steps and data impact.
- Any migration/schema change must include backward compatibility and rollback notes.
- Repository-governance changes must preserve or provide a rollback path for branch protection and checks.

## Branch protection

Current `main` protection, administratively verified on 2026-07-11:

- pull request flow remains protected;
- `validate-pr-governance` is required with strict status checks;
- administrator enforcement is enabled;
- approving review count is `0`;
- required CODEOWNER review is disabled;
- last-push approval is disabled;
- stale-review dismissal is disabled because approvals are not required;
- linear history is required;
- conversation resolution is required;
- force pushes are disabled;
- branch deletion is disabled.

Branch protection is an external GitHub setting and is not configured by repository files. Any future mutation must be recorded with sanitized evidence and the affected governance documents must be reviewed for consistency.
