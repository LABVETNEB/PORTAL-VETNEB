import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BarChart3, MapPinned, Truck } from "lucide-react";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  StickyActionBar,
  type StickyActionBarAction,
} from "@/components/dashboard/StickyActionBar";
import { ROUTES } from "@/lib/routes";
import {
  getLogisticsFieldVisits,
  getRoutePlans,
} from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import { LogisticsCommandCenter } from "./LogisticsCommandCenter";

export const metadata: Metadata = {
  title: "Logística — Portal VETNEB",
  robots: { index: false, follow: false },
};

async function getLogisticsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function LogisticaPage() {
  const requestOptions = await getLogisticsRequestOptions();
  let fieldVisits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];
  let fieldVisitsLoadError = false;
  let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];
  let routePlansLoadError = false;

  await Promise.all([
    (async () => {
      try {
        fieldVisits = await getLogisticsFieldVisits(requestOptions, {
          throwOnError: true,
        });
      } catch (error) {
        redirectToLoginOnUnauthorized(error);
        fieldVisitsLoadError = true;
      }
    })(),
    (async () => {
      try {
        routePlans = await getRoutePlans(requestOptions, {
          throwOnError: true,
        });
      } catch (error) {
        redirectToLoginOnUnauthorized(error);
        routePlansLoadError = true;
      }
    })(),
  ]);

  const activeVisits = fieldVisits.filter(
    (v) => v.status === "in_progress" || v.status === "scheduled",
  );
  const activePlans = routePlans.filter(
    (p) => p.status === "in_progress" || p.status === "released",
  );

  const logisticsQuickActions = [
    {
      label: "Ver visitas",
      href: ROUTES.dashboardLogisticaVisitas,
      variant: "default",
      icon: <Truck className="h-4 w-4" aria-hidden="true" />,
      "aria-label": "Ir a visitas de campo",
    },
    {
      label: "Ver rutas",
      href: ROUTES.dashboardLogisticaRutas,
      variant: "outline",
      icon: <MapPinned className="h-4 w-4" aria-hidden="true" />,
      "aria-label": "Ir a planes de ruta",
    },
    {
      label: "Ver métricas",
      href: ROUTES.dashboardLogisticaMetricas,
      variant: "outline",
      icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
      "aria-label": "Ir a métricas de logística",
    },
  ] satisfies StickyActionBarAction[];

  return (
    <>
      <DashboardTopbar
        title="Logística"
        subtitle="Visitas de campo y planes de ruta"
        notifications="clinic"
      />
      <main className="dashboard-main">
        <DashboardPageHeader
          title="Hub de logística"
          description="Estado operativo de visitas de campo, planes de ruta y métricas de cumplimiento."
        />
        <StickyActionBar
          context="Acciones rápidas"
          actions={logisticsQuickActions}
        />
        <LogisticsCommandCenter
          fieldVisits={fieldVisits}
          routePlans={routePlans}
          fieldVisitsLoadError={fieldVisitsLoadError}
          routePlansLoadError={routePlansLoadError}
        />
      </main>
    </>
  );
}
