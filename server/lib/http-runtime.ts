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
