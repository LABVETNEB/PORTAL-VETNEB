const PUBLIC_PROFESSIONALS_BASE_ROUTE = "/profesionales";
const PROFESSIONAL_SUMMARY_MAX_LENGTH = 170;

export const PUBLIC_PROFESSIONALS_PAGE_SIZE = 20;

export type PublicProfessionalDirectoryEntry = {
  clinicId: number;
  specialtyText: string | null;
  servicesText: string | null;
  locality: string | null;
  country: string | null;
  profileQualityScore: number | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function truncateSummary(value: string, maxLength = PROFESSIONAL_SUMMARY_MAX_LENGTH) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

export function buildProfessionalDetailHref(clinicId: number | string) {
  return `${PUBLIC_PROFESSIONALS_BASE_ROUTE}/${encodeURIComponent(String(clinicId))}`;
}

export function summarizePublicProfessional(
  professional: Pick<PublicProfessionalDirectoryEntry, "specialtyText" | "servicesText">,
) {
  const summary = [
    normalizeOptionalText(professional.specialtyText),
    normalizeOptionalText(professional.servicesText),
  ]
    .filter(Boolean)
    .join(" - ");

  return summary ? truncateSummary(summary) : null;
}

export function getPublicProfessionalLocation(
  professional: Pick<PublicProfessionalDirectoryEntry, "locality" | "country">,
) {
  const location = [
    normalizeOptionalText(professional.locality),
    normalizeOptionalText(professional.country),
  ]
    .filter(Boolean)
    .join(", ");

  return location || null;
}

export function isVerifiedPublicProfessional(
  professional: Pick<PublicProfessionalDirectoryEntry, "profileQualityScore">,
) {
  return typeof professional.profileQualityScore === "number";
}

export function parsePublicProfessionalClinicId(value: string) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
