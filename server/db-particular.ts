import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "./db";
import {
  particularSessions,
  particularTokens,
  type NewParticularSession,
  type NewParticularToken,
} from "../drizzle/schema";

export async function createParticularToken(
  input: Omit<NewParticularToken, "id" | "createdAt" | "updatedAt">,
) {
  const now = new Date();

  const result = await db
    .insert(particularTokens)
    .values({
      ...input,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return result[0];
}

export async function getParticularTokenById(id: number) {
  const result = await db
    .select()
    .from(particularTokens)
    .where(eq(particularTokens.id, id))
    .limit(1);

  return result[0];
}

export async function getParticularTokenByTokenHash(tokenHash: string) {
  const result = await db
    .select()
    .from(particularTokens)
    .where(eq(particularTokens.tokenHash, tokenHash))
    .limit(1);

  return result[0];
}

export async function listParticularTokens(params?: {
  clinicId?: number;
  limit?: number;
  offset?: number;
}) {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;

  if (typeof params?.clinicId === "number") {
    return db
      .select()
      .from(particularTokens)
      .where(eq(particularTokens.clinicId, params.clinicId))
      .orderBy(desc(particularTokens.createdAt))
      .limit(limit)
      .offset(offset);
  }

  return db
    .select()
    .from(particularTokens)
    .orderBy(desc(particularTokens.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateParticularTokenReport(
  id: number,
  reportId: number | null,
) {
  const result = await db
    .update(particularTokens)
    .set({
      reportId,
      updatedAt: new Date(),
    })
    .where(eq(particularTokens.id, id))
    .returning();

  return result[0];
}

export async function updateParticularTokenLastLogin(id: number) {
  await db
    .update(particularTokens)
    .set({
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(particularTokens.id, id));
}

export async function createParticularSession(
  input: Omit<NewParticularSession, "id" | "createdAt">,
) {
  const result = await db
    .insert(particularSessions)
    .values({
      ...input,
      createdAt: new Date(),
    })
    .returning();

  return result[0];
}

export async function getParticularSessionByToken(tokenHash: string) {
  const result = await db
    .select()
    .from(particularSessions)
    .where(eq(particularSessions.tokenHash, tokenHash))
    .limit(1);

  return result[0];
}

export async function updateParticularSessionLastAccess(tokenHash: string) {
  await db
    .update(particularSessions)
    .set({
      lastAccess: new Date(),
    })
    .where(eq(particularSessions.tokenHash, tokenHash));
}

export async function deleteParticularSession(tokenHash: string) {
  await db
    .delete(particularSessions)
    .where(eq(particularSessions.tokenHash, tokenHash));
}

export async function deleteExpiredParticularSessions() {
  const now = new Date();

  const result = await db
    .delete(particularSessions)
    .where(lte(particularSessions.expiresAt, now))
    .returning({ id: particularSessions.id });

  return result.length;
}

export async function getParticularTokenBySessionTokenHash(tokenHash: string) {
  const result = await db
    .select({
      session: particularSessions,
      token: particularTokens,
    })
    .from(particularSessions)
    .innerJoin(
      particularTokens,
      eq(particularSessions.particularTokenId, particularTokens.id),
    )
    .where(eq(particularSessions.tokenHash, tokenHash))
    .limit(1);

  return result[0];
}

export async function getClinicScopedParticularToken(
  id: number,
  clinicId: number,
) {
  const result = await db
    .select()
    .from(particularTokens)
    .where(
      and(
        eq(particularTokens.id, id),
        eq(particularTokens.clinicId, clinicId),
      ),
    )
    .limit(1);

  return result[0];
}
