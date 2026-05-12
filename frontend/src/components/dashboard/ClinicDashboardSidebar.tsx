import { ROUTES } from "@/lib/routes";
import {
  DashboardSidebarFrame,
  type DashboardNavItem,
} from "./DashboardSidebarFrame";

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
    href: `${ROUTES.dashboard}#clinic-public-profile`,
    icon: "🏥",
  },
  {
    label: "Tokens particulares",
    href: `${ROUTES.dashboard}#clinic-particular-tokens`,
    icon: "🔐",
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
