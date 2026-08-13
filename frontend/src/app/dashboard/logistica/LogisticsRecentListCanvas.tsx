"use client";

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import {
  createAdaptiveRowPitchCalibrator,
  type AdaptiveRowPitchCalibrator,
} from "@/components/dashboard/adaptiveRowPitchCalibration";
import { DashboardPager } from "@/components/dashboard/DashboardPager";
import { usePagedRows } from "@/components/dashboard/usePagedRows";
import { useAdaptiveDashboardPageSize } from "@/hooks/useAdaptiveDashboardPageSize";

/** Pre-measurement seed only: no page size is frozen anywhere. */
const RECENT_ROW_PITCH_FALLBACK_PX = 52;
const RECENT_ROW_SELECTOR = ".dashboard-list-row";

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
  const [rowHeightPx, setRowHeightPx] = useState(RECENT_ROW_PITCH_FALLBACK_PX);

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

  const paged = usePagedRows(items, itemsPerPage);

  // The pitch is a property of the LAYOUT, not of the page the user happens to
  // be on: rows are not uniform, so probing "the rows currently rendered" made
  // the measured pitch depend on the active slice, the slice depend on the page
  // size and the page size depend on the pitch. That loop settles on a
  // different value per entry path — the same viewport reached cold and reached
  // through a resize disagreed, and A -> B -> A did not return to A. The
  // calibrator owns the rule instead: canonical-page evidence only, one frozen
  // pitch per material geometry (inline size AND block size), replayed on
  // return. See `adaptiveRowPitchCalibration.ts`.
  const calibratorRef = useRef<AdaptiveRowPitchCalibrator | null>(null);
  if (calibratorRef.current === null) {
    calibratorRef.current = createAdaptiveRowPitchCalibrator();
  }

  // Read at callback time by the measurement effect below, which subscribes its
  // observers exactly once: paging and data changes must never re-arm them.
  const pageRef = useRef(paged.page);
  const setPageRef = useRef(paged.setPage);
  const itemCountRef = useRef(items.length);
  useLayoutEffect(() => {
    pageRef.current = paged.page;
    setPageRef.current = paged.setPage;
    itemCountRef.current = items.length;
  });

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const calibrator = calibratorRef.current;
      if (!calibrator) {
        return;
      }

      const canvas = node.getBoundingClientRect();
      // Tallest row currently rendered, not the first one: a long clinic or
      // plan name wraps on a narrow phone, so sizing the page by row 0 could
      // fit three short rows on paper while the third real row was clipped by
      // this zero-scroll canvas. Whether this reading is allowed to CALIBRATE
      // the geometry is the calibrator's decision, not this probe's.
      let measuredRowPitchPx = 0;
      for (const row of node.querySelectorAll(RECENT_ROW_SELECTOR)) {
        measuredRowPitchPx = Math.max(
          measuredRowPitchPx,
          row.getBoundingClientRect().height,
        );
      }

      const outcome = calibrator.reconcile({
        geometry: {
          inlineSize: canvas.width,
          blockSize: canvas.height,
          itemCount: itemCountRef.current,
        },
        page: pageRef.current,
        measuredRowPitchPx,
      });

      if (outcome.rowPitchPx > 0) {
        setRowHeightPx((previous) =>
          previous === outcome.rowPitchPx ? previous : outcome.rowPitchPx,
        );
      }

      // Only ever set while a geometry is being calibrated off the canonical
      // page, and once more to hand the user's page back. A settled geometry
      // returns `null` forever, so this closes no feedback loop.
      if (outcome.requestedPage !== null) {
        setPageRef.current(outcome.requestedPage);
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
    // The rows themselves must be observed too. A row reaches its final height
    // a frame or two after it mounts (wrapping, fonts), and that growth does
    // NOT resize the flex-sized canvas — so with only the canvas observed the
    // first, still-short measurement was the last one taken: under load the
    // pitch froze at ~40px instead of ~51px and the canvas claimed three rows
    // where two fit, leaving the third clipped. A `MutationObserver` re-arms
    // the row observers whenever the rendered page changes.
    const observeRows = () => {
      for (const row of node.querySelectorAll(RECENT_ROW_SELECTOR)) {
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
