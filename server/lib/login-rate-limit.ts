export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const LOGIN_RATE_LIMIT_ERROR_MESSAGE =
  "Demasiados intentos de inicio de sesión. Intente más tarde.";

const LOGIN_RATE_LIMIT_KEY_VERSION = "v2";
const LOGIN_RATE_LIMIT_IDENTIFIER_MAX_LENGTH = 256;

export type LoginRateLimitSurface =
  | "admin"
  | "clinic"
  | "particular"
  | "unified";

export function normalizeLoginRateLimitIdentifier(identifier: string): string {
  return (
    identifier
      .trim()
      .toLowerCase()
      .slice(0, LOGIN_RATE_LIMIT_IDENTIFIER_MAX_LENGTH) || "unknown"
  );
}

export function buildLoginRateLimitKey(input: {
  surface: LoginRateLimitSurface;
  identifier: string;
  ipAddress?: string | null;
}): string {
  const normalizedIdentifier = normalizeLoginRateLimitIdentifier(
    input.identifier,
  );
  const normalizedIpAddress = input.ipAddress?.trim() || "unknown";

  return [
    "login",
    LOGIN_RATE_LIMIT_KEY_VERSION,
    input.surface,
    normalizedIdentifier,
    "ip",
    normalizedIpAddress,
  ].join(":");
}
