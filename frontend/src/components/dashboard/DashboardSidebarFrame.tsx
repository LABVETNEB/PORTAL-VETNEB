"use client";

import { usePathname } from "next/navigation";
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
  return href.split("#")[0] || href;
}

export function DashboardSidebarFrame({
  dashboardLabel,
  navItems,
}: DashboardSidebarFrameProps) {
  const pathname = usePathname();

  function isActive(href: string, exact = false) {
    if (href.startsWith("#")) return false;

    const hrefPath = getPathFromHref(href);

    if (exact) return pathname === hrefPath;
    return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  }

  return (
    <aside
      className="sticky top-0 flex h-dvh w-[4.5rem] shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground sm:w-64"
      data-dashboard-sidebar-polish="true"
      aria-label="Navegación del dashboard"
    >
      <div className="flex items-center justify-center gap-3 border-b border-sidebar-border px-2 py-5 sm:justify-start sm:px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_14px_34px_hsl(var(--sidebar-primary)/0.22)] ring-1 ring-white/20">
          <Microscope className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="hidden sm:block">
          <p className="font-semibold text-sm text-sidebar-foreground">
            Portal VETNEB
          </p>
          <p className="text-xs text-sidebar-foreground/60">
            {dashboardLabel}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4 sm:px-3" aria-label="Menú principal">
        {navItems.map((item) => (
          <div key={item.href}>
            <PublicRouteControl
              href={item.href}
              variant="bare"
              className={cn(
                "flex items-center justify-center gap-3 rounded-md px-2 py-2 text-sm font-semibold transition-colors sm:justify-start sm:px-3",
                isActive(item.href, item.exact)
                  ? "bg-sidebar-accent/90 text-sidebar-accent-foreground shadow-[0_10px_28px_rgba(8,35,50,0.24)] ring-1 ring-white/15"
                  : "text-sidebar-foreground/72 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground",
              )}
              aria-current={isActive(item.href, item.exact) ? "page" : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{item.label}</span>
            </PublicRouteControl>

            {item.children && isActive(item.href) && (
              <div className="ml-6 mt-1 hidden space-y-1 sm:block">
                {item.children.map((child) => (
                  <PublicRouteControl
                    key={child.href}
                    href={child.href}
                    variant="bare"
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      pathname === child.href
                        ? "bg-sidebar-accent/80 text-sidebar-accent-foreground ring-1 ring-white/10"
                        : "text-sidebar-foreground/62 hover:bg-sidebar-accent/38 hover:text-sidebar-foreground",
                    )}
                    aria-current={pathname === child.href ? "page" : undefined}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                    {child.label}
                  </PublicRouteControl>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-2 py-4 sm:px-3">
        <PublicRouteControl
          href={ROUTES.home}
          variant="bare"
          className="flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground sm:justify-start sm:px-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Volver al sitio público</span>
        </PublicRouteControl>
      </div>
    </aside>
  );
}

