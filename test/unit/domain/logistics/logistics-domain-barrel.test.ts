import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TIME_WINDOW_TIMEZONE,
  LOGISTICS_DEFAULT_LIMIT,
  LOGISTICS_MAX_LIMIT,
  TIME_WINDOW_TIMEZONE_MAX_LENGTH,
  assertValidTimeWindowRange,
  isValidTimeWindowRange,
  markOverdueSlaBreaches,
  normalizeGenerateHeuristicFieldVisitIds,
  normalizeLogisticsLimit,
  normalizeLogisticsOffset,
  normalizeTimeWindowTimezone,
} from "../../../../server/features/logistics/domain/index.ts";

test("logistics domain barrel re-exports the pagination helpers unchanged", () => {
  assert.equal(LOGISTICS_DEFAULT_LIMIT, 50);
  assert.equal(LOGISTICS_MAX_LIMIT, 100);
  assert.equal(normalizeLogisticsLimit(undefined), LOGISTICS_DEFAULT_LIMIT);
  assert.equal(normalizeLogisticsLimit(999), LOGISTICS_MAX_LIMIT);
  assert.equal(normalizeLogisticsOffset(-1), 0);
  assert.equal(normalizeLogisticsOffset(100_000), 100_000);
});

test("logistics domain barrel re-exports the route-plan field visit id normalizer unchanged", () => {
  assert.deepEqual(
    normalizeGenerateHeuristicFieldVisitIds([10, 20, 10, 30, 20]),
    [10, 20, 30],
  );
  assert.deepEqual(
    normalizeGenerateHeuristicFieldVisitIds([0, -1, 5, 2.5, Number.NaN, 7]),
    [5, 7],
  );
});

test("logistics domain barrel re-exports the time-window helpers unchanged", () => {
  assert.equal(DEFAULT_TIME_WINDOW_TIMEZONE, "UTC");
  assert.equal(TIME_WINDOW_TIMEZONE_MAX_LENGTH, 64);

  assert.equal(
    isValidTimeWindowRange(
      new Date("2026-05-03T10:00:00.000Z"),
      new Date("2026-05-03T11:00:00.000Z"),
    ),
    true,
  );
  assert.equal(
    isValidTimeWindowRange(
      new Date("2026-05-03T11:00:00.000Z"),
      new Date("2026-05-03T10:00:00.000Z"),
    ),
    false,
  );

  assert.equal(normalizeTimeWindowTimezone(undefined), "UTC");
  assert.equal(
    normalizeTimeWindowTimezone(" America/Argentina/Cordoba "),
    "America/Argentina/Cordoba",
  );

  assert.throws(
    () =>
      assertValidTimeWindowRange(
        new Date("2026-05-03T10:00:00.000Z"),
        new Date("2026-05-03T10:00:00.000Z"),
      ),
    /windowStart must be earlier than windowEnd/,
  );
});

test("logistics domain barrel re-exports the pure SLA breach core unchanged", async () => {
  const calls: unknown[] = [];
  const now = new Date("2026-05-05T00:00:00.000Z");

  const result = await markOverdueSlaBreaches(
    { clinicId: 9 },
    {
      now: () => now,
      markOverdueActiveClinicSlaInstancesBreached: async (params) => {
        calls.push(params);
        return [];
      },
      notifySlaBreaches: async () => {
        throw new Error("must not notify when there are no breaches");
      },
    },
  );

  assert.equal(result.breachedCount, 0);
  assert.deepEqual(result.breachedInstances, []);
  assert.equal(result.dueAtOrBefore, now);
  assert.equal(result.breachedAt, now);
  assert.deepEqual(calls, [
    {
      clinicId: 9,
      dueAtOrBefore: now,
      breachedAt: now,
      targetType: undefined,
    },
  ]);

  await assert.rejects(
    () =>
      markOverdueSlaBreaches(
        { clinicId: 0 },
        { markOverdueActiveClinicSlaInstancesBreached: async () => [] },
      ),
    /clinicId debe ser un entero positivo/,
  );
});
