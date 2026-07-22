import type {
  Clinic,
  ClinicPublicProfile,
} from "../../../../drizzle/schema.ts";

export const MIN_PUBLIC_PROFILE_QUALITY_SCORE = 75;

export type UpsertClinicPublicProfileInput = {
  displayName?: string | null;
  avatarStoragePath?: string | null;
  aboutText?: string | null;
  specialtyText?: string | null;
  servicesText?: string | null;
  email?: string | null;
  phone?: string | null;
  publicAddress?: string | null;
  mapLink?: string | null;
  locality?: string | null;
  country?: string | null;
  isPublic?: boolean;
};

type ClinicLike = Pick<Clinic, "id" | "name" | "contactEmail" | "contactPhone">;

type ProfilePublicationSnapshot = {
  displayName: string;
  avatarStoragePath: string | null;
  aboutText: string | null;
  specialtyText: string | null;
  servicesText: string | null;
  email: string | null;
  phone: string | null;
  publicAddress: string | null;
  mapLink: string | null;
  locality: string | null;
  country: string | null;
  isPublic: boolean;
  searchText: string;
  hasRequiredPublicFields: boolean;
  hasQualitySupplement: boolean;
  qualityScore: number;
  isSearchEligible: boolean;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
  publicationErrors: string[];
};

function normalizeSearchTextPart(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = normalizeSearchTextPart(value);
  return normalized || null;
}

function buildSearchText(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => normalizeSearchTextPart(part))
    .filter(Boolean)
    .join(" ");
}

function getMeaningfulLength(value: string | null | undefined) {
  return normalizeSearchTextPart(value).length;
}

function hasMeaningfulText(value: string | null | undefined, minLength = 1) {
  return getMeaningfulLength(value) >= minLength;
}

function getDisplayName(clinic: ClinicLike, profile?: ClinicPublicProfile | null) {
  return normalizeSearchTextPart(profile?.displayName || clinic.name) || clinic.name;
}

export function evaluateClinicPublicProfilePublication(params: {
  clinic: ClinicLike;
  profile?: Partial<UpsertClinicPublicProfileInput> | ClinicPublicProfile | null;
}) {
  const { clinic, profile } = params;

  const displayName = getDisplayName(clinic, profile as ClinicPublicProfile | null);
  const avatarStoragePath = normalizeNullableText(profile?.avatarStoragePath ?? null);
  const aboutText = normalizeNullableText(profile?.aboutText ?? null);
  const specialtyText = normalizeNullableText(profile?.specialtyText ?? null);
  const servicesText = normalizeNullableText(profile?.servicesText ?? null);
  const email = normalizeNullableText(profile?.email ?? clinic.contactEmail ?? null);
  const phone = normalizeNullableText(profile?.phone ?? clinic.contactPhone ?? null);
  const publicAddress = normalizeNullableText(profile?.publicAddress ?? null);
  const mapLink = normalizeNullableText(profile?.mapLink ?? null);
  const locality = normalizeNullableText(profile?.locality ?? null);
  const country = normalizeNullableText(profile?.country ?? null);
  const isPublic = Boolean(profile?.isPublic ?? false);

  const missingRequiredFields: string[] = [];

  if (!hasMeaningfulText(displayName, 2)) {
    missingRequiredFields.push("displayName");
  }

  if (!hasMeaningfulText(specialtyText, 3)) {
    missingRequiredFields.push("specialtyText");
  }

  if (!hasMeaningfulText(locality, 2)) {
    missingRequiredFields.push("locality");
  }

  if (!hasMeaningfulText(country, 2)) {
    missingRequiredFields.push("country");
  }

  const hasRequiredPublicFields = missingRequiredFields.length === 0;
  const hasQualitySupplement =
    Boolean(avatarStoragePath) ||
    hasMeaningfulText(aboutText, 40) ||
    hasMeaningfulText(servicesText, 20) ||
    hasMeaningfulText(email, 5) ||
    hasMeaningfulText(phone, 5);

  const missingRecommendedFields: string[] = [];

  if (!avatarStoragePath) {
    missingRecommendedFields.push("avatar");
  }

  if (!hasMeaningfulText(aboutText, 40)) {
    missingRecommendedFields.push("aboutText");
  }

  if (!hasMeaningfulText(servicesText, 20)) {
    missingRecommendedFields.push("servicesText");
  }

  if (!hasMeaningfulText(email, 5)) {
    missingRecommendedFields.push("email");
  }

  if (!hasMeaningfulText(phone, 5)) {
    missingRecommendedFields.push("phone");
  }

  let qualityScore = 0;

  if (hasMeaningfulText(displayName, 2)) {
    qualityScore += 15;
  }

  if (hasMeaningfulText(specialtyText, 12)) {
    qualityScore += 25;
  } else if (hasMeaningfulText(specialtyText, 3)) {
    qualityScore += 18;
  }

  if (hasMeaningfulText(locality, 2)) {
    qualityScore += 15;
  }

  if (hasMeaningfulText(country, 2)) {
    qualityScore += 15;
  }

  if (hasMeaningfulText(aboutText, 120)) {
    qualityScore += 12;
  } else if (hasMeaningfulText(aboutText, 40)) {
    qualityScore += 8;
  }

  if (hasMeaningfulText(servicesText, 60)) {
    qualityScore += 12;
  } else if (hasMeaningfulText(servicesText, 20)) {
    qualityScore += 8;
  }

  if (hasMeaningfulText(email, 5)) {
    qualityScore += 5;
  }

  if (hasMeaningfulText(phone, 5)) {
    qualityScore += 5;
  }

  if (avatarStoragePath) {
    qualityScore += 5;
  }

  const publicationErrors: string[] = [];

  if (!hasRequiredPublicFields) {
    publicationErrors.push(
      "Para publicar el perfil completá nombre visible, especialidad, localidad y país.",
    );
  }

  if (hasRequiredPublicFields && !hasQualitySupplement) {
    publicationErrors.push(
      "Para publicar el perfil agregá al menos uno de estos campos: avatar, descripción, servicios, email o teléfono.",
    );
  }

  if (
    hasRequiredPublicFields &&
    hasQualitySupplement &&
    qualityScore < MIN_PUBLIC_PROFILE_QUALITY_SCORE
  ) {
    publicationErrors.push(
      `El perfil todavía no alcanza la calidad mínima para publicarse. Puntaje actual: ${qualityScore}/${MIN_PUBLIC_PROFILE_QUALITY_SCORE}.`,
    );
  }

  const isSearchEligible =
    isPublic &&
    hasRequiredPublicFields &&
    hasQualitySupplement &&
    qualityScore >= MIN_PUBLIC_PROFILE_QUALITY_SCORE;

  const searchText = buildSearchText([
    displayName,
    specialtyText,
    servicesText,
    locality,
    country,
    email,
    phone,
    publicAddress,
    aboutText,
  ]);

  return {
    displayName,
    avatarStoragePath,
    aboutText,
    specialtyText,
    servicesText,
    email,
    phone,
    publicAddress,
    mapLink,
    locality,
    country,
    isPublic,
    searchText,
    hasRequiredPublicFields,
    hasQualitySupplement,
    qualityScore,
    isSearchEligible,
    missingRequiredFields,
    missingRecommendedFields,
    publicationErrors,
  } satisfies ProfilePublicationSnapshot;
}

export function buildClinicPublicProfileResponse(params: {
  clinic: ClinicLike;
  profile?: ClinicPublicProfile | null;
  avatarUrl?: string | null;
}) {
  const { clinic, profile, avatarUrl = null } = params;
  const publication = evaluateClinicPublicProfilePublication({
    clinic,
    profile,
  });

  return {
    clinicId: clinic.id,
    clinicName: clinic.name,
    displayName: publication.displayName,
    avatarUrl,
    avatarStoragePath: publication.avatarStoragePath,
    aboutText: publication.aboutText,
    specialtyText: publication.specialtyText,
    servicesText: publication.servicesText,
    email: publication.email,
    phone: publication.phone,
    publicAddress: publication.publicAddress,
    mapLink: publication.mapLink,
    locality: publication.locality,
    country: publication.country,
    isPublic: publication.isPublic,
    createdAt: profile?.createdAt ?? null,
    updatedAt: profile?.updatedAt ?? null,
    publication: {
      hasRequiredPublicFields: publication.hasRequiredPublicFields,
      hasQualitySupplement: publication.hasQualitySupplement,
      qualityScore: publication.qualityScore,
      minimumQualityScore: MIN_PUBLIC_PROFILE_QUALITY_SCORE,
      isSearchEligible: publication.isSearchEligible,
      missingRequiredFields: publication.missingRequiredFields,
      missingRecommendedFields: publication.missingRecommendedFields,
      publicationErrors: publication.publicationErrors,
    },
  };
}
