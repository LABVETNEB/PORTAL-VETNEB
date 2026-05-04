"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";

const navItems = [
  {
    label: "Dashboard",
    href: ROUTES.dashboard,
    icon: "⊞",
    exact: true,
  },
  {
    label: "Informes",
    href: ROUTES.dashboardInformes,
    icon: "📋",
  },
  {
    label: "Logística",
    href: ROUTES.dashboardLogistica,
    icon: "🚐",
    children: [
      { label: "Visitas de campo", href: ROUTES.dashboardLogisticaVisitas },
      { label: "Planes de ruta", href: ROUTES.dashboardLogisticaRutas },
      { label: "Métricas", href: ROUTES.dashboardLogisticaMetricas },
    ],
  },
  {
    label: "Administración",
    href: ROUTES.dashboardAdmin,
    icon: "🔧",
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen"
      aria-label="Navegación del dashboard"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-white font-bold text-sm">
          VN
        </div>
        <div>
          <p className="font-semibold text-sm text-sidebar-foreground">
            Portal VETNEB
          </p>
          <p className="text-xs text-sidebar-foreground/60">Dashboard</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Menú principal">
        {navItems.map((item) => (
          <div key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive(item.href, item.exact)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
              aria-current={isActive(item.href, item.exact) ? "page" : undefined}
            >
              <span aria-hidden="true" className="text-base">
                {item.icon}
              </span>
              {item.label}
            </Link>
            {/* Sub-navegación */}
            {item.children && isActive(item.href) && (
              <div className="ml-6 mt-1 space-y-1">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      pathname === child.href
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                    )}
                    aria-current={pathname === child.href ? "page" : undefined}
                  >
                    <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer del sidebar */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <Link
          href={ROUTES.home}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          <span aria-hidden="true">←</span>
          Volver al sitio público
        </Link>
      </div>
    </aside>
  );
}
