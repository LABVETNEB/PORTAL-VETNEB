/**
 * Query language of the global search (pure, no I/O).
 *
 *   luna perez            AND between words (each word may match any searchable field)
 *   "luna perez"          exact phrase (contiguous, inside one field)
 *   luna OR rex           explicit OR (uppercase `OR`); AND binds tighter than OR
 *   type:informe          restricts the ENTITIES searched, whole query, any position
 *   title:luna            the term must match the record title only
 *   title:"luna perez"    same, for a phrase
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

/** Entity kinds a `type:` value can name (a subset type, resolved by the parser). */
export type GlobalSearchTypeKind =
  | "clinic"
  | "report"
  | "particular_token"
  | "tracking_case"
  | "clinic_user";

const NUMERIC_ID_PATTERN = /^#?(\d{1,9})$/;
const OPERATOR_PREFIX = /^([A-Za-z]{2,20}):/;

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
      /** OR of clauses; each clause is an AND of terms. Never empty; no clause is empty. */
      readonly clauses: readonly (readonly GlobalSearchTerm[])[];
      /** Entities named by `type:` (union), or null when the query names none. */
      readonly typeKinds: readonly GlobalSearchTypeKind[] | null;
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
      if (name !== "type" && name !== "title") {
        return { ok: false, error: `Operador de búsqueda desconocido: ${name}:` };
      }
      plain = false;
      index += operator[0].length;
      const quoted = text[index] === '"';
      const read = quoted ? readQuoted(text, index) : readWord(text, index);
      index = read.next;
      const value = read.value.trim();
      if (!value) continue; // `type:` still being typed: no effect yet

      if (name === "type") {
        const kind = TYPE_ALIASES[foldKey(value)];
        if (!kind) return { ok: false, error: "Tipo de búsqueda inválido" };
        typeKinds.add(kind);
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
  if (nonEmpty.length === 0) {
    return { ok: false, error: "La búsqueda requiere al menos un término" };
  }

  return {
    ok: true,
    clauses: nonEmpty,
    typeKinds: typeKinds.size > 0 ? [...typeKinds] : null,
    plain,
  };
}
