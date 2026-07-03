import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
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
import { getRoutePlans } from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";
import {
  getRoutePlanStatusLabel,
  getRoutePlanStatusVariant,
  formatDate,
} from "@/lib/utils";

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
    <>
      <DashboardTopbar
        title="Planes de ruta"
        subtitle="Planificación y gestión de rutas de entrega"
        notifications="clinic"
      />
      <main className="dashboard-main">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              { status: "draft", label: "Borradores" },
              { status: "released", label: "Liberados" },
              { status: "in_progress", label: "En curso" },
              { status: "completed", label: "Completados" },
            ] as const
          ).map(({ status, label }) => {
            const count = routePlans.filter((p) => p.status === status).length;
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
          Conteos calculados sobre la página visible, no sobre el total general de planes de ruta.
        </p>

        <Card className="dashboard-surface">
          <CardHeader>
            <CardTitle className="text-base">
              Planes de ruta ({routePlans.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Mostrando {routePlans.length} planes de ruta · página {currentPage}
              {canGoNext ? " · puede haber más planes de ruta disponibles" : ""}
            </p>
          </CardHeader>
          <CardContent className="p-0">
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
          </CardContent>
          <nav
            aria-label="Paginación de planes de ruta"
            className="flex shrink-0 items-center justify-between gap-2 border-t border-vetneb-line/70 px-4 py-3"
          >
            <PublicRouteControl
              href={previousHref}
              variant="bare"
              disabled={!canGoPrevious}
              aria-label="Página anterior"
              className="dashboard-pagination-btn inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </PublicRouteControl>
            <span className="dashboard-pagination-context">
              Página {currentPage}
            </span>
            <PublicRouteControl
              href={nextHref}
              variant="bare"
              disabled={!canGoNext}
              aria-label="Página siguiente"
              className="dashboard-pagination-btn inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </PublicRouteControl>
          </nav>
        </Card>
      </main>
    </>
  );
}
