import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";
import { ClinicFullRouteModuleStage } from "@/components/dashboard/ClinicFullRouteModuleStage";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { CanonicalOperationalRow } from "@/components/dashboard/CanonicalOperationalRow";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLogisticsFieldVisits } from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import {
  getFieldVisitStatusLabel,
  getFieldVisitStatusVariant,
  formatDateTime,
} from "@/lib/utils";
import { LogisticsBoundedCanvas } from "../LogisticsBoundedCanvas";
import { ModuleMetricRun } from "@/components/dashboard/ModuleMetricRun";
import { DASHBOARD_TOUCH_PAGER_RESERVATION } from "@/components/dashboard/DashboardPager";
import { FieldVisitDetailDialog } from "../FieldVisitDetailDialog";

export const metadata: Metadata = {
  title: "Visitas de campo — Portal VETNEB",
  robots: { index: false, follow: false },
};

// Backend default/max (server/routes/logistics-field-visits.fastify.ts:
// parsePositiveInt(request.query.limit, 50, 100)). The endpoint exposes no
// total record count, so pagination relies on the page-full heuristic below
// instead of a computed page count.
const VISITAS_DEFAULT_LIMIT = 50;
const VISITAS_MAX_LIMIT = 100;

type VisitasPageSearchParams = {
  offset?: string | string[];
  limit?: string | string[];
};

function normalizeSearchParamValue(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function normalizeOffset(value: string | string[] | undefined): number {
  const parsed = Number(normalizeSearchParamValue(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeLimit(value: string | string[] | undefined): number {
  const parsed = Number(normalizeSearchParamValue(value));
  if (!Number.isInteger(parsed) || parsed < 1) {
    return VISITAS_DEFAULT_LIMIT;
  }

  return Math.min(parsed, VISITAS_MAX_LIMIT);
}

function buildVisitasHref(offset: number, limit: number): string {
  return `/dashboard/logistica/visitas?offset=${offset}&limit=${limit}`;
}

async function getLogisticsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function VisitasPage({
  searchParams,
}: {
  searchParams?: Promise<VisitasPageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const offset = normalizeOffset(resolvedSearchParams.offset);
  const limit = normalizeLimit(resolvedSearchParams.limit);
  // Adaptive default page size: when the URL carries no explicit limit, the
  // bounded canvas recomputes it from the measured viewport (URL offset/limit
  // stays the single pagination contract).
  const hasExplicitLimit =
    normalizeSearchParamValue(resolvedSearchParams.limit).trim() !== "";

  let visits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];
  let visitsLoadError = false;

  try {
    visits = await getLogisticsFieldVisits(
      await getLogisticsRequestOptions(),
      { throwOnError: true },
      { limit, offset },
    );
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    visitsLoadError = true;
  }

  // No `total` is exposed by the endpoint: page-full is the only signal
  // available, so `canGoNext` may false-positive on an exact-multiple last
  // page — documented tradeoff, not a bug (docs/audit/clinic-logistics-full-routes-adaptive-contract-audit.md).
  const canGoPrevious = !visitsLoadError && offset > 0;
  const canGoNext = !visitsLoadError && visits.length === limit;
  const currentPage = Math.floor(offset / limit) + 1;
  const previousHref = buildVisitasHref(Math.max(0, offset - limit), limit);
  const nextHref = buildVisitasHref(offset + limit, limit);

  return (
    <ClinicDashboardShell
      title="Visitas de campo"
      subtitle="Seguimiento de visitas programadas y en curso"
      module="logistica"
    >
      <ClinicFullRouteModuleStage moduleId="logistica-visitas">
      <ModuleCard ariaLabel="Visitas de campo" dataAttributes={{ "data-dashboard-table-surface": "true" }}>
        <CardHeader className="shrink-0">
          <CardTitle className="text-base">
            Visitas ({visits.length})
          </CardTitle>
          <p
            className="text-sm text-muted-foreground"
            data-dashboard-chrome-secondary="true"
          >
            Mostrando {visits.length} visitas · página {currentPage}
            {canGoNext ? " · puede haber más visitas disponibles" : ""}
          </p>
          <p className="text-xs text-muted-foreground">Conteos calculados sobre la página visible, no sobre el total general de visitas.</p>
        </CardHeader>
        {/* CMP-11 (DIF-042/G-014): metrics band comes after surfaceHeader,
            matching Admin's canonical appBar > surfaceHeader > metrics order. */}
        <div className="flex shrink-0 items-baseline border-b border-vetneb-line/70 px-3 py-1.5 text-xs text-muted-foreground">
          <ModuleMetricRun surfaceId="clinic-logistica-visitas" className="w-full min-w-0 overflow-hidden truncate" metrics={[
            { key: "pendientes", label: "Pendientes", value: visits.filter((visit) => visit.status === "pending").length },
            { key: "programadas", label: "Programadas", value: visits.filter((visit) => visit.status === "scheduled").length },
            { key: "en-curso", label: "En curso", value: visits.filter((visit) => visit.status === "in_progress").length },
            { key: "completadas", label: "Completadas", value: visits.filter((visit) => visit.status === "done").length },
          ]} />
        </div>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <LogisticsBoundedCanvas
            canvas="visitas"
            basePath="/dashboard/logistica/visitas"
            hasExplicitLimit={hasExplicitLimit}
            currentLimit={limit}
            maxLimit={VISITAS_MAX_LIMIT}
            mobileChildren={
              <div
                className="flex min-h-0 w-full min-w-0 flex-1 flex-col divide-y divide-vetneb-line/60 overflow-hidden"
                data-logistics-mobile-list="visitas"
              >
                {visitsLoadError ? (
                  <p role="alert" className="clinical-alert-warning m-3">
                    No se pudieron cargar las visitas de campo. Intente nuevamente.
                  </p>
                ) : visits.length ? (
                  visits.map((visit) => (
                    <CanonicalOperationalRow
                      key={visit.id}
                      dataAttributes={{ "data-logistics-mobile-row": "visita" }}
                      identity={visit.clinicName ?? `Clínica #${visit.clinicId}`}
                      secondary={`${formatDateTime(visit.scheduledAt)} → ${visit.completedAt ? formatDateTime(visit.completedAt) : "—"}`}
                      trailing={
                        <>
                          <StatusBadge status={visit.status} size="sm" />
                          <FieldVisitDetailDialog visit={visit} />
                        </>
                      }
                    />
                  ))
                ) : (
                  <p className="clinical-table-state m-3">
                    No hay visitas de campo disponibles.
                  </p>
                )}
              </div>
            }
            desktopChildren={
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Clínica</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Programada</TableHead>
                <TableHead>Completada</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitsLoadError ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    role="alert"
                    className="clinical-table-state clinical-alert-warning"
                  >
                    No se pudieron cargar las visitas de campo. Intente nuevamente.
                  </TableCell>
                </TableRow>
              ) : visits.length ? (
                visits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{visit.id}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-vetneb-ink/75">
                      {visit.address ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(visit.scheduledAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {visit.completedAt
                        ? formatDateTime(visit.completedAt)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getFieldVisitStatusVariant(visit.status)}>
                        {getFieldVisitStatusLabel(visit.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                      {visit.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="clinical-table-state"
                  >
                    No hay visitas de campo disponibles.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
              </Table>
              </div>
            }
          />
        </CardContent>
        <nav
          aria-label="Paginación de visitas"
          data-dashboard-pager="true"
          data-dashboard-adaptive-reserved-region="pager"
          className="dashboard-pager min-h-10 shrink-0 border-t border-vetneb-line/70"
          style={DASHBOARD_TOUCH_PAGER_RESERVATION}
        >
          <span data-dashboard-pager-prev="true" className="inline-flex">
            <PublicRouteControl
              href={previousHref}
              variant="bare"
              disabled={!canGoPrevious}
              aria-label="Página anterior"
              className="dashboard-pagination-btn inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </PublicRouteControl>
          </span>
          <span data-dashboard-pager-state="true" className="dashboard-pagination-context">
            Página {currentPage}
          </span>
          <span data-dashboard-pager-next="true" className="inline-flex">
            <PublicRouteControl
              href={nextHref}
              variant="bare"
              disabled={!canGoNext}
              aria-label="Página siguiente"
              className="dashboard-pagination-btn inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </PublicRouteControl>
          </span>
        </nav>
      </ModuleCard>
      </ClinicFullRouteModuleStage>
    </ClinicDashboardShell>
  );
}
