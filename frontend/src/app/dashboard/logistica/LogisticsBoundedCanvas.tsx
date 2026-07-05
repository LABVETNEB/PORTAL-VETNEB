"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAdaptiveDashboardPageSize } from "@/hooks/useAdaptiveDashboardPageSize";

export type LogisticsBoundedCanvasProps = {
  /** Which logistics full-route table/list this canvas bounds. */
  canvas: "visitas" | "rutas" | "metricas";
  /** Route used to recompute the URL `limit` from the measured canvas. */
  basePath: string;
  /**
   * True when the URL carries an explicit `limit` — the URL pager contract
   * (offset/limit round-trip) always wins over the adaptive recomputation.
   */
  hasExplicitLimit: boolean;
  currentLimit: number;
  minLimit?: number;
  maxLimit: number;
  /** Pre-measurement row height estimate. */
  rowFallbackPx?: number;
  children: ReactNode;
};

/**
 * Bounded data canvas for the logistics full routes (Block E).
 *
 * The server keeps the deterministic URL `offset/limit` pagination; this
 * client layer only makes the *default* page size container-aware: when the
 * URL has no explicit `limit`, the canvas measures how many real rows fit and
 * replaces the URL once with `offset=0&limit=<measured>` so the server
 * renders exactly the rows the viewport can show — no clipped rows, no
 * internal scroller, pager always visible.
 */
export function LogisticsBoundedCanvas({
  canvas,
  basePath,
  hasExplicitLimit,
  currentLimit,
  minLimit = 3,
  maxLimit,
  rowFallbackPx = 56,
  children,
}: LogisticsBoundedCanvasProps) {
  const router = useRouter();
  const replacedRef = useRef(false);
  const [rowHeightPx, setRowHeightPx] = useState(rowFallbackPx);
  const [headerHeightPx, setHeaderHeightPx] = useState(0);
  const [hasMeasurableRows, setHasMeasurableRows] = useState(false);

  const { containerRef, itemsPerPage, isMeasured } =
    useAdaptiveDashboardPageSize({
      fallbackItems: currentLimit,
      rowHeightPx,
      headerHeightPx,
      safetyBufferPx: 8,
      minItems: minLimit,
      maxItems: maxLimit,
      enabled: !hasExplicitLimit,
    });

  // Row/header geometry comes from the real rendered rows (desktop table row,
  // mobile row variant or metric block — whichever is visible).
  useEffect(() => {
    const node = containerRef.current;
    if (!node || hasExplicitLimit) {
      return;
    }

    let frame: number | null = null;

    const measure = () => {
      frame = null;

      const thead = node.querySelector("thead");
      const theadRect = thead?.getBoundingClientRect();
      const nextHeaderHeight =
        theadRect && theadRect.height > 0 ? theadRect.height : 0;

      const rowCandidates = node.querySelectorAll<HTMLElement>(
        "tbody tr:not(:has(.clinical-table-state)), [data-logistics-mobile-row], [data-logistics-metric-block]",
      );
      let nextRowHeight = 0;
      for (const candidate of rowCandidates) {
        const rect = candidate.getBoundingClientRect();
        if (rect.height > 0) {
          nextRowHeight = rect.height;
          break;
        }
      }

      setHeaderHeightPx((previous) =>
        previous === nextHeaderHeight ? previous : nextHeaderHeight,
      );
      if (nextRowHeight > 0) {
        setHasMeasurableRows(true);
        setRowHeightPx((previous) =>
          previous === nextRowHeight ? previous : nextRowHeight,
        );
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
  }, [containerRef, hasExplicitLimit]);

  useEffect(() => {
    if (
      hasExplicitLimit ||
      replacedRef.current ||
      !isMeasured ||
      !hasMeasurableRows ||
      itemsPerPage <= 0 ||
      itemsPerPage === currentLimit
    ) {
      return;
    }

    replacedRef.current = true;
    router.replace(`${basePath}?offset=0&limit=${itemsPerPage}`, {
      scroll: false,
    });
  }, [
    basePath,
    currentLimit,
    hasExplicitLimit,
    hasMeasurableRows,
    isMeasured,
    itemsPerPage,
    router,
  ]);

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
      }}
      data-dashboard-table-canvas={canvas}
    >
      {children}
    </div>
  );
}
