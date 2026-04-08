import { ENV } from "./env";

type UploadPermissionInput = {
  username: string;
  authProId?: string | null;
  role?: string | null;
};

function normalize(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function legacyCanUploadReports({
  username,
  authProId,
}: Omit<UploadPermissionInput, "role">): boolean {
  const normalizedUsername = normalize(username);
  const normalizedAuthProId = normalize(authProId);
  const normalizedOwnerOpenId = normalize(ENV.ownerOpenId);

  if (normalizedOwnerOpenId && normalizedAuthProId === normalizedOwnerOpenId) {
    return true;
  }

  return ENV.labUploadUsernames
    .map((value) => normalize(value))
    .some((value) => value !== null && value === normalizedUsername);
}

export function canUploadReports({
  username,
  authProId,
  role,
}: UploadPermissionInput): boolean {
  const normalizedRole = normalize(role);

  if (normalizedRole === "owner" || normalizedRole === "lab") {
    return true;
  }

  if (normalizedRole === "clinic") {
    return false;
  }

  return legacyCanUploadReports({
    username,
    authProId,
  });
}
