# fix(admin): align notification destinations with module navigation

## Summary
- Updated admin notification destinations in `notification-destinations.ts` from hash anchors
  (`#admin-*`) to the `?module=...` query-param contract used by the admin dashboard.
- Preserved role routing, event/type handling and destination semantics.
- Updated and extended the notification destination contract tests.
- No visual redesign, no backend changes, no clinic/particular destination changes.

## Problem
PR #993 moved the admin dashboard navigation to the `?module=<moduleId>` contract
(`AdminDashboardSidebar` + `DashboardSidebarFrame` + `AdminDashboardWorkspaceController`), but
`buildNotificationDestination("admin", ...)` still returned `#admin-*` hash anchors:

```ts
return `${ROUTES.dashboardAdmin}#admin-particular-tokens`;
return `${ROUTES.dashboardAdmin}#admin-notifications`;
```

On the current dashboard those anchors only exist inside a module workspace that is rendered after
the module is activated, so a notification click navigated to `/dashboard/admin` (the hub) without
opening the relevant workspace.

## Fix
`frontend/src/lib/notification-destinations.ts`, `case "admin"` only:

| Before                                          | After                                            |
| ----------------------------------------------- | ------------------------------------------------ |
| `${ROUTES.dashboardAdmin}#admin-particular-tokens` | `${ROUTES.dashboardAdmin}?module=admin-particular-tokens` |
| `${ROUTES.dashboardAdmin}#admin-notifications`     | `${ROUTES.dashboardAdmin}?module=audit-log`               |

Mapping rationale:
- `admin-particular-tokens` is a valid `AdminModule`, so the report/token branch maps directly.
- There is **no** `admin-notifications` module. The "Notificaciones" card (`id="admin-notifications"`)
  is rendered **inside the `audit-log` workspace** (`app/dashboard/admin/page.tsx`), so the
  study-tracking-notification branch maps to `?module=audit-log`, which opens the workspace that
  contains that card. Module ids now match the dashboard admin contract.

The notification surfaces (event names, types, role routing, clinic and particular branches) are
unchanged. `DashboardNotificationsBell` was not modified: it `router.push`-es the destination
(activating the workspace via the controller) and its `scrollToHashDestination` helper already
returns early when the destination has no hash, so query-param destinations navigate correctly and
skip the now-unnecessary in-page scroll.

## Scope
Files changed:
- `frontend/src/lib/notification-destinations.ts`
- `test/frontend-notification-destinations.test.ts` (admin contract updated + regression tests added)

Out of scope (not modified):
- `AdminDashboardSidebar.tsx`, `DashboardSidebarFrame.tsx`, `AdminDashboardWorkspaceController.tsx`,
  `DashboardModuleHub.tsx`, `DashboardModuleWorkspace.tsx`, `MasterDetailWorkspace.tsx`,
  `ClinicDashboardSidebar.tsx`, `ClinicDashboardWorkspaceController.tsx`,
  `DashboardNotificationsBell.tsx`.
- Clinic and particular notification destinations (still use their existing in-page anchors).
- Sidebar redesign, labels, FlexSearch, password change, global CSS, backend, APIs, database.

## Security
- All destinations remain internal (`ROUTES.*` relative paths); test asserts no `http(s)://` URLs.
- Only `module=<moduleId>` is added to the query string — no tokens, ids or sensitive data exposed.
- No role/permission changes; clinic/particular routing untouched; no backend touched.

## Validation
Commands executed and results:
- `git diff --check` → OK (no whitespace/conflict errors).
- `pnpm --dir frontend lint` → pass (eslint, no findings).
- `pnpm --dir frontend typecheck` → pass (`tsc --noEmit`, no errors).
- `pnpm --dir frontend build` → pass.
- `pnpm test` → 2705 passed, 0 failed.
- `pnpm security:public-surface` → PASS (only pre-existing `[server-only]` markers in
  `frontend/src/proxy.ts`, untouched).

## Tests
`test/frontend-notification-destinations.test.ts`:
- Admin contract assertions updated to `?module=admin-particular-tokens` and `?module=audit-log`.
- New: admin case contains no `#admin-` anchors; every `?module=` id is a valid `AdminModule`
  (cross-checked against `AdminDashboardWorkspaceController.tsx`).
- New: clinic/particular anchors preserved; no external URLs in the module.

## Risk
Low. URL contract alignment only, limited to the admin notification branch.

## Rollback
Revert this PR.
