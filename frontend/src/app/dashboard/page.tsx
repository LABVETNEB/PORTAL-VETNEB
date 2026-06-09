import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  Building2,
  FileText,
  KeyRound,
  LayoutDashboard,
  Route,
} from "lucide-react";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardModuleHub } from "@/components/dashboard/DashboardModuleHub";
import { ClinicCommandCenter } from "./ClinicCommandCenter";
import { ClinicParticularTokensCard } from "@/components/dashboard/ClinicParticularTokensCard";
import { ClinicPublicProfileCard } from "@/components/dashboard/ClinicPublicProfileCard";
import { Badge } from "@/components/ui/badge";
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

  const pendingReports = stats?.pendingReports ?? 0;
  const activeVisits = stats?.activeVisits ?? 0;

  const clinicCards = [
    {
      icon: LayoutDashboard,
      title: "Centro de operaciones",
      description: "Métricas operativas, informes recientes y visitas activas.",
      href: `${ROUTES.dashboard}#clinic-command-center`,
      badge:
        pendingReports > 0 ? (
          <Badge variant="destructive" aria-label={`${pendingReports} informes pendientes`}>
            {pendingReports}
          </Badge>
        ) : null,
      actionLabel: "Ver resumen",
    },
    {
      icon: FileText,
      title: "Informes",
      description: "Consultar, filtrar y descargar informes veterinarios.",
      href: ROUTES.dashboardInformes,
      actionLabel: "Abrir informes",
    },
    {
      icon: Route,
      title: "Logística",
      description: "Visitas de campo, planes de ruta y métricas de cumplimiento.",
      href: ROUTES.dashboardLogistica,
      badge:
        activeVisits > 0 ? (
          <Badge variant="default" aria-label={`${activeVisits} visitas activas`}>
            {activeVisits}
          </Badge>
        ) : null,
      actionLabel: "Ver logística",
    },
    {
      icon: Building2,
      title: "Perfil público",
      description: "Publicar y actualizar el perfil en el banco de especialidades.",
      href: `${ROUTES.dashboard}#clinic-public-profile`,
      actionLabel: "Editar perfil",
    },
    {
      icon: KeyRound,
      title: "Tokens particulares",
      description: "Generar y gestionar tokens de acceso para pacientes.",
      href: `${ROUTES.dashboard}#clinic-particular-tokens`,
      actionLabel: "Gestionar tokens",
    },
  ];

  return (
    <>
      <DashboardTopbar
        title="Dashboard Clínica"
        subtitle="Portal operativo clínica"
        notifications="clinic"
      />
      <main className="dashboard-main">
        <DashboardPageHeader
          title="Dashboard Clínica"
          description="Seleccione un módulo para acceder a sus funciones o desplácese para el resumen operativo."
        />
        <DashboardModuleHub
          heading="Módulos operativos"
          description="Acceso rápido a informes, logística, perfil público y tokens de la clínica."
          cards={clinicCards}
        />
        <div id="clinic-command-center" className="scroll-mt-20">
          <ClinicCommandCenter
            stats={stats}
            statsLoadError={statsLoadError}
            recentReports={recentReports}
            recentVisits={recentVisits}
            reportsLoadError={reportsLoadError}
            visitsLoadError={visitsLoadError}
          />
        </div>
        <ClinicPublicProfileCard />
        <ClinicParticularTokensCard />
        <div className="h-24 md:hidden" aria-hidden="true" />
      </main>
    </>
  );
}
