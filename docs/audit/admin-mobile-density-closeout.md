# Admin Mobile Density Closeout

## Scope

This closeout documents the completed Admin mobile density remediation block after the enterprise density and mobile whitebox audits.

The work focused on mobile operability regressions in the Admin dashboard while preserving the desktop enterprise density/no-scroll contract.

## Baseline

Starting point before this closeout:

- `main` clean.
- Latest merged PR: `#1058 fix(admin): make tokens toolbar mobile-safe`.
- Desktop enterprise density remained protected by existing no-scroll coverage.
- Mobile failures were addressed through focused PRs, not broad redesigns.

## Completed PRs

### #1056 — `fix(dashboard): make mobile shell nav touch safe`

Outcome:

- Made dashboard mobile shell/nav/topbar touch-safe.
- Preserved desktop shell density.
- Added focused mobile shell/nav E2E coverage.
- Protected active navigation visibility on Android/iOS-sized viewports.

### #1057 — `fix(admin): make clinics list mobile operable`

Outcome:

- Replaced Admin Clínicas mobile table dependency with mobile cards below `md`.
- Preserved dense desktop table from `md` upward.
- Kept `Editar` visible and touch-safe on mobile.
- Added responsive page sizing:
  - mobile: 3
  - desktop: 9
- Added E2E coverage for 360/390/430px mobile layouts.
- Preserved server-side search, pagination and edit drawer behavior.

### #1058 — `fix(admin): make tokens toolbar mobile-safe`

Outcome:

- Made Admin Tokens toolbar wrap safely on 360/390/430px mobile widths.
- Kept clinic filter input full-width on mobile and compact on desktop.
- Added neutral `data-*` selectors that avoid token-sensitive attribute names.
- Added focused mobile toolbar E2E coverage.
- Preserved desktop table/no-scroll behavior and existing token actions.
- Preserved public surface security audit without allowlist changes.

## Validation Summary

The block was validated through targeted and regression checks across the PRs, including:

- Static enterprise density/source-contract tests.
- Focused Playwright mobile tests for Android/iOS-sized widths.
- Desktop dashboard no-scroll checks.
- Drawer/navigation/accessibility regressions where relevant.
- Frontend typecheck.
- Frontend lint.
- Full static test suite.
- Backend/frontend builds where required.
- Public surface/security audit where required.

## Current Protected Areas

The following areas are now explicitly protected:

- Dashboard mobile shell/nav/topbar.
- Admin Clínicas mobile cards and edit action visibility.
- Admin Tokens mobile toolbar wrapping and action visibility.
- Desktop Admin Clínicas no-scroll behavior.
- Desktop Admin Tokens no-scroll behavior.
- Sensitive public surface contract for token-related DOM attributes.

## Deferred / Remaining Work

The following items remain candidates for future small PRs:

- Admin Reports / Informes mobile toolbar and row actions.
- Other Admin read-only cards with `Actualizar` actions on narrow mobile widths.
- Drawer accessibility warnings from Radix dialogs, if still present.
- Public-route browser console `removeChild` warning observed during unrelated E2E runs.
- A broader Clinic dashboard mobile density pass, if requested.

## Closeout Decision

This block is considered complete for the Admin mobile density fixes addressed by PRs `#1056`, `#1057` and `#1058`.

Future work should continue as separate small PRs, each with:

- one module or one interaction surface per branch;
- no backend/security/dependency changes unless explicitly required;
- focused E2E coverage for 360/390/430px mobile viewports when fixing mobile UI;
- desktop no-scroll regression coverage when modifying dashboard density.
