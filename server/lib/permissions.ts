import { ENV } from "./env";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

const labUploadUsernames = new Set(
  ENV.labUploadUsernames.map((username) => normalize(username)),
);

export function canUploadReports(user: {
  username: string;
  authProId?: string | null;
}): boolean {
  const normalizedUsername = normalize(user.username);

  if (labUploadUsernames.has(normalizedUsername)) {
    return true;
  }

  if (ENV.ownerOpenId && typeof user.authProId === "string") {
    return user.authProId === ENV.ownerOpenId;
  }

  return false;
}
