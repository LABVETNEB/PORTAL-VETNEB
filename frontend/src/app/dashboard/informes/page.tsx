import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";
import { ClinicFullRouteModuleStage } from "@/components/dashboard/ClinicFullRouteModuleStage";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import {
  dashboardFilterActionClassName,
  dashboardFilterControlClassName,
  FilterBar,
  FilterField,
} from "@/components/dashboard/FilterBar";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  getReportsPaginated,
  searchReportsPaginated,
  type PaginatedReports,
} from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import { InformesReportsList } from "./InformesReportsList";
import { ModuleMetricRun } from "@/components/dashboard/ModuleMetricRun";
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
  const hasActiveFilters = Boolean(query || status || studyType);

  return (
    <ClinicDashboardShell
      title="Informes"
      subtitle="Consulta de informes médicos veterinarios"
      module="informes"
    >
      <ClinicFullRouteModuleStage moduleId="informes-full">
        <ModuleCard
          ariaLabel="Informes disponibles"
          dataAttributes={{ "data-informes-workspace": "true" }}
        >
        <CardHeader className="shrink-0 border-b border-vetneb-line/70">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">Informes disponibles</CardTitle>
              <p
                className="mt-1 text-sm text-muted-foreground"
                data-dashboard-chrome-secondary="true"
              >
                Seleccione un informe de la lista para abrir el detalle operativo.
              </p>
              <ModuleMetricRun
                surfaceId="clinic-informes-full"
                className="mt-1 text-xs text-muted-foreground"
                metrics={[
                  { key: "total-resultados", label: "Total resultados", value: pagedResult.total },
                  { key: "en-proceso", label: "En proceso", value: reports.filter((report) => report.status === "processing").length },
                  { key: "disponibles", label: "Disponibles", value: reports.filter((report) => report.status === "ready" || report.status === "delivered").length },
                ]}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
          <FilterBar
            method="get"
            role="search"
            aria-label="Filtros compactos de informes"
            density="module-card"
            className="shrink-0 lg:grid-cols-[1.4fr_0.8fr_1fr_auto]"
          >
            <FilterField label="Buscar">
              <Input
                name="query"
                defaultValue={query}
                className={dashboardFilterControlClassName("module-card")}
                placeholder="Buscar por paciente o tipo de estudio..."
                aria-label="Buscar informes"
              />
            </FilterField>

            <ModuleDialog
              title="Filtros de informes"
              description="Ajuste el estado y tipo de estudio sin ampliar la banda operativa."
              trigger={
                <Button
                  type="button"
                  size="sm"
                  variant={hasActiveFilters ? "default" : "outline"}
                  className="h-9 justify-center px-2 text-xs"
                >
                  Más filtros
                </Button>
              }
            >
              <form method="get" className="grid gap-3">
                <input type="hidden" name="query" defaultValue={query} />
                <FilterField label="Estado" density="module-card">
                  <Select
                    name="status"
                    defaultValue={status}
                    className={dashboardFilterControlClassName("module-card")}
                    aria-label="Filtrar por estado"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FilterField>

                <FilterField label="Tipo de estudio" density="module-card">
                  <Input
                    name="studyType"
                    defaultValue={studyType}
                    className={dashboardFilterControlClassName("module-card")}
                    placeholder="Filtrar por tipo de estudio..."
                    aria-label="Filtrar por tipo de estudio"
                  />
                </FilterField>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    className={dashboardFilterActionClassName("module-card")}
                  >
                    Filtrar
                  </Button>
                  <PublicRouteControl
                    href="/dashboard/informes"
                    replace
                    variant="bare"
                    className={`${dashboardFilterActionClassName("module-card")} inline-flex items-center justify-center rounded-md border border-input bg-card/95 font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70`}
                  >
                    Limpiar
                  </PublicRouteControl>
                </div>
              </form>
            </ModuleDialog>

            <div className="hidden lg:contents">
              <FilterField label="Estado" density="module-card">
                <Select
                  name="status"
                  defaultValue={status}
                  className={dashboardFilterControlClassName("module-card")}
                  aria-label="Filtrar por estado"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FilterField>

              <FilterField label="Tipo de estudio" density="module-card">
                <Input
                  name="studyType"
                  defaultValue={studyType}
                  className={dashboardFilterControlClassName("module-card")}
                  placeholder="Filtrar por tipo de estudio..."
                  aria-label="Filtrar por tipo de estudio"
                />
              </FilterField>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className={dashboardFilterActionClassName("module-card")}
                >
                  Filtrar
                </Button>
                <PublicRouteControl
                  href="/dashboard/informes"
                  replace
                  variant="bare"
                  className={`${dashboardFilterActionClassName("module-card")} inline-flex items-center justify-center rounded-md border border-input bg-card/95 font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70`}
                >
                  Limpiar
                </PublicRouteControl>
              </div>
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
        </ModuleCard>
      </ClinicFullRouteModuleStage>
    </ClinicDashboardShell>
  );
}
