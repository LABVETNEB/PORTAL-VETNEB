export const ADMIN_ROLE_USER_TYPES = ["admin", "clinic"] as const;
export const ADMIN_ROLE_USER_ROLES = [
  "admin",
  "clinic_owner",
  "clinic_staff",
] as const;
export const ADMIN_CLINIC_USER_ROLES = [
  "clinic_owner",
  "clinic_staff",
] as const;

export type AdminRoleUserType = (typeof ADMIN_ROLE_USER_TYPES)[number];
export type AdminRoleUserRole = (typeof ADMIN_ROLE_USER_ROLES)[number];
export type AdminClinicUserRole = (typeof ADMIN_CLINIC_USER_ROLES)[number];

export function isAdminRoleUserType(
  value: unknown,
): value is AdminRoleUserType {
  return value === "admin" || value === "clinic";
}

export function parseAdminRoleUserType(
  value: unknown,
): AdminRoleUserType | null {
  return isAdminRoleUserType(value) ? value : null;
}

export function isAdminRoleUserRole(
  value: unknown,
): value is AdminRoleUserRole {
  return (
    value === "admin" ||
    value === "clinic_owner" ||
    value === "clinic_staff"
  );
}

export function parseAdminRoleUserRole(
  value: unknown,
): AdminRoleUserRole | null {
  return isAdminRoleUserRole(value) ? value : null;
}

export function isAdminClinicUserRole(
  value: unknown,
): value is AdminClinicUserRole {
  return value === "clinic_owner" || value === "clinic_staff";
}

export function parseAdminClinicUserRole(
  value: unknown,
): AdminClinicUserRole | null {
  return isAdminClinicUserRole(value) ? value : null;
}
