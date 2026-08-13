"use client";

import { useLayoutEffect, useRef, useState } from "react";

import {
  clampCapacity,
  computeCapacity,
} from "@/lib/dashboard/capacity/computeCapacity";

/**
 * Single capacity owner for every bounded dashboard canvas.
 *
 * This hook replaces `useAdaptiveItemsPerPage`, `useAdaptiveRowsPerPage` and
 * `useAdaptiveDashboardPageSize`, whose shared defect was not their arithmetic
 * but their INPUT: they measured the row pitch from a row that happened to be
 * rendered, so capacity became a function of the dataset, the active page and
 * the order in which two observers published — a loop that closed through the
 * network on server-paged surfaces.
 *
 * Here the pitch is read from `--dash-row-pitch`, a CSS token that the density
 * tier resolves from geometry alone, and rows are locked to that same token in
 * `zero-scroll.css`. Content is therefore downstream of capacity and nothing
 * points back: `A -> B -> A` returns to `A` by construction rather than by
 * remembering that it did last time.
 *
 * Structural contract, asserted by
 * `test/architecture/dashboard-capacity-single-owner.test.ts`:
 * one `ResizeObserver`, one observed target (the canvas), no
 * `MutationObserver`, no per-row observer, no DOM write, no navigation state,
 * no geometry cache, and a `useLayoutEffect` whose dependencies are exactly
 * `[canvasNode, enabled]` — so a pitch change can never tear the observer down
 * mid-flight and drop the pending frame, which is how the previous engine
 * latched a stale value that only a further resize could clear.
 */

/** The pitch token every adaptive canvas resolves. Authored in px (see below). */
export const DASHBOARD_ROW_PITCH_CUSTOM_PROPERTY = "--dash-row-pitch";

/** Gap between consecutive rows of the same canvas. Authored in px. */
export const DASHBOARD_ROW_GAP_CUSTOM_PROPERTY = "--dash-row-gap";

/**
 * Chrome reserved INSIDE the canvas (a sticky table head, typically).
 *
 * A token rather than a second `ResizeObserver` on the header: measuring it
 * separately is what gave `admin-audit-log` two observers publishing into one
 * capacity without a common snapshot. CSS locks the header to this same token,
 * so the reserve the engine subtracts and the space the header occupies are the
 * same number by construction.
 */
export const DASHBOARD_CANVAS_RESERVED_CUSTOM_PROPERTY = "--dash-canvas-reserved";

export type DashboardCanvasCapacityOptions = {
  /** The bounded canvas. `null` until the ref attaches. */
  readonly canvasNode: HTMLElement | null;
  /** Page size rendered before the first measurement (SSR / first paint). */
  readonly fallbackItems?: number;
  /** Chrome reserved INSIDE the canvas (e.g. a sticky table head). */
  readonly reservedPx?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly enabled?: boolean;
};

export type DashboardCanvasCapacityResult = {
  /** Rows the canvas can hold right now. */
  readonly capacity: number;
  /** `false` until a usable geometry has been read. */
  readonly measured: boolean;
};

type CanvasGeometry = {
  readonly canvasBlockSizePx: number;
  readonly rowPitchPx: number;
  readonly rowGapPx: number;
  readonly reservedPx: number;
};

const UNMEASURED: CanvasGeometry = {
  canvasBlockSizePx: 0,
  rowPitchPx: 0,
  rowGapPx: 0,
  reservedPx: 0,
};

/** Parses a resolved px length. Anything else is 0, never a guess. */
function parsePxValue(raw: string): number {
  if (!raw.endsWith("px")) {
    return 0;
  }

  const parsed = Number.parseFloat(raw);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Resolves one leg of the pitch contract.
 *
 * Custom properties compute to their substituted token, NOT to an absolute
 * length, so `getPropertyValue` only returns something parseable when the token
 * is authored as a plain px literal. That is a contract, not an accident: the
 * pitch tokens in `tokens.css` are px literals and the architecture guard fails
 * the build if a tier is ever authored in `rem`, `clamp()` or any other form
 * this parse would silently reject.
 *
 * Returns 0 — "no usable pitch" — rather than guessing, so the engine reports
 * `measured: false` and the consumer keeps its declared fallback.
 */
function parsePxToken(style: CSSStyleDeclaration, property: string): number {
  return parsePxValue(style.getPropertyValue(property).trim());
}

/**
 * Reads the canvas geometry and its pitch contract in ONE resolution.
 *
 * `blockSizePx` is the CONTENT box, not the border box. `getBoundingClientRect`
 * returns the border box, so a canvas carrying its own padding (`py-1`, `py-2`)
 * made the engine size rows against space the rows could never occupy — it
 * claimed one row too many, and that row overlapped the pager and swallowed the
 * hit-test of "Siguiente", which is pagination being unreachable rather than
 * merely mis-sized. Subtracting padding and border here fixes every canvas at
 * once instead of asking each consumer to remember not to pad itself.
 */
function readCanvasMetrics(canvasNode: HTMLElement): {
  readonly blockSizePx: number;
  readonly rowPitchPx: number;
  readonly rowGapPx: number;
  readonly reservedPx: number;
} {
  const borderBoxPx = canvasNode.getBoundingClientRect().height;
  const view = canvasNode.ownerDocument.defaultView;
  if (!view) {
    return { blockSizePx: 0, rowPitchPx: 0, rowGapPx: 0, reservedPx: 0 };
  }

  // One resolution, every value: reading them through separate calls would
  // reintroduce exactly the split-snapshot problem the two old observers had.
  const style = view.getComputedStyle(canvasNode);
  const edgePx =
    parsePxValue(style.paddingBlockStart) +
    parsePxValue(style.paddingBlockEnd) +
    parsePxValue(style.borderBlockStartWidth) +
    parsePxValue(style.borderBlockEndWidth);

  return {
    blockSizePx: Math.max(0, borderBoxPx - edgePx),
    rowPitchPx: parsePxToken(style, DASHBOARD_ROW_PITCH_CUSTOM_PROPERTY),
    rowGapPx: parsePxToken(style, DASHBOARD_ROW_GAP_CUSTOM_PROPERTY),
    reservedPx: parsePxToken(style, DASHBOARD_CANVAS_RESERVED_CUSTOM_PROPERTY),
  };
}

function sameGeometry(a: CanvasGeometry, b: CanvasGeometry): boolean {
  return (
    a.canvasBlockSizePx === b.canvasBlockSizePx &&
    a.rowPitchPx === b.rowPitchPx &&
    a.rowGapPx === b.rowGapPx &&
    a.reservedPx === b.reservedPx
  );
}

export function useDashboardCanvasCapacity({
  canvasNode,
  fallbackItems,
  reservedPx,
  minItems,
  maxItems,
  enabled = true,
}: DashboardCanvasCapacityOptions): DashboardCanvasCapacityResult {
  const [geometry, setGeometry] = useState<CanvasGeometry>(UNMEASURED);
  const geometryRef = useRef<CanvasGeometry>(UNMEASURED);

  useLayoutEffect(() => {
    if (!enabled || !canvasNode) {
      return;
    }

    let frame: number | null = null;

    const measure = () => {
      frame = null;

      // One coherent snapshot: both readings happen here, before anything is
      // written, so the two halves of the geometry can never describe two
      // different layouts the way two independent observers could.
      const metrics = readCanvasMetrics(canvasNode);
      const next: CanvasGeometry = {
        canvasBlockSizePx: metrics.blockSizePx,
        rowPitchPx: metrics.rowPitchPx,
        rowGapPx: metrics.rowGapPx,
        reservedPx: metrics.reservedPx,
      };

      if (sameGeometry(geometryRef.current, next)) {
        return;
      }

      geometryRef.current = next;
      setGeometry(next);
    };

    const scheduleMeasure = () => {
      if (frame !== null) {
        return;
      }

      frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(canvasNode);
    // The first measurement is synchronous so the fallback-sized paint is
    // corrected inside this same layout pass; later resize-driven remeasures
    // stay rAF-coalesced at one per frame.
    measure();

    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [canvasNode, enabled]);

  // Derived during render, not stored: bounds are consumer constants, and
  // deriving here means a bound can never be applied one commit late against a
  // geometry that has already moved on.
  const decision = computeCapacity({
    canvasBlockSizePx: geometry.canvasBlockSizePx,
    rowPitchPx: geometry.rowPitchPx,
    rowGapPx: geometry.rowGapPx,
    // An explicit reserve wins; otherwise CSS declares it through the token it
    // also locks the header to.
    reservedPx: reservedPx ?? geometry.reservedPx,
    minItems,
    maxItems,
  });

  if (decision.measured || fallbackItems === undefined) {
    return decision;
  }

  // Pre-measurement only. A constant, so it closes no loop; it is clamped into
  // the same window every measured result lives in.
  return {
    capacity: clampCapacity(fallbackItems, minItems, maxItems),
    measured: false,
  };
}
