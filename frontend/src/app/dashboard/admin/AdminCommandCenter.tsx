import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type AdminCommandCenterProps = {
  auditEntriesCount: number;
  eventTypesCount: number;
  systemStatusLabel: string;
  systemStatusVariant: BadgeVariant;
  systemStatusIndicatorClass: string;
  systemStatusDetail: string;
  hasSystemHealthFetchError: boolean;
};

export function AdminCommandCenter({
  auditEntriesCount,
  eventTypesCount,
  systemStatusLabel,
  systemStatusVariant,
  systemStatusIndicatorClass,
  systemStatusDetail,
  hasSystemHealthFetchError,
}: AdminCommandCenterProps) {
  return (
    <section
      className="space-y-5"
      aria-labelledby="admin-command-center-heading"
    >
      <div>
        <h2
          id="admin-command-center-heading"
          className="dashboard-section-heading"
        >
          Resumen operativo
        </h2>
        <p className="dashboard-section-description">
          Lectura inmediata de auditoría, variedad de eventos y salud del sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="dashboard-surface h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Eventos de auditoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-vetneb-ink">
              {auditEntriesCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Registros totales
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-surface h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Tipos de evento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-vetneb-ink">
              {eventTypesCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Categorías distintas
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-surface h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Estado del sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span
                className={cn("h-2.5 w-2.5 rounded-full", systemStatusIndicatorClass)}
                aria-hidden="true"
              />
              <Badge variant={systemStatusVariant}>
                {systemStatusLabel}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {hasSystemHealthFetchError
                ? "No se pudo consultar el estado del sistema."
                : systemStatusDetail}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="dashboard-surface">
        <CardHeader>
          <CardTitle className="text-base">Alertas</CardTitle>
          <CardDescription>
            Seguridad y salud operativa quedan priorizadas antes de las secciones secundarias.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="surface-soft">
            <p className="text-sm font-semibold text-vetneb-ink">
              Intentos fallidos de login
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Revisar actividad de acceso antes de cambios administrativos.
            </p>
          </div>
          <div className="surface-soft">
            <p className="text-sm font-semibold text-vetneb-ink">
              Sistema
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Consultar salud, esquema y mantenimiento agrupados.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
