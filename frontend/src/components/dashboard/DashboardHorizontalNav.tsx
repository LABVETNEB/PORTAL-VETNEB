"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

export type DashboardNavSurface = "admin" | "clinic";

type DashboardHorizontalNavItem = {
  label: string;
  href: string;
  /** Resumen item: also active on the base path when no module is selected. */
  baseFallback?: boolean;
  /** Route item: active on its path and nested subroutes. */
  routePrefix?: boolean;
};

const ADMIN_NAV_ITEMS: DashboardHorizontalNavItem[] = [
  { label: "Resumen", href: `${ROUTES.dashboardAdmin}?module=admin`, baseFallback: true },
  { label: "Clínicas", href: `${ROUTES.dashboardAdmin}?module=admin-clinics` },
  { label: "Informes", href: `${ROUTES.dashboardAdmin}?module=admin-report-upload` },
  { label: "Tokens", href: `${ROUTES.dashboardAdmin}?module=admin-particular-tokens` },
  { label: "Auditoría", href: `${ROUTES.dashboardAdmin}?module=audit-log` },
  { label: "Usuarios", href: `${ROUTES.dashboardAdmin}?module=admin-users-roles` },
  { label: "Sesiones", href: `${ROUTES.dashboardAdmin}?module=admin-sessions` },
];

const CLINIC_NAV_ITEMS: DashboardHorizontalNavItem[] = [
  { label: "Resumen", href: `${ROUTES.dashboard}?module=operaciones`, baseFallback: true },
  { label: "Informes", href: ROUTES.dashboardInformes, routePrefix: true },
  { label: "Tokens", href: `${ROUTES.dashboard}?module=tokens` },
  { label: "Logística", href: ROUTES.dashboardLogistica, routePrefix: true },
  { label: "Perfil", href: `${ROUTES.dashboard}?module=perfil` },
];

function getPathFromHref(href: string) {
  return href.split(/[?#]/)[0] || href;
}

function getModuleFromHref(href: string): string | null {
  const queryStart = href.indexOf("?");
  if (queryStart === -1) return null;
  const query = href.slice(queryStart + 1).split("#")[0];
  return new URLSearchParams(query).get("module");
}

function resolveSurface(pathname: string): DashboardNavSurface {
  return pathname.startsWith(ROUTES.dashboardAdmin) ? "admin" : "clinic";
}

function isItemActive(
  item: DashboardHorizontalNavItem,
  pathname: string,
  activeModule: string | null,
) {
  const itemPath = getPathFromHref(item.href);
  const itemModule = getModuleFromHref(item.href);

  if (itemModule) {
    if (pathname !== itemPath) return false;
    if (activeModule === itemModule) return true;
    return Boolean(item.baseFallback) && !activeModule;
  }

  if (item.routePrefix) {
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
  }

  return pathname === itemPath;
}

function DashboardHorizontalNavInner() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const activeModule = searchParams.get("module");
  const surface = resolveSurface(pathname);
  const items = surface === "admin" ? ADMIN_NAV_ITEMS : CLINIC_NAV_ITEMS;
  const surfaceLabel = surface === "admin" ? "Administración" : "Clínica";

  return (
    <div
      className="flex min-h-[2.25rem] items-center gap-2 px-3 sm:px-6"
      data-dashboard-horizontal-nav={surface}
    >
      <span className="hidden shrink-0 items-center gap-1.5 md:flex">
        <span className="text-[0.8125rem] font-semibold text-vetneb-ink">
          Portal VETNEB
        </span>
        <span className="text-[0.66rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {surfaceLabel}
        </span>
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain">
        {items.map((item) => {
          const active = isItemActive(item, pathname, activeModule);

          return (
            <PublicRouteControl
              key={item.href}
              href={item.href}
              prefetch={false}
              variant="bare"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-[1.85rem] shrink-0 items-center whitespace-nowrap rounded-md border-b-2 border-transparent px-2.5 py-1 text-[0.8125rem] font-semibold dashboard-nav-interactive focus-visible:ring-offset-2",
                active
                  ? "border-vetneb-teal bg-vetneb-navy/8 text-vetneb-navy"
                  : "text-foreground/70 hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {item.label}
            </PublicRouteControl>
          );
        })}
      </div>

      <PublicRouteControl
        href={ROUTES.home}
        prefetch={false}
        variant="bare"
        aria-label="Volver al sitio público"
        title="Volver al sitio público"
        className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-[0.75rem] font-semibold text-muted-foreground dashboard-nav-interactive hover:bg-accent/60 hover:text-foreground focus-visible:ring-offset-2"
      >
        <span className="hidden sm:inline">Volver al sitio público</span>
        <span className="sm:hidden" aria-hidden="true">
          Salir
        </span>
      </PublicRouteControl>
    </div>
  );
}

export function DashboardHorizontalNav() {
  return (
    <nav
      role="navigation"
      aria-label="Navegación principal"
      data-dashboard-horizontal-nav-shell="true"
      className="shrink-0 border-t border-vetneb-line/70 bg-card/85"
    >
      <Suspense fallback={<div className="min-h-[2.25rem]" aria-hidden="true" />}>
        <DashboardHorizontalNavInner />
      </Suspense>
    </nav>
  );
}
