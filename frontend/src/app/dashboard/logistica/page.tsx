import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";
import { ClinicFullRouteModuleStage } from "@/components/dashboard/ClinicFullRouteModuleStage";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
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

  return (
    <ClinicDashboardShell
      title="Logística"
      subtitle="Visitas de campo y planes de ruta"
      module="logistica"
      mainAdaptiveReservation
    >
      <ClinicFullRouteModuleStage moduleId="logistica-full">
      <LogisticsCommandCenter
        fieldVisits={fieldVisits}
        routePlans={routePlans}
        fieldVisitsLoadError={fieldVisitsLoadError}
        routePlansLoadError={routePlansLoadError}
        headerActions={
          <>
            <PublicRouteControl href={ROUTES.dashboardLogisticaVisitas} variant="bare" className="dashboard-module-card-chip">Visitas</PublicRouteControl>
            <PublicRouteControl href={ROUTES.dashboardLogisticaRutas} variant="bare" className="dashboard-module-card-chip">Rutas</PublicRouteControl>
            <PublicRouteControl href={ROUTES.dashboardLogisticaMetricas} variant="bare" className="dashboard-module-card-chip">Métricas</PublicRouteControl>
          </>
        }
      />
      </ClinicFullRouteModuleStage>
    </ClinicDashboardShell>
  );
}
