import { and, asc, eq, ne } from "drizzle-orm";

import { db } from "./db.ts";
import {
  adminUsers,
  clinicPublicProfiles,
  clinicUsers,
  clinics,
  type ClinicUserRole,
} from "../drizzle/schema.ts";

export type AdminRoleUserType = "admin" | "clinic";
export type AdminRoleUserRole = "admin" | ClinicUserRole;

export type AdminRoleUserSummary =
  | {
      userType: "admin";
      userId: number;
      username: string;
      role: "admin";
      clinicId: null;
      clinicName: null;
      createdAt: string;
      updatedAt: string;
    }
  | {
      userType: "clinic";
      userId: number;
      username: string;
      role: ClinicUserRole;
      clinicId: number;
      clinicName: string | null;
      clinicLocality?: string | null;
      createdAt: string;
      updatedAt: string;
    };

export type AdminUsersRolesQuery = {
  userType?: AdminRoleUserType;
  role?: AdminRoleUserRole;
  limit?: number;
  offset?: number;
};

export type AdminUsersRolesSnapshot = {
  success: true;
  users: AdminRoleUserSummary[];
  total: number;
  limit: number;
  offset: number;
  totals: {
    adminUsers: number;
    clinicUsers: number;
  };
};

export type AdminClinicUserRoleChangeInput = {
  clinicUserId: number;
  role: ClinicUserRole;
  now?: Date;
};

export type AdminClinicUserRoleChangeResult =
  | {
      ok: true;
      user: Extract<AdminRoleUserSummary, { userType: "clinic" }>;
      previousRole: ClinicUserRole;
      roleChanged: boolean;
    }
  | {
      ok: false;
      reason: "not_found" | "last_clinic_owner";
    };

type ClinicUserRoleRow = {
  userId: number;
  username: string;
  role: ClinicUserRole;
  clinicId: number;
  clinicName: string | null;
  clinicLocality: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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

function toIsoDate(value: Date) {
  return value.toISOString();
}

function sortUsers(a: AdminRoleUserSummary, b: AdminRoleUserSummary) {
  if (a.userType !== b.userType) {
    return a.userType === "admin" ? -1 : 1;
  }

  return a.username.localeCompare(b.username);
}

function serializeClinicUserRoleRow(
  row: ClinicUserRoleRow,
): Extract<AdminRoleUserSummary, { userType: "clinic" }> {
  return {
    userType: "clinic",
    userId: row.userId,
    username: row.username,
    role: row.role,
    clinicId: row.clinicId,
    clinicName: row.clinicName ?? null,
    clinicLocality: row.clinicLocality ?? null,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

async function getClinicUserRoleRow(
  clinicUserId: number,
): Promise<ClinicUserRoleRow | null> {
  const rows = await db
    .select({
      userId: clinicUsers.id,
      username: clinicUsers.username,
      role: clinicUsers.role,
      clinicId: clinicUsers.clinicId,
      clinicName: clinics.name,
      clinicLocality: clinicPublicProfiles.locality,
      createdAt: clinicUsers.createdAt,
      updatedAt: clinicUsers.updatedAt,
    })
    .from(clinicUsers)
    .leftJoin(clinics, eq(clinics.id, clinicUsers.clinicId))
    .leftJoin(
      clinicPublicProfiles,
      eq(clinicPublicProfiles.clinicId, clinicUsers.clinicId),
    )
    .where(eq(clinicUsers.id, clinicUserId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getAdminUsersRolesSnapshot(
  params: AdminUsersRolesQuery = {},
): Promise<AdminUsersRolesSnapshot> {
  const limit = normalizeLimit(params.limit);
  const offset = normalizeOffset(params.offset);

  const includeAdmins =
    params.userType === undefined || params.userType === "admin";
  const includeClinicUsers =
    params.userType === undefined || params.userType === "clinic";

  const [adminRows, clinicRows] = await Promise.all([
    includeAdmins
      ? db
          .select({
            userId: adminUsers.id,
            username: adminUsers.username,
            createdAt: adminUsers.createdAt,
            updatedAt: adminUsers.updatedAt,
          })
          .from(adminUsers)
          .orderBy(asc(adminUsers.username))
      : Promise.resolve([]),
    includeClinicUsers
      ? db
          .select({
            userId: clinicUsers.id,
            username: clinicUsers.username,
            role: clinicUsers.role,
            clinicId: clinicUsers.clinicId,
            clinicName: clinics.name,
            clinicLocality: clinicPublicProfiles.locality,
            createdAt: clinicUsers.createdAt,
            updatedAt: clinicUsers.updatedAt,
          })
          .from(clinicUsers)
          .leftJoin(clinics, eq(clinics.id, clinicUsers.clinicId))
          .leftJoin(
            clinicPublicProfiles,
            eq(clinicPublicProfiles.clinicId, clinicUsers.clinicId),
          )
          .orderBy(asc(clinicUsers.username))
      : Promise.resolve([]),
  ]);

  const users: AdminRoleUserSummary[] = [
    ...adminRows.map((row) => ({
      userType: "admin" as const,
      userId: row.userId,
      username: row.username,
      role: "admin" as const,
      clinicId: null,
      clinicName: null,
      createdAt: toIsoDate(row.createdAt),
      updatedAt: toIsoDate(row.updatedAt),
    })),
    ...clinicRows.map((row) =>
      serializeClinicUserRoleRow({
        userId: row.userId,
        username: row.username,
        role: row.role,
        clinicId: row.clinicId,
        clinicName: row.clinicName ?? null,
        clinicLocality: row.clinicLocality ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    ),
  ]
    .filter((user) => (params.role ? user.role === params.role : true))
    .sort(sortUsers);

  return {
    success: true,
    users: users.slice(offset, offset + limit),
    total: users.length,
    limit,
    offset,
    totals: {
      adminUsers: users.filter((user) => user.userType === "admin").length,
      clinicUsers: users.filter((user) => user.userType === "clinic").length,
    },
  };
}

export async function changeClinicUserRole(
  input: AdminClinicUserRoleChangeInput,
): Promise<AdminClinicUserRoleChangeResult> {
  const current = await getClinicUserRoleRow(input.clinicUserId);

  if (!current) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  if (current.role === input.role) {
    return {
      ok: true,
      user: serializeClinicUserRoleRow(current),
      previousRole: current.role,
      roleChanged: false,
    };
  }

  if (current.role === "clinic_owner" && input.role === "clinic_staff") {
    const otherOwners = await db
      .select({
        userId: clinicUsers.id,
      })
      .from(clinicUsers)
      .where(
        and(
          eq(clinicUsers.clinicId, current.clinicId),
          eq(clinicUsers.role, "clinic_owner"),
          ne(clinicUsers.id, input.clinicUserId),
        ),
      )
      .limit(1);

    if (otherOwners.length === 0) {
      return {
        ok: false,
        reason: "last_clinic_owner",
      };
    }
  }

  await db
    .update(clinicUsers)
    .set({
      role: input.role,
      updatedAt: input.now ?? new Date(),
    })
    .where(eq(clinicUsers.id, input.clinicUserId));

  const updated = await getClinicUserRoleRow(input.clinicUserId);

  if (!updated) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  return {
    ok: true,
    user: serializeClinicUserRoleRow(updated),
    previousRole: current.role,
    roleChanged: true,
  };
}
