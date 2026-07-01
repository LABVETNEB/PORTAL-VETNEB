"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export type UseAdaptiveRowsPerPageOptions = {
  containerRef: RefObject<HTMLElement | null>;
  fallbackRows: number;
  rowHeightPx: number;
  headerHeightPx?: number;
  safetyGapPx?: number;
  minRows?: number;
  maxRows?: number;
  enabled?: boolean;
};

export type UseAdaptiveRowsPerPageResult = {
  rowsPerPage: number;
  isMeasured: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Derives how many rows fit a measured container instead of a fixed page
 * size. Falls back to `fallbackRows` until a valid measurement is available,
 * and keeps the last valid value whenever the container can't be measured.
 */
export function useAdaptiveRowsPerPage({
  containerRef,
  fallbackRows,
  rowHeightPx,
  headerHeightPx = 0,
  safetyGapPx = 6,
  minRows = 2,
  maxRows = 50,
  enabled = true,
}: UseAdaptiveRowsPerPageOptions): UseAdaptiveRowsPerPageResult {
  const [rowsPerPage, setRowsPerPage] = useState(fallbackRows);
  const [isMeasured, setIsMeasured] = useState(false);
  const rowsPerPageRef = useRef(fallbackRows);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    let frame: number | null = null;

    const measure = () => {
      frame = null;

      const containerHeight = container.getBoundingClientRect().height;
      if (containerHeight <= 0 || rowHeightPx <= 0) {
        return;
      }

      const availableRowsHeight =
        containerHeight - headerHeightPx - safetyGapPx;
      const nextRows = clamp(
        Math.floor(availableRowsHeight / rowHeightPx),
        minRows,
        maxRows,
      );

      if (!Number.isFinite(nextRows) || nextRows <= 0) {
        return;
      }

      setIsMeasured(true);

      if (nextRows !== rowsPerPageRef.current) {
        rowsPerPageRef.current = nextRows;
        setRowsPerPage(nextRows);
      }
    };

    const scheduleMeasure = () => {
      if (frame !== null) {
        return;
      }
      frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(container);
    scheduleMeasure();

    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [
    containerRef,
    enabled,
    headerHeightPx,
    maxRows,
    minRows,
    rowHeightPx,
    safetyGapPx,
  ]);

  return { rowsPerPage, isMeasured };
}
