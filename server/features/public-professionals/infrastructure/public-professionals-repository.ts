import { and, eq, sql } from "drizzle-orm";

import { db, pgClient } from "../../../db.ts";
import {
  clinicPublicProfiles,
  clinicPublicSearch,
  clinics,
} from "../../../../drizzle/schema.ts";
import {
  HISTOPATHOLOGY_REPORT_STUDY_TYPE,
  PROFESSIONAL_BANK_ELIGIBILITY_MONTHS,
} from "../domain/index.ts";
import {
  evaluateClinicPublicProfilePublication,
  type UpsertClinicPublicProfileInput,
} from "./public-professionals-mapping.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const LAST_HISTOPATHOLOGY_REPORT_DELIVERED_AT_SQL = `(
  SELECT MAX(professional_bank_delivery_events.delivered_at)
  FROM (
    SELECT report_delivery_history.created_at AS delivered_at
    FROM report_status_history report_delivery_history
    INNER JOIN reports professional_bank_reports
      ON professional_bank_reports.id = report_delivery_history.report_id
    WHERE professional_bank_reports.clinic_id = clinic_public_search.clinic_id
      AND professional_bank_reports.study_type = '${HISTOPATHOLOGY_REPORT_STUDY_TYPE}'
      AND report_delivery_history.changed_by_admin_user_id IS NOT NULL
      AND report_delivery_history.to_status IN ('uploaded', 'delivered')
    UNION ALL
    SELECT professional_bank_reports.status_changed_at AS delivered_at
    FROM reports professional_bank_reports
    WHERE professional_bank_reports.clinic_id = clinic_public_search.clinic_id
      AND professional_bank_reports.study_type = '${HISTOPATHOLOGY_REPORT_STUDY_TYPE}'
      AND professional_bank_reports.status_changed_by_admin_user_id IS NOT NULL
      AND professional_bank_reports.current_status IN ('uploaded', 'delivered')
  ) professional_bank_delivery_events
)`;

const PROFESSIONAL_BANK_ELIGIBILITY_SQL = `${LAST_HISTOPATHOLOGY_REPORT_DELIVERED_AT_SQL} >= NOW() - INTERVAL '${PROFESSIONAL_BANK_ELIGIBILITY_MONTHS} months'`;
const PROFESSIONAL_BANK_ELIGIBILITY_DRIZZLE_SQL = sql.raw(
  PROFESSIONAL_BANK_ELIGIBILITY_SQL,
);

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
  publicAddress: string | null;
  mapLink: string | null;
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
      publicAddress: input.publicAddress ?? null,
      mapLink: input.mapLink ?? null,
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
        publicAddress: input.publicAddress ?? null,
        mapLink: input.mapLink ?? null,
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
    publicAddress: input.publicAddress ?? current?.publicAddress ?? null,
    mapLink: input.mapLink ?? current?.mapLink ?? null,
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
      publicAddress: snapshot.publicAddress,
      mapLink: snapshot.mapLink,
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
        publicAddress: snapshot.publicAddress,
        mapLink: snapshot.mapLink,
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
        PROFESSIONAL_BANK_ELIGIBILITY_DRIZZLE_SQL,
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
    PROFESSIONAL_BANK_ELIGIBILITY_SQL,
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
        public_address AS "publicAddress",
        map_link AS "mapLink",
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
