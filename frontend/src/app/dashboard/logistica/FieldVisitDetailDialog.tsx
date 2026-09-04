"use client";

import { Eye } from "lucide-react";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import type { FieldVisit } from "@/types";
import { formatDateTime } from "@/lib/utils";

type FieldVisitDetailDialogProps = {
  visit: FieldVisit;
};

/**
 * Detail destination for field-visit fields that do not fit the compact
 * canonical row (id, full schedule range, address, notes). Every field is
 * still visible on the compact row's dense reading, or here — none is
 * dropped.
 */
export function FieldVisitDetailDialog({ visit }: FieldVisitDetailDialogProps) {
  return (
    <ModuleDialog
      title={visit.clinicName ?? `Clínica #${visit.clinicId}`}
      description={`Visita #${visit.id}`}
      scrollableBody
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          aria-label={`Ver detalle de la visita #${visit.id}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Ver
        </Button>
      }
    >
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Estado
          </dt>
          <dd className="dashboard-detail-value mt-0.5">
            <StatusBadge status={visit.status} size="sm" />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Clínica
          </dt>
          <dd className="dashboard-detail-value mt-0.5 text-vetneb-ink">
            {visit.clinicName ?? `Clínica #${visit.clinicId}`}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Programada
          </dt>
          <dd className="dashboard-detail-value mt-0.5 text-vetneb-ink">
            {visit.scheduledAt ? formatDateTime(visit.scheduledAt) : "—"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Completada
          </dt>
          <dd className="dashboard-detail-value mt-0.5 text-vetneb-ink">
            {visit.completedAt ? formatDateTime(visit.completedAt) : "—"}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Dirección
          </dt>
          <dd className="dashboard-detail-value mt-0.5 text-vetneb-ink">
            {visit.address ?? "—"}
          </dd>
        </div>
        <div className="min-w-0 rounded-lg border border-vetneb-line/70 bg-muted/25 px-3 py-2 sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Notas
          </dt>
          <dd className="dashboard-detail-value mt-1 text-xs leading-5 text-vetneb-ink/85">
            {visit.notes ?? "—"}
          </dd>
        </div>
      </dl>
    </ModuleDialog>
  );
}
