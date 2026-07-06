"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileText,
  Home,
  KeyRound,
  LayoutDashboard,
  Route,
} from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import {
  requestClinicHubReset,
  requestClinicModuleActivate,
  subscribeClinicHubReset,
  subscribeClinicModuleActivate,
} from "@/lib/clinic-hub-reset";
import {
  CLINIC_LAST_MODULE_STORAGE_KEY,
  writeDashboardLastModule,
} from "@/lib/dashboard-last-module";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { CLINIC_MODULE_NAV_LABELS } from "@/features/dashboard/config";
import {
  buildDashboardModuleHref,
  readClinicModuleFromLocation,
} from "@/features/dashboard/application";
import type { ClinicModule } from "./ClinicDashboardWorkspaceController";

// Icons are React components, so they stay local; the id/label/shortLabel/order
// come from the shared catalog (config/dashboardModules) so this bottom-nav and
// the module rail never drift apart on module labels or ordering.
const CLINIC_BOTTOM_NAV_ICONS: Record<ClinicModule, typeof Home> = {
  operaciones: LayoutDashboard,
  informes: FileText,
  logistica: Route,
  perfil: Building2,
  tokens: KeyRound,
};

const CLINIC_DESTINATIONS: Array<{
  label: string;
  shortLabel: string;
  moduleId: ClinicModule;
  icon: typeof Home;
}> = CLINIC_MODULE_NAV_LABELS.map((item) => ({
  label: item.label,
  shortLabel: item.shortLabel,
  moduleId: item.moduleId,
  icon: CLINIC_BOTTOM_NAV_ICONS[item.moduleId],
}));

export function ClinicMobileBottomNav() {
  const pathname = usePathname() ?? "";
  const [activeModule, setActiveModule] = useState<ClinicModule | null>(null);

  useEffect(() => {
    function syncModuleFromLocation() {
      setActiveModule(readClinicModuleFromLocation());
    }

    syncModuleFromLocation();
    window.addEventListener("popstate", syncModuleFromLocation);
    return () => window.removeEventListener("popstate", syncModuleFromLocation);
  }, []);

  useEffect(
    () =>
      subscribeClinicModuleActivate((moduleId) => {
        const destination = CLINIC_DESTINATIONS.find(
          (item) => item.moduleId === moduleId,
        );
        if (!destination) return;
        setActiveModule(destination.moduleId);
      }),
    [],
  );

  useEffect(
    () =>
      subscribeClinicHubReset(() => {
        setActiveModule(null);
      }),
    [],
  );

  const resetToHub = useCallback(() => {
    writeDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY, "");
    setActiveModule(null);
    requestClinicHubReset();
  }, []);

  // The clinic MAIN dashboard renders the shared `DashboardModuleRail` as its
  // single module navigation, so the mobile bottom bar is suppressed there.
  // Secondary clinic routes (informes/logística full pages) keep it.
  if (pathname === ROUTES.dashboard) {
    return null;
  }

  return (
    <nav
      aria-label="Navegación móvil de clínica"
      data-clinic-mobile-bottom-nav="true"
      className="clinic-mobile-bottom-nav md:hidden"
    >
      <PublicRouteControl
        href={ROUTES.dashboard}
        prefetch={false}
        variant="bare"
        aria-label="Inicio"
        aria-current={!activeModule ? "page" : undefined}
        data-clinic-mobile-bottom-nav-item="true"
        onClick={resetToHub}
        className={cn(
          "clinic-mobile-bottom-nav-item",
          !activeModule && "clinic-mobile-bottom-nav-item-active",
        )}
      >
        <Home className="h-4 w-4" aria-hidden="true" />
        <span>Inicio</span>
      </PublicRouteControl>

      {CLINIC_DESTINATIONS.map((destination) => {
        const Icon = destination.icon;
        const isActive = activeModule === destination.moduleId;
        return (
          <PublicRouteControl
            key={destination.moduleId}
            href={buildDashboardModuleHref(ROUTES.dashboard, destination.moduleId)}
            prefetch={false}
            variant="bare"
            aria-label={destination.label}
            aria-current={isActive ? "page" : undefined}
            data-clinic-mobile-bottom-nav-item="true"
            onClick={() => {
              setActiveModule(destination.moduleId);
              requestClinicModuleActivate(destination.moduleId);
            }}
            className={cn(
              "clinic-mobile-bottom-nav-item",
              isActive && "clinic-mobile-bottom-nav-item-active",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{destination.shortLabel}</span>
          </PublicRouteControl>
        );
      })}
    </nav>
  );
}
