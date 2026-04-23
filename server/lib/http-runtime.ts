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
  details?: Record<string, unknown>;
};

export type HealthCheckResponse = {
  statusCode: 200 | 503;
  payload: HealthCheckPayload;
};

export function buildServiceInfoPayload() {
  return {
    success: true,
    service: "portal-vetneb-api",
    environment: ENV.nodeEnv,
  };
}

export async function getHealthCheckResponse(): Promise<HealthCheckResponse> {
  const startedAt = Date.now();

  let database: DependencyStatus = "down";
  let storage: DependencyStatus = "down";
  const details: Record<string, unknown> = {};

  try {
    await db.execute(sql`select 1`);
    database = "up";
  } catch (error) {
    details.databaseError =
      error instanceof Error ? error.message : "unknown database error";
  }

  try {
    await checkStorageHealth();
    storage = "up";
  } catch (error) {
    details.storageError =
      error instanceof Error ? error.message : "unknown storage error";
  }

  const ok = database === "up" && storage === "up";

  return {
    statusCode: ok ? 200 : 503,
    payload: {
      success: ok,
      status: ok ? "ok" : "degraded",
      checks: {
        database,
        storage,
      },
      uptimeSeconds: Math.round(process.uptime()),
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      ...(Object.keys(details).length ? { details } : {}),
    },
  };
}
