/**
 * Dashboard · application layer.
 *
 * Home for orchestration that is not presentation. PR-PRES-4 lands the first
 * real exports: the shared `?module=` navigation helpers (href construction and
 * URL→module normalization) reused by the clinic module rail and mobile
 * bottom-nav. Still to follow (audit H2/H5/H6): the optimistic module-navigation
 * hook (URL sync, last-module, one-shot intent, two-commit buffer), the module
 * activation bus, the access-error store, server auth/redirect helpers, and
 * data-load wrappers.
 *
 * Boundary rule: no JSX rendering — application coordinates state and data;
 * it does not render UI.
 *
 * @see docs/implementation/dashboard-module-navigation-controller.md
 * @see docs/implementation/dashboard-presentation-boundaries.md
 */
export * from "./dashboardModuleNavigation";
