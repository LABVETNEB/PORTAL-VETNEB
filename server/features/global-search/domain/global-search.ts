import type { ReportStatus } from "../../../../drizzle/schema.ts";

export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
export const GLOBAL_SEARCH_MAX_QUERY_LENGTH = 80;
export const GLOBAL_SEARCH_DEFAULT_LIMIT = 5;
export const GLOBAL_SEARCH_MAX_LIMIT = 25;
export const GLOBAL_SEARCH_MAX_OFFSET = 500;

export const CLINIC_GLOBAL_SEARCH_KINDS = [
  "report",
  "particular_token",
  "tracking_case",
] as const;

export const ADMIN_GLOBAL_SEARCH_KINDS = [
  "clinic",
  "report",
  "particular_token",
  "tracking_case",
  "clinic_user",
] as const;

export type ClinicGlobalSearchKind = (typeof CLINIC_GLOBAL_SEARCH_KINDS)[number];
export type AdminGlobalSearchKind = (typeof ADMIN_GLOBAL_SEARCH_KINDS)[number];
export type GlobalSearchKind = AdminGlobalSearchKind;

/** Kinds whose rows carry report status / study type / report dates. */
const REPORT_SCOPED_FILTER_KINDS: ReadonlySet<GlobalSearchKind> = new Set(["report"]);

const REPORT_STATUS_VALUES: ReadonlySet<string> = new Set<ReportStatus>([
  "uploaded",
  "processing",
  "ready",
  "delivered",
]);

const STUDY_TYPE_PATTERN = /^[a-z]{3,40}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC_ID_PATTERN = /^#?(\d{1,9})$/;

function replaceControlCharacters(value: string): string {
  let result = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    result += code < 0x20 || code === 0x7f ? " " : character;
  }
  return result;
}

/**
 * The normalized needle. `pattern` is a LIKE pattern with `\`, `%` and `_`
 * escaped, so user text can never widen the match; it is always bound as a
 * SQL parameter, never interpolated.
 */
export type GlobalSearchNeedle = {
  readonly text: string;
  readonly containsPattern: string;
  readonly prefixPattern: string;
  readonly exactPattern: string;
  readonly numericId: number | null;
};

export type GlobalSearchCriteria = {
  readonly needle: GlobalSearchNeedle;
  readonly limit: number;
  readonly offset: number;
  readonly reportStatus: ReportStatus | null;
  readonly studyType: string | null;
  readonly createdFrom: Date | null;
  readonly createdTo: Date | null;
};

export type GlobalSearchFact = {
  readonly label: string;
  readonly value: string;
};

/**
 * Normalized heterogeneous hit. Only fields already exposed by the existing
 * read surface of the same actor are allowed here; never hashes, storage
 * paths, signed URLs, credentials or free-text clinical notes.
 */
export type GlobalSearchHit = {
  readonly kind: GlobalSearchKind;
  readonly id: number;
  readonly title: string;
  readonly subtitle: string | null;
  readonly status: string | null;
  readonly date: string | null;
  readonly facts: readonly GlobalSearchFact[];
  readonly clinic: { readonly id: number; readonly name: string } | null;
  readonly target: {
    readonly reportId: number | null;
    readonly particularTokenId: number | null;
    readonly studyTrackingCaseId: number | null;
    readonly clinicId: number | null;
    readonly clinicUserId: number | null;
  };
  /** 0 = exact id, 1 = exact title, 2 = title prefix, 3 = contains. */
  readonly rank: number;
};

export type GlobalSearchGroup = {
  readonly kind: GlobalSearchKind;
  readonly returned: number;
  readonly hasMore: boolean;
};

export type GlobalSearchResult = {
  readonly query: string;
  readonly hits: readonly GlobalSearchHit[];
  readonly groups: readonly GlobalSearchGroup[];
  readonly limit: number;
  readonly offset: number;
};

export type GlobalSearchParseError = {
  readonly ok: false;
  readonly status: 400;
  readonly error: string;
};

export type GlobalSearchParsed<TKind extends GlobalSearchKind> = {
  readonly ok: true;
  readonly kinds: readonly TKind[];
  readonly criteria: GlobalSearchCriteria;
};

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function normalizeGlobalSearchText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = replaceControlCharacters(value.normalize("NFC"))
    .replace(/\s+/g, " ")
    .trim();

  if (text.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
    return null;
  }

  return text.slice(0, GLOBAL_SEARCH_MAX_QUERY_LENGTH);
}

export function buildGlobalSearchNeedle(text: string): GlobalSearchNeedle {
  const escaped = escapeLikePattern(text);
  const numeric = NUMERIC_ID_PATTERN.exec(text);
  const numericId = numeric ? Number(numeric[1]) : null;

  return {
    text,
    containsPattern: `%${escaped}%`,
    prefixPattern: `${escaped}%`,
    exactPattern: escaped,
    numericId:
      numericId !== null && Number.isSafeInteger(numericId) && numericId > 0
        ? numericId
        : null,
  };
}

function parseBoundedInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string" || !/^\d{1,6}$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : null;
}

function parseIsoDay(value: unknown, endOfDay: boolean): Date | null | undefined {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

function parseKinds<TKind extends GlobalSearchKind>(
  value: unknown,
  allowed: readonly TKind[],
): readonly TKind[] | null {
  if (value === undefined || value === null || value === "") {
    return allowed;
  }

  if (typeof value !== "string" || value.length > 120) {
    return null;
  }

  const requested = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    return allowed;
  }

  const allowedSet = new Set<string>(allowed);

  if (requested.some((kind) => !allowedSet.has(kind))) {
    return null;
  }

  return allowed.filter((kind) => requested.includes(kind));
}

function invalid(error: string): GlobalSearchParseError {
  return { ok: false, status: 400, error };
}

/**
 * Parses the shared query grammar of both search surfaces:
 * `q`, `kinds`, `status`, `studyType`, `from`, `to`, `limit`, `offset`.
 * Report-only criteria narrow the kinds to `report`, so a filter never
 * silently returns unfiltered rows of another entity.
 */
export function parseGlobalSearchQuery<TKind extends GlobalSearchKind>(
  query: Record<string, unknown>,
  allowedKinds: readonly TKind[],
): GlobalSearchParsed<TKind> | GlobalSearchParseError {
  const text = normalizeGlobalSearchText(query.q);

  if (!text) {
    return invalid(
      `La búsqueda requiere al menos ${GLOBAL_SEARCH_MIN_QUERY_LENGTH} caracteres`,
    );
  }

  let kinds = parseKinds(query.kinds, allowedKinds);

  if (!kinds) {
    return invalid("Tipo de entidad de búsqueda inválido");
  }

  const limit = parseBoundedInt(query.limit, GLOBAL_SEARCH_DEFAULT_LIMIT, 1, GLOBAL_SEARCH_MAX_LIMIT);
  const offset = parseBoundedInt(query.offset, 0, 0, GLOBAL_SEARCH_MAX_OFFSET);

  if (limit === null || offset === null) {
    return invalid("Paginación de búsqueda inválida");
  }

  if (offset > 0 && kinds.length !== 1) {
    return invalid("La paginación requiere un único tipo de entidad");
  }

  let reportStatus: ReportStatus | null = null;

  if (query.status !== undefined && query.status !== "") {
    if (typeof query.status !== "string" || !REPORT_STATUS_VALUES.has(query.status)) {
      return invalid("Estado de informe inválido");
    }
    reportStatus = query.status as ReportStatus;
  }

  let studyType: string | null = null;

  if (query.studyType !== undefined && query.studyType !== "") {
    if (typeof query.studyType !== "string" || !STUDY_TYPE_PATTERN.test(query.studyType)) {
      return invalid("Tipo de estudio inválido");
    }
    studyType = query.studyType;
  }

  const createdFrom = parseIsoDay(query.from, false);
  const createdTo = parseIsoDay(query.to, true);

  if (createdFrom === undefined || createdTo === undefined) {
    return invalid("Rango de fechas inválido");
  }

  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    return invalid("Rango de fechas inválido");
  }

  if (reportStatus || studyType || createdFrom || createdTo) {
    kinds = kinds.filter((kind) => REPORT_SCOPED_FILTER_KINDS.has(kind));

    if (kinds.length === 0) {
      return invalid("Los filtros de informe requieren incluir informes");
    }
  }

  return {
    ok: true,
    kinds,
    criteria: {
      needle: buildGlobalSearchNeedle(text),
      limit,
      offset,
      reportStatus,
      studyType,
      createdFrom,
      createdTo,
    },
  };
}

const KIND_ORDER: Record<GlobalSearchKind, number> = {
  clinic: 0,
  report: 1,
  tracking_case: 2,
  particular_token: 3,
  clinic_user: 4,
};

function hitTime(hit: GlobalSearchHit): number {
  if (!hit.date) return 0;
  const time = Date.parse(hit.date);
  return Number.isNaN(time) ? 0 : time;
}

/** Deterministic total order: rank, recency, entity order, id. */
export function compareGlobalSearchHits(a: GlobalSearchHit, b: GlobalSearchHit): number {
  return (
    a.rank - b.rank ||
    hitTime(b) - hitTime(a) ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    b.id - a.id
  );
}

export function mergeGlobalSearchHits(
  pages: ReadonlyArray<{ kind: GlobalSearchKind; rows: readonly GlobalSearchHit[] }>,
  limit: number,
): { hits: GlobalSearchHit[]; groups: GlobalSearchGroup[] } {
  const seen = new Set<string>();
  const hits: GlobalSearchHit[] = [];
  const groups: GlobalSearchGroup[] = [];

  for (const page of pages) {
    const visible = page.rows.slice(0, limit);
    let returned = 0;

    for (const row of visible) {
      const key = `${row.kind}:${row.id}`;
      if (row.kind !== page.kind || seen.has(key)) continue;
      seen.add(key);
      hits.push(row);
      returned += 1;
    }

    groups.push({
      kind: page.kind,
      returned,
      hasMore: page.rows.length > limit,
    });
  }

  hits.sort(compareGlobalSearchHits);
  return { hits, groups };
}
