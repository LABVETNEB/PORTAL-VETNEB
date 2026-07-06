# `features/dashboard/` — presentation architecture boundary

> **PR-PRES-2.** Structural boundary only. **No components were moved, no CSS
> was touched, no routes changed, no behavior changed.** Every `index.ts` here
> is an empty placeholder barrel (`export {}`) that documents the layer
> contract and reserves the import surface for later PRES PRs.

This folder mirrors, in the TSX/React layer, the modularization the dashboard
CSS already achieved in #1289/#1290. It exists to give future
behavior-preserving extractions a declared home, so that a module or style
change touches one file instead of the 8+ duplication points documented in the
audit.

## Layers

```
features/dashboard/
  config/          module catalog per role — single source of truth
  domain/          module types, parse/validation, pure view-models
  application/     navigation hook, activation bus, access-error store,
                   server-auth/redirect, data-load wrappers
  presentation/    UI only, mirroring the CSS taxonomy
    shell/         app-shell chrome + module workspace/hub + stage
    navigation/    rail, bottom-nav, horizontal nav, sidebars, menus
    layout/        page header, sidebar frame, viewport-switch, stages
    surfaces/      states, StatsCards, StatusBadge, filters, tabs, tables
    admin/         admin workspace wrappers (Admin*Card / Admin*Mobile*)
    clinic/        clinic workspace wrappers (Clinic*Card / summaries)
```

## Boundary rules

- `config` and `domain` **do not import React** — pure data, types and
  functions.
- `application` **does not render JSX** — it coordinates state and data.
- `presentation` **does not import `@/lib/api` directly** — data arrives via
  props or via `application` hooks.
- Relocations into `presentation` must **preserve DOM nesting, class names and
  `data-*` contract attributes** (the contract between TSX, the composed CSS
  and the Playwright selectors). Move ≠ rename.

## Status

Empty on purpose. The migration plan (PR-PRES-3..6) lives in
[`docs/implementation/dashboard-presentation-boundaries.md`](../../../../docs/implementation/dashboard-presentation-boundaries.md)
and the full rationale in
[`docs/audit/dashboard-presentation-primitives-architecture-audit.md`](../../../../docs/audit/dashboard-presentation-primitives-architecture-audit.md).
