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
      className="space-y-4"
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

      <div
        className="overflow-hidden rounded-lg border border-vetneb-line/80 bg-card/95 shadow-[0_12px_34px_rgba(15,45,62,0.08)] ring-1 ring-white/55 transition-[border-color,box-shadow,background-color] duration-200 hover:border-vetneb-teal/35"
        role="region"
        aria-label="Métricas de auditoría"
      >
        <div className="grid grid-cols-1 divide-y divide-vetneb-line/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Eventos de auditoría
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-vetneb-ink">
              {auditEntriesCount}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Registros totales</p>
          </div>

          <div className="px-5 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Tipos de evento
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-vetneb-ink">
              {eventTypesCount}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Categorías distintas</p>
          </div>

          <div className="px-5 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Estado del sistema
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={cn("h-2.5 w-2.5 rounded-full", systemStatusIndicatorClass)}
                aria-hidden="true"
              />
              <Badge variant={systemStatusVariant}>
                {systemStatusLabel}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hasSystemHealthFetchError
                ? "No se pudo consultar el estado del sistema."
                : systemStatusDetail}
            </p>
          </div>
        </div>
      </div>

      <Card className="dashboard-surface">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">Alertas</CardTitle>
          <CardDescription>
            Seguridad y salud operativa quedan priorizadas antes de las secciones secundarias.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 pb-4 md:grid-cols-2">
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
