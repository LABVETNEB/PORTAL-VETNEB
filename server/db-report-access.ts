import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  reportAccessTokens,
  reports,
  type NewReportAccessToken,
} from "../drizzle/schema";

export async function createReportAccessToken(
  input: Omit<
    NewReportAccessToken,
    | "id"
    | "accessCount"
    | "lastAccessAt"
    | "revokedAt"
    | "createdAt"
    | "updatedAt"
  >,
) {
  const now = new Date();

  const result = await db
    .insert(reportAccessTokens)
    .values({
      ...input,
      accessCount: 0,
      lastAccessAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return result[0];
}

export async function getReportAccessTokenById(id: number) {
  const result = await db
    .select()
    .from(reportAccessTokens)
    .where(eq(reportAccessTokens.id, id))
    .limit(1);

  return result[0];
}

export async function getClinicScopedReportAccessToken(
  id: number,
  clinicId: number,
) {
  const result = await db
    .select()
    .from(reportAccessTokens)
    .where(
      and(
        eq(reportAccessTokens.id, id),
        eq(reportAccessTokens.clinicId, clinicId),
      ),
    )
    .limit(1);

  return result[0];
}

export async function listReportAccessTokens(params?: {
  clinicId?: number;
  reportId?: number;
  limit?: number;
  offset?: number;
}) {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;
  const filters = [] as Array<ReturnType<typeof eq>>;

  if (typeof params?.clinicId === "number") {
    filters.push(eq(reportAccessTokens.clinicId, params.clinicId));
  }

  if (typeof params?.reportId === "number") {
    filters.push(eq(reportAccessTokens.reportId, params.reportId));
  }

  const query = db
    .select()
    .from(reportAccessTokens)
    .orderBy(desc(reportAccessTokens.createdAt))
    .limit(limit)
    .offset(offset);

  if (filters.length === 0) {
    return query;
  }

  return db
    .select()
    .from(reportAccessTokens)
    .where(and(...filters))
    .orderBy(desc(reportAccessTokens.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function revokeReportAccessToken(input: {
  id: number;
  revokedByClinicUserId?: number | null;
  revokedByAdminUserId?: number | null;
}) {
  const existing = await getReportAccessTokenById(input.id);

  if (!existing) {
    return undefined;
  }

  if (existing.revokedAt) {
    return existing;
  }

  const now = new Date();

  const result = await db
    .update(reportAccessTokens)
    .set({
      revokedAt: now,
      revokedByClinicUserId: input.revokedByClinicUserId ?? null,
      revokedByAdminUserId: input.revokedByAdminUserId ?? null,
      updatedAt: now,
    })
    .where(eq(reportAccessTokens.id, input.id))
    .returning();

  return result[0];
}

export async function recordReportAccessTokenAccess(id: number) {
  const now = new Date();

  const result = await db
    .update(reportAccessTokens)
    .set({
      accessCount: sql`${reportAccessTokens.accessCount} + 1`,
      lastAccessAt: now,
      updatedAt: now,
    })
    .where(eq(reportAccessTokens.id, id))
    .returning();

  return result[0];
}

export async function getReportAccessTokenWithReportByTokenHash(tokenHash: string) {
  const result = await db
    .select({
      token: reportAccessTokens,
      report: reports,
    })
    .from(reportAccessTokens)
    .innerJoin(reports, eq(reportAccessTokens.reportId, reports.id))
    .where(eq(reportAccessTokens.tokenHash, tokenHash))
    .limit(1);

  return result[0];
}
