"use client";

import {
  Suspense,
  useCallback,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ThemeModeToggle } from "@/components/theme/ThemeModeToggle";
import { logout as logoutClinic, logoutAdmin } from "@/lib/api";
import { clearDashboardLastModules } from "@/lib/dashboard-last-module";
import { ROUTES } from "@/lib/routes";
import { DashboardNotificationsBell } from "./DashboardNotificationsBell";
import { DashboardHorizontalNav } from "./DashboardHorizontalNav";
import { AdminMobileKebabMenu } from "./AdminMobileKebabMenu";

interface DashboardTopbarProps {
  title: string;
  subtitle?: string;
  notifications?: "admin" | "clinic" | "particular" | false;
}

const ADMIN_MOBILE_TITLES: Record<string, string> = {
  admin: "Administración",
  "admin-report-upload": "Informes",
  "admin-health": "Estado",
  "admin-clinics": "Clínicas",
  "admin-particular-tokens": "Tokens",
  "admin-pricing": "Precios",
  "admin-sessions": "Sesiones",
  "admin-users-roles": "Usuarios",
  "audit-log": "Auditoría",
  "admin-maintenance": "Mantenimiento",
};

function AdminMobileContextTitle() {
  const searchParams = useSearchParams();
  const moduleId = searchParams.get("module");
  return <>{(moduleId && ADMIN_MOBILE_TITLES[moduleId]) || "Inicio"}</>;
}

function DashboardTopbarNotifications({
  notifications,
}: {
  notifications: DashboardTopbarProps["notifications"];
}) {
  if (notifications === "admin") {
    return (
      <DashboardNotificationsBell
        surface="admin"
        mobileNoScroll
        suppressMobileAutoShow
      />
    );
  }

  return <>{notifications ? <DashboardNotificationsBell surface={notifications} /> : null}</>;
}

export function DashboardTopbar({
  title,
  subtitle,
  notifications = false,
}: DashboardTopbarProps) {
  const isAdmin = notifications === "admin";
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Secure logout: PublicRouteControl keeps the route-registry presentation
  // (href={ROUTES.login}), but its client-side navigation is cancelled with
  // preventDefault so logout invalidates the server session instead of merely
  // routing to /login (which would leave the session alive and let Back/reload
  // re-render private data). Persisted module keys are cleared before leaving.
  const handleLogout = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (isLoggingOut) {
        return;
      }
      setIsLoggingOut(true);
      clearDashboardLastModules();
      void (async () => {
        try {
          if (isAdmin) {
            await logoutAdmin();
          } else {
            await logoutClinic();
          }
        } catch {
          // Transport failure must not strand the user on a private surface; the
          // hard redirect below unloads it and the proxy re-checks the cookie.
        }
        // Hard navigation drops the authenticated SPA and in-memory private state.
        window.location.replace(ROUTES.login);
      })();
    },
    [isAdmin, isLoggingOut],
  );

  return (
    <header
      className="sticky top-0 z-40 flex shrink-0 flex-col border-b border-vetneb-line/80 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/78"
      data-dashboard-topbar-polish="true"
      data-admin-mobile-app-bar={isAdmin ? "true" : undefined}
      aria-label="Barra superior del dashboard"
      aria-labelledby="dashboard-topbar-title"
    >
      <div className="flex min-h-[2.75rem] min-w-0 items-center justify-between gap-2 px-3 py-1.5 sm:min-h-[2.5rem] sm:gap-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1
            id="dashboard-topbar-title"
            className="truncate text-lg font-semibold leading-tight text-vetneb-ink sm:text-xl"
          >
            {title}
          </h1>
          {isAdmin ? (
            <h1 className="admin-mobile-context-title md:hidden">
              <Suspense fallback="Inicio">
                <AdminMobileContextTitle />
              </Suspense>
            </h1>
          ) : null}
          {subtitle && (
            <p
              className="truncate text-xs text-muted-foreground sm:text-[0.8125rem]"
              data-admin-mobile-topbar-subtitle={isAdmin ? "true" : undefined}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div
          className="ml-2 flex shrink-0 items-center gap-1.5 sm:ml-3 sm:gap-3"
          data-dashboard-desktop-actions="true"
        >
          <ThemeModeToggle />
          <DashboardTopbarNotifications notifications={notifications} />
          <PublicRouteControl
            href={ROUTES.login}
            variant="bare"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-input bg-card/95 px-2 text-sm font-semibold text-foreground shadow-[0_1px_2px_rgba(15,45,62,0.05)] transition-[background-color,border-color,box-shadow,color] duration-150 hover:border-vetneb-teal/45 hover:bg-accent/70 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 sm:h-9 sm:min-w-0 sm:px-3"
          >
            <span className="hidden sm:inline">Cerrar sesión</span>
            {!isAdmin ? (
              <span className="sm:hidden" aria-hidden="true">
                Salir
              </span>
            ) : null}
          </PublicRouteControl>
        </div>
        {isAdmin ? <AdminMobileKebabMenu /> : null}
      </div>

      <DashboardHorizontalNav />
    </header>
  );
}
