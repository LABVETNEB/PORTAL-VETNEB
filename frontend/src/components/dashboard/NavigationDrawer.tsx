"use client";

import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  ADMIN_HOME_NAV_ITEM,
  ADMIN_MODULE_NAV_LABELS,
  CLINIC_MODULE_NAV_LABELS,
  type AdminModule,
  type ClinicModule,
} from "@/features/dashboard/config";
import {
  buildAdminHubHref,
  buildDashboardModuleHref,
} from "@/features/dashboard/application";
import {
  ADMIN_MODULE_ICONS,
  CLINIC_MODULE_ICONS,
  DASHBOARD_HOME_ICON,
  type DashboardModuleIcon,
} from "./dashboardModuleIcons";

/**
 * B07 - NavigationDrawer, the expanded lateral navigation (>=1280px).
 *
 * One vertical list of the modules the role actually has, with the glyph and
 * the full label visible. Its geometry contract is `--dash-nav-drawer-w`
 * (256px) with a +/-1px band and `--dash-nav-item-h` (40px) per item, authored
 * in `styles/dashboard/tokens.css` and applied in
 * `styles/dashboard/navigation.css` - never restated as a literal here.
 *
 * OWNERSHIP. The drawer renders; it owns nothing. Module ids, order and labels
 * come from `features/dashboard/config`; the `?module=` grammar comes from
 * `features/dashboard/application` (building "?module=" by hand here is what
 * let the old surfaces drift); the glyphs come from `dashboardModuleIcons`.
 *
 * PRESENTATION-PURE and STATELESS by contract. Nothing in this module's import
 * closure may reach `@/lib/api` or the `app/` layer, which is what lets it be
 * re-exported from `features/dashboard/presentation/navigation`. There is no
 * local state and no persisted expand/collapse preference either: which of the
 * two primitives is visible is a pure function of the viewport, decided in CSS,
 * so nothing here can desynchronise from the URL the controller reads.
 *
 * MOUNTED BY B08 through `DashboardNavigationFrame`, the single mount site.
 * B08 retired `DashboardHorizontalNav` outright and removed
 * `DashboardModuleRail` from the >=768px regime; B09 then retired the rail
 * itself, so below 768px the single owner is `DashboardMobileNav`.
 *
 * B13 adds the explicit `?hub=1` admin-hub destination and an "Inicio" item.
 * A null module still represents the hub while a URL commit is pending, so
 * Inicio carries `aria-current` in that state.
 *
 * @see docs/implementation/dashboard-b07-navigation-drawer-rail.md
 * @see docs/implementation/dashboard-b08-navigation-migration.md
 */

export type NavigationDrawerProps =
  | { readonly surface: "admin"; readonly activeModule: AdminModule | null }
  | { readonly surface: "clinic"; readonly activeModule: ClinicModule };

type NavigationDrawerItem = {
  readonly moduleId: AdminModule | ClinicModule;
  readonly label: string;
  readonly icon: DashboardModuleIcon;
};

const ADMIN_ITEMS: readonly NavigationDrawerItem[] = ADMIN_MODULE_NAV_LABELS.map(
  (entry) => ({
    moduleId: entry.moduleId,
    label: entry.label,
    icon: ADMIN_MODULE_ICONS[entry.moduleId],
  }),
);

const CLINIC_ITEMS: readonly NavigationDrawerItem[] = CLINIC_MODULE_NAV_LABELS.map(
  (entry) => ({
    moduleId: entry.moduleId,
    label: entry.label,
    icon: CLINIC_MODULE_ICONS[entry.moduleId],
  }),
);

// Role-specific landmark names. Deliberately NOT "Navegación principal": the
// legacy horizontal nav still carries that name until B08 retires it, and two
// landmarks sharing one accessible name is a real screen-reader ambiguity.
const ADMIN_LANDMARK = "Navegación lateral de administración";
const CLINIC_LANDMARK = "Navegación lateral de clínica";

export function NavigationDrawer({ surface, activeModule }: NavigationDrawerProps) {
  const isAdmin = surface === "admin";
  const items = isAdmin ? ADMIN_ITEMS : CLINIC_ITEMS;
  const basePath = isAdmin ? ROUTES.dashboardAdmin : ROUTES.dashboard;

  return (
    <nav
      aria-label={isAdmin ? ADMIN_LANDMARK : CLINIC_LANDMARK}
      data-dashboard-navigation-drawer={surface}
      className="dashboard-navigation-drawer"
    >
      {isAdmin ? (
        <PublicRouteControl
          href={buildAdminHubHref()}
          prefetch={false}
          variant="bare"
          aria-current={!activeModule ? "page" : undefined}
          data-dashboard-navigation-item={ADMIN_HOME_NAV_ITEM.id}
          className={cn(
            "dashboard-navigation-drawer-item",
            !activeModule && "dashboard-navigation-item-active",
          )}
        >
          <DASHBOARD_HOME_ICON className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="dashboard-navigation-drawer-label">
            {ADMIN_HOME_NAV_ITEM.label}
          </span>
        </PublicRouteControl>
      ) : null}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.moduleId === activeModule;

        return (
          <PublicRouteControl
            key={item.moduleId}
            href={buildDashboardModuleHref(basePath, item.moduleId)}
            prefetch={false}
            variant="bare"
            aria-current={isActive ? "page" : undefined}
            data-dashboard-navigation-item={item.moduleId}
            onClick={() => {
              // Clinic only: the controller swaps the active module on this
              // signal, before the async URL commit lands.
              if (isAdmin) return;
              requestClinicModuleActivate(item.moduleId);
            }}
            className={cn(
              "dashboard-navigation-drawer-item",
              isActive && "dashboard-navigation-item-active",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="dashboard-navigation-drawer-label">{item.label}</span>
          </PublicRouteControl>
        );
      })}
    </nav>
  );
}
