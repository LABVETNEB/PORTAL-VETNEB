# Single-Scope Pull Request Policy Closeout

| Field | Value |
| --- | --- |
| Control | `ERM-CTRL-007` — Single-Scope Pull Request Policy |
| Gap | `ERM-CHG-002` |
| Status | Operationally closed |
| Verification date | 2026-07-12 |
| Owner | Engineering governance / CI owner |
| Technical delivery | PR #1451 |
| Negative canary | PR #1452 |
| Technical main commit | `7ff8df9915e36b9ba0ee614d1ddb54f0cdda00e6` |

## Objective

Close `ERM-CTRL-007` with observable enforcement, positive-path evidence, negative-path evidence, explicit ownership, rollback criteria and durable repository records.

The control is not closed by policy text alone. Closure depends on the required `validate-pr-governance` check evaluating declared pull-request scope against the categories derived from changed files.

## Implemented enforcement

PR #1451 introduced the operational single-scope contract through:

- `.github/PULL_REQUEST_TEMPLATE.md`;
- `.github/workflows/pr-governance.yml`;
- `scripts/governance/pr-governance-validator.mjs`;
- `scripts/governance/pr-governance-validator.d.mts`;
- `test/unit/infrastructure/pr-governance-single-scope-contract.test.ts`;
- `docs/implementation/single-scope-pr-policy-enforcement.md`.

The required check context remained stable:

- workflow: `PR Governance`;
- job/check: `validate-pr-governance`.

## Effective policy

The validator classifies changed files into governed categories and compares those categories with the checked scope declarations in the pull-request body.

Normal pull requests must:

1. select at least one recognized scope;
2. select exactly one primary scope;
3. match the declared scope to the detected changed-file scope;
4. provide explicit detail for paths classified as `other`.

Documentation and tests may support one core domain without creating an additional primary scope.

A pull request with multiple primary scopes fails unless it declares the machine-checked mixed-scope exception. The exception requires:

- at least two detected primary scopes;
- every affected primary scope selected exactly;
- no undeclared or extra primary scope;
- a substantive `## Mixed-Scope Justification` section;
- an atomic coupling and rollback rationale rather than the default template placeholder.

The exception is therefore an auditable declaration, not an unrestricted bypass.

## Positive-path evidence

PR #1451 exercised the mixed-scope exception on the atomic workflow/validator boundary.

Final evidence:

- head SHA: `1f5f59b089384bfb8683ada1f326638c9d950d5e`;
- PR Governance run: `29213900805` — success;
- Backend CI run: `29213900803` — success;
- all review threads resolved;
- squash merge commit: `7ff8df9915e36b9ba0ee614d1ddb54f0cdda00e6`.

The review process identified two placeholder-bypass defects in the initial template. Both were corrected before merge by converting default instructions to stripped HTML comments and adding regression tests.

## Negative-path evidence

PR #1452 was an intentional canary containing exactly two disposable files:

- one backend-classified marker;
- one frontend-classified marker.

The pull-request body selected backend and frontend scopes but intentionally omitted the mixed-scope exception.

Observed result:

- PR Governance run: `29214006955`;
- job: `validate-pr-governance`;
- job ID: `86706466746`;
- conclusion: `failure`;
- pull request closed without merge;
- `mergedAt`: null;
- canary head SHA: `9ffbd5276f5c365925189a4f4236694404b35607`.

The technical branch `ci/single-scope-pr-policy` and canary branch `canary/single-scope-mixed-domains` were both deleted after exact-SHA verification. A subsequent remote-head audit showed only `refs/heads/main`.

## Gap disposition

`ERM-CHG-002` is closed operationally on 2026-07-12.

The historical gap register remains unchanged because it is a point-in-time audit snapshot. This closeout record and the live Enterprise Control Register provide the later closure evidence.

## Ongoing control requirements

`ERM-CTRL-007` remains implemented while all of the following remain true:

- `validate-pr-governance` remains required on pull requests to `main`;
- changed files continue to be classified into governed scopes;
- declared scope must match detected scope;
- undeclared mixed primary scopes fail;
- mixed-scope exceptions require exact declarations and substantive justification;
- template placeholder text cannot satisfy justification requirements;
- contract tests remain green;
- negative canary evidence is retained;
- changes to classifications, template syntax or required-check context trigger revalidation.

## Review cadence

Review monthly and whenever any of these change:

- pull-request template;
- scope labels or categories;
- classification logic;
- mixed-scope exception rules;
- `validate-pr-governance` workflow or job name;
- branch protection or rulesets;
- test runner or module-loading behavior.

## Reopen conditions

Reopen the control if:

- a mixed-primary-scope pull request passes without the exception;
- an exception passes with missing or placeholder justification;
- declared and detected scopes can diverge without failure;
- the required check is removed, renamed or bypassed;
- review findings reveal an untested bypass;
- branch-protection drift permits merge with a failed governance check.

## Rollback

If enforcement causes a confirmed false positive or workflow regression:

1. block merges while the defect is investigated;
2. revert the affected governance commit through a protected pull request;
3. preserve the failed evidence and incident timeline;
4. transition `ERM-CTRL-007` back to `PARTIAL` or `DOCUMENTED_ONLY` if enforcement is no longer effective;
5. reopen `ERM-CHG-002` operationally;
6. correct tests and execute a new positive and negative canary before restoring `IMPLEMENTED`.

Runtime, product, database and data impact: none.