"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared centered pager for the zero-scroll dashboard grammar:
 *
 *   Anterior | Página X de Y | Siguiente
 *
 * The cluster is centered inside a fixed `--dash-pagination-h` reserve so it
 * can never be pushed below its surface. Two usage modes:
 *
 * 1. Standard mode: pass `page`/`pageCount`/`onPrev`/`onNext` and the pager
 *    renders its own controls.
 * 2. Slot mode: pass `prevControl`/`stateControl`/`nextControl` when the
 *    surface owns pinned control markup (URL pagers, contract-locked
 *    aria-labels); the pager only contributes the centered geometry and the
 *    stable selectors.
 */
export type DashboardPagerProps = {
  /** Accessible name of the pagination landmark. */
  "aria-label": string;
  className?: string;
  /** Zero-based page index (standard mode). */
  page?: number;
  pageCount?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  disabled?: boolean;
  /** Slot mode overrides. */
  prevControl?: ReactNode;
  stateControl?: ReactNode;
  nextControl?: ReactNode;
};

const pagerButtonClassName =
  "dashboard-pagination-btn inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function DashboardPager({
  "aria-label": ariaLabel,
  className,
  page = 0,
  pageCount = 1,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  disabled = false,
  prevControl,
  stateControl,
  nextControl,
}: DashboardPagerProps) {
  const safePageCount = Math.max(1, pageCount);
  const displayPage = Math.min(Math.max(1, page + 1), safePageCount);
  const canGoPrev = hasPrev ?? displayPage > 1;
  const canGoNext = hasNext ?? displayPage < safePageCount;

  return (
    <nav
      aria-label={ariaLabel}
      data-dashboard-pager="true"
      className={cn("dashboard-pager", className)}
    >
      <span data-dashboard-pager-prev="true" className="inline-flex">
        {prevControl ?? (
          <button
            type="button"
            onClick={onPrev}
            disabled={disabled || !canGoPrev}
            aria-label="Página anterior"
            className={pagerButtonClassName}
          >
            Anterior
          </button>
        )}
      </span>
      <span
        data-dashboard-pager-state="true"
        className="text-xs text-muted-foreground"
      >
        {stateControl ?? (
          <span className="dashboard-pagination-context">
            Página {displayPage} de {safePageCount}
          </span>
        )}
      </span>
      <span data-dashboard-pager-next="true" className="inline-flex">
        {nextControl ?? (
          <button
            type="button"
            onClick={onNext}
            disabled={disabled || !canGoNext}
            aria-label="Página siguiente"
            className={pagerButtonClassName}
          >
            Siguiente
          </button>
        )}
      </span>
    </nav>
  );
}
