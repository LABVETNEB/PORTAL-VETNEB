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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MOCK_AUDIT_ENTRIES } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Administración — Portal VETNEB",
  robots: { index: false, follow: false },
};

const EVENT_LABELS: Record<string, string> = {
  "auth.admin.login.succeeded": "Login admin",
  "auth.clinic.login.succeeded": "Login clínica",
  "report.status.changed": "Estado informe",
  "report.uploaded": "Informe subido",
  "study_tracking.case.created": "Caso creado",
  "study_tracking.case.updated": "Caso actualizado",
  "study_tracking.notification.created": "Notificación",
  "report_access_token.created": "Token creado",
  "report_access_token.revoked": "Token revocado",
  "report.public_accessed": "Acceso público",
};

const ACTOR_LABELS: Record<string, string> = {
  system: "Sistema",
  admin_user: "Admin",
  clinic_user: "Clínica",
  public_report_access_token: "Token público",
};

function getEventVariant(
  event: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (event.includes("login")) return "default";
  if (event.includes("revoked") || event.includes("canceled")) return "destructive";
  if (event.includes("created") || event.includes("uploaded")) return "secondary";
  return "outline";
}

export default function AdminPage() {
  const eventCounts = MOCK_AUDIT_ENTRIES.reduce(
    (acc, entry) => {
      acc[entry.event] = (acc[entry.event] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <>
      <DashboardTopbar
        title="Administración"
        subtitle="Auditoría, reportes y estado operacional"
      />
      <main className="flex-1 p-6 space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700">
          <strong>Mock data:</strong> Se conectará con{" "}
          <code>GET /api/admin/audit-log</code>.
        </div>

        {/* Resumen de estado operacional */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Eventos de auditoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {MOCK_AUDIT_ENTRIES.length}
              </p>
              <p className="text-xs text-gray-400 mt-1">Registros totales</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Tipos de evento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {Object.keys(eventCounts).length}
              </p>
              <p className="text-xs text-gray-400 mt-1">Categorías distintas</p>
            </CardContent>
          </Card>
          <Card className="border-green-50 border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Estado del sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-sm font-semibold text-green-700">
                  Operativo
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Backend + Storage activos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Resumen de eventos por tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen por tipo de evento</CardTitle>
            <CardDescription>
              Distribución de eventos registrados en el log de auditoría
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(eventCounts).map(([event, count]) => (
                <div
                  key={event}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <Badge variant={getEventVariant(event)} className="text-xs">
                    {EVENT_LABELS[event] ?? event}
                  </Badge>
                  <span className="text-sm font-semibold text-gray-700">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Log de auditoría */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Log de auditoría ({MOCK_AUDIT_ENTRIES.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Tipo actor</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_AUDIT_ENTRIES.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs text-gray-400">
                      #{entry.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getEventVariant(entry.event)}>
                        {EVENT_LABELS[entry.event] ?? entry.event}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {entry.actorId ? `#${entry.actorId}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {ACTOR_LABELS[entry.actorType] ?? entry.actorType}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {entry.targetType && entry.targetId
                        ? `${entry.targetType} #${entry.targetId}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-gray-400 text-xs">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
