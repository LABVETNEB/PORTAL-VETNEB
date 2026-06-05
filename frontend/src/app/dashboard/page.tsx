import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ClipboardList, Route } from "lucide-react";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  StickyActionBar,
  type StickyActionBarAction,
} from "@/components/dashboard/StickyActionBar";
import { ClinicCommandCenter } from "./ClinicCommandCenter";
import { ClinicParticularTokensCard } from "@/components/dashboard/ClinicParticularTokensCard";
import { ClinicPublicProfileCard } from "@/components/dashboard/ClinicPublicProfileCard";
import { ROUTES } from "@/lib/routes";
import {
  getDashboardStats,
  getLogisticsFieldVisits,
  getReports,
} from "@/lib/api";

export const metadata: Metadata = {
  title: "Dashboard Clínica — Portal VETNEB",
  robots: { index: false, follow: false },
};

async function getDashboardRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function DashboardPage() {
  const requestOptions = await getDashboardRequestOptions();
  let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;
  let statsLoadError = false;
  let reports: Awaited<ReturnType<typeof getReports>> = [];
  let reportsLoadError = false;
  let visits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];
  let visitsLoadError = false;

  try {
    stats = await getDashboardStats(requestOptions);
  } catch {
    statsLoadError = true;
  }

  await Promise.all([
    (async () => {
      try {
        reports = await getReports(requestOptions, undefined, {
          throwOnError: true,
        });
      } catch {
        reportsLoadError = true;
      }
    })(),
    (async () => {
      try {
        visits = await getLogisticsFieldVisits(requestOptions, {
          throwOnError: true,
        });
      } catch {
        visitsLoadError = true;
      }
    })(),
  ]);

  const recentReports = reports.slice(0, 3);
  const recentVisits = visits.slice(0, 3);

  const clinicQuickActions = [
    {
      label: "Ver informes",
      href: ROUTES.dashboardInformes,
      variant: "default",
      icon: <ClipboardList className="h-4 w-4" aria-hidden="true" />,
      "aria-label": "Ir a informes",
    },
    {
      label: "Ver logística",
      href: ROUTES.dashboardLogisticaVisitas,
      variant: "outline",
      icon: <Route className="h-4 w-4" aria-hidden="true" />,
      "aria-label": "Ir a visitas de campo",
    },
  ] satisfies StickyActionBarAction[];

  return (
    <>
      <DashboardTopbar
        title="Dashboard Clínica"
        subtitle="Resumen operativo clínica"
        notifications="clinic"
      />
      <main className="dashboard-main">
        <DashboardPageHeader
          title="Centro de operaciones"
          description="Resumen operativo, métricas e informes recientes de la clínica."
        />
        <StickyActionBar
          context="Acciones rápidas"
          actions={clinicQuickActions}
        />
        <ClinicCommandCenter
          stats={stats}
          statsLoadError={statsLoadError}
          recentReports={recentReports}
          recentVisits={recentVisits}
          reportsLoadError={reportsLoadError}
          visitsLoadError={visitsLoadError}
        />
        <ClinicPublicProfileCard />
        <ClinicParticularTokensCard />
      </main>
    </>
  );
}
