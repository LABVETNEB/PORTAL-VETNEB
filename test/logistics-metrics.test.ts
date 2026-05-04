import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBasicRouteComplianceMetrics,
  calculateKmPerCompletedVisit,
  calculateRouteDistanceCompliance,
  calculateRouteStopComplianceMetrics,
  classifyTimeWindowCompliance,
  summarizeWindowCompliance,
} from "../server/lib/logistics/metrics.ts";

test("calculateRouteDistanceCompliance returns planned vs actual distance metrics", () => {
  assert.deepEqual(
    calculateRouteDistanceCompliance({
      plannedKm: 100,
      actualKm: 112.5,
      tolerancePercent: 15,
    }),
    {
      plannedKm: 100,
      actualKm: 112.5,
      deltaKm: 12.5,
      absoluteDeltaKm: 12.5,
      deltaPercent: 12.5,
      efficiencyRatio: 1.125,
      withinTolerance: true,
    },
  );
});

test("calculateRouteDistanceCompliance detects distance deviations beyond tolerance", () => {
  const metrics = calculateRouteDistanceCompliance({
    plannedKm: 100,
    actualKm: 112.5,
    tolerancePercent: 10,
  });

  assert.equal(metrics.withinTolerance, false);
  assert.equal(metrics.deltaPercent, 12.5);
});

test("calculateRouteDistanceCompliance supports partial metrics when data is missing", () => {
  assert.deepEqual(
    calculateRouteDistanceCompliance({
      plannedKm: undefined,
      actualKm: 42,
      tolerancePercent: 10,
    }),
    {
      plannedKm: null,
      actualKm: 42,
      deltaKm: null,
      absoluteDeltaKm: null,
      deltaPercent: null,
      efficiencyRatio: null,
      withinTolerance: null,
    },
  );
});

test("calculateRouteDistanceCompliance handles zero planned kilometers deterministically", () => {
  assert.equal(
    calculateRouteDistanceCompliance({
      plannedKm: 0,
      actualKm: 0,
      tolerancePercent: 5,
    }).withinTolerance,
    true,
  );

  assert.equal(
    calculateRouteDistanceCompliance({
      plannedKm: 0,
      actualKm: 1,
      tolerancePercent: 5,
    }).withinTolerance,
    false,
  );
});

test("calculateKmPerCompletedVisit returns null for incomplete denominator", () => {
  assert.equal(calculateKmPerCompletedVisit(25, 5), 5);
  assert.equal(calculateKmPerCompletedVisit(25, 0), null);
  assert.equal(calculateKmPerCompletedVisit(null, 5), null);
  assert.equal(calculateKmPerCompletedVisit(25, 2.5), null);
});

test("classifyTimeWindowCompliance classifies on-time arrivals", () => {
  assert.deepEqual(
    classifyTimeWindowCompliance({
      windowStart: new Date("2026-05-03T10:00:00.000Z"),
      windowEnd: new Date("2026-05-03T11:00:00.000Z"),
      actualArrival: new Date("2026-05-03T10:30:00.000Z"),
    }),
    {
      status: "on_time",
      toleranceMin: 0,
      deltaFromWindowMin: 0,
      earlyByMin: null,
      lateByMin: null,
    },
  );
});

test("classifyTimeWindowCompliance applies tolerance to early and late arrivals", () => {
  assert.equal(
    classifyTimeWindowCompliance({
      windowStart: new Date("2026-05-03T10:00:00.000Z"),
      windowEnd: new Date("2026-05-03T11:00:00.000Z"),
      actualArrival: new Date("2026-05-03T09:56:00.000Z"),
      toleranceMin: 5,
    }).status,
    "on_time",
  );

  assert.deepEqual(
    classifyTimeWindowCompliance({
      windowStart: new Date("2026-05-03T10:00:00.000Z"),
      windowEnd: new Date("2026-05-03T11:00:00.000Z"),
      actualArrival: new Date("2026-05-03T09:50:00.000Z"),
      toleranceMin: 5,
    }),
    {
      status: "early",
      toleranceMin: 5,
      deltaFromWindowMin: -10,
      earlyByMin: 10,
      lateByMin: null,
    },
  );

  assert.deepEqual(
    classifyTimeWindowCompliance({
      windowStart: new Date("2026-05-03T10:00:00.000Z"),
      windowEnd: new Date("2026-05-03T11:00:00.000Z"),
      actualArrival: new Date("2026-05-03T11:10:00.000Z"),
      toleranceMin: 5,
    }),
    {
      status: "late",
      toleranceMin: 5,
      deltaFromWindowMin: 10,
      earlyByMin: null,
      lateByMin: 10,
    },
  );
});

test("classifyTimeWindowCompliance handles missing actuals and invalid windows", () => {
  assert.equal(
    classifyTimeWindowCompliance({
      windowStart: new Date("2026-05-03T10:00:00.000Z"),
      windowEnd: new Date("2026-05-03T11:00:00.000Z"),
      actualArrival: null,
    }).status,
    "missing_actual",
  );

  assert.equal(
    classifyTimeWindowCompliance({
      windowStart: new Date("2026-05-03T11:00:00.000Z"),
      windowEnd: new Date("2026-05-03T10:00:00.000Z"),
      actualArrival: new Date("2026-05-03T10:30:00.000Z"),
    }).status,
    "no_window",
  );
});

test("summarizeWindowCompliance returns evaluated and partial compliance metrics", () => {
  assert.deepEqual(
    summarizeWindowCompliance([
      "on_time",
      "on_time",
      "early",
      "late",
      "missing_actual",
      "no_window",
    ]),
    {
      totalCount: 6,
      evaluatedCount: 4,
      earlyCount: 1,
      onTimeCount: 2,
      lateCount: 1,
      noWindowCount: 1,
      missingActualCount: 1,
      complianceRate: 50,
    },
  );
});

test("calculateBasicRouteComplianceMetrics combines distance stop and window summaries", () => {
  assert.deepEqual(
    calculateBasicRouteComplianceMetrics({
      plannedKm: 90,
      actualKm: 99,
      totalStops: 5,
      completedStops: 3,
      distanceTolerancePercent: 10,
      windowStatuses: ["on_time", "late", "missing_actual"],
    }),
    {
      distance: {
        plannedKm: 90,
        actualKm: 99,
        deltaKm: 9,
        absoluteDeltaKm: 9,
        deltaPercent: 10,
        efficiencyRatio: 1.1,
        withinTolerance: true,
      },
      totalStops: 5,
      completedStops: 3,
      completionRate: 60,
      kmPerCompletedVisit: 33,
      windows: {
        totalCount: 3,
        evaluatedCount: 2,
        earlyCount: 0,
        onTimeCount: 1,
        lateCount: 1,
        noWindowCount: 0,
        missingActualCount: 1,
        complianceRate: 50,
      },
    },
  );
});

test("calculateRouteStopComplianceMetrics summarizes stop-level compliance deterministically", () => {
  const result = calculateRouteStopComplianceMetrics([
    {
      routeStopId: 102,
      fieldVisitId: 20,
      sequence: 2,
      plannedKmFromPrev: 8,
      actualKmFromPrev: 11,
      distanceTolerancePercent: 20,
      plannedMinFromPrev: 30,
      actualArrival: new Date("2026-05-03T10:50:00.000Z"),
      windowStart: new Date("2026-05-03T10:30:00.000Z"),
      windowEnd: new Date("2026-05-03T11:00:00.000Z"),
      toleranceMin: 5,
      timeToleranceMin: 10,
    },
    {
      routeStopId: 101,
      fieldVisitId: 10,
      sequence: 1,
      plannedKmFromPrev: 4,
      actualKmFromPrev: 4.2,
      distanceTolerancePercent: 20,
      plannedMinFromPrev: 0,
      actualArrival: new Date("2026-05-03T10:00:00.000Z"),
      windowStart: new Date("2026-05-03T09:45:00.000Z"),
      windowEnd: new Date("2026-05-03T10:15:00.000Z"),
      toleranceMin: 5,
      timeToleranceMin: 10,
    },
  ]);

  assert.equal(result.totalStops, 2);
  assert.equal(result.distanceDeviationCount, 1);
  assert.equal(result.timeDeviationCount, 1);
  assert.equal(result.outOfSequenceCount, 0);
  assert.equal(result.windowSummary.complianceRate, 100);
  assert.deepEqual(
    result.stopMetrics.map((metric) => metric.fieldVisitId),
    [10, 20],
  );
  assert.equal(result.stopMetrics[1]?.distance.deltaPercent, 37.5);
  assert.equal(result.stopMetrics[1]?.actualMinFromPrev, 50);
  assert.equal(result.stopMetrics[1]?.minDeltaFromPlan, 20);
  assert.equal(result.stopMetrics[1]?.withinTimeTolerance, false);
});

test("calculateRouteStopComplianceMetrics detects out-of-sequence and missing actual arrivals", () => {
  const result = calculateRouteStopComplianceMetrics([
    {
      fieldVisitId: 10,
      sequence: 1,
      actualArrival: new Date("2026-05-03T11:00:00.000Z"),
      windowStart: new Date("2026-05-03T10:00:00.000Z"),
      windowEnd: new Date("2026-05-03T11:30:00.000Z"),
    },
    {
      fieldVisitId: 20,
      sequence: 2,
      actualArrival: new Date("2026-05-03T10:30:00.000Z"),
      windowStart: new Date("2026-05-03T10:00:00.000Z"),
      windowEnd: new Date("2026-05-03T11:30:00.000Z"),
    },
    {
      fieldVisitId: 30,
      sequence: 3,
      actualArrival: null,
      windowStart: new Date("2026-05-03T12:00:00.000Z"),
      windowEnd: new Date("2026-05-03T12:30:00.000Z"),
    },
  ]);

  assert.equal(result.totalStops, 3);
  assert.equal(result.outOfSequenceCount, 1);
  assert.equal(result.missingActualArrivalCount, 1);
  assert.equal(result.windowSummary.missingActualCount, 1);
  assert.equal(result.stopMetrics[1]?.isOutOfSequence, true);
  assert.equal(result.stopMetrics[2]?.window.status, "missing_actual");
});
