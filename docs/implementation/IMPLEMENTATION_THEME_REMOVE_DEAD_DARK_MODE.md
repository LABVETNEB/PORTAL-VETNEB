# PR-VIS-1 — Remove Dead Dark Mode Wiring

> **Tipo:** Implementation evidence.
> **PR:** PR-VIS-1.
> **Hallazgo rector:** VIS-P1-003.
> **Scope:** frontend theme cleanup + implementation documentation.
> **Razonamiento Codex:** MEDIO.

## Summary

This PR removes the dead Tailwind class-based dark mode wiring while preserving the active VETNEB theme mechanism based on `data-theme="dark-gray"`.

The change is intentionally minimal:

- Remove `darkMode: "class"` from `frontend/tailwind.config.ts`.
- Remove the unused `.dark` token block from `frontend/src/app/globals.css`.
- Preserve the active `:root[data-theme="dark-gray"]` theme block.
- Preserve runtime theme initialization and toggle behavior.

## Evidence

The inspected frontend runtime uses `document.documentElement.dataset.theme` and the `vetneb-theme-mode` storage key.

The active dark-gray theme remains present in:

- `frontend/public/theme-init.js`
- `frontend/src/lib/theme.ts`
- `frontend/src/components/theme/ThemeModeToggle.tsx`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/globals.css`
- `frontend/e2e/theme-mode.spec.ts`

A refined case-sensitive search excluding generated artifacts confirms that the removed Tailwind wiring no longer exists in frontend source:

- `dark:`: no source matches.
- `.dark`: no source matches.
- `darkMode`: no source matches.
- `data-theme` / `dark-gray`: preserved.

The earlier broad PowerShell search reported `primaryDark` and `frontend/playwright-report/index.html`; those are not Tailwind dark-mode wiring and are excluded from the final source-only check.

## Files Changed

- `frontend/tailwind.config.ts`
- `frontend/src/app/globals.css`
- `docs/implementation/IMPLEMENTATION_THEME_REMOVE_DEAD_DARK_MODE.md`

## What Changed

- Removed dead `darkMode: "class"` configuration.
- Removed the unused `.dark` CSS variables block.
- Kept the real `[data-theme="dark-gray"]` path intact.
- Added this implementation evidence note.

## What Did Not Change

- No backend changes.
- No API/auth/DB/migration changes.
- No dependency, package, lockfile, workflow, CI or Playwright configuration changes.
- No visual redesign.
- No token redesign.
- No badge, filter, primitive, user-select, layout or no-scroll contract changes.
- No new `dark:` usage introduced.

## Validation

Executed successfully on Windows / PowerShell:

```powershell
pnpm install --frozen-lockfile
pnpm --dir frontend typecheck
pnpm --dir frontend lint
pnpm --dir frontend build
pnpm --dir frontend exec playwright test e2e/theme-mode.spec.ts --project=chromium
git diff --check
```

Results:

- `pnpm install --frozen-lockfile`: PASS.
- `pnpm --dir frontend typecheck`: PASS.
- `pnpm --dir frontend lint`: PASS.
- `pnpm --dir frontend build`: PASS.
- `theme-mode.spec.ts --project=chromium`: PASS, 2/2 tests.
- `git diff --check`: PASS; only Git line-ending warning observed for `globals.css`, no whitespace errors.

## Residual Risk

Low. The only residual risk would be an external, non-versioned consumer manually adding class `.dark` to the HTML root. No versioned frontend runtime path inspected uses that mechanism.

## Rollback

Revert this PR. That restores:

- `darkMode: "class"` in Tailwind.
- the `.dark` CSS variables block in `globals.css`.
- removal of this implementation evidence document.
