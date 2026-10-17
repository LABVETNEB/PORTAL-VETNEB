"use client";

import { Eye } from "lucide-react";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { Button } from "@/components/ui/button";
import { DetailsMetadata, DetailsPane } from "@/features/dashboard/presentation/details";
import { formatDateTime } from "@/lib/utils";
import type { AdminFailedLoginAlertSummary } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// PR-TRUNC · full-value disclosure for a failed-login attempt.
//
// The desktop row renders `userAgent` in a `max-w-xs truncate` cell, and the
// mobile row does not render it at all. That table is a pitch-locked adaptive
// canvas (`row-pitch="compact"`; `td { block-size: var(--dash-row-pitch);
// overflow: hidden }`), so letting a ~130-character user agent wrap in the cell
// would trade a horizontal ellipsis for a VERTICAL clip and move the adaptive
// row capacity (A03) — the truncation in the ROW is legitimate.
//
// What was missing is the other half of the SAFE_TRUNCATION contract: a clear,
// accessible way to read the whole value. A `title` attribute is not that — it
// is hover-only in practice, unreliable for assistive technology and invisible
// to touch. This dialog is the same mechanism the admin audit table already
// uses (`AdminAuditDetailDialog`): a real, keyboard-reachable, screen-reader
// announced terminal surface that renders every field of the record in full.
//
// Being a terminal surface, nothing here may hide a value: every datum uses
// `.dashboard-detail-value` (wrap + `overflow-wrap: anywhere`, no clipping),
// and the census in test/architecture/dashboard-truncation-integrity.test.ts
// pins it.
// ─────────────────────────────────────────────────────────────────────────────

type AdminFailedLoginDetailDialogProps = {
  alert: AdminFailedLoginAlertSummary;
  /** Rendered label for the alert surface, resolved by the parent card. */
  surfaceLabel: string;
  /** Rendered label for the alert reason, resolved by the parent card. */
  reasonLabel: string;
};

export function AdminFailedLoginDetailDialog({
  alert,
  surfaceLabel,
  reasonLabel,
}: AdminFailedLoginDetailDialogProps) {
  return (
    <ModuleDialog
      title={`Intento fallido #${alert.id}`}
      description={`${surfaceLabel} · ${reasonLabel}`}
      scrollableBody
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          aria-label={`Ver detalle del intento fallido ${alert.id}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Ver
        </Button>
      }
    >
      <DetailsPane label={`Detalle del intento fallido ${alert.id}`}>
        <DetailsMetadata
          items={[
            { id: "surface", label: "Superficie", value: surfaceLabel },
            { id: "date", label: "Fecha", value: formatDateTime(alert.createdAt) },
            { id: "username", label: "Usuario", value: alert.username?.trim() ? alert.username : null },
            { id: "reason", label: "Motivo", value: reasonLabel },
            { id: "ip", label: "IP", value: alert.ipAddress, mono: true },
            { id: "id", label: "Identificador", value: `#${alert.id}`, mono: true },
            { id: "user-agent", label: "User agent", value: alert.userAgent, mono: true },
          ]}
        />
        <p className="text-[11px] leading-4 text-muted-foreground">
          La vista omite credenciales, cookies y metadata de sesión.
        </p>
      </DetailsPane>
    </ModuleDialog>
  );
}
