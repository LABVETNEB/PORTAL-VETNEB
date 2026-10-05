"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * C06 · collection selection owner (audit §50). Selection state only: it never
 * fetches, pages, sorts or acts on the selected items (C07/C09 own that).
 *
 * Identity is the item ID the consumer passes, never a row index or position.
 * The selection survives page and dataset changes until `clearSelection`;
 * the page flags and page operations read only `visibleIds`, the IDs the
 * consumer reports as rendered on the current page.
 */
export type CollectionSelectionId = string | number;

export type CollectionSelectionOptions<Id extends CollectionSelectionId> = {
  /** IDs rendered on the current page. Duplicates count once. */
  visibleIds: readonly Id[];
};

export type CollectionSelection<Id extends CollectionSelectionId> = {
  /** Selected IDs in selection order, including IDs not on the current page. */
  selectedIds: readonly Id[];
  selectedCount: number;
  isSelected: (id: Id) => boolean;
  select: (id: Id) => void;
  deselect: (id: Id) => void;
  toggle: (id: Id) => void;
  /** Adds every visible ID; selections on other pages are kept. */
  selectVisiblePage: () => void;
  /** Deselects the visible IDs when all are selected, otherwise selects them. */
  toggleVisiblePage: () => void;
  clearSelection: () => void;
  /** At least one visible ID and every visible ID selected. */
  allVisibleSelected: boolean;
  /** Some, but not all, visible IDs selected (the indeterminate state). */
  someVisibleSelected: boolean;
};

function withIds<Id>(selection: ReadonlySet<Id>, ids: readonly Id[]): ReadonlySet<Id> {
  if (ids.every((id) => selection.has(id))) return selection;
  const next = new Set(selection);
  for (const id of ids) next.add(id);
  return next;
}

function withoutIds<Id>(selection: ReadonlySet<Id>, ids: readonly Id[]): ReadonlySet<Id> {
  if (!ids.some((id) => selection.has(id))) return selection;
  const next = new Set(selection);
  for (const id of ids) next.delete(id);
  return next;
}

function containsAll<Id>(selection: ReadonlySet<Id>, ids: readonly Id[]): boolean {
  return ids.length > 0 && ids.every((id) => selection.has(id));
}

export function useCollectionSelection<Id extends CollectionSelectionId>({
  visibleIds,
}: CollectionSelectionOptions<Id>): CollectionSelection<Id> {
  const [selection, setSelection] = useState<ReadonlySet<Id>>(() => new Set<Id>());

  const select = useCallback((id: Id) => setSelection((current) => withIds(current, [id])), []);
  const deselect = useCallback((id: Id) => setSelection((current) => withoutIds(current, [id])), []);
  const toggle = useCallback(
    (id: Id) =>
      setSelection((current) => (current.has(id) ? withoutIds(current, [id]) : withIds(current, [id]))),
    [],
  );
  const clearSelection = useCallback(
    () => setSelection((current) => (current.size === 0 ? current : new Set<Id>())),
    [],
  );
  const selectVisiblePage = useCallback(
    () => setSelection((current) => withIds(current, visibleIds)),
    [visibleIds],
  );
  const toggleVisiblePage = useCallback(
    () =>
      setSelection((current) =>
        containsAll(current, visibleIds) ? withoutIds(current, visibleIds) : withIds(current, visibleIds),
      ),
    [visibleIds],
  );

  return useMemo(() => {
    const visible = new Set(visibleIds);
    let selectedVisible = 0;
    for (const id of visible) if (selection.has(id)) selectedVisible += 1;
    const allVisibleSelected = visible.size > 0 && selectedVisible === visible.size;

    return {
      selectedIds: [...selection],
      selectedCount: selection.size,
      isSelected: (id: Id) => selection.has(id),
      select,
      deselect,
      toggle,
      selectVisiblePage,
      toggleVisiblePage,
      clearSelection,
      allVisibleSelected,
      someVisibleSelected: selectedVisible > 0 && !allVisibleSelected,
    };
  }, [selection, visibleIds, select, deselect, toggle, selectVisiblePage, toggleVisiblePage, clearSelection]);
}
