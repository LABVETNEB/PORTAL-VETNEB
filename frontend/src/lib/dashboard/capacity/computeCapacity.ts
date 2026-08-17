/**
 * Pitch-locked capacity engine — the single arithmetic authority for how many
 * rows a bounded dashboard canvas can hold.
 *
 * The adaptive page size used to be a function of the RENDER: the row pitch was
 * probed from a row that was actually on screen, so it depended on which slice
 * was mounted, which depended on the page size, which depended on the pitch.
 * Six of the seven arguments of that function described the path taken rather
 * than the state reached, so `A -> B -> A` was under no obligation to return to
 * `A` (observed in CI as `admin-audit-log` settling on 9 then 8 for the very
 * same viewport).
 *
 * This module is the fixed point of that redesign:
 *
 *     capacity = f(canvasBlockSizePx, rowPitchPx, reservedPx, minItems, maxItems)
 *
 * and nothing else. It has no imports, touches no DOM, holds no module state,
 * caches nothing and cannot observe the dataset — `itemCount` is deliberately
 * NOT a parameter, which is what makes the old pitch feedback loop impossible
 * to even express here.
 */

/**
 * Layout quantum, in CSS px.
 *
 * Chromium resolves layout in `LayoutUnit`s of exactly 1/64 px, so every box
 * geometry this engine is fed has already been rounded to that lattice by the
 * engine that produced it; readings that differ by less than one unit describe
 * the same layout, not a different one. Being a power of two it is also exactly
 * representable in binary floating point, which is what makes `quantise`
 * idempotent to the last bit rather than merely idempotent in practice.
 *
 * Measured before being adopted (Phase A.0), not inherited from the audit: an
 * instrumented A05 run over `logistics-recent-list` (26 A->B->A pairs, 130
 * readings, 13 viewports x 2 leaves) reported a canvas dispersion of exactly
 * 0 px, and all 15 distinct canvas readings fell on the 1/64 lattice. So
 * `quantise` is the identity on real browser geometry — it cannot move a
 * reading that is already correct — while still absorbing the epsilon that
 * derived arithmetic (rem-based reserves, divisions) can introduce at the
 * `floor` discontinuity. See
 * `docs/implementation/dashboard-pitch-locked-capacity-engine.md`.
 */
export const CAPACITY_SUBPIXEL_QUANTUM_PX = 1 / 64;

/** Bound used when a consumer declares no explicit ceiling. */
const DEFAULT_MAX_ITEMS = 50;

export type CapacityInput = {
  /** Block size of the bounded canvas, in CSS px, as measured once per frame. */
  readonly canvasBlockSizePx: number;
  /** Locked row box for the active density tier, in CSS px. Excludes the gap. */
  readonly rowPitchPx: number;
  /**
   * Gap between consecutive rows, in CSS px.
   *
   * `n` rows separated by `n - 1` gaps occupy `n * pitch + (n - 1) * gap`, so
   * ignoring the gap is not a rounding error, it is an off-by-one row: a canvas
   * of 110 px holds two 51 px rows with a 6 px gap (108 px), and a gapless
   * `floor(110 / 51)` would claim two while a naive `floor(110 / 57)` would
   * concede only one. Defaults to 0, where the arithmetic collapses to the
   * plain `floor(usable / pitch)`.
   */
  readonly rowGapPx?: number;
  /** Chrome reserved INSIDE the canvas (e.g. a sticky table head). */
  readonly reservedPx?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
};

export type CapacityDecision = {
  /** Rows the canvas can hold, always within `[minItems, maxItems]`. */
  readonly capacity: number;
  /** `false` when the inputs did not describe a usable geometry. */
  readonly measured: boolean;
};

function isUsableNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toPositiveInteger(value: number | undefined, fallback: number): number {
  if (!isUsableNumber(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Resolves the clamp window. An inverted window is not an error the caller can
 * act on mid-layout, so the ceiling is raised to the floor: the result is always
 * a real, non-empty range and never `NaN`.
 */
function resolveBounds(
  minItems: number | undefined,
  maxItems: number | undefined,
): { readonly min: number; readonly max: number } {
  const min = toPositiveInteger(minItems, 1);
  const max = Math.max(min, toPositiveInteger(maxItems, DEFAULT_MAX_ITEMS));

  return { min, max };
}

/**
 * Clamps a caller-supplied count into the same window a measured capacity lives
 * in. Used for pre-measurement fallbacks, which must obey the consumer's bounds
 * exactly as a measured result does — a fallback outside the window would make
 * the very first paint disagree with every later one.
 */
export function clampCapacity(
  value: number,
  minItems?: number,
  maxItems?: number,
): number {
  const { min, max } = resolveBounds(minItems, maxItems);

  return clamp(toPositiveInteger(value, min), min, max);
}

/**
 * Snaps a length to the layout lattice.
 *
 * Idempotent by construction (`quantise(quantise(x)) === quantise(x)` exactly)
 * and total: a non-finite input yields `NaN` rather than throwing, so callers
 * can validate once instead of guarding every arithmetic site. A non-positive
 * quantum disables snapping and returns the value unchanged.
 */
export function quantise(
  value: number,
  quantum: number = CAPACITY_SUBPIXEL_QUANTUM_PX,
): number {
  if (!isUsableNumber(value)) {
    return Number.NaN;
  }

  if (!isUsableNumber(quantum) || quantum <= 0) {
    return value;
  }

  return Math.round(value / quantum) * quantum;
}

/**
 * Derives the visible capacity of a bounded canvas.
 *
 * Total function: every rejected input resolves to `minItems` with
 * `measured: false` instead of throwing, because this runs inside a layout
 * effect where a throw would take the surface down. `measured` distinguishes
 * "the geometry was not usable" from "the geometry was usable and only one row
 * fits", which are the same number but not the same fact.
 */
export function computeCapacity(input: CapacityInput): CapacityDecision {
  const { min, max } = resolveBounds(input.minItems, input.maxItems);
  const reservedInput = input.reservedPx ?? 0;
  const gapInput = input.rowGapPx ?? 0;

  const inputsAreUsable =
    isUsableNumber(input.canvasBlockSizePx) &&
    input.canvasBlockSizePx > 0 &&
    isUsableNumber(input.rowPitchPx) &&
    input.rowPitchPx > 0 &&
    isUsableNumber(reservedInput) &&
    reservedInput >= 0 &&
    isUsableNumber(gapInput) &&
    gapInput >= 0;

  if (!inputsAreUsable) {
    return { capacity: min, measured: false };
  }

  const gap = quantise(gapInput);
  // `stride` is what each additional row actually costs; the first row costs
  // one gap less, which is why the gap is added back to the usable height
  // instead of being subtracted from the pitch.
  const stride = quantise(input.rowPitchPx) + gap;
  if (stride <= 0) {
    // A stride below half a layout unit cannot hold a row at any canvas size.
    return { capacity: min, measured: false };
  }

  const usable = quantise(input.canvasBlockSizePx) - quantise(reservedInput) + gap;
  if (usable < stride) {
    // Measured, and the honest answer is "less than one row fits". The floor
    // still applies: the surface renders `min` rows rather than nothing.
    return { capacity: min, measured: true };
  }

  return { capacity: clamp(Math.floor(usable / stride), min, max), measured: true };
}
