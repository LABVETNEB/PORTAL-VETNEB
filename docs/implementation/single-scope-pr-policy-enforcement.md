# Single-Scope Pull Request Policy Enforcement

| Field | Value |
| --- | --- |
| Control | `ERM-CTRL-007` — Single-Scope Pull Request Policy |
| Gap | `ERM-CHG-002` |
| Delivery phase | Technical enforcement before canary closeout |
| Date | 2026-07-12 |
| Owner | Engineering governance / CI owner |
| Base | `main@76bf30fe3cfd9a59dbfd4d9a8e82e1082cec5b4b` |

## Objective

Convert the documented single-scope pull request policy into an automatically enforced contract inside the existing required `validate-pr-governance` job.

This delivery intentionally does **not** transition `ERM-CTRL-007` to `IMPLEMENTED`. The control remains incomplete until a negative mixed-scope canary is observed failing, closed without merge, and recorded through durable closeout evidence.

## Technical changes

### Versioned validator

The governance implementation moves from a large inline Python block in `.github/workflows/pr-governance.yml` to:

- `scripts/governance/pr-governance-validator.mjs`.

The workflow remains the required GitHub check launcher and keeps the exact job name:

- `validate-pr-governance`.

The versioned validator preserves the existing controls for:

- `git diff --check` integrity;
- sensitive file paths;
- high-confidence secrets in added lines;
- Markdown UTF-8, NUL, conflict-marker and local-link validation;
- required PR metadata sections;
- changed-file classification and job summary output.

### Scope contract

The PR template now exposes recognized primary scopes:

- backend runtime;
- frontend runtime;
- tests;
- workflows/CI;
- migrations/schema;
- docs;
- dependencies;
- scripts/tooling;
- repository configuration;
- other.

The validator derives the effective primary scope from changed files and compares it against selected checkboxes.

Rules:

1. at least one recognized scope must be selected;
2. a normal PR must select exactly one scope;
3. documentation and tests may support one non-documentation primary scope without creating a second primary scope;
4. a mismatch between declared and detected scope fails;
5. two or more primary scopes fail unless the mixed-scope exception is selected;
6. the exception must select every detected primary scope exactly;
7. the exception requires a substantive `## Mixed-Scope Justification` section;
8. `other` requires a substantive `## Other Scope Detail` section.

### Mixed-scope exception

The exception is not a bypass. It is a machine-checked declaration that requires:

- multiple primary scopes to actually exist;
- every detected primary scope to be selected;
- no undeclared primary scope;
- an explanation of why the work cannot be safely split;
- an explicit coupling and rollback boundary.

The technical PR itself uses the exception because the workflow launcher and the validator script form one atomic required-check boundary.

## Test coverage

`test/unit/infrastructure/pr-governance-single-scope-contract.test.ts` covers:

- path classification;
- supporting documentation/tests behavior;
- valid single backend scope;
- mixed backend/frontend rejection;
- valid exact mixed-scope exception;
- incomplete mixed-scope declaration rejection;
- declared/detected mismatch rejection;
- docs-only acceptance;
- required detail for `other`.

## Compatibility

The branch-protection required context is unchanged:

- workflow: `PR Governance`;
- job/check: `validate-pr-governance`.

No branch-protection mutation is required.

## Validation required on the technical PR

The technical PR must demonstrate:

- `validate-pr-governance`: success under an explicit mixed-scope exception;
- Backend CI: success, including typecheck, test suite and build;
- changed files limited to workflow, validator, template, contract tests and this implementation record;
- no frontend, backend runtime, DB, migration, dependency or lockfile changes.

## Canary required after merge

A dedicated canary PR must:

1. change one harmless file classified as backend and one harmless file classified as frontend;
2. omit the mixed-scope exception;
3. produce `validate-pr-governance: failure` with a multiple-primary-scope finding;
4. remain unmerged;
5. be closed without merge;
6. have its branch deleted and absence verified.

Only after that evidence exists may a separate docs-only PR:

- add implementation and audit closeout records;
- transition `ERM-CTRL-007` to `IMPLEMENTED / 3 / NONE`;
- close `ERM-CHG-002` operationally;
- preserve historical snapshots unchanged.

## Rollback

Trigger conditions:

- regression in existing governance checks;
- incorrect path classification;
- valid single-scope PR blocked without a justified reason;
- mixed-scope PR passes without the declared exception;
- required check context changes unexpectedly.

Rollback procedure:

1. revert the technical squash commit;
2. restore the prior inline validator and PR template;
3. keep `ERM-CTRL-007` incomplete;
4. reopen the implementation design before attempting another canary.

Runtime, data and product impact: none.
