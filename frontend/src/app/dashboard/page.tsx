import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";
import {
  ClinicDashboardWorkspaceController,
  DEFAULT_CLINIC_MODULE,
} from "@/components/dashboard/ClinicDashboardWorkspaceController";
import { ClinicModuleHub } from "@/components/dashboard/ClinicModuleHub";
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
import { parseClinicModule } from "@/features/dashboard/config";
import { HUB_QUERY_VALUE } from "@/features/dashboard/application";

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

type PageSearchParams = {
  module?: string;
  hub?: string;
};

// Hermetic data window handed to the client-side adaptive summaries. It bounds
// how much this server component fetches; it is NOT a page size. The measured
// page size stays owned by `useDashboardCanvasCapacity` inside each workspace
// summary (audit §20). The previous window of 24 sat below the largest measured
// canvas, so the second page was truncated by the end of the dataset on tall
// viewports — exactly what the A03 contract forbids (§20.4).
const CLINIC_DASHBOARD_ADAPTIVE_SUPERSET_LIMIT = 100;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<PageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  // An absent or invalid module resolves to the operational default so the server
  // render already opens the operations workspace.
  const initialModule =
    parseClinicModule(resolvedSearchParams.module) ?? DEFAULT_CLINIC_MODULE;
  // CMP-02 — the explicit Inicio/hub state, resolved server-side so the first
  // paint never flashes a module before the client reads the URL (audit DIF-041).
  const initialHub = resolvedSearchParams.hub === HUB_QUERY_VALUE;

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
        // Viewport-safe superset: the informes/logistica workspace summaries
        // paginate client-side with a measured adaptive page size, so the
        // fetch window must cover a COMPLETE second page at the largest
        // desktop canvas, not just the first page.
        reports = await getReports(
          requestOptions,
          {
            limit: CLINIC_DASHBOARD_ADAPTIVE_SUPERSET_LIMIT,
            offset: 0,
          },
          {
            throwOnError: true,
          },
        );
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

  // The adaptive workspace summaries receive the collections whole: a cap here
  // competed with the measured page size and truncated their second page. The
  // compact `.slice(0, 3)` handed to ClinicCommandCenter below is a different,
  // non-normative summary and is deliberately kept.
  const recentReports = reports;
  const recentVisits = visits;

  return (
    <ClinicDashboardShell
      title="Dashboard Clínica"
      subtitle="Portal operativo clínica"
    >
      <Suspense>
        <ClinicDashboardWorkspaceController
          initialModule={initialModule}
          initialHub={initialHub}
          hub={<ClinicModuleHub />}
          workspaces={{
            operaciones: (
              <ClinicCommandCenter
                stats={stats}
                statsLoadError={statsLoadError}
                recentReports={recentReports.slice(0, 3)}
                recentVisits={recentVisits.slice(0, 3)}
                reportsLoadError={reportsLoadError}
                visitsLoadError={visitsLoadError}
              />
            ),
            informes: (
              <ClinicInformesWorkspaceSummary
                recentReports={recentReports}
                reportsLoadError={reportsLoadError}
              />
            ),
            logistica: (
              <ClinicLogisticaWorkspaceSummary
                recentVisits={recentVisits}
                visitsLoadError={visitsLoadError}
              />
            ),
            perfil: <ClinicPublicProfileCard />,
            tokens: <ClinicParticularTokensCard />,
          }}
        />
      </Suspense>
    </ClinicDashboardShell>
  );
}
