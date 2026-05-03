import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDurationBetweenRouteEvents,
  getRouteEventBoundariesByRoutePlan,
  getRouteEventBoundariesByRouteStop,
  summarizeRouteEvents,
} from "../server/lib/logistics/metrics.ts";

const events = [
  {
    routePlanId: 10,
    eventType: "route.completed",
    source: "system",
    eventTime: new Date("2026-05-03T12:00:00.000Z"),
  },
  {
    routePlanId: 10,
    eventType: "route.started",
    source: "mobile",
    eventTime: new Date("2026-05-03T10:00:00.000Z"),
  },
  {
    routePlanId: 10,
    routeStopId: 100,
    eventType: "stop.arrived",
    source: "mobile",
    eventTime: new Date("2026-05-03T10:30:00.000Z"),
  },
  {
    routePlanId: 10,
    routeStopId: 100,
    eventType: "stop.departed",
    source: "mobile",
    eventTime: new Date("2026-05-03T10:50:00.000Z"),
  },
] as const;

test("summarizeRouteEvents counts by event type and source", () => {
  assert.deepEqual(summarizeRouteEvents(events), {
    totalCount: 4,
    byEventType: {
      "route.started": 1,
      "stop.arrived": 1,
      "stop.departed": 1,
      "route.completed": 1,
    },
    bySource: {
      mobile: 3,
      system: 1,
    },
    firstEvent: {
      eventType: "route.started",
      eventTime: new Date("2026-05-03T10:00:00.000Z"),
      routePlanId: 10,
      routeStopId: null,
    },
    lastEvent: {
      eventType: "route.completed",
      eventTime: new Date("2026-05-03T12:00:00.000Z"),
      routePlanId: 10,
      routeStopId: null,
    },
  });
});

test("getRouteEventBoundariesByRoutePlan returns first and last events per route", () => {
  assert.deepEqual(getRouteEventBoundariesByRoutePlan(events), {
    10: {
      firstEvent: {
        eventType: "route.started",
        eventTime: new Date("2026-05-03T10:00:00.000Z"),
        routePlanId: 10,
        routeStopId: null,
      },
      lastEvent: {
        eventType: "route.completed",
        eventTime: new Date("2026-05-03T12:00:00.000Z"),
        routePlanId: 10,
        routeStopId: null,
      },
    },
  });
});

test("getRouteEventBoundariesByRouteStop returns first and last events per stop", () => {
  assert.deepEqual(getRouteEventBoundariesByRouteStop(events), {
    100: {
      firstEvent: {
        eventType: "stop.arrived",
        eventTime: new Date("2026-05-03T10:30:00.000Z"),
        routePlanId: 10,
        routeStopId: 100,
      },
      lastEvent: {
        eventType: "stop.departed",
        eventTime: new Date("2026-05-03T10:50:00.000Z"),
        routePlanId: 10,
        routeStopId: 100,
      },
    },
  });
});

test("calculateDurationBetweenRouteEvents returns route duration", () => {
  assert.deepEqual(
    calculateDurationBetweenRouteEvents(
      events,
      "route.started",
      "route.completed",
    ),
    {
      durationMin: 120,
      missingEvents: [],
    },
  );
});

test("calculateDurationBetweenRouteEvents returns stop service duration", () => {
  assert.deepEqual(
    calculateDurationBetweenRouteEvents(
      events,
      "stop.arrived",
      "stop.departed",
    ),
    {
      durationMin: 20,
      missingEvents: [],
    },
  );
});

test("calculateDurationBetweenRouteEvents reports missing event types", () => {
  assert.deepEqual(
    calculateDurationBetweenRouteEvents(events, "route.started", "route.canceled"),
    {
      durationMin: null,
      missingEvents: ["route.canceled"],
    },
  );
});

test("summarizeRouteEvents ignores invalid events safely", () => {
  assert.equal(
    summarizeRouteEvents([
      ...events,
      {
        routePlanId: 20,
        eventType: "",
        source: "mobile",
        eventTime: new Date("2026-05-03T09:00:00.000Z"),
      },
      {
        routePlanId: 20,
        eventType: "route.started",
        source: "mobile",
        eventTime: new Date("invalid"),
      },
    ]).totalCount,
    4,
  );
});
