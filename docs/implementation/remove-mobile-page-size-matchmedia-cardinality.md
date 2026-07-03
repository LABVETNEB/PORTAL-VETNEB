# R-08 — cleanup: remove residual MOBILE_PAGE_SIZE / matchMedia cardinality sources

Ref: `docs/audit/final-global-vetneb-50-60-pr-roadmap.md`, `docs/implementation/server-adaptive-pagination-strategy.md` PR-CLEAN-1.

## Scope

R-08 is a comment/doc cleanup pass, no runtime behavior change. By the time
this PR ran, `MOBILE_PAGE_SIZE` and `matchMedia`-as-cardinality had already
been removed as sources of truth in every migrated Admin module (Sessions,
Roles, Clinics, Reports, Tokens, Audit, FailedLogin Alerts — PR-SRV-1/PR-SRV-2
series). What remained were:

1. Residual code comments in two already-migrated modules that still named
   the old constants/mechanism for historical contrast.
2. No native guard test recursing `frontend/src/app/dashboard/admin/**` to
   pin the absence of these sources going forward (existing coverage was
   per-module, e.g. `test/admin-reports-enterprise-density.test.ts`).

## Grep inicial (runtime)

```
frontend/src/app/dashboard/admin/AdminMobileHealthModule.tsx: window.matchMedia real
frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx: window.matchMedia real
frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx: window.matchMedia real
frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx: comentarios con MOBILE_PAGE_SIZE/matchMedia
frontend/src/app/dashboard/admin/AdminReportsCard.tsx: comentarios con MOBILE_PAGE_SIZE/matchMedia
```

## Clasificación

- `AdminParticularTokensCard.tsx` (lines ~105-113, ~540-543) and
  `AdminReportsCard.tsx` (lines ~55-62, ~217-220): comment-only residue.
  Rewritten to describe the removed mechanism ("the old fixed mobile row
  count", "a media query") without repeating the literal identifiers
  `MOBILE_PAGE_SIZE` / `matchMedia`. No code changed.
- `AdminMobileHealthModule.tsx`, `AdminMobileMaintenanceModule.tsx`,
  `AdminMobilePricingModule.tsx`: real `window.matchMedia("(max-width:
  767px)")` calls, but they gate which lazy mobile chunk mounts (schema
  health / maintenance / pricing panels), never row count, `limit`,
  `offset`, or pagination. Left untouched — these are legitimate
  presentation gates, not cardinality sources, per
  `server-adaptive-pagination-strategy.md` §7.4.

## Qué se eliminó

- The literal strings `MOBILE_PAGE_SIZE` and `matchMedia` from comments in
  `AdminParticularTokensCard.tsx` and `AdminReportsCard.tsx` (4 comment
  blocks total). No executable code, constants, or logic changed.

## Guard test agregado

`test/admin-mobile-page-size-matchmedia-cardinality-guard.test.ts`:

- Recurses `frontend/src/app/dashboard/admin/**` (`.ts`/`.tsx`, excluding
  test files).
- Fails if `MOBILE_PAGE_SIZE` appears anywhere in Admin runtime.
- Fails if `matchMedia` appears in any Admin file **except** the three-file
  allowlist below.
- A third test asserts the allowlist itself stays truthful (files exist and
  still use `matchMedia`), so a future removal of the lazy-load gate doesn't
  leave a stale allow entry masking a real regression.

### Allowlist razonada (matchMedia permitido, no cardinal)

```
frontend/src/app/dashboard/admin/AdminMobileHealthModule.tsx
frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx
frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx
```

Each uses `window.matchMedia("(max-width: 767px)")` solely to decide whether
to lazy-load its mobile-only panel component. None of the three reads,
computes, or forwards a page size, `limit`, `offset`, or row count from the
media query result.

## Grep final

```
$ git grep -n "MOBILE_PAGE_SIZE" -- frontend/src/app/dashboard/admin test docs/implementation
(only docs/implementation/*.md historical write-ups and this file — no runtime code)

$ git grep -n "matchMedia" -- frontend/src/app/dashboard/admin test docs/implementation
frontend/src/app/dashboard/admin/AdminMobileHealthModule.tsx       (allowlisted, non-cardinal)
frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx  (allowlisted, non-cardinal)
frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx      (allowlisted, non-cardinal)
test/admin-mobile-page-size-matchmedia-cardinality-guard.test.ts   (new guard test)
(plus existing per-module tests and docs/implementation/*.md historical write-ups)
```

## Confirmación sin cambio de comportamiento

- Only comments were rewritten in `AdminParticularTokensCard.tsx` and
  `AdminReportsCard.tsx`; no identifiers, constants, JSX, or logic touched.
- The new test file only reads source files and asserts string absence — it
  does not import or execute Admin components.
- `AdminMobileHealthModule.tsx`, `AdminMobileMaintenanceModule.tsx`,
  `AdminMobilePricingModule.tsx` were not modified.

## R-09

R-09 not executed. Out of scope for this PR.
