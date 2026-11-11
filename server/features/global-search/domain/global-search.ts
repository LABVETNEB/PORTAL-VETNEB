import type { ReportStatus } from "../../../../drizzle/schema.ts";
import {
  GLOBAL_SEARCH_REPORT_STATUS_VALUES,
  escapeLikePattern,
  makeGlobalSearchTerm,
  parseGlobalSearchLanguage,
  type GlobalSearchLanguage,
  type GlobalSearchTerm,
} from "./global-search-query.ts";

/** Upper bound of the raw `cursor` parameter (the codec emits far less). */
const GLOBAL_SEARCH_CURSOR_MAX_LENGTH = 512;

export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
/** Room for free text plus the filter operators the advanced form composes. */
export const GLOBAL_SEARCH_MAX_QUERY_LENGTH = 200;
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

const REPORT_STATUS_VALUES: ReadonlySet<string> = new Set<string>(GLOBAL_SEARCH_REPORT_STATUS_VALUES);

const STUDY_TYPE_PATTERN = /^[a-z]{3,40}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function replaceControlCharacters(value: string): string {
  let result = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    result += code < 0x20 || code === 0x7f ? " " : character;
  }
  return result;
}

/**
 * The normalized needle. Every pattern is a LIKE pattern with `\`, `%` and `_`
 * escaped, so user text can never widen the match; it is always bound as a
 * SQL parameter, never interpolated.
 *
 * `text` is the whole normalized query (cursor context, echoed `query`).
 * `containsPattern` / `prefixPattern` / `exactPattern` / `numericId` are the
 * PRIMARY term: the whole text for a plain query (exactly the pre-language
 * behavior), otherwise the first term; they only drive the rank. What
 * matches is `clauses`: an OR of clauses, each an AND of terms.
 */
export type GlobalSearchNeedle = {
  readonly text: string;
  readonly containsPattern: string;
  readonly prefixPattern: string;
  readonly exactPattern: string;
  readonly numericId: number | null;
  readonly clauses: readonly (readonly GlobalSearchTerm[])[];
};

/** Position after which a keyset page starts (see `global-search-cursor.ts`). */
export type GlobalSearchAfter = {
  readonly rank: number;
  readonly sortKey: string;
  readonly id: number;
};

export type GlobalSearchCriteria = {
  readonly needle: GlobalSearchNeedle;
  readonly limit: number;
  readonly offset: number;
  /** Raw `cursor` parameter; verified by the use case against its context. */
  readonly cursor: string | null;
  /** Verified keyset position; set only by the use case, never by the parser. */
  readonly after: GlobalSearchAfter | null;
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
  /** Opaque continuation of this entity, present exactly when `hasMore`. */
  readonly nextCursor: string | null;
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
  /** `clinic:` operator of the text (Admin narrowing); the clinic surface rejects it. */
  readonly clinicId: number | null;
  readonly criteria: GlobalSearchCriteria;
};

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

function needleFromLanguage(
  text: string,
  language: Extract<GlobalSearchLanguage, { ok: true }>,
): GlobalSearchNeedle {
  // A query of operators alone has no term: nothing ranks and nothing is matched by text.
  const primaryText = language.plain || language.clauses.length === 0 ? text : language.clauses[0][0].text;
  const escaped = escapeLikePattern(primaryText);
  const termCount = language.clauses.reduce((total, clause) => total + clause.length, 0);

  return {
    text,
    containsPattern: `%${escaped}%`,
    prefixPattern: `${escaped}%`,
    exactPattern: escaped,
    numericId: termCount === 1 ? language.clauses[0][0].numericId : null,
    clauses: language.clauses,
  };
}

/**
 * Needle of an already normalized text. Text the language rejects (the
 * parser reports that to the client) degrades to one literal term, so a
 * direct caller can never end up without a safe needle.
 */
export function buildGlobalSearchNeedle(text: string): GlobalSearchNeedle {
  const language = parseGlobalSearchLanguage(text);

  return needleFromLanguage(
    text,
    language.ok
      ? language
      : {
          ok: true,
          clauses: [[makeGlobalSearchTerm(text, { quoted: true, titleOnly: false })]],
          typeKinds: null,
          filters: { status: null, studyType: null, after: null, before: null, clinicId: null },
          plain: true,
        },
  );
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

export const GLOBAL_SEARCH_CONTRADICTORY_FILTERS_ERROR = "Filtros de búsqueda contradictorios";
const CONTRADICTORY_FILTERS = GLOBAL_SEARCH_CONTRADICTORY_FILTERS_ERROR;

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

  const language = parseGlobalSearchLanguage(text);

  if (!language.ok) {
    return invalid(language.error);
  }

  let kinds = parseKinds(query.kinds, allowedKinds);

  if (!kinds) {
    return invalid("Tipo de entidad de búsqueda inválido");
  }

  if (language.typeKinds) {
    const named = new Set<GlobalSearchKind>(language.typeKinds);
    kinds = kinds.filter((kind) => named.has(kind));

    if (kinds.length === 0) {
      return invalid("El tipo de búsqueda no está disponible aquí");
    }
  }

  const limit = parseBoundedInt(query.limit, GLOBAL_SEARCH_DEFAULT_LIMIT, 1, GLOBAL_SEARCH_MAX_LIMIT);
  const offset = parseBoundedInt(query.offset, 0, 0, GLOBAL_SEARCH_MAX_OFFSET);

  if (limit === null || offset === null) {
    return invalid("Paginación de búsqueda inválida");
  }

  if (offset > 0 && kinds.length !== 1) {
    return invalid("La paginación requiere un único tipo de entidad");
  }

  let cursor: string | null = null;

  if (query.cursor !== undefined && query.cursor !== "") {
    if (typeof query.cursor !== "string" || query.cursor.length > GLOBAL_SEARCH_CURSOR_MAX_LENGTH) {
      return invalid("Cursor de búsqueda inválido");
    }
    if (offset > 0) {
      return invalid("El cursor no se combina con offset");
    }
    cursor = query.cursor;
  }

  // Every filter has two spellings: a request parameter and an operator in the
  // text. Both may be present only when they agree; a disagreement is rejected.
  let reportStatus: ReportStatus | null = null;

  if (query.status !== undefined && query.status !== "") {
    if (typeof query.status !== "string" || !REPORT_STATUS_VALUES.has(query.status)) {
      return invalid("Estado de informe inválido");
    }
    reportStatus = query.status as ReportStatus;
  }

  if (language.filters.status !== null) {
    if (reportStatus !== null && reportStatus !== language.filters.status) return invalid(CONTRADICTORY_FILTERS);
    reportStatus = language.filters.status;
  }

  let studyType: string | null = null;

  if (query.studyType !== undefined && query.studyType !== "") {
    if (typeof query.studyType !== "string" || !STUDY_TYPE_PATTERN.test(query.studyType)) {
      return invalid("Tipo de estudio inválido");
    }
    studyType = query.studyType;
  }

  if (language.filters.studyType !== null) {
    if (studyType !== null && studyType !== language.filters.studyType) return invalid(CONTRADICTORY_FILTERS);
    studyType = language.filters.studyType;
  }

  let createdFrom = parseIsoDay(query.from, false);
  let createdTo = parseIsoDay(query.to, true);

  if (createdFrom === undefined || createdTo === undefined) {
    return invalid("Rango de fechas inválido");
  }

  if (language.filters.after !== null) {
    const after = parseIsoDay(language.filters.after, false) ?? null;
    if (createdFrom && after && createdFrom.getTime() !== after.getTime()) return invalid(CONTRADICTORY_FILTERS);
    createdFrom = after;
  }

  if (language.filters.before !== null) {
    const before = parseIsoDay(language.filters.before, true) ?? null;
    if (createdTo && before && createdTo.getTime() !== before.getTime()) return invalid(CONTRADICTORY_FILTERS);
    createdTo = before;
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

  if (cursor !== null && kinds.length !== 1) {
    return invalid("El cursor requiere un único tipo de entidad");
  }

  return {
    ok: true,
    kinds,
    clinicId: language.filters.clinicId,
    criteria: {
      needle: needleFromLanguage(text, language),
      limit,
      offset,
      cursor,
      after: null,
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

/**
 * Interleaves the entity pages. Each page is already in its SQL order (rank,
 * the entity's own sort timestamp with microseconds, id), so rows are never
 * re-sorted inside an entity: the comparator only picks between the heads of
 * the different entities (k-way merge). Re-sorting a page by the display date
 * would disagree with the SQL order (reports sort by `created_at` but show
 * `upload_date`) and break the keyset continuation of that entity.
 */
export function mergeGlobalSearchHits(
  pages: ReadonlyArray<{ kind: GlobalSearchKind; rows: readonly GlobalSearchHit[] }>,
  limit: number,
): { hits: GlobalSearchHit[]; groups: GlobalSearchGroup[] } {
  const seen = new Set<string>();
  const queues: GlobalSearchHit[][] = [];
  const groups: GlobalSearchGroup[] = [];

  for (const page of pages) {
    const visible = page.rows.slice(0, limit);
    const queue: GlobalSearchHit[] = [];

    for (const row of visible) {
      const key = `${row.kind}:${row.id}`;
      if (row.kind !== page.kind || seen.has(key)) continue;
      seen.add(key);
      queue.push(row);
    }

    queues.push(queue);
    groups.push({
      kind: page.kind,
      returned: queue.length,
      hasMore: page.rows.length > limit,
      nextCursor: null,
    });
  }

  const hits: GlobalSearchHit[] = [];
  for (;;) {
    let best = -1;
    for (let index = 0; index < queues.length; index += 1) {
      const head = queues[index][0];
      if (head && (best === -1 || compareGlobalSearchHits(head, queues[best][0]) < 0)) best = index;
    }
    if (best === -1) break;
    hits.push(queues[best].shift() as GlobalSearchHit);
  }
  return { hits, groups };
}

/**
 * GLOBAL-SEARCH-3C: entity queries a request will run, from the same parser
 * the use case applies. A request the parser rejects still costs one unit.
 */
export function globalSearchQueryUnits<TKind extends GlobalSearchKind>(
  query: Record<string, unknown>,
  allowedKinds: readonly TKind[],
): number {
  const parsed = parseGlobalSearchQuery(query, allowedKinds);
  return parsed.ok ? Math.max(1, parsed.kinds.length) : 1;
}
