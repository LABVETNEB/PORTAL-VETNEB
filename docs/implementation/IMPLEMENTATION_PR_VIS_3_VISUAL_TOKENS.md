# PR-VIS-3 — Visual Tokens, Gradient Hover And Badge Focus

> **Tipo:** Implementation evidence.
> **PR:** PR-VIS-3.
> **Hallazgos rectores:** VIS-P2-001, VIS-P2-002, VIS-P3-001, VIS-P3-002.
> **Scope:** frontend visual tokens + Badge focus contract + native tests + implementation documentation.
> **Razonamiento Codex:** MEDIO.

## Summary

This PR adds minimal frontend visual-system tokens for primary clinical gradient, hover gradient, clinical elevation and focus ring. It also fixes the primary gradient hover no-op and updates Badge focus styling from `focus:` to `focus-visible:`.

The change is intentionally surgical:

- Define CSS variables for primary clinical gradient and hover gradient.
- Define CSS variables for clinical shadow/elevation.
- Define a clinical focus-ring token.
- Replace only nearby primary-system gradient and shadow uses.
- Make `clinical-primary-gradient-hover:hover` visually distinct from the base gradient.
- Update `Badge` to use keyboard-specific `focus-visible:` styles.
- Update native frontend tests that guard these contracts.

## Evidence

The visual audit identified:

- Hardcoded clinical primary gradient values.
- A `clinical-primary-gradient-hover:hover` rule that repeated the base gradient.
- Hardcoded nearby clinical elevation shadows.
- Badge focus styling using `focus:` instead of `focus-visible:`.

This PR keeps the scope limited to the primary visual-system contract and does not migrate every historical shadow literal in the codebase.

## Files Changed

- `frontend/src/app/globals.css`
- `frontend/src/components/ui/badge.tsx`
- `test/frontend-badge-component.test.ts`
- `test/frontend-visual-consistency.test.ts`
- `docs/implementation/IMPLEMENTATION_PR_VIS_3_VISUAL_TOKENS.md`

## What Changed

- Added `--clinical-primary-gradient`.
- Added `--clinical-primary-gradient-hover`.
- Added `--clinical-shadow-*` tokens.
- Added `--clinical-focus-ring`.
- Preserved compatible tokens under `:root[data-theme="dark-gray"]`.
- Replaced nearby primary gradient/shadow usages with tokens.
- Changed `Badge` focus classes to `focus-visible:`.
- Updated native tests to assert the new token and focus-visible contracts.

## What Did Not Change

- No backend changes.
- No API/auth/DB/migration changes.
- No dependency, package, lockfile, workflow, CI or Playwright configuration changes.
- No dashboard or public redesign.
- No layout, density, navigation, filters, pagination, no-scroll or copy changes.
- No migration of all historical hardcoded shadows.
- No extraction or broad reorganization of `globals.css`.
- No new primitives.
- No semantic changes to `StatusBadge` or `AdminReportStatusBadge`.

## Validation

Executed successfully on Windows / PowerShell:

```powershell
pnpm install --frozen-lockfile
node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-badge-component.test.ts
node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-visual-consistency.test.ts
pnpm --dir frontend typecheck
pnpm --dir frontend lint
pnpm --dir frontend build
pnpm --dir frontend exec playwright test e2e/theme-mode.spec.ts --project=chromium
git diff --check
```

Results:

- `pnpm install --frozen-lockfile`: PASS; lockfile already up to date.
- `frontend-badge-component.test.ts`: PASS, 5/5.
- `frontend-visual-consistency.test.ts`: PASS, 15/15.
- `pnpm --dir frontend typecheck`: PASS.
- `pnpm --dir frontend lint`: PASS.
- `pnpm --dir frontend build`: PASS.
- `theme-mode.spec.ts --project=chromium`: PASS, 2/2 tests.
- `git diff --check`: PASS; only Git line-ending warnings observed for `globals.css` and `badge.tsx`, no whitespace errors.
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` and `frontend/package.json`: no diff.

## Residual Risk

Low. The PR intentionally does not migrate every hardcoded historical shadow usage. That broader migration remains outside PR-VIS-3 scope to avoid visual drift.

## Rollback

Revert this PR. That restores:

- previous hardcoded nearby primary gradient/shadow declarations;
- the previous no-op hover gradient;
- Badge `focus:` styling;
- the previous native test expectations;
- removal of this implementation evidence note.
