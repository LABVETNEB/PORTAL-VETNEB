export function hasLinkedParticularReport(
  reportId: number | null | undefined,
): boolean {
  return typeof reportId === "number";
}

export function belongsToClinic(
  resourceClinicId: number,
  clinicId: number,
): boolean {
  return resourceClinicId === clinicId;
}

export function getParticularTokenLast4(rawToken: string): string {
  return rawToken.slice(-4);
}
