"use client";

import { useState, useSyncExternalStore } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTION_GRID_REGIME, resolveCollectionView, type CollectionView } from "./collection-view";

function subscribeGridRegime(onChange: () => void) {
  const regime = window.matchMedia(COLLECTION_GRID_REGIME);
  regime.addEventListener("change", onChange);
  return () => regime.removeEventListener("change", onChange);
}

function readGridRegime() {
  return window.matchMedia(COLLECTION_GRID_REGIME).matches;
}

/**
 * C24 · one in-memory owner per collection. The preference survives a trip
 * through the phone regime (where the list is forced) and is never written to
 * the URL, storage or the server: no prior contract allows it.
 */
export function useCollectionView() {
  const [preferred, setPreferred] = useState<CollectionView>("list");
  const gridRegime = useSyncExternalStore(subscribeGridRegime, readGridRegime, () => false);
  return { preferred, view: resolveCollectionView(preferred, gridRegime), setView: setPreferred };
}

const OPTIONS = [
  { id: "list", label: "Vista de lista", Icon: List },
  { id: "grid", label: "Vista de cuadrícula", Icon: LayoutGrid },
] as const satisfies ReadonlyArray<{ id: CollectionView; label: string; Icon: typeof List }>;

export type CollectionViewToggleProps = {
  /** Collection noun for the group name, e.g. "informes". */
  label: string;
  view: CollectionView;
  onViewChange: (view: CollectionView) => void;
  className?: string;
};

export function CollectionViewToggle({ label, view, onViewChange, className }: CollectionViewToggleProps) {
  return (
    <div
      role="group"
      aria-label={`Vista de ${label}`}
      data-collection-view-toggle="true"
      className={cn("hidden shrink-0 items-center gap-0.5 rounded-md border border-input bg-card/95 p-0.5 md:inline-flex", className)}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={view === option.id}
          aria-label={option.label}
          title={option.label}
          data-collection-view-option={option.id}
          onClick={() => onViewChange(option.id)}
          className={cn(
            "inline-flex h-6 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85",
            view === option.id && "bg-vetneb-teal/12 text-vetneb-ink",
          )}
        >
          <option.Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
