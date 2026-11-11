import type { ReportStatus } from "../../../../drizzle/schema.ts";

/**
 * Query language of the global search (pure, no I/O).
 *
 *   luna perez            AND between words (each word may match any searchable field)
 *   "luna perez"          exact phrase (contiguous, inside one field)
 *   luna OR rex           explicit OR (uppercase `OR`); AND binds tighter than OR
 *   type:informe          restricts the ENTITIES searched, whole query, any position
 *   title:luna            the term must match the record title only
 *   title:"luna perez"    same, for a phrase
 *   status:ready          report status (reports only; `estado:` is an alias)
 *   study:histopatologia  report study type (reports only; `estudio:` is an alias)
 *   after:2026-01-01      reports created on or after that UTC day (inclusive)
 *   before:2026-12-31     reports created on or before that UTC day (inclusive)
 *   clinic:12             Admin only: narrows to one clinic (`clinica:` is an alias)
 *
 * A query made only of operators (`type:informe`, `after:2026-01-01`) is valid:
 * its filters are the criteria. Repeating an operator with a different value
 * (`status:ready status:delivered`) is rejected, never resolved silently.
 *
 * Deterministic by construction: the same text always yields the same
 * expression. Anything the user types reaches SQL only as an escaped LIKE
 * pattern bound as a parameter; operators never build SQL text.
 *
 * Not implemented on purpose: `-term` exclusion (a leading `-` is literal) and
 * fuzzy matching (see docs/implementation/global-search-phase-2-query-engine.md).
 */

export const GLOBAL_SEARCH_MAX_TERMS = 8;
export const GLOBAL_SEARCH_MAX_CLAUSES = 4;
export const GLOBAL_SEARCH_REPORT_STATUS_VALUES = [
  "uploaded",
  "processing",
  "ready",
  "delivered",
] as const satisfies readonly ReportStatus[];

/** Entity kinds a `type:` value can name (a subset type, resolved by the parser). */
export type GlobalSearchTypeKind =
  | "clinic"
  | "report"
  | "particular_token"
  | "tracking_case"
  | "clinic_user";

const NUMERIC_ID_PATTERN = /^#?(\d{1,9})$/;
const OPERATOR_PREFIX = /^([A-Za-z]{2,20}):/;
const STUDY_TYPE_PATTERN = /^[a-z]{3,40}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLINIC_ID_PATTERN = /^[1-9]\d{0,8}$/;

type FilterOperator = "status" | "studyType" | "after" | "before" | "clinicId";

const OPERATOR_NAMES: Readonly<Record<string, "type" | "title" | FilterOperator>> = {
  type: "type",
  title: "title",
  status: "status",
  estado: "status",
  study: "studyType",
  estudio: "studyType",
  after: "after",
  before: "before",
  clinic: "clinicId",
  clinica: "clinicId",
};

export type GlobalSearchLanguageFilters = {
  readonly status: ReportStatus | null;
  readonly studyType: string | null;
  /** `YYYY-MM-DD`, inclusive lower bound (UTC day). */
  readonly after: string | null;
  /** `YYYY-MM-DD`, inclusive upper bound (UTC day). */
  readonly before: string | null;
  readonly clinicId: number | null;
};

function isRealIsoDay(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** A normalized operator value, or the error that rejects it. */
function readFilterValue(
  operator: FilterOperator,
  value: string,
): { readonly value: string | number } | { readonly error: string } {
  switch (operator) {
    case "status": {
      const status = foldKey(value);
      return (GLOBAL_SEARCH_REPORT_STATUS_VALUES as readonly string[]).includes(status)
        ? { value: status }
        : { error: "Estado de informe inválido" };
    }
    case "studyType": {
      const study = foldKey(value);
      return STUDY_TYPE_PATTERN.test(study) ? { value: study } : { error: "Tipo de estudio inválido" };
    }
    case "clinicId":
      return CLINIC_ID_PATTERN.test(value)
        ? { value: Number(value) }
        : { error: "Clínica de búsqueda inválida" };
    default:
      return isRealIsoDay(value) ? { value } : { error: "Fecha de búsqueda inválida" };
  }
}

const TYPE_ALIASES: Readonly<Record<string, GlobalSearchTypeKind>> = {
  report: "report",
  reports: "report",
  informe: "report",
  informes: "report",
  token: "particular_token",
  tokens: "particular_token",
  particular_token: "particular_token",
  token_particular: "particular_token",
  seguimiento: "tracking_case",
  seguimientos: "tracking_case",
  tracking: "tracking_case",
  tracking_case: "tracking_case",
  clinic: "clinic",
  clinica: "clinic",
  clinicas: "clinic",
  user: "clinic_user",
  users: "clinic_user",
  usuario: "clinic_user",
  usuarios: "clinic_user",
  clinic_user: "clinic_user",
};

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function foldKey(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export type GlobalSearchTerm = {
  /** The literal text to find (word or phrase), as typed. */
  readonly text: string;
  /** `%escaped%`, bound as a parameter. */
  readonly containsPattern: string;
  /** Record id when the term is a bare number (`812` or `#812`); never for phrases or `title:`. */
  readonly numericId: number | null;
  /** `title:` term: matches the record title only. */
  readonly titleOnly: boolean;
};

export type GlobalSearchLanguage =
  | {
      readonly ok: true;
      /**
       * OR of clauses; each clause is an AND of terms and none is empty. The
       * list is empty only for a query made of operators alone (see `filters`).
       */
      readonly clauses: readonly (readonly GlobalSearchTerm[])[];
      /** Entities named by `type:` (union), or null when the query names none. */
      readonly typeKinds: readonly GlobalSearchTypeKind[] | null;
      /** Filter operators typed in the text; untouched fields are null. */
      readonly filters: GlobalSearchLanguageFilters;
      /** No operator, quote or OR: the query is just words (legacy shape). */
      readonly plain: boolean;
    }
  | { readonly ok: false; readonly error: string };

export function makeGlobalSearchTerm(
  text: string,
  options: { quoted: boolean; titleOnly: boolean },
): GlobalSearchTerm {
  const numeric = options.quoted || options.titleOnly ? null : NUMERIC_ID_PATTERN.exec(text);
  const id = numeric ? Number(numeric[1]) : null;

  return {
    text,
    containsPattern: `%${escapeLikePattern(text)}%`,
    numericId: id !== null && Number.isSafeInteger(id) && id > 0 ? id : null,
    titleOnly: options.titleOnly,
  };
}

/** Reads a quoted run starting at `start` (the opening quote). An unclosed quote runs to the end. */
function readQuoted(text: string, start: number): { value: string; next: number } {
  const close = text.indexOf('"', start + 1);
  return close === -1
    ? { value: text.slice(start + 1), next: text.length }
    : { value: text.slice(start + 1, close), next: close + 1 };
}

function readWord(text: string, start: number): { value: string; next: number } {
  let end = start;
  while (end < text.length && text[end] !== " ") end += 1;
  return { value: text.slice(start, end), next: end };
}

export function parseGlobalSearchLanguage(text: string): GlobalSearchLanguage {
  const clauses: GlobalSearchTerm[][] = [[]];
  const typeKinds = new Set<GlobalSearchTypeKind>();
  const filters: Record<FilterOperator, string | number | null> = {
    status: null,
    studyType: null,
    after: null,
    before: null,
    clinicId: null,
  };
  let operatorCount = 0;
  let plain = true;
  let termCount = 0;
  let index = 0;

  const push = (term: GlobalSearchTerm): string | null => {
    termCount += 1;
    if (termCount > GLOBAL_SEARCH_MAX_TERMS) return "Demasiados términos de búsqueda";
    clauses[clauses.length - 1].push(term);
    return null;
  };

  while (index < text.length) {
    if (text[index] === " ") {
      index += 1;
      continue;
    }

    if (text[index] === '"') {
      const quoted = readQuoted(text, index);
      index = quoted.next;
      plain = false;
      const phrase = quoted.value.trim();
      if (phrase) {
        const error = push(makeGlobalSearchTerm(phrase, { quoted: true, titleOnly: false }));
        if (error) return { ok: false, error };
      }
      continue;
    }

    const operator = OPERATOR_PREFIX.exec(text.slice(index));
    if (operator) {
      const name = operator[1].toLowerCase();
      const resolved = OPERATOR_NAMES[name];
      if (!resolved) {
        return { ok: false, error: `Operador de búsqueda desconocido: ${name}:` };
      }
      plain = false;
      index += operator[0].length;
      const quoted = text[index] === '"';
      const read = quoted ? readQuoted(text, index) : readWord(text, index);
      index = read.next;
      const value = read.value.trim();
      if (!value) continue; // `type:` still being typed: no effect yet

      if (resolved === "type") {
        const kind = TYPE_ALIASES[foldKey(value)];
        if (!kind) return { ok: false, error: "Tipo de búsqueda inválido" };
        typeKinds.add(kind);
      } else if (resolved !== "title") {
        const read = readFilterValue(resolved, value);
        if ("error" in read) return { ok: false, error: read.error };
        const current = filters[resolved];
        if (current !== null && current !== read.value) {
          return { ok: false, error: `Filtros contradictorios: ${name}:` };
        }
        if (current === null) {
          // Each filter holds one value, so at most five operators ever count.
          operatorCount += 1;
          filters[resolved] = read.value;
        }
      } else {
        const error = push(makeGlobalSearchTerm(value, { quoted, titleOnly: true }));
        if (error) return { ok: false, error };
      }
      continue;
    }

    const word = readWord(text, index);
    index = word.next;

    if (word.value === "OR") {
      plain = false;
      if (clauses[clauses.length - 1].length > 0) {
        if (clauses.length >= GLOBAL_SEARCH_MAX_CLAUSES) {
          return { ok: false, error: "Demasiadas alternativas OR en la búsqueda" };
        }
        clauses.push([]);
      }
      continue;
    }

    const error = push(makeGlobalSearchTerm(word.value, { quoted: false, titleOnly: false }));
    if (error) return { ok: false, error };
  }

  const nonEmpty = clauses.filter((clause) => clause.length > 0);
  const hasFilters = typeKinds.size > 0 || operatorCount > 0;

  if (nonEmpty.length === 0 && !hasFilters) {
    return { ok: false, error: "La búsqueda requiere al menos un término" };
  }

  return {
    ok: true,
    clauses: nonEmpty,
    typeKinds: typeKinds.size > 0 ? [...typeKinds] : null,
    filters: filters as GlobalSearchLanguageFilters,
    plain,
  };
}
