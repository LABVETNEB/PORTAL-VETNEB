"use client";

import { Eye } from "lucide-react";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { Button } from "@/components/ui/button";
import type { AdminAuditRow } from "./AdminAuditDenseTable";

type AdminAuditDetailDialogProps = {
  row: AdminAuditRow;
};

export function AdminAuditDetailDialog({ row }: AdminAuditDetailDialogProps) {
  return (
    <ModuleDialog
      title={`Evento #${row.id}`}
      description={`${row.eventLabel} · ${row.date}`}
      scrollableBody
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          aria-label={`Ver detalle del evento ${row.id}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Ver
        </Button>
      }
    >
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Código
          </dt>
          <dd className="dashboard-detail-value mt-0.5 font-mono text-xs text-vetneb-ink">
            {row.eventCode}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Fecha
          </dt>
          <dd className="dashboard-detail-value mt-0.5 text-vetneb-ink">{row.date}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Actor
          </dt>
          <dd className="dashboard-detail-value mt-0.5 text-vetneb-ink">{row.actor}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Entidad
          </dt>
          <dd className="dashboard-detail-value mt-0.5 text-vetneb-ink">{row.entity}</dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Acción registrada
          </dt>
          <dd className="dashboard-detail-value mt-0.5 text-vetneb-ink">{row.action}</dd>
        </div>
        <div className="min-w-0 rounded-lg border border-vetneb-line/70 bg-muted/25 px-3 py-2 sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Detalle seguro
          </dt>
          <dd className="dashboard-detail-value mt-1 text-xs leading-5 text-vetneb-ink/85">
            {row.detail}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        La vista omite datos de red, sesión, credenciales y metadata estructurada.
      </p>
    </ModuleDialog>
  );
}
