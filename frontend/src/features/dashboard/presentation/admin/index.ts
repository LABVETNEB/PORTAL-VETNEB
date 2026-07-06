/**
 * Dashboard · presentation/admin (boundary placeholder).
 *
 * Intended home for admin workspace wrappers: Admin*Card and
 * Admin*Mobile*Module surfaces (audit §6). These compose `surfaces`
 * primitives and consume `application` hooks / `config` catalog.
 *
 * Boundary rule: presentation does not import `@/lib/api` directly; data
 * arrives via props or `application`. Splitting the admin god-cards is out of
 * scope for the PRES structural PRs.
 *
 * Empty on purpose: PR-PRES-2 only draws the architecture boundary (see
 * docs/implementation/dashboard-presentation-boundaries.md).
 */
export {};
