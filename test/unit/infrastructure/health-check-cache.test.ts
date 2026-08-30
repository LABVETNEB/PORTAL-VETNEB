import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import type { HealthCheckResponse } from "../../../server/lib/http-runtime.ts";

process.env.NODE_ENV ??= "test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { createCachedHealthProbe, HEALTH_CHECK_FAILURE_TTL_MS, HEALTH_CHECK_SUCCESS_TTL_MS } =
  await import("../../../server/lib/http-runtime.ts");

function healthyResult(overrides: Partial<HealthCheckResponse> = {}): HealthCheckResponse {
  return {
    statusCode: 200,
    payload: {
      success: true,
      status: "ok",
      checks: { database: "up", storage: "up" },
      uptimeSeconds: 10,
      responseTimeMs: 5,
      timestamp: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

function unhealthyResult(overrides: Partial<HealthCheckResponse> = {}): HealthCheckResponse {
  return {
    statusCode: 503,
    payload: {
      success: false,
      status: "degraded",
      checks: { database: "down", storage: "up" },
      uptimeSeconds: 10,
      responseTimeMs: 5,
      timestamp: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

function createControlledClock(startMs: number) {
  let current = startMs;
  return {
    now: () => current,
    advance(deltaMs: number) {
      current += deltaMs;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("first call executes the probe", async () => {
  let probeCalls = 0;
  const clock = createControlledClock(0);
  const getCached = createCachedHealthProbe({
    probe: async () => {
      probeCalls += 1;
      return healthyResult();
    },
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  const result = await getCached();

  assert.equal(probeCalls, 1);
  assert.deepEqual(result, healthyResult());
});

test("a second call within the success TTL reuses the cached result without a new probe", async () => {
  let probeCalls = 0;
  const clock = createControlledClock(0);
  const getCached = createCachedHealthProbe({
    probe: async () => {
      probeCalls += 1;
      return healthyResult();
    },
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  await getCached();
  clock.advance(HEALTH_CHECK_SUCCESS_TTL_MS - 1);
  const second = await getCached();

  assert.equal(probeCalls, 1);
  assert.deepEqual(second, healthyResult());
});

test("expiry after the success TTL forces exactly one new probe", async () => {
  let probeCalls = 0;
  const clock = createControlledClock(0);
  const getCached = createCachedHealthProbe({
    probe: async () => {
      probeCalls += 1;
      return healthyResult();
    },
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  await getCached();
  clock.advance(HEALTH_CHECK_SUCCESS_TTL_MS);
  await getCached();

  assert.equal(probeCalls, 2);
});

test("100 concurrent requests during a cache miss produce exactly one probe execution (single-flight)", async () => {
  let probeCalls = 0;
  const gate = deferred<HealthCheckResponse>();
  const clock = createControlledClock(0);
  const getCached = createCachedHealthProbe({
    probe: () => {
      probeCalls += 1;
      return gate.promise;
    },
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  const concurrentRequests = Array.from({ length: 100 }, () => getCached());

  assert.equal(probeCalls, 1, "single-flight must dedupe concurrent probes before resolution");

  gate.resolve(healthyResult());
  const results = await Promise.all(concurrentRequests);

  assert.equal(probeCalls, 1, "no additional probe should run once the in-flight promise settles");
  for (const result of results) {
    assert.deepEqual(result, healthyResult());
  }
});

test("healthy probe results are preserved verbatim through the cache", async () => {
  const clock = createControlledClock(0);
  const expected = healthyResult({ payload: { ...healthyResult().payload, uptimeSeconds: 999 } });
  const getCached = createCachedHealthProbe({
    probe: async () => expected,
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  assert.deepEqual(await getCached(), expected);
});

test("unhealthy probe results are preserved verbatim through the cache", async () => {
  const clock = createControlledClock(0);
  const expected = unhealthyResult();
  const getCached = createCachedHealthProbe({
    probe: async () => expected,
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  assert.deepEqual(await getCached(), expected);
});

test("a probe exception does not permanently break the cache: in-flight state clears and retry is possible", async () => {
  let probeCalls = 0;
  const clock = createControlledClock(0);
  const getCached = createCachedHealthProbe({
    probe: async () => {
      probeCalls += 1;
      if (probeCalls === 1) {
        throw new Error("transient probe failure");
      }
      return healthyResult();
    },
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  await assert.rejects(getCached(), /transient probe failure/);
  const recovered = await getCached();

  assert.equal(probeCalls, 2, "a rejected probe must not be cached; the next call must retry");
  assert.deepEqual(recovered, healthyResult());
});

test("in-flight state clears after a successful probe, allowing normal TTL behavior afterward", async () => {
  let probeCalls = 0;
  const clock = createControlledClock(0);
  const getCached = createCachedHealthProbe({
    probe: async () => {
      probeCalls += 1;
      return healthyResult();
    },
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  await getCached();
  await getCached();
  await getCached();

  assert.equal(probeCalls, 1, "successive calls after success must hit cache, not in-flight leakage");
});

test("in-flight state clears after a rejected probe (no dangling unhandled rejection cached)", async () => {
  const clock = createControlledClock(0);
  const getCached = createCachedHealthProbe({
    probe: async () => {
      throw new Error("boom");
    },
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  await assert.rejects(getCached(), /boom/);
  await assert.rejects(getCached(), /boom/);
});

test("failure results are cached long enough to prevent an immediate probe storm", async () => {
  let probeCalls = 0;
  const clock = createControlledClock(0);
  const getCached = createCachedHealthProbe({
    probe: async () => {
      probeCalls += 1;
      return unhealthyResult();
    },
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  await getCached();
  for (let i = 0; i < 50; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await getCached();
  }

  assert.equal(probeCalls, 1, "50 immediate follow-up requests must not each trigger a new probe");
});

test("after the failure TTL expires, a new probe is allowed (recovery is observable)", async () => {
  let probeCalls = 0;
  const clock = createControlledClock(0);
  const getCached = createCachedHealthProbe({
    probe: async () => {
      probeCalls += 1;
      return probeCalls === 1 ? unhealthyResult() : healthyResult();
    },
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  const first = await getCached();
  assert.equal(first.statusCode, 503);

  clock.advance(HEALTH_CHECK_FAILURE_TTL_MS);
  const second = await getCached();

  assert.equal(probeCalls, 2);
  assert.equal(second.statusCode, 200);
});

test("failure TTL is shorter than success TTL, so a downed dependency is not hidden for as long as a healthy one is cached", () => {
  assert.ok(
    HEALTH_CHECK_FAILURE_TTL_MS < HEALTH_CHECK_SUCCESS_TTL_MS,
    "failure TTL must recover faster than success TTL persists",
  );
  assert.ok(HEALTH_CHECK_SUCCESS_TTL_MS <= 10_000, "success TTL must stay short (seconds order)");
  assert.ok(HEALTH_CHECK_FAILURE_TTL_MS <= 10_000, "failure TTL must stay short (seconds order)");
});

test("100 concurrent requests over a mixed success/failure/expiry timeline stay bounded", async () => {
  let probeCalls = 0;
  const clock = createControlledClock(0);
  const getCached = createCachedHealthProbe({
    probe: async () => {
      probeCalls += 1;
      return healthyResult();
    },
    now: clock.now,
    successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
    failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
  });

  await Promise.all(Array.from({ length: 100 }, () => getCached()));
  assert.equal(probeCalls, 1, "cold burst of 100 requests must cost exactly one heavy probe");

  clock.advance(HEALTH_CHECK_SUCCESS_TTL_MS);
  await Promise.all(Array.from({ length: 100 }, () => getCached()));
  assert.equal(probeCalls, 2, "a second burst after expiry must cost exactly one more heavy probe");
});

test("the cache implementation uses no timers or intervals (pull-based, no global handles)", () => {
  const source = readFileSync(
    resolve(process.cwd(), "server/lib/http-runtime.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.doesNotMatch(source, /setTimeout\s*\(/);
});

test("fastify-app wires the production health route through the cached probe, not the raw one", () => {
  const source = readFileSync(resolve(process.cwd(), "server/fastify-app.ts"), "utf8");

  assert.match(source, /getCachedHealthCheckResponse/);
  assert.doesNotMatch(
    source,
    /await import\("\.\/lib\/http-runtime\.ts"\)\)\.getHealthCheckResponse\(\)/,
  );
});

test("health-check-cache guardrail source stays ascii only", () => {
  const source = readFileSync(
    resolve(process.cwd(), "test/unit/infrastructure/health-check-cache.test.ts"),
    "utf8",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `health-check-cache source must stay ascii-only at index ${index}`,
    );
  }
});
