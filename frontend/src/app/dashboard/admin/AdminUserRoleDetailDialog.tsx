"use client";

import { Eye } from "lucide-react";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { Button } from "@/components/ui/button";
import { DetailsMetadata, DetailsPane } from "@/features/dashboard/presentation/details";
import { formatDateTime } from "@/lib/utils";
import type { AdminRoleUserSummary } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// PR-TRUNC · full-value disclosure for a users/roles record.
//
// The row legitimately truncates `username` and the clinic name: the table is a
// pitch-locked adaptive canvas (`row-pitch="compact"`; `td { block-size:
// var(--dash-row-pitch); overflow: hidden }`), so wrapping either value in the
// cell would trade a horizontal ellipsis for a VERTICAL clip and move the
// adaptive row capacity (A03).
//
// What was missing is the other half of the SAFE_TRUNCATION contract. The card
// shipped with a `title` attribute as its only mitigation, and `title` is not an
// accessible disclosure: hover-only in practice, unreliable for assistive
// technology, invisible to touch, and not selectable for copy. This dialog is
// the same mechanism the admin audit and failed-login tables already use — a
// real, keyboard-reachable, screen-reader announced terminal surface.
//
// STRICTLY READ-ONLY. Role changes stay where they already are (the "Cambiar
// rol" control in the same action cell); this surface renders the record and
// nothing else. It adds no fetching and no business logic: every value comes
// from the row the card already holds, and the labels are resolved by the card
// and passed in, exactly like AdminFailedLoginDetailDialog does.
//
// Being a terminal surface, nothing here may hide a value: every datum uses
// `.dashboard-detail-value` (wrap + `overflow-wrap: anywhere`, no clipping) and
// the census in test/architecture/dashboard-truncation-integrity.test.ts pins
// it.
// ─────────────────────────────────────────────────────────────────────────────

type AdminUserRoleDetailDialogProps = {
  user: AdminRoleUserSummary;
  /** Rendered label for the user type, resolved by the parent card. */
  userTypeLabel: string;
  /** Rendered label for the role, resolved by the parent card. */
  roleLabel: string;
  /** Clinic name as the row shows it, already falling back per user type. */
  clinicLabel: string;
  /** Optional clinic metadata line the row renders under the clinic name. */
  clinicMetadata: string | null;
};

export function AdminUserRoleDetailDialog({
  user,
  userTypeLabel,
  roleLabel,
  clinicLabel,
  clinicMetadata,
}: AdminUserRoleDetailDialogProps) {
  return (
    <ModuleDialog
      title={`Usuario #${user.userId}`}
      description={`${userTypeLabel} · ${roleLabel}`}
      scrollableBody
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={`Ver detalle del usuario ${user.username}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      }
    >
      <DetailsPane label={`Detalle del usuario ${user.userId}`}>
        <DetailsMetadata
          items={[
            { id: "username", label: "Usuario", value: user.username },
            { id: "clinic", label: "Clínica", value: clinicLabel },
            ...(clinicMetadata
              ? [{ id: "clinic-metadata", label: "Datos de clínica", value: clinicMetadata }]
              : []),
            { id: "user-type", label: "Tipo", value: userTypeLabel },
            { id: "role", label: "Rol", value: roleLabel },
            { id: "created", label: "Creado", value: formatDateTime(user.createdAt) },
            { id: "updated", label: "Actualizado", value: formatDateTime(user.updatedAt) },
          ]}
        />
        <p className="text-[11px] leading-4 text-muted-foreground">
          Vista de sólo lectura. El cambio de rol se realiza desde la acción de la
          fila.
        </p>
      </DetailsPane>
    </ModuleDialog>
  );
}
