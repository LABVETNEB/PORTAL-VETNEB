import { and, eq, sql } from "drizzle-orm";

import { db, pgClient } from "./db";
import {
  clinicPublicProfiles,
  clinicPublicSearch,
  clinics,
  type Clinic,
  type ClinicPublicProfile,
} from "../drizzle/schema";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
export const MIN_PUBLIC_PROFILE_QUALITY_SCORE = 75;

const RECENT_HISTOPATHOLOGY_REPORTS_SQL = `EXISTS (
  SELECT 1
  FROM reports recent_histopathology_reports
  WHERE recent_histopathology_reports.clinic_id = clinic_public_search.clinic_id
    AND immutable_unaccent(COALESCE(recent_histopathology_reports.study_type, '')) ILIKE '%histopat%'
    AND COALESCE(
      recent_histopathology_reports.upload_date,
      recent_histopathology_reports.created_at
    ) >= NOW() - INTERVAL '3 months'
)`;

const RECENT_HISTOPATHOLOGY_REPORT_DRIZZLE_SQL = sql`EXISTS (
  SELECT 1
  FROM reports recent_histopathology_reports
  WHERE recent_histopathology_reports.clinic_id = clinic_public_search.clinic_id
    AND immutable_unaccent(COALESCE(recent_histopathology_reports.study_type, '')) ILIKE '%histopat%'
    AND COALESCE(
      recent_histopathology_reports.upload_date,
      recent_histopathology_reports.created_at
    ) >= NOW() - INTERVAL '3 months'
)`;
export type UpsertClinicPublicProfileInput = {
  displayName?: string | null;
  avatarStoragePath?: string | null;
  aboutText?: string | null;
  specialtyText?: string | null;
  servicesText?: string | null;
  email?: string | null;
  phone?: string | null;
  locality?: string | null;
  country?: string | null;
  isPublic?: boolean;
};

type SearchPublicProfessionalsParams = {
  query?: string;
  locality?: string;
  country?: string;
  limit?: number;
  offset?: number;
};

type PublicProfessionalRow = {
  clinicId: number;
  displayName: string;
  avatarStoragePath: string | null;
  aboutText: string | null;
  specialtyText: string | null;
  servicesText: string | null;
  email: string | null;
  phone: string | null;
  locality: string | null;
  country: string | null;
  isPublic: boolean;
  isSearchEligible: boolean;
  profileQualityScore: number;
  updatedAt: Date;
  rank: number;
  similarity: number;
  score: number;
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

export async function getClinicPublicProfileByClinicId(clinicId: number) {
  const result = await db
    .select({
      clinic: clinics,
      profile: clinicPublicProfiles,
      search: clinicPublicSearch,
    })
    .from(clinics)
    .leftJoin(clinicPublicProfiles, eq(clinicPublicProfiles.clinicId, clinics.id))
    .leftJoin(clinicPublicSearch, eq(clinicPublicSearch.clinicId, clinics.id))
    .where(eq(clinics.id, clinicId))
    .limit(1);

  return result[0];
}

export async function upsertClinicPublicProfile(
  clinicId: number,
  input: UpsertClinicPublicProfileInput,
) {
  const now = new Date();

  const result = await db
    .insert(clinicPublicProfiles)
    .values({
      clinicId,
      displayName: input.displayName ?? null,
      avatarStoragePath: input.avatarStoragePath ?? null,
      aboutText: input.aboutText ?? null,
      specialtyText: input.specialtyText ?? null,
      servicesText: input.servicesText ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      locality: input.locality ?? null,
      country: input.country ?? null,
      isPublic: input.isPublic ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: clinicPublicProfiles.clinicId,
      set: {
        displayName: input.displayName ?? null,
        avatarStoragePath: input.avatarStoragePath ?? null,
        aboutText: input.aboutText ?? null,
        specialtyText: input.specialtyText ?? null,
        servicesText: input.servicesText ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        locality: input.locality ?? null,
        country: input.country ?? null,
        isPublic: input.isPublic ?? false,
        updatedAt: now,
      },
    })
    .returning();

  return result[0];
}

export async function patchClinicPublicProfile(
  clinicId: number,
  input: UpsertClinicPublicProfileInput,
) {
  const existing = await db
    .select()
    .from(clinicPublicProfiles)
    .where(eq(clinicPublicProfiles.clinicId, clinicId))
    .limit(1);

  const current = existing[0];

  return upsertClinicPublicProfile(clinicId, {
    displayName: input.displayName ?? current?.displayName ?? null,
    avatarStoragePath: input.avatarStoragePath ?? current?.avatarStoragePath ?? null,
    aboutText: input.aboutText ?? current?.aboutText ?? null,
    specialtyText: input.specialtyText ?? current?.specialtyText ?? null,
    servicesText: input.servicesText ?? current?.servicesText ?? null,
    email: input.email ?? current?.email ?? null,
    phone: input.phone ?? current?.phone ?? null,
    locality: input.locality ?? current?.locality ?? null,
    country: input.country ?? current?.country ?? null,
    isPublic: input.isPublic ?? current?.isPublic ?? false,
  });
}

export async function syncClinicPublicSearch(clinicId: number) {
  const data = await getClinicPublicProfileByClinicId(clinicId);

  if (!data?.clinic) {
    return null;
  }

  const now = new Date();
  const snapshot = evaluateClinicPublicProfilePublication({
    clinic: data.clinic,
    profile: data.profile,
  });

  const result = await db
    .insert(clinicPublicSearch)
    .values({
      clinicId,
      displayName: snapshot.displayName,
      avatarStoragePath: snapshot.avatarStoragePath,
      aboutText: snapshot.aboutText,
      specialtyText: snapshot.specialtyText,
      servicesText: snapshot.servicesText,
      email: snapshot.email,
      phone: snapshot.phone,
      locality: snapshot.locality,
      country: snapshot.country,
      isPublic: snapshot.isPublic,
      hasRequiredPublicFields: snapshot.hasRequiredPublicFields,
      isSearchEligible: snapshot.isSearchEligible,
      profileQualityScore: snapshot.qualityScore,
      searchText: snapshot.searchText,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: clinicPublicSearch.clinicId,
      set: {
        displayName: snapshot.displayName,
        avatarStoragePath: snapshot.avatarStoragePath,
        aboutText: snapshot.aboutText,
        specialtyText: snapshot.specialtyText,
        servicesText: snapshot.servicesText,
        email: snapshot.email,
        phone: snapshot.phone,
        locality: snapshot.locality,
        country: snapshot.country,
        isPublic: snapshot.isPublic,
        hasRequiredPublicFields: snapshot.hasRequiredPublicFields,
        isSearchEligible: snapshot.isSearchEligible,
        profileQualityScore: snapshot.qualityScore,
        searchText: snapshot.searchText,
        updatedAt: now,
      },
    })
    .returning();

  return result[0];
}

export async function removeClinicPublicAvatar(clinicId: number) {
  const current = await db
    .select({ profile: clinicPublicProfiles })
    .from(clinicPublicProfiles)
    .where(eq(clinicPublicProfiles.clinicId, clinicId))
    .limit(1);

  const existing = current[0]?.profile ?? null;

  if (!existing) {
    return {
      previousAvatarStoragePath: null,
      profile: await upsertClinicPublicProfile(clinicId, {
        avatarStoragePath: null,
      }),
    };
  }

  const result = await db
    .update(clinicPublicProfiles)
    .set({
      avatarStoragePath: null,
      updatedAt: new Date(),
    })
    .where(eq(clinicPublicProfiles.clinicId, clinicId))
    .returning();

  return {
    previousAvatarStoragePath: existing.avatarStoragePath ?? null,
    profile: result[0] ?? existing,
  };
}

export async function getPublicProfessionalByClinicId(clinicId: number) {
  const result = await db
    .select()
    .from(clinicPublicSearch)
    .where(
      and(
        eq(clinicPublicSearch.clinicId, clinicId),
        eq(clinicPublicSearch.isPublic, true),
        eq(clinicPublicSearch.isSearchEligible, true),
        RECENT_HISTOPATHOLOGY_REPORT_DRIZZLE_SQL,
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

function normalizeLimit(limit?: number) {
  if (!Number.isInteger(limit) || !limit || limit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(limit, MAX_LIMIT);
}

function normalizeOffset(offset?: number) {
  if (!Number.isInteger(offset) || !offset || offset < 0) {
    return 0;
  }

  return offset;
}

function buildWeightedVectorSql() {
  return `(
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(display_name, ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(specialty_text, ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(locality, ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(country, ''))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(services_text, ''))), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(COALESCE(about_text, ''))), 'C')
  )`;
}

export async function searchPublicProfessionals(
  params: SearchPublicProfessionalsParams,
) {
  const query = params.query?.trim() || "";
  const locality = params.locality?.trim() || "";
  const country = params.country?.trim() || "";
  const limit = normalizeLimit(params.limit);
  const offset = normalizeOffset(params.offset);

  const values: Array<string | number> = [];
  const conditions = [
    "is_public = true",
    "is_search_eligible = true",
    RECENT_HISTOPATHOLOGY_REPORTS_SQL,
  ];

  let queryIndex: number | null = null;
  let localityIndex: number | null = null;
  let countryIndex: number | null = null;

  if (query) {
    values.push(query);
    queryIndex = values.length;
    conditions.push(`(
      ${buildWeightedVectorSql()} @@ websearch_to_tsquery('simple', immutable_unaccent($${queryIndex}))
      OR immutable_unaccent(search_text) % immutable_unaccent($${queryIndex})
      OR immutable_unaccent(COALESCE(specialty_text, '')) % immutable_unaccent($${queryIndex})
      OR immutable_unaccent(COALESCE(locality, '')) % immutable_unaccent($${queryIndex})
      OR immutable_unaccent(COALESCE(country, '')) % immutable_unaccent($${queryIndex})
      OR immutable_unaccent(search_text) LIKE '%' || immutable_unaccent($${queryIndex}) || '%'
    )`);
  }

  if (locality) {
    values.push(locality);
    localityIndex = values.length;
    conditions.push(`(
      locality IS NOT NULL AND (
        immutable_unaccent(locality) % immutable_unaccent($${localityIndex})
        OR immutable_unaccent(locality) LIKE '%' || immutable_unaccent($${localityIndex}) || '%'
      )
    )`);
  }

  if (country) {
    values.push(country);
    countryIndex = values.length;
    conditions.push(`(
      country IS NOT NULL AND (
        immutable_unaccent(country) % immutable_unaccent($${countryIndex})
        OR immutable_unaccent(country) LIKE '%' || immutable_unaccent($${countryIndex}) || '%'
      )
    )`);
  }

  const whereSql = `WHERE ${conditions.join(" AND ")}`;

  const rankExpression = queryIndex
    ? `ts_rank_cd(
        ARRAY[0.1, 0.2, 0.5, 1.0]::real[],
        ${buildWeightedVectorSql()},
        websearch_to_tsquery('simple', immutable_unaccent($${queryIndex})),
        32
      )`
    : "0::real";

  const similarityExpression = queryIndex
    ? `greatest(
        similarity(immutable_unaccent(COALESCE(specialty_text, '')), immutable_unaccent($${queryIndex})) * 1.45,
        similarity(immutable_unaccent(COALESCE(locality, '')), immutable_unaccent($${queryIndex})) * 1.25,
        similarity(immutable_unaccent(COALESCE(country, '')), immutable_unaccent($${queryIndex})) * 1.15,
        similarity(immutable_unaccent(COALESCE(display_name, '')), immutable_unaccent($${queryIndex})) * 1.0,
        similarity(immutable_unaccent(COALESCE(services_text, '')), immutable_unaccent($${queryIndex})) * 0.85,
        similarity(immutable_unaccent(COALESCE(about_text, '')), immutable_unaccent($${queryIndex})) * 0.45
      )`
    : "0::real";

  const localityBoost = localityIndex
    ? `CASE
        WHEN immutable_unaccent(COALESCE(locality, '')) = immutable_unaccent($${localityIndex}) THEN 0.25
        WHEN immutable_unaccent(COALESCE(locality, '')) LIKE '%' || immutable_unaccent($${localityIndex}) || '%' THEN 0.12
        ELSE 0
      END`
    : "0::real";

  const countryBoost = countryIndex
    ? `CASE
        WHEN immutable_unaccent(COALESCE(country, '')) = immutable_unaccent($${countryIndex}) THEN 0.18
        WHEN immutable_unaccent(COALESCE(country, '')) LIKE '%' || immutable_unaccent($${countryIndex}) || '%' THEN 0.08
        ELSE 0
      END`
    : "0::real";

  const scoreExpression = queryIndex
    ? `(
        (${rankExpression} * 100.0) +
        (${similarityExpression} * 25.0) +
        (${localityBoost} * 100.0) +
        (${countryBoost} * 100.0) +
        (profile_quality_score * 0.4)
      )`
    : `(
        (${localityBoost} * 100.0) +
        (${countryBoost} * 100.0) +
        (profile_quality_score * 1.0)
      )`;

  const rows = await pgClient.unsafe<PublicProfessionalRow[]>(
    `
      SELECT
        clinic_id AS "clinicId",
        display_name AS "displayName",
        avatar_storage_path AS "avatarStoragePath",
        about_text AS "aboutText",
        specialty_text AS "specialtyText",
        services_text AS "servicesText",
        email,
        phone,
        locality,
        country,
        is_public AS "isPublic",
        is_search_eligible AS "isSearchEligible",
        profile_quality_score AS "profileQualityScore",
        updated_at AS "updatedAt",
        ${rankExpression} AS rank,
        ${similarityExpression} AS similarity,
        ${scoreExpression} AS score
      FROM clinic_public_search
      ${whereSql}
      ORDER BY
        score DESC,
        rank DESC,
        similarity DESC,
        profile_quality_score DESC,
        updated_at DESC,
        clinic_id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `,
    [...values, limit, offset],
  );

  const countRows = await pgClient.unsafe<Array<{ total: string | number }>>(
    `
      SELECT count(*)::int AS total
      FROM clinic_public_search
      ${whereSql}
    `,
    values,
  );

  return {
    rows,
    total: Number(countRows[0]?.total ?? 0),
    limit,
    offset,
  };
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
