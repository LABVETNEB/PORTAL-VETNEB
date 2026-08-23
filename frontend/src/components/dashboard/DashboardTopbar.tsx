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
import {
  ADMIN_MODULE_NAV_LABELS,
  parseAdminModule,
} from "@/features/dashboard/config";
import { MODULE_QUERY_PARAM } from "@/features/dashboard/application";
import { DashboardNotificationsBell } from "./DashboardNotificationsBell";
import { AdminMobileKebabMenu } from "./AdminMobileKebabMenu";
import { WorkspaceAppBar } from "./WorkspaceAppBar";

interface DashboardTopbarProps {
  title: string;
  subtitle?: string;
  notifications?: "admin" | "clinic" | "particular" | false;
}

/**
 * B09 - the admin mobile context title is DERIVED, not declared.
 *
 * This used to be `ADMIN_MOBILE_TITLES`, a private ten-entry label table: the
 * third copy of the admin catalog (audit H1), and the one that had already
 * drifted - it said "Administración" for the `admin` module while the canonical
 * catalog, the drawer and the rail all say "Resumen". Reading the labels from
 * `ADMIN_MODULE_NAV_LABELS` retires the copy and the drift together.
 *
 * The raw `?module=` read is replaced by `parseAdminModule` for the same reason
 * the mobile bar was: an alias (`?module=maintenance`) used to fall through to
 * "Inicio" while the controller painted Mantenimiento, and an unknown value
 * still has to resolve to the hub.
 */
const ADMIN_MOBILE_TITLE_BY_MODULE = new Map(
  ADMIN_MODULE_NAV_LABELS.map((entry) => [entry.moduleId, entry.label]),
);

function AdminMobileContextTitle() {
  const searchParams = useSearchParams();
  const moduleId = parseAdminModule(searchParams.get(MODULE_QUERY_PARAM));
  return <>{(moduleId && ADMIN_MOBILE_TITLE_BY_MODULE.get(moduleId)) || "Inicio"}</>;
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
      <WorkspaceAppBar
        identity={
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
        }
        actions={<ThemeModeToggle />}
        notifications={
          <DashboardTopbarNotifications notifications={notifications} />
        }
        account={
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
        }
        overflow={isAdmin ? <AdminMobileKebabMenu /> : null}
      />
    </header>
  );
}
