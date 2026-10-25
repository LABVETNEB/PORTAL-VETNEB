"use client";

import type { ReactNode } from "react";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { DetailsMetadata, DetailsPane } from "@/features/dashboard/presentation/details";
import { formatDateTime } from "@/lib/utils";
import type { AdminSessionSummary } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// C25 F-T2 · full-value disclosure for an administrative session record.
//
// The sessions table is pitch-locked (`row-pitch="compact"`) and the mobile
// list row is a single-line summary, so the session id, the actor type and the
// actor id truncate (at 768 px the "Particular" badge leaves the id 0 px), and
// Creada/Expira are hidden below lg/xl. This read-only C13 dialog is the
// terminal surface for every one of them, opened from the row's own identity
// line (badges + id), which is never 0 px wide. No extra column, no `title`.
//
// Only the AdminSessionSummary fields the card already holds are rendered; no
// fetching, and no token, cookie or hash exists in that contract to leak.
// Revocation stays in the row's own action.
// ─────────────────────────────────────────────────────────────────────────────

type AdminSessionDetailDialogProps = {
  session: AdminSessionSummary;
  /** Labels resolved by the parent card, exactly as the row renders them. */
  sessionTypeLabel: string;
  actorTypeLabel: string;
  statusLabel: string;
  isCurrentAdminSession: boolean;
  /** The row's visible identity text; the accessible name starts with it (G11-e). */
  triggerText: string;
  triggerClassName: string;
  /** The row's own identity content (phrasing only: it renders inside a button). */
  children: ReactNode;
};

function formatOptionalDateTime(value: string | null) {
  return value ? formatDateTime(value) : null;
}

export function AdminSessionDetailDialog({
  session,
  sessionTypeLabel,
  actorTypeLabel,
  statusLabel,
  isCurrentAdminSession,
  triggerText,
  triggerClassName,
  children,
}: AdminSessionDetailDialogProps) {
  // Rendered as the visible Dialog.Title text, not as an HTML attribute.
  const heading = `Sesión ${sessionTypeLabel} #${session.sessionId}`;

  return (
    <ModuleDialog
      title={heading}
      description={`${statusLabel}${isCurrentAdminSession ? " · Sesión actual" : ""}`}
      scrollableBody
      trigger={
        <button
          type="button"
          className={triggerClassName}
          aria-label={`${triggerText}, ver detalle de la sesión`}
        >
          {children}
        </button>
      }
    >
      <DetailsPane label={`Detalle de la sesión ${session.sessionId}`}>
        <DetailsMetadata
          items={[
            { id: "session-type", label: "Tipo de sesión", value: sessionTypeLabel },
            { id: "session-id", label: "Identificador", value: `#${session.sessionId}`, mono: true },
            { id: "actor-type", label: "Tipo de actor", value: actorTypeLabel },
            { id: "actor-id", label: "Identificador de actor", value: `ID ${session.actorId}`, mono: true },
            { id: "status", label: "Estado", value: statusLabel },
            { id: "created", label: "Creada", value: formatOptionalDateTime(session.createdAt) },
            { id: "last-access", label: "Último acceso", value: formatOptionalDateTime(session.lastAccess) },
            { id: "expires", label: "Vencimiento", value: formatOptionalDateTime(session.expiresAt) },
          ]}
        />
        <p className="text-[11px] leading-4 text-muted-foreground">
          Vista de sólo lectura. La revocación se realiza desde la acción de la
          fila.
        </p>
      </DetailsPane>
    </ModuleDialog>
  );
}
