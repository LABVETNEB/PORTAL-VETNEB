"use client";

import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { ActionMenu, ActionMenuItem } from "./ActionMenu";
import type { CollectionSelectionId } from "./useCollectionSelection";

/**
 * C09 · bulk actions on the C07 toolbar (audit §50). It composes the C08 menu
 * and reads the C06 owner only through `selectedIds`: it never selects, clears,
 * fetches or reports. The host runs each action with the IDs it is handed and
 * owns the outcome: errors, partial results and clearing the selection.
 */
type BulkActionBase<Id extends CollectionSelectionId> = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Runs once per activation with every selected ID, on and off the current page. */
  onSelect: (selectedIds: readonly Id[]) => void;
  /** `single` enables the action for exactly one selected item. */
  requires?: "single";
  /** Why the host cannot run the action on this selection; shown on the disabled item. */
  disabledReason?: string;
};

export type BulkAction<Id extends CollectionSelectionId> =
  | (BulkActionBase<Id> & { destructive?: false })
  | (BulkActionBase<Id> & {
      destructive: true;
      /** True only when `onSelect` opens the host's confirmation before it changes anything; otherwise the action stays disabled. */
      confirmsBeforeRunning: boolean;
    });

export type BulkActionMenuProps<Id extends CollectionSelectionId> = {
  /** `selectedIds` of the C06 owner, as given. */
  selectedIds: readonly Id[];
  actions: readonly BulkAction<Id>[];
  /** A bulk action is in flight: every item stays disabled until the host reports back. */
  pending?: boolean;
  label?: string;
};

function unavailableReason<Id extends CollectionSelectionId>(action: BulkAction<Id>, selectedCount: number, pending: boolean) {
  if (pending) return "Acción en curso";
  if (action.destructive && !action.confirmsBeforeRunning) return "Requiere confirmación";
  if (action.requires === "single" && selectedCount !== 1) return "Sólo un elemento";
  return action.disabledReason || null;
}

export function BulkActionMenu<Id extends CollectionSelectionId>({
  selectedIds,
  actions,
  pending = false,
  label = "Acciones",
}: BulkActionMenuProps<Id>) {
  if (selectedIds.length === 0 || actions.length === 0) return null;

  return (
    <ActionMenu
      label={label}
      triggerClassName="-my-0.5 shrink-0 px-2.5 md:my-0"
      trigger={
        <>
          <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </>
      }
    >
      {actions.map((action) => {
        const reason = unavailableReason(action, selectedIds.length, pending);
        return (
          <ActionMenuItem
            key={action.id}
            icon={action.icon}
            disabled={reason !== null}
            onSelect={() => {
              if (reason === null) action.onSelect([...selectedIds]);
            }}
          >
            {action.label}
            {reason === null ? null : <span data-bulk-action-reason="true"> · {reason}</span>}
          </ActionMenuItem>
        );
      })}
    </ActionMenu>
  );
}
