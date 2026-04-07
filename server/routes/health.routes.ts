import { Router } from "express";
import { sql } from "drizzle-orm";

import { db } from "../db";
import { asyncHandler } from "../utils/async-handler";
import { checkStorageHealth } from "../lib/supabase";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const startedAt = Date.now();

    let database = "down";
    let storage = "down";
    let details: Record<string, unknown> = {};

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

    res.status(ok ? 200 : 503).json({
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
    });
  }),
);

export default router;