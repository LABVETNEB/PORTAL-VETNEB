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
 * PR-PRES-3 lands the first real catalog: the per-role module registry
 * (canonical ids/order, admin aliases, clinic default, pure parse helpers and
 * the clinic navigation label table). See
 * docs/implementation/dashboard-module-config-catalog.md.
 */
export * from "./dashboardModules";
