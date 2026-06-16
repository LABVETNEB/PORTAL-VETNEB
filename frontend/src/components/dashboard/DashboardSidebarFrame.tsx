"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Microscope } from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  children?: Array<{
    label: string;
    href: string;
  }>;
};

type DashboardSidebarFrameProps = {
  dashboardLabel: string;
  navItems: DashboardNavItem[];
};

function getPathFromHref(href: string) {
  return href.split(/[?#]/)[0] || href;
}

function getModuleFromHref(href: string): string | null {
  const queryStart = href.indexOf("?");
  if (queryStart === -1) return null;
  const query = href.slice(queryStart + 1).split("#")[0];
  return new URLSearchParams(query).get("module");
}

function DashboardSidebarNav({ navItems }: { navItems: DashboardNavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeModule = searchParams.get("module");

  function isActive(href: string, exact = false) {
    if (href.startsWith("#")) return false;

    const hrefPath = getPathFromHref(href);
    const hrefModule = getModuleFromHref(href);

    if (hrefModule) {
      return pathname === hrefPath && activeModule === hrefModule;
    }

    if (exact) return pathname === hrefPath && !activeModule;
    return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  }

  return (
    <nav className="flex-1 space-y-1 px-2 py-4" aria-label="Menú principal">
      {navItems.map((item) => (
        <div key={item.href}>
          <PublicRouteControl
            href={item.href}
            variant="bare"
            className={cn(
              "flex items-center justify-center gap-3 rounded-md px-2 py-2 text-sm font-semibold dashboard-nav-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              isActive(item.href, item.exact)
                ? "bg-sidebar-accent/90 text-sidebar-accent-foreground shadow-[0_10px_28px_rgba(8,35,50,0.24)] ring-1 ring-white/15"
                : "text-sidebar-foreground/72 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground",
            )}
            aria-label={item.label}
            aria-current={isActive(item.href, item.exact) ? "page" : undefined}
            title={item.label}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">{item.label}</span>
          </PublicRouteControl>

          {item.children && isActive(item.href) && (
            <div className="sr-only" aria-hidden="true">
              {item.children.map((child) => (
                <PublicRouteControl
                  key={child.href}
                  href={child.href}
                  variant="bare"
                  aria-label={child.label}
                  aria-current={pathname === child.href ? "page" : undefined}
                >
                  {child.label}
                </PublicRouteControl>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

export function DashboardSidebarFrame({
  dashboardLabel,
  navItems,
}: DashboardSidebarFrameProps) {
  return (
    <aside
      role="navigation"
      className="sticky top-0 flex h-dvh w-[4.5rem] shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground"
      data-dashboard-sidebar-polish="true"
      aria-label="Navegación principal"
    >
      <div className="flex items-center justify-center border-b border-sidebar-border px-2 py-5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_14px_34px_hsl(var(--sidebar-primary)/0.22)] ring-1 ring-white/20"
          title="Portal VETNEB"
        >
          <Microscope className="h-4 w-4" aria-hidden="true" />
        </div>
        <span className="sr-only">Portal VETNEB — {dashboardLabel}</span>
      </div>

      <Suspense fallback={<div className="flex-1" aria-hidden="true" />}>
        <DashboardSidebarNav navItems={navItems} />
      </Suspense>

      <div className="border-t border-sidebar-border px-2 py-4 sm:px-3">
        <PublicRouteControl
          href={ROUTES.home}
          variant="bare"
          aria-label="Volver al sitio público"
          title="Volver al sitio público"
          className="flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs text-sidebar-foreground/60 dashboard-nav-interactive hover:bg-sidebar-accent/40 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Volver al sitio público</span>
        </PublicRouteControl>
      </div>
    </aside>
  );
}
