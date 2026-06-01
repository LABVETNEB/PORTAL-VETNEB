import {
  Activity,
  Building2,
  ClipboardPlus,
  KeyRound,
  ReceiptText,
  ScrollText,
  Settings2,
  ShieldCheck,
  TicketCheck,
  UsersRound,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import {
  DashboardSidebarFrame,
  type DashboardNavItem,
} from "./DashboardSidebarFrame";

const adminNavItems: DashboardNavItem[] = [
  {
    label: "Administración",
    href: ROUTES.dashboardAdmin,
    icon: Settings2,
    exact: true,
  },
  {
    label: "Subir informe",
    href: `${ROUTES.dashboardAdmin}#admin-report-upload`,
    icon: ClipboardPlus,
  },
  {
    label: "Estado",
    href: `${ROUTES.dashboardAdmin}#admin-health`,
    icon: Activity,
  },
  {
    label: "Clínicas",
    href: `${ROUTES.dashboardAdmin}#admin-clinics`,
    icon: Building2,
  },
  {
    label: "Tokens particulares",
    href: `${ROUTES.dashboardAdmin}#admin-particular-tokens`,
    icon: TicketCheck,
  },
  {
    label: "Precios",
    href: `${ROUTES.dashboardAdmin}#admin-pricing`,
    icon: ReceiptText,
  },
  {
    label: "Sesiones",
    href: `${ROUTES.dashboardAdmin}#admin-sessions`,
    icon: KeyRound,
  },
  {
    label: "Roles clínica",
    href: `${ROUTES.dashboardAdmin}#admin-users-roles`,
    icon: UsersRound,
  },
  {
    label: "Auditoría",
    href: `${ROUTES.dashboardAdmin}#audit-log`,
    icon: ScrollText,
  },
  {
    label: "Mantenimiento",
    href: `${ROUTES.dashboardAdmin}#admin-maintenance`,
    icon: ShieldCheck,
  },
];

export function AdminDashboardSidebar() {
  return (
    <DashboardSidebarFrame
      dashboardLabel="Administración"
      navItems={adminNavItems}
    />
  );
}
