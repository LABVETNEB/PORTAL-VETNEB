# Single-Maintainer Governance — Implementation Record

| Campo | Valor |
| --- | --- |
| Document owner | Repository owner / Engineering governance |
| Domain | Repository, Review and Ownership Governance |
| Lifecycle status | CLOSED |
| Authoritative source role | Implementation evidence for the single-maintainer transition |
| Effective date | Administrative settings: 2026-07-11; repository files: effective on merge |
| Last verified date | 2026-07-11 |
| Review cadence | On maintainer, collaborator, CODEOWNERS, branch-protection or required-check change |
| Supersedes | Two-account operating model introduced around PR #1440 |
| Superseded by | None |
| Related controls or gaps | ERM-OWN-001; ERM-CTRL-006; ERM-CTRL-008; ERM-CTRL-009; ERM-CTRL-015 |
| Evidence or approval reference | Administrative transition on 2026-07-11; branch `chore/single-maintainer-governance`; PR #1445 closed without merge |

This record documents the intentional migration from a two-account review arrangement to a transparent single-maintainer governance model.

It does not replace [CODEOWNERS](../../.github/CODEOWNERS), the [Ownership Model](../governance/ownership-model.md), the [Review Governance policy](../review-governance.md), or the [Enterprise Control Register](../governance/enterprise-control-register.md).

## Estado base

Before this transition:

- `LABVETNEB` was the repository administrator and normal PR author;
- `VETNEB` was a repository collaborator used as the alternate CODEOWNER reviewer;
- CODEOWNERS assigned both accounts to every protected path;
- branch protection required one approving review;
- required CODEOWNER review was enabled;
- stale approvals were dismissed;
- PRs authored by `LABVETNEB` required an approval from `VETNEB`;
- both accounts were controlled by the same project operator, so the arrangement added operational friction without providing genuine organizational independence;
- PR #1445 attempted to close ownership controls under that two-account model and was closed without merge after the model was rejected.

## Decisión

The repository adopts a single-maintainer operating model:

- `LABVETNEB` is the sole maintainer and administrator;
- `VETNEB` is removed as repository collaborator;
- CODEOWNERS maps every protected path to `@LABVETNEB` only;
- required approving reviews are set to `0`;
- required CODEOWNER review is disabled;
- last-push approval is disabled;
- stale-review dismissal is disabled because approvals are not required;
- protected PR flow and required automated checks remain active;
- no second account is used to simulate independent review.

## Scope incluido

### Administrative GitHub configuration

- preserve branch protection on `main`;
- preserve required status check `validate-pr-governance`;
- preserve strict status checks;
- preserve administrator enforcement;
- preserve linear history and conversation resolution;
- preserve disabled force pushes and branch deletion;
- change required approving review count from `1` to `0`;
- disable required CODEOWNER review;
- disable last-push approval;
- disable stale-review dismissal;
- remove `VETNEB` as collaborator.

### Repository files

- replace two-account CODEOWNERS entries with `@LABVETNEB`;
- retain explicit path mapping for governance, docs, backend, frontend, database, tests, scripts and root manifests;
- update the active ownership model;
- update review-governance rules;
- add implementation and audit evidence for this transition.

## Scope excluido

- backend, frontend, API, authentication, sessions or runtime behavior;
- database, schema, migrations or production data;
- workflow implementation changes;
- dependency, package-manifest or lockfile changes;
- modification of historical baseline or gap-register snapshots;
- deletion or rewriting of PR #1440 historical implementation and audit records;
- creation of GitHub teams or replacement reviewer accounts;
- modification of the secondary worktree;
- transition of ERM-OWN-001, ERM-CTRL-008 or ERM-CTRL-009 to `IMPLEMENTED`.

## Cambios implementados

### Collaborator model

`VETNEB` was removed from the repository collaborator list. `LABVETNEB` remains the sole administrator and operational maintainer.

### Branch protection

The review section of `main` branch protection was changed to:

| Setting | Value |
| --- | --- |
| `dismiss_stale_reviews` | `false` |
| `require_code_owner_reviews` | `false` |
| `require_last_push_approval` | `false` |
| `required_approving_review_count` | `0` |

The following protections remained unchanged and active:

| Setting | Value |
| --- | --- |
| required status check | `validate-pr-governance` |
| strict status checks | `true` |
| administrator enforcement | `true` |
| linear history | `true` |
| conversation resolution | `true` |
| force pushes | disabled |
| branch deletion | disabled |

### CODEOWNERS

The repository keeps path-based accountability but assigns one valid owner:

- fallback: `@LABVETNEB`;
- `.github/**`: `@LABVETNEB`;
- `docs/**` and `AGENTS.md`: `@LABVETNEB`;
- `server/**`: `@LABVETNEB`;
- `frontend/**`: `@LABVETNEB`;
- `drizzle/**`: `@LABVETNEB`;
- `test/**`: `@LABVETNEB`;
- `scripts/**`: `@LABVETNEB`;
- root package and PNPM manifests: `@LABVETNEB`.

CODEOWNERS now records accountability only. It is not represented as independent approval enforcement.

### Governance documentation

The active ownership and review policies now state:

- the repository is single-maintainer;
- human approvals are not a universal required gate;
- automated governance validation remains mandatory;
- high-risk changes should obtain external review when feasible;
- a future independent maintainer requires a dedicated governance reconfiguration;
- two accounts controlled by one person must not be used to simulate segregation of duties.

## Archivos modificados

- `.github/CODEOWNERS`
- `docs/governance/ownership-model.md`
- `docs/review-governance.md`
- `docs/implementation/single-maintainer-governance.md`
- `docs/audit/single-maintainer-governance-audit.md`

## Validaciones

Administrative validations completed on 2026-07-11:

- active administrative account was `LABVETNEB`;
- branch-protection backup was written outside the repository before mutation;
- `require_code_owner_reviews` verified `false`;
- `required_approving_review_count` verified `0`;
- `require_last_push_approval` verified `false`;
- `VETNEB` verified absent from repository collaborators;
- `validate-pr-governance` remained required and strict;
- administrator enforcement remained active;
- linear history and conversation resolution remained active;
- force pushes and branch deletion remained disabled;
- local repository files and secondary worktree were not modified by the administrative operation.

Repository validations required on the delivery PR:

- exact five-file scope;
- no active CODEOWNERS reference to `@VETNEB`;
- historical PR #1440 records remain unchanged;
- Markdown and relative-link validation;
- diff-integrity validation;
- required `validate-pr-governance` success;
- PR mergeability without human approval.

## Resultado

The repository has a simpler and honest governance model aligned with its actual staffing:

- one accountable maintainer;
- no simulated independent reviewer;
- protected PR flow retained;
- automated governance gate retained;
- destructive branch operations still blocked;
- ownership limitations remain visible.

## Impacto en controles enterprise

This transition does not close the ownership gap.

- `ERM-OWN-001` remains open in the historical gap register;
- `ERM-CTRL-008` remains `PARTIAL` because ownership is concentrated in one maintainer and independent domain ownership does not exist;
- `ERM-CTRL-009` remains `PARTIAL` because path mapping exists but does not route to distinct domain reviewers;
- `ERM-CTRL-006` and `ERM-CTRL-015` retain observable automated enforcement through required PR governance and branch protection, but their separate closure criteria are not reclassified by this record.

## Riesgo residual

- one account has administrative, authoring and merge authority;
- automated checks cannot replace expert independent review;
- an account compromise has broad repository impact;
- no specialist teams or independent domain owners exist;
- external review is advisory unless explicitly required for a specific change.

Mitigations:

- maintain MFA and account-security controls;
- keep administrator enforcement active;
- require PRs and positive automated checks;
- keep force pushes and branch deletion disabled;
- use strict scope, validation and rollback requirements;
- obtain real external review for security-sensitive, destructive, data or architecture-critical changes.

## Estado final

- administrative single-maintainer settings: applied and verified;
- collaborator `VETNEB`: removed;
- PR #1445: closed without merge;
- CODEOWNERS single-maintainer mapping: prepared in the delivery branch;
- active ownership and review policies: aligned in the delivery branch;
- runtime/product impact: none;
- historical snapshots and PR #1440 records: unchanged;
- implementation block: CLOSED, pending merge of repository-file changes.
