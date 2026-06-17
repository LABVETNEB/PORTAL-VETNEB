"use client";

import { useEffect, useMemo, useState } from "react";

export type PagedRows<T> = {
  /** Items for the current page. */
  pageItems: T[];
  /** Zero-based current page index. */
  page: number;
  /** Total number of pages (>= 1). */
  pageCount: number;
  /** Total number of items across all pages. */
  total: number;
  /** 1-based index of the first visible item (0 when empty). */
  rangeStart: number;
  /** 1-based index of the last visible item (0 when empty). */
  rangeEnd: number;
  hasPrev: boolean;
  hasNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  setPage: (page: number) => void;
};

/**
 * Client-side pagination over an in-memory array.
 *
 * The App Shell uses this to bound how many rows a module renders so the body
 * fits a single desktop viewport without scrolling — the full dataset stays
 * reachable through the pager instead of being clipped or scrolled.
 */
export function usePagedRows<T>(items: T[], pageSize: number): PagedRows<T> {
  const safePageSize = Math.max(1, pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / safePageSize));
  const [page, setPageState] = useState(0);

  // Clamp the active page whenever the dataset shrinks (filters, reloads).
  const clampedPage = Math.min(page, pageCount - 1);

  useEffect(() => {
    if (page !== clampedPage) {
      setPageState(clampedPage);
    }
  }, [page, clampedPage]);

  const pageItems = useMemo(() => {
    const start = clampedPage * safePageSize;
    return items.slice(start, start + safePageSize);
  }, [items, clampedPage, safePageSize]);

  const rangeStart = total === 0 ? 0 : clampedPage * safePageSize + 1;
  const rangeEnd = Math.min(total, (clampedPage + 1) * safePageSize);

  return {
    pageItems,
    page: clampedPage,
    pageCount,
    total,
    rangeStart,
    rangeEnd,
    hasPrev: clampedPage > 0,
    hasNext: clampedPage < pageCount - 1,
    goPrev: () => setPageState((current) => Math.max(0, current - 1)),
    goNext: () =>
      setPageState((current) => Math.min(pageCount - 1, current + 1)),
    setPage: (next: number) =>
      setPageState(Math.min(Math.max(0, next), pageCount - 1)),
  };
}
