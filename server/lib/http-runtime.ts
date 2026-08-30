import { sql } from "drizzle-orm";

import { db } from "../db.ts";
import { ENV } from "./env.ts";
import { checkStorageHealth } from "./supabase.ts";

type DependencyStatus = "up" | "down";

export type HealthCheckPayload = {
  success: boolean;
  status: "ok" | "degraded";
  checks: {
    database: DependencyStatus;
    storage: DependencyStatus;
  };
  uptimeSeconds: number;
  responseTimeMs: number;
  timestamp: string;
};

export type HealthCheckResponse = {
  statusCode: 200 | 503;
  payload: HealthCheckPayload;
};

type HealthCheckDependencies = {
  checkDatabase: () => Promise<unknown>;
  checkStorage: () => Promise<unknown>;
  now: () => number;
  uptime: () => number;
};

export function buildServiceInfoPayload() {
  return {
    success: true,
    service: "portal-vetneb-api",
    environment: ENV.nodeEnv,
  };
}

// WBR-10 (VET-09): amortizes the cost of the public health probe. Without
// this, every /health and /api/health request executes a fresh DB round
// trip (db.execute) and a fresh Supabase Storage API call, with no bound on
// concurrency or request rate. A short TTL cache plus single-flight
// deduplication ensures at most one heavy probe execution per window, even
// under a burst of concurrent requests, while still surfacing real
// degradations within a few seconds. Failures get a shorter TTL than
// successes so a recovered dependency is reflected quickly, without letting
// a downed dependency trigger a probe storm.
export const HEALTH_CHECK_SUCCESS_TTL_MS = 5_000;
export const HEALTH_CHECK_FAILURE_TTL_MS = 2_000;

export function createCachedHealthProbe(options: {
  probe: () => Promise<HealthCheckResponse>;
  now?: () => number;
  successTtlMs: number;
  failureTtlMs: number;
}): () => Promise<HealthCheckResponse> {
  const now = options.now ?? Date.now;
  let cachedValue: HealthCheckResponse | null = null;
  let expiresAt = 0;
  let inFlight: Promise<HealthCheckResponse> | null = null;

  return function getCachedHealthProbeResult(): Promise<HealthCheckResponse> {
    const currentTime = now();

    if (cachedValue && currentTime < expiresAt) {
      return Promise.resolve(cachedValue);
    }

    if (inFlight) {
      return inFlight;
    }

    const probePromise = options.probe().then(
      (result) => {
        cachedValue = result;
        expiresAt =
          now() + (result.statusCode === 200 ? options.successTtlMs : options.failureTtlMs);
        inFlight = null;
        return result;
      },
      (error: unknown) => {
        inFlight = null;
        throw error;
      },
    );

    inFlight = probePromise;
    return probePromise;
  };
}

export async function getHealthCheckResponse(
  dependencies: Partial<HealthCheckDependencies> = {},
): Promise<HealthCheckResponse> {
  const checkDatabase =
    dependencies.checkDatabase ?? (() => db.execute(sql`select 1`));
  const checkStorage = dependencies.checkStorage ?? checkStorageHealth;
  const now = dependencies.now ?? Date.now;
  const uptime = dependencies.uptime ?? process.uptime;
  const startedAt = now();

  let database: DependencyStatus = "down";
  let storage: DependencyStatus = "down";

  try {
    await checkDatabase();
    database = "up";
  } catch {
    database = "down";
  }

  try {
    await checkStorage();
    storage = "up";
  } catch {
    storage = "down";
  }

  const ok = database === "up" && storage === "up";
  const finishedAt = now();

  return {
    statusCode: ok ? 200 : 503,
    payload: {
      success: ok,
      status: ok ? "ok" : "degraded",
      checks: {
        database,
        storage,
      },
      uptimeSeconds: Math.round(uptime()),
      responseTimeMs: Math.max(0, finishedAt - startedAt),
      timestamp: new Date(finishedAt).toISOString(),
    },
  };
}

// Per-process cache (CACHE_SCOPE = PER_PROCESS): each instance amortizes its
// own probe cost independently. Uses the real dependencies (real DB, real
// Supabase) via getHealthCheckResponse() with no injected overrides, so this
// singleton must never be exercised by tests.
const cachedHealthProbe = createCachedHealthProbe({
  probe: () => getHealthCheckResponse(),
  successTtlMs: HEALTH_CHECK_SUCCESS_TTL_MS,
  failureTtlMs: HEALTH_CHECK_FAILURE_TTL_MS,
});

export function getCachedHealthCheckResponse(): Promise<HealthCheckResponse> {
  return cachedHealthProbe();
}
