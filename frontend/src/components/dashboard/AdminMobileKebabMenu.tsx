"use client";

import { useEffect, useState } from "react";
import { ExternalLink, KeyRound, LogOut, MoreVertical } from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ThemeModeToggle } from "@/components/theme/ThemeModeToggle";
import { clearDashboardLastModules } from "@/lib/dashboard-last-module";
import { ROUTES } from "@/lib/routes";
import { DashboardNotificationsBell } from "./DashboardNotificationsBell";

export function AdminMobileKebabMenu() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="admin-mobile-kebab-root md:hidden">
      <button
        type="button"
        aria-label="Menú de administración"
        aria-expanded={isOpen}
        aria-controls={isOpen ? "admin-mobile-kebab-menu" : undefined}
        onClick={() => setIsOpen((current) => !current)}
        className="admin-mobile-kebab-trigger"
      >
        <MoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen ? (
        <section
          id="admin-mobile-kebab-menu"
          aria-label="Acciones de administración"
          data-admin-mobile-kebab-menu="true"
          className="admin-mobile-kebab-menu"
        >
          <div className="admin-mobile-kebab-row">
            <span>Apariencia</span>
            <ThemeModeToggle className="h-9 w-9 bg-card" />
          </div>
          <div className="admin-mobile-kebab-row">
            <span>Notificaciones</span>
            <DashboardNotificationsBell surface="admin" mobileNoScroll />
          </div>
          <PublicRouteControl
            href={`${ROUTES.dashboardAdmin}?module=admin-sessions`}
            prefetch={false}
            variant="bare"
            onClick={() => setIsOpen(false)}
            className="admin-mobile-kebab-action"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>Cambiar contraseña</span>
          </PublicRouteControl>
          <PublicRouteControl
            href={ROUTES.home}
            prefetch={false}
            variant="bare"
            onClick={() => setIsOpen(false)}
            className="admin-mobile-kebab-action"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span>Ver sitio público</span>
          </PublicRouteControl>
          <PublicRouteControl
            href={ROUTES.login}
            prefetch={false}
            variant="bare"
            aria-label="Cerrar sesión"
            onClick={clearDashboardLastModules}
            className="admin-mobile-kebab-action admin-mobile-kebab-logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Cerrar sesión</span>
          </PublicRouteControl>
        </section>
      ) : null}
    </div>
  );
}
