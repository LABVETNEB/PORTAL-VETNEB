"use client";

import { useCallback, useEffect, useState } from "react";
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
import type { ClinicModule } from "./ClinicDashboardWorkspaceController";

const CLINIC_DESTINATIONS: Array<{
  label: string;
  shortLabel: string;
  moduleId: ClinicModule;
  icon: typeof Home;
}> = [
  {
    label: "Operaciones",
    shortLabel: "Ops",
    moduleId: "operaciones",
    icon: LayoutDashboard,
  },
  { label: "Informes", shortLabel: "Info", moduleId: "informes", icon: FileText },
  { label: "Logística", shortLabel: "Log", moduleId: "logistica", icon: Route },
  { label: "Perfil", shortLabel: "Perfil", moduleId: "perfil", icon: Building2 },
  { label: "Tokens", shortLabel: "Tokens", moduleId: "tokens", icon: KeyRound },
];

function parseClinicModuleFromLocation(): ClinicModule | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("module");
  return CLINIC_DESTINATIONS.some((item) => item.moduleId === value)
    ? (value as ClinicModule)
    : null;
}

export function ClinicMobileBottomNav() {
  const [activeModule, setActiveModule] = useState<ClinicModule | null>(null);

  useEffect(() => {
    function syncModuleFromLocation() {
      setActiveModule(parseClinicModuleFromLocation());
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
            href={`${ROUTES.dashboard}?module=${destination.moduleId}`}
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
