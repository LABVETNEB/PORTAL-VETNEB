import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import {
  dashboardFilterActionClassName,
  dashboardFilterControlClassName,
  FilterBar,
  FilterField,
} from "@/components/dashboard/FilterBar";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  getReportsPaginated,
  searchReportsPaginated,
  type PaginatedReports,
} from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import { getReportStatusLabel } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { InformesReportsList } from "./InformesReportsList";
import { INFORMES_FALLBACK_ROWS } from "./informes.constants";

export const metadata: Metadata = {
  title: "Informes — Portal VETNEB",
  robots: { index: false, follow: false },
};

const statusOptions = [
  { value: "", label: "Todos los estados" },
  { value: "uploaded", label: "Subido" },
  { value: "processing", label: "Procesando" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
];

type InformesPageSearchParams = {
  query?: string | string[];
  status?: string | string[];
  studyType?: string | string[];
  reportId?: string | string[];
};

function normalizeSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeStatusFilter(value: string) {
  if (statusOptions.some((option) => option.value === value)) {
    return value;
  }

  return "";
}

function normalizeReportIdFilter(value: string) {
  const reportId = Number(value);

  return Number.isInteger(reportId) && reportId > 0 ? reportId : null;
}

async function getReportsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function InformesPage({
  searchParams,
}: {
  searchParams?: Promise<InformesPageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = normalizeSearchParamValue(resolvedSearchParams.query).trim();
  const status = normalizeStatusFilter(
    normalizeSearchParamValue(resolvedSearchParams.status),
  );
  const studyType = normalizeSearchParamValue(resolvedSearchParams.studyType).trim();
  const selectedReportId = normalizeReportIdFilter(
    normalizeSearchParamValue(resolvedSearchParams.reportId),
  );
  const requestOptions = await getReportsRequestOptions();

  // The measured viewport pageSize is only known client-side, so the initial
  // server render uses `INFORMES_FALLBACK_ROWS` as the pre-measurement
  // baseline; `InformesReportsList` re-derives and re-fetches the real page
  // size (RF debounced pattern, same contract as R-06 `AdminAuditCard`).
  let pagedResult: PaginatedReports = {
    reports: [],
    total: 0,
    page: 1,
    pageSize: INFORMES_FALLBACK_ROWS,
    totalPages: 0,
  };
  let reportsLoadError = false;

  try {
    pagedResult = query
      ? await searchReportsPaginated(
          {
            query,
            status: status || undefined,
            studyType: studyType || undefined,
            page: 1,
            pageSize: INFORMES_FALLBACK_ROWS,
          },
          requestOptions,
          { throwOnError: true },
        )
      : await getReportsPaginated(
          requestOptions,
          {
            status: status || undefined,
            page: 1,
            pageSize: INFORMES_FALLBACK_ROWS,
          },
          { throwOnError: true },
        );
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    reportsLoadError = true;
  }

  const reports = pagedResult.reports;

  const selectedReport =
    selectedReportId === null
      ? (reports[0] ?? null)
      : (reports.find((report) => report.id === selectedReportId) ?? null);

  return (
    <>
      <DashboardTopbar
        title="Informes"
        subtitle="Consulta de informes médicos veterinarios"
        notifications="clinic"
      />
      <main className="dashboard-main">
        <DashboardPageHeader
          title="Informes"
          description="Consulta compacta de informes: lista operativa, selección directa y detalle separado sin superponer filtros."
          badge={
            selectedReport ? (
              <StatusBadge
                status={selectedReport.status}
                label={getReportStatusLabel(selectedReport.status)}
                size="sm"
              />
            ) : null
          }
          actions={
            <PublicRouteControl
              href={ROUTES.dashboard}
              variant="bare"
              aria-label="Volver al dashboard"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card/95 px-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
            >
              <span>Volver a m&oacute;dulos</span>
            </PublicRouteControl>
          }
        />

        <Card className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden">
          <CardHeader className="shrink-0 border-b border-vetneb-line/70">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle className="text-base">Informes disponibles</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Seleccione un informe de la lista para abrir el detalle operativo.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
            <FilterBar
              method="get"
              role="search"
              aria-label="Filtros compactos de informes"
              className="shrink-0 lg:grid-cols-[1.4fr_0.8fr_1fr_auto]"
            >
              <FilterField label="Buscar">
                <Input
                  name="query"
                  defaultValue={query}
                  className={dashboardFilterControlClassName()}
                  placeholder="Buscar por paciente o tipo de estudio..."
                  aria-label="Buscar informes"
                />
              </FilterField>

              <FilterField label="Estado">
                <Select
                  name="status"
                  defaultValue={status}
                  className={dashboardFilterControlClassName()}
                  aria-label="Filtrar por estado"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FilterField>

              <FilterField label="Tipo de estudio">
                <Input
                  name="studyType"
                  defaultValue={studyType}
                  className={dashboardFilterControlClassName()}
                  placeholder="Filtrar por tipo de estudio..."
                  aria-label="Filtrar por tipo de estudio"
                />
              </FilterField>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" className={dashboardFilterActionClassName()}>
                  Filtrar
                </Button>
                <PublicRouteControl
                  href="/dashboard/informes"
                  replace
                  variant="bare"
                  className={`${dashboardFilterActionClassName()} inline-flex items-center justify-center rounded-md border border-input bg-card/95 font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70`}
                >
                  Limpiar
                </PublicRouteControl>
              </div>
            </FilterBar>

            <InformesReportsList
              filters={{ query, status, studyType }}
              initialReports={reports}
              initialTotal={pagedResult.total}
              initialPage={pagedResult.page}
              initialPageSize={pagedResult.pageSize}
              initialLoadError={reportsLoadError}
              initialSelectedReportId={selectedReportId}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
