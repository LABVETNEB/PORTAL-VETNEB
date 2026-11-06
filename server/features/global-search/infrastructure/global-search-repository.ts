import { and, desc, eq, gte, lte, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "../../../db.ts";
import {
  clinics,
  clinicUsers,
  particularTokens,
  reports,
  studyTrackingCases,
} from "../../../../drizzle/schema.ts";
import type {
  AdminGlobalSearchRepository,
  ClinicGlobalSearchRepository,
} from "../application/global-search-use-cases.ts";
import type {
  GlobalSearchAfter,
  GlobalSearchCriteria,
  GlobalSearchFact,
  GlobalSearchHit,
  GlobalSearchNeedle,
} from "../domain/index.ts";

type GlobalSearchDatabase = typeof db;

/**
 * Accent- and case-insensitive containment. `immutable_unaccent` is created
 * by migration 0007; the pattern is a bound parameter already escaped by the
 * domain, and `ESCAPE '\'` makes `%`/`_` typed by the user literal.
 */
function folded(column: AnyPgColumn): SQL {
  return sql`immutable_unaccent(coalesce(${column}::text, ''))`;
}

function likeFolded(column: AnyPgColumn, pattern: string): SQL {
  return sql`${folded(column)} ILIKE immutable_unaccent(${pattern}) ESCAPE '\\'`;
}

function matchAny(
  idColumn: AnyPgColumn,
  textColumns: readonly AnyPgColumn[],
  needle: GlobalSearchNeedle,
): SQL {
  const clauses = textColumns.map((column) => likeFolded(column, needle.containsPattern));

  if (needle.numericId !== null) {
    clauses.unshift(eq(idColumn, needle.numericId));
  }

  return or(...clauses)!;
}

function rankExpression(
  idColumn: AnyPgColumn,
  titleColumn: AnyPgColumn,
  needle: GlobalSearchNeedle,
): SQL<number> {
  const idClause =
    needle.numericId !== null
      ? sql`WHEN ${idColumn} = ${needle.numericId} THEN 0 `
      : sql``;

  return sql<number>`(CASE ${idClause}WHEN ${likeFolded(titleColumn, needle.exactPattern)} THEN 1 WHEN ${likeFolded(titleColumn, needle.prefixPattern)} THEN 2 ELSE 3 END)`.mapWith(
    Number,
  );
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function facts(entries: ReadonlyArray<[string, string | null | undefined]>): GlobalSearchFact[] {
  return entries
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "")
    .map(([label, value]) => ({ label, value }));
}

function emptyTarget() {
  return {
    reportId: null,
    particularTokenId: null,
    studyTrackingCaseId: null,
    clinicId: null,
    clinicUserId: null,
  };
}

function clinicRef(id: number | null | undefined, name: string | null | undefined) {
  return typeof id === "number" && typeof name === "string" ? { id, name } : null;
}

function pageWindow(criteria: GlobalSearchCriteria) {
  // A keyset page starts after its cursor; `offset` is the legacy window.
  return { limit: criteria.limit + 1, offset: criteria.after ? 0 : criteria.offset };
}

/**
 * Exact text of an entity's sort timestamp. PostgreSQL keeps microseconds and
 * a JavaScript Date only milliseconds, so the cursor carries the database's own
 * value and compares it back as `timestamp` — two rows in the same millisecond
 * can never be merged or swapped by a rounding. `to_char` with an explicit ISO
 * pattern (six fractional digits) does not depend on the session `DateStyle`,
 * which `::text` would, and ISO input is read back identically under any style.
 */
function sortKeyOf(column: AnyPgColumn): SQL<string> {
  return sql<string>`to_char(${column}, 'YYYY-MM-DD HH24:MI:SS.US')`;
}

/**
 * Rows strictly after the cursor in the order `rank` ASC, sort column DESC,
 * `id` DESC. Every sort column is `timestamp NOT NULL`, so no NULL ordering
 * applies. Every value is a bound parameter.
 */
function afterPosition(
  rank: SQL<number>,
  sortColumn: AnyPgColumn,
  idColumn: AnyPgColumn,
  after: GlobalSearchAfter,
): SQL {
  return sql`(${rank} > ${after.rank} OR (${rank} = ${after.rank} AND (${sortColumn}, ${idColumn}) < (${after.sortKey}::timestamp, ${after.id})))`;
}

// ── Reports ────────────────────────────────────────────────────────────────

const REPORT_TEXT_COLUMNS = [reports.patientName, reports.fileName, reports.studyType] as const;

function reportFilters(criteria: GlobalSearchCriteria, clinicId: number | null): SQL[] {
  const filters: SQL[] = [matchAny(reports.id, REPORT_TEXT_COLUMNS, criteria.needle)];

  if (clinicId !== null) filters.unshift(eq(reports.clinicId, clinicId));
  if (criteria.reportStatus) filters.push(eq(reports.currentStatus, criteria.reportStatus));
  if (criteria.studyType) filters.push(eq(reports.studyType, criteria.studyType));
  if (criteria.createdFrom) filters.push(gte(reports.createdAt, criteria.createdFrom));
  if (criteria.createdTo) filters.push(lte(reports.createdAt, criteria.createdTo));

  return filters;
}

export function buildReportSearchQuery(
  database: GlobalSearchDatabase,
  criteria: GlobalSearchCriteria,
  clinicId: number | null,
) {
  const rank = rankExpression(reports.id, reports.patientName, criteria.needle);
  const page = pageWindow(criteria);
  const filters = reportFilters(criteria, clinicId);

  if (criteria.after) filters.push(afterPosition(rank, reports.createdAt, reports.id, criteria.after));

  return database
    .select({
      id: reports.id,
      clinicId: reports.clinicId,
      clinicName: clinics.name,
      patientName: reports.patientName,
      fileName: reports.fileName,
      studyType: reports.studyType,
      currentStatus: reports.currentStatus,
      uploadDate: reports.uploadDate,
      createdAt: reports.createdAt,
      sortKey: sortKeyOf(reports.createdAt),
      rank,
    })
    .from(reports)
    .innerJoin(clinics, eq(clinics.id, reports.clinicId))
    .where(and(...filters))
    .orderBy(rank, desc(reports.createdAt), desc(reports.id))
    .limit(page.limit)
    .offset(page.offset);
}

type ReportRow = Awaited<ReturnType<typeof buildReportSearchQuery>>[number];

function mapReport(row: ReportRow, withClinic: boolean): GlobalSearchHit {
  return {
    kind: "report",
    id: row.id,
    title: row.patientName?.trim() || row.fileName?.trim() || `Informe #${row.id}`,
    subtitle: row.fileName ?? null,
    status: row.currentStatus,
    date: iso(row.uploadDate ?? row.createdAt),
    facts: facts([["studyType", row.studyType]]),
    clinic: withClinic ? clinicRef(row.clinicId, row.clinicName) : null,
    target: { ...emptyTarget(), reportId: row.id, clinicId: row.clinicId },
    rank: row.rank,
  };
}

// ── Particular tokens ──────────────────────────────────────────────────────

const TOKEN_TEXT_COLUMNS = [
  particularTokens.petName,
  particularTokens.tutorLastName,
  particularTokens.tokenLast4,
] as const;

export function buildParticularTokenSearchQuery(
  database: GlobalSearchDatabase,
  criteria: GlobalSearchCriteria,
  clinicId: number | null,
) {
  const rank = rankExpression(particularTokens.id, particularTokens.petName, criteria.needle);
  const page = pageWindow(criteria);
  const filters: SQL[] = [matchAny(particularTokens.id, TOKEN_TEXT_COLUMNS, criteria.needle)];

  if (clinicId !== null) filters.unshift(eq(particularTokens.clinicId, clinicId));
  if (criteria.after) {
    filters.push(afterPosition(rank, particularTokens.createdAt, particularTokens.id, criteria.after));
  }

  return database
    .select({
      id: particularTokens.id,
      clinicId: particularTokens.clinicId,
      clinicName: clinics.name,
      reportId: particularTokens.reportId,
      petName: particularTokens.petName,
      petSpecies: particularTokens.petSpecies,
      tutorLastName: particularTokens.tutorLastName,
      tokenLast4: particularTokens.tokenLast4,
      isActive: particularTokens.isActive,
      createdAt: particularTokens.createdAt,
      sortKey: sortKeyOf(particularTokens.createdAt),
      rank,
    })
    .from(particularTokens)
    .innerJoin(clinics, eq(clinics.id, particularTokens.clinicId))
    .where(and(...filters))
    .orderBy(rank, desc(particularTokens.createdAt), desc(particularTokens.id))
    .limit(page.limit)
    .offset(page.offset);
}

type TokenRow = Awaited<ReturnType<typeof buildParticularTokenSearchQuery>>[number];

function mapToken(row: TokenRow, withClinic: boolean): GlobalSearchHit {
  return {
    kind: "particular_token",
    id: row.id,
    title: row.petName,
    subtitle: row.tutorLastName,
    status: row.isActive ? "active" : "inactive",
    date: iso(row.createdAt),
    facts: facts([
      ["species", row.petSpecies],
      ["tokenLast4", row.tokenLast4],
    ]),
    clinic: withClinic ? clinicRef(row.clinicId, row.clinicName) : null,
    target: {
      ...emptyTarget(),
      particularTokenId: row.id,
      reportId: row.reportId ?? null,
      clinicId: row.clinicId,
    },
    rank: row.rank,
  };
}

// ── Study tracking cases ───────────────────────────────────────────────────

export function buildTrackingCaseSearchQuery(
  database: GlobalSearchDatabase,
  criteria: GlobalSearchCriteria,
  clinicId: number | null,
) {
  const page = pageWindow(criteria);
  // Joined rows must belong to the case's own clinic, so a dangling foreign
  // key can never surface another tenant's patient or pet name.
  const reportJoin = and(
    eq(reports.id, studyTrackingCases.reportId),
    eq(reports.clinicId, studyTrackingCases.clinicId),
  );
  const tokenJoin = and(
    eq(particularTokens.id, studyTrackingCases.particularTokenId),
    eq(particularTokens.clinicId, studyTrackingCases.clinicId),
  );
  const filters: SQL[] = [
    matchAny(
      studyTrackingCases.id,
      [reports.patientName, particularTokens.petName, particularTokens.tutorLastName],
      criteria.needle,
    ),
  ];

  if (clinicId !== null) filters.unshift(eq(studyTrackingCases.clinicId, clinicId));

  const rank = rankExpression(studyTrackingCases.id, reports.patientName, criteria.needle);

  if (criteria.after) {
    filters.push(afterPosition(rank, studyTrackingCases.receptionAt, studyTrackingCases.id, criteria.after));
  }

  return database
    .select({
      id: studyTrackingCases.id,
      clinicId: studyTrackingCases.clinicId,
      clinicName: clinics.name,
      reportId: studyTrackingCases.reportId,
      particularTokenId: studyTrackingCases.particularTokenId,
      currentStage: studyTrackingCases.currentStage,
      receptionAt: studyTrackingCases.receptionAt,
      estimatedDeliveryAt: studyTrackingCases.estimatedDeliveryAt,
      patientName: reports.patientName,
      petName: particularTokens.petName,
      sortKey: sortKeyOf(studyTrackingCases.receptionAt),
      rank,
    })
    .from(studyTrackingCases)
    .innerJoin(clinics, eq(clinics.id, studyTrackingCases.clinicId))
    .leftJoin(reports, reportJoin)
    .leftJoin(particularTokens, tokenJoin)
    .where(and(...filters))
    .orderBy(rank, desc(studyTrackingCases.receptionAt), desc(studyTrackingCases.id))
    .limit(page.limit)
    .offset(page.offset);
}

type TrackingRow = Awaited<ReturnType<typeof buildTrackingCaseSearchQuery>>[number];

function mapTracking(row: TrackingRow, withClinic: boolean): GlobalSearchHit {
  return {
    kind: "tracking_case",
    id: row.id,
    title: row.patientName?.trim() || row.petName?.trim() || `Seguimiento #${row.id}`,
    subtitle: `Seguimiento #${row.id}`,
    status: row.currentStage,
    date: iso(row.receptionAt),
    facts: facts([["estimatedDeliveryAt", iso(row.estimatedDeliveryAt)]]),
    clinic: withClinic ? clinicRef(row.clinicId, row.clinicName) : null,
    target: {
      ...emptyTarget(),
      studyTrackingCaseId: row.id,
      reportId: row.reportId ?? null,
      particularTokenId: row.particularTokenId ?? null,
      clinicId: row.clinicId,
    },
    rank: row.rank,
  };
}

// ── Admin-only entities ────────────────────────────────────────────────────

export function buildClinicSearchQuery(
  database: GlobalSearchDatabase,
  criteria: GlobalSearchCriteria,
  clinicId: number | null,
) {
  const rank = rankExpression(clinics.id, clinics.name, criteria.needle);
  const page = pageWindow(criteria);
  const filters: SQL[] = [matchAny(clinics.id, [clinics.name, clinics.contactEmail], criteria.needle)];

  if (clinicId !== null) filters.unshift(eq(clinics.id, clinicId));
  if (criteria.after) filters.push(afterPosition(rank, clinics.updatedAt, clinics.id, criteria.after));

  return database
    .select({
      id: clinics.id,
      name: clinics.name,
      contactEmail: clinics.contactEmail,
      updatedAt: clinics.updatedAt,
      sortKey: sortKeyOf(clinics.updatedAt),
      rank,
    })
    .from(clinics)
    .where(and(...filters))
    .orderBy(rank, desc(clinics.updatedAt), desc(clinics.id))
    .limit(page.limit)
    .offset(page.offset);
}

type ClinicRow = Awaited<ReturnType<typeof buildClinicSearchQuery>>[number];

function mapClinic(row: ClinicRow): GlobalSearchHit {
  return {
    kind: "clinic",
    id: row.id,
    title: row.name,
    subtitle: row.contactEmail ?? null,
    status: null,
    date: iso(row.updatedAt),
    facts: [],
    clinic: { id: row.id, name: row.name },
    target: { ...emptyTarget(), clinicId: row.id },
    rank: row.rank,
  };
}

export function buildClinicUserSearchQuery(
  database: GlobalSearchDatabase,
  criteria: GlobalSearchCriteria,
  clinicId: number | null,
) {
  const rank = rankExpression(clinicUsers.id, clinicUsers.username, criteria.needle);
  const page = pageWindow(criteria);
  const filters: SQL[] = [matchAny(clinicUsers.id, [clinicUsers.username], criteria.needle)];

  if (clinicId !== null) filters.unshift(eq(clinicUsers.clinicId, clinicId));
  if (criteria.after) {
    filters.push(afterPosition(rank, clinicUsers.updatedAt, clinicUsers.id, criteria.after));
  }

  // Explicit projection: password hash and external auth id are never read.
  return database
    .select({
      id: clinicUsers.id,
      clinicId: clinicUsers.clinicId,
      clinicName: clinics.name,
      username: clinicUsers.username,
      role: clinicUsers.role,
      updatedAt: clinicUsers.updatedAt,
      sortKey: sortKeyOf(clinicUsers.updatedAt),
      rank,
    })
    .from(clinicUsers)
    .innerJoin(clinics, eq(clinics.id, clinicUsers.clinicId))
    .where(and(...filters))
    .orderBy(rank, desc(clinicUsers.updatedAt), desc(clinicUsers.id))
    .limit(page.limit)
    .offset(page.offset);
}

type ClinicUserRow = Awaited<ReturnType<typeof buildClinicUserSearchQuery>>[number];

function mapClinicUser(row: ClinicUserRow): GlobalSearchHit {
  return {
    kind: "clinic_user",
    id: row.id,
    title: row.username,
    subtitle: row.clinicName,
    status: row.role,
    date: iso(row.updatedAt),
    facts: [],
    clinic: clinicRef(row.clinicId, row.clinicName),
    target: { ...emptyTarget(), clinicUserId: row.id, clinicId: row.clinicId },
    rank: row.rank,
  };
}

// ── Repositories ───────────────────────────────────────────────────────────

export function createClinicGlobalSearchRepository(dependencies?: {
  database?: GlobalSearchDatabase;
}): ClinicGlobalSearchRepository {
  const database = dependencies?.database ?? db;

  return {
    async report(clinicId, criteria) {
      const rows = await buildReportSearchQuery(database, criteria, clinicId);
      return rows.map((row) => ({ hit: mapReport(row, false), sortKey: row.sortKey }));
    },
    async particular_token(clinicId, criteria) {
      const rows = await buildParticularTokenSearchQuery(database, criteria, clinicId);
      return rows.map((row) => ({ hit: mapToken(row, false), sortKey: row.sortKey }));
    },
    async tracking_case(clinicId, criteria) {
      const rows = await buildTrackingCaseSearchQuery(database, criteria, clinicId);
      return rows.map((row) => ({ hit: mapTracking(row, false), sortKey: row.sortKey }));
    },
  };
}

export function createAdminGlobalSearchRepository(dependencies?: {
  database?: GlobalSearchDatabase;
}): AdminGlobalSearchRepository {
  const database = dependencies?.database ?? db;

  return {
    async clinic(criteria, clinicId) {
      const rows = await buildClinicSearchQuery(database, criteria, clinicId);
      return rows.map((row) => ({ hit: mapClinic(row), sortKey: row.sortKey }));
    },
    async report(criteria, clinicId) {
      const rows = await buildReportSearchQuery(database, criteria, clinicId);
      return rows.map((row) => ({ hit: mapReport(row, true), sortKey: row.sortKey }));
    },
    async particular_token(criteria, clinicId) {
      const rows = await buildParticularTokenSearchQuery(database, criteria, clinicId);
      return rows.map((row) => ({ hit: mapToken(row, true), sortKey: row.sortKey }));
    },
    async tracking_case(criteria, clinicId) {
      const rows = await buildTrackingCaseSearchQuery(database, criteria, clinicId);
      return rows.map((row) => ({ hit: mapTracking(row, true), sortKey: row.sortKey }));
    },
    async clinic_user(criteria, clinicId) {
      const rows = await buildClinicUserSearchQuery(database, criteria, clinicId);
      return rows.map((row) => ({ hit: mapClinicUser(row), sortKey: row.sortKey }));
    },
  };
}
