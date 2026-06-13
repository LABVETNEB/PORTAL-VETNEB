import { isIP } from "node:net";

import { hashRateLimitKey } from "./rate-limit-store.ts";

export const CONTACT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const CONTACT_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const CONTACT_RATE_LIMIT_ERROR_MESSAGE =
  "Demasiadas solicitudes. Intentá nuevamente en unos minutos.";

const UNKNOWN_CLIENT_IDENTIFIER = "unknown";
const MAX_CLIENT_IDENTIFIER_LENGTH = 64;

export function normalizeContactClientIdentifier(value: unknown): string {
  if (typeof value !== "string") {
    return UNKNOWN_CLIENT_IDENTIFIER;
  }

  let normalized = value.split(",", 1)[0]?.trim().toLowerCase() ?? "";

  if (!normalized || normalized.length > MAX_CLIENT_IDENTIFIER_LENGTH) {
    return UNKNOWN_CLIENT_IDENTIFIER;
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }

  const zoneIndex = normalized.indexOf("%");
  if (zoneIndex > -1) {
    normalized = normalized.slice(0, zoneIndex);
  }

  if (normalized.startsWith("::ffff:")) {
    const ipv4 = normalized.slice("::ffff:".length);

    if (isIP(ipv4) === 4) {
      return ipv4;
    }
  }

  return isIP(normalized) > 0 ? normalized : UNKNOWN_CLIENT_IDENTIFIER;
}

export function buildContactRateLimitKey(clientIdentifier: unknown): string {
  const normalized = normalizeContactClientIdentifier(clientIdentifier);

  return hashRateLimitKey(`contact:${normalized}`);
}
