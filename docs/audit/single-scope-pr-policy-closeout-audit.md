# Single-Scope Pull Request Policy Closeout Audit

| Field | Value |
| --- | --- |
| Control audited | `ERM-CTRL-007` — Single-Scope Pull Request Policy |
| Gap audited | `ERM-CHG-002` |
| Audit date | 2026-07-12 |
| Auditor role | Engineering governance |
| Technical implementation | PR #1451 |
| Negative canary | PR #1452 |
| Result | PASS |

## Audit question

Does the repository automatically reject an undeclared mixed-primary-scope pull request, while permitting an explicitly declared and substantively justified mixed-scope exception through the protected required check?

## Audit conclusion

**PASS.**

The repository has observable and repeatable single-scope enforcement inside the required `validate-pr-governance` check. The implementation has a successful positive path, a failed negative path, contract tests, review evidence, exact commit identifiers, cleanup evidence and defined reopen criteria.

The evidence is sufficient to transition `ERM-CTRL-007` from `DOCUMENTED_ONLY / 2 / P2` to `IMPLEMENTED / 3 / NONE` and to close `ERM-CHG-002` operationally without modifying the historical gap snapshot.

## Evidence inventory

### Technical implementation

PR #1451: `ci(governance): enforce single-scope pull requests`

- base: `main@76bf30fe3cfd9a59dbfd4d9a8e82e1082cec5b4b`;
- final head: `1f5f59b089384bfb8683ada1f326638c9d950d5e`;
- state: merged;
- squash commit: `7ff8df9915e36b9ba0ee614d1ddb54f0cdda00e6`;
- changed files: six;
- runtime product files: none;
- database, migration, dependency and lockfile changes: none.

Final successful runs:

- PR Governance run `29213900805` — success;
- Backend CI run `29213900803` — success.

### Review findings

Codex review identified two P2 bypasses before merge:

1. the default mixed-scope instructional placeholder exceeded the minimum justification length;
2. the default `other`-scope instructional placeholder exceeded the minimum detail length.

Remediation:

- default instructions were converted to HTML comments;
- the validator strips comments before measuring substantive text;
- regression tests verify that untouched placeholders fail;
- both review threads were resolved only after the fixes and green reruns.

### Negative canary

PR #1452: `test(canary): verify mixed-scope pull request rejection`

- base: `main@7ff8df9915e36b9ba0ee614d1ddb54f0cdda00e6`;
- head branch: `canary/single-scope-mixed-domains`;
- head SHA: `9ffbd5276f5c365925189a4f4236694404b35607`;
- changed files: two disposable scope markers;
- detected primary categories: backend and frontend;
- selected scopes: backend and frontend;
- mixed-scope exception: intentionally not selected;
- state: closed;
- merged: false;
- `mergedAt`: null.

Required-check result:

- workflow run: `29214006955`;
- job: `validate-pr-governance`;
- job ID: `86706466746`;
- conclusion: failure;
- failing step: `Validate pull request governance`.

The failure occurred before any merge and therefore proves the protected negative path.

### Branch cleanup and repository state

Operator verification after closing the canary recorded:

- technical branch exact SHA verified and deleted;
- canary branch exact SHA verified and deleted;
- `git fetch --prune` completed;
- remote tracking references absent;
- `git ls-remote --heads origin` returned only `refs/heads/main`;
- local `main` and `origin/main` both equal `7ff8df9915e36b9ba0ee614d1ddb54f0cdda00e6`;
- working tree clean;
- no open pull requests;
- protected secondary worktree remained at `14d60f6` on `test/e2e-extended-contract-fixes`.

## Control assertions

| Assertion | Evidence | Result |
| --- | --- | --- |
| Pull requests declare scope using recognized options | PR template and validator | PASS |
| Changed files are independently classified | versioned validator and tests | PASS |
| One primary scope passes when declaration matches | contract tests | PASS |
| Documentation and tests can support one core scope | contract tests | PASS |
| Multiple primary scopes fail by default | PR #1452 / run `29214006955` | PASS |
| Mixed-scope exception requires exact affected scopes | validator and contract tests | PASS |
| Mixed-scope exception requires substantive justification | validator, placeholder remediation and tests | PASS |
| `other` scope requires substantive detail | validator and tests | PASS |
| Required check context remains stable | `validate-pr-governance` | PASS |
| Positive path passes protected checks | PR #1451 final runs | PASS |
| Negative canary remains unmerged | PR #1452 | PASS |
| Canary branches are removed | exact-SHA cleanup verification | PASS |
| Historical snapshots remain unchanged | scoped closeout design | PASS |

## Scope integrity

The closeout changes only:

- this audit record;
- the implementation closeout record;
- the live Enterprise Control Register.

Out of scope and unchanged:

- backend runtime;
- frontend runtime;
- database and migrations;
- dependencies and lockfiles;
- workflow implementation;
- branch protection;
- historical baseline and gap register;
- secondary worktree.

## Residual risks

The control does not claim semantic understanding of every possible change. Classification remains path-based and therefore requires maintenance when repository architecture evolves.

Residual risks are accepted under these controls:

- unknown paths are classified as `other` and require explicit detail;
- category mapping changes require tests and a protected PR;
- mixed-scope exceptions remain possible but must be exact and justified;
- branch-protection or required-check drift triggers control reopening;
- periodic canary revalidation is required after governance changes.

## Gap disposition

`ERM-CHG-002` is closed operationally on 2026-07-12.

The original gap entry remains in the historical gap register for traceability. This audit, the implementation closeout and the live control register are the authoritative later evidence of closure.

## Final determination

`ERM-CTRL-007` satisfies the register's implementation criteria:

- implementation observable: yes;
- evidence verifiable: yes;
- owner assigned by role: yes;
- verification date current: yes;
- positive path: yes;
- negative path: yes;
- rollback and reopen conditions: yes;
- periodic review defined: yes;
- historical snapshots preserved: yes.

Final audit result: **PASS — eligible for `IMPLEMENTED / 3 / NONE`.**