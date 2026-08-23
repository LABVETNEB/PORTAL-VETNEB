/**
 * Dashboard · presentation/navigation (B01 re-export boundary).
 *
 * Home for the module navigation surfaces: the B07 lateral primitives, the B08
 * frame that mounts them, the B09 mobile model, the AdminMobile hub launcher /
 * pager and the pagers (audit §6). These consume the `config` catalog and the
 * `application` navigation helpers rather than re-declaring module literals.
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
 * barrel, nor any module it re-exports, nor anything those modules import at
 * any depth may reach `@/lib/api` or the `app/` layer — enforced by
 * `test/architecture/dashboard-presentation-import-boundaries.test.ts`, which
 * walks the whole first-party import closure, not just the immediate target.
 *
 * `AdminMobileKebabMenu` is deliberately absent: it is a live component, but it
 * composes `DashboardLogoutControl` and `DashboardNotificationsBell`, and both
 * import `@/lib/api` directly, so re-exporting it would carry the data layer
 * across the boundary transitively. It is excluded from the barrel, not
 * removed, not modified and not migrated; it is admitted automatically once
 * those two imports are gone.
 *
 * `NavigationDrawer`, `NavigationRail` and `DashboardNavigationFrame` are the
 * B07/B08 lateral model. They are the navigation surfaces here that are NOT
 * legacy re-exports: created presentation-pure from the start, and mounted by
 * B08 through the frame — the single mount site of the two primitives. The
 * ownership rule above still holds: their implementations live at
 * `@/components/dashboard/*` like every other target, because this barrel is a
 * boundary, not a home.
 *
 * `DashboardHorizontalNav` is gone. B08 retired it physically: it was a pure
 * >=768px surface (`md:block`, plus `display:none` under `max-width: 767px` in
 * both mobile stylesheets), so the lateral model replaces it outright and no
 * phone surface lost navigation with it.
 *
 * `DashboardMobileNav` is the B09 mobile model and the single navigation owner
 * below 768px on BOTH roles. It replaced four components at once:
 * `AdminMobileBottomNav`, `AdminMobileModuleMenu`, `ClinicMobileBottomNav` and
 * `DashboardModuleRail`, all four physically retired by B09. The rail was the
 * one B08 had to keep alive - `ClinicMobileBottomNav` returned null on
 * `/dashboard`, so the rail was that surface's only navigation; B09 removed the
 * early return, so the bar now covers `/dashboard` too and
 * `LEGACY_MODULE_RAIL_PHYSICAL_RETIREMENT` is closed.
 *
 * `AdminMobileKebabMenu` stays out of this barrel and out of that owner. It is
 * the ACTION overflow (theme, notifications, password, public site, logout),
 * not a navigation destination, and its import closure reaches `@/lib/api`
 * through `DashboardLogoutControl` and `DashboardNotificationsBell`.
 *
 * `AdminDashboardSidebar` and `ClinicDashboardSidebar` are absent because B02
 * retired them (audit §14.3): they had no runtime consumers, so the whole
 * sidebar chain was deleted rather than re-exported. The barrel must never
 * expose them again — enforced by
 * `test/architecture/dashboard-dead-component-retirement.test.ts`.
 *
 * @see docs/implementation/dashboard-presentation-shell-navigation-barrels.md
 * @see docs/implementation/dashboard-presentation-boundaries.md
 */
export {
  NavigationDrawer,
  type NavigationDrawerProps,
} from "@/components/dashboard/NavigationDrawer";
export {
  NavigationRail,
  type NavigationRailProps,
} from "@/components/dashboard/NavigationRail";
export {
  DashboardNavigationFrame,
  type DashboardNavigationFrameProps,
} from "@/components/dashboard/DashboardNavigationFrame";
export {
  DashboardMobileNav,
  type DashboardMobileNavProps,
  type DashboardMobileNavSurface,
} from "@/components/dashboard/DashboardMobileNav";
export { AdminMobileHubLauncher } from "@/components/dashboard/AdminMobileHubLauncher";
export { AdminMobileHubPager } from "@/components/dashboard/AdminMobileHubPager";
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
