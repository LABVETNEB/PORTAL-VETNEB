# fix(admin): sidebar module navigation

## Summary
- Replaced admin sidebar hash-anchor module links (`#admin-*`) with query-param module links (`?module=admin-*`).
- Updated the shared sidebar active-state logic to resolve the active item from the `module` query param.
- Preserved existing sidebar labels, icons, order, accessibility attributes and clinical sidebar behavior.
- No visual redesign, no new labels, no FlexSearch, no password change, no module refactors.

## Problem
The admin sidebar linked to hash anchors (e.g. `${ROUTES.dashboardAdmin}#admin-clinics`), while
`AdminDashboardWorkspaceController` activates modules via `?module=...` query params
(`searchParams.get("module")`).

Consequences:
- Clicking a sidebar item did not activate the corresponding workspace module.
- `DashboardSidebarFrame.isActive` compared only `pathname` (it stripped the `#`), so on
  `/dashboard/admin` every hash item resolved to the same pathname and **all** admin items were
  marked active at once (plus the home item), making `aria-current="page"` appear multiple times.
- The lateral navigation was effectively decorative; users had to rely on the card hub.

The clinic sidebar already used `?module=perfil` / `?module=tokens` but, because the shared frame
ignored query params, those items were never highlighted either — the same root defect.

## Root cause
`DashboardSidebarFrame.isActive()` derived the active state from `pathname` only and discarded the
query string, so query-param-based module navigation could never be reflected in the active item.

## Fix
- `AdminDashboardSidebar.tsx`: each module item now uses `${ROUTES.dashboardAdmin}?module=<moduleId>`.
  The 9 module ids map 1:1 to the controller's `AdminModule` union
  (`admin-report-upload`, `admin-health`, `admin-clinics`, `admin-particular-tokens`,
  `admin-pricing`, `admin-sessions`, `admin-users-roles`, `audit-log`, `admin-maintenance`).
  The "Administración" home item stays an exact, no-module link to `ROUTES.dashboardAdmin`.
- `DashboardSidebarFrame.tsx`:
  - Reads the active module with `useSearchParams().get("module")`.
  - `getPathFromHref` now strips both `?` and `#` before comparing paths.
  - New `getModuleFromHref` parses the module id from an item href via `URLSearchParams` (returns
    `null` when the href has no query — safe for hrefs without a module).
  - `isActive` rules:
    - module item → active only when `pathname` matches **and** `activeModule === hrefModule`;
    - exact/home item → active only when `pathname` matches **and** no module is selected;
    - other items → unchanged (`pathname` equality / prefix), preserving clinic behavior.
  - The search-param-dependent nav was extracted into an inner `DashboardSidebarNav` wrapped in a
    React `<Suspense>` boundary. This is required by Next.js App Router: `useSearchParams()` in a
    layout-level client component otherwise fails the production build with
    "useSearchParams() should be wrapped in a suspense boundary" during the prerender pass.

## Accessibility
- Exactly one item carries `aria-current="page"` per URL state (verified by the active-state rules).
- `aria-label`, `title`, `sr-only` text and keyboard focus rings are unchanged.

## Scope
Files changed:
- `frontend/src/components/dashboard/AdminDashboardSidebar.tsx`
- `frontend/src/components/dashboard/DashboardSidebarFrame.tsx`
- `test/frontend-admin-sidebar-module-navigation.test.ts` (new regression test)
- `test/admin-dashboard-sections-contract.test.ts` (href contract updated to `?module=`)
- `test/frontend-dashboard-shell.test.ts` (import + `isActive` + admin href assertions updated)
- `test/frontend-admin-particular-tokens.test.ts` (sidebar href assertion updated to `?module=`)

Out of scope (not modified):
- `AdminDashboardWorkspaceController.tsx`, `ClinicDashboardSidebar.tsx`,
  `ClinicDashboardWorkspaceController.tsx`, `DashboardModuleHub.tsx`,
  `DashboardModuleWorkspace.tsx`, `MasterDetailWorkspace.tsx`.
- `frontend/src/lib/notification-destinations.ts` (uses `#admin-*` anchors; separate concern,
  its test `frontend-notification-destinations.test.ts` stays green).
- Visual redesign, sidebar labels, FlexSearch, password change, dashboard module refactors,
  global CSS, backend, APIs, database, public routes.

## Validation
Commands executed and results:
- `git diff --check` → OK, no whitespace/conflict errors.
- `pnpm --dir frontend lint` → pass (eslint, no findings).
- `pnpm --dir frontend typecheck` → pass (`tsc --noEmit`, no errors).
- `pnpm --dir frontend build` → pass. All `/dashboard/*` routes report as `ƒ (Dynamic)`.
  (First build before the Suspense fix failed on `/dashboard/logistica/metricas` with the
  useSearchParams suspense-boundary error; resolved by the `<Suspense>` boundary.)
- `pnpm test` → 2703 passed, 0 failed.
- `pnpm security:public-surface` → PASS, no public devtools exposure findings
  (only pre-existing `[server-only]` markers in `frontend/src/proxy.ts`, untouched).

## Manual QA (expected behavior)
- `/dashboard/admin` → only "Administración" (home) active; no other item active.
- `/dashboard/admin?module=admin-clinics` → only "Clínicas" active; workspace shows Clínicas.
- `/dashboard/admin?module=audit-log` → only "Auditoría" active.
- `/dashboard/admin?module=admin-health` → only "Estado" active (system health).
- Clicking any admin sidebar item switches the workspace to the matching module.
- Clinic sidebar: `/dashboard` → "Dashboard" active; `/dashboard/informes` → "Informes" active;
  `/dashboard/logistica` → "Logística" active. Module links (`?module=perfil`, `?module=tokens`)
  now also highlight their own item.

## Risk
Low. Change is limited to admin sidebar hrefs and the shared active-state detection. The clinic
sidebar's standard-path behavior is preserved; its pre-existing `?module=` links now highlight
correctly (latent fix). The added `<Suspense>` boundary only affects the brief prerender shell;
private dashboard routes render dynamically.

## Rollback
Revert this PR.
