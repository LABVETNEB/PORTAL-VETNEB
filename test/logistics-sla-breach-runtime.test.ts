import test from "node:test";
import assert from "node:assert/strict";

import {
  markOverdueSlaBreaches,
  markOverdueSlaBreachesWithDb,
  type MarkOverdueSlaBreachesDeps,
} from "../server/lib/logistics/sla-breach.ts";

function createSlaInstanceFixture() {
  return {
    id: 1,
    clinicId: 7,
    policyId: 3,
    targetType: "field_visit",
    targetId: 11,
    status: "breached",
    startedAt: new Date("2026-05-01T10:00:00.000Z"),
    dueAt: new Date("2026-05-01T12:00:00.000Z"),
    breachedAt: new Date("2026-05-01T12:30:00.000Z"),
    resolvedAt: null,
    pausedAt: null,
    metadata: null,
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    updatedAt: new Date("2026-05-01T12:30:00.000Z"),
  };
}

test("SLA breach runtime marks overdue active instances with explicit cutoff and breach time", async () => {
  const calls: unknown[] = [];
  const fixture = createSlaInstanceFixture();

  const deps: MarkOverdueSlaBreachesDeps = {
    markOverdueActiveClinicSlaInstancesBreached: async (params) => {
      calls.push(params);
      return [fixture as any];
    },
  };

  const dueAtOrBefore = new Date("2026-05-01T12:30:00.000Z");
  const breachedAt = new Date("2026-05-01T12:45:00.000Z");

  const result = await markOverdueSlaBreaches(
    {
      clinicId: 7,
      dueAtOrBefore,
      breachedAt,
      targetType: "field_visit",
    },
    deps,
  );

  assert.equal(result.breachedCount, 1);
  assert.deepEqual(result.breachedInstances, [fixture]);
  assert.equal(result.dueAtOrBefore, dueAtOrBefore);
  assert.equal(result.breachedAt, breachedAt);
  assert.deepEqual(calls, [
    {
      clinicId: 7,
      dueAtOrBefore,
      breachedAt,
      targetType: "field_visit",
    },
  ]);
});

test("SLA breach runtime defaults cutoff and breach time to injected now", async () => {
  const calls: unknown[] = [];
  const now = new Date("2026-05-05T00:00:00.000Z");

  const result = await markOverdueSlaBreaches(
    {
      clinicId: 9,
    },
    {
      now: () => now,
      markOverdueActiveClinicSlaInstancesBreached: async (params) => {
        calls.push(params);
        return [];
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
});

test("SLA breach runtime rejects invalid injected now before DB writes", async () => {
  let writes = 0;

  await assert.rejects(async () => {
    await markOverdueSlaBreaches(
      {
        clinicId: 1,
      },
      {
        now: () => new Date("invalid"),
        markOverdueActiveClinicSlaInstancesBreached: async () => {
          writes += 1;
          return [];
        },
      },
    );
  }, /now invalido/);

  assert.equal(writes, 0);
});

test("SLA breach runtime rejects invalid clinic ids and invalid dates before DB writes", async () => {
  let writes = 0;

  const deps: MarkOverdueSlaBreachesDeps = {
    now: () => new Date("2026-05-05T00:00:00.000Z"),
    markOverdueActiveClinicSlaInstancesBreached: async () => {
      writes += 1;
      return [];
    },
  };

  await assert.rejects(async () => {
    await markOverdueSlaBreaches({ clinicId: 0 }, deps);
  }, /clinicId debe ser un entero positivo/);

  await assert.rejects(async () => {
    await markOverdueSlaBreaches(
      {
        clinicId: 1,
        dueAtOrBefore: new Date("invalid"),
      },
      deps,
    );
  }, /dueAtOrBefore invalido/);

  await assert.rejects(async () => {
    await markOverdueSlaBreaches(
      {
        clinicId: 1,
        breachedAt: new Date("invalid"),
      },
      deps,
    );
  }, /breachedAt invalido/);

  assert.equal(writes, 0);
});

test("SLA breach runtime exposes DB-wired entrypoint", () => {
  assert.equal(typeof markOverdueSlaBreachesWithDb, "function");
});
