# RFC: CI Always-Run Pull Request Gates

## Metadata

| Campo | Valor |
| --- | --- |
| Status | Accepted |
| Owner | Engineering governance / CI owner |
| Effective date | 2026-07-29 |
| Related roadmap item | `PR-CI-ALWAYS-RUN-GATES` |
| Related control | `ERM-CTRL-014` Quality Gate Architecture |

## Context

Backend CI and Frontend CI previously used pull-request path filters. When a pull request did not match those filters, GitHub did not create the corresponding check context.

That behavior prevents the checks from becoming reliable required checks because an absent context can block an otherwise valid pull request indefinitely.

The repository requires stable pull-request contexts without running expensive backend or frontend validation for unrelated changes.

## Decision

Each workflow uses three stages:

1. A lightweight impact-detection job runs for every pull request targeting `main`.
2. The existing heavy validation job runs only when the detector reports relevant changes.
3. A final job runs with `if: always()` and publishes the stable check context:
   - `validate-backend`
   - `validate-frontend`

For push events already supported by the workflows, heavy validation remains mandatory.

For pull requests, each detector computes changed files from the common merge base of the base
and head commits through the candidate head. Changes that exist only on a base branch that
advanced after the pull-request branch diverged are not classified as pull-request impact.

The final job fails closed when detection fails, when required heavy validation fails or is cancelled, or when an unexpected job state is observed.

## Preserved invariants

- Existing backend and frontend validation commands remain unchanged.
- PostgreSQL remains isolated to backend heavy validation.
- Playwright installation and execution remain isolated to frontend heavy validation.
- Existing permissions, timeouts, concurrency and SHA-pinned Actions remain enforced.
- Legitimate heavy-validation skips are preserved for outdated pull-request branches whose only
  candidate changes are unrelated to that heavy.
- No application runtime, authentication, database, schema, dependency or production configuration is changed.
- No failure is hidden with `continue-on-error`.

## Consequences

### Positive

- Both CI contexts exist on every pull request.
- Unrelated changes avoid expensive validation.
- Block 05 can later evaluate enabling both contexts as required checks.
- Detector and heavy-job failures propagate deterministically.

### Trade-offs

- Both workflows start a lightweight detector on every pull request.
- Workflow structure becomes more explicit and requires contract tests for result propagation.
- Changes to either workflow require updating its reviewed SHA-256 integrity digest.

## Validation

- Workflow structure and propagation contracts.
- Workflow security validator.
- SHA-256 integrity contract.
- Full backend test and build gates.
- Frontend lint, typecheck, build and real CI E2E.
- Docs-only and backend canaries after the technical PR is merged.

## Rollback

Revert the technical PR to restore the previous path-filtered workflow behavior. No data rollback is required.
