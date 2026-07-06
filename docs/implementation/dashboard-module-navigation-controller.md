# Dashboard module navigation controller (PR-PRES-4)

> Status: implemented · Scope: `frontend/src/features/dashboard/application/**`
> plus the two clinic navigation components that consume it.
> Predecessors: [dashboard-presentation-boundaries](./dashboard-presentation-boundaries.md),
> [dashboard-module-config-catalog](./dashboard-module-config-catalog.md).
> Audit: [dashboard-presentation-primitives-architecture-audit](../audit/dashboard-presentation-primitives-architecture-audit.md)
> (H1 module-truth duplication, H2 application boundary).

## Goal

Extract a **minimal, safe** utility for dashboard module navigation into the
application layer so the `?module=` grammar (href construction + URL→module
normalization) is declared once, without changing any visual behavior, public
route, CSS, permission, or no-scroll contract.

Non-goal: a full navigation rewrite. The intricate per-role controller effects
(URL sync, last-module restore, optimistic two-commit activation) are **left
intact** — see "What was deliberately left in the controllers" below.

## What was extracted

New module: `frontend/src/features/dashboard/application/dashboardModuleNavigation.ts`,
re-exported from `frontend/src/features/dashboard/application/index.ts`.

| Export | Purpose |
| --- | --- |
| `MODULE_QUERY_PARAM` | The single `"module"` query-key literal. |
| `buildDashboardModuleHref(basePath, moduleId)` | Pure, route-agnostic `?module=` href builder. Produces the exact string the surfaces built inline before. |
| `readClinicModuleFromLocation()` | SSR-safe read of the active clinic module from `window.location.search`, normalized through the catalog's `parseClinicModule` (no re-declared id check). |

Boundary rule (application layer): **no JSX**, SSR-safe (`window` guarded),
route-agnostic (callers pass `ROUTES.dashboard`). Only depends on the config
catalog (`../config`), so there is no cycle with the presentation components.

## Duplication removed

Two clinic navigation surfaces previously copied the same two concerns:

- **`DashboardModuleRail`** built `` `${ROUTES.dashboard}?module=${id}` `` in a
  local `moduleHref` helper.
- **`ClinicMobileBottomNav`** built the same `` `${ROUTES.dashboard}?module=${id}` ``
  string inline **and** re-implemented module validation in a private
  `parseClinicModuleFromLocation` (an ad-hoc `CLINIC_DESTINATIONS.some(...)` id
  check) instead of using the shared `parseClinicModule`.

After PR-PRES-4:

- Both surfaces build the href through `buildDashboardModuleHref`, so the
  `?module=` query key lives in exactly one place.
- `ClinicMobileBottomNav` reads the active module through
  `readClinicModuleFromLocation`, which delegates validation to the catalog
  parser — the private id check is gone, so the rail and the bottom-nav can no
  longer drift on which module ids are valid.

Behavior is byte-identical: `buildDashboardModuleHref(ROUTES.dashboard, id)`
returns the same href string, and `parseClinicModule` validates against the same
canonical `CLINIC_MODULE_IDS` set the bottom-nav checked before.

## What was deliberately left in the controllers

`AdminDashboardWorkspaceController` and `ClinicDashboardWorkspaceController` keep
their own navigation effects (URL sync, last-module restore, optimistic
two-commit activation, hub-reset handling). They were **not** folded into a
shared hook because:

1. **Source-invariant guardrails pin them verbatim.** Backend guardrail tests
   assert exact substrings such as
   `setActiveModule(parseAdminModule(searchParams.get("module")));`,
   `parseClinicModule(searchParams.get("module")) ?? DEFAULT_CLINIC_MODULE`,
   `router.replace(\`/dashboard/admin?module=${lastModule}\`)` and
   `router.replace(\`${ROUTES.dashboard}?module=${lastModule}\`)`, and require
   the restore path to stay `replace`-only (no `router.push`). These are an
   intentional anti-drift contract; relocating those lines behind a helper would
   break the contract without a behavior change.
2. **The two controllers diverge structurally.** Admin has a module hub, an
   alias-aware parse, an access-error store and a two-commit activation buffer;
   clinic has no hub and resolves a mandatory operational default. A shared hook
   would have to re-introduce both shapes behind flags — more coupling, not less.

Because the safe, genuinely-shared surface is the clinic rail + bottom-nav pair,
the extraction targets exactly those, and the controllers are untouched. This is
the "leave a too-different controller intact and document why" outcome the PR
brief calls for.

## Out of scope (unchanged)

Public routes, `ROUTES`, CSS/globals, permissions/auth, the config catalog and
its aliases, the Playwright visual-contract thresholds, visible module labels
and their order, the admin controller, the admin sidebar/horizontal-nav and
`DashboardHorizontalNav` (which keeps its own guardrail-pinned `?module=`
literals), and `page.tsx` files.

## Validation

- `pnpm test` (repo root) — backend + source-invariant guardrails.
- `pnpm build` (repo root).
- `pnpm typecheck`, `pnpm build`, `pnpm e2e:visual-contract` (frontend).
