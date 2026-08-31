"use client";

import { useEffect, useState } from "react";
import { ExternalLink, KeyRound, LogOut, MoreVertical } from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ThemeModeToggle } from "@/components/theme/ThemeModeToggle";
import { ROUTES } from "@/lib/routes";
import { DashboardLogoutControl } from "./DashboardLogoutControl";
import { DashboardNotificationsBell } from "./DashboardNotificationsBell";

/**
 * CMP-01 — the ONE mobile ACTION overflow of the dashboard app bar.
 *
 * Generalised from `AdminMobileKebabMenu`. The white-box audit traced DIF-005 to the
 * fact that this menu was admin-only (RC-002): Admin mobile carried a single 44x44
 * kebab while Clínica carried three sub-44 controls (theme 36x36, notifications 36x36,
 * "Salir" 48.7x40) inlined in the app bar.
 *
 * It carries ACTIONS, not destinations — `DashboardMobileNav` owns destinations — and
 * its import closure reaches `@/lib/api` through `DashboardLogoutControl` and
 * `DashboardNotificationsBell`, so folding it into the navigation owner would drag the
 * data layer across the `presentation/navigation` boundary.
 *
 * It is the ONLY carrier of theme, notifications, password, public site and logout on
 * mobile: `mobile-chrome.css` hides `[data-dashboard-desktop-actions]` below 768px, so
 * retiring it would leave phones with no way to sign out.
 *
 * B09_TOUCH_POLICY = OPTION_A applies: trigger and rows are raised to >=44x44 in
 * `mobile-chrome.css`. The two composed controls are sized LOCALLY — the theme toggle
 * through its `className` prop, the bell through a rule scoped to
 * `.dashboard-mobile-kebab-row` — because both are shared with surfaces outside this
 * scope and must not be resized globally.
 */

export type DashboardKebabSurface = "admin" | "clinic";

const SURFACE_COPY = {
  admin: {
    triggerLabel: "Menú de administración",
    menuLabel: "Acciones de administración",
    /** Admin manages its own credentials from the sessions module. */
    passwordHref: `${ROUTES.dashboardAdmin}?module=admin-sessions`,
  },
  clinic: {
    triggerLabel: "Menú de la clínica",
    menuLabel: "Acciones de la clínica",
    /** Clínica manages its credentials from the "Cambiar contraseña" tab of Perfil. */
    passwordHref: `${ROUTES.dashboard}?module=perfil`,
  },
} as const;

interface DashboardMobileKebabMenuProps {
  readonly surface: DashboardKebabSurface;
}

export function DashboardMobileKebabMenu({ surface }: DashboardMobileKebabMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const copy = SURFACE_COPY[surface];
  const isAdmin = surface === "admin";
  const menuId = "dashboard-mobile-kebab-menu";

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Legacy admin class aliases are additive: they carry no declarations of their own
  // any more (those moved to `mobile-chrome.css`) and exist so the admin E2E and
  // architecture guards that anchor `.admin-mobile-kebab-*` keep resolving.
  const rootClass = isAdmin
    ? "dashboard-mobile-kebab-root admin-mobile-kebab-root md:hidden"
    : "dashboard-mobile-kebab-root md:hidden";
  const triggerClass = isAdmin
    ? "dashboard-mobile-kebab-trigger admin-mobile-kebab-trigger"
    : "dashboard-mobile-kebab-trigger";
  const menuClass = isAdmin
    ? "dashboard-mobile-kebab-menu admin-mobile-kebab-menu"
    : "dashboard-mobile-kebab-menu";
  const rowClass = isAdmin
    ? "dashboard-mobile-kebab-row admin-mobile-kebab-row"
    : "dashboard-mobile-kebab-row";
  const actionClass = isAdmin
    ? "dashboard-mobile-kebab-action admin-mobile-kebab-action"
    : "dashboard-mobile-kebab-action";
  const logoutClass = isAdmin
    ? "dashboard-mobile-kebab-action admin-mobile-kebab-action dashboard-mobile-kebab-logout admin-mobile-kebab-logout"
    : "dashboard-mobile-kebab-action dashboard-mobile-kebab-logout";

  return (
    <div className={rootClass}>
      <button
        type="button"
        aria-label={copy.triggerLabel}
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((current) => !current)}
        className={triggerClass}
      >
        <MoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen ? (
        <section
          id={menuId}
          aria-label={copy.menuLabel}
          data-dashboard-mobile-kebab-menu="true"
          data-admin-mobile-kebab-menu={isAdmin ? "true" : undefined}
          className={menuClass}
        >
          <div className={rowClass}>
            <span>Apariencia</span>
            <ThemeModeToggle className="h-11 w-11 bg-card" />
          </div>
          <div className={rowClass}>
            <span>Notificaciones</span>
            <DashboardNotificationsBell surface={surface} mobileNoScroll />
          </div>
          <PublicRouteControl
            href={copy.passwordHref}
            prefetch={false}
            variant="bare"
            onClick={() => setIsOpen(false)}
            className={actionClass}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>Cambiar contraseña</span>
          </PublicRouteControl>
          <PublicRouteControl
            href={ROUTES.home}
            prefetch={false}
            variant="bare"
            onClick={() => setIsOpen(false)}
            className={actionClass}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span>Ver sitio público</span>
          </PublicRouteControl>
          <DashboardLogoutControl
            surface={surface}
            aria-label="Cerrar sesión"
            className={logoutClass}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Cerrar sesión</span>
          </DashboardLogoutControl>
        </section>
      ) : null}
    </div>
  );
}
