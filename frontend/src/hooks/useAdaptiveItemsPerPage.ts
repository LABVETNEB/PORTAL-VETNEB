"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type AdaptiveItemsPerPageOptions = {
  containerNode: HTMLElement | null;
  fallbackItems: number;
  itemHeightPx: number;
  headerHeightPx?: number;
  safetyGapPx?: number;
  minItems?: number;
  maxItems?: number;
  enabled?: boolean;
};

export type AdaptiveItemsPerPageResult = {
  itemsPerPage: number;
};

function toPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function toNonNegativeFinite(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveBounds(minItems: number | undefined, maxItems: number | undefined) {
  const min = toPositiveInteger(minItems, 1);
  const max = Math.max(min, toPositiveInteger(maxItems, 50));

  return { min, max };
}

function resolveFallbackItems(
  fallbackItems: number,
  minItems: number,
  maxItems: number,
): number {
  const fallback = toPositiveInteger(fallbackItems, minItems);

  return clamp(fallback, minItems, maxItems);
}

/**
 * Derives how many items fit in a real measured container. The fixed
 * per-module page size remains only the initial fallback; ResizeObserver plus
 * requestAnimationFrame provide the container-aware value after mount.
 */
export function useAdaptiveItemsPerPage({
  containerNode,
  fallbackItems,
  itemHeightPx,
  headerHeightPx = 0,
  safetyGapPx = 6,
  minItems,
  maxItems,
  enabled = true,
}: AdaptiveItemsPerPageOptions): AdaptiveItemsPerPageResult {
  const { min, max } = resolveBounds(minItems, maxItems);
  const initialItems = resolveFallbackItems(fallbackItems, min, max);
  const [itemsPerPage, setItemsPerPage] = useState(initialItems);
  const itemsPerPageRef = useRef(initialItems);

  useLayoutEffect(() => {
    if (!enabled || !containerNode) {
      return;
    }

    const rowHeight = toNonNegativeFinite(itemHeightPx, 0);
    if (rowHeight <= 0) {
      return;
    }

    let frame: number | null = null;

    const measure = () => {
      frame = null;

      const containerHeight = containerNode.getBoundingClientRect().height;
      if (!Number.isFinite(containerHeight) || containerHeight <= 0) {
        return;
      }

      const availableItemsHeight =
        containerHeight -
        toNonNegativeFinite(headerHeightPx, 0) -
        toNonNegativeFinite(safetyGapPx, 0);
      if (!Number.isFinite(availableItemsHeight) || availableItemsHeight <= 0) {
        return;
      }

      const nextItems = clamp(Math.floor(availableItemsHeight / rowHeight), min, max);
      if (!Number.isFinite(nextItems) || nextItems <= 0) {
        return;
      }

      if (nextItems !== itemsPerPageRef.current) {
        itemsPerPageRef.current = nextItems;
        setItemsPerPage(nextItems);
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
    // The very first measurement runs synchronously (not through rAF) so it
    // lands within this same layout-effect pass, before the browser paints.
    // Deferring it to requestAnimationFrame left the fallback-sized first
    // paint visible for one extra frame, then corrected on the next frame —
    // the F3 settle. Later ResizeObserver-driven remeasures still go through
    // scheduleMeasure to stay rAF-throttled against resize thrashing.
    measure();

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
    itemHeightPx,
    max,
    min,
    safetyGapPx,
  ]);

  return { itemsPerPage };
}
