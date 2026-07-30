# RFC: Automatic E2E Completeness Gate

## Metadata

| Campo | Valor |
| --- | --- |
| Status | Accepted |
| Owner | CI owner / QA owner |
| Effective date | 2026-07-30 |
| Related roadmap item | `PR-E2E-CI-COMPLETENESS`; `PR-CI-3` |
| Related gap | `GAP-TEST-1` |
| Related controls | `ERM-CTRL-011`; `ERM-CTRL-013`; `ERM-CTRL-014` |

## Context

The typed Playwright catalog contains 72 specs partitioned into `ci` (43),
`extended` (24), `evidence` (2) and `visual-linux` (3). `Frontend CI` runs only
`e2e:ci`, while the other 29 specs had no complete, automatic and durable
GitHub Actions route. The manual visual workflow neither covered the full
partition nor removed the need for a parallel literal spec list.

The pull-request gate must remain fast and keep its stable `validate-frontend`
context. Completeness needs Linux because the three pixel baselines are
Chromium Linux artifacts.

## Decision

Keep `Frontend CI` as the required fast gate with one `e2e:ci` invocation.
Add a separate `E2E Completeness` workflow with focused `pull_request`,
`workflow_dispatch` and weekly `schedule` events. Its single browser command is
`pnpm --dir frontend e2e:full`, derived from the catalog and executed on Ubuntu
with the `next dev` runner used to author the immutable Chromium Linux
baselines and `--workers=5`. Five bounded workers keep the five default
capacity-matrix variants isolated before shared dev-server cache warming,
while avoiding an unbounded host-derived worker count. `Frontend CI` remains
the separate production-bundle gate for the 43-spec `ci` cohort.

The completeness workflow is non-required. It runs for changes that can alter
the suite, its runner, catalog, workflow contracts or toolchain. A
parser-backed infrastructure contract derives workflow cohort commands,
resolves them through the catalog and fails unless automatic coverage equals
`full` exactly.

## Preserved invariants

- The four required check names and branch protection are unchanged.
- `Frontend CI` keeps 43 specs, one Playwright invocation and its
  always-present `validate-frontend` result.
- The production-runner flag remains scoped to `Frontend CI`'s post-build
  Playwright step; the completeness workflow does not activate it.
- GitHub Actions use minimum `contents: read` permissions and immutable SHA
  refs from the effective allowlist.
- No functional spec, fixture, helper, snapshot, manifest, dependency or
  product runtime changes.
- No retries, `skip`, `fixme`, `continue-on-error` or literal workflow spec
  list.

## Alternatives considered

| Alternative | Decision |
| --- | --- |
| Run 72 specs in every `Frontend CI` pull request | Rejected: expands the required fast gate and normal PR duration unnecessarily. |
| Extend the manual visual workflow | Rejected: manual dispatch is not a durable automatic route and its literal visual list can drift. |
| Run three separate residual cohorts | Rejected: three Playwright lifecycles add cost and a larger drift surface; `full` already derives the exact union. |
| Run completeness against `next start` | Rejected after live evidence: the 320 px Linux baselines contain the `next dev` indicator and seven adaptive contracts failed under that runner; changing snapshots or assertions is outside scope. |
| Keep two default CI workers | Rejected after live evidence: 782/786 passed, while the remaining four failures match the documented dev-mode contention class. |
| Serialize with one worker | Rejected after live evidence: shared dev cache warmed between variants and the result regressed to 780/786. |
| Dedicated automatic `e2e:full -- --workers=5` workflow | Accepted: the exact residual cohort passed 176 tests with five workers; the full gate stays one catalog-derived invocation while `Frontend CI` retains production coverage. |

## Validation and rollback

Validation is provided by catalog completeness, parser-backed workflow
coverage, workflow security, runner isolation, local static gates and
the real `e2e:full` job on the implementation PR.

Rollback reverts the completeness workflow, the two workflow contracts and
the `Frontend CI` detector path. It does not change data, production,
branch-protection settings or required checks.
