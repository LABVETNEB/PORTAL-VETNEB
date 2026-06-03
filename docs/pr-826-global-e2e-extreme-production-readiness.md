# PR 826 - Global E2E extreme production readiness

## Objective

Execute a senior-level global end-to-end production audit for Portal Vetneb across:

- G1 public security
- G2 auth, sessions and permissions
- G3 forms, uploads and inputs
- G4 sensitive data, storage and signed URLs
- G5 performance and resilience
- G6 accessibility, mobile and critical UX

## Scope

This PR is intentionally tests/docs focused.

In scope:

- Global inventory of public, admin, clinic, particular and internal surfaces.
- Contractual tests that validate stable production/security invariants.
- Risk matrix and PR documentation.
- Minimal backend/frontend fixes only if a test reveals a real defect.

Out of scope:

- DB schema changes.
- Migrations.
- Indexes.
- WebAuthn.
- UI redesigns.
- Productive config changes.
- New dependencies.
- Git add, commit, push or PR creation.

## Files touched

- `test/global-e2e-production-readiness-contract.test.ts`
- `test/global-public-surface-hardening-contract.test.ts`
- `test/global-auth-boundary-contract.test.ts`
- `test/global-storage-report-safety-contract.test.ts`
- `test/global-performance-resilience-contract.test.ts`
- `docs/audit/global-e2e-extreme-production-audit.md`
- `docs/pr-826-global-e2e-extreme-production-readiness.md`

No product runtime files were intentionally modified.

## Tests added

### `test/global-e2e-production-readiness-contract.test.ts`

Validates the G1-G6 registry, required local validation scripts and audit/PR documentation anchors.

### `test/global-public-surface-hardening-contract.test.ts`

Validates public API hardening:

- security headers on public API responses
- no session cookies on public responses
- public pricing does not receive sensitive no-store behavior
- public professionals does not expose private avatar storage paths
- invalid public report access tokens reject before hashing, lookup, signing or audit

### `test/global-auth-boundary-contract.test.ts`

Validates global auth boundaries:

- admin route families keep `authenticateFastifyAdmin`
- clinic route families keep `authenticateClinicUser`
- particular route families keep `authenticateParticularUser`
- public route families do not accept browser session authenticators
- backend/frontend session cookie names stay separated
- global trusted-origin hook is installed before route registration

### `test/global-storage-report-safety-contract.test.ts`

Validates storage/report safety:

- `serializeSafeReport` removes private `storagePath`
- clinic report list is bounded and does not eagerly sign URLs
- public report access signs lazily after validation and does not return raw token, `tokenHash` or private storage path
- Supabase storage remains private, no-upsert and TTL-based for signed URLs

### `test/global-performance-resilience-contract.test.ts`

Validates global performance/resilience:

- shared pagination clamps defaults, max limit and max offset
- heavy DB/list surfaces keep pagination markers
- sensitive `no-store` applies only to non-public APIs
- request id, security headers and safe logging remain wired
- local validation scripts remain explicit

## Product changes

None expected. The audit did not identify a real production defect requiring a backend or frontend fix during implementation.

## Validation commands

Executed locally on 2026-06-03:

- `pnpm test` - passed, 2240 passed, 1 skipped, 0 failed.
- `pnpm build` - passed.
- `pnpm security:public-surface` - passed, no public exposure findings. The auditor preserved the documented server-only cookie-name findings in `frontend/src/middleware.ts`.
- `pnpm typecheck` - passed.
- `pnpm typecheck:test` - passed.
- `git diff --check` - passed.

## Suggested next PRs

1. Add staging/deployed evidence for public headers, auth boundary negatives and no-leak behavior.
2. Add seeded DB query-budget tests for heavy admin/report/logistics endpoints.
3. Add environment-level Supabase bucket ACL review and signed URL TTL evidence.
4. Add authenticated Playwright mobile smoke for dashboard flows once test credentials are available.
