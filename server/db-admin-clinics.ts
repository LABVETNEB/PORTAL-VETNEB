import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "./db.ts";
import {
  clinicUsers,
  clinics,
  type ClinicUserRole,
} from "../drizzle/schema";

export type AdminClinicUserSummary = {
  userType: "clinic";
  userId: number;
  username: string;
  role: ClinicUserRole;
  clinicId: number;
  clinicName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminClinicSummary = {
  clinicId: number;
  clinicName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminClinicManagementSummary = AdminClinicSummary & {
  users: AdminClinicUserSummary[];
};

export type AdminClinicsSnapshot = {
  success: true;
  clinics: AdminClinicManagementSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminClinicCreateInput = {
  clinicName: string;
  contactEmail: string;
  contactPhone?: string | null;
  username: string;
  passwordHash: string;
  role: ClinicUserRole;
  now?: Date;
};

export type AdminClinicUpdateInput = {
  clinicId: number;
  clinicName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  now?: Date;
};

export type AdminClinicUserCredentialsUpdateInput = {
  clinicUserId: number;
  username?: string;
  passwordHash?: string;
  now?: Date;
};

export type AdminClinicCreateResult =
  | {
      ok: true;
      clinic: AdminClinicSummary;
      user: AdminClinicUserSummary;
    }
  | {
      ok: false;
      reason: "username_conflict";
    };

export type AdminClinicUserCredentialsUpdateResult =
  | {
      ok: true;
      user: AdminClinicUserSummary;
      previousUsername: string;
      usernameChanged: boolean;
      credentialUpdated: boolean;
    }
  | {
      ok: false;
      reason: "not_found" | "username_conflict";
    };

type ClinicRow = {
  clinicId: number;
  clinicName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ClinicUserRow = {
  userId: number;
  username: string;
  role: ClinicUserRole;
  clinicId: number;
  clinicName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toIsoDate(value: Date) {
  return value.toISOString();
}

function serializeClinic(row: ClinicRow): AdminClinicSummary {
  return {
    clinicId: row.clinicId,
    clinicName: row.clinicName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

function serializeClinicUser(row: ClinicUserRow): AdminClinicUserSummary {
  return {
    userType: "clinic",
    userId: row.userId,
    username: row.username,
    role: row.role,
    clinicId: row.clinicId,
    clinicName: row.clinicName,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

async function getClinicUserRow(
  clinicUserId: number,
): Promise<ClinicUserRow | null> {
  const rows = await db
    .select({
      userId: clinicUsers.id,
      username: clinicUsers.username,
      role: clinicUsers.role,
      clinicId: clinicUsers.clinicId,
      clinicName: clinics.name,
      createdAt: clinicUsers.createdAt,
      updatedAt: clinicUsers.updatedAt,
    })
    .from(clinicUsers)
    .leftJoin(clinics, eq(clinics.id, clinicUsers.clinicId))
    .where(eq(clinicUsers.id, clinicUserId))
    .limit(1);

  return rows[0] ?? null;
}

function normalizeLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 100);
}

function normalizeOffset(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(Math.trunc(value), 0);
}

export async function listAdminClinics(params: {
  limit?: number;
  offset?: number;
} = {}): Promise<AdminClinicsSnapshot> {
  const limit = normalizeLimit(params.limit);
  const offset = normalizeOffset(params.offset);
  const [clinicRows, totalRows] = await Promise.all([
    db
      .select({
        clinicId: clinics.id,
        clinicName: clinics.name,
        contactEmail: clinics.contactEmail,
        contactPhone: clinics.contactPhone,
        createdAt: clinics.createdAt,
        updatedAt: clinics.updatedAt,
      })
      .from(clinics)
      .orderBy(asc(clinics.name), asc(clinics.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(clinics),
  ]);

  const clinicIds = clinicRows.map((clinic) => clinic.clinicId);
  const userRows = clinicIds.length
    ? await db
        .select({
          userId: clinicUsers.id,
          username: clinicUsers.username,
          role: clinicUsers.role,
          clinicId: clinicUsers.clinicId,
          clinicName: clinics.name,
          createdAt: clinicUsers.createdAt,
          updatedAt: clinicUsers.updatedAt,
        })
        .from(clinicUsers)
        .leftJoin(clinics, eq(clinics.id, clinicUsers.clinicId))
        .where(inArray(clinicUsers.clinicId, clinicIds))
        .orderBy(asc(clinicUsers.username), asc(clinicUsers.id))
    : [];
  const usersByClinicId = new Map<number, AdminClinicUserSummary[]>();

  for (const row of userRows) {
    const existing = usersByClinicId.get(row.clinicId) ?? [];
    existing.push(serializeClinicUser(row));
    usersByClinicId.set(row.clinicId, existing);
  }

  return {
    success: true,
    clinics: clinicRows.map((clinic) => ({
      ...serializeClinic(clinic),
      users: usersByClinicId.get(clinic.clinicId) ?? [],
    })),
    total: Number(totalRows[0]?.total ?? 0),
    limit,
    offset,
  };
}

export async function createAdminClinicWithUser(
  input: AdminClinicCreateInput,
): Promise<AdminClinicCreateResult> {
  const username = input.username.trim();
  const existingUser = await db
    .select({ id: clinicUsers.id })
    .from(clinicUsers)
    .where(eq(clinicUsers.username, username))
    .limit(1);

  if (existingUser[0]) {
    return {
      ok: false,
      reason: "username_conflict",
    };
  }

  return db.transaction(async (tx) => {
    const now = input.now ?? new Date();
    const insertedClinics = await tx
      .insert(clinics)
      .values({
        name: input.clinicName.trim(),
        contactEmail: input.contactEmail.trim(),
        contactPhone: input.contactPhone?.trim() || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        clinicId: clinics.id,
        clinicName: clinics.name,
        contactEmail: clinics.contactEmail,
        contactPhone: clinics.contactPhone,
        createdAt: clinics.createdAt,
        updatedAt: clinics.updatedAt,
      });
    const clinic = insertedClinics[0];
    const insertedUsers = await tx
      .insert(clinicUsers)
      .values({
        clinicId: clinic.clinicId,
        username,
        passwordHash: input.passwordHash,
        authProId: null,
        role: input.role,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        userId: clinicUsers.id,
        username: clinicUsers.username,
        role: clinicUsers.role,
        clinicId: clinicUsers.clinicId,
        createdAt: clinicUsers.createdAt,
        updatedAt: clinicUsers.updatedAt,
      });
    const user = insertedUsers[0];

    return {
      ok: true,
      clinic: serializeClinic(clinic),
      user: serializeClinicUser({
        ...user,
        clinicName: clinic.clinicName,
      }),
    };
  });
}

export async function updateAdminClinic(
  input: AdminClinicUpdateInput,
): Promise<AdminClinicSummary | null> {
  const now = input.now ?? new Date();
  const values: {
    name?: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    updatedAt: Date;
  } = {
    updatedAt: now,
  };

  if (input.clinicName !== undefined) {
    values.name = input.clinicName.trim();
  }

  if (input.contactEmail !== undefined) {
    values.contactEmail = input.contactEmail?.trim() || null;
  }

  if (input.contactPhone !== undefined) {
    values.contactPhone = input.contactPhone?.trim() || null;
  }

  const updated = await db
    .update(clinics)
    .set(values)
    .where(eq(clinics.id, input.clinicId))
    .returning({
      clinicId: clinics.id,
      clinicName: clinics.name,
      contactEmail: clinics.contactEmail,
      contactPhone: clinics.contactPhone,
      createdAt: clinics.createdAt,
      updatedAt: clinics.updatedAt,
    });

  return updated[0] ? serializeClinic(updated[0]) : null;
}

export async function updateAdminClinicUserCredentials(
  input: AdminClinicUserCredentialsUpdateInput,
): Promise<AdminClinicUserCredentialsUpdateResult> {
  const current = await getClinicUserRow(input.clinicUserId);

  if (!current) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  const nextUsername = input.username?.trim();

  if (nextUsername && nextUsername !== current.username) {
    const existingUser = await db
      .select({ id: clinicUsers.id })
      .from(clinicUsers)
      .where(eq(clinicUsers.username, nextUsername))
      .limit(1);

    if (existingUser[0] && existingUser[0].id !== input.clinicUserId) {
      return {
        ok: false,
        reason: "username_conflict",
      };
    }
  }

  const values: {
    username?: string;
    passwordHash?: string;
    updatedAt: Date;
  } = {
    updatedAt: input.now ?? new Date(),
  };

  if (nextUsername) {
    values.username = nextUsername;
  }

  if (input.passwordHash) {
    values.passwordHash = input.passwordHash;
  }

  await db
    .update(clinicUsers)
    .set(values)
    .where(eq(clinicUsers.id, input.clinicUserId));

  const updated = await getClinicUserRow(input.clinicUserId);

  if (!updated) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  return {
    ok: true,
    user: serializeClinicUser(updated),
    previousUsername: current.username,
    usernameChanged: updated.username !== current.username,
    credentialUpdated: Boolean(input.passwordHash),
  };
}
