import type { ClinicUserRole } from "../../drizzle/schema";

export function isClinicUserRole(value: unknown): value is ClinicUserRole {
  return value === "clinic_owner" || value === "clinic_staff";
}

export function normalizeClinicUserRole(
  value: unknown,
  fallback: ClinicUserRole = "clinic_staff",
): ClinicUserRole {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "clinic_owner" || normalized === "clinic_staff") {
    return normalized;
  }

  return fallback;
}

export type ClinicPermissions = {
  canUploadReports: boolean;
  canManageClinicUsers: boolean;
};

export function getClinicPermissions(role: ClinicUserRole): ClinicPermissions {
  switch (role) {
    case "clinic_owner":
      return {
        canUploadReports: false,
        canManageClinicUsers: true,
      };
    case "clinic_staff":
    default:
      return {
        canUploadReports: false,
        canManageClinicUsers: false,
      };
  }
}
