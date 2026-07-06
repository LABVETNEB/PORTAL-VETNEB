"use client";

import { useEffect, useRef } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  KeyRound,
  LayoutDashboard,
  Route,
} from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { CLINIC_MODULE_NAV_LABELS } from "@/features/dashboard/config";
import { buildDashboardModuleHref } from "@/features/dashboard/application";
import type { ClinicModule } from "./ClinicDashboardWorkspaceController";

/**
 * Single, device-agnostic module navigation/pager for the clinic workspace.
 *
 * This is the ONE canonical control used to move between every clinic module
 * (operaciones · informes · logística · perfil · tokens). It renders the same
 * markup and styling on Android/iOS/desktop — there is no separate desktop
 * top-tab bar or mobile bottom bar for the primary `/dashboard` surface, so
 * navigation can never drift into "different pagers per device".
 *
 * Two integrated affordances, one grammar:
 *  - a horizontal rail of module tabs (active module is `aria-current`), and
 *  - prev/next pager controls that step through the same ordered modules.
 *
 * Navigation reuses the proven optimistic path: each control is a real
 * `?module=` link (deep-linkable, Back/Forward safe) and also fires
 * `requestClinicModuleActivate` so the controller swaps the active module
 * before the URL commit lands.
 */

type ClinicModuleRailItem = {
  moduleId: ClinicModule;
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
};

// Icons are React components, so they stay local; the id/label/shortLabel/order
// come from the shared catalog (config/dashboardModules) so this rail and the
// mobile bottom-nav never drift apart on module labels or ordering.
const CLINIC_MODULE_RAIL_ICONS: Record<
  ClinicModule,
  ClinicModuleRailItem["icon"]
> = {
  operaciones: LayoutDashboard,
  informes: FileText,
  logistica: Route,
  perfil: Building2,
  tokens: KeyRound,
};

export const CLINIC_MODULE_RAIL_ITEMS: ClinicModuleRailItem[] =
  CLINIC_MODULE_NAV_LABELS.map((item) => ({
    moduleId: item.moduleId,
    label: item.label,
    shortLabel: item.shortLabel,
    icon: CLINIC_MODULE_RAIL_ICONS[item.moduleId],
  }));

function moduleHref(moduleId: ClinicModule): string {
  return buildDashboardModuleHref(ROUTES.dashboard, moduleId);
}

const pagerStepClassName =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input bg-card/95 text-foreground shadow-sm dashboard-nav-interactive hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 sm:h-8 sm:w-8";

type DashboardModuleRailProps = {
  activeModule: ClinicModule;
};

export function DashboardModuleRail({ activeModule }: DashboardModuleRailProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Keep the active module tab in view when the rail overflows on narrow
  // viewports, so the current module is always visible and identifiable.
  useEffect(() => {
    const activeTab = trackRef.current?.querySelector<HTMLElement>(
      "[aria-current='page']",
    );
    activeTab?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeModule]);

  const activeIndex = CLINIC_MODULE_RAIL_ITEMS.findIndex(
    (item) => item.moduleId === activeModule,
  );
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;
  const prevItem =
    safeIndex > 0 ? CLINIC_MODULE_RAIL_ITEMS[safeIndex - 1] : null;
  const nextItem =
    safeIndex < CLINIC_MODULE_RAIL_ITEMS.length - 1
      ? CLINIC_MODULE_RAIL_ITEMS[safeIndex + 1]
      : null;

  return (
    <nav
      aria-label="Navegación de módulos de clínica"
      data-dashboard-module-rail="true"
      data-dashboard-pager="module"
      className="dashboard-module-rail"
    >
      {prevItem ? (
        <PublicRouteControl
          href={moduleHref(prevItem.moduleId)}
          prefetch={false}
          variant="bare"
          aria-label={`Módulo anterior: ${prevItem.label}`}
          data-dashboard-module-rail-prev="true"
          onClick={() => requestClinicModuleActivate(prevItem.moduleId)}
          className={pagerStepClassName}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </PublicRouteControl>
      ) : (
        <button
          type="button"
          disabled
          aria-label="Módulo anterior"
          data-dashboard-module-rail-prev="true"
          className={pagerStepClassName}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <div
        ref={trackRef}
        className="dashboard-module-rail-track"
        data-dashboard-module-rail-track="true"
      >
        {CLINIC_MODULE_RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.moduleId === activeModule;
          return (
            <PublicRouteControl
              key={item.moduleId}
              href={moduleHref(item.moduleId)}
              prefetch={false}
              variant="bare"
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              data-dashboard-module-rail-item={item.moduleId}
              onClick={() => requestClinicModuleActivate(item.moduleId)}
              className={cn(
                "dashboard-module-rail-tab",
                isActive
                  ? "dashboard-module-rail-tab-active"
                  : "text-foreground/70 hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.shortLabel}</span>
            </PublicRouteControl>
          );
        })}
      </div>

      <span
        data-dashboard-module-rail-state="true"
        className="hidden shrink-0 whitespace-nowrap px-1 text-[0.7rem] font-semibold text-muted-foreground lg:inline"
      >
        Módulo {safeIndex + 1} de {CLINIC_MODULE_RAIL_ITEMS.length}
      </span>

      {nextItem ? (
        <PublicRouteControl
          href={moduleHref(nextItem.moduleId)}
          prefetch={false}
          variant="bare"
          aria-label={`Módulo siguiente: ${nextItem.label}`}
          data-dashboard-module-rail-next="true"
          onClick={() => requestClinicModuleActivate(nextItem.moduleId)}
          className={pagerStepClassName}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </PublicRouteControl>
      ) : (
        <button
          type="button"
          disabled
          aria-label="Módulo siguiente"
          data-dashboard-module-rail-next="true"
          className={pagerStepClassName}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </nav>
  );
}
