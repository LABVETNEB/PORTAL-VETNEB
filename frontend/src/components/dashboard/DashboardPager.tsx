"use client";

import type { CSSProperties, ReactNode } from "react";
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
/**
 * Canonical pager reservation, shared by every surface that owns pager markup
 * of its own instead of rendering this component.
 *
 * A reserved region declared only with `shrink-0` and a `min-h-*` floor is NOT
 * reserved: `max-block-size` stays `none` and `flex-basis` stays `auto`, so the
 * region grows with its own content, the sibling rows canvas (`flex-1 min-h-0`)
 * gives the pixels back 1:1, and the capacity engine recomputes a different
 * adaptive limit from a canvas that only moved because the pager did.
 *
 * The trio is applied INLINE on purpose: Tailwind utilities outrank the
 * `components` layer that carries `.dashboard-pager`, so a `min-h-*` left on
 * the consumer would otherwise win over the primitive's own reservation.
 */
export const DASHBOARD_PAGER_RESERVATION = {
  "--dash-adaptive-pager-reserved-block-size": "var(--dash-pagination-h, 2.5rem)",
  blockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  minBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  maxBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
} as CSSProperties;

/**
 * Same reservation for the pagers whose controls are touch targets.
 *
 * `--dash-pagination-h` floors at 2.25rem, which is SMALLER than the 2.25rem
 * button plus its 1px separator, so pinning those regions to the plain token
 * would clip a control that `test/unit/ui/admin/admin-mobile-*-pager-canonical-
 * layout.test.ts` pins at >=36px on purpose. The floor raised here is the
 * `min-h-10` those pagers already declare — the reservation stops being a
 * minimum and becomes exact, which is the whole defect being fixed; the touch
 * target itself is left untouched.
 */
export const DASHBOARD_TOUCH_PAGER_RESERVATION = {
  "--dash-adaptive-pager-reserved-block-size":
    "max(var(--dash-pagination-h, 2.5rem), 2.5rem)",
  blockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  minBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  maxBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
} as CSSProperties;

/**
 * Reservation for a pager that is NOT a footer: a compact prev/next cluster
 * sitting inside a toolbar row (Clínicas). Reserving the full pagination
 * footer height there would inflate the toolbar by ~11px for nothing, so the
 * region reserves the control token it actually renders. Still exact, still
 * content-independent — only the magnitude is the right one for the row.
 */
export const DASHBOARD_INLINE_PAGER_RESERVATION = {
  "--dash-adaptive-pager-reserved-block-size": "var(--dash-control-h, 2rem)",
  blockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  minBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  maxBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
} as CSSProperties;

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
  /**
   * CMP-09 — accessible range/total announcement, mirroring Admin's
   * `AdminMobileOpsPager` `rangeLabel` (e.g. "1–13 de 60"). Rendered
   * `sr-only`, matching Admin: the visible label stays the compact
   * "Pág. X / Y" in both. Omit when no total is known (the logistics full
   * routes' backend does not expose one).
   */
  rangeLabel?: string;
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
  rangeLabel,
}: DashboardPagerProps) {
  const safePageCount = Math.max(1, pageCount);
  const displayPage = Math.min(Math.max(1, page + 1), safePageCount);
  const canGoPrev = hasPrev ?? displayPage > 1;
  const canGoNext = hasNext ?? displayPage < safePageCount;

  return (
    <nav
      aria-label={ariaLabel}
      data-dashboard-pager="true"
      data-dashboard-adaptive-reserved-region="pager"
      className={cn("dashboard-pager min-h-10", className)}
      style={DASHBOARD_TOUCH_PAGER_RESERVATION}
    >
      {rangeLabel ? (
        <span className="sr-only" aria-live="polite">
          {rangeLabel}
        </span>
      ) : null}
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
            Pág. {displayPage} / {safePageCount}
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
