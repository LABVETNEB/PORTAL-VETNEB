"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Container-aware page-size engine for the zero-scroll dashboard substrate.
 *
 * Extends the `useAdaptiveItemsPerPage` measurement discipline (ResizeObserver
 * + single-rAF throttle + synchronous first measure) with the full canvas
 * arithmetic of the fixed-viewport contract:
 *
 *   usable_canvas_height =
 *     container_height - chrome - header - pagination - safety_buffer
 *   rows_per_page = clamp(floor(usable / row_height), min, max)
 *
 * The consumer attaches `containerRef` to the element that owns the data
 * canvas (a bounded `minmax(0, 1fr)` region); the hook never reads `window`.
 */
export type AdaptiveDashboardPageSizeOptions = {
  /** Fallback page size used until the first real measurement lands. */
  fallbackItems: number;
  /** Row/card height in CSS px (measured by the consumer or a constant). */
  rowHeightPx: number;
  /** Fixed chrome inside the container that rows cannot use (headers…). */
  chromeHeightPx?: number;
  /** Table header height (thead / list header) inside the container. */
  headerHeightPx?: number;
  /** Pagination reserve inside the container, when the pager is a child. */
  paginationHeightPx?: number;
  /** Extra safety buffer against sub-pixel rounding. */
  safetyBufferPx?: number;
  minItems?: number;
  maxItems?: number;
  enabled?: boolean;
};

export type AdaptiveDashboardPageSizeResult = {
  containerRef: React.RefObject<HTMLElement | null>;
  availableHeight: number;
  itemsPerPage: number;
  rowHeight: number;
  chromeHeight: number;
  paginationHeight: number;
  isMeasured: boolean;
};

function toNonNegative(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return value;
}

function toPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type MeasuredState = {
  availableHeight: number;
  itemsPerPage: number;
  isMeasured: boolean;
};

export function useAdaptiveDashboardPageSize({
  fallbackItems,
  rowHeightPx,
  chromeHeightPx = 0,
  headerHeightPx = 0,
  paginationHeightPx = 0,
  safetyBufferPx = 6,
  minItems,
  maxItems,
  enabled = true,
}: AdaptiveDashboardPageSizeOptions): AdaptiveDashboardPageSizeResult {
  const containerRef = useRef<HTMLElement | null>(null);

  const min = toPositiveInteger(minItems, 1);
  const max = Math.max(min, toPositiveInteger(maxItems, 50));
  const rowHeight = toNonNegative(rowHeightPx, 0);
  const chromeHeight = toNonNegative(chromeHeightPx, 0);
  const headerHeight = toNonNegative(headerHeightPx, 0);
  const paginationHeight = toNonNegative(paginationHeightPx, 0);
  const safetyBuffer = toNonNegative(safetyBufferPx, 6);

  const fallback = clamp(toPositiveInteger(fallbackItems, min), min, max);
  const [measured, setMeasured] = useState<MeasuredState>({
    availableHeight: 0,
    itemsPerPage: fallback,
    isMeasured: false,
  });
  const measuredRef = useRef(measured);

  useLayoutEffect(() => {
    const containerNode = containerRef.current;
    if (!enabled || !containerNode || rowHeight <= 0) {
      return;
    }

    let frame: number | null = null;

    const measure = () => {
      frame = null;

      const containerHeight = containerNode.getBoundingClientRect().height;
      if (!Number.isFinite(containerHeight) || containerHeight <= 0) {
        return;
      }

      const usableHeight =
        containerHeight -
        chromeHeight -
        headerHeight -
        paginationHeight -
        safetyBuffer;
      if (!Number.isFinite(usableHeight) || usableHeight <= 0) {
        return;
      }

      const nextItems = clamp(Math.floor(usableHeight / rowHeight), min, max);
      const next: MeasuredState = {
        availableHeight: usableHeight,
        itemsPerPage: nextItems,
        isMeasured: true,
      };

      const previous = measuredRef.current;
      if (
        previous.isMeasured !== next.isMeasured ||
        previous.itemsPerPage !== next.itemsPerPage ||
        previous.availableHeight !== next.availableHeight
      ) {
        measuredRef.current = next;
        setMeasured(next);
      }
    };

    const scheduleMeasure = () => {
      if (frame !== null) {
        return;
      }

      frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(containerNode);
    // First measurement runs synchronously so the fallback-sized paint is
    // corrected within the same layout pass (no visible settle frame); later
    // resize-driven remeasures stay rAF-throttled against layout thrash.
    measure();

    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [
    chromeHeight,
    enabled,
    headerHeight,
    max,
    min,
    paginationHeight,
    rowHeight,
    safetyBuffer,
  ]);

  return {
    containerRef,
    availableHeight: measured.availableHeight,
    itemsPerPage: measured.itemsPerPage,
    rowHeight,
    chromeHeight,
    paginationHeight,
    isMeasured: measured.isMeasured,
  };
}
