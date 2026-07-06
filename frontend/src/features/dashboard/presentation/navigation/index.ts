/**
 * Dashboard · presentation/navigation (boundary placeholder).
 *
 * Intended home for module navigation surfaces: DashboardModuleRail,
 * Admin/ClinicMobileBottomNav, DashboardHorizontalNav,
 * Admin/ClinicDashboardSidebar, pagers, AdminMobile menus / hub launcher and
 * the kebab (audit §6). These consume the `config` catalog and the
 * `application` navigation hook rather than re-declaring module literals.
 *
 * Boundary rule: presentation does not import `@/lib/api` directly. Preserve
 * DOM nesting, class names and `data-*` contract attributes when relocating.
 *
 * Empty on purpose: PR-PRES-2 only draws the architecture boundary (see
 * docs/implementation/dashboard-presentation-boundaries.md).
 */
export {};
