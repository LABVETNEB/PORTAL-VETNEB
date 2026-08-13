/**
 * Deterministic row-pitch calibration for the zero-scroll adaptive canvases.
 *
 * The adaptive page size of a bounded canvas is `floor(usable / row_pitch)`, so
 * the pitch decides how many rows are rendered — and, while the pitch was read
 * from "the tallest row currently on screen", the rows that were rendered also
 * decided the pitch. That closed loop has ONE fixed point on the canonical
 * first page (its candidate set is a prefix of the dataset, so the measured
 * pitch grows monotonically with the page size and the composition is
 * monotonically non-increasing), but it has as many fixed points as there are
 * pages once an arbitrary page N is allowed to calibrate: page N's slice
 * depends on the very page size the measurement is about to produce. The
 * observable consequence is hysteresis — the same viewport settles on a
 * different page size depending on which page was active when the canvas was
 * resized, and A -> B -> A does not return to A.
 *
 * This module removes the history from the primitive instead of masking it:
 *
 *   1. a geometry is identified by every dimension that is material to
 *      wrapping — inline size AND block size — plus the dataset cardinality;
 *   2. a pitch is only ever WRITTEN from measurements taken on the canonical
 *      page, so no page-N slice can contaminate it;
 *   3. a geometry that must be calibrated while the canvas is off the canonical
 *      page asks for the canonical page, calibrates there and hands the user's
 *      page back;
 *   4. a calibrated geometry is frozen and replayed from the cache, so a cold
 *      arrival and a hot return converge on the same pitch;
 *   5. the probe budget per geometry is bounded and settles on the tallest
 *      probe, so a pathological measurement can never spin the render loop.
 *
 * It is deliberately DOM-free: the consumer feeds it measurements and applies
 * the outcome, which makes every invariant above directly testable.
 */

/** The only page whose rendered rows may calibrate a geometry. */
export const CANONICAL_CALIBRATION_PAGE = 0;

/** Probes per geometry before the calibration is force-settled. */
export const DEFAULT_PROBE_BUDGET = 8;

/** Distinct geometries kept calibrated at once (viewport + reservation mix). */
export const DEFAULT_CACHED_GEOMETRIES = 16;

/**
 * Sub-pixel quantisation of a measured geometry, in CSS px. Coarse enough that
 * layout jitter below a hundredth of a pixel is not a new geometry, fine enough
 * that every real reservation or viewport change still is one.
 */
const GEOMETRY_QUANTUM_PX = 0.01;

export type AdaptiveCanvasGeometry = {
  /** Measured inline size of the canvas (decides wrapping). */
  readonly inlineSize: number;
  /** Measured block size of the canvas (decides how many rows fit). */
  readonly blockSize: number;
  /** Items the canvas is paging over. */
  readonly itemCount: number;
};

export type RowPitchReading = {
  readonly geometry: AdaptiveCanvasGeometry;
  /** Zero-based index of the page currently rendered. */
  readonly page: number;
  /** Tallest row currently rendered, in CSS px. */
  readonly measuredRowPitchPx: number;
};

export type RowPitchReconciliation = {
  /** Pitch to feed the adaptive page-size hook; 0 keeps the current one. */
  readonly rowPitchPx: number;
  /** Page the canvas must render, or `null` to leave the page untouched. */
  readonly requestedPage: number | null;
  /** True while this geometry still needs canonical-page measurements. */
  readonly calibrating: boolean;
};

export type AdaptiveRowPitchCalibratorOptions = {
  readonly probeBudget?: number;
  readonly cachedGeometries?: number;
};

export type AdaptiveRowPitchCalibrator = {
  /** Folds one measurement into the calibration and returns what to apply. */
  reconcile(reading: RowPitchReading): RowPitchReconciliation;
  /** Stable identity of a geometry. Exposed for guards and diagnostics. */
  geometryKey(geometry: AdaptiveCanvasGeometry): string | null;
  /** Settled pitch of a geometry, or 0 while it is still being calibrated. */
  settledRowPitchPx(geometry: AdaptiveCanvasGeometry): number;
};

type GeometryCalibration = {
  readonly rowPitchPx: number;
  readonly tallestProbePx: number;
  readonly probes: number;
  readonly settled: boolean;
};

const HOLD: RowPitchReconciliation = Object.freeze({
  rowPitchPx: 0,
  requestedPage: null,
  calibrating: true,
});

function toPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

/** Anything that is not a real later page counts as the canonical one. */
function isCanonicalPage(page: number): boolean {
  return !Number.isInteger(page) || page <= CANONICAL_CALIBRATION_PAGE;
}

function quantise(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value / GEOMETRY_QUANTUM_PX);
}

export function createAdaptiveRowPitchCalibrator(
  options: AdaptiveRowPitchCalibratorOptions = {},
): AdaptiveRowPitchCalibrator {
  const probeBudget = toPositiveInteger(options.probeBudget, DEFAULT_PROBE_BUDGET);
  const cachedGeometries = toPositiveInteger(
    options.cachedGeometries,
    DEFAULT_CACHED_GEOMETRIES,
  );
  const calibrations = new Map<string, GeometryCalibration>();
  let pendingRestorePage: number | null = null;

  function geometryKey(geometry: AdaptiveCanvasGeometry): string | null {
    const inlineSize = quantise(geometry.inlineSize);
    const blockSize = quantise(geometry.blockSize);
    if (inlineSize === null || blockSize === null) {
      return null;
    }

    const itemCount =
      Number.isFinite(geometry.itemCount) && geometry.itemCount >= 0
        ? Math.floor(geometry.itemCount)
        : -1;

    return `${inlineSize}x${blockSize}n${itemCount}`;
  }

  function remember(key: string, calibration: GeometryCalibration): void {
    calibrations.delete(key);
    calibrations.set(key, calibration);

    while (calibrations.size > cachedGeometries) {
      const oldest = calibrations.keys().next();
      if (oldest.done) {
        return;
      }
      calibrations.delete(oldest.value);
    }
  }

  function takeRestorePage(): number | null {
    const page = pendingRestorePage;
    pendingRestorePage = null;
    return page;
  }

  return {
    geometryKey,

    settledRowPitchPx(geometry) {
      const key = geometryKey(geometry);
      if (key === null) {
        return 0;
      }

      const calibration = calibrations.get(key);
      return calibration?.settled ? calibration.rowPitchPx : 0;
    },

    reconcile({ geometry, page, measuredRowPitchPx }) {
      const key = geometryKey(geometry);
      if (key === null) {
        return HOLD;
      }

      const calibration = calibrations.get(key);

      // Frozen geometry: replayed, never re-measured. This is what makes a hot
      // return to a viewport land on the pitch its cold arrival calibrated, and
      // what stops the render loop once a geometry is settled.
      //
      // The single exception is GROWTH observed on the canonical page: a row
      // reaches its final height a frame or two after it mounts (wrapping,
      // fonts), and a canvas that clips what does not fit may never keep a
      // pitch it has just been proven to under-measure. Growth is monotonic,
      // canonical-only and still bounded by the probe budget, so it re-opens no
      // history: the correction is the same function of the same evidence a
      // cold arrival would have applied.
      if (calibration?.settled) {
        const grewOnCanonicalPage =
          isCanonicalPage(page) &&
          Number.isFinite(measuredRowPitchPx) &&
          measuredRowPitchPx > calibration.rowPitchPx &&
          calibration.probes < probeBudget;

        if (!grewOnCanonicalPage) {
          return {
            rowPitchPx: calibration.rowPitchPx,
            requestedPage: takeRestorePage(),
            calibrating: false,
          };
        }

        remember(key, {
          rowPitchPx: measuredRowPitchPx,
          tallestProbePx: Math.max(calibration.tallestProbePx, measuredRowPitchPx),
          probes: calibration.probes + 1,
          settled: false,
        });
        return {
          rowPitchPx: measuredRowPitchPx,
          requestedPage: null,
          calibrating: true,
        };
      }

      // Off the canonical page the rendered rows are an arbitrary slice, so
      // they are not evidence about this geometry. Ask for the canonical page
      // and remember where the user was; the page is handed back the moment the
      // geometry settles.
      if (!isCanonicalPage(page)) {
        if (pendingRestorePage === null) {
          pendingRestorePage = page;
        }
        return {
          rowPitchPx: 0,
          requestedPage: CANONICAL_CALIBRATION_PAGE,
          calibrating: true,
        };
      }

      if (!Number.isFinite(measuredRowPitchPx) || measuredRowPitchPx <= 0) {
        return HOLD;
      }

      const probes = (calibration?.probes ?? 0) + 1;
      const tallestProbePx = Math.max(
        calibration?.tallestProbePx ?? 0,
        measuredRowPitchPx,
      );

      // Two consecutive canonical probes agreeing IS the fixed point of the
      // measurement loop; nothing is averaged and no value is selected from a
      // pool of readings.
      if (calibration && calibration.rowPitchPx === measuredRowPitchPx) {
        remember(key, {
          rowPitchPx: measuredRowPitchPx,
          tallestProbePx,
          probes,
          settled: true,
        });
        return {
          rowPitchPx: measuredRowPitchPx,
          requestedPage: takeRestorePage(),
          calibrating: false,
        };
      }

      // Bounded fail-closed budget. A geometry whose probes never agree settles
      // on the TALLEST one observed: order-independent (so still deterministic)
      // and the only safe rounding for a canvas that clips what does not fit.
      if (probes >= probeBudget) {
        remember(key, {
          rowPitchPx: tallestProbePx,
          tallestProbePx,
          probes,
          settled: true,
        });
        return {
          rowPitchPx: tallestProbePx,
          requestedPage: takeRestorePage(),
          calibrating: false,
        };
      }

      remember(key, {
        rowPitchPx: measuredRowPitchPx,
        tallestProbePx,
        probes,
        settled: false,
      });
      return {
        rowPitchPx: measuredRowPitchPx,
        requestedPage: null,
        calibrating: true,
      };
    },
  };
}
