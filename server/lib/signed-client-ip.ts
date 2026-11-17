import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

// IP de cliente firmada entre servicios propios (Next -> Fastify). La firma sólo
// prueba que el emisor posee el secreto compartido: NO prueba que la IP sea
// auténtica. La autenticidad la decide quien firma, resolviéndola con una
// cadena estructural validada, y si no puede resolverla no firma.

export const SIGNED_CLIENT_IP_HEADER = "x-vetneb-client-ip";
export const SIGNED_CLIENT_IP_TIMESTAMP_HEADER = "x-vetneb-client-ip-ts";
export const SIGNED_CLIENT_IP_SIGNATURE_HEADER = "x-vetneb-client-ip-sig";
export const SIGNED_CLIENT_IP_HEADERS = [
  SIGNED_CLIENT_IP_HEADER,
  SIGNED_CLIENT_IP_TIMESTAMP_HEADER,
  SIGNED_CLIENT_IP_SIGNATURE_HEADER,
] as const;

export const SIGNED_CLIENT_IP_MAX_AGE_SECONDS = 30;
export const SIGNED_CLIENT_IP_MAX_FUTURE_SKEW_SECONDS = 5;
export const SIGNED_CLIENT_IP_MIN_SECRET_LENGTH = 32;

const CONTEXT = "vetneb-client-ip-v1";

export type SignClientIpInput = {
  secret: string;
  ip: string;
  timestampSeconds: number;
  method: string;
  path: string;
};

export type SignedClientIpHeaders = Record<
  (typeof SIGNED_CLIENT_IP_HEADERS)[number],
  string
>;

export function stripQuery(urlOrPath: string): string {
  const index = urlOrPath.search(/[?#]/);
  return index === -1 ? urlOrPath : urlOrPath.slice(0, index);
}

function isStrictIp(value: string): boolean {
  return value.length > 0 && value.length <= 45 && isIP(value) !== 0;
}

function computeSignature(input: SignClientIpInput): string {
  const payload = [
    CONTEXT,
    String(input.timestampSeconds),
    input.method.toUpperCase(),
    stripQuery(input.path),
    input.ip,
  ].join("\n");
  return createHmac("sha256", input.secret).update(payload).digest("hex");
}

export function signClientIp(input: SignClientIpInput): SignedClientIpHeaders | null {
  if (input.secret.length < SIGNED_CLIENT_IP_MIN_SECRET_LENGTH) return null;
  if (!isStrictIp(input.ip)) return null;
  if (!Number.isSafeInteger(input.timestampSeconds) || input.timestampSeconds <= 0) return null;
  return {
    [SIGNED_CLIENT_IP_HEADER]: input.ip,
    [SIGNED_CLIENT_IP_TIMESTAMP_HEADER]: String(input.timestampSeconds),
    [SIGNED_CLIENT_IP_SIGNATURE_HEADER]: computeSignature(input),
  };
}

export type VerifySignedClientIpInput = {
  secret: string;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  path: string;
  nowSeconds: number;
};

// Devuelve la IP firmada sólo si TODO es válido; cualquier anomalía devuelve null
// (el llamador conserva entonces la IP que ya resolvía por su cuenta).
export function verifySignedClientIp(input: VerifySignedClientIpInput): string | null {
  if (input.secret.length < SIGNED_CLIENT_IP_MIN_SECRET_LENGTH) return null;
  const ip = input.headers[SIGNED_CLIENT_IP_HEADER];
  const ts = input.headers[SIGNED_CLIENT_IP_TIMESTAMP_HEADER];
  const sig = input.headers[SIGNED_CLIENT_IP_SIGNATURE_HEADER];
  if (typeof ip !== "string" || typeof ts !== "string" || typeof sig !== "string") return null;
  if (!isStrictIp(ip)) return null;
  if (!/^\d{1,12}$/.test(ts)) return null;
  if (!/^[0-9a-f]{64}$/.test(sig)) return null;
  const timestampSeconds = Number(ts);
  const age = input.nowSeconds - timestampSeconds;
  if (age > SIGNED_CLIENT_IP_MAX_AGE_SECONDS) return null;
  if (age < -SIGNED_CLIENT_IP_MAX_FUTURE_SKEW_SECONDS) return null;

  const expected = Buffer.from(
    computeSignature({
      secret: input.secret,
      ip,
      timestampSeconds,
      method: input.method,
      path: input.path,
    }),
    "hex",
  );
  const received = Buffer.from(sig, "hex");
  if (expected.length !== received.length) return null;
  return timingSafeEqual(expected, received) ? ip : null;
}
