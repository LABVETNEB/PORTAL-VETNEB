import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TIME_WINDOW_TIMEZONE,
  LOGISTICS_DEFAULT_LIMIT,
  LOGISTICS_MAX_LIMIT,
  TIME_WINDOW_TIMEZONE_MAX_LENGTH,
  assertValidTimeWindowRange,
  buildHeuristicRoutePlan,
  calculateBasicRouteComplianceMetrics,
  calculateDurationBetweenRouteEvents,
  calculateHaversineKm,
  calculateKmPerCompletedVisit,
  calculateRouteDistanceCompliance,
  calculateRouteStopComplianceMetrics,
  classifySlaCompliance,
  classifyTimeWindowCompliance,
  getRouteEventBoundariesByRoutePlan,
  getRouteEventBoundariesByRouteStop,
  isValidTimeWindowRange,
  markOverdueSlaBreaches,
  normalizeGenerateHeuristicFieldVisitIds,
  normalizeLogisticsLimit,
  normalizeLogisticsOffset,
  normalizeTimeWindowTimezone,
  summarizeRouteEvents,
  summarizeSlaCompliance,
  summarizeWindowCompliance,
  type RoutePlanningVisit,
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

test("logistics domain barrel re-exports the pure route planning helpers unchanged", () => {
  const distance = calculateHaversineKm(
    { lat: -34.6037, lng: -58.3816 },
    { lat: -34.6, lng: -58.38 },
  );
  assert.ok(distance > 0 && distance < 1);

  const visits: RoutePlanningVisit[] = [
    { fieldVisitId: 1, location: { lat: -34.6, lng: -58.38 } },
    { fieldVisitId: 2, location: { lat: -34.61, lng: -58.39 } },
  ];

  const plan = buildHeuristicRoutePlan(visits, {
    routeStart: new Date("2026-05-04T12:00:00.000Z"),
    startLocation: { lat: -34.6037, lng: -58.3816 },
    objective: "distance",
  });

  assert.equal(plan.planningMode, "heuristic");
  assert.equal(plan.objective, "distance");
  assert.deepEqual(
    plan.stops.map((stop) => stop.fieldVisitId),
    [1, 2],
  );
});

test("logistics domain barrel exposes the twelve metric helpers as callable exports", () => {
  const metricHelpers = [
    calculateRouteDistanceCompliance,
    calculateKmPerCompletedVisit,
    classifyTimeWindowCompliance,
    summarizeWindowCompliance,
    calculateBasicRouteComplianceMetrics,
    classifySlaCompliance,
    summarizeSlaCompliance,
    summarizeRouteEvents,
    getRouteEventBoundariesByRoutePlan,
    getRouteEventBoundariesByRouteStop,
    calculateDurationBetweenRouteEvents,
    calculateRouteStopComplianceMetrics,
  ];

  assert.equal(metricHelpers.length, 12);

  for (const helper of metricHelpers) {
    assert.equal(typeof helper, "function");
  }
});

test("logistics domain barrel re-exports the metric helpers with unchanged behavior", () => {
  const distance = calculateRouteDistanceCompliance({
    plannedKm: 100,
    actualKm: 110,
    tolerancePercent: 5,
  });
  assert.equal(distance.deltaKm, 10);
  assert.equal(distance.deltaPercent, 10);
  assert.equal(distance.withinTolerance, false);

  assert.equal(calculateKmPerCompletedVisit(25, 5), 5);
  assert.equal(calculateKmPerCompletedVisit(25, 0), null);

  const window = classifyTimeWindowCompliance({
    windowStart: new Date("2026-05-03T09:00:00.000Z"),
    windowEnd: new Date("2026-05-03T10:00:00.000Z"),
    actualArrival: new Date("2026-05-03T09:30:00.000Z"),
  });
  assert.equal(window.status, "on_time");
  assert.equal(
    summarizeWindowCompliance(["on_time", "late", "no_window"]).complianceRate,
    50,
  );

  const basic = calculateBasicRouteComplianceMetrics({
    plannedKm: 50,
    actualKm: 40,
    totalStops: 4,
    completedStops: 2,
    windowStatuses: ["on_time", "late"],
  });
  assert.equal(basic.completionRate, 50);
  assert.equal(basic.kmPerCompletedVisit, 20);

  const sla = classifySlaCompliance({
    now: new Date("2026-05-03T12:00:00.000Z"),
    dueAt: new Date("2026-05-03T13:00:00.000Z"),
  });
  assert.equal(sla.status, "active");
  assert.equal(sla.remainingMin, 60);
  assert.equal(summarizeSlaCompliance([sla]).activeCount, 1);

  const events = [
    {
      routePlanId: 1,
      eventType: "route.started",
      eventTime: new Date("2026-05-03T08:00:00.000Z"),
    },
    {
      routePlanId: 1,
      eventType: "route.completed",
      eventTime: new Date("2026-05-03T09:00:00.000Z"),
    },
  ];
  assert.equal(summarizeRouteEvents(events).totalCount, 2);
  assert.deepEqual(Object.keys(getRouteEventBoundariesByRoutePlan(events)), ["1"]);
  assert.deepEqual(getRouteEventBoundariesByRouteStop(events), {});
  assert.equal(
    calculateDurationBetweenRouteEvents(events, "route.started", "route.completed")
      .durationMin,
    60,
  );

  const stops = calculateRouteStopComplianceMetrics([
    {
      fieldVisitId: 1,
      sequence: 1,
      actualArrival: new Date("2026-05-03T09:00:00.000Z"),
    },
    {
      fieldVisitId: 2,
      sequence: 2,
      actualArrival: new Date("2026-05-03T09:30:00.000Z"),
    },
  ]);
  assert.equal(stops.totalStops, 2);
  assert.equal(stops.outOfSequenceCount, 0);
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
