"use client";

import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  ADMIN_MODULE_NAV_LABELS,
  CLINIC_MODULE_NAV_LABELS,
  type AdminModule,
  type ClinicModule,
} from "@/features/dashboard/config";
import { buildDashboardModuleHref } from "@/features/dashboard/application";
import {
  ADMIN_MODULE_ICONS,
  CLINIC_MODULE_ICONS,
  type DashboardModuleIcon,
} from "./dashboardModuleIcons";

/**
 * B07 - NavigationRail, the compact lateral navigation (768-1279px).
 *
 * The same module list as {@link NavigationDrawer} and the same grammar: glyph
 * as the primary affordance, the catalog's `shortLabel` underneath. Its
 * geometry contract is `--dash-nav-rail-w` (80px) with a +/-1px band and
 * `--dash-nav-rail-item-h` (56px) per item, authored in
 * `styles/dashboard/tokens.css` and applied in
 * `styles/dashboard/navigation.css` - never restated as a literal here.
 *
 * ONE GRAMMAR. The rail this replaces (`DashboardModuleRail`) carries two
 * navigation models at once - a tab track AND a prev/next pager with a
 * "Módulo N de 5" counter - so the same intent has two affordances that can
 * report different states. B07 ships the list and nothing else; the pager is
 * not reproduced here, and B08 did not reproduce it when it mounted this rail.
 *
 * ACCESSIBLE NAME. The visible text is the compact `shortLabel` ("Manten."),
 * which is not a usable name on its own, so every control carries the full
 * `label` as `aria-label`; `title` is a sighted-user affordance on top of it,
 * never the name itself. The glyph is decorative (`aria-hidden`).
 *
 * PRESENTATION-PURE and STATELESS - same contract as the drawer, and mounted
 * with it by `DashboardNavigationFrame` (B08). A null admin module is legal
 * there too: it is the hub state, and it carries no `aria-current`. B09 still
 * owns <768px, where neither primitive paints.
 *
 * @see docs/implementation/dashboard-b07-navigation-drawer-rail.md
 * @see docs/implementation/dashboard-b08-navigation-migration.md
 */

export type NavigationRailProps =
  | { readonly surface: "admin"; readonly activeModule: AdminModule | null }
  | { readonly surface: "clinic"; readonly activeModule: ClinicModule };

type NavigationRailItem = {
  readonly moduleId: AdminModule | ClinicModule;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: DashboardModuleIcon;
};

const ADMIN_ITEMS: readonly NavigationRailItem[] = ADMIN_MODULE_NAV_LABELS.map(
  (entry) => ({
    moduleId: entry.moduleId,
    label: entry.label,
    shortLabel: entry.shortLabel,
    icon: ADMIN_MODULE_ICONS[entry.moduleId],
  }),
);

const CLINIC_ITEMS: readonly NavigationRailItem[] = CLINIC_MODULE_NAV_LABELS.map(
  (entry) => ({
    moduleId: entry.moduleId,
    label: entry.label,
    shortLabel: entry.shortLabel,
    icon: CLINIC_MODULE_ICONS[entry.moduleId],
  }),
);

// Distinct from the drawer's landmark names on purpose: B08 may keep both
// primitives in the DOM and let CSS choose, and two navigation landmarks with
// the same accessible name are indistinguishable to a screen reader.
const ADMIN_LANDMARK = "Navegación lateral compacta de administración";
const CLINIC_LANDMARK = "Navegación lateral compacta de clínica";

export function NavigationRail({ surface, activeModule }: NavigationRailProps) {
  const isAdmin = surface === "admin";
  const items = isAdmin ? ADMIN_ITEMS : CLINIC_ITEMS;
  const basePath = isAdmin ? ROUTES.dashboardAdmin : ROUTES.dashboard;

  return (
    <nav
      aria-label={isAdmin ? ADMIN_LANDMARK : CLINIC_LANDMARK}
      data-dashboard-navigation-rail={surface}
      className="dashboard-navigation-rail"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.moduleId === activeModule;

        return (
          <PublicRouteControl
            key={item.moduleId}
            href={buildDashboardModuleHref(basePath, item.moduleId)}
            prefetch={false}
            variant="bare"
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            title={item.label}
            data-dashboard-navigation-item={item.moduleId}
            onClick={() => {
              // Clinic only: the controller swaps the active module on this
              // signal, before the async URL commit lands.
              if (isAdmin) return;
              requestClinicModuleActivate(item.moduleId);
            }}
            className={cn(
              "dashboard-navigation-rail-item",
              isActive && "dashboard-navigation-item-active",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="dashboard-navigation-rail-label">{item.shortLabel}</span>
          </PublicRouteControl>
        );
      })}
    </nav>
  );
}
