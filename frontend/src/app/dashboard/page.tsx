import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ClinicDashboardWorkspaceController } from "@/components/dashboard/ClinicDashboardWorkspaceController";
import type { ClinicModule } from "@/components/dashboard/ClinicDashboardWorkspaceController";
import { ClinicMobileModuleFrame } from "@/components/dashboard/ClinicMobileModuleFrame";
import { ClinicCommandCenter } from "./ClinicCommandCenter";
import { ClinicParticularTokensCard } from "@/components/dashboard/ClinicParticularTokensCard";
import { ClinicPublicProfileCard } from "@/components/dashboard/ClinicPublicProfileCard";
import { ClinicInformesWorkspaceSummary } from "./ClinicInformesWorkspaceSummary";
import { ClinicLogisticaWorkspaceSummary } from "./ClinicLogisticaWorkspaceSummary";
import {
  getDashboardStats,
  getLogisticsFieldVisits,
  getReports,
} from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";

export const metadata: Metadata = {
  title: "Dashboard Clínica — Portal VETNEB",
  robots: { index: false, follow: false },
};

const VALID_CLINIC_MODULES: ClinicModule[] = [
  "operaciones",
  "informes",
  "logistica",
  "perfil",
  "tokens",
];

function parseClinicModule(value: string | undefined): ClinicModule | null {
  if (!value) return null;
  return VALID_CLINIC_MODULES.includes(value as ClinicModule)
    ? (value as ClinicModule)
    : null;
}

async function getDashboardRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

type PageSearchParams = {
  module?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<PageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialModule = parseClinicModule(resolvedSearchParams.module);

  const requestOptions = await getDashboardRequestOptions();
  let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;
  let statsLoadError = false;
  let reports: Awaited<ReturnType<typeof getReports>> = [];
  let reportsLoadError = false;
  let visits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];
  let visitsLoadError = false;

  try {
    stats = await getDashboardStats(requestOptions);
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    statsLoadError = true;
  }

  await Promise.all([
    (async () => {
      try {
        reports = await getReports(requestOptions, undefined, {
          throwOnError: true,
        });
      } catch (error) {
        redirectToLoginOnUnauthorized(error);
        reportsLoadError = true;
      }
    })(),
    (async () => {
      try {
        visits = await getLogisticsFieldVisits(requestOptions, {
          throwOnError: true,
        });
      } catch (error) {
        redirectToLoginOnUnauthorized(error);
        visitsLoadError = true;
      }
    })(),
  ]);

  const recentReports = reports.slice(0, 3);
  const recentVisits = visits.slice(0, 3);

  const pendingReports = stats?.pendingReports ?? 0;
  const activeVisits = stats?.activeVisits ?? 0;

  return (
    <>
      <DashboardTopbar
        title="Dashboard Clínica"
        subtitle="Portal operativo clínica"
        notifications="clinic"
      />
      <main className="dashboard-main">
        <Suspense>
          <ClinicDashboardWorkspaceController
            initialModule={initialModule}
            stats={stats}
            statsLoadError={statsLoadError}
            recentReports={recentReports}
            reportsLoadError={reportsLoadError}
            recentVisits={recentVisits}
            visitsLoadError={visitsLoadError}
            pendingReports={pendingReports}
            activeVisits={activeVisits}
            pageHeader={
              <DashboardPageHeader
                title="Dashboard Clínica"
                description="Seleccione un módulo para acceder a sus funciones."
              />
            }
            workspaces={{
              operaciones: (
                <ClinicMobileModuleFrame moduleId="operaciones">
                  <ClinicCommandCenter
                    stats={stats}
                    statsLoadError={statsLoadError}
                    recentReports={recentReports}
                    recentVisits={recentVisits}
                    reportsLoadError={reportsLoadError}
                    visitsLoadError={visitsLoadError}
                  />
                </ClinicMobileModuleFrame>
              ),
              informes: (
                <ClinicMobileModuleFrame moduleId="informes">
                  <ClinicInformesWorkspaceSummary
                    recentReports={recentReports}
                    reportsLoadError={reportsLoadError}
                  />
                </ClinicMobileModuleFrame>
              ),
              logistica: (
                <ClinicMobileModuleFrame moduleId="logistica">
                  <ClinicLogisticaWorkspaceSummary
                    recentVisits={recentVisits}
                    visitsLoadError={visitsLoadError}
                  />
                </ClinicMobileModuleFrame>
              ),
              perfil: (
                <ClinicMobileModuleFrame moduleId="perfil">
                  <ClinicPublicProfileCard />
                </ClinicMobileModuleFrame>
              ),
              tokens: (
                <ClinicMobileModuleFrame moduleId="tokens">
                  <ClinicParticularTokensCard />
                </ClinicMobileModuleFrame>
              ),
            }}
          />
        </Suspense>
      </main>
    </>
  );
}
