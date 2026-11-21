export type ReportAccessTokenState = "active" | "revoked" | "expired";

export function isReportAccessTokenExpired(
  expiresAt: Date | null | undefined,
  now = new Date(),
): boolean {
  return expiresAt instanceof Date && expiresAt.getTime() <= now.getTime();
}

export function isReportAccessTokenRevoked(
  revokedAt: Date | null | undefined,
): boolean {
  return revokedAt instanceof Date;
}

export function getReportAccessTokenState(
  token: { expiresAt: Date | null; revokedAt: Date | null },
  now = new Date(),
): ReportAccessTokenState {
  if (isReportAccessTokenRevoked(token.revokedAt)) {
    return "revoked";
  }
  return isReportAccessTokenExpired(token.expiresAt, now)
    ? "expired"
    : "active";
}

export function belongsToClinic(
  resourceClinicId: number,
  clinicId: number,
): boolean {
  return resourceClinicId === clinicId;
}

export function canAccessReportPublicly(currentStatus: string): boolean {
  return currentStatus === "ready" || currentStatus === "delivered";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const REPORT_ACCESS_TOKEN_DEFAULT_TTL_DAYS = 7;
export const REPORT_ACCESS_TOKEN_MAX_TTL_DAYS = 30;

export type ReportAccessTokenExpiryResolution =
  | { ok: true; expiresAt: Date }
  | { ok: false; error: string };

/**
 * Política única de vencimiento para tokens públicos nuevos (clínica y admin).
 * Omitido → default 7 días; nulo, vencido, inválido o > 30 días → rechazado.
 * El límite exacto (now + 30 días) se acepta.
 */
export function resolveReportAccessTokenExpiry(
  requested: Date | null | undefined,
  nowMs: number,
): ReportAccessTokenExpiryResolution {
  if (requested === undefined) {
    return {
      ok: true,
      expiresAt: new Date(nowMs + REPORT_ACCESS_TOKEN_DEFAULT_TTL_DAYS * DAY_MS),
    };
  }

  if (requested === null) {
    return { ok: false, error: "expiresAt no puede ser nulo" };
  }

  const requestedMs = requested.getTime();

  if (!Number.isFinite(requestedMs)) {
    return { ok: false, error: "expiresAt debe ser una fecha válida" };
  }

  if (requestedMs <= nowMs) {
    return { ok: false, error: "expiresAt debe ser una fecha futura" };
  }

  if (requestedMs > nowMs + REPORT_ACCESS_TOKEN_MAX_TTL_DAYS * DAY_MS) {
    return {
      ok: false,
      error: `expiresAt no puede superar ${REPORT_ACCESS_TOKEN_MAX_TTL_DAYS} días`,
    };
  }

  return { ok: true, expiresAt: new Date(requestedMs) };
}
