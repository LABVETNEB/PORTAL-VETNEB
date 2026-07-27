import type {
  AdminClinicUserRoleChangeInput,
  AdminClinicUserRoleChangeResult,
  AdminUsersRolesQuery,
  AdminUsersRolesRepository,
  AdminUsersRolesSnapshot,
} from "./ports/admin-users-roles-repository.ts";

export type AdminUsersRolesUseCases = {
  listAdminUsersRoles: (
    query: AdminUsersRolesQuery,
  ) => Promise<AdminUsersRolesSnapshot>;
  changeClinicUserRole: (
    input: AdminClinicUserRoleChangeInput,
  ) => Promise<AdminClinicUserRoleChangeResult>;
};

export function createAdminUsersRolesUseCases(
  repository: AdminUsersRolesRepository,
): AdminUsersRolesUseCases {
  return {
    listAdminUsersRoles: (query) =>
      repository.getAdminUsersRolesSnapshot(query),
    changeClinicUserRole: (input) =>
      repository.changeClinicUserRole(input),
  };
}
