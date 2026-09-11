# RFC: E2E Visual Production Candidate

## Status

Accepted decision; document lifecycle `PROPOSED` until this change is reviewed and merged.

## Metadata

| Campo | Valor |
| --- | --- |
| Document owner | Engineering governance / E2E owner |
| Domain | E2E visual regression and manual CI workflow |
| Lifecycle status | `PROPOSED` |
| Authoritative source role | Proposed architectural decision for `E2E-GLOBAL-05A`; it does not displace the active E2E audit. |
| Effective date | On merge of `E2E-GLOBAL-05A` |
| Last verified date | 2026-09-11 |
| Review cadence | Before `E2E-GLOBAL-05B` and when the manual visual workflow changes materially |
| Supersedes | None |
| Superseded by | None |
| Related controls or gaps | `E2E-GLOBAL-05A`, `E2E-GLOBAL-05B`, visual-regression workflow governance |
| Evidence or approval reference | Local GLOBAL-05A validation recorded in `docs/implementation/e2e-global-05a-visual-production-candidate.md`; PR approval pending. |

## Context

The 40 canonical visual snapshots currently represent the development runner. The base
`frontend/playwright.config.ts` already selects the production runner when both `CI=true` and
`VETNEB_E2E_PRODUCTION_RUNNER=1` are present. `E2E-GLOBAL-05A` needs production-run evidence
without overwriting those canonical PNGs. `E2E-GLOBAL-05B` will later reconcile or migrate the
canonical baselines using evidence from `ubuntu-latest`.

## Decision

Adopt an explicit **production candidate** path:

```text
build -> next start -> Playwright -> directory outside the repository
-> exact comparison against baseline -> manifest/evidence -> teardown
```

1. Reuse the base `playwright.config.ts`; do not introduce a second runner architecture.
2. Candidates never write to the canonical PNG snapshots. Production-candidate is incompatible
   with snapshot updates.
3. `visual-regression-manual` explicitly selects either `dev` or `production-candidate`.
4. `e2e:full` remains unchanged in 05A.
5. Visual differences are reported and are never approved automatically.
6. Reuse the existing exact comparison utility.
7. 05B decides whether to replace baselines only from `ubuntu-latest` evidence.

## Preserved invariants

- `CANONICAL_SNAPSHOTS_MODIFIED = 0` during 05A.
- No production application change, backend/DB/auth change, secret, or production setting is introduced.
- Workflow SHA pinning and security policy remain intact and the path fails closed.
- Evidence is outside the repository and teardown is mandatory.

## Consequences

### Positive

- Development baselines and production candidates are safely separated.
- The manual workflow has an explicit production-evidence path.
- The existing exact comparator makes differences reproducible and auditable.

### Trade-offs

- A visual difference can produce a non-zero exit and requires human review.
- WSL evidence is non-canonical and cannot decide 05B.
- `suite=all` has not yet received a GitHub-hosted-runner budget measurement.

## Validation

Evidence obtained for GLOBAL-05A is recorded in the implementation note:

- directed guards and the workflow security validator passed;
- frontend lint, typecheck, and build passed;
- a representative Linux production run produced 10 candidate PNGs outside the repository;
- all 10 candidates were pixel-different from their development baselines and were reported, not accepted;
- all 40 canonical PNGs remained unmodified.

That WSL run validates the infrastructure only; it is not authority to perform the 05B baseline
decision. The required production reconciliation evidence must come from `ubuntu-latest` through
the manual workflow.

## Rollback

Revert the technical GLOBAL-05A changes and remove the production-candidate path to restore the
manual workflow's former behavior. No data rollback is required.
