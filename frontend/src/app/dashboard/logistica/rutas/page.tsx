import type { Metadata } from "next";
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
import { MOCK_ROUTE_PLANS } from "@/lib/mock-data";
import {
  getRoutePlanStatusLabel,
  getRoutePlanStatusVariant,
  formatDate,
} from "@/lib/utils";

export const metadata: Metadata = {
  title: "Planes de ruta — Portal VETNEB",
  robots: { index: false, follow: false },
};

export default function RutasPage() {
  return (
    <>
      <DashboardTopbar
        title="Planes de ruta"
        subtitle="Planificación y gestión de rutas de entrega"
      />
      <main className="flex-1 p-6 space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700">
          <strong>Mock data:</strong> Se conectará con{" "}
          <code>GET /api/logistics/route-plans</code>.
        </div>

        {/* Resumen por estado */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              { status: "draft", label: "Borradores" },
              { status: "released", label: "Liberados" },
              { status: "in_progress", label: "En curso" },
              { status: "completed", label: "Completados" },
            ] as const
          ).map(({ status, label }) => {
            const count = MOCK_ROUTE_PLANS.filter(
              (p) => p.status === status,
            ).length;
            return (
              <Card key={status} className="border-gray-100">
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Planes de ruta ({MOCK_ROUTE_PLANS.length})
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
                {MOCK_ROUTE_PLANS.map((plan) => {
                  const progress =
                    plan.totalStops > 0
                      ? Math.round(
                          (plan.completedStops / plan.totalStops) * 100,
                        )
                      : 0;
                  return (
                    <TableRow key={plan.id}>
                      <TableCell className="font-mono text-xs text-gray-400">
                        #{plan.id}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {plan.name}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {formatDate(plan.plannedDate)}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {plan.completedStops}/{plan.totalStops}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                              role="progressbar"
                              aria-valuenow={progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
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
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
