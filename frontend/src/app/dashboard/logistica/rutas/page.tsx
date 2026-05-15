import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
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
import {
  getRoutePlanStatusLabel,
  getRoutePlanStatusVariant,
  formatDate,
} from "@/lib/utils";

export const metadata: Metadata = {
  title: "Planes de ruta — Portal VETNEB",
  robots: { index: false, follow: false },
};

async function getLogisticsRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export default async function RutasPage() {
  let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];
  let routePlansLoadError = false;

  try {
    routePlans = await getRoutePlans(await getLogisticsRequestOptions(), {
      throwOnError: true,
    });
  } catch {
    routePlansLoadError = true;
  }

  return (
    <>
      <DashboardTopbar
        title="Planes de ruta"
        subtitle="Planificación y gestión de rutas de entrega"
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

        <Card className="dashboard-surface">
          <CardHeader>
            <CardTitle className="text-base">
              Planes de ruta ({routePlans.length})
            </CardTitle>
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
        </Card>
      </main>
    </>
  );
}
