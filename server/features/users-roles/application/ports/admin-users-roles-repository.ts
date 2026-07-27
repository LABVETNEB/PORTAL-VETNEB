import type {
  AdminClinicUserRole,
  AdminRoleUserRole,
  AdminRoleUserType,
} from "../../domain/index.ts";

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
      role: AdminClinicUserRole;
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
  search?: string;
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
  role: AdminClinicUserRole;
  now?: Date;
};

export type AdminClinicUserRoleChangeResult =
  | {
      ok: true;
      user: Extract<AdminRoleUserSummary, { userType: "clinic" }>;
      previousRole: AdminClinicUserRole;
      roleChanged: boolean;
    }
  | {
      ok: false;
      reason: "not_found" | "last_clinic_owner";
    };

export type AdminUsersRolesRepository = {
  getAdminUsersRolesSnapshot: (
    query: AdminUsersRolesQuery,
  ) => Promise<AdminUsersRolesSnapshot>;
  changeClinicUserRole: (
    input: AdminClinicUserRoleChangeInput,
  ) => Promise<AdminClinicUserRoleChangeResult>;
};
