"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminSchemaHealth } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { AdminSchemaHealthSnapshot } from "@/types";
import { AdminMobileStatusModule } from "./AdminMobileStatusModule";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export type AdminMobileHealthService = {
  label: string;
  statusLabel: string;
  variant: BadgeVariant;
  detail: string | null;
};

export type AdminMobileHealthRuntimeTile = {
  label: string;
  value: string;
  hint: string | null;
};

type AdminMobileHealthModuleProps = {
  hasError: boolean;
  services: AdminMobileHealthService[];
  runtime: AdminMobileHealthRuntimeTile[];
};

function getSchemaStatusVariant(
  status: AdminSchemaHealthSnapshot["status"],
): BadgeVariant {
  return status === "ok" ? "default" : "secondary";
}

function formatSchemaStatusLabel(status: AdminSchemaHealthSnapshot["status"]) {
  return status === "ok" ? "Esquema compatible" : "Faltan columnas críticas";
}

// Compact, lazy mobile view of the schema-health card (desktop "Esquema" tab).
// Only mounted while the chip is active and only fetches on mobile.
function AdminMobileSchemaSection() {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [snapshot, setSnapshot] = useState<AdminSchemaHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isPending, startTransition] = useTransition();

  function loadSchemaHealth() {
    if (!isMobileViewport) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          setSnapshot(await getAdminSchemaHealth());
        } catch {
          setSnapshot(null);
          setError("No se pudo consultar el estado del esquema.");
        } finally {
          setHasLoadedOnce(true);
        }
      })();
    });
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    loadSchemaHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobileViewport]);

  const summary = snapshot?.summary;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          {snapshot ? (
            <Badge variant={getSchemaStatusVariant(snapshot.status)}>
              {formatSchemaStatusLabel(snapshot.status)}
            </Badge>
          ) : (
            <p className="truncate text-xs font-semibold text-vetneb-ink">
              Estado de esquema
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={loadSchemaHealth}
          disabled={isPending || !isMobileViewport}
          aria-busy={isPending ? true : undefined}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          Reintentar
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          data-admin-mobile-status-item="true"
          className="shrink-0 rounded-md border border-vetneb-line/70 bg-card/92 px-2.5 py-2 text-[0.7rem] text-destructive"
        >
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid shrink-0 grid-cols-2 gap-1.5">
          <SchemaMetric label="Tablas req." value={summary.requiredTables} />
          <SchemaMetric label="Columnas req." value={summary.requiredColumns} />
          <SchemaMetric label="Presentes" value={summary.presentColumns} />
          <SchemaMetric label="Faltantes" value={summary.missingColumns} />
        </div>
      ) : null}

      {snapshot ? (
        <div
          data-admin-mobile-status-item="true"
          className="min-h-0 flex-1 overflow-hidden rounded-md border border-vetneb-line/70 bg-card/92 px-2.5 py-1.5"
        >
          <p className="truncate text-[0.66rem] text-muted-foreground">
            Generado: {formatDateTime(snapshot.generatedAt)}
          </p>
          <p className="mt-0.5 truncate text-[0.66rem] text-muted-foreground">
            Revisado por:{" "}
            {snapshot.checkedBy
              ? `${snapshot.checkedBy.username} #${snapshot.checkedBy.adminUserId}`
              : "—"}
          </p>
          {snapshot.status === "degraded" ? (
            <p className="mt-1 line-clamp-2 text-[0.66rem] text-vetneb-navy">
              {snapshot.missing.length
                ? `${snapshot.missing.length} columna(s) crítica(s) faltante(s).`
                : "Faltan columnas críticas sin detalle."}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">
          {error
            ? "Esquema no disponible."
            : !hasLoadedOnce || isPending
              ? "Consultando estado de esquema..."
              : "Sin datos de esquema."}
        </div>
      )}
    </div>
  );
}

function SchemaMetric({ label, value }: { label: string; value: number }) {
  return (
    <div
      data-admin-mobile-status-item="true"
      className="rounded-md border border-vetneb-line/70 bg-card/95 px-2.5 py-1.5"
    >
      <p className="text-[0.62rem] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold leading-tight text-vetneb-ink">
        {value}
      </p>
    </div>
  );
}

export function AdminMobileHealthModule({
  hasError,
  services,
  runtime,
}: AdminMobileHealthModuleProps) {
  const serviciosSection = (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
      {hasError ? (
        <div
          role="alert"
          data-admin-mobile-status-item="true"
          className="shrink-0 rounded-md border border-vetneb-line/70 bg-card/92 px-2.5 py-2 text-[0.7rem] text-vetneb-navy"
        >
          No se pudo consultar el estado del sistema; valores como desconocidos.
        </div>
      ) : null}
      {/* Service rows fill the band as equal rows so the last (CORS público)
          lands ~one gutter above the bottom nav instead of leaving a void. */}
      <div
        className="grid min-h-0 flex-1 gap-1.5 overflow-hidden"
        style={{ gridTemplateRows: `repeat(${services.length}, minmax(0, 1fr))` }}
      >
        {services.map((service) => (
          <div
            key={service.label}
            data-admin-mobile-status-item="true"
            className="flex min-h-0 items-center justify-between gap-2 overflow-hidden rounded-md border border-vetneb-line/70 bg-card/95 px-2.5 py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-vetneb-ink">
                {service.label}
              </p>
              {service.detail ? (
                <p className="truncate text-[0.66rem] text-muted-foreground">
                  {service.detail}
                </p>
              ) : null}
            </div>
            <Badge
              variant={service.variant}
              className="h-5 shrink-0 px-1.5 text-[10px]"
            >
              {service.statusLabel}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );

  const runtimeSection = (
    // 2×2 tiles fill the band; content vertically centered so the stretched
    // tiles read as intentional cards, last row ~one gutter above the nav.
    <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5 overflow-hidden">
      {runtime.map((tile) => (
        <div
          key={tile.label}
          data-admin-mobile-status-item="true"
          className="flex min-h-0 flex-col justify-center overflow-hidden rounded-md border border-vetneb-line/70 bg-card/95 px-2.5 py-1.5"
        >
          <p className="truncate text-[0.62rem] text-muted-foreground">
            {tile.label}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold leading-tight text-vetneb-ink">
            {tile.value}
          </p>
          {tile.hint ? (
            <p className="truncate text-[0.62rem] text-muted-foreground">
              {tile.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );

  return (
    <AdminMobileStatusModule
      moduleKey="admin-health"
      ariaLabel="Estado del sistema"
      sections={[
        { id: "servicios", label: "Servicios", content: serviciosSection },
        { id: "runtime", label: "Runtime", content: runtimeSection },
        {
          id: "esquema",
          label: "Esquema",
          content: <AdminMobileSchemaSection />,
        },
      ]}
    />
  );
}
