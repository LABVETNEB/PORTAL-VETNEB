import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";
import { ClinicFullRouteModuleStage } from "@/components/dashboard/ClinicFullRouteModuleStage";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { CanonicalOperationalRow } from "@/components/dashboard/CanonicalOperationalRow";
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
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoutePlans } from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import {
  getRoutePlanStatusLabel,
  getRoutePlanStatusVariant,
  formatDate,
} from "@/lib/utils";
import { LogisticsBoundedCanvas } from "../LogisticsBoundedCanvas";
import { ModuleMetricRun } from "@/components/dashboard/ModuleMetricRun";
import { DASHBOARD_TOUCH_PAGER_RESERVATION } from "@/components/dashboard/DashboardPager";
import { RoutePlanDetailDialog } from "../RoutePlanDetailDialog";

export const metadata: Metadata = {
  title: "Planes de ruta — Portal VETNEB",
  robots: { index: false, follow: false },
};

// Backend default/max (server/routes/logistics-route-plans.fastify.ts:
// parsePositiveInt(request.query.limit, 50, 100)). The endpoint exposes no
// total record count, so pagination relies on the page-full heuristic below
// instead of a computed page count.
const RUTAS_DEFAULT_LIMIT = 50;
const RUTAS_MAX_LIMIT = 100;

type RutasPageSearchParams = {
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
    return RUTAS_DEFAULT_LIMIT;
  }

  return Math.min(parsed, RUTAS_MAX_LIMIT);
}

function buildRutasHref(offset: number, limit: number): string {
  return `/dashboard/logistica/rutas?offset=${offset}&limit=${limit}`;
}

async function getLogisticsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function RutasPage({
  searchParams,
}: {
  searchParams?: Promise<RutasPageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const offset = normalizeOffset(resolvedSearchParams.offset);
  const limit = normalizeLimit(resolvedSearchParams.limit);
  // Adaptive default page size: when the URL carries no explicit limit, the
  // bounded canvas recomputes it from the measured viewport (URL offset/limit
  // stays the single pagination contract).
  const hasExplicitLimit =
    normalizeSearchParamValue(resolvedSearchParams.limit).trim() !== "";

  let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];
  let routePlansLoadError = false;

  try {
    routePlans = await getRoutePlans(
      await getLogisticsRequestOptions(),
      { throwOnError: true },
      { limit, offset },
    );
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    routePlansLoadError = true;
  }

  // No `total` is exposed by the endpoint: page-full is the only signal
  // available, so `canGoNext` may false-positive on an exact-multiple last
  // page — documented tradeoff, not a bug (docs/audit/clinic-logistics-full-routes-adaptive-contract-audit.md).
  const canGoPrevious = !routePlansLoadError && offset > 0;
  const canGoNext = !routePlansLoadError && routePlans.length === limit;
  const currentPage = Math.floor(offset / limit) + 1;
  const previousHref = buildRutasHref(Math.max(0, offset - limit), limit);
  const nextHref = buildRutasHref(offset + limit, limit);

  return (
    <ClinicDashboardShell
      title="Planes de ruta"
      subtitle="Planificación y gestión de rutas de entrega"
      module="logistica"
    >
      <ClinicFullRouteModuleStage moduleId="logistica-rutas">
      <ModuleCard ariaLabel="Planes de ruta" dataAttributes={{ "data-dashboard-table-surface": "true" }}>
        <CardHeader className="shrink-0">
          <CardTitle className="text-base">
            Planes de ruta ({routePlans.length})
          </CardTitle>
          <p
            className="text-sm text-muted-foreground"
            data-dashboard-chrome-secondary="true"
          >
            Mostrando {routePlans.length} planes de ruta · página {currentPage}
            {canGoNext ? " · puede haber más planes de ruta disponibles" : ""}
          </p>
          <p className="text-xs text-muted-foreground">Conteos calculados sobre la página visible, no sobre el total general de planes de ruta.</p>
        </CardHeader>
        {/* CMP-11 (DIF-042/G-014): metrics band comes after surfaceHeader,
            matching Admin's canonical appBar > surfaceHeader > metrics order. */}
        <div className="flex shrink-0 items-baseline border-b border-vetneb-line/70 px-3 py-1.5 text-xs text-muted-foreground">
          <ModuleMetricRun surfaceId="clinic-logistica-rutas" className="w-full min-w-0 overflow-hidden truncate" metrics={[
            { key: "borradores", label: "Borradores", value: routePlans.filter((plan) => plan.status === "draft").length },
            { key: "liberadas", label: "Liberadas", value: routePlans.filter((plan) => plan.status === "released").length },
            { key: "en-curso", label: "En curso", value: routePlans.filter((plan) => plan.status === "in_progress").length },
            { key: "completadas", label: "Completadas", value: routePlans.filter((plan) => plan.status === "completed").length },
          ]} />
        </div>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <LogisticsBoundedCanvas
            canvas="rutas"
            basePath="/dashboard/logistica/rutas"
            hasExplicitLimit={hasExplicitLimit}
            currentLimit={limit}
            maxLimit={RUTAS_MAX_LIMIT}
            mobileChildren={
              <div
                className="flex min-h-0 w-full min-w-0 flex-1 flex-col divide-y divide-vetneb-line/60 overflow-hidden"
                data-logistics-mobile-list="rutas"
              >
                {routePlansLoadError ? (
                  <p role="alert" className="clinical-alert-warning m-3">
                    No se pudieron cargar los planes de ruta. Intente nuevamente.
                  </p>
                ) : routePlans.length ? (
                  routePlans.map((plan) => {
                    const progress =
                      plan.totalStops > 0
                        ? Math.round(
                            (plan.completedStops / plan.totalStops) * 100,
                          )
                        : 0;
                    return (
                      <CanonicalOperationalRow
                        key={plan.id}
                        dataAttributes={{ "data-logistics-mobile-row": "ruta" }}
                        identity={plan.name}
                        secondary={`${formatDate(plan.plannedDate)} · ${plan.completedStops}/${plan.totalStops} paradas · ${progress}%`}
                        trailing={
                          <>
                            <Badge variant={getRoutePlanStatusVariant(plan.status)}>
                              {getRoutePlanStatusLabel(plan.status)}
                            </Badge>
                            <RoutePlanDetailDialog plan={plan} />
                          </>
                        }
                      />
                    );
                  })
                ) : (
                  <p className="clinical-table-state m-3">
                    No hay planes de ruta disponibles.
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
                <TableHead>Nombre</TableHead>
                <TableHead>Fecha planificada</TableHead>
                <TableHead>Paradas</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routePlansLoadError ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    role="alert"
                    className="clinical-table-state clinical-alert-warning"
                  >
                    No se pudieron cargar los planes de ruta. Intente nuevamente.
                  </TableCell>
                </TableRow>
              ) : routePlans.length ? (
                routePlans.map((plan) => {
                  const progress =
                    plan.totalStops > 0
                      ? Math.round(
                          (plan.completedStops / plan.totalStops) * 100,
                        )
                      : 0;
                  return (
                    <TableRow key={plan.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{plan.id}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {plan.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(plan.plannedDate)}
                      </TableCell>
                      <TableCell className="text-sm text-vetneb-ink/75">
                        {plan.completedStops}/{plan.totalStops}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="clinical-progress h-1.5 max-w-[80px] flex-1">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${progress}%` }}
                              role="progressbar"
                              aria-valuenow={progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoutePlanStatusVariant(plan.status)}>
                          {getRoutePlanStatusLabel(plan.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="clinical-table-state"
                  >
                    No hay planes de ruta disponibles.
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
          aria-label="Paginación de planes de ruta"
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
