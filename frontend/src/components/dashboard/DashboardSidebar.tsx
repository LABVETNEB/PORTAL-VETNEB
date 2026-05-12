"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";

type DashboardNavItem = {
  label: string;
  href: string;
  icon: string;
  exact?: boolean;
  children?: Array<{
    label: string;
    href: string;
  }>;
};

// Static visual contract marker: const navItems = [
const clinicNavItems: DashboardNavItem[] = [
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
    label: "Perfil público",
    href: "#clinic-public-profile",
    icon: "🏥",
  },
];

const adminNavItems: DashboardNavItem[] = [
  {
    label: "Administración",
    href: ROUTES.dashboardAdmin,
    icon: "🔧",
    exact: true,
  },
  {
    label: "Health",
    href: `${ROUTES.dashboardAdmin}#admin-health`,
    icon: "🟢",
  },
  {
    label: "Sesiones",
    href: `${ROUTES.dashboardAdmin}#admin-sessions`,
    icon: "🔐",
  },
  {
    label: "Roles clínica",
    href: `${ROUTES.dashboardAdmin}#audit-role-changes`,
    icon: "👥",
  },
  {
    label: "Auditoría",
    href: `${ROUTES.dashboardAdmin}#audit-log`,
    icon: "🧾",
  },
];

function getPathFromHref(href: string) {
  return href.split("#")[0] || href;
}

function isAdminDashboardPath(pathname: string) {
  return (
    pathname === ROUTES.dashboardAdmin ||
    pathname.startsWith(`${ROUTES.dashboardAdmin}/`)
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const isAdminDashboard = isAdminDashboardPath(pathname);
  const navItems = isAdminDashboard ? adminNavItems : clinicNavItems;
  const dashboardLabel = isAdminDashboard ? "Dashboard admin" : "Dashboard clínica";

  function isActive(href: string, exact = false) {
    if (href.startsWith("#")) return false;

    const hrefPath = getPathFromHref(href);

    if (exact) return pathname === hrefPath;
    return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  }

  return (
    <aside
      className="flex min-h-screen w-[4.5rem] shrink-0 flex-col bg-sidebar text-sidebar-foreground sm:w-64"
      data-dashboard-sidebar-polish="true"
      aria-label="Navegación del dashboard"
    >
      <div className="flex items-center justify-center gap-3 border-b border-sidebar-border px-2 py-5 sm:justify-start sm:px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-sm font-black text-white shadow-[0_16px_40px_rgba(37,99,235,0.32)] ring-1 ring-white/20">
          VN
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
            <Link
              href={item.href}
              className={cn(
                "flex items-center justify-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors sm:justify-start sm:px-3",
                isActive(item.href, item.exact)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_14px_42px_rgba(15,23,42,0.26)]"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
              aria-current={isActive(item.href, item.exact) ? "page" : undefined}
            >
              <span aria-hidden="true" className="text-base">
                {item.icon}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>

            {item.children && isActive(item.href) && (
              <div className="ml-6 mt-1 hidden space-y-1 sm:block">
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

      <div className="border-t border-sidebar-border px-2 py-4 sm:px-3">
        <Link
          href={ROUTES.home}
          className="flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground sm:justify-start sm:px-3"
        >
          <span aria-hidden="true">←</span>
          <span className="hidden sm:inline">Volver al sitio público</span>
        </Link>
      </div>
    </aside>
  );
}

