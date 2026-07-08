import assert from "node:assert/strict";
import test from "node:test";

import {
  clearRoutePlanMetricsCache,
  clearRoutePlanMetricsCacheByClinic,
  clearRoutePlanMetricsCacheByPlan,
  clearRoutePlansCache,
  clearRoutePlansCacheByClinic,
  getCachedRoutePlanMetricsSnapshot,
  getCachedRoutePlansSnapshot,
  setCachedRoutePlanMetricsSnapshot,
  setCachedRoutePlansSnapshot,
} from "../../../../server/lib/logistics-route-plans-cache.ts";

test("logistics route plans cache keeps snapshot for 5 minutes and expires afterwards", () => {
  clearRoutePlansCache();
  const now = Date.UTC(2026, 4, 21, 14, 0, 0);
  const key = "clinic:7|status:|planningMode:|objective:|limit:50|offset:0";
  const snapshot = {
    success: true,
    count: 1,
    routePlans: [{ id: 501 }],
    pagination: {
      limit: 50,
      offset: 0,
    },
  };

  setCachedRoutePlansSnapshot(key, snapshot, now);

  assert.deepEqual(
    getCachedRoutePlansSnapshot<typeof snapshot>(key, now + 60_000),
    snapshot,
  );
  assert.equal(
    getCachedRoutePlansSnapshot<typeof snapshot>(key, now + 5 * 60 * 1000),
    null,
  );

  clearRoutePlansCache();
});

test("logistics route plans cache invalidates only the requested clinic namespace", () => {
  clearRoutePlansCache();
  const now = Date.UTC(2026, 4, 21, 14, 30, 0);
  const clinicSevenKey =
    "clinic:7|status:|planningMode:|objective:|limit:50|offset:0";
  const clinicNineKey =
    "clinic:9|status:|planningMode:|objective:|limit:50|offset:0";

  setCachedRoutePlansSnapshot(clinicSevenKey, { clinicId: 7 }, now);
  setCachedRoutePlansSnapshot(clinicNineKey, { clinicId: 9 }, now);

  clearRoutePlansCacheByClinic(7);

  assert.equal(getCachedRoutePlansSnapshot(clinicSevenKey, now + 1_000), null);
  assert.deepEqual(getCachedRoutePlansSnapshot(clinicNineKey, now + 1_000), {
    clinicId: 9,
  });

  clearRoutePlansCache();
});

test("logistics route plan metrics cache supports plan-scoped and clinic-scoped invalidation", () => {
  clearRoutePlanMetricsCache();
  const now = Date.UTC(2026, 4, 21, 15, 0, 0);
  const plan501Key = [
    "clinic:7",
    "plan:501",
    "distanceTolerancePercent:20",
    "timeToleranceMin:10",
    "toleranceMin:5",
  ].join("|");
  const plan502Key = [
    "clinic:7",
    "plan:502",
    "distanceTolerancePercent:20",
    "timeToleranceMin:10",
    "toleranceMin:5",
  ].join("|");
  const clinicNinePlanKey = [
    "clinic:9",
    "plan:601",
    "distanceTolerancePercent:20",
    "timeToleranceMin:10",
    "toleranceMin:5",
  ].join("|");

  setCachedRoutePlanMetricsSnapshot(plan501Key, { routePlanId: 501 }, now);
  setCachedRoutePlanMetricsSnapshot(plan502Key, { routePlanId: 502 }, now);
  setCachedRoutePlanMetricsSnapshot(clinicNinePlanKey, { routePlanId: 601 }, now);

  clearRoutePlanMetricsCacheByPlan(7, 501);

  assert.equal(getCachedRoutePlanMetricsSnapshot(plan501Key, now + 1_000), null);
  assert.deepEqual(getCachedRoutePlanMetricsSnapshot(plan502Key, now + 1_000), {
    routePlanId: 502,
  });
  assert.deepEqual(
    getCachedRoutePlanMetricsSnapshot(clinicNinePlanKey, now + 1_000),
    {
      routePlanId: 601,
    },
  );

  clearRoutePlanMetricsCacheByClinic(7);

  assert.equal(getCachedRoutePlanMetricsSnapshot(plan502Key, now + 2_000), null);
  assert.deepEqual(
    getCachedRoutePlanMetricsSnapshot(clinicNinePlanKey, now + 2_000),
    {
      routePlanId: 601,
    },
  );

  clearRoutePlanMetricsCache();
});
