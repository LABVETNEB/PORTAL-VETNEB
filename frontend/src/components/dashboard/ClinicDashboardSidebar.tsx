import {
  Building2,
  FileText,
  KeyRound,
  LayoutDashboard,
  Route,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import {
  DashboardSidebarFrame,
  type DashboardNavItem,
} from "./DashboardSidebarFrame";

const clinicNavItems: DashboardNavItem[] = [
  {
    label: "Dashboard",
    href: ROUTES.dashboard,
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Informes",
    href: ROUTES.dashboardInformes,
    icon: FileText,
  },
  {
    label: "Logística",
    href: ROUTES.dashboardLogistica,
    icon: Route,
    children: [
      { label: "Visitas de campo", href: ROUTES.dashboardLogisticaVisitas },
      { label: "Planes de ruta", href: ROUTES.dashboardLogisticaRutas },
      { label: "Métricas", href: ROUTES.dashboardLogisticaMetricas },
    ],
  },
  {
    label: "Perfil público",
    href: `${ROUTES.dashboard}#clinic-public-profile`,
    icon: Building2,
  },
  {
    label: "Tokens particulares",
    href: `${ROUTES.dashboard}#clinic-particular-tokens`,
    icon: KeyRound,
  },
];

export function ClinicDashboardSidebar() {
  return (
    <DashboardSidebarFrame
      dashboardLabel="Dashboard clínica"
      navItems={clinicNavItems}
    />
  );
}
