"use client";

import { useState } from "react";
import type { FieldVisit } from "@/types";
import { ArrowLeft, Route as RouteIcon, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ModuleSurface } from "@/components/dashboard/ModuleSurface";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  recentVisits: FieldVisit[];
  visitsLoadError: boolean;
};

export function ClinicLogisticaWorkspaceSummary({
  recentVisits,
  visitsLoadError,
}: Props) {
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(
    recentVisits[0]?.id ?? null,
  );
  // Mobile/tablet replacement layer: detail covers the list (no vertical stack).
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  const selectedVisit =
    recentVisits.find((visit) => visit.id === selectedVisitId) ??
    recentVisits[0] ??
    null;

  function selectVisit(visitId: number) {
    setSelectedVisitId(visitId);
    setIsMobileDetailOpen(true);
  }

  const fullModuleLink = (
    <PublicRouteControl
      href={ROUTES.dashboardLogistica}
      variant="bare"
      className="inline-flex h-9 items-center gap-2 rounded-md border border-vetneb-teal/45 bg-vetneb-teal/10 px-3 text-sm font-semibold text-vetneb-teal transition-colors hover:bg-vetneb-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
      aria-label="Abrir módulo completo de logística"
    >
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      Ver módulo de logística completo
    </PublicRouteControl>
  );

  return (
    <ModuleSurface
      ariaLabel="Visitas de campo recientes de la clínica"
      toolbar={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-vetneb-ink">
              Visitas de campo recientes
            </h3>
            <p className="text-xs text-muted-foreground">
              Programación logística activa. Para gestión completa use el módulo de logística.
            </p>
          </div>
          {fullModuleLink}
        </div>
      }
    >
      {visitsLoadError ? (
        <p role="alert" className="clinical-alert-warning">
          No se pudieron cargar las visitas de campo. Intente nuevamente.
        </p>
      ) : recentVisits.length ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[0.85fr_1.15fr]">
          <div
            className={cn(
              "flex min-h-0 flex-col overflow-hidden rounded-lg border border-vetneb-line/75 bg-card/82",
              isMobileDetailOpen && "hidden xl:flex",
            )}
          >
            <div className="min-h-0 flex-1 divide-y divide-vetneb-line/60 overflow-hidden">
              {recentVisits.map((visit) => {
                const isSelected = selectedVisit?.id === visit.id;

                return (
                  <button
                    key={visit.id}
                    type="button"
                    onClick={() => selectVisit(visit.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-vetneb-cyan/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-inset",
                      isSelected && "bg-vetneb-cyan/12",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-vetneb-ink">
                        {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(visit.scheduledAt)}
                      </p>
                    </div>
                    <StatusBadge status={visit.status} size="sm" className="ml-2 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "min-h-0 overflow-hidden rounded-lg border border-vetneb-line/75 bg-card/82 p-4",
              !isMobileDetailOpen && "hidden xl:block",
            )}
          >
            {selectedVisit ? (
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="xl:hidden"
                  onClick={() => setIsMobileDetailOpen(false)}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Volver a la lista
                </Button>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Detalle de la visita
                    </p>
                    <h4 className="mt-1 truncate text-lg font-semibold text-vetneb-ink">
                      {selectedVisit.clinicName ?? `Clínica #${selectedVisit.clinicId}`}
                    </h4>
                  </div>
                  <StatusBadge status={selectedVisit.status} size="sm" className="shrink-0" />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="clinical-muted-band rounded-lg px-3 py-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                      Programada
                    </p>
                    <p className="mt-1 text-xs text-vetneb-ink">
                      {formatDate(selectedVisit.scheduledAt)}
                    </p>
                  </div>
                  <div className="clinical-muted-band rounded-lg px-3 py-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                      Completada
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedVisit.completedAt ? formatDate(selectedVisit.completedAt) : "—"}
                    </p>
                  </div>
                  <div className="clinical-muted-band rounded-lg px-3 py-2 sm:col-span-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                      Dirección
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {selectedVisit.address ?? "Sin dirección registrada"}
                    </p>
                  </div>
                  <div className="clinical-muted-band rounded-lg px-3 py-2 sm:col-span-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-vetneb-navy">
                      Acción
                    </p>
                    <PublicRouteControl
                      href={ROUTES.dashboardLogisticaVisitas}
                      variant="textLink"
                      className="mt-1 inline-flex text-xs font-semibold text-vetneb-navy hover:text-vetneb-teal"
                      aria-label="Abrir visitas de campo en el módulo completo"
                    >
                      Abrir visitas en módulo completo
                    </PublicRouteControl>
                  </div>
                </div>
              </div>
            ) : (
              <p className="surface-empty">Seleccione una visita para ver el detalle.</p>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Sin visitas recientes"
          description="No hay visitas de campo recientes disponibles."
          icon={RouteIcon}
        />
      )}
    </ModuleSurface>
  );
}
