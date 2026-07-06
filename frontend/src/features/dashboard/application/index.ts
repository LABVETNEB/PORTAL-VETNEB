/**
 * Dashboard · application layer (boundary placeholder).
 *
 * Intended home for orchestration that is not presentation: the optimistic
 * module-navigation hook (URL sync, last-module, one-shot intent, two-commit
 * buffer), the module activation bus, the access-error store, server
 * auth/redirect helpers, and data-load wrappers (audit H2/H5/H6).
 *
 * Boundary rule: no JSX rendering — application coordinates state and data;
 * it does not render UI.
 *
 * Empty on purpose: PR-PRES-2 only draws the architecture boundary; real
 * exports land in a later PRES PR (see
 * docs/implementation/dashboard-presentation-boundaries.md).
 */
export {};
