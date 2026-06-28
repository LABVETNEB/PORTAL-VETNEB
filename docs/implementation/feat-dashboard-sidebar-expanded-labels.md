# feat(dashboard): add expanded sidebar labels

## Summary
- Added visible icon + label sidebar rows on very large desktop screens (`2xl` and above).
- Preserved the compact icon-only sidebar behavior below `2xl`.
- Preserved every navigation contract, active-state logic and accessibility attribute from
  PR #993 / PR #994 (`?module=` navigation, single `aria-current="page"`, `aria-label`, `title`,
  `sr-only`, focus rings).
- CSS/Tailwind-only change: no new React state, no resize listeners, no DOM measurement, no deps.

## Problem
The dashboard sidebar was icon-only across all breakpoints; labels were `sr-only` and only available
through `title`/tooltip. For non-technical veterinary-clinic users this reduced navigation clarity,
and on large desktops there is room to show labels without hurting the workspace.

## Scope
Files changed:
- `frontend/src/components/dashboard/DashboardSidebarFrame.tsx` (shared frame — responsive classes only)
- `test/frontend-dashboard-shell.test.ts` (added a responsive-label contract test)
- `test/frontend-visual-consistency.test.ts` (updated the two exact-class assertions whose strings changed)

Not modified (in scope but unnecessary):
- `DashboardShellRouter.tsx` — it lays out the sidebar as `shrink-0` next to a `flex-1 min-w-0`
  content area, so the wider sidebar at `2xl` is absorbed automatically without any change.

Out of scope (not touched):
- `AdminDashboardSidebar.tsx`, `ClinicDashboardSidebar.tsx`, `AdminDashboardWorkspaceController.tsx`,
  `ClinicDashboardWorkspaceController.tsx`, `DashboardModuleHub.tsx`, `DashboardModuleWorkspace.tsx`,
  `MasterDetailWorkspace.tsx`, `notification-destinations.ts`.
- Routing / query params / module ids, FlexSearch, profile, password change, backend, APIs, DB,
  public routes, mobile bottom nav, overlay drawer, manual collapse toggle, PWA/service worker.

## Responsive behavior
Below `2xl` (mobile / tablet / notebook) — unchanged:
- `aside` width stays `w-[4.5rem]`.
- Nav rows stay `justify-center` (icon centered).
- Labels stay `sr-only` (available to screen readers); `title` provides the sighted-user hint.

At `2xl` and above (large desktop):
- `aside` expands to `w-60` (`w-[4.5rem] 2xl:w-60`).
- Nav rows switch to `2xl:justify-start 2xl:px-3` (icon left, label right, full-row active state).
- Labels become visible via `2xl:not-sr-only 2xl:truncate` (long labels truncate, no layout break).
- The "Volver al sitio público" footer action follows the same compact→expanded pattern.

The brand/header stays compact (logo only) at every breakpoint to keep the change minimal and the
header uncluttered; no commercial brand text was introduced.

## Accessibility
- `aside` keeps `role="navigation"` + `aria-label="Navegación principal"`; inner `nav` keeps
  `aria-label="Menú principal"`.
- `aria-current="page"` is still derived from `isActive(item.href, item.exact)` and applies to a
  single item per URL state (logic unchanged from PR #993).
- Each row keeps `aria-label={item.label}` and `title={item.label}`, so the accessible name is
  stable and the visible label (when shown at `2xl`) matches it — no harmful duplication.
- Labels remain `sr-only` below `2xl`; `not-sr-only` only reveals them at `2xl`.
- Focus ring (`focus-visible:ring-2 focus-visible:ring-ring/85 ...`) and keyboard navigation are
  unchanged.

## Performance / PWA / Security
- Pure CSS/Tailwind responsive classes; no client-side JS, state, listeners or measurements added.
- No routing, session, `redirectToLoginOnUnauthorized`, backend or API changes.
- No external URLs introduced. No service worker / cache policy change (dashboards stay uncached).

## Validation
Commands executed and results:
- `git diff --check` → OK (no whitespace/conflict errors).
- `pnpm --dir frontend lint` → pass (eslint, no findings).
- `pnpm --dir frontend typecheck` → pass (`tsc --noEmit`, no errors).
- `pnpm --dir frontend build` → pass (all `/dashboard/*` routes remain `ƒ Dynamic`).
- `pnpm test` → 2706 passed, 0 failed.
- `pnpm security:public-surface` → PASS (only pre-existing `[server-only]` markers in
  `frontend/src/proxy.ts`, untouched).

## Tests
- `frontend-dashboard-shell.test.ts`: new test asserts compact defaults (`w-[4.5rem]`,
  `justify-center`, `sr-only ...`) and expanded `2xl` behavior (`2xl:w-60`, `2xl:justify-start`,
  `2xl:not-sr-only`).
- `frontend-visual-consistency.test.ts`: the two exact sidebar class regexes (aside width and
  nav-item base classes) updated to include the new `2xl:` utilities.
- Navigation/active-state contracts (`frontend-admin-sidebar-module-navigation.test.ts`,
  `frontend-dashboard-workspace-layout-polish.test.ts`) continue to pass unchanged.

## Risk
Low to medium. Shared dashboard layout visual change, but no routing or data logic; behavior below
`2xl` is byte-for-byte equivalent and active-state/accessibility contracts are preserved by tests.

## Rollback
Revert this PR.
