import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLogisticsFieldVisits } from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import {
  getFieldVisitStatusLabel,
  getFieldVisitStatusVariant,
  formatDateTime,
} from "@/lib/utils";
import { LogisticsBoundedCanvas } from "../LogisticsBoundedCanvas";

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
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        data-dashboard-metric-strip="true"
      >
        {(
          [
            { status: "pending", label: "Pendientes" },
            { status: "scheduled", label: "Programadas" },
            { status: "in_progress", label: "En curso" },
            { status: "done", label: "Completadas" },
          ] as const
        ).map(({ status, label }) => {
          const count = visits.filter((v) => v.status === status).length;
          return (
            <Card key={status} className="dashboard-metric-card p-0">
              <CardContent className="pt-4">
                <p className="text-2xl font-bold text-vetneb-ink">{count}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Conteos calculados sobre la página visible, no sobre el total general de visitas.
      </p>

      <Card className="dashboard-surface" data-dashboard-table-surface="true">
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
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <LogisticsBoundedCanvas
            canvas="visitas"
            basePath="/dashboard/logistica/visitas"
            hasExplicitLimit={hasExplicitLimit}
            currentLimit={limit}
            maxLimit={VISITAS_MAX_LIMIT}
          >
            {/* Mobile row variant (<= md): no horizontal table scroll. */}
            <div
              className="flex min-h-0 flex-1 flex-col divide-y divide-vetneb-line/60 overflow-hidden md:hidden"
              data-logistics-mobile-list="visitas"
            >
              {visitsLoadError ? (
                <p role="alert" className="clinical-alert-warning m-3">
                  No se pudieron cargar las visitas de campo. Intente nuevamente.
                </p>
              ) : visits.length ? (
                visits.map((visit) => (
                  <div
                    key={visit.id}
                    data-logistics-mobile-row="visita"
                    className="grid w-full min-w-0 max-w-full shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden px-3 py-2"
                  >
                    <div className="min-w-0 max-w-full overflow-hidden">
                      <p className="block min-w-0 max-w-full overflow-hidden text-sm font-semibold text-vetneb-ink [overflow-wrap:anywhere]">
                        {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                      </p>
                      <p className="block min-w-0 max-w-full overflow-hidden text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {formatDateTime(visit.scheduledAt)}
                        {" → "}
                        {visit.completedAt
                          ? formatDateTime(visit.completedAt)
                          : "—"}
                      </p>
                      <p className="block min-w-0 max-w-full overflow-hidden text-[0.6875rem] leading-tight text-muted-foreground [overflow-wrap:anywhere]">
                        {visit.address ?? "—"} · {visit.notes ?? "—"}
                      </p>
                    </div>
                    <Badge
                      variant={getFieldVisitStatusVariant(visit.status)}
                      className="shrink-0"
                    >
                      {getFieldVisitStatusLabel(visit.status)}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="clinical-table-state m-3">
                  No hay visitas de campo disponibles.
                </p>
              )}
            </div>

            {/* Desktop table (>= md) with locked column geometry. */}
            <div className="hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
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
          </LogisticsBoundedCanvas>
        </CardContent>
        <nav
          aria-label="Paginación de visitas"
          data-dashboard-pager="true"
          data-dashboard-adaptive-reserved-region="pager"
          className="dashboard-pager shrink-0 border-t border-vetneb-line/70"
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
      </Card>
    </ClinicDashboardShell>
  );
}
