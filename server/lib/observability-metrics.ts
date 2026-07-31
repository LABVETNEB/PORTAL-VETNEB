export const OBSERVABILITY_STATUS_CLASSES = [
  "1xx",
  "2xx",
  "3xx",
  "4xx",
  "5xx",
] as const;

export type ObservabilityStatusClass =
  (typeof OBSERVABILITY_STATUS_CLASSES)[number];

export const DEFAULT_LATENCY_SAMPLE_LIMIT = 1024;
export const DEFAULT_ROUTE_KEY_LIMIT = 128;
export const OVERFLOW_ROUTE_KEY = "OTHER";
export const UNMATCHED_ROUTE_TEMPLATE = "UNMATCHED_ROUTE";

export type ObservabilityMetricsRegistryOptions = {
  latencySampleLimit?: number;
  routeKeyLimit?: number;
  now?: () => number;
};

export type RecordRequestCompletedInput = {
  method: string;
  routeTemplate: string;
  statusCode: number;
  durationMs: number;
};

export type LatencySummary = {
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
};

export type RouteMetricsSummary = {
  route: string;
  count: number;
  serverErrors5xx: number;
  p50: number | null;
  p95: number | null;
};

export type ObservabilityMetricsSnapshot = {
  startedAt: string;
  uptimeSeconds: number;
  requestsStartedTotal: number;
  requestsCompletedTotal: number;
  inFlightRequests: number;
  responsesByStatusClass: Record<ObservabilityStatusClass, number>;
  serverErrors5xxTotal: number;
  serverErrorRate: number | null;
  rateLimitedResponsesTotal: number;
  latencyMs: LatencySummary;
  routes: RouteMetricsSummary[];
  routeKeysTracked: number;
  routeKeyLimitReached: boolean;
  latencySampleLimit: number;
};

export type ObservabilityMetricsRegistry = {
  recordRequestStarted: () => void;
  recordRequestCompleted: (input: RecordRequestCompletedInput) => void;
  getSnapshot: () => ObservabilityMetricsSnapshot;
  reset: () => void;
};

const HTTP_METHOD_PATTERN = /^[A-Z]{3,10}$/;
const ROUTE_TEMPLATE_PATTERN = /^[A-Za-z0-9/_:*.-]+$/;
const MAX_ROUTE_TEMPLATE_LENGTH = 120;
const MAX_ROUTE_SUMMARY_ENTRIES = 50;

type RouteBucket = {
  count: number;
  serverErrors5xx: number;
  latencies: number[];
};

export function getStatusClass(statusCode: number): ObservabilityStatusClass {
  if (!Number.isFinite(statusCode)) {
    return "5xx";
  }

  if (statusCode >= 500) {
    return "5xx";
  }

  if (statusCode >= 400) {
    return "4xx";
  }

  if (statusCode >= 300) {
    return "3xx";
  }

  if (statusCode >= 200) {
    return "2xx";
  }

  return "1xx";
}

function normalizeMethod(method: unknown): string {
  const value = typeof method === "string" ? method.toUpperCase() : "";

  return HTTP_METHOD_PATTERN.test(value) ? value : "UNKNOWN";
}

function normalizeRoute(routeTemplate: unknown): string {
  const value = typeof routeTemplate === "string" ? routeTemplate.trim() : "";

  if (
    !value ||
    value.length > MAX_ROUTE_TEMPLATE_LENGTH ||
    !ROUTE_TEMPLATE_PATTERN.test(value)
  ) {
    return UNMATCHED_ROUTE_TEMPLATE;
  }

  return value;
}

export function buildRouteMetricsKey(
  method: unknown,
  routeTemplate: unknown,
): string {
  return `${normalizeMethod(method)} ${normalizeRoute(routeTemplate)}`;
}

export function computePercentile(
  sortedSamples: readonly number[],
  percentile: number,
): number | null {
  if (sortedSamples.length === 0) {
    return null;
  }

  if (sortedSamples.length === 1) {
    return sortedSamples[0]!;
  }

  const rank = Math.ceil((percentile / 100) * sortedSamples.length);
  const index = Math.min(Math.max(rank, 1), sortedSamples.length) - 1;

  return sortedSamples[index]!;
}

function roundMs(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

function summarizeLatencies(samples: readonly number[]): LatencySummary {
  if (samples.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      average: null,
      p50: null,
      p95: null,
      p99: null,
    };
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);

  return {
    count: sorted.length,
    min: roundMs(sorted[0]!),
    max: roundMs(sorted[sorted.length - 1]!),
    average: roundMs(total / sorted.length),
    p50: roundMs(computePercentile(sorted, 50)),
    p95: roundMs(computePercentile(sorted, 95)),
    p99: roundMs(computePercentile(sorted, 99)),
  };
}

function createStatusClassCounters(): Record<ObservabilityStatusClass, number> {
  return {
    "1xx": 0,
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0,
  };
}

function pushBoundedSample(
  samples: number[],
  value: number,
  limit: number,
) {
  if (samples.length >= limit) {
    samples.shift();
  }

  samples.push(value);
}

export function createObservabilityMetricsRegistry(
  options: ObservabilityMetricsRegistryOptions = {},
): ObservabilityMetricsRegistry {
  const latencySampleLimit =
    Number.isInteger(options.latencySampleLimit) &&
    (options.latencySampleLimit as number) > 0
      ? (options.latencySampleLimit as number)
      : DEFAULT_LATENCY_SAMPLE_LIMIT;
  const routeKeyLimit =
    Number.isInteger(options.routeKeyLimit) &&
    (options.routeKeyLimit as number) > 0
      ? (options.routeKeyLimit as number)
      : DEFAULT_ROUTE_KEY_LIMIT;
  const now = options.now ?? (() => Date.now());

  let startedAtMs = now();
  let requestsStartedTotal = 0;
  let requestsCompletedTotal = 0;
  let inFlightRequests = 0;
  let serverErrors5xxTotal = 0;
  let rateLimitedResponsesTotal = 0;
  let routeKeyLimitReached = false;
  let latencies: number[] = [];
  let responsesByStatusClass = createStatusClassCounters();
  let routes = new Map<string, RouteBucket>();

  function createRouteBucket(key: string): RouteBucket {
    const bucket: RouteBucket = {
      count: 0,
      serverErrors5xx: 0,
      latencies: [],
    };

    routes.set(key, bucket);

    return bucket;
  }

  function resolveRouteBucket(key: string): RouteBucket {
    const existing = routes.get(key);

    if (existing) {
      return existing;
    }

    if (routes.size >= routeKeyLimit) {
      routeKeyLimitReached = true;

      return (
        routes.get(OVERFLOW_ROUTE_KEY) ?? createRouteBucket(OVERFLOW_ROUTE_KEY)
      );
    }

    return createRouteBucket(key);
  }

  return {
    recordRequestStarted() {
      requestsStartedTotal += 1;
      inFlightRequests += 1;
    },

    recordRequestCompleted(input) {
      requestsCompletedTotal += 1;
      inFlightRequests = Math.max(0, inFlightRequests - 1);

      const statusCode = Number.isFinite(input.statusCode)
        ? Math.trunc(input.statusCode)
        : 500;
      const statusClass = getStatusClass(statusCode);

      responsesByStatusClass[statusClass] += 1;

      if (statusClass === "5xx") {
        serverErrors5xxTotal += 1;
      }

      if (statusCode === 429) {
        rateLimitedResponsesTotal += 1;
      }

      const durationMs =
        Number.isFinite(input.durationMs) && input.durationMs >= 0
          ? input.durationMs
          : 0;

      pushBoundedSample(latencies, durationMs, latencySampleLimit);

      const key = buildRouteMetricsKey(input.method, input.routeTemplate);
      const bucket = resolveRouteBucket(key);

      bucket.count += 1;

      if (statusClass === "5xx") {
        bucket.serverErrors5xx += 1;
      }

      pushBoundedSample(bucket.latencies, durationMs, latencySampleLimit);
    },

    getSnapshot() {
      const routeSummaries: RouteMetricsSummary[] = Array.from(routes.entries())
        .map(([route, bucket]) => {
          const sorted = [...bucket.latencies].sort(
            (left, right) => left - right,
          );

          return {
            route,
            count: bucket.count,
            serverErrors5xx: bucket.serverErrors5xx,
            p50: roundMs(computePercentile(sorted, 50)),
            p95: roundMs(computePercentile(sorted, 95)),
          };
        })
        .sort((left, right) => right.count - left.count)
        .slice(0, MAX_ROUTE_SUMMARY_ENTRIES);

      return {
        startedAt: new Date(startedAtMs).toISOString(),
        uptimeSeconds: Math.max(0, Math.round((now() - startedAtMs) / 1000)),
        requestsStartedTotal,
        requestsCompletedTotal,
        inFlightRequests,
        responsesByStatusClass: { ...responsesByStatusClass },
        serverErrors5xxTotal,
        serverErrorRate:
          requestsCompletedTotal === 0
            ? null
            : Math.round(
                (serverErrors5xxTotal / requestsCompletedTotal) * 10000,
              ) / 10000,
        rateLimitedResponsesTotal,
        latencyMs: summarizeLatencies(latencies),
        routes: routeSummaries,
        routeKeysTracked: routes.size,
        routeKeyLimitReached,
        latencySampleLimit,
      };
    },

    reset() {
      startedAtMs = now();
      requestsStartedTotal = 0;
      requestsCompletedTotal = 0;
      inFlightRequests = 0;
      serverErrors5xxTotal = 0;
      rateLimitedResponsesTotal = 0;
      routeKeyLimitReached = false;
      latencies = [];
      responsesByStatusClass = createStatusClassCounters();
      routes = new Map<string, RouteBucket>();
    },
  };
}

let processRegistry: ObservabilityMetricsRegistry | undefined;

export function getObservabilityMetricsRegistry(): ObservabilityMetricsRegistry {
  if (!processRegistry) {
    processRegistry = createObservabilityMetricsRegistry();
  }

  return processRegistry;
}

export function getObservabilityMetricsSnapshot(): ObservabilityMetricsSnapshot {
  return getObservabilityMetricsRegistry().getSnapshot();
}
