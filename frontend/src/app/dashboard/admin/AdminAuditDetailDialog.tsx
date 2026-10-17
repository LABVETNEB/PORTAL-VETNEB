"use client";

import { Eye } from "lucide-react";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { Button } from "@/components/ui/button";
import { DetailsMetadata, DetailsPane } from "@/features/dashboard/presentation/details";
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
      <DetailsPane label={`Detalle del evento ${row.id}`}>
        <DetailsMetadata
          items={[
            { id: "code", label: "Código", value: row.eventCode, mono: true },
            { id: "date", label: "Fecha", value: row.date },
            { id: "actor", label: "Actor", value: row.actor },
            { id: "entity", label: "Entidad", value: row.entity },
            { id: "action", label: "Acción registrada", value: row.action },
            { id: "safe-detail", label: "Detalle seguro", value: row.detail },
          ]}
        />
        <p className="text-[11px] leading-4 text-muted-foreground">
          La vista omite datos de red, sesión, credenciales y metadata estructurada.
        </p>
      </DetailsPane>
    </ModuleDialog>
  );
}
