"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";

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
  const [canvasNode, setCanvasNode] = useState<HTMLElement | null>(null);

  // The three composite reserves this canvas used to subtract by hand — the
  // measured `thead`, the first non-empty row and an 8px cushion — are all CSS
  // now: the head is the reserve token it is itself locked to, and the row is
  // the tier token. Probing them meant the URL `limit` was derived from whatever
  // rows the server had already rendered, so the default page size depended on
  // the page it was computed from.
  const { capacity: itemsPerPage, measured } = useDashboardCanvasCapacity({
    canvasNode,
    fallbackItems: currentLimit,
    minItems: minLimit,
    maxItems: maxLimit,
    enabled: !hasExplicitLimit,
  });

  useEffect(() => {
    if (
      hasExplicitLimit ||
      replacedRef.current ||
      !measured ||
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
    measured,
    itemsPerPage,
    router,
  ]);

  return (
    <div
      ref={setCanvasNode}
      data-dashboard-table-canvas={canvas}
      data-dashboard-adaptive-rows-canvas="true"
      data-dashboard-row-pitch={canvas === "metricas" ? "block" : "tall"}
      {...(canvas === "metricas" ? {} : { "data-dashboard-canvas-reserve": "table-head" })}
      className="h-full min-h-0"
    >
      {children}
    </div>
  );
}
