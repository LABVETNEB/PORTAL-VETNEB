# feat(dashboard): add expanded sidebar brand identity

## Summary
- Added a visible brand identity block in the dashboard sidebar header on `2xl+` screens
  (logo + "Portal VETNEB" + the existing `dashboardLabel`).
- Preserved the exact compact header behavior below `2xl` (logo only, no visible text).
- Preserved navigation contracts, active state and accessibility from PR #993/#994/#995.
- Markup/CSS-only: no new copy, no new state, no effects/listeners, no dependencies.

## Problem
After PR #995 added expanded nav labels, the sidebar header stayed visually compact even at `2xl`,
so the product identity was weak on large desktops and the premium-software perception suffered.

## Scope
Files changed:
- `frontend/src/components/dashboard/DashboardSidebarFrame.tsx` (shared frame header — responsive markup/classes only)
- `test/frontend-dashboard-shell.test.ts` (added a brand-identity contract test)
- `test/frontend-visual-consistency.test.ts` (updated the header `<div>` exact-class assertion)

Not modified:
- `DashboardShellRouter.tsx` — layout already absorbs the expanded width (`shrink-0` sidebar next to
  `flex-1 min-w-0` content), no change needed.

Out of scope (not touched):
- `AdminDashboardSidebar.tsx`, `ClinicDashboardSidebar.tsx`, controllers, `DashboardModuleHub.tsx`,
  `DashboardModuleWorkspace.tsx`, `MasterDetailWorkspace.tsx`, `notification-destinations.ts`.
- Routing / module ids / active state, sidebar toggle, mobile bottom nav, drawer, new navigation,
  new commercial copy, dependencies, FlexSearch, profile, password change, backend, APIs, DB,
  public routes, global CSS, PWA/service worker.

## Git verification
Checked by terminal before creating the branch (all matched the required criteria):
- `git branch --show-current` → `main`
- `git status --short --untracked-files=all` → empty (clean)
- `git log -1 --oneline` → `4bb8d8f feat(dashboard): add expanded sidebar labels (#995)`
- `git rev-list --left-right --count main...origin/main` → `0  0` (in sync)
- `gh pr list --state open` → no open pull requests
- `git branch -r --no-merged origin/main` → empty
- `git branch` → only `main`

Branch created: `feat/dashboard-sidebar-brand-identity`.

## Responsive behavior
Below `2xl` (unchanged):
- Header `justify-center px-2`, logo centered, no visible text.
- Brand text stays `sr-only` (accessible to screen readers), so the accessible name is preserved.

At `2xl` and above:
- Header switches to `2xl:justify-start 2xl:gap-3 2xl:px-3`; logo gains `shrink-0` so it keeps its size.
- A visible brand block appears (`hidden min-w-0 2xl:block`): "Portal VETNEB" (`text-sm font-semibold`)
  over `{dashboardLabel}` (`text-xs text-sidebar-foreground/70`), both `truncate` to avoid overflow.

## Accessibility
- The brand text reuses the existing `dashboardLabel` prop; no hardcoded admin/clinic copy.
- The compact `sr-only` brand span is hidden at `2xl` (`sr-only 2xl:hidden`) and the visible block is
  hidden below `2xl` (`hidden ... 2xl:block`), so exactly one brand text source is exposed per
  breakpoint — no duplicated accessible name.
- `aside`/`nav` `aria-label`, single `aria-current="page"`, nav `title`, focus rings and keyboard
  navigation are unchanged.
- Secondary label uses the same `text-sidebar-foreground/*` palette already used for nav items
  (reasonable contrast on the sidebar surface).

## Performance / Security / PWA
- Pure markup/CSS responsive classes; no React state, effects, listeners, observers or DOM measurement.
- No routing, session, backend, storage or API changes; no new URLs; PWA cache policy untouched
  (dashboards remain uncached).

## Validation
Commands executed and results:
- `git diff --check` → OK (no whitespace/conflict errors).
- `pnpm --dir frontend lint` → pass (eslint, no findings).
- `pnpm --dir frontend typecheck` → pass (`tsc --noEmit`, no errors).
- `pnpm --dir frontend build` → pass (all `/dashboard/*` routes remain `ƒ Dynamic`).
- `pnpm test` → 2707 passed, 0 failed.
- `pnpm security:public-surface` → PASS (only pre-existing `[server-only]` markers in
  `frontend/src/proxy.ts`, untouched).

## Tests
- `frontend-dashboard-shell.test.ts`: new test asserts the brand reuses `dashboardLabel`/`Portal VETNEB`,
  stays `sr-only 2xl:hidden` when compact, and exposes a `hidden min-w-0 2xl:block` visible block at `2xl`.
- `frontend-visual-consistency.test.ts`: header `<div>` exact-class regex updated for the new `2xl:`
  utilities. The PR #995 width/label assertions (`2xl:w-60`, `2xl:not-sr-only`, nav-item classes)
  remain unchanged and green.

## Risk
Low. Markup/CSS-only visual refinement in the shared sidebar header; behavior below `2xl` is
equivalent, and navigation/active-state/accessibility contracts are preserved by tests.

## Rollback
Revert this PR.
