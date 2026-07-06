/**
 * Dashboard · presentation/layout (boundary placeholder).
 *
 * Intended home for layout primitives: DashboardPageHeader,
 * DashboardSidebarFrame, the viewport-switch primitive (desktop vs mobile
 * branches) and stage wrappers (audit §6).
 *
 * Boundary rule: presentation does not import `@/lib/api` directly. The
 * no-scroll height chain depends on `min-h-0`/`flex-1` and classes such as
 * `dashboard-module-stage`; preserve classes and DOM nesting when relocating.
 *
 * Empty on purpose: PR-PRES-2 only draws the architecture boundary (see
 * docs/implementation/dashboard-presentation-boundaries.md).
 */
export {};
