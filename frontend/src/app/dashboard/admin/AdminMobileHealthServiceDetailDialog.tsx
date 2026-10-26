"use client";

import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { DetailsMetadata, DetailsPane } from "@/features/dashboard/presentation/details";
import type { AdminMobileHealthService } from "./AdminMobileHealthModule";

// ─────────────────────────────────────────────────────────────────────────────
// C25 F-T3 · full-value disclosure for a mobile "Estado del sistema" service.
//
// The service rows are equal-height single-line summaries inside a zero-scroll
// band, so a long detail ("Gmail API: … · SMTP: …", the contact recipients)
// truncates below ~412 px. The row's own text opens this read-only C13 detail
// with the values the card already holds: no fetch, no `title`, no value in an
// attribute. The row keeps its geometry; the status badge stays beside it.
// ─────────────────────────────────────────────────────────────────────────────

type AdminMobileHealthServiceDetailDialogProps = {
  service: AdminMobileHealthService;
  detail: string;
};

export function AdminMobileHealthServiceDetailDialog({
  service,
  detail,
}: AdminMobileHealthServiceDetailDialogProps) {
  return (
    <ModuleDialog
      title={service.label}
      description={service.statusLabel}
      scrollableBody
      trigger={
        <button
          type="button"
          data-admin-mobile-health-service-detail="true"
          className="min-w-0 rounded-sm text-left focus-visible:!outline-offset-0"
        >
          <span className="block truncate text-xs font-semibold text-vetneb-ink">
            {service.label}
          </span>{" "}
          <span className="block truncate text-[0.66rem] text-muted-foreground">
            {detail}
          </span>
          <span className="sr-only">, ver detalle del servicio</span>
        </button>
      }
    >
      <DetailsPane label={`Detalle del servicio ${service.label}`}>
        <DetailsMetadata
          items={[
            { id: "service", label: "Servicio", value: service.label },
            { id: "status", label: "Estado", value: service.statusLabel },
            { id: "detail", label: "Detalle", value: detail },
          ]}
        />
        <p className="text-[11px] leading-4 text-muted-foreground">
          Vista de sólo lectura del estado informado por el sistema.
        </p>
      </DetailsPane>
    </ModuleDialog>
  );
}
