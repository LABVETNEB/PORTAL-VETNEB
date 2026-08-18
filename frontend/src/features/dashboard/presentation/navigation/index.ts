/**
 * Dashboard · presentation/navigation (B01 re-export boundary).
 *
 * Home for the module navigation surfaces: DashboardHorizontalNav,
 * DashboardModuleRail, Admin/ClinicMobileBottomNav, the AdminMobile hub
 * launcher / pager / menus / kebab and the pagers (audit §6). These consume the
 * `config` catalog and the `application` navigation helpers rather than
 * re-declaring module literals.
 *
 * B01 populates this barrel with **behaviour-preserving re-exports**: nothing is
 * moved, reimplemented or renamed, and no consumer is migrated. The
 * implementations stay pinned at `@/components/dashboard/*`, so DOM nesting,
 * class names and `data-*` contract attributes are untouched. This is the
 * sanctioned "reexportar durante la migración" step of audit §47.2 /
 * mitigation R14.
 *
 * Ownership rule: this barrel re-exports, it never becomes a new owner. Module
 * ids, labels, storage keys and navigation tables stay single-owned by
 * `@/features/dashboard/config` and `@/features/dashboard/application`.
 *
 * Boundary rule: presentation does not reach the data layer. Neither this
 * barrel nor any module it re-exports may import `@/lib/api` or the `app/`
 * layer — enforced by
 * `test/architecture/dashboard-presentation-import-boundaries.test.ts`, which
 * follows every re-export into its legacy target.
 *
 * `AdminDashboardSidebar` and `ClinicDashboardSidebar` are deliberately absent:
 * they have no runtime consumers and their disposition belongs to B02. B01
 * neither exposes nor removes them.
 *
 * @see docs/implementation/dashboard-presentation-shell-navigation-barrels.md
 * @see docs/implementation/dashboard-presentation-boundaries.md
 */
export {
  DashboardHorizontalNav,
  type DashboardNavSurface,
} from "@/components/dashboard/DashboardHorizontalNav";
export {
  CLINIC_MODULE_RAIL_ITEMS,
  DashboardModuleRail,
} from "@/components/dashboard/DashboardModuleRail";
export { AdminMobileBottomNav } from "@/components/dashboard/AdminMobileBottomNav";
export { ClinicMobileBottomNav } from "@/components/dashboard/ClinicMobileBottomNav";
export { AdminMobileHubLauncher } from "@/components/dashboard/AdminMobileHubLauncher";
export { AdminMobileHubPager } from "@/components/dashboard/AdminMobileHubPager";
export { AdminMobileKebabMenu } from "@/components/dashboard/AdminMobileKebabMenu";
export { AdminMobileModuleMenu } from "@/components/dashboard/AdminMobileModuleMenu";
export {
  DASHBOARD_INLINE_PAGER_RESERVATION,
  DASHBOARD_PAGER_RESERVATION,
  DASHBOARD_TOUCH_PAGER_RESERVATION,
  DashboardPager,
  type DashboardPagerProps,
} from "@/components/dashboard/DashboardPager";
export {
  CompactPager,
  type CompactPagerProps,
} from "@/components/dashboard/CompactPager";
