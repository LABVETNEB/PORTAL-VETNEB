"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type UseAdaptiveRowsPerPageOptions = {
  containerNode: HTMLElement | null;
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
 *
 * `containerNode` must be the actual DOM node (e.g. via a `useState` callback
 * ref), not a `useRef` object: the node commonly mounts on a later render
 * than the hook's first commit (it sits behind a conditional/async-loaded
 * branch), and a plain ref's identity never changes, so an effect keyed off
 * the ref object would never re-run once the node appears.
 */
export function useAdaptiveRowsPerPage({
  containerNode,
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
    if (!enabled || !containerNode) {
      return;
    }

    let frame: number | null = null;

    const measure = () => {
      frame = null;

      const containerHeight = containerNode.getBoundingClientRect().height;
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
    observer.observe(containerNode);
    scheduleMeasure();

    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [
    containerNode,
    enabled,
    headerHeightPx,
    maxRows,
    minRows,
    rowHeightPx,
    safetyGapPx,
  ]);

  return { rowsPerPage, isMeasured };
}
