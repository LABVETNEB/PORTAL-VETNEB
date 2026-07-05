"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CompactPagerProps = {
  page: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Singular/plural noun for the range label, e.g. "registros". */
  itemLabel?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Compact pagination bar pinned to the bottom of a module body. Keeps the
 * primary navigation visible without scrolling and announces the visible range
 * for assistive technology.
 */
export function CompactPager({
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  itemLabel = "elementos",
  className,
  disabled = false,
}: CompactPagerProps) {
  return (
    <div
      className={cn("dashboard-compact-pager", className)}
      data-dashboard-compact-pager="true"
      data-dashboard-pager="compact"
    >
      <span aria-live="polite" aria-atomic="true">
        {total === 0
          ? `Sin ${itemLabel}`
          : `${rangeStart}–${rangeEnd} de ${total} ${itemLabel}`}
      </span>
      <div className="flex items-center gap-2">
        <span
          className="text-xs text-muted-foreground"
          data-dashboard-pager-state="true"
        >
          Pág. {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          onClick={onPrev}
          disabled={disabled || !hasPrev}
          data-dashboard-pager-prev="true"
          aria-label="Página anterior"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-card/95 text-foreground dashboard-btn-interactive hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disabled || !hasNext}
          data-dashboard-pager-next="true"
          aria-label="Página siguiente"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-card/95 text-foreground dashboard-btn-interactive hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
