import type { GlobalSearchFilters, GlobalSearchSurface } from "./global-search";

/**
 * GLOBAL-SEARCH-DRIVE-A · the client's canonical query model (pure: no fetch,
 * no router, no window, no runtime imports).
 *
 *   text  → parseGlobalSearchQuery → words + typed filters (+ the client's reading)
 *   words + filters → resolveGlobalSearchQuery → canonical text (deterministic order) → API
 *
 * The server (`server/features/global-search/domain/global-search-query.ts`) is
 * the authority. This parser is PERMISSIVE: whatever it does not understand
 * (unknown operator, invalid value, contradiction) stays in the words as typed,
 * so the server answers its own closed 400. `semantics` is the client's reading
 * and is `null` exactly when the server would reject the text;
 * `frontend-global-search-query-model.test.ts` compares both over a corpus.
 */

export const GLOBAL_SEARCH_QUERY_MAX_LENGTH = 200;
export const GLOBAL_SEARCH_QUERY_MAX_TERMS = 8;
export const GLOBAL_SEARCH_QUERY_MAX_CLAUSES = 4;

const REPORT_STATUSES: readonly string[] = ["uploaded", "processing", "ready", "delivered"];
const NUMERIC_ID_PATTERN = /^#?(\d{1,9})$/;
const OPERATOR_PREFIX = /^([A-Za-z]{2,20}):/;
const STUDY_TYPE_PATTERN = /^[a-z]{3,40}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLINIC_ID_PATTERN = /^[1-9]\d{0,8}$/;

type FilterKey = "status" | "studyType" | "after" | "before" | "clinicId";

const OPERATOR_NAMES: Readonly<Record<string, "type" | "title" | FilterKey>> = {
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

const TYPE_ALIASES: Readonly<Record<string, string>> = {
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

function foldKey(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function isRealIsoDay(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readFilterValue(key: FilterKey, value: string): string | null {
  switch (key) {
    case "status": {
      const status = foldKey(value);
      return REPORT_STATUSES.includes(status) ? status : null;
    }
    case "studyType": {
      const study = foldKey(value);
      return STUDY_TYPE_PATTERN.test(study) ? study : null;
    }
    case "clinicId":
      return CLINIC_ID_PATTERN.test(value) ? value : null;
    default:
      return isRealIsoDay(value) ? value : null;
  }
}

/** Whitespace collapsed and trimmed, never cut: the length is the composer's concern. */
export function collapseGlobalSearchText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export type GlobalSearchQueryToken = {
  readonly kind: "term" | "or" | "type" | "raw";
  /** The token as it is composed back into text. */
  readonly raw: string;
};

export type GlobalSearchSemanticTerm = {
  readonly text: string;
  readonly numericId: number | null;
  readonly titleOnly: boolean;
};

/** The client's reading of a text, shaped like the server's `GlobalSearchLanguage`. */
export type GlobalSearchSemantics = {
  readonly clauses: readonly (readonly GlobalSearchSemanticTerm[])[];
  readonly typeKinds: readonly string[] | null;
  readonly filters: {
    readonly status: string | null;
    readonly studyType: string | null;
    readonly after: string | null;
    readonly before: string | null;
    readonly clinicId: number | null;
  };
};

/** Filter operators typed in the text; only the fields that were typed are present. */
export type GlobalSearchTypedFilters = Partial<
  Pick<GlobalSearchFilters, "status" | "studyType" | "from" | "to" | "clinicId">
>;

export type ParsedGlobalSearchQuery = {
  readonly tokens: readonly GlobalSearchQueryToken[];
  /** The text without the filter operators that were lifted into `typed`. */
  readonly words: string;
  readonly typed: GlobalSearchTypedFilters;
  /** Entities named by valid `type:` operators (union, in order); the operators themselves stay in the words. */
  readonly typeKinds: readonly string[];
  /** `null` when the server would reject the text (or it says nothing). */
  readonly semantics: GlobalSearchSemantics | null;
};

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

function semanticTerm(text: string, quoted: boolean, titleOnly: boolean): GlobalSearchSemanticTerm {
  const numeric = quoted || titleOnly ? null : NUMERIC_ID_PATTERN.exec(text);
  const id = numeric ? Number(numeric[1]) : null;
  return { text, numericId: id !== null && Number.isSafeInteger(id) && id > 0 ? id : null, titleOnly };
}

export function parseGlobalSearchQuery(
  text: string,
  options: { readonly surface?: GlobalSearchSurface } = {},
): ParsedGlobalSearchQuery {
  const source = collapseGlobalSearchText(text);
  const adminOnly = options.surface !== "clinic";
  const tokens: GlobalSearchQueryToken[] = [];
  const clauses: GlobalSearchSemanticTerm[][] = [[]];
  const typeKinds: string[] = [];
  const filters: Record<FilterKey, string | null> = {
    status: null,
    studyType: null,
    after: null,
    before: null,
    clinicId: null,
  };
  const typed: { -readonly [K in keyof GlobalSearchTypedFilters]: GlobalSearchTypedFilters[K] } = {};
  let operatorCount = 0;
  let termCount = 0;
  let understood = true;
  let index = 0;

  const pushTerm = (term: GlobalSearchSemanticTerm, raw: string) => {
    tokens.push({ kind: "term", raw });
    termCount += 1;
    if (termCount > GLOBAL_SEARCH_QUERY_MAX_TERMS) understood = false;
    clauses[clauses.length - 1].push(term);
  };

  while (index < source.length) {
    if (source[index] === " ") {
      index += 1;
      continue;
    }

    if (source[index] === '"') {
      const quoted = readQuoted(source, index);
      index = quoted.next;
      const phrase = quoted.value.trim();
      if (phrase) pushTerm(semanticTerm(phrase, true, false), `"${phrase}"`);
      continue;
    }

    const operator = OPERATOR_PREFIX.exec(source.slice(index));
    if (operator) {
      const resolved = OPERATOR_NAMES[operator[1].toLowerCase()];
      if (!resolved) {
        // Not ours to judge: the word stays as typed and the server answers.
        understood = false;
        const word = readWord(source, index);
        index = word.next;
        tokens.push({ kind: "raw", raw: word.value });
        continue;
      }
      index += operator[0].length;
      const quoted = source[index] === '"';
      const read = quoted ? readQuoted(source, index) : readWord(source, index);
      index = read.next;
      const value = read.value.trim();
      if (!value) continue; // still being typed: no effect, like the server
      const raw = `${operator[0]}${quoted ? `"${value}"` : value}`;

      if (resolved === "type") {
        const kind = TYPE_ALIASES[foldKey(value)];
        if (kind === undefined) understood = false;
        else if (!typeKinds.includes(kind)) typeKinds.push(kind);
        tokens.push({ kind: "type", raw });
      } else if (resolved === "title") {
        pushTerm(semanticTerm(value, quoted, true), raw);
      } else if (resolved === "clinicId" && !adminOnly) {
        tokens.push({ kind: "raw", raw });
      } else {
        const normalized = readFilterValue(resolved, value);
        const current = filters[resolved];
        if (normalized === null || (current !== null && current !== normalized)) {
          understood = false;
          tokens.push({ kind: "raw", raw });
        } else if (current === null) {
          filters[resolved] = normalized;
          operatorCount += 1;
          if (resolved === "status") typed.status = normalized as GlobalSearchFilters["status"];
          else if (resolved === "studyType") typed.studyType = normalized;
          else if (resolved === "after") typed.from = normalized;
          else if (resolved === "before") typed.to = normalized;
          else typed.clinicId = normalized;
        }
        // The same value again: unified, nothing to keep.
      }
      continue;
    }

    const word = readWord(source, index);
    index = word.next;
    if (word.value === "OR") {
      tokens.push({ kind: "or", raw: "OR" });
      if (clauses[clauses.length - 1].length > 0) {
        if (clauses.length >= GLOBAL_SEARCH_QUERY_MAX_CLAUSES) understood = false;
        else clauses.push([]);
      }
      continue;
    }
    pushTerm(semanticTerm(word.value, false, false), word.value);
  }

  const nonEmpty = clauses.filter((clause) => clause.length > 0);
  const hasOperators = typeKinds.length > 0 || operatorCount > 0;
  const semantics: GlobalSearchSemantics | null =
    understood && (nonEmpty.length > 0 || hasOperators)
      ? {
          clauses: nonEmpty,
          typeKinds: typeKinds.length > 0 ? typeKinds : null,
          filters: {
            status: filters.status,
            studyType: filters.studyType,
            after: filters.after,
            before: filters.before,
            clinicId: filters.clinicId === null ? null : Number(filters.clinicId),
          },
        }
      : null;

  return { tokens, words: tokens.map((token) => token.raw).join(" "), typed, typeKinds, semantics };
}

const TYPED_KEYS = ["status", "studyType", "from", "to", "clinicId"] as const;

function overlayFilters(
  surface: GlobalSearchSurface,
  applied: GlobalSearchFilters,
  typed: GlobalSearchTypedFilters,
): GlobalSearchFilters {
  const next: { -readonly [K in keyof GlobalSearchFilters]: GlobalSearchFilters[K] } = { ...applied };
  for (const key of TYPED_KEYS) {
    const value = typed[key];
    if (value !== undefined && value !== "") (next as Record<string, unknown>)[key] = value;
  }
  if (surface === "clinic") next.clinicId = "";
  return next;
}

/**
 * Typed filter operators folded into the applied filters (they replace only
 * their own field) and removed from the words: what Enter and every filter
 * edit do, so the operator becomes a chip.
 */
export function foldTypedGlobalSearchFilters(
  surface: GlobalSearchSurface,
  query: string,
  filters: GlobalSearchFilters,
): { readonly query: string; readonly filters: GlobalSearchFilters } {
  const parsed = parseGlobalSearchQuery(query, { surface });
  return { query: parsed.words, filters: overlayFilters(surface, filters, parsed.typed) };
}

const OPERATOR_ORDER: readonly { readonly key: "status" | "studyType" | "from" | "to" | "clinicId"; readonly name: string }[] =
  [
    { key: "status", name: "status" },
    { key: "studyType", name: "study" },
    { key: "from", name: "after" },
    { key: "to", name: "before" },
    { key: "clinicId", name: "clinic" },
  ];

function filterOperators(surface: GlobalSearchSurface, filters: GlobalSearchFilters): string[] {
  const operators: string[] = [];
  for (const { key, name } of OPERATOR_ORDER) {
    const value = filters[key];
    if (!value) continue;
    if (key === "status" && !REPORT_STATUSES.includes(value)) continue;
    if (key === "studyType" && !STUDY_TYPE_PATTERN.test(value)) continue;
    if ((key === "from" || key === "to") && !ISO_DATE_PATTERN.test(value)) continue;
    if (key === "clinicId" && (surface !== "admin" || !CLINIC_ID_PATTERN.test(value))) continue;
    operators.push(`${name}:${value}`);
  }
  return operators;
}

export type ResolvedGlobalSearchQuery = {
  /** The words, without filter operators. */
  readonly words: string;
  /** Applied filters with the typed operators on top, field by field. */
  readonly filters: GlobalSearchFilters;
  /** What the API receives as `q`: words, then the filters in a fixed order. At most 200 characters. */
  readonly text: string;
  /** Trailing words were dropped to keep the filters inside the 200-character limit. */
  readonly truncated: boolean;
  /** Entities a typed `type:` restricts the search to (the operator stays in the words); empty when none. */
  readonly typeKinds: readonly string[];
};

/**
 * The single place a request's `q` is composed. Deterministic: the same words
 * and filters always give the same text. When it would exceed the server's
 * limit the trailing WORDS are dropped whole (never a filter, never half a
 * quoted phrase) and `truncated` says so.
 */
export function resolveGlobalSearchQuery(
  surface: GlobalSearchSurface,
  query: string,
  filters: GlobalSearchFilters,
): ResolvedGlobalSearchQuery {
  const parsed = parseGlobalSearchQuery(query, { surface });
  const effective = overlayFilters(surface, filters, parsed.typed);
  const operators = filterOperators(surface, effective);
  const raws = parsed.tokens.map((token) => token.raw);
  let truncated = false;
  const compose = () => [...raws, ...operators].join(" ");
  while (compose().length > GLOBAL_SEARCH_QUERY_MAX_LENGTH && raws.length > 0) {
    raws.pop();
    truncated = true;
  }
  return { words: raws.join(" "), filters: effective, text: compose(), truncated, typeKinds: parsed.typeKinds };
}

/** A search can run: it has words of its own or at least one filter operator. */
export function hasGlobalSearchFilterOperators(
  surface: GlobalSearchSurface,
  query: string,
  filters: GlobalSearchFilters,
): boolean {
  return filterOperators(surface, resolveGlobalSearchQuery(surface, query, filters).filters).length > 0;
}

// ── Advanced form (A6): three text fields that produce text of the same model ──

export type GlobalSearchAdvancedText = {
  readonly contains: string;
  readonly exact: string;
  readonly title: string;
};

export const EMPTY_GLOBAL_SEARCH_ADVANCED_TEXT: GlobalSearchAdvancedText = { contains: "", exact: "", title: "" };

/** A word that would read as an operator, as `OR`, or that carries a quote, is quoted. */
export function quoteGlobalSearchWordIfOperator(word: string): string {
  const bare = word.replace(/"/g, "");
  if (!bare) return "";
  return bare === "OR" || OPERATOR_PREFIX.test(bare) || bare !== word ? `"${bare}"` : bare;
}

export function composeAdvancedFreeText(fields: GlobalSearchAdvancedText): string {
  const parts: string[] = [];
  for (const word of collapseGlobalSearchText(fields.contains).split(" ")) {
    const quoted = quoteGlobalSearchWordIfOperator(word);
    if (quoted) parts.push(quoted);
  }
  const exact = collapseGlobalSearchText(fields.exact.replace(/"/g, ""));
  if (exact) parts.push(`"${exact}"`);
  const title = collapseGlobalSearchText(fields.title.replace(/"/g, ""));
  if (title) parts.push(title.includes(" ") ? `title:"${title}"` : `title:${title}`);
  return parts.join(" ");
}

/**
 * The form's reading of the words, or `null` when they hold something the form
 * does not express (OR alternatives, several phrases or titles, `type:`, literal
 * terms): the form must not overwrite such a query.
 */
export function readAdvancedFreeText(words: string): GlobalSearchAdvancedText | null {
  const parsed = parseGlobalSearchQuery(words);
  if (parsed.semantics === null && parsed.tokens.length > 0) return null;
  const contains: string[] = [];
  let exact = "";
  let title = "";
  let phrases = 0;
  let titles = 0;
  for (const token of parsed.tokens) {
    if (token.kind !== "term") return null;
    const titleMatch = /^title:(.*)$/i.exec(token.raw);
    if (titleMatch) {
      titles += 1;
      title = titleMatch[1].replace(/^"|"$/g, "");
    } else if (token.raw.startsWith('"')) {
      phrases += 1;
      exact = token.raw.slice(1, -1);
    } else {
      contains.push(token.raw);
    }
  }
  if (phrases > 1 || titles > 1) return null;
  return { contains: contains.join(" "), exact, title };
}
