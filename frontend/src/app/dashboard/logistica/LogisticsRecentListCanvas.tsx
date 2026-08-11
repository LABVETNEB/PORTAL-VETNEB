"use client";

import {
  Children,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  const rowPitchRef = useRef({
    containerHeight: 0,
    rowHeightPx: 0,
  });
  const onFirstPageRef = useRef(true);

  // `minItems: 1`: the floor of two was an artificial one. On the shortest
  // phones the measured canvas is smaller than two rows, so a floor of two
  // forced a row the canvas could not hold and `overflow: hidden` clipped it.
  const { containerRef, itemsPerPage } = useAdaptiveDashboardPageSize({
    fallbackItems: 3,
    rowHeightPx,
    safetyBufferPx: 8,
    minItems: 1,
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

      const rows = Array.from(
        node.querySelectorAll<HTMLElement>(".dashboard-list-row"),
      );

      const height = rows.reduce(
        (maximum, row) =>
          Math.max(maximum, row.getBoundingClientRect().height),
        0,
      );

      const containerHeight = node.getBoundingClientRect().height;
      const cached = rowPitchRef.current;


      // Once page 1 has established a pitch for this exact canvas geometry,
      // page 2 must reuse it instead of learning a data-dependent pitch from a
      // different slice.
      if (
        cached.rowHeightPx > 0 &&
        (!onFirstPageRef.current ||
          cached.containerHeight === containerHeight)
      ) {
        return;
      }

      if (height === cached.rowHeightPx) {
        return;
      }

      if (height > 0) {
        rowPitchRef.current = {
          containerHeight,
          rowHeightPx: height,
        };

        setRowHeightPx((previous) =>
          previous === height ? previous : height,
        );
      }
    };

    const scheduleMeasure = () => {
      if (frame !== null) {
        return;
      }

      frame = requestAnimationFrame(measure);
    };

    const resizeObserver = new ResizeObserver(scheduleMeasure);

    const observeRows = () => {
      const rows = node.querySelectorAll<HTMLElement>(
        ".dashboard-list-row",
      );

      rows.forEach((row) => {
        resizeObserver.observe(row);
      });
    };

    resizeObserver.observe(node);
    observeRows();

    const mutationObserver = new MutationObserver(() => {
      observeRows();
      scheduleMeasure();
    });

    mutationObserver.observe(node, {
      childList: true,
      subtree: true,
    });

    // Synchronous first probe; subsequent content/layout growth is captured by
    // the row ResizeObserver and node-replacement MutationObserver.
    measure();

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();

      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [containerRef]);

  const paged = usePagedRows(items, itemsPerPage);
  useLayoutEffect(() => {
    onFirstPageRef.current = paged.page === 0;
  }, [paged.page]);



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
