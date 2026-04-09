import { and, count, desc, eq, ilike, isNotNull, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  activeSessions,
  adminUsers,
  clinicUsers,
  clinics,
  paymentLinks,
  paymentTransactions,
  reports,
  type ActiveSession,
  type AdminUser,
  type Clinic,
  type ClinicUser,
  type PaymentLink,
  type PaymentTransaction,
  type Report,
} from "../drizzle/schema";
import { ENV } from "./lib/env";
import { normalizeUserRole, USER_ROLES } from "./lib/permissions";

const client = postgres(ENV.databaseUrl, {
  prepare: false,
});

export const db = drizzle(client);

export async function closeDbConnection(): Promise<void> {
  await client.end();
}

/* =========================
   CLINICS
========================= */

export async function getClinicById(id: number): Promise<Clinic | undefined> {
  const result = await db.select().from(clinics).where(eq(clinics.id, id)).limit(1);
  return result[0];
}

export async function listClinics(): Promise<Clinic[]> {
  return db.select().from(clinics).orderBy(clinics.name);
}

/* =========================
   USERS
========================= */

export async function getClinicUserById(
  id: number,
): Promise<ClinicUser | undefined> {
  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.id, id))
    .limit(1);

  return result[0];
}

export async function getClinicUserByUsername(
  username: string,
): Promise<ClinicUser | undefined> {
  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.username, username.trim()))
    .limit(1);

  return result[0];
}

export async function upsertClinicUser(user: {
  clinicId: number;
  username: string;
  passwordHash: string;
  authProId?: string | null;
  role?: string | null;
}): Promise<ClinicUser> {
  const now = new Date();
  const normalizedRole = normalizeUserRole(user.role) ?? USER_ROLES.LAB;

  const result = await db
    .insert(clinicUsers)
    .values({
      clinicId: user.clinicId,
      username: user.username.trim(),
      passwordHash: user.passwordHash,
      authProId: user.authProId ?? null,
      role: normalizedRole,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: clinicUsers.username,
      set: {
        clinicId: user.clinicId,
        passwordHash: user.passwordHash,
        authProId: user.authProId ?? null,
        role: normalizedRole,
        updatedAt: now,
      },
    })
    .returning();

  return result[0];
}

/* =========================
   ADMIN USERS
========================= */

export async function getAdminUserByEmail(
  email: string,
): Promise<AdminUser | undefined> {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, normalizedEmail))
    .limit(1);

  return result[0];
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return db.select().from(adminUsers).orderBy(adminUsers.email);
}

/* =========================
   SESSIONS
========================= */

export async function createActiveSession(session: {
  clinicUserId: number;
  tokenHash: string;
  expiresAt: Date;
}): Promise<ActiveSession> {
  const result = await db
    .insert(activeSessions)
    .values({
      clinicUserId: session.clinicUserId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      lastAccess: new Date(),
    })
    .returning();

  return result[0];
}

export async function getActiveSessionByToken(
  tokenHash: string,
): Promise<ActiveSession | undefined> {
  const result = await db
    .select()
    .from(activeSessions)
    .where(eq(activeSessions.tokenHash, tokenHash))
    .limit(1);

  return result[0];
}

export async function updateSessionLastAccess(
  tokenHash: string,
): Promise<void> {
  await db
    .update(activeSessions)
    .set({ lastAccess: new Date() })
    .where(eq(activeSessions.tokenHash, tokenHash));
}

export async function deleteActiveSession(tokenHash: string): Promise<void> {
  await db
    .delete(activeSessions)
    .where(eq(activeSessions.tokenHash, tokenHash));
}

export async function deleteExpiredSessions(): Promise<number> {
  const now = new Date();

  const result = await db
    .delete(activeSessions)
    .where(lte(activeSessions.expiresAt, now))
    .returning({ id: activeSessions.id });

  return result.length;
}

/* =========================
   REPORTS
========================= */

export async function getReportById(id: number): Promise<Report | undefined> {
  const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return result[0];
}

export async function upsertReport(input: {
  clinicId: number;
  uploadDate?: Date | null;
  studyType?: string | null;
  patientName?: string | null;
  fileName?: string | null;
  storagePath: string;
}): Promise<Report> {
  const now = new Date();

  const result = await db
    .insert(reports)
    .values({
      clinicId: input.clinicId,
      uploadDate: input.uploadDate ?? null,
      studyType: input.studyType ?? null,
      patientName: input.patientName ?? null,
      fileName: input.fileName ?? null,
      storagePath: input.storagePath,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: reports.storagePath,
      set: {
        uploadDate: input.uploadDate ?? null,
        studyType: input.studyType ?? null,
        patientName: input.patientName ?? null,
        fileName: input.fileName ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return result[0];
}

export async function getReportsByClinicId(
  clinicId: number,
  limit = 50,
  offset = 0,
): Promise<Report[]> {
  return db
    .select()
    .from(reports)
    .where(eq(reports.clinicId, clinicId))
    .orderBy(desc(reports.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function searchReports(
  clinicId: number,
  query?: string,
  studyType?: string,
  limit = 50,
  offset = 0,
): Promise<Report[]> {
  const filters = [eq(reports.clinicId, clinicId)];

  if (studyType) {
    filters.push(eq(reports.studyType, studyType));
  }

  if (query) {
    filters.push(
      or(
        ilike(reports.patientName, `%${query}%`),
        ilike(reports.fileName, `%${query}%`),
        ilike(reports.studyType, `%${query}%`),
      )!,
    );
  }

  return db
    .select()
    .from(reports)
    .where(and(...filters))
    .orderBy(desc(reports.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getStudyTypes(clinicId: number): Promise<string[]> {
  const result = await db
    .selectDistinct({ studyType: reports.studyType })
    .from(reports)
    .where(and(eq(reports.clinicId, clinicId), isNotNull(reports.studyType)));

  return result
    .map((r) => r.studyType)
    .filter((v): v is string => !!v);
}

/* =========================
   PAYMENT LINKS
========================= */

export async function createPaymentLink(input: {
  clinicId: number;
  createdByAdminUserId?: number | null;
  token: string;
  patientName?: string | null;
  patientEmail?: string | null;
  description?: string | null;
  amountInCents: number;
  currency?: string | null;
  status?: string | null;
  expiresAt?: Date | null;
}): Promise<PaymentLink> {
  const now = new Date();

  const result = await db
    .insert(paymentLinks)
    .values({
      clinicId: input.clinicId,
      createdByAdminUserId: input.createdByAdminUserId ?? null,
      token: input.token,
      patientName: input.patientName ?? null,
      patientEmail: input.patientEmail ?? null,
      description: input.description ?? null,
      amountInCents: input.amountInCents,
      currency: input.currency ?? "ARS",
      status: input.status ?? "pending",
      expiresAt: input.expiresAt ?? null,
      updatedAt: now,
    })
    .returning();

  return result[0];
}

export async function getPaymentLinkById(
  id: number,
): Promise<PaymentLink | undefined> {
  const result = await db
    .select()
    .from(paymentLinks)
    .where(eq(paymentLinks.id, id))
    .limit(1);

  return result[0];
}

export async function getPaymentLinkByToken(
  token: string,
): Promise<PaymentLink | undefined> {
  const result = await db
    .select()
    .from(paymentLinks)
    .where(eq(paymentLinks.token, token))
    .limit(1);

  return result[0];
}

export async function listPaymentLinks(filters?: {
  clinicId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<PaymentLink[]> {
  const whereFilters = [];

  if (typeof filters?.clinicId === "number") {
    whereFilters.push(eq(paymentLinks.clinicId, filters.clinicId));
  }

  if (filters?.status) {
    whereFilters.push(eq(paymentLinks.status, filters.status));
  }

  const whereClause = whereFilters.length > 0 ? and(...whereFilters) : undefined;
  const hasPagination =
    typeof filters?.limit === "number" || typeof filters?.offset === "number";

  if (hasPagination) {
    const limit = typeof filters?.limit === "number" ? filters.limit : 20;
    const offset = typeof filters?.offset === "number" ? filters.offset : 0;

    if (whereClause) {
      return db
        .select()
        .from(paymentLinks)
        .where(whereClause)
        .orderBy(desc(paymentLinks.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return db
      .select()
      .from(paymentLinks)
      .orderBy(desc(paymentLinks.createdAt))
      .limit(limit)
      .offset(offset);
  }

  if (whereClause) {
    return db
      .select()
      .from(paymentLinks)
      .where(whereClause)
      .orderBy(desc(paymentLinks.createdAt));
  }

  return db.select().from(paymentLinks).orderBy(desc(paymentLinks.createdAt));
}

export async function countPaymentLinks(filters?: {
  clinicId?: number;
  status?: string;
}): Promise<number> {
  const whereFilters = [];

  if (typeof filters?.clinicId === "number") {
    whereFilters.push(eq(paymentLinks.clinicId, filters.clinicId));
  }

  if (filters?.status) {
    whereFilters.push(eq(paymentLinks.status, filters.status));
  }

  const whereClause = whereFilters.length > 0 ? and(...whereFilters) : undefined;

  const result = whereClause
    ? await db.select({ count: count() }).from(paymentLinks).where(whereClause)
    : await db.select({ count: count() }).from(paymentLinks);

  return Number(result[0]?.count ?? 0);
}

export async function updatePaymentLinkStatus(input: {
  paymentLinkId: number;
  status: string;
  paidAt?: Date | null;
}): Promise<PaymentLink | undefined> {
  const result = await db
    .update(paymentLinks)
    .set({
      status: input.status,
      paidAt: input.paidAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(paymentLinks.id, input.paymentLinkId))
    .returning();

  return result[0];
}

/* =========================
   PAYMENT TRANSACTIONS
========================= */

export async function createPaymentTransaction(input: {
  paymentLinkId: number;
  provider?: string | null;
  providerReference?: string | null;
  idempotencyKey?: string | null;
  status: string;
  amountInCents: number;
  currency?: string | null;
  rawPayload?: string | null;
}): Promise<PaymentTransaction> {
  const now = new Date();

  const result = await db
    .insert(paymentTransactions)
    .values({
      paymentLinkId: input.paymentLinkId,
      provider: input.provider ?? "manual",
      providerReference: input.providerReference ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      status: input.status,
      amountInCents: input.amountInCents,
      currency: input.currency ?? "ARS",
      rawPayload: input.rawPayload ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return result[0];
}

export async function getPendingPaymentTransactionByLinkId(
  paymentLinkId: number,
): Promise<PaymentTransaction | undefined> {
  const result = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.paymentLinkId, paymentLinkId),
        eq(paymentTransactions.status, "pending"),
      ),
    )
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(1);

  return result[0];
}

export async function getApprovedPaymentTransactionByLinkId(
  paymentLinkId: number,
): Promise<PaymentTransaction | undefined> {
  const result = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.paymentLinkId, paymentLinkId),
        eq(paymentTransactions.status, "approved"),
      ),
    )
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(1);

  return result[0];
}

export async function approvePaymentTransaction(input: {
  transactionId: number;
  provider: string;
  providerReference?: string | null;
  rawPayload?: string | null;
}): Promise<PaymentTransaction | undefined> {
  const result = await db
    .update(paymentTransactions)
    .set({
      status: "approved",
      provider: input.provider,
      providerReference: input.providerReference ?? null,
      rawPayload: input.rawPayload ?? null,
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.id, input.transactionId))
    .returning();

  return result[0];
}

export async function listPaymentTransactions(filters?: {
  clinicId?: number;
  paymentLinkId?: number;
  limit?: number;
  offset?: number;
}): Promise<
  Array<
    PaymentTransaction & {
      paymentLinkToken: string;
      clinicId: number;
    }
  >
> {
  const whereFilters = [];

  if (typeof filters?.clinicId === "number") {
    whereFilters.push(eq(paymentLinks.clinicId, filters.clinicId));
  }

  if (typeof filters?.paymentLinkId === "number") {
    whereFilters.push(eq(paymentTransactions.paymentLinkId, filters.paymentLinkId));
  }

  const query = db
    .select({
      id: paymentTransactions.id,
      paymentLinkId: paymentTransactions.paymentLinkId,
      provider: paymentTransactions.provider,
      providerReference: paymentTransactions.providerReference,
      idempotencyKey: paymentTransactions.idempotencyKey,
      status: paymentTransactions.status,
      amountInCents: paymentTransactions.amountInCents,
      currency: paymentTransactions.currency,
      rawPayload: paymentTransactions.rawPayload,
      createdAt: paymentTransactions.createdAt,
      updatedAt: paymentTransactions.updatedAt,
      paymentLinkToken: paymentLinks.token,
      clinicId: paymentLinks.clinicId,
    })
    .from(paymentTransactions)
    .innerJoin(paymentLinks, eq(paymentTransactions.paymentLinkId, paymentLinks.id));

  const hasPagination =
    typeof filters?.limit === "number" || typeof filters?.offset === "number";

  if (whereFilters.length > 0) {
    if (hasPagination) {
      return query
        .where(and(...whereFilters))
        .orderBy(desc(paymentTransactions.createdAt))
        .limit(typeof filters?.limit === "number" ? filters.limit : 20)
        .offset(typeof filters?.offset === "number" ? filters.offset : 0);
    }

    return query.where(and(...whereFilters)).orderBy(desc(paymentTransactions.createdAt));
  }

  if (hasPagination) {
    return query
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(typeof filters?.limit === "number" ? filters.limit : 20)
      .offset(typeof filters?.offset === "number" ? filters.offset : 0);
  }

  return query.orderBy(desc(paymentTransactions.createdAt));
}
