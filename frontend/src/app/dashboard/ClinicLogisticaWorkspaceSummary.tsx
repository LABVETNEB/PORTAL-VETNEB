"use client";

import { useState } from "react";
import type { FieldVisit } from "@/types";
import { Route as RouteIcon, ExternalLink } from "lucide-react";
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { DashboardPager } from "@/components/dashboard/DashboardPager";
import { DashboardRefreshButton } from "@/components/dashboard/DashboardRefreshButton";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { ModuleMetricRun } from "@/components/dashboard/ModuleMetricRun";
import { usePagedRows } from "@/components/dashboard/usePagedRows";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ROUTES } from "@/lib/routes";
import { formatDate } from "@/lib/utils";

type Props = {
  recentVisits: FieldVisit[];
  visitsLoadError: boolean;
};

const VISITS_PAGE_SIZE = 3;

export function ClinicLogisticaWorkspaceSummary({
  recentVisits,
  visitsLoadError,
}: Props) {
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [visitsListBodyNode, setVisitsListBodyNode] =
    useState<HTMLDivElement | null>(null);

  // Adaptive density: the visible row count derives from the bounded list
  // canvas (390x844 fits fewer rows than 1440x900); the fixed page size is
  // only the pre-measurement fallback. The pitch is a CSS token, so probing the
  // rendered rows for it — which made the page size depend on the slice, and
  // the slice on the page size — is neither needed nor possible here.
  const { capacity: rowsPerPage } = useDashboardCanvasCapacity({
    canvasNode: visitsListBodyNode,
    fallbackItems: VISITS_PAGE_SIZE,
    minItems: 2,
  });

  const pagedVisits = usePagedRows(recentVisits, rowsPerPage);


  const selectedVisit =
    selectedVisitId === null
      ? null
      : (recentVisits.find((visit) => visit.id === selectedVisitId) ?? null);

  const fullModuleLink = (
    <PublicRouteControl
      href={ROUTES.dashboardLogistica}
      variant="bare"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-vetneb-teal/45 bg-vetneb-teal/10 px-2.5 text-xs font-semibold text-vetneb-teal transition-colors hover:bg-vetneb-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
      aria-label="Abrir módulo completo de logística"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      Abrir módulo completo
    </PublicRouteControl>
  );

  return (
    <ModuleCard
      ariaLabel="Visitas de campo recientes de la clínica"
      dataAttributes={{ "data-clinic-mobile-module": "logistica" }}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-vetneb-line/70 p-1.5">
        {/* Desktop-only below: the host stays because it carries "Abrir módulo
            completo", and retiring just the run returns the wrapped 16px line
            plus the 8px flex row-gap to that action. */}
        <ModuleMetricRun
          className="hidden md:flex"
          surfaceId="clinic-logistica-workspace"
          metrics={[
            { key: "visitas", label: "Visitas", value: recentVisits.length },
            { key: "activas", label: "Activas", value: recentVisits.filter((visit) => visit.status === "in_progress").length },
            { key: "completadas", label: "Completadas", value: recentVisits.filter((visit) => visit.status === "done").length },
          ]}
        />
        {fullModuleLink}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
      {visitsLoadError ? (
        <div
          role="alert"
          className="clinical-alert-warning flex flex-wrap items-center justify-between gap-2"
        >
          <span>No se pudieron cargar las visitas de campo. Intente nuevamente.</span>
          <DashboardRefreshButton />
        </div>
      ) : recentVisits.length ? (
        <div
          data-clinic-logistics-list-panel="true"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/75 bg-card/82"
        >
          <div
            ref={setVisitsListBodyNode}
            data-clinic-logistics-list-body="true"
            data-dashboard-adaptive-rows-canvas="true"
            // Two-line grammar: clinic name (14/20) over scheduled date
            // (12/16) plus `py-2` — the row's natural height is 52px, exactly
            // the `tall` tier. `regular` (44px, 40px short) locked the row
            // below its own content and `overflow: hidden` clipped the date
            // line: measured on all eight viewports, visibly cut at 360x740.
            data-dashboard-row-pitch="tall"
            className="flex min-h-0 flex-1 flex-col divide-y divide-vetneb-line/60 overflow-hidden"
          >
            {pagedVisits.pageItems.map((visit) => (
              <button
                key={visit.id}
                type="button"
                data-clinic-logistics-row="true"
                data-dashboard-adaptive-row="true"
                onClick={() => setSelectedVisitId(visit.id)}
                aria-haspopup="dialog"
                aria-label={`Ver detalle de la visita en ${
                  visit.clinicName ?? `Clínica #${visit.clinicId}`
                }`}
                className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-vetneb-cyan/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-inset"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-vetneb-ink">
                    {visit.clinicName ?? `Clínica #${visit.clinicId}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(visit.scheduledAt)}
                  </p>
                </div>
                <StatusBadge status={visit.status} size="sm" className="shrink-0" />
              </button>
            ))}
          </div>

          {/* CMP-12: no border/reservation on this outer wrapper — DashboardPager
              already carries both on its own nav (border-box makes the reserved
              height inclusive of the border); duplicating either here would add
              a pixel on top of the reservation or create a second matching hook. */}
          <div
            data-clinic-logistics-pagination-footer="true"
            className="flex shrink-0 items-center justify-center px-3 text-xs text-muted-foreground"
          >
            <DashboardPager
              className="w-full border-t border-vetneb-line/65"
              aria-label="Paginación de visitas recientes"
              page={pagedVisits.page}
              pageCount={pagedVisits.pageCount}
              hasPrev={pagedVisits.hasPrev}
              hasNext={pagedVisits.hasNext}
              onPrev={() => {
                setSelectedVisitId(null);
                pagedVisits.goPrev();
              }}
              onNext={() => {
                setSelectedVisitId(null);
                pagedVisits.goNext();
              }}
              rangeLabel={
                pagedVisits.total > 0
                  ? `${pagedVisits.rangeStart}–${pagedVisits.rangeEnd} de ${pagedVisits.total}`
                  : undefined
              }
            />
          </div>
        </div>
      ) : (
        <EmptyState
          title="Sin visitas recientes"
          description="No hay visitas de campo recientes disponibles."
          icon={RouteIcon}
        />
      )}

      {selectedVisit ? (
        <ModuleDialog
          open={selectedVisit !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedVisitId(null);
            }
          }}
          title={selectedVisit.clinicName ?? `Clínica #${selectedVisit.clinicId}`}
          description="Detalle de la visita de campo programada."
        >
          <div
            data-clinic-logistics-detail-dialog="true"
            className="flex min-h-0 flex-col gap-3 text-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.6875rem] text-muted-foreground">Clínica</p>
                <p className="break-words text-sm font-semibold text-vetneb-ink">
                  {selectedVisit.clinicName ?? `Clínica #${selectedVisit.clinicId}`}
                </p>
              </div>
              <StatusBadge
                status={selectedVisit.status}
                size="sm"
                className="shrink-0"
              />
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-vetneb-line/70 px-3 py-2">
              <div>
                <dt className="text-[0.6875rem] text-muted-foreground">Programada</dt>
                <dd className="font-medium">{formatDate(selectedVisit.scheduledAt)}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] text-muted-foreground">Completada</dt>
                <dd className="text-muted-foreground">
                  {selectedVisit.completedAt
                    ? formatDate(selectedVisit.completedAt)
                    : "—"}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[0.6875rem] text-muted-foreground">Dirección</dt>
                <dd className="break-words">
                  {selectedVisit.address ?? "Sin dirección registrada"}
                </dd>
              </div>
            </dl>

            <PublicRouteControl
              href={ROUTES.dashboardLogisticaVisitas}
              variant="textLink"
              className="text-xs"
              aria-label="Abrir visitas de campo en el módulo completo"
            >
              Abrir visitas en módulo completo
            </PublicRouteControl>
          </div>
        </ModuleDialog>
      ) : null}
      </div>
    </ModuleCard>
  );
}
