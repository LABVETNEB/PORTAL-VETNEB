"use client";

import { useEffect, useState } from "react";
import { ExternalLink, KeyRound, LogOut, MoreVertical } from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ThemeModeToggle } from "@/components/theme/ThemeModeToggle";
import { ROUTES } from "@/lib/routes";
import { DashboardLogoutControl } from "./DashboardLogoutControl";
import { DashboardNotificationsBell } from "./DashboardNotificationsBell";

/**
 * Admin mobile ACTION overflow.
 *
 * B09 unified the mobile NAVIGATION model into `DashboardMobileNav`, and this
 * menu deliberately stayed out of it. It carries actions, not destinations, and
 * its import closure reaches `@/lib/api` through `DashboardLogoutControl` and
 * `DashboardNotificationsBell` - folding it into the navigation owner would
 * drag the data layer across the `presentation/navigation` boundary.
 *
 * It is also the ONLY carrier of theme, notifications, password, public site
 * and logout on admin mobile: `mobile-admin.css` hides
 * `[data-dashboard-desktop-actions]` below 768px, so retiring this menu would
 * leave admin phones with no way to sign out.
 *
 * B09_TOUCH_POLICY = OPTION_A applies here: the trigger and the rows are raised
 * to >=44x44 in `mobile-admin.css`. The two composed controls are sized
 * LOCALLY - the theme toggle through its `className` prop, the bell through a
 * rule scoped to `.admin-mobile-kebab-row` - because both are shared with
 * surfaces outside B09's scope and must not be resized globally.
 */
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
            <ThemeModeToggle className="h-11 w-11 bg-card" />
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
          <DashboardLogoutControl
            surface="admin"
            aria-label="Cerrar sesión"
            className="admin-mobile-kebab-action admin-mobile-kebab-logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Cerrar sesión</span>
          </DashboardLogoutControl>
        </section>
      ) : null}
    </div>
  );
}
