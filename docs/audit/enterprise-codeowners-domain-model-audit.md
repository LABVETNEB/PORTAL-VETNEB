# Enterprise CODEOWNERS Domain Model — Audit Record

| Campo | Valor |
| --- | --- |
| Document owner | Tech lead / Domain owners |
| Domain | Code and Operational Ownership |
| Lifecycle status | HISTORICAL |
| Authoritative source role | Audit evidence |
| Effective date | 2026-07-11, effective on merge of PR #1440 |
| Last verified date | 2026-07-11 |
| Review cadence | On ownership-model or enforcement change |
| Supersedes | None |
| Superseded by | None |
| Related controls or gaps | ERM-OWN-001; ERM-CTRL-008; ERM-CTRL-009 |
| Evidence or approval reference | PR #1440; branch `governance/enterprise-codeowners-domain-model` |

This document is audit evidence for PR #1440. It is not a normative ownership source and does not replace `.github/CODEOWNERS`, `docs/governance/ownership-model.md`, `docs/governance/enterprise-control-register.md`, or `docs/SOURCES_OF_TRUTH.md`.

## Estado base

Before this implementation:

- `.github/CODEOWNERS` contained only `* @LABVETNEB`;
- ownership was repository-wide rather than path-based;
- `LABVETNEB` was a verified repository administrator;
- `VETNEB` was a verified repository collaborator with write access;
- no repository teams were configured;
- branch protection required one approving review;
- stale approvals were dismissed;
- required CODEOWNERS review remained disabled;
- `ERM-OWN-001`, `ERM-CTRL-008`, and `ERM-CTRL-009` remained open or `PARTIAL`.

## Scope incluido

- replace the single repository-wide owner rule with an incremental path-based ownership model;
- retain a repository-wide fallback;
- cover repository governance, documentation, backend, frontend, database, tests, scripts, and root package manifests;
- assign both verified collaborators to each covered path;
- preserve the ability for either account to review a pull request created by the other;
- add the mandatory implementation and audit traceability records required by `AGENTS.md`.

## Scope excluido

- branch-protection mutation inside the pull request;
- activation of `require_code_owner_reviews`;
- runtime, backend, frontend, API, authentication, sessions, database, schema, or migration behavior;
- workflow, dependency, or lockfile changes;
- reclassification or closure of enterprise controls;
- modification of historical baseline or gap-register snapshots;
- creation of GitHub users or teams;
- representative post-merge canaries.

## Auditoría previa

The pre-implementation audit established:

- current CODEOWNERS rule: `* @LABVETNEB`;
- verified collaborators: `LABVETNEB` and `VETNEB`;
- required approving review count: `1`;
- `dismiss_stale_reviews`: enabled;
- `require_code_owner_reviews`: disabled;
- required status check: `validate-pr-governance`;
- strict status checks: enabled;
- administrator enforcement: enabled;
- conversation resolution: required;
- linear history: required;
- force pushes and branch deletion: disabled;
- repository rulesets: none;
- GitHub teams attached to the repository: none.

## Cambios auditados

The audit verifies that the implementation introduces:

- a repository-wide fallback owned by `@LABVETNEB` and `@VETNEB`;
- explicit ownership for `.github/**`;
- explicit ownership for `docs/**` and `AGENTS.md`;
- explicit ownership for `server/**`;
- explicit ownership for `frontend/**`;
- explicit ownership for `drizzle/**`;
- explicit ownership for `test/**`;
- explicit ownership for `scripts/**`;
- explicit ownership for root package and PNPM manifests.

The ordering of owners does not establish hierarchy. Both handles are valid owners for every listed rule.

## Archivos modificados

- `.github/CODEOWNERS`
- `docs/implementation/enterprise-codeowners-domain-model.md`
- `docs/audit/enterprise-codeowners-domain-model-audit.md`

## Validaciones

Completed before the traceability correction:

- clean working tree before implementation;
- branch created from `main@af1a82c3ebc7bef951c7c0359eb2709d29502a6e`;
- exact CODEOWNERS diff reviewed;
- `git diff --check`;
- `git diff --cached --check`;
- remote PR scope verified;
- Backend CI passed;
- PR Governance passed;
- Supabase Preview skipped because no Supabase paths changed;
- reviewer request created for `VETNEB`;
- branch protection correctly blocked merge pending approval.

Required after this correction:

- three-file scope verification;
- Markdown content review;
- relative-link validation where applicable;
- new CI/check execution;
- Codex re-review;
- approval by `VETNEB`;
- post-merge activation of required CODEOWNERS review;
- representative path canaries.

## Resultado

The branch contains an incremental path-based CODEOWNERS model using only verified repository collaborators.

The implementation does not yet establish effective required code-owner review because `require_code_owner_reviews` remains disabled until the new CODEOWNERS file is merged into `main`.

## Riesgo residual

Residual risks:

- both collaborators own every listed domain, so ownership is path-based but not yet separated among distinct specialist teams;
- no GitHub teams exist;
- required CODEOWNERS review is not yet active;
- a valid approval from `VETNEB` is still pending;
- representative path canaries have not yet demonstrated automatic reviewer requests;
- enterprise controls must remain `PARTIAL` until enforcement and durable evidence exist.

## Estado final

Target state after merge of PR #1440:

- path-based CODEOWNERS model present in `main`;
- both verified collaborators eligible for covered paths;
- no runtime or operational product behavior changed;
- `ERM-OWN-001` remains open pending enforcement and canaries;
- `ERM-CTRL-008` remains `PARTIAL`;
- `ERM-CTRL-009` remains `PARTIAL`;
- `ERM-CTRL-005` remains `PARTIAL`;
- post-merge administrative enforcement and canary validation remain separate follow-up actions.

