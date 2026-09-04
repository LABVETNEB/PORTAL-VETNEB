"use client";

import { Children, useState, type ReactNode } from "react";

import { DashboardPager } from "@/components/dashboard/DashboardPager";
import { usePagedRows } from "@/components/dashboard/usePagedRows";
import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";

export type LogisticsRecentListCanvasProps = {
  /** Accessible name for the pager landmark of this list. */
  pagerAriaLabel: string;
  /** Server-rendered `.dashboard-list-row` nodes. */
  children: ReactNode;
};

/**
 * Bounded adaptive canvas for the logistics hub "recent" lists.
 *
 * The rows stay server-rendered (the hub is a server component); this client
 * layer only bounds them: it derives how many rows fit from the canvas
 * geometry, pages the server-rendered rows client-side and keeps a centered
 * pager visible so no row is ever clipped behind the mobile bottom nav.
 *
 * Pilot of the pitch-locked architecture. What used to live here — a probe over
 * every rendered row for the tallest one, a `MutationObserver` re-arming those
 * probes on each page change, a calibrator caching one frozen pitch per
 * geometry, and a `setPage` issued from the measurement effect — was all
 * machinery for one problem: the pitch was read from the rows, so the rows
 * decided the page size and the page size decided which rows were read. The
 * pitch is now a CSS token (`--dash-row-pitch`, locked onto the rows in
 * `zero-scroll.css`), which no dataset can move, so none of that machinery has
 * anything left to do.
 *
 * `minItems: 1`: the floor of two was artificial. On the shortest phones the
 * canvas is smaller than two rows, and a floor of two forced a row the canvas
 * could not hold, which `overflow: hidden` then clipped.
 */
export function LogisticsRecentListCanvas({
  pagerAriaLabel,
  children,
}: LogisticsRecentListCanvasProps) {
  const items = Children.toArray(children);

  // State, not a ref: the capacity owner keys its single observer on this node,
  // so it has to re-run when the node actually attaches.
  const [canvasNode, setCanvasNode] = useState<HTMLElement | null>(null);

  const { capacity } = useDashboardCanvasCapacity({
    canvasNode,
    fallbackItems: 3,
    minItems: 1,
    maxItems: 12,
  });

  const paged = usePagedRows(items, capacity);

  return (
    <div
      data-dashboard-adaptive-reservation="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div
        ref={setCanvasNode}
        data-logistics-recent-list-canvas="true"
        data-dashboard-adaptive-rows-canvas="true"
        data-dashboard-row-pitch="regular"
        data-dashboard-row-gap="spaced"
        className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      >
        {paged.pageItems}
      </div>
      <DashboardPager
        aria-label={pagerAriaLabel}
        page={paged.page}
        pageCount={paged.pageCount}
        hasPrev={paged.hasPrev}
        hasNext={paged.hasNext}
        onPrev={paged.goPrev}
        onNext={paged.goNext}
        rangeLabel={
          paged.total > 0
            ? `${paged.rangeStart}–${paged.rangeEnd} de ${paged.total}`
            : undefined
        }
        className="shrink-0 border-t border-vetneb-line/60"
      />
    </div>
  );
}
