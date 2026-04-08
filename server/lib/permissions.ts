export const USER_ROLES = {
  ADMIN: "admin",
  LAB: "lab",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function isValidUserRole(value: unknown): value is UserRole {
  return value === USER_ROLES.ADMIN || value === USER_ROLES.LAB;
}

export function normalizeUserRole(value: unknown): UserRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return isValidUserRole(normalized) ? normalized : null;
}

export function canUploadReports(input: { role?: unknown }): boolean {
  const role = normalizeUserRole(input.role);
  return role === USER_ROLES.LAB;
}

export function canManageUsers(input: { role?: unknown }): boolean {
  const role = normalizeUserRole(input.role);
  return role === USER_ROLES.ADMIN;
}
