import { createHash } from "node:crypto";

export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const LOGIN_RATE_LIMIT_ERROR_MESSAGE =
  "Demasiados intentos de inicio de sesión. Intente más tarde.";

export const LOGIN_RATE_LIMIT_KEY_VERSION = "v2";

const LOGIN_RATE_LIMIT_IDENTIFIER_MAX_LENGTH = 256;
const LOGIN_RATE_LIMIT_HASH_PREFIX = "login-rate-limit";
const LOGIN_RATE_LIMIT_MISSING_IDENTIFIER = "missing";

export type LoginRateLimitSurface =
  | "admin"
  | "clinic"
  | "particular"
  | "unified";

export type LoginRateLimitKeyMetadata = {
  surface: LoginRateLimitSurface;
  identifierHash: string;
  ipHash: string;
  keyVersion: typeof LOGIN_RATE_LIMIT_KEY_VERSION;
};

export function normalizeLoginRateLimitIdentifier(identifier: string): string {
  return (
    identifier
      .trim()
      .toLowerCase()
      .slice(0, LOGIN_RATE_LIMIT_IDENTIFIER_MAX_LENGTH) || "unknown"
  );
}

export function normalizeLoginRateLimitIpAddress(
  ipAddress?: string | null,
): string {
  return ipAddress?.trim() || "unknown";
}

export function hashLoginRateLimitIdentifier(identifier: string): string {
  return createHash("sha256")
    .update(
      [
        LOGIN_RATE_LIMIT_HASH_PREFIX,
        LOGIN_RATE_LIMIT_KEY_VERSION,
        "identifier",
        normalizeLoginRateLimitIdentifier(identifier),
      ].join(":"),
    )
    .digest("hex");
}

export function hashLoginRateLimitIpAddress(
  ipAddress?: string | null,
): string {
  return createHash("sha256")
    .update(
      [
        LOGIN_RATE_LIMIT_HASH_PREFIX,
        LOGIN_RATE_LIMIT_KEY_VERSION,
        "ip",
        normalizeLoginRateLimitIpAddress(ipAddress),
      ].join(":"),
    )
    .digest("hex");
}

export function buildLoginRateLimitKeyMetadata(input: {
  surface: LoginRateLimitSurface;
  identifier: string;
  ipAddress?: string | null;
}): LoginRateLimitKeyMetadata {
  return {
    surface: input.surface,
    identifierHash: hashLoginRateLimitIdentifier(input.identifier),
    ipHash: hashLoginRateLimitIpAddress(input.ipAddress),
    keyVersion: LOGIN_RATE_LIMIT_KEY_VERSION,
  };
}

export function buildLoginRateLimitKey(input: {
  surface: LoginRateLimitSurface;
  identifier: string;
  ipAddress?: string | null;
}): string {
  const normalizedIdentifier = normalizeLoginRateLimitIdentifier(
    input.identifier,
  );
  const normalizedIpAddress = normalizeLoginRateLimitIpAddress(input.ipAddress);

  return [
    "login",
    LOGIN_RATE_LIMIT_KEY_VERSION,
    input.surface,
    normalizedIdentifier,
    "ip",
    normalizedIpAddress,
  ].join(":");
}

export function buildMissingCredentialsLoginRateLimitKey(input: {
  surface: LoginRateLimitSurface;
  ipAddress?: string | null;
}): string {
  return buildLoginRateLimitKey({
    surface: input.surface,
    identifier: LOGIN_RATE_LIMIT_MISSING_IDENTIFIER,
    ipAddress: input.ipAddress,
  });
}

export function getLoginRateLimitKeyMetadata(
  key: string,
): LoginRateLimitKeyMetadata | undefined {
  const keyPrefix = `login:${LOGIN_RATE_LIMIT_KEY_VERSION}:`;
  const ipMarker = ":ip:";

  if (!key.startsWith(keyPrefix)) {
    return undefined;
  }

  const keyBody = key.slice(keyPrefix.length);
  const surfaceSeparatorIndex = keyBody.indexOf(":");
  const ipMarkerIndex = keyBody.lastIndexOf(ipMarker);

  if (surfaceSeparatorIndex <= 0 || ipMarkerIndex <= surfaceSeparatorIndex) {
    return undefined;
  }

  const surface = keyBody.slice(
    0,
    surfaceSeparatorIndex,
  ) as LoginRateLimitSurface;

  if (!["admin", "clinic", "particular", "unified"].includes(surface)) {
    return undefined;
  }

  return buildLoginRateLimitKeyMetadata({
    surface,
    identifier: keyBody.slice(surfaceSeparatorIndex + 1, ipMarkerIndex),
    ipAddress: keyBody.slice(ipMarkerIndex + ipMarker.length),
  });
}

export function getLoginRateLimitResetSeconds(input: {
  resetAt: number;
  now: number;
}) {
  return Math.max(Math.ceil((input.resetAt - input.now) / 1000), 0);
}

export function buildLoginRateLimitHeaders(input: {
  max: number;
  windowMs: number;
  failedCount: number;
  resetAt: number;
  now: number;
}) {
  return {
    "RateLimit-Policy": `${input.max};w=${Math.ceil(input.windowMs / 1000)}`,
    "RateLimit-Limit": String(input.max),
    "RateLimit-Remaining": String(
      Math.max(input.max - input.failedCount, 0),
    ),
    "RateLimit-Reset": String(getLoginRateLimitResetSeconds(input)),
  };
}
