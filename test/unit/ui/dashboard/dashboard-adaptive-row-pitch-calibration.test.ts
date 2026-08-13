import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CANONICAL_CALIBRATION_PAGE,
  createAdaptiveRowPitchCalibrator,
  type AdaptiveCanvasGeometry,
} from "../../../../frontend/src/components/dashboard/adaptiveRowPitchCalibration.ts";

// A05 · history-independent adaptive calibration.
//
// The adaptive page size of a bounded canvas is `floor(usable / row_pitch)`,
// and the pitch used to be read from the rows CURRENTLY rendered. Rows are not
// uniform, so the measured pitch depended on the active slice, the slice
// depended on the page size and the page size depended on the pitch: a closed
// loop with one fixed point per page. The same viewport then settled on a
// different cardinality depending on how it had been reached — observed in CI
// as `logistics-recent-list::w430x932::recent-visits` returning 2 after
// A -> B -> A where the same geometry had just measured 1.
//
// These tests drive the real closed loop against the primitive, with a dataset
// whose later rows are TALLER than the first ones (the long clinic name that
// wraps on a narrow phone). They pin the invariants, never a viewport, never a
// leaf and never a value.

const CALIBRATION_MODULE_PATH =
  "frontend/src/components/dashboard/adaptiveRowPitchCalibration.ts";
const LOGISTICS_RECENT_PATH =
  "frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx";

const SAFETY_BUFFER_PX = 8;
const MIN_ITEMS = 1;
const MAX_ITEMS = 12;
const PITCH_SEED_PX = 52;

/**
 * Row heights of the modelled dataset. The first rows are short; row 1 is the
 * tall one, so any slice that contains it measures a larger pitch than the
 * canonical first page does — exactly the contamination the primitive must
 * refuse.
 */
const ROW_HEIGHTS_PX = [
  44, 96, 44, 44, 44, 44, 44, 44, 44, 44, 44, 44, 44, 44, 44, 44,
];

type CanvasModel = {
  readonly inlineSize: number;
  readonly blockSize: number;
  readonly rowHeightsPx: readonly number[];
};

type SettledCanvas = {
  readonly rowPitchPx: number;
  readonly limit: number;
  readonly page: number;
  readonly frames: number;
  readonly canonicalPageVisits: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Mirrors `useAdaptiveDashboardPageSize`: floor(usable / pitch), clamped. */
function limitFor(model: CanvasModel, rowPitchPx: number): number {
  const usable = model.blockSize - SAFETY_BUFFER_PX;
  return clamp(Math.floor(usable / rowPitchPx), MIN_ITEMS, MAX_ITEMS);
}

function geometryOf(model: CanvasModel): AdaptiveCanvasGeometry {
  return {
    inlineSize: model.inlineSize,
    blockSize: model.blockSize,
    itemCount: model.rowHeightsPx.length,
  };
}

/**
 * Runs the real runtime loop — measure the rendered slice, reconcile, apply the
 * outcome, re-render — until it goes quiet. Fails closed instead of returning a
 * mid-flight reading if it never does.
 */
function settle(
  calibrator: ReturnType<typeof createAdaptiveRowPitchCalibrator>,
  model: CanvasModel,
  options: { readonly startPage?: number; readonly startPitchPx?: number } = {},
): SettledCanvas {
  const frameBudget = 64;
  let rowPitchPx = options.startPitchPx ?? PITCH_SEED_PX;
  let page = options.startPage ?? CANONICAL_CALIBRATION_PAGE;
  let canonicalPageVisits = 0;

  for (let frame = 1; frame <= frameBudget; frame += 1) {
    const limit = limitFor(model, rowPitchPx);
    const pageCount = Math.max(1, Math.ceil(model.rowHeightsPx.length / limit));
    page = clamp(page, 0, pageCount - 1);
    if (page === CANONICAL_CALIBRATION_PAGE) {
      canonicalPageVisits += 1;
    }

    const rendered = model.rowHeightsPx.slice(page * limit, page * limit + limit);
    const measuredRowPitchPx = rendered.reduce(
      (tallest, height) => Math.max(tallest, height),
      0,
    );

    const outcome = calibrator.reconcile({
      geometry: geometryOf(model),
      page,
      measuredRowPitchPx,
    });

    const nextPitch = outcome.rowPitchPx > 0 ? outcome.rowPitchPx : rowPitchPx;
    const nextPage = outcome.requestedPage ?? page;
    const quiet =
      nextPitch === rowPitchPx &&
      nextPage === page &&
      outcome.requestedPage === null;

    rowPitchPx = nextPitch;
    page = nextPage;

    if (quiet) {
      const limitAtRest = limitFor(model, rowPitchPx);
      const pagesAtRest = Math.max(
        1,
        Math.ceil(model.rowHeightsPx.length / limitAtRest),
      );
      return {
        rowPitchPx,
        limit: limitAtRest,
        page: clamp(page, 0, pagesAtRest - 1),
        frames: frame,
        canonicalPageVisits,
      };
    }
  }

  throw new Error(
    "adaptive calibration never went quiet — the render loop is unbounded",
  );
}

/** A geometry that fits two short rows but only one tall one. */
const VIEWPORT_A: CanvasModel = {
  inlineSize: 398,
  blockSize: 104,
  rowHeightsPx: ROW_HEIGHTS_PX,
};

/** Same block size, different inline size: wrapping can differ. */
const VIEWPORT_A_NARROWER: CanvasModel = {
  inlineSize: 380,
  blockSize: 104,
  rowHeightsPx: ROW_HEIGHTS_PX,
};

/** Same inline size, different block size: capacity differs. */
const VIEWPORT_B: CanvasModel = {
  inlineSize: 398,
  blockSize: 260,
  rowHeightsPx: ROW_HEIGHTS_PX,
};

test("same geometry and same data always calibrate the same page size", () => {
  const first = settle(createAdaptiveRowPitchCalibrator(), VIEWPORT_A);
  const second = settle(createAdaptiveRowPitchCalibrator(), VIEWPORT_A);

  assert.equal(second.rowPitchPx, first.rowPitchPx);
  assert.equal(second.limit, first.limit);
  assert.ok(first.limit > 0, "the measured cardinality must stay real");
});

test("a geometry reached on a later page calibrates exactly like a cold arrival", () => {
  const cold = settle(createAdaptiveRowPitchCalibrator(), VIEWPORT_A);

  // The tall row lives on a later slice: reaching this geometry while paged is
  // precisely what used to freeze the canvas on the contaminated pitch.
  const hot = settle(createAdaptiveRowPitchCalibrator(), VIEWPORT_A, {
    startPage: 1,
  });

  assert.equal(hot.rowPitchPx, cold.rowPitchPx);
  assert.equal(hot.limit, cold.limit);
  assert.ok(
    hot.canonicalPageVisits > 0,
    "calibration must have been taken on the canonical page",
  );
});

test("the page the user was on is handed back after an off-canonical calibration", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();
  const settled = settle(calibrator, VIEWPORT_A, { startPage: 2 });

  const pageCount = Math.ceil(ROW_HEIGHTS_PX.length / settled.limit);
  assert.equal(settled.page, Math.min(2, pageCount - 1));
});

test("A -> B -> A returns to the page size A calibrated", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();

  const firstA = settle(calibrator, VIEWPORT_A);
  const atB = settle(calibrator, VIEWPORT_B, { startPage: 1 });
  const returnedA = settle(calibrator, VIEWPORT_A, {
    startPage: 1,
    startPitchPx: atB.rowPitchPx,
  });

  assert.equal(returnedA.rowPitchPx, firstA.rowPitchPx);
  assert.equal(returnedA.limit, firstA.limit);
});

test("a settled geometry ignores any later-page measurement", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();
  const settled = settle(calibrator, VIEWPORT_A);

  const contaminated = calibrator.reconcile({
    geometry: geometryOf(VIEWPORT_A),
    page: 3,
    measuredRowPitchPx: settled.rowPitchPx * 4,
  });

  assert.equal(contaminated.rowPitchPx, settled.rowPitchPx);
  assert.equal(contaminated.requestedPage, null);
  assert.equal(contaminated.calibrating, false);
  assert.equal(
    calibrator.settledRowPitchPx(geometryOf(VIEWPORT_A)),
    settled.rowPitchPx,
  );
});

test("a material inline-size change is a different geometry", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();

  assert.notEqual(
    calibrator.geometryKey(geometryOf(VIEWPORT_A)),
    calibrator.geometryKey(geometryOf(VIEWPORT_A_NARROWER)),
  );

  settle(calibrator, VIEWPORT_A);
  assert.equal(
    calibrator.settledRowPitchPx(geometryOf(VIEWPORT_A_NARROWER)),
    0,
    "a width change must not inherit the previous geometry's pitch",
  );
});

test("a material block-size change is a different geometry", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();

  assert.notEqual(
    calibrator.geometryKey(geometryOf(VIEWPORT_A)),
    calibrator.geometryKey(geometryOf(VIEWPORT_B)),
  );

  settle(calibrator, VIEWPORT_A);
  assert.equal(calibrator.settledRowPitchPx(geometryOf(VIEWPORT_B)), 0);
});

test("a dataset change is a different geometry", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();
  const reloaded: CanvasModel = {
    ...VIEWPORT_A,
    rowHeightsPx: ROW_HEIGHTS_PX.slice(0, ROW_HEIGHTS_PX.length - 1),
  };

  assert.notEqual(
    calibrator.geometryKey(geometryOf(VIEWPORT_A)),
    calibrator.geometryKey(geometryOf(reloaded)),
  );
});

test("sub-pixel jitter below the quantum is not a new geometry", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();
  const jittered: CanvasModel = {
    ...VIEWPORT_A,
    blockSize: VIEWPORT_A.blockSize + 0.001,
  };

  assert.equal(
    calibrator.geometryKey(geometryOf(jittered)),
    calibrator.geometryKey(geometryOf(VIEWPORT_A)),
  );
});

/** Uniform rows: the probe loop reaches agreement instead of the budget. */
const VIEWPORT_UNIFORM: CanvasModel = {
  inlineSize: 398,
  blockSize: 200,
  rowHeightsPx: Array.from({ length: 16 }, () => 44),
};

test("a converging geometry settles on two agreeing canonical probes", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();
  const settled = settle(calibrator, VIEWPORT_UNIFORM);

  assert.equal(settled.rowPitchPx, 44);
  assert.equal(settled.limit, limitFor(VIEWPORT_UNIFORM, 44));
  assert.ok(settled.frames <= 4, "agreement must not cost the whole budget");
});

test("a settled geometry is re-opened only by growth on the canonical page", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();
  const settled = settle(calibrator, VIEWPORT_UNIFORM);
  const geometry = geometryOf(VIEWPORT_UNIFORM);

  // A taller slice on a later page is not evidence about this geometry.
  const laterPage = calibrator.reconcile({
    geometry,
    page: 2,
    measuredRowPitchPx: settled.rowPitchPx + 40,
  });
  assert.equal(laterPage.rowPitchPx, settled.rowPitchPx);
  assert.equal(laterPage.calibrating, false);
  assert.equal(calibrator.settledRowPitchPx(geometry), settled.rowPitchPx);

  // A shorter canonical row never re-opens: only growth can clip a row.
  const shrunk = calibrator.reconcile({
    geometry,
    page: CANONICAL_CALIBRATION_PAGE,
    measuredRowPitchPx: settled.rowPitchPx - 8,
  });
  assert.equal(shrunk.rowPitchPx, settled.rowPitchPx);
  assert.equal(shrunk.calibrating, false);

  // Rows that finish growing after the first commit (wrapping, fonts) must be
  // adopted, or the canvas keeps a page size it has been proven to overfill.
  const grown = calibrator.reconcile({
    geometry,
    page: CANONICAL_CALIBRATION_PAGE,
    measuredRowPitchPx: settled.rowPitchPx + 8,
  });
  assert.equal(grown.rowPitchPx, settled.rowPitchPx + 8);
  assert.equal(grown.calibrating, true);
  assert.equal(grown.requestedPage, null);

  const resettled = settle(calibrator, {
    ...VIEWPORT_UNIFORM,
    rowHeightsPx: VIEWPORT_UNIFORM.rowHeightsPx.map((height) => height + 8),
  });
  assert.equal(resettled.rowPitchPx, settled.rowPitchPx + 8);
});

test("a settled geometry stops the measurement loop entirely", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();
  const settled = settle(calibrator, VIEWPORT_A);

  for (let repeat = 0; repeat < 32; repeat += 1) {
    const outcome = calibrator.reconcile({
      geometry: geometryOf(VIEWPORT_A),
      page: CANONICAL_CALIBRATION_PAGE,
      measuredRowPitchPx: settled.rowPitchPx,
    });
    assert.equal(outcome.rowPitchPx, settled.rowPitchPx);
    assert.equal(outcome.requestedPage, null);
    assert.equal(outcome.calibrating, false);
  }
});

test("a pitch that never agrees is force-settled inside a bounded budget", () => {
  const probeBudget = 4;
  const calibrator = createAdaptiveRowPitchCalibrator({ probeBudget });
  const geometry = geometryOf(VIEWPORT_A);
  const oscillation = [40, 90];
  let settledAt = 0;

  for (let probe = 0; probe < probeBudget * 4; probe += 1) {
    const outcome = calibrator.reconcile({
      geometry,
      page: CANONICAL_CALIBRATION_PAGE,
      measuredRowPitchPx: oscillation[probe % oscillation.length],
    });
    if (!outcome.calibrating) {
      settledAt = probe + 1;
      break;
    }
  }

  assert.ok(settledAt > 0, "an oscillating probe must still settle");
  assert.ok(settledAt <= probeBudget, "the probe budget must bound the loop");
  assert.equal(
    calibrator.settledRowPitchPx(geometry),
    Math.max(...oscillation),
    "an unresolved oscillation settles on the tallest probe, never a clipped row",
  );
});

test("an unmeasurable canvas holds instead of guessing", () => {
  const calibrator = createAdaptiveRowPitchCalibrator();

  const collapsed = calibrator.reconcile({
    geometry: { inlineSize: 0, blockSize: 0, itemCount: 4 },
    page: CANONICAL_CALIBRATION_PAGE,
    measuredRowPitchPx: 44,
  });
  assert.equal(collapsed.rowPitchPx, 0);
  assert.equal(collapsed.requestedPage, null);

  const empty = calibrator.reconcile({
    geometry: geometryOf(VIEWPORT_A),
    page: CANONICAL_CALIBRATION_PAGE,
    measuredRowPitchPx: 0,
  });
  assert.equal(empty.rowPitchPx, 0);
  assert.equal(empty.requestedPage, null);
});

test("the primitive freezes no page size and no viewport", () => {
  const source = readFileSync(
    resolve(process.cwd(), CALIBRATION_MODULE_PATH),
    "utf8",
  );

  assert.doesNotMatch(source, /(?:360|375|390|412|430|1024|1280|1366)px/);
  assert.doesNotMatch(source, /limit\s*[:=]\s*(?:1|2|3|12|16)\b/);
  assert.ok(
    !source.includes("setTimeout") && !source.includes("Date.now"),
    "convergence must be a condition, never a duration",
  );
});

test("LogisticsRecentListCanvas delegates its pitch to the calibrator", () => {
  const source = readFileSync(
    resolve(process.cwd(), LOGISTICS_RECENT_PATH),
    "utf8",
  ).replace(/\r\n/g, "\n");

  assert.ok(
    source.includes("createAdaptiveRowPitchCalibrator") &&
      source.includes("calibrator.reconcile({"),
    "the canvas must not own a second calibration rule",
  );
  assert.ok(
    source.includes("inlineSize: canvas.width,") &&
      source.includes("blockSize: canvas.height,"),
    "both material dimensions must reach the geometry key",
  );
  assert.ok(
    source.includes("page: pageRef.current,"),
    "the calibrator must know which page produced the measurement",
  );
  assert.ok(
    source.includes("if (outcome.requestedPage !== null) {") &&
      source.includes("setPageRef.current(outcome.requestedPage);"),
    "the canonical-page transition and its restore must be applied",
  );
  assert.ok(
    !source.includes("rowPitchRef"),
    "the superseded container-height-only pitch cache must be gone",
  );
});
