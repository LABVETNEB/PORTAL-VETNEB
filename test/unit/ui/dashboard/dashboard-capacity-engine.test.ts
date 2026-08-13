import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPACITY_SUBPIXEL_QUANTUM_PX,
  clampCapacity,
  computeCapacity,
  quantise,
  type CapacityInput,
} from "../../../../frontend/src/lib/dashboard/capacity/computeCapacity.ts";

// Option D · pitch-locked capacity engine.
//
// The property under test is not "the arithmetic is right" — it is that the
// arithmetic is a FUNCTION. The previous engine derived capacity from the
// rendered slice, so the same viewport could settle on a different cardinality
// depending on how it had been reached (`admin-audit-log` returning 8 where it
// had just measured 9). These tests pin the invariants of the replacement: same
// input -> same output, no call-order effect, no dataset input, and a `floor`
// that does not flip on sub-pixel noise below the layout quantum.
//
// They pin no viewport and no module. `itemCount` is deliberately absent: the
// old feedback loop cannot even be written against this signature.

const Q = CAPACITY_SUBPIXEL_QUANTUM_PX;

/** Deterministic PRNG: a failing case must be reproducible from the source. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function generateInputs(count: number): CapacityInput[] {
  const random = makeRandom(0x5eed_1650);
  return Array.from({ length: count }, () => {
    const minItems = 1 + Math.floor(random() * 4);
    return {
      canvasBlockSizePx: Math.round(random() * 1_200 * 64) / 64,
      rowPitchPx: Math.round((12 + random() * 80) * 64) / 64,
      reservedPx: Math.round(random() * 90 * 64) / 64,
      minItems,
      maxItems: minItems + Math.floor(random() * 30),
    };
  });
}

test("the same input always yields the same output", () => {
  for (const input of generateInputs(200)) {
    const first = computeCapacity(input);
    const second = computeCapacity(input);
    const third = computeCapacity({ ...input });

    assert.deepEqual(second, first);
    assert.deepEqual(third, first);
  }
});

test("results are independent of call order", () => {
  const inputs = generateInputs(200);
  const forward = inputs.map((input) => computeCapacity(input).capacity);

  // Reverse order, then an interleaved order: a module holding state (a cache,
  // a latched ref, a previous-capacity memo) would disagree with itself here.
  const backward = [...inputs]
    .reverse()
    .map((input) => computeCapacity(input).capacity)
    .reverse();

  const interleaved = new Array<number>(inputs.length);
  for (let index = 0; index < inputs.length; index += 2) {
    interleaved[index] = computeCapacity(inputs[index]).capacity;
  }
  for (let index = 1; index < inputs.length; index += 2) {
    interleaved[index] = computeCapacity(inputs[index]).capacity;
  }

  assert.deepEqual(backward, forward);
  assert.deepEqual(interleaved, forward);
});

test("A -> B -> A returns the capacity A produced", () => {
  const a: CapacityInput = {
    canvasBlockSizePx: 379,
    rowPitchPx: 37,
    reservedPx: 46,
    minItems: 1,
    maxItems: 9,
  };
  // B must land strictly inside the clamp window, or both ends would agree at
  // `maxItems` and the test would pass without exercising anything.
  const b: CapacityInput = { ...a, canvasBlockSizePx: 200 };

  const initialA = computeCapacity(a).capacity;
  const atB = computeCapacity(b).capacity;
  const returnedA = computeCapacity(a).capacity;

  assert.equal(returnedA, initialA, "A -> B -> A must return to A");
  assert.notEqual(atB, initialA, "the fixture must actually change capacity at B");
});

test("sub-pixel pitch noise below the quantum cannot flip the floor", () => {
  // The exact CI failure: floor((379 - 32 - 14) / pitch) sits on its
  // discontinuity at pitch = 37, so an unquantised drift returned 8 where the
  // same geometry had just returned 9.
  const base: CapacityInput = {
    canvasBlockSizePx: 379,
    rowPitchPx: 37,
    reservedPx: 46,
    minItems: 1,
    maxItems: 9,
  };

  const exact = computeCapacity(base).capacity;
  assert.equal(exact, 9, "the fixture must sit on the floor discontinuity");

  for (const rowPitchPx of [37, 37.004, 36.996]) {
    assert.equal(
      computeCapacity({ ...base, rowPitchPx }).capacity,
      exact,
      `pitch ${rowPitchPx} must not move the capacity`,
    );
  }
});

test("quantise is idempotent and total", () => {
  const random = makeRandom(0xc0ffee);
  for (let index = 0; index < 200; index += 1) {
    const value = random() * 2_000;
    const once = quantise(value);
    assert.equal(quantise(once), once, "quantise must be idempotent");
    assert.ok(Math.abs(once - value) <= Q / 2 + Number.EPSILON);
  }

  assert.ok(Number.isNaN(quantise(Number.NaN)));
  assert.ok(Number.isNaN(quantise(Number.POSITIVE_INFINITY)));
  // A disabled quantum is the identity, not a crash.
  assert.equal(quantise(123.456, 0), 123.456);
});

test("real browser geometry is already on the quantum lattice", () => {
  // Sampled from the instrumented A05 run over `logistics-recent-list`
  // (Phase A.0): Chromium resolves layout in 1/64 px units, so quantise must
  // be the identity on values the browser actually produced.
  for (const measured of [45.03125, 51, 53.1875, 53.203125, 136.140625, 396.890625]) {
    assert.equal(quantise(measured), measured);
  }
});

test("an exactly-one-row canvas holds exactly one row", () => {
  assert.equal(
    computeCapacity({
      canvasBlockSizePx: 37,
      rowPitchPx: 37,
      minItems: 1,
      maxItems: 12,
    }).capacity,
    1,
  );
});

test("the capacity boundary moves at exactly one quantum", () => {
  const pitch = 37;
  const nine: CapacityInput = {
    canvasBlockSizePx: 9 * pitch,
    rowPitchPx: pitch,
    minItems: 1,
    maxItems: 12,
  };

  assert.equal(computeCapacity(nine).capacity, 9);
  assert.equal(
    computeCapacity({ ...nine, canvasBlockSizePx: 9 * pitch - Q }).capacity,
    8,
    "one quantum below the boundary is the next capacity down",
  );
});

test("a canvas smaller than one row falls back to minItems, still measured", () => {
  const decision = computeCapacity({
    canvasBlockSizePx: 20,
    rowPitchPx: 52,
    minItems: 2,
    maxItems: 12,
  });

  assert.equal(decision.capacity, 2);
  assert.equal(
    decision.measured,
    true,
    "a real reading that fits nothing is measured, not unmeasured",
  );
});

test("a canvas larger than the ceiling is clamped to maxItems", () => {
  const decision = computeCapacity({
    canvasBlockSizePx: 100_000,
    rowPitchPx: 40,
    minItems: 1,
    maxItems: 12,
  });

  assert.equal(decision.capacity, 12);
  assert.equal(decision.measured, true);
});

test("an inverted bound window raises the ceiling to the floor", () => {
  const decision = computeCapacity({
    canvasBlockSizePx: 4_000,
    rowPitchPx: 40,
    minItems: 9,
    maxItems: 3,
  });

  assert.equal(decision.capacity, 9, "max is raised to min, never inverted");
  assert.ok(Number.isInteger(decision.capacity));
  assert.ok(!Number.isNaN(decision.capacity));
});

test("unusable geometry reports measured: false without throwing", () => {
  const unusable: readonly Partial<CapacityInput>[] = [
    { canvasBlockSizePx: 0 },
    { canvasBlockSizePx: -120 },
    { canvasBlockSizePx: Number.NaN },
    { canvasBlockSizePx: Number.POSITIVE_INFINITY },
    { canvasBlockSizePx: Number.NEGATIVE_INFINITY },
    { rowPitchPx: 0 },
    { rowPitchPx: -37 },
    { rowPitchPx: Number.NaN },
    { rowPitchPx: Number.POSITIVE_INFINITY },
    { reservedPx: Number.NaN },
    { reservedPx: -8 },
    { reservedPx: Number.POSITIVE_INFINITY },
  ];

  for (const override of unusable) {
    const decision = computeCapacity({
      canvasBlockSizePx: 400,
      rowPitchPx: 40,
      reservedPx: 0,
      minItems: 3,
      maxItems: 12,
      ...override,
    });

    assert.equal(
      decision.measured,
      false,
      `${JSON.stringify(override)} must not count as a measurement`,
    );
    assert.equal(decision.capacity, 3, "an unusable geometry rests on minItems");
  }
});

test("a pitch below half a quantum cannot manufacture capacity", () => {
  const decision = computeCapacity({
    canvasBlockSizePx: 400,
    rowPitchPx: Q / 4,
    minItems: 1,
    maxItems: 12,
  });

  assert.equal(decision.measured, false);
  assert.equal(decision.capacity, 1, "never Infinity, never maxItems by accident");
});

test("the dataset is not an argument of the engine", () => {
  const base: CapacityInput = {
    canvasBlockSizePx: 500,
    rowPitchPx: 44,
    minItems: 1,
    maxItems: 12,
  };

  // L1 (`pitch -> capacity -> rows -> content -> pitch`) closed through the
  // dataset. It cannot be re-opened here: there is nowhere to put it.
  for (const itemCount of [0, 1, 12, 400]) {
    assert.deepEqual(
      computeCapacity({ ...base, itemCount } as CapacityInput),
      computeCapacity(base),
      `itemCount ${itemCount} must be inert`,
    );
  }
});

test("the row gap costs one stride per extra row, not one per row", () => {
  // 110px holds two 51px rows separated by a 6px gap (108px used). Charging a
  // gap to the first row too would concede only one; ignoring it entirely would
  // claim two where only the gapless arithmetic allowed it.
  const withGap = computeCapacity({
    canvasBlockSizePx: 110,
    rowPitchPx: 51,
    rowGapPx: 6,
    minItems: 1,
    maxItems: 12,
  });

  assert.equal(withGap.capacity, 2);
  assert.equal(withGap.measured, true);

  // Three rows would need 51*3 + 6*2 = 165 > 110.
  assert.equal(
    computeCapacity({
      canvasBlockSizePx: 164,
      rowPitchPx: 51,
      rowGapPx: 6,
      minItems: 1,
      maxItems: 12,
    }).capacity,
    2,
    "one px short of the third row is still two rows",
  );
  assert.equal(
    computeCapacity({
      canvasBlockSizePx: 165,
      rowPitchPx: 51,
      rowGapPx: 6,
      minItems: 1,
      maxItems: 12,
    }).capacity,
    3,
  );
});

test("a zero gap collapses to the plain floor arithmetic", () => {
  const random = makeRandom(0x9a9);
  for (let index = 0; index < 100; index += 1) {
    const input: CapacityInput = {
      canvasBlockSizePx: Math.round(random() * 900 * 64) / 64,
      rowPitchPx: Math.round((20 + random() * 40) * 64) / 64,
      minItems: 1,
      maxItems: 20,
    };

    assert.deepEqual(computeCapacity({ ...input, rowGapPx: 0 }), computeCapacity(input));
  }
});

test("an unusable gap is not a measurement", () => {
  for (const rowGapPx of [Number.NaN, -4, Number.POSITIVE_INFINITY]) {
    const decision = computeCapacity({
      canvasBlockSizePx: 400,
      rowPitchPx: 40,
      rowGapPx,
      minItems: 2,
      maxItems: 12,
    });

    assert.equal(decision.measured, false);
    assert.equal(decision.capacity, 2);
  }
});

test("clampCapacity holds a fallback inside the measured window", () => {
  assert.equal(clampCapacity(7, 1, 12), 7);
  assert.equal(clampCapacity(99, 1, 12), 12, "a fallback above the ceiling clamps");
  assert.equal(clampCapacity(1, 3, 12), 3, "a fallback below the floor clamps");
  assert.equal(clampCapacity(Number.NaN, 3, 12), 3, "an unusable fallback rests on min");
  assert.equal(clampCapacity(0, 2, 12), 2);
  assert.equal(clampCapacity(5.9, 1, 12), 5, "a fractional fallback is floored");
});

test("the engine exports no mutable state", async () => {
  const engineModule = await import(
    "../../../../frontend/src/lib/dashboard/capacity/computeCapacity.ts"
  );

  for (const [name, value] of Object.entries(engineModule)) {
    assert.ok(
      typeof value === "function" || typeof value === "number",
      `export "${name}" must be a pure function or a constant, not state`,
    );
  }

  assert.equal(CAPACITY_SUBPIXEL_QUANTUM_PX, 1 / 64);
});
