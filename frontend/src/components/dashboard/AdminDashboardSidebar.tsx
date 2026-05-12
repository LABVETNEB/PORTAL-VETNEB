import { ROUTES } from "@/lib/routes";
import {
  DashboardSidebarFrame,
  type DashboardNavItem,
} from "./DashboardSidebarFrame";

const adminNavItems: DashboardNavItem[] = [
  {
    label: "Administración",
    href: ROUTES.dashboardAdmin,
    icon: "🔧",
    exact: true,
  },
  {
    label: "Subir informe",
    href: `${ROUTES.dashboardAdmin}#admin-report-upload`,
    icon: "📄",
  },
  {
    label: "Health",
    href: `${ROUTES.dashboardAdmin}#admin-health`,
    icon: "🟢",
  },
  {
    label: "Tokens particulares",
    href: `${ROUTES.dashboardAdmin}#admin-particular-tokens`,
    icon: "🎫",
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
  {
    label: "Maintenance",
    href: `${ROUTES.dashboardAdmin}#admin-maintenance`,
    icon: "🧹",
  },
];

export function AdminDashboardSidebar() {
  return (
    <DashboardSidebarFrame
      dashboardLabel="Dashboard admin"
      navItems={adminNavItems}
    />
  );
}


