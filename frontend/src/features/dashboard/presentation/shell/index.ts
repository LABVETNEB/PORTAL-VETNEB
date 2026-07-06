/**
 * Dashboard · presentation/shell (boundary placeholder).
 *
 * Intended home for the persistent app-shell chrome: PrivateDashboardShell,
 * DashboardShellRouter, DashboardTopbar, DashboardModuleWorkspace,
 * DashboardModuleHub, DashboardHubHero and the module stage (audit §6).
 *
 * Boundary rule: presentation does not import `@/lib/api` directly; it
 * receives data via props or via `application` hooks. Preserve DOM nesting,
 * class names and `data-*` contract attributes when relocating here.
 *
 * Empty on purpose: PR-PRES-2 only draws the architecture boundary (see
 * docs/implementation/dashboard-presentation-boundaries.md).
 */
export {};
