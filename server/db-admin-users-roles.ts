import { asc, eq } from "drizzle-orm";

import { db } from "./db.ts";
import {
  adminUsers,
  clinicUsers,
  clinics,
  type ClinicUserRole,
} from "../drizzle/schema";

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
            createdAt: clinicUsers.createdAt,
            updatedAt: clinicUsers.updatedAt,
          })
          .from(clinicUsers)
          .leftJoin(clinics, eq(clinics.id, clinicUsers.clinicId))
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
    ...clinicRows.map((row) => ({
      userType: "clinic" as const,
      userId: row.userId,
      username: row.username,
      role: row.role,
      clinicId: row.clinicId,
      clinicName: row.clinicName ?? null,
      createdAt: toIsoDate(row.createdAt),
      updatedAt: toIsoDate(row.updatedAt),
    })),
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