import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "./db.ts";
import {
  loginFailedAttempts,
  type LoginFailedAttemptReason,
  type LoginFailedAttemptSurface,
} from "../drizzle/schema.ts";
import { normalizeListPagination } from "./lib/list-pagination.ts";

export type AdminFailedLoginAlertSurface = LoginFailedAttemptSurface;
export type AdminFailedLoginAlertReason = LoginFailedAttemptReason;

export type AdminFailedLoginAlertSummary = {
  id: number;
  surface: AdminFailedLoginAlertSurface;
  username: string | null;
  reason: AdminFailedLoginAlertReason;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AdminFailedLoginAlertsQuery = {
  surface?: AdminFailedLoginAlertSurface;
  reason?: AdminFailedLoginAlertReason;
  limit?: number;
  offset?: number;
};

export type AdminFailedLoginAlertsSnapshot = {
  success: true;
  failedLoginAlerts: AdminFailedLoginAlertSummary[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  filters: {
    surface: AdminFailedLoginAlertSurface | null;
    reason: AdminFailedLoginAlertReason | null;
  };
};

export async function listAdminFailedLoginAlerts(
  params: AdminFailedLoginAlertsQuery = {},
): Promise<AdminFailedLoginAlertsSnapshot> {
  const { limit, offset } = normalizeListPagination(params);
  const filters = [];

  if (params.surface) {
    filters.push(eq(loginFailedAttempts.surface, params.surface));
  }

  if (params.reason) {
    filters.push(eq(loginFailedAttempts.reason, params.reason));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: loginFailedAttempts.id,
        surface: loginFailedAttempts.surface,
        username: loginFailedAttempts.username,
        reason: loginFailedAttempts.reason,
        ipAddress: loginFailedAttempts.ipAddress,
        userAgent: loginFailedAttempts.userAgent,
        createdAt: loginFailedAttempts.createdAt,
      })
      .from(loginFailedAttempts)
      .where(whereClause)
      .orderBy(desc(loginFailedAttempts.createdAt), desc(loginFailedAttempts.id))
      .limit(limit)
      .offset(offset),
    db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(loginFailedAttempts)
      .where(whereClause),
  ]);

  const failedLoginAlerts = rows.map((row) => ({
    id: row.id,
    surface: row.surface,
    username: row.username,
    reason: row.reason,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    success: true,
    failedLoginAlerts,
    count: failedLoginAlerts.length,
    total: totalRows[0]?.total ?? 0,
    limit,
    offset,
    filters: {
      surface: params.surface ?? null,
      reason: params.reason ?? null,
    },
  };
}
