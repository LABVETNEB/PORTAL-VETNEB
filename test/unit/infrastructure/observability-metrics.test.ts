import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRouteMetricsKey,
  computePercentile,
  createObservabilityMetricsRegistry,
  getStatusClass,
  OVERFLOW_ROUTE_KEY,
  UNMATCHED_ROUTE_TEMPLATE,
} from "../../../server/lib/observability-metrics.ts";

function completeRequest(
  registry: ReturnType<typeof createObservabilityMetricsRegistry>,
  input: {
    method?: string;
    routeTemplate?: string;
    statusCode: number;
    durationMs?: number;
  },
) {
  registry.recordRequestStarted();
  registry.recordRequestCompleted({
    method: input.method ?? "GET",
    routeTemplate: input.routeTemplate ?? "/api/health",
    statusCode: input.statusCode,
    durationMs: input.durationMs ?? 10,
  });
}

test("la registry cuenta requests iniciadas, completadas y en vuelo", () => {
  const registry = createObservabilityMetricsRegistry();

  registry.recordRequestStarted();
  registry.recordRequestStarted();

  let snapshot = registry.getSnapshot();
  assert.equal(snapshot.requestsStartedTotal, 2);
  assert.equal(snapshot.requestsCompletedTotal, 0);
  assert.equal(snapshot.inFlightRequests, 2);

  registry.recordRequestCompleted({
    method: "GET",
    routeTemplate: "/api/health",
    statusCode: 200,
    durationMs: 5,
  });

  snapshot = registry.getSnapshot();
  assert.equal(snapshot.requestsCompletedTotal, 1);
  assert.equal(snapshot.inFlightRequests, 1);
});

test("in-flight nunca queda negativo aunque falte el inicio", () => {
  const registry = createObservabilityMetricsRegistry();

  registry.recordRequestCompleted({
    method: "GET",
    routeTemplate: "/api/health",
    statusCode: 200,
    durationMs: 1,
  });

  assert.equal(registry.getSnapshot().inFlightRequests, 0);
});

test("las respuestas se agrupan por status class y alimentan el error rate 5xx", () => {
  const registry = createObservabilityMetricsRegistry();

  completeRequest(registry, { statusCode: 200 });
  completeRequest(registry, { statusCode: 204 });
  completeRequest(registry, { statusCode: 302 });
  completeRequest(registry, { statusCode: 404 });
  completeRequest(registry, { statusCode: 429 });
  completeRequest(registry, { statusCode: 500 });
  completeRequest(registry, { statusCode: 503 });

  const snapshot = registry.getSnapshot();

  assert.deepEqual(snapshot.responsesByStatusClass, {
    "1xx": 0,
    "2xx": 2,
    "3xx": 1,
    "4xx": 2,
    "5xx": 2,
  });
  assert.equal(snapshot.serverErrors5xxTotal, 2);
  assert.equal(snapshot.rateLimitedResponsesTotal, 1);
  assert.equal(snapshot.serverErrorRate, 0.2857);
  assert.equal(getStatusClass(199), "1xx");
});

test("sin muestras los percentiles y el error rate son null", () => {
  const snapshot = createObservabilityMetricsRegistry().getSnapshot();

  assert.equal(snapshot.serverErrorRate, null);
  assert.deepEqual(snapshot.latencyMs, {
    count: 0,
    min: null,
    max: null,
    average: null,
    p50: null,
    p95: null,
    p99: null,
  });
  assert.deepEqual(snapshot.routes, []);
});

test("los percentiles son deterministas y toleran una sola muestra", () => {
  assert.equal(computePercentile([], 95), null);
  assert.equal(computePercentile([7], 95), 7);
  assert.equal(computePercentile([1, 2, 3, 4], 50), 2);

  const registry = createObservabilityMetricsRegistry();

  for (let index = 1; index <= 100; index += 1) {
    completeRequest(registry, { statusCode: 200, durationMs: index });
  }

  const latency = registry.getSnapshot().latencyMs;

  assert.equal(latency.count, 100);
  assert.equal(latency.min, 1);
  assert.equal(latency.max, 100);
  assert.equal(latency.average, 50.5);
  assert.equal(latency.p50, 50);
  assert.equal(latency.p95, 95);
  assert.equal(latency.p99, 99);
});

test("el buffer de latencias queda acotado al limite configurado", () => {
  const registry = createObservabilityMetricsRegistry({
    latencySampleLimit: 4,
  });

  for (const durationMs of [1, 2, 3, 4, 5, 6]) {
    completeRequest(registry, { statusCode: 200, durationMs });
  }

  const snapshot = registry.getSnapshot();

  assert.equal(snapshot.latencySampleLimit, 4);
  assert.equal(snapshot.latencyMs.count, 4);
  assert.equal(snapshot.latencyMs.min, 3);
  assert.equal(snapshot.latencyMs.max, 6);
  assert.equal(snapshot.requestsCompletedTotal, 6);
});

test("las route keys quedan acotadas y desbordan a una key fija", () => {
  const registry = createObservabilityMetricsRegistry({ routeKeyLimit: 2 });

  completeRequest(registry, { routeTemplate: "/api/a", statusCode: 200 });
  completeRequest(registry, { routeTemplate: "/api/b", statusCode: 200 });
  completeRequest(registry, { routeTemplate: "/api/c", statusCode: 500 });
  completeRequest(registry, { routeTemplate: "/api/d", statusCode: 500 });

  const snapshot = registry.getSnapshot();
  const routeNames = snapshot.routes.map((route) => route.route);

  assert.equal(snapshot.routeKeyLimitReached, true);
  assert.deepEqual(routeNames.sort(), [
    "GET /api/a",
    "GET /api/b",
    OVERFLOW_ROUTE_KEY,
  ]);

  const overflow = snapshot.routes.find(
    (route) => route.route === OVERFLOW_ROUTE_KEY,
  );

  assert.equal(overflow?.count, 2);
  assert.equal(overflow?.serverErrors5xx, 2);
});

test("las route keys sólo combinan método y route template normalizado", () => {
  assert.equal(
    buildRouteMetricsKey("get", "/api/reports/:id"),
    "GET /api/reports/:id",
  );
  assert.equal(
    buildRouteMetricsKey("GET", "/api/reports/42?token=abc"),
    `GET ${UNMATCHED_ROUTE_TEMPLATE}`,
  );
  assert.equal(
    buildRouteMetricsKey("GET", "usuario@example.com"),
    `GET ${UNMATCHED_ROUTE_TEMPLATE}`,
  );
  assert.equal(
    buildRouteMetricsKey("BADMETHOD-1", "/api/x"),
    "UNKNOWN /api/x",
  );
  assert.equal(
    buildRouteMetricsKey("GET", `/api/${"a".repeat(200)}`),
    `GET ${UNMATCHED_ROUTE_TEMPLATE}`,
  );
});

test("el snapshot no permite mutar el estado interno de la registry", () => {
  const registry = createObservabilityMetricsRegistry();

  completeRequest(registry, { statusCode: 500 });

  const snapshot = registry.getSnapshot();
  snapshot.responsesByStatusClass["5xx"] = 999;
  snapshot.routes.length = 0;

  const fresh = registry.getSnapshot();

  assert.equal(fresh.responsesByStatusClass["5xx"], 1);
  assert.equal(fresh.routes.length, 1);
});

test("reset limpia la instancia sin afectar a otras registries", () => {
  const first = createObservabilityMetricsRegistry();
  const second = createObservabilityMetricsRegistry();

  completeRequest(first, { statusCode: 200 });
  completeRequest(second, { statusCode: 500 });

  first.reset();

  assert.equal(first.getSnapshot().requestsCompletedTotal, 0);
  assert.equal(first.getSnapshot().serverErrors5xxTotal, 0);
  assert.equal(second.getSnapshot().requestsCompletedTotal, 1);
  assert.equal(second.getSnapshot().serverErrors5xxTotal, 1);
});

test("el snapshot reporta startedAt y uptime a partir del reloj inyectado", () => {
  let clock = 1_800_000_000_000;
  const registry = createObservabilityMetricsRegistry({ now: () => clock });

  clock += 90_000;

  const snapshot = registry.getSnapshot();

  assert.equal(snapshot.startedAt, new Date(1_800_000_000_000).toISOString());
  assert.equal(snapshot.uptimeSeconds, 90);
});
