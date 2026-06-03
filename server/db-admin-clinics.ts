import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "./db.ts";
import {
  activeSessions,
  clinicPublicProfiles,
  clinicPublicSearch,
  clinicUsers,
  clinics,
  fieldVisits,
  particularSessions,
  particularTokens,
  reportAccessTokens,
  reportStatusHistory,
  reports,
  routeEvents,
  routePlans,
  routeStops,
  slaInstances,
  slaPolicies,
  studyTrackingCases,
  studyTrackingNotifications,
  timeWindows,
  type ClinicUserRole,
  visitLocations,
} from "../drizzle/schema.ts";
import { normalizeListPagination } from "./lib/list-pagination.ts";

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

export type AdminClinicDeleteInput = {
  clinicId: number;
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

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

let requiresLegacyClinicIdCache: boolean | null = null;

type LegacyClinicIdColumnRow = {
  isNullable: string;
};

function buildLegacyClinicExternalId(clinicId: number) {
  return `clinic-${clinicId}`;
}

async function requiresLegacyClinicId(tx: DbTransaction): Promise<boolean> {
  if (requiresLegacyClinicIdCache !== null) {
    return requiresLegacyClinicIdCache;
  }

  const rows = await tx.execute<LegacyClinicIdColumnRow>(sql`
    select is_nullable as "isNullable"
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinics'
      and column_name = 'clinic_id'
    limit 1
  `);
  const column = rows[0];
  requiresLegacyClinicIdCache = column?.isNullable === "NO";

  return requiresLegacyClinicIdCache;
}

type ReservedClinicIdRow = {
  clinicId: number;
};

async function reserveNextClinicId(tx: DbTransaction): Promise<number> {
  const rows = await tx.execute<ReservedClinicIdRow>(sql`
    select nextval(pg_get_serial_sequence('public.clinics', 'id'))::int as "clinicId"
  `);
  const reserved = rows[0];

  if (!reserved?.clinicId || !Number.isInteger(reserved.clinicId)) {
    throw new Error("No se pudo reservar el id de clínica.");
  }

  return reserved.clinicId;
}

function toIsoDate(value: Date | string | number) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha inválida recibida desde DB.");
  }

  return date.toISOString();
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

export async function listAdminClinics(params: {
  limit?: number;
  offset?: number;
} = {}): Promise<AdminClinicsSnapshot> {
  const { limit, offset } = normalizeListPagination(params);
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
    const useLegacyClinicId = await requiresLegacyClinicId(tx);
    const insertedClinics = useLegacyClinicId
      ? await (async () => {
          const reservedClinicId = await reserveNextClinicId(tx);
          const legacyClinicId = buildLegacyClinicExternalId(reservedClinicId);

          return tx.execute<ClinicRow>(sql`
            insert into "clinics" (
              "id",
              "clinic_id",
              "name",
              "contact_email",
              "contact_phone",
              "created_at",
              "updated_at"
            )
            values (
              ${reservedClinicId},
              ${legacyClinicId},
              ${input.clinicName.trim()},
              ${input.contactEmail.trim()},
              ${input.contactPhone?.trim() || null},
              ${now.toISOString()}::timestamptz,
              ${now.toISOString()}::timestamptz
            )
            returning
              "id" as "clinicId",
              "name" as "clinicName",
              "contact_email" as "contactEmail",
              "contact_phone" as "contactPhone",
              "created_at" as "createdAt",
              "updated_at" as "updatedAt"
          `);
        })()
      : await tx
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

export async function getAdminClinicById(
  clinicId: number,
): Promise<AdminClinicSummary | null> {
  const rows = await db
    .select({
      clinicId: clinics.id,
      clinicName: clinics.name,
      contactEmail: clinics.contactEmail,
      contactPhone: clinics.contactPhone,
      createdAt: clinics.createdAt,
      updatedAt: clinics.updatedAt,
    })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  return rows[0] ? serializeClinic(rows[0]) : null;
}

export async function deleteAdminClinic(
  input: AdminClinicDeleteInput,
): Promise<AdminClinicSummary | null> {
  return db.transaction(async (tx) => {
    const clinicRows = await tx
      .select({
        clinicId: clinics.id,
        clinicName: clinics.name,
        contactEmail: clinics.contactEmail,
        contactPhone: clinics.contactPhone,
        createdAt: clinics.createdAt,
        updatedAt: clinics.updatedAt,
      })
      .from(clinics)
      .where(eq(clinics.id, input.clinicId))
      .limit(1);
    const clinic = clinicRows[0];

    if (!clinic) {
      return null;
    }

    const [clinicUserRows, reportRows, particularTokenRows, fieldVisitRows, routePlanRows] =
      await Promise.all([
        tx
          .select({ id: clinicUsers.id })
          .from(clinicUsers)
          .where(eq(clinicUsers.clinicId, input.clinicId)),
        tx
          .select({ id: reports.id })
          .from(reports)
          .where(eq(reports.clinicId, input.clinicId)),
        tx
          .select({ id: particularTokens.id })
          .from(particularTokens)
          .where(eq(particularTokens.clinicId, input.clinicId)),
        tx
          .select({ id: fieldVisits.id })
          .from(fieldVisits)
          .where(eq(fieldVisits.clinicId, input.clinicId)),
        tx
          .select({ id: routePlans.id })
          .from(routePlans)
          .where(eq(routePlans.clinicId, input.clinicId)),
      ]);

    const clinicUserIds = clinicUserRows.map((row) => row.id);
    const reportIds = reportRows.map((row) => row.id);
    const particularTokenIds = particularTokenRows.map((row) => row.id);
    const fieldVisitIds = fieldVisitRows.map((row) => row.id);
    const routePlanIds = routePlanRows.map((row) => row.id);

    if (reportIds.length > 0) {
      await tx
        .delete(reportAccessTokens)
        .where(inArray(reportAccessTokens.reportId, reportIds));
      await tx
        .delete(reportStatusHistory)
        .where(inArray(reportStatusHistory.reportId, reportIds));
    }

    await tx
      .delete(reportAccessTokens)
      .where(eq(reportAccessTokens.clinicId, input.clinicId));

    if (particularTokenIds.length > 0) {
      await tx
        .delete(particularSessions)
        .where(inArray(particularSessions.particularTokenId, particularTokenIds));
    }

    if (clinicUserIds.length > 0) {
      await tx
        .delete(activeSessions)
        .where(inArray(activeSessions.clinicUserId, clinicUserIds));
    }

    await tx
      .delete(studyTrackingNotifications)
      .where(eq(studyTrackingNotifications.clinicId, input.clinicId));

    await tx
      .delete(routeEvents)
      .where(eq(routeEvents.clinicId, input.clinicId));

    if (routePlanIds.length > 0) {
      await tx
        .delete(routeStops)
        .where(inArray(routeStops.routePlanId, routePlanIds));
    }

    if (fieldVisitIds.length > 0) {
      await tx
        .delete(routeStops)
        .where(inArray(routeStops.fieldVisitId, fieldVisitIds));
      await tx
        .delete(visitLocations)
        .where(inArray(visitLocations.fieldVisitId, fieldVisitIds));
      await tx
        .delete(timeWindows)
        .where(inArray(timeWindows.fieldVisitId, fieldVisitIds));
    }

    await tx
      .delete(studyTrackingCases)
      .where(eq(studyTrackingCases.clinicId, input.clinicId));
    await tx
      .delete(slaInstances)
      .where(eq(slaInstances.clinicId, input.clinicId));
    await tx
      .delete(slaPolicies)
      .where(eq(slaPolicies.clinicId, input.clinicId));
    await tx
      .delete(routePlans)
      .where(eq(routePlans.clinicId, input.clinicId));
    await tx
      .delete(fieldVisits)
      .where(eq(fieldVisits.clinicId, input.clinicId));
    await tx
      .delete(particularTokens)
      .where(eq(particularTokens.clinicId, input.clinicId));
    await tx
      .delete(reports)
      .where(eq(reports.clinicId, input.clinicId));
    await tx
      .delete(clinicPublicSearch)
      .where(eq(clinicPublicSearch.clinicId, input.clinicId));
    await tx
      .delete(clinicPublicProfiles)
      .where(eq(clinicPublicProfiles.clinicId, input.clinicId));
    await tx
      .delete(clinicUsers)
      .where(eq(clinicUsers.clinicId, input.clinicId));
    await tx
      .execute(sql`update "audit_log" set "clinic_id" = null where "clinic_id" = ${input.clinicId}`);

    const deleted = await tx
      .delete(clinics)
      .where(eq(clinics.id, input.clinicId))
      .returning({
        clinicId: clinics.id,
        clinicName: clinics.name,
        contactEmail: clinics.contactEmail,
        contactPhone: clinics.contactPhone,
        createdAt: clinics.createdAt,
        updatedAt: clinics.updatedAt,
      });

    return deleted[0] ? serializeClinic(deleted[0]) : serializeClinic(clinic);
  });
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
