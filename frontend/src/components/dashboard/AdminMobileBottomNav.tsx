"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Home, KeyRound, Menu, ScrollText } from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import {
  requestAdminHubReset,
  requestAdminModuleActivate,
} from "@/lib/admin-hub-reset";
import {
  ADMIN_LAST_MODULE_STORAGE_KEY,
  writeDashboardLastModule,
} from "@/lib/dashboard-last-module";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { AdminMobileModuleMenu } from "./AdminMobileModuleMenu";

const FIXED_DESTINATIONS = [
  { label: "Clínicas", moduleId: "admin-clinics", icon: Building2 },
  { label: "Auditoría", moduleId: "audit-log", icon: ScrollText },
  { label: "Sesiones", moduleId: "admin-sessions", icon: KeyRound },
] as const;

export function AdminMobileBottomNav() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [isModuleMenuOpen, setIsModuleMenuOpen] = useState(false);
  const closeModuleMenu = useCallback(() => setIsModuleMenuOpen(false), []);
  const activateMobileModule = useCallback(
    (moduleId: string) => {
      setActiveModule(moduleId);
      requestAdminModuleActivate(moduleId);
      closeModuleMenu();
    },
    [closeModuleMenu],
  );
  const isSecondaryModuleActive =
    activeModule !== null &&
    !FIXED_DESTINATIONS.some(
      (destination) => destination.moduleId === activeModule,
    );

  useEffect(() => {
    function syncModuleFromLocation() {
      setActiveModule(new URLSearchParams(window.location.search).get("module"));
    }

    syncModuleFromLocation();
    window.addEventListener("popstate", syncModuleFromLocation);
    return () => window.removeEventListener("popstate", syncModuleFromLocation);
  }, []);

  function clearPersistedAdminModule() {
    writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, "");
    setActiveModule(null);
    closeModuleMenu();
    // Force the workspace controller back to the hub even if the URL push is a
    // same-URL no-op (in-flight module navigation not yet committed).
    requestAdminHubReset();
  }

  return (
    <>
      <AdminMobileModuleMenu
        isOpen={isModuleMenuOpen}
        onClose={closeModuleMenu}
        onNavigate={activateMobileModule}
      />
      <nav
        aria-label="Navegación móvil de administración"
        data-admin-mobile-bottom-nav="true"
        className="admin-mobile-bottom-nav md:hidden"
      >
        <PublicRouteControl
          href={ROUTES.dashboardAdmin}
          prefetch={false}
          variant="bare"
          aria-label="Inicio"
          aria-current={!activeModule ? "page" : undefined}
          data-admin-mobile-bottom-nav-item="true"
          onClick={clearPersistedAdminModule}
          className={cn(
            "admin-mobile-bottom-nav-item",
            !activeModule && "admin-mobile-bottom-nav-item-active",
          )}
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          <span>Inicio</span>
        </PublicRouteControl>

        {FIXED_DESTINATIONS.map((destination) => {
          const Icon = destination.icon;
          const isActive = activeModule === destination.moduleId;
          return (
            <PublicRouteControl
              key={destination.moduleId}
              href={`${ROUTES.dashboardAdmin}?module=${destination.moduleId}`}
              prefetch={false}
              variant="bare"
              aria-label={destination.label}
              aria-current={isActive ? "page" : undefined}
              data-admin-mobile-bottom-nav-item="true"
              onClick={() => activateMobileModule(destination.moduleId)}
              className={cn(
                "admin-mobile-bottom-nav-item",
                isActive && "admin-mobile-bottom-nav-item-active",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{destination.label}</span>
            </PublicRouteControl>
          );
        })}

        <button
          type="button"
          aria-label="Más"
          aria-expanded={isModuleMenuOpen}
          aria-current={isSecondaryModuleActive ? "page" : undefined}
          aria-controls={isModuleMenuOpen ? "admin-mobile-module-menu" : undefined}
          data-admin-mobile-bottom-nav-item="true"
          onClick={() => setIsModuleMenuOpen((current) => !current)}
          className={cn(
            "admin-mobile-bottom-nav-item",
            (isModuleMenuOpen || isSecondaryModuleActive) &&
              "admin-mobile-bottom-nav-item-active",
          )}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          <span>Más</span>
        </button>
      </nav>
    </>
  );
}
