# PR-S6 — Security release closeout

## Purpose

This document closes the Security Release documentation block after PR-S1 through PR-S5.

It summarizes the completed security documentation, validation evidence and release-readiness controls for admin/clinic sessions, tenant isolation, RLS enforcement, cross-tenant smoke verification and staging/runtime evidence handling.

## Final repository state before PR-S6

Expected base state:

- Main branch is clean.
- Local working tree is clean.
- No local working branches remain.
- Open PRs are limited to Dependabot dependency updates.
- Latest main commit before this closeout: `ec136d9 docs(security): add runtime staging evidence checklist (#1110)`.

## Closed PRs in this security block

| PR | Scope | Result |
| --- | --- | --- |
| PR-S1 / #1106 | Security sessions, tenant and RLS audit | Closed |
| PR-S2 / #1107 | RLS/enforcement matrix | Closed |
| PR-S3 / #1108 | Cross-tenant smoke evidence runbook | Closed |
| PR-S4 / #1109 | Security docs matrix drift guard | Closed |
| PR-S5 / #1110 | Runtime/staging evidence checklist | Closed |

## Security areas covered

This block documents release-readiness expectations for:

- Admin session boundaries.
- Clinic session boundaries.
- `admin_session_id` and `app_session_id` separation.
- Tenant isolation.
- RLS enforcement.
- Cross-tenant smoke verification.
- Runtime/staging evidence collection.
- Secret sanitization in audit artifacts.
- Private routes without valid session.
- Cache/PWA handling for private surfaces.
- Health/readiness release evidence.
- Documentation drift prevention.

## Invariants preserved

Security release readiness depends on the following invariants:

1. Admin and clinic session authorities must remain separated.
2. Admin surfaces must not trust clinic session cookies.
3. Clinic surfaces must not trust admin session cookies.
4. Tenant-scoped records must not be readable across tenants.
5. RLS expectations must stay represented in documentation and release evidence.
6. Cross-tenant smoke checks must be reproducible without exposing secrets.
7. Runtime/staging evidence must not include sensitive values.
8. Private authenticated data must not be available without a valid session.
9. Private authenticated data must not remain available from cache after logout.
10. Release evidence must map to the intended deployment commit.

## Evidence chain

The release evidence chain is:

1. PR-S1 documents security session and tenant/RLS audit expectations.
2. PR-S2 documents the RLS/enforcement matrix.
3. PR-S3 documents cross-tenant smoke evidence collection.
4. PR-S4 guards the security documentation matrix against drift.
5. PR-S5 defines the runtime/staging evidence checklist required before release.
6. PR-S6 closes the block and confirms the documentation set is ready for release review.

## Explicit non-scope

This closeout does not change:

- Backend code.
- API behavior.
- Authentication logic.
- Database schema.
- RLS policies.
- Migrations.
- Dependencies.
- Lockfiles.
- CI workflows.
- Package scripts.
- Runtime scripts.
- Tests.
- Production configuration.

## Release readiness criteria

The Security Release block can be considered ready for release review when:

- PR-S1 through PR-S6 are merged into `main`.
- The working tree is clean after merge.
- CI checks are green for the final PR.
- The runtime/staging evidence checklist exists and is ready to complete against the deployment commit.
- No evidence artifact contains secrets, cookies, tokens, passwords, hashes, signed URLs or private tenant data.
- Any blocker discovered during staging/runtime evidence collection is escalated into a separate scoped PR or incident note.

## Release blockers

Release must remain blocked if any of the following are observed:

- Session authority mixing between `admin_session_id` and `app_session_id`.
- Private data visible without a valid session.
- Cross-tenant access succeeds.
- RLS enforcement fails or is ambiguous.
- Private data remains available from cache after logout.
- Runtime/staging evidence references the wrong deployment commit.
- Logs or documentation expose secrets.
- CI is not green.
- Evidence is incomplete or not reproducible.

## Validation for this PR

This PR is documentation-only.

Expected local validation:

- `git diff --check`
- `git diff --cached --check`

No backend, API, auth, database, migration, dependency, lockfile, CI, script or test validation is required unless the diff unexpectedly leaves documentation-only scope.

## Closeout decision

After PR-S6 is merged, the Security Release documentation block is closed.

The next release step is to complete the PR-S5 runtime/staging evidence checklist against the exact staging deployment commit intended for promotion.

Any failed runtime or staging evidence must be handled in a new, focused PR.
