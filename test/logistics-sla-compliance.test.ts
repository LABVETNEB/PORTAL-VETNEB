import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySlaCompliance,
  summarizeSlaCompliance,
} from "../server/lib/logistics/metrics.ts";

const now = new Date("2026-05-03T12:00:00.000Z");

test("classifySlaCompliance returns active with remaining minutes before dueAt", () => {
  assert.deepEqual(
    classifySlaCompliance({
      now,
      dueAt: new Date("2026-05-03T12:45:00.000Z"),
    }),
    {
      status: "active",
      isBreached: false,
      overdueMin: null,
      remainingMin: 45,
      resolvedLateMin: null,
    },
  );
});

test("classifySlaCompliance returns breached with overdue minutes after dueAt", () => {
  assert.deepEqual(
    classifySlaCompliance({
      now,
      dueAt: new Date("2026-05-03T11:30:00.000Z"),
    }),
    {
      status: "breached",
      isBreached: true,
      overdueMin: 30,
      remainingMin: null,
      resolvedLateMin: null,
    },
  );
});

test("classifySlaCompliance respects explicit breachedAt even before dueAt", () => {
  assert.deepEqual(
    classifySlaCompliance({
      now,
      dueAt: new Date("2026-05-03T12:45:00.000Z"),
      breachedAt: new Date("2026-05-03T11:50:00.000Z"),
    }),
    {
      status: "breached",
      isBreached: true,
      overdueMin: 0,
      remainingMin: null,
      resolvedLateMin: null,
    },
  );
});

test("classifySlaCompliance returns paused when paused before dueAt", () => {
  assert.deepEqual(
    classifySlaCompliance({
      now,
      dueAt: new Date("2026-05-03T12:45:00.000Z"),
      pausedAt: new Date("2026-05-03T12:15:00.000Z"),
    }),
    {
      status: "paused",
      isBreached: false,
      overdueMin: null,
      remainingMin: 30,
      resolvedLateMin: null,
    },
  );
});

test("classifySlaCompliance returns breached when paused after dueAt", () => {
  assert.deepEqual(
    classifySlaCompliance({
      now,
      dueAt: new Date("2026-05-03T11:30:00.000Z"),
      pausedAt: new Date("2026-05-03T11:45:00.000Z"),
    }),
    {
      status: "breached",
      isBreached: true,
      overdueMin: 15,
      remainingMin: null,
      resolvedLateMin: null,
    },
  );
});

test("classifySlaCompliance returns resolved when resolved before dueAt", () => {
  assert.deepEqual(
    classifySlaCompliance({
      now,
      dueAt: new Date("2026-05-03T12:45:00.000Z"),
      resolvedAt: new Date("2026-05-03T12:15:00.000Z"),
    }),
    {
      status: "resolved",
      isBreached: false,
      overdueMin: null,
      remainingMin: null,
      resolvedLateMin: 0,
    },
  );
});

test("classifySlaCompliance returns breached for late resolution", () => {
  assert.deepEqual(
    classifySlaCompliance({
      now,
      dueAt: new Date("2026-05-03T11:30:00.000Z"),
      resolvedAt: new Date("2026-05-03T12:10:00.000Z"),
    }),
    {
      status: "breached",
      isBreached: true,
      overdueMin: null,
      remainingMin: null,
      resolvedLateMin: 40,
    },
  );
});

test("classifySlaCompliance returns canceled before breach math", () => {
  assert.deepEqual(
    classifySlaCompliance({
      now,
      dueAt: new Date("2026-05-03T11:30:00.000Z"),
      canceledAt: new Date("2026-05-03T11:45:00.000Z"),
    }),
    {
      status: "canceled",
      isBreached: false,
      overdueMin: null,
      remainingMin: null,
      resolvedLateMin: null,
    },
  );
});

test("classifySlaCompliance handles missing due date as partial metric", () => {
  assert.deepEqual(
    classifySlaCompliance({
      now,
      dueAt: null,
    }),
    {
      status: "missing_due_date",
      isBreached: null,
      overdueMin: null,
      remainingMin: null,
      resolvedLateMin: null,
    },
  );
});

test("summarizeSlaCompliance aggregates status counts and breach rate", () => {
  const active = classifySlaCompliance({
    now,
    dueAt: new Date("2026-05-03T12:45:00.000Z"),
  });
  const paused = classifySlaCompliance({
    now,
    dueAt: new Date("2026-05-03T12:45:00.000Z"),
    pausedAt: new Date("2026-05-03T12:15:00.000Z"),
  });
  const breached = classifySlaCompliance({
    now,
    dueAt: new Date("2026-05-03T11:30:00.000Z"),
  });
  const resolved = classifySlaCompliance({
    now,
    dueAt: new Date("2026-05-03T12:45:00.000Z"),
    resolvedAt: new Date("2026-05-03T12:15:00.000Z"),
  });
  const lateResolved = classifySlaCompliance({
    now,
    dueAt: new Date("2026-05-03T11:30:00.000Z"),
    resolvedAt: new Date("2026-05-03T12:10:00.000Z"),
  });
  const canceled = classifySlaCompliance({
    now,
    dueAt: new Date("2026-05-03T12:45:00.000Z"),
    canceledAt: new Date("2026-05-03T12:10:00.000Z"),
  });
  const missingDueDate = classifySlaCompliance({ now, dueAt: null });

  assert.deepEqual(
    summarizeSlaCompliance([
      active,
      paused,
      breached,
      resolved,
      lateResolved,
      canceled,
      missingDueDate,
    ]),
    {
      totalCount: 7,
      evaluatedCount: 6,
      activeCount: 1,
      pausedCount: 1,
      breachedCount: 2,
      resolvedCount: 1,
      canceledCount: 1,
      missingDueDateCount: 1,
      breachRate: 33.333333,
      resolvedLateCount: 1,
    },
  );
});

test("summarizeSlaCompliance returns null breach rate for empty evaluated set", () => {
  assert.deepEqual(
    summarizeSlaCompliance([
      classifySlaCompliance({
        now,
        dueAt: null,
      }),
    ]),
    {
      totalCount: 1,
      evaluatedCount: 0,
      activeCount: 0,
      pausedCount: 0,
      breachedCount: 0,
      resolvedCount: 0,
      canceledCount: 0,
      missingDueDateCount: 1,
      breachRate: null,
      resolvedLateCount: 0,
    },
  );
});
