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
  /** `md:hidden` canonical-row rows (CMP-08: pitch "regular", 44px). */
  mobileChildren: ReactNode;
  /** `hidden md:flex|block` rows — unchanged from the pre-CMP-08 markup. */
  desktopChildren: ReactNode;
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
 *
 * CMP-08: mobile and desktop are mutually exclusive by media query (same
 * split as `AdminSessionsReadOnlyCard`/`AdminUsersRolesReadOnlyCard` —
 * "one owner per canvas... exactly one reports `measured`"), so each gets its
 * own canvas node and its own row pitch: mobile rows are the canonical
 * "regular" (44px) row, desktop keeps its original "tall"/"block" pitch and
 * markup untouched. `itemsPerPage` collapses whichever side is actually
 * visible into the single URL `limit` both share.
 */
export function LogisticsBoundedCanvas({
  canvas,
  basePath,
  hasExplicitLimit,
  currentLimit,
  minLimit = 3,
  maxLimit,
  mobileChildren,
  desktopChildren,
}: LogisticsBoundedCanvasProps) {
  const router = useRouter();
  const replacedRef = useRef(false);
  const [mobileNode, setMobileNode] = useState<HTMLElement | null>(null);
  const [desktopNode, setDesktopNode] = useState<HTMLElement | null>(null);

  const mobileCapacity = useDashboardCanvasCapacity({
    canvasNode: mobileNode,
    fallbackItems: currentLimit,
    minItems: minLimit,
    maxItems: maxLimit,
    enabled: !hasExplicitLimit,
  });
  const desktopCapacity = useDashboardCanvasCapacity({
    canvasNode: desktopNode,
    fallbackItems: currentLimit,
    minItems: minLimit,
    maxItems: maxLimit,
    enabled: !hasExplicitLimit,
  });
  const measured = mobileCapacity.measured || desktopCapacity.measured;
  const itemsPerPage = mobileCapacity.measured
    ? mobileCapacity.capacity
    : desktopCapacity.measured
      ? desktopCapacity.capacity
      : currentLimit;

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

  // Both regimes carry the same logical canvas id: it names the domain canvas
  // (`visitas`, `rutas`, `metricas`), not the breakpoint that renders it. Every
  // consumer resolves it visible-filtered, and the two panes are mutually
  // exclusive (`md:hidden` / `hidden md:block`), so exactly one answers at any
  // viewport.
  return (
    <>
      <div
        ref={setMobileNode}
        data-dashboard-table-canvas={canvas}
        data-dashboard-adaptive-rows-canvas="true"
        data-dashboard-row-pitch="regular"
        className="h-full min-h-0 w-full min-w-0 md:hidden"
      >
        {mobileChildren}
      </div>
      <div
        ref={setDesktopNode}
        data-dashboard-table-canvas={canvas}
        data-dashboard-adaptive-rows-canvas="true"
        data-dashboard-row-pitch={canvas === "metricas" ? "block" : "tall"}
        {...(canvas === "metricas" ? {} : { "data-dashboard-canvas-reserve": "table-head" })}
        className="hidden h-full min-h-0 md:block"
      >
        {desktopChildren}
      </div>
    </>
  );
}
