/**
 * Dashboard · config layer (boundary placeholder).
 *
 * Intended single source of truth for the dashboard module catalog per role
 * (id, alias, label, shortLabel, icon, title, description, storageKey and
 * navigation destinations). Downstream surfaces (rail, bottom-nav, sidebar,
 * topbar, quick-links) should derive their view from here instead of
 * re-declaring literals (audit H1).
 *
 * Boundary rule: no React imports — pure data/config only.
 *
 * Empty on purpose: PR-PRES-2 only draws the architecture boundary; the real
 * catalog exports land in a later PRES PR (see the plan in
 * docs/implementation/dashboard-presentation-boundaries.md).
 */
export {};
