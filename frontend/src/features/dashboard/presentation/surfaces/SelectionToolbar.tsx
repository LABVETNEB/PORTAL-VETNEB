"use client";

import type { MouseEvent, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * C07 · contextual toolbar (audit §8: WorkspaceToolbar = DefaultToolbar ⇄
 * SelectionToolbar). With nothing selected it renders the host's default
 * toolbar as given; with a selection it takes that same slot, so the host's
 * reserved height never changes. It reads the C06 owner only through
 * `selectedCount` and `onClearSelection`; actions on the selection are C09.
 */
export type SelectionToolbarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  /** DefaultToolbar, rendered unchanged while `selectedCount` is 0. */
  children: ReactNode;
};

export function SelectionToolbar({ selectedCount, onClearSelection, children }: SelectionToolbarProps) {
  if (selectedCount === 0) return <>{children}</>;

  function clear(event: MouseEvent<HTMLButtonElement>) {
    // This button unmounts with the selection: focus moves to the page selector of the same collection.
    const collection = event.currentTarget.closest("section");
    onClearSelection();
    collection?.querySelector<HTMLElement>('[data-collection-selection="page"]:not(:disabled)')?.focus();
  }

  return (
    <div role="group" aria-label="Selección" data-selection-toolbar="true" className="flex min-w-0 flex-1 items-center gap-2">
      <span aria-live="polite" className="min-w-0 truncate text-xs font-semibold tabular-nums text-vetneb-ink">
        {selectedCount === 1 ? "1 seleccionado" : `${selectedCount} seleccionados`}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Limpiar selección"
        onClick={clear}
        className="h-10 min-h-10 min-w-10 shrink-0 gap-1.5 px-2.5 text-xs md:h-8 md:min-h-8"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Limpiar</span>
      </Button>
    </div>
  );
}
