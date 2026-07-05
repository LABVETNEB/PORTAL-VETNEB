"use client";

import { Children, useLayoutEffect, useState, type ReactNode } from "react";

import { DashboardPager } from "@/components/dashboard/DashboardPager";
import { usePagedRows } from "@/components/dashboard/usePagedRows";
import { useAdaptiveDashboardPageSize } from "@/hooks/useAdaptiveDashboardPageSize";

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
 * layer only bounds them: it measures its own canvas, derives how many rows
 * fit, pages the server-rendered rows client-side and keeps a centered pager
 * visible so no row is ever clipped behind the mobile bottom nav.
 */
export function LogisticsRecentListCanvas({
  pagerAriaLabel,
  children,
}: LogisticsRecentListCanvasProps) {
  const items = Children.toArray(children);
  const [rowHeightPx, setRowHeightPx] = useState(52);

  const { containerRef, itemsPerPage } = useAdaptiveDashboardPageSize({
    fallbackItems: 3,
    rowHeightPx,
    safetyBufferPx: 8,
    minItems: 2,
    maxItems: 12,
  });

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const row = node.querySelector(".dashboard-list-row");
      const height = row?.getBoundingClientRect().height ?? 0;
      if (height > 0) {
        setRowHeightPx((previous) => (previous === height ? previous : height));
      }
    };

    const scheduleMeasure = () => {
      if (frame !== null) {
        return;
      }

      frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(node);
    measure();

    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [containerRef]);

  const paged = usePagedRows(items, itemsPerPage);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={(node) => {
          containerRef.current = node;
        }}
        data-logistics-recent-list-canvas="true"
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden"
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
        className="shrink-0 border-t border-vetneb-line/60"
      />
    </div>
  );
}
