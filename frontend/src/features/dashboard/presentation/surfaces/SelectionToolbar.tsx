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

const PAGE_SELECTOR = '[data-collection-selection="page"]:not(:disabled)';
const FALLBACK_CONTROLS = 'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled)';

export function SelectionToolbar({ selectedCount, onClearSelection, children }: SelectionToolbarProps) {
  const count = selectedCount === 1 ? "1 seleccionado" : `${selectedCount} seleccionados`;

  function clear(event: MouseEvent<HTMLButtonElement>) {
    // This button unmounts with the selection: focus moves to the page selector of the same
    // collection, or to the first control that really takes focus when that selector is unavailable.
    const toolbar = event.currentTarget.closest('[data-selection-toolbar="true"]');
    const collection = event.currentTarget.closest("section");
    onClearSelection();
    const targets = [
      ...(collection?.querySelectorAll<HTMLElement>(PAGE_SELECTOR) ?? []),
      ...(collection?.querySelectorAll<HTMLElement>(FALLBACK_CONTROLS) ?? []),
    ];
    for (const target of targets) {
      if (toolbar?.contains(target)) continue;
      target.focus();
      if (target.matches(":focus")) break;
    }
  }

  return (
    <>
      {selectedCount === 0 ? (
        children
      ) : (
        <div role="group" aria-label="Selección" data-selection-toolbar="true" className="flex min-w-0 flex-1 items-center gap-2">
          <span data-selection-count="true" className="min-w-0 truncate text-xs font-semibold tabular-nums text-vetneb-ink">
            {count}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Limpiar selección"
            onClick={clear}
            className="-my-0.5 h-11 min-h-11 min-w-11 shrink-0 gap-1.5 px-2.5 text-xs md:my-0 md:h-8 md:min-h-8 md:min-w-0"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Limpiar</span>
          </Button>
        </div>
      )}
      <span aria-live="polite" data-selection-live="true" className="sr-only">
        {selectedCount === 0 ? "" : count}
      </span>
    </>
  );
}
