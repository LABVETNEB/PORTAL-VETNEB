# Single-Maintainer Governance — Audit Record

| Campo | Valor |
| --- | --- |
| Document owner | Repository owner / Engineering governance |
| Domain | Repository, Review and Ownership Governance |
| Lifecycle status | CLOSED |
| Authoritative source role | Audit evidence for the single-maintainer transition |
| Effective date | Administrative settings: 2026-07-11; repository files: effective on merge |
| Last verified date | 2026-07-11 |
| Review cadence | On maintainer, collaborator, CODEOWNERS, branch-protection or required-check change |
| Supersedes | None; historical PR #1440 evidence remains historical |
| Superseded by | None |
| Related controls or gaps | ERM-OWN-001; ERM-CTRL-006; ERM-CTRL-008; ERM-CTRL-009; ERM-CTRL-015 |
| Evidence or approval reference | Administrative transition on 2026-07-11; branch `chore/single-maintainer-governance`; PR #1445 closed without merge |

This audit records the repository state and governance decision associated with removal of the `VETNEB` collaborator and adoption of a single-maintainer operating model.

Current normative sources remain [CODEOWNERS](../../.github/CODEOWNERS), the [Ownership Model](../governance/ownership-model.md), the [Review Governance policy](../review-governance.md), and the [Enterprise Control Register](../governance/enterprise-control-register.md).

## Objetivo

Verify that the repository can operate safely and transparently with one real maintainer without maintaining a second personal account solely to satisfy self-imposed approval rules.

The audit specifically tests whether the transition:

- removes the invalid operational dependency on `VETNEB`;
- preserves required automated merge governance;
- preserves destructive-operation protections;
- aligns active CODEOWNERS and governance documents with actual repository staffing;
- avoids false claims of independent review or enterprise control closure.

## Estado previo auditado

Observed before the transition:

- `LABVETNEB` was the active administrator and PR author;
- `VETNEB` was configured as a collaborator and alternate CODEOWNER;
- `.github/CODEOWNERS` listed both accounts for every covered path;
- `main` required one approving review;
- required CODEOWNER review was enabled;
- PR #1445 requested `VETNEB` automatically and remained blocked pending approval;
- GitHub correctly rejected self-approval by `LABVETNEB`;
- local GitHub CLI did not have an authenticated `VETNEB` session;
- an attempted device login authenticated `LABVETNEB` again rather than adding the second account;
- the two-account mechanism created operational friction but did not establish genuine organizational independence.

## Decisión auditada

The project explicitly rejected the use of two accounts controlled by the same operator as a substitute for segregation of duties.

Audit conclusion for the operating model:

- one real maintainer is more accurate than two nominal identities;
- CODEOWNERS should identify accountability, not manufacture an approval relationship;
- automated checks and branch protection remain valid compensating controls;
- human review remains valuable for high-risk work but should come from a genuinely independent reviewer;
- ownership controls must remain `PARTIAL` until independent owners or approved revised criteria exist.

## Scope incluido

- closure of PR #1445 without merge;
- branch-protection review settings;
- required status-check preservation;
- collaborator removal;
- CODEOWNERS active mapping;
- ownership and review governance documentation;
- impact assessment for related enterprise controls;
- preservation of historical evidence.

## Scope excluido

- source-code or product behavior;
- backend, frontend, API, authentication or sessions;
- database, schema, migrations or data;
- workflows and CI implementation;
- dependencies and lockfiles;
- historical baseline or gap-register rewrites;
- deletion of the GitHub user account itself;
- modification of the secondary worktree;
- closure of ownership or branch-protection enterprise gaps.

The repository collaborator relationship was removed. The external GitHub user account named `VETNEB` was not deleted from GitHub because repository administration cannot and should not delete another GitHub account.

## Evidencia administrativa

### Identity and backup

- active administrative identity: `LABVETNEB`;
- branch-protection configuration was exported to a temporary local backup before mutation;
- no repository file was changed by the administrative commands.

### Required review settings after transition

| Setting | Verified result |
| --- | --- |
| `dismiss_stale_reviews` | `false` |
| `require_code_owner_reviews` | `false` |
| `require_last_push_approval` | `false` |
| `required_approving_review_count` | `0` |

### Protections preserved

| Setting | Verified result |
| --- | --- |
| required status-check context | `validate-pr-governance` |
| strict status checks | `true` |
| administrator enforcement | `true` |
| conversation resolution | `true` |
| linear history | `true` |
| force pushes | `false` |
| branch deletion | `false` |

### Collaborator result

- GitHub collaborator DELETE operation completed successfully for `VETNEB`;
- paginated collaborator verification returned no remaining `VETNEB` entry;
- `LABVETNEB` remains repository owner and administrator.

## Evidencia de PR #1445

PR #1445 is retained as historical evidence of why the two-account model was rejected:

- title: `docs(governance): close CODEOWNERS enforcement controls`;
- head SHA: `9b37ae608209688015921bd6e05a1d091fa5806a`;
- scope: four documentation files;
- required `validate-pr-governance` check eventually succeeded after PR-body correction;
- reviewer request: `VETNEB`;
- review decision: `REVIEW_REQUIRED`;
- merge state: blocked pending review;
- final state: closed;
- merged state: false.

The PR is not accepted closure evidence for `ERM-OWN-001`, `ERM-CTRL-008` or `ERM-CTRL-009` because the underlying operating model was intentionally abandoned before merge.

## Cambios de repositorio auditados

The delivery branch introduces exactly:

- single-owner CODEOWNERS entries using `@LABVETNEB`;
- an active ownership model that declares single-maintainer constraints;
- an active review policy that relies on required automated checks rather than simulated human independence;
- implementation evidence for the administrative and repository transition;
- this audit record.

Historical PR #1440 implementation and audit documents remain unchanged. They continue to describe the state and intent observed at their own date.

## Evaluación de controles

### ERM-OWN-001

Status: remains open in the historical gap register.

Reason:

- accountability is mapped;
- independent ownership by domain is not present;
- required human review is intentionally disabled;
- one account holds repository-wide authority.

### ERM-CTRL-008 — Code Ownership Governance

Recommended status: remain `PARTIAL`, maturity 2.

Positive evidence:

- active ownership is explicit;
- responsibilities are documented;
- protected PR and automated checks exist;
- misleading two-account review has been removed.

Missing for closure:

- independent domain owners or equivalent approved closure criteria;
- real segregation of duties;
- repeatable independent review evidence for representative high-risk domains.

### ERM-CTRL-009 — CODEOWNERS Domain Model

Recommended status: remain `PARTIAL`.

Positive evidence:

- explicit path rules exist;
- all rules resolve to a valid repository owner after removal of `VETNEB`;
- repository areas remain visible by path.

Missing for closure:

- distinct reviewers by domain;
- automatic routing to an independent reviewer;
- representative evidence of independent domain review.

### ERM-CTRL-006 and ERM-CTRL-015

This audit confirms continuing automated enforcement but does not reclassify these controls:

- required positive `validate-pr-governance` check remains active and strict;
- administrator enforcement remains active;
- PR flow, linear history and conversation resolution remain protected;
- force pushes and branch deletion remain disabled;
- separate published closure criteria and durable canary evidence are still required before any transition to `IMPLEMENTED`.

## Hallazgos

### P0

None.

### P1

None introduced by the transition.

### P2

- one administrator remains a concentration-of-authority risk;
- no independent specialist review is enforced;
- automated checks do not cover every possible semantic or architectural defect;
- account compromise would have broad impact;
- the Enterprise Control Register remains the live source for control status and should continue to show ownership controls as `PARTIAL`.

## Validaciones del delivery PR

The delivery PR must demonstrate:

- branch based on `main@eaa6d3b20b139a6a9a0a5c180109094770897920`;
- no reuse or merge of PR #1445 changes;
- exact five-file changed scope;
- no active `@VETNEB` entry in `.github/CODEOWNERS`;
- all CODEOWNERS paths map to `@LABVETNEB`;
- relative Markdown links resolve;
- no historical audit or gap-register file is modified;
- `validate-pr-governance` succeeds;
- the PR is not blocked by a human approval requirement;
- Supabase Preview may remain skipped because no Supabase path is changed.

## Resultado

PASS for the single-maintainer transition decision and administrative configuration.

The resulting model is simpler, operable and accurately documented. It preserves meaningful automated merge protections while refusing to represent a second account controlled by the same operator as independent review.

This PASS does not mean the ownership maturity gap is closed.

## Riesgo residual

Residual governance risk is accepted transparently:

- no human segregation of duties;
- no specialist reviewer teams;
- high dependency on account security and automated checks;
- discretionary external review for critical work.

Required ongoing mitigations:

- maintain MFA and credential hygiene;
- preserve administrator enforcement and strict required checks;
- preserve no-force-push and no-deletion protections;
- keep PR scope and rollback explicit;
- request real external review for security-sensitive, destructive, data or architecture-critical changes;
- reauditar immediately if an independent maintainer is added.

## Estado final

- PR #1445: closed without merge;
- branch protection: single-maintainer review settings applied;
- required automated governance gate: preserved;
- collaborator `VETNEB`: removed;
- external GitHub account `VETNEB`: not deleted and outside repository scope;
- CODEOWNERS active replacement: prepared in the delivery branch;
- ownership and review policies: aligned in the delivery branch;
- historical evidence: preserved;
- related ownership controls: remain `PARTIAL`;
- runtime and product behavior: unchanged;
- audit block: CLOSED, pending merge of repository-file changes.
