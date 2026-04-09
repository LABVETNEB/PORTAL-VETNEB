import crypto from "node:crypto";

import { ENV } from "./env";

export interface AdminJwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  clinicUserId: number | null;
  clinicId: number | null;
}

export class AdminJwtError extends Error {}
export class AdminJwtExpiredError extends AdminJwtError {}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function sign(content: string): string {
  return toBase64Url(
    crypto.createHmac("sha256", ENV.adminJwtSecret).update(content).digest(),
  );
}

function parsePayload(payloadSegment: string): AdminJwtPayload {
  let parsed: Partial<AdminJwtPayload>;

  try {
    parsed = JSON.parse(fromBase64Url(payloadSegment).toString("utf8")) as Partial<AdminJwtPayload>;
  } catch {
    throw new AdminJwtError("Payload JWT admin invalido");
  }

  if (
    typeof parsed.sub !== "string" ||
    typeof parsed.email !== "string" ||
    typeof parsed.iat !== "number" ||
    typeof parsed.exp !== "number" ||
    typeof parsed.iss !== "string" ||
    typeof parsed.aud !== "string"
  ) {
    throw new AdminJwtError("Payload JWT admin invalido");
  }

  if (parsed.iss !== ENV.adminJwtIssuer || parsed.aud !== ENV.adminJwtAudience) {
    throw new AdminJwtError("Issuer/Audience JWT admin invalidos");
  }

  return {
    sub: parsed.sub,
    email: parsed.email.trim().toLowerCase(),
    iat: parsed.iat,
    exp: parsed.exp,
    iss: parsed.iss,
    aud: parsed.aud,
    clinicUserId:
      typeof parsed.clinicUserId === "number" && Number.isInteger(parsed.clinicUserId)
        ? parsed.clinicUserId
        : null,
    clinicId:
      typeof parsed.clinicId === "number" && Number.isInteger(parsed.clinicId)
        ? parsed.clinicId
        : null,
  };
}

export function createAdminJwt(input: {
  adminUserId: number;
  email: string;
  clinicUserId: number | null;
  clinicId: number | null;
}) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ENV.adminJwtTtlMinutes * 60;

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload: AdminJwtPayload = {
    sub: String(input.adminUserId),
    email: input.email.trim().toLowerCase(),
    iat: now,
    exp,
    iss: ENV.adminJwtIssuer,
    aud: ENV.adminJwtAudience,
    clinicUserId: input.clinicUserId,
    clinicId: input.clinicId,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    expiresAt: new Date(exp * 1000),
    payload,
  };
}

export function verifyAdminJwt(token: string): AdminJwtPayload {
  const trimmed = token.trim();
  const segments = trimmed.split(".");

  if (segments.length !== 3) {
    throw new AdminJwtError("Formato JWT admin invalido");
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;

  let header: {
    alg?: string;
    typ?: string;
  };

  try {
    header = JSON.parse(fromBase64Url(headerSegment).toString("utf8")) as {
      alg?: string;
      typ?: string;
    };
  } catch {
    throw new AdminJwtError("Header JWT admin invalido");
  }

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new AdminJwtError("Header JWT admin invalido");
  }

  const expectedSignature = sign(`${headerSegment}.${payloadSegment}`);
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(signatureSegment, "utf8");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new AdminJwtError("Firma JWT admin invalida");
  }

  const payload = parsePayload(payloadSegment);
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp <= now) {
    throw new AdminJwtExpiredError("JWT admin expirado");
  }

  return payload;
}
