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
