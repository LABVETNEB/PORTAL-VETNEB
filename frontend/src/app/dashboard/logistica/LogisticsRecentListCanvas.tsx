"use client";

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";

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
  const rowPitchRef = useRef<{ containerHeight: number; rowHeightPx: number }>({
    containerHeight: 0,
    rowHeightPx: 0,
  });
  const onFirstPageRef = useRef(true);

  // `minItems: 1`: the floor of two was an artificial one. On the shortest
  // phones the measured canvas is smaller than two rows, so a floor of two
  // forced a row the canvas could not hold and `overflow: hidden` clipped it —
  // the cardinality stopped being the measured one. The hook stays the sole
  // owner of it (`floor(usable / measuredRowHeight)` clamped); this only lets
  // the natural result reach one row where one row is what fits. Same floor the
  // other mobile lists of the dashboard already use.
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
      // Tallest row currently rendered, not the first one: a long clinic or
      // plan name wraps on a narrow phone, so sizing the page by row 0 could
      // fit three short rows on paper while the third real row was clipped by
      // this zero-scroll canvas.
      let height = 0;
      for (const row of node.querySelectorAll(".dashboard-list-row")) {
        height = Math.max(height, row.getBoundingClientRect().height);
      }
      if (height <= 0) {
        return;
      }

      // Rows are not uniform: a long clinic or plan name wraps on a narrow
      // phone and grows its row. Probing "the first rendered row" therefore
      // made the pitch depend on which records were on the current page, so
      // paging changed the page size and the second page came back shorter
      // than the first (observed at 360x800). The pitch belongs to the layout:
      // probed once per measured-canvas size, reused across page changes,
      // re-probed when the canvas itself resizes.
      const containerHeight = node.getBoundingClientRect().height;
      const cached = rowPitchRef.current;
      const layoutChanged = cached.containerHeight !== containerHeight;

      // Held while paging, re-probed on the first page: on page 1 the probe
      // keeps correcting until the canvas settles, and from page 2 onward the
      // value is held so a page whose records render taller cannot resize the
      // page under the user (its extra row would be clipped by the zero-scroll
      // canvas). A resize of the canvas re-opens probing.
      if (!layoutChanged && cached.rowHeightPx > 0 && !onFirstPageRef.current) {
        return;
      }
      if (!layoutChanged && height === cached.rowHeightPx) {
        return;
      }

      rowPitchRef.current = { containerHeight, rowHeightPx: height };
      setRowHeightPx((previous) => (previous === height ? previous : height));
    };

    const scheduleMeasure = () => {
      if (frame !== null) {
        return;
      }

      frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(node);
    // The rows themselves must be observed too. A row reaches its final height
    // a frame or two after it mounts (wrapping, fonts), and that growth does
    // NOT resize the flex-sized canvas — so with only the canvas observed the
    // first, still-short measurement was the last one taken: under load the
    // pitch froze at ~40px instead of ~51px and the canvas claimed three rows
    // where two fit, leaving the third clipped. A `MutationObserver` re-arms
    // the row observers whenever the rendered page changes.
    const observeRows = () => {
      for (const row of node.querySelectorAll(".dashboard-list-row")) {
        observer.observe(row);
      }
    };
    const rowsObserver = new MutationObserver(() => {
      observeRows();
      scheduleMeasure();
    });
    rowsObserver.observe(node, { childList: true, subtree: true });
    observeRows();
    measure();

    return () => {
      observer.disconnect();
      rowsObserver.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [containerRef]);

  const paged = usePagedRows(items, itemsPerPage);
  const isOnFirstPage = paged.page === 0;
  useLayoutEffect(() => {
    onFirstPageRef.current = isOnFirstPage;
  }, [isOnFirstPage]);

  return (
    <div
      data-dashboard-adaptive-reservation="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div
        ref={(node) => {
          containerRef.current = node;
        }}
        data-logistics-recent-list-canvas="true"
        data-dashboard-adaptive-rows-canvas="true"
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
