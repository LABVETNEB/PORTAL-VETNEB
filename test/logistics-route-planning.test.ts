import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHeuristicRoutePlan,
  calculateHaversineKm,
  type RoutePlanningVisit,
} from "../server/lib/logistics/route-planning.ts";

const routeStart = new Date("2026-05-04T12:00:00.000Z");

test("calculateHaversineKm returns deterministic kilometer distance", () => {
  const distance = calculateHaversineKm(
    { lat: -34.6037, lng: -58.3816 },
    { lat: -34.6118, lng: -58.4173 },
  );

  assert.equal(Math.round(distance * 1000) / 1000, 3.389);
});

test("buildHeuristicRoutePlan orders visits by nearest known leg for distance objective", () => {
  const visits: RoutePlanningVisit[] = [
    {
      fieldVisitId: 30,
      serviceDurationMin: 10,
      location: { lat: 0, lng: 0.3 },
    },
    {
      fieldVisitId: 10,
      serviceDurationMin: 5,
      location: { lat: 0, lng: 0.1 },
    },
    {
      fieldVisitId: 20,
      serviceDurationMin: 7,
      location: { lat: 0, lng: 0.2 },
    },
  ];

  const result = buildHeuristicRoutePlan(visits, {
    routeStart,
    startLocation: { lat: 0, lng: 0 },
    objective: "distance",
    travelSpeedKmh: 60,
  });

  assert.equal(result.planningMode, "heuristic");
  assert.equal(result.objective, "distance");
  assert.deepEqual(
    result.stops.map((stop) => stop.fieldVisitId),
    [10, 20, 30],
  );
  assert.deepEqual(
    result.stops.map((stop) => stop.sequence),
    [1, 2, 3],
  );
  assert.equal(result.warnings.length, 0);
});

test("buildHeuristicRoutePlan keeps deterministic tie-breaking by priority and id", () => {
  const visits: RoutePlanningVisit[] = [
    {
      fieldVisitId: 30,
      priority: 1,
      serviceDurationMin: 0,
      location: { lat: 0, lng: 0.1 },
    },
    {
      fieldVisitId: 20,
      priority: 5,
      serviceDurationMin: 0,
      location: { lat: 0, lng: 0.1 },
    },
    {
      fieldVisitId: 10,
      priority: 5,
      serviceDurationMin: 0,
      location: { lat: 0, lng: 0.1 },
    },
  ];

  const result = buildHeuristicRoutePlan(visits, {
    routeStart,
    startLocation: { lat: 0, lng: 0 },
    objective: "distance",
    travelSpeedKmh: 60,
  });

  assert.deepEqual(
    result.stops.map((stop) => stop.fieldVisitId),
    [10, 20, 30],
  );
});

test("buildHeuristicRoutePlan plans missing coordinates after known coordinates with fallback minutes", () => {
  const visits: RoutePlanningVisit[] = [
    {
      fieldVisitId: 20,
      serviceDurationMin: 0,
      location: null,
    },
    {
      fieldVisitId: 10,
      serviceDurationMin: 0,
      location: { lat: 0, lng: 0.1 },
    },
  ];

  const result = buildHeuristicRoutePlan(visits, {
    routeStart,
    startLocation: { lat: 0, lng: 0 },
    objective: "distance",
    travelSpeedKmh: 60,
    fallbackLegMinutes: 12,
  });

  assert.deepEqual(
    result.stops.map((stop) => stop.fieldVisitId),
    [10, 20],
  );
  assert.equal(result.stops[1]?.plannedKmFromPrev, 0);
  assert.equal(result.stops[1]?.plannedMinFromPrev, 12);
  assert.deepEqual(result.warnings, [
    "Visits without valid coordinates were planned with fallback leg minutes: 20",
  ]);
});

test("buildHeuristicRoutePlan honors earliest hard time window for sla objective", () => {
  const visits: RoutePlanningVisit[] = [
    {
      fieldVisitId: 10,
      priority: 1,
      serviceDurationMin: 10,
      location: { lat: 0, lng: 0.1 },
      timeWindows: [
        {
          windowStart: new Date("2026-05-04T15:00:00.000Z"),
          windowEnd: new Date("2026-05-04T16:00:00.000Z"),
          isHard: true,
        },
      ],
    },
    {
      fieldVisitId: 20,
      priority: 1,
      serviceDurationMin: 10,
      location: { lat: 0, lng: 0.3 },
      timeWindows: [
        {
          windowStart: new Date("2026-05-04T13:00:00.000Z"),
          windowEnd: new Date("2026-05-04T14:00:00.000Z"),
          isHard: true,
        },
      ],
    },
  ];

  const result = buildHeuristicRoutePlan(visits, {
    routeStart,
    startLocation: { lat: 0, lng: 0 },
    objective: "sla",
    travelSpeedKmh: 60,
  });

  assert.deepEqual(
    result.stops.map((stop) => stop.fieldVisitId),
    [20, 10],
  );
  assert.equal(result.stops[0]?.etaStart.toISOString(), "2026-05-04T13:00:00.000Z");
});

test("buildHeuristicRoutePlan returns an empty deterministic plan for no visits", () => {
  const result = buildHeuristicRoutePlan([], {
    routeStart,
    objective: "distance",
  });

  assert.deepEqual(result, {
    planningMode: "heuristic",
    objective: "distance",
    stops: [],
    totalPlannedKm: 0,
    totalPlannedMin: 0,
    warnings: [],
  });
});

test("buildHeuristicRoutePlan rejects invalid routeStart dates", () => {
  assert.throws(
    () =>
      buildHeuristicRoutePlan([], {
        routeStart: new Date("invalid"),
      }),
    /routeStart must be a valid Date/,
  );
});

