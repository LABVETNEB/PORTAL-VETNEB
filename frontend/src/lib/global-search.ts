import {
  GLOBAL_SEARCH_QUERY_MAX_LENGTH,
  collapseGlobalSearchText,
  hasGlobalSearchFilterOperators,
  resolveGlobalSearchQuery,
} from "./global-search-query";
import { ROUTES } from "./routes";
import { STUDY_TYPE_LABELS } from "./study-types";

/**
 * GLOBAL-SEARCH-2 · client contract of `GET /api/search` (clinic) and
 * `GET /api/admin/search` (admin), shipped by GLOBAL-SEARCH-1
 * (`server/features/global-search`). Pure: no fetch, no router, no window.
 *
 * The tenant is never a client input: the clinic request carries no `clinicId`
 * at all, and the admin `clinicId` only narrows an already authorized search.
 */

export type GlobalSearchSurface = "clinic" | "admin";

/** Window event that opens the full search (the mobile overflow menu sends it). */
export const DASHBOARD_GLOBAL_SEARCH_OPEN_EVENT = "vetneb:dashboard-global-search-open";

export const CLINIC_GLOBAL_SEARCH_KINDS = ["report", "particular_token", "tracking_case"] as const;
export const ADMIN_GLOBAL_SEARCH_KINDS = [
  "clinic",
  "report",
  "particular_token",
  "tracking_case",
  "clinic_user",
] as const;

export type GlobalSearchKind = (typeof ADMIN_GLOBAL_SEARCH_KINDS)[number];

export const GLOBAL_SEARCH_MIN_QUERY = 2;
/** The server's `q` limit (it was 80 before the operators and filters travelled inside `q`). */
export const GLOBAL_SEARCH_MAX_QUERY = GLOBAL_SEARCH_QUERY_MAX_LENGTH;
export const GLOBAL_SEARCH_SUGGESTION_LIMIT = 5;
export const GLOBAL_SEARCH_PAGE_SIZE = 20;
/** Largest `offset` the API accepts. Only the first-window (offset) path uses it: continuations go by cursor. */
export const GLOBAL_SEARCH_MAX_OFFSET = 500;
/** Largest `cursor` the API accepts (GLOBAL-SEARCH-3A-CURSOR backend). */
export const GLOBAL_SEARCH_MAX_CURSOR_LENGTH = 512;
/** Exact 400 message of a rejected continuation (expired, tampered or foreign cursor). */
export const GLOBAL_SEARCH_INVALID_CURSOR_MESSAGE = "Cursor de búsqueda inválido";
export const GLOBAL_SEARCH_DEBOUNCE_MS = 250;

export const GLOBAL_SEARCH_REPORT_STATUSES = ["uploaded", "processing", "ready", "delivered"] as const;
export type GlobalSearchReportStatus = (typeof GLOBAL_SEARCH_REPORT_STATUSES)[number];

export type GlobalSearchFact = { readonly label: string; readonly value: string };

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
  readonly rank: number;
};

export type GlobalSearchGroup = {
  readonly kind: GlobalSearchKind;
  readonly returned: number;
  readonly hasMore: boolean;
  /**
   * Opaque continuation of this kind, a string exactly when `hasMore`. Signed
   * by the server for this surface, tenant, query, filters and kind; valid for
   * a limited time. Kept in memory only, never logged or persisted.
   */
  readonly nextCursor: string | null;
};

export type GlobalSearchResult = {
  readonly query: string;
  readonly hits: readonly GlobalSearchHit[];
  readonly groups: readonly GlobalSearchGroup[];
  readonly limit: number;
  readonly offset: number;
};

export type GlobalSearchFilters = {
  readonly kinds: readonly GlobalSearchKind[];
  readonly status: GlobalSearchReportStatus | "";
  readonly studyType: string;
  readonly from: string;
  readonly to: string;
  /** Admin only: narrows to one clinic. Ignored for the clinic surface. */
  readonly clinicId: string;
};

export const EMPTY_GLOBAL_SEARCH_FILTERS: GlobalSearchFilters = {
  kinds: [],
  status: "",
  studyType: "",
  from: "",
  to: "",
  clinicId: "",
};

/**
 * Where a window starts: an `offset` (first window, or the legacy offset
 * consumers) or the `cursor` a previous response gave for one kind. Never
 * both: the API rejects the combination.
 */
export type GlobalSearchPosition =
  | { readonly offset: number; readonly cursor?: undefined }
  | { readonly cursor: string; readonly offset?: undefined };

export type GlobalSearchRequest = {
  readonly query: string;
  readonly filters: GlobalSearchFilters;
  readonly limit: number;
} & GlobalSearchPosition;

export function isGlobalSearchContinuation(
  request: GlobalSearchRequest,
): request is GlobalSearchRequest & { readonly cursor: string } {
  return typeof request.cursor === "string";
}

/**
 * The last full search of each surface, kept in memory only for this tab's
 * SPA lifetime (never in browser storage: queries carry patient and tutor
 * names). Opening a record navigates to a module whose route may mount a new
 * top bar; reopening the search restores this session from here. Logout
 * hard-reloads the document, which drops it.
 */
export type GlobalSearchSessionMemory = {
  readonly query: string;
  readonly filters: GlobalSearchFilters;
  readonly pageIndex: number;
  /** Page size of `pageIndex`: a page index only means something with its size. */
  readonly pageSize: number;
  readonly selected: GlobalSearchHit | null;
};

const SESSION_MEMORY = new Map<GlobalSearchSurface, GlobalSearchSessionMemory>();

export function readGlobalSearchSession(surface: GlobalSearchSurface): GlobalSearchSessionMemory | null {
  return SESSION_MEMORY.get(surface) ?? null;
}

export function writeGlobalSearchSession(surface: GlobalSearchSurface, value: GlobalSearchSessionMemory): void {
  SESSION_MEMORY.set(surface, value);
}

/**
 * Syntax rejections of the query language (`server/features/global-search`).
 * The API answers HTTP 400 with one of a closed set of messages; only those
 * are turned into guidance. Any other 400 keeps a generic text, so nothing
 * the server says is ever echoed to the screen unfiltered.
 */
const OPERATOR_UNKNOWN = /^Operador de búsqueda desconocido: ([A-Za-z]{2,20}):$/;
const FILTERS_CONTRADICTORY = /^Filtros contradictorios: ([A-Za-z]{2,20}):$/;

const SYNTAX_MESSAGES: Readonly<Record<string, (surface: GlobalSearchSurface) => string>> = {
  "Estado de informe inválido": () => "Ese estado no existe. Probá status:uploaded, processing, ready o delivered.",
  "Tipo de estudio inválido": () => "Ese tipo de estudio no es válido. Usá solo letras, por ejemplo study:citologia.",
  "Clínica de búsqueda inválida": () => "El número de clínica no es válido. Usá el ID numérico, por ejemplo clinic:12.",
  "Fecha de búsqueda inválida": () => "La fecha no es válida. Usá el formato AAAA-MM-DD con un día real.",
  "Rango de fechas inválido": () => "La fecha «Desde» es posterior a «Hasta». Revisá el rango.",
  "Filtros de búsqueda contradictorios": () => "Los filtros se contradicen entre sí. Quitá uno de los dos.",
  "Los filtros de informe requieren incluir informes": () =>
    "Estado, tipo de estudio y fechas aplican a informes. Incluí informes o quitá esos filtros.",
  "Tipo de búsqueda inválido": (surface) =>
    `Ese tipo no existe. Probá type:${surface === "admin" ? "informe, type:token, type:seguimiento, type:clinica o type:usuario" : "informe, type:token o type:seguimiento"}.`,
  "El tipo de búsqueda no está disponible aquí": () =>
    "Ese tipo no está disponible en esta búsqueda o contradice el filtro de categoría. Quitá type: o cambiá la categoría.",
  "La búsqueda requiere al menos un término": () =>
    "Agregá una palabra además del operador, por ejemplo type:informe luna.",
  "Demasiados términos de búsqueda": () => "Usaste demasiados términos. Dejá hasta 8 palabras o frases.",
  "Demasiadas alternativas OR en la búsqueda": () => "Usaste demasiados OR. Dejá hasta 4 alternativas.",
};

/**
 * Readable guidance for a syntax rejection, or `null` when the 400 message is
 * not one of the query language (those keep the generic invalid text).
 */
export function describeGlobalSearchSyntaxError(surface: GlobalSearchSurface, serverMessage: string): string | null {
  const unknown = OPERATOR_UNKNOWN.exec(serverMessage);
  if (unknown) {
    return `«${unknown[1]}:» no es un operador. Usá type:, title:, status:, study:, after:, before: o clinic:, o poné el texto entre comillas para buscarlo tal cual.`;
  }
  const contradictory = FILTERS_CONTRADICTORY.exec(serverMessage);
  if (contradictory) {
    return `Escribiste «${contradictory[1]}:» con dos valores distintos. Dejá uno solo.`;
  }
  return SYNTAX_MESSAGES[serverMessage]?.(surface) ?? null;
}

/** Most recent searches shown on an empty focused field. */
export const GLOBAL_SEARCH_RECENT_LIMIT = 5;

/**
 * Recent searches per surface, with the same lifetime and the same reason as
 * `SESSION_MEMORY`: memory only, never browser storage, dropped by the logout
 * reload. Most recent first, folded duplicates collapse onto the newest.
 */
const RECENT_MEMORY = new Map<GlobalSearchSurface, readonly string[]>();

export function readGlobalSearchRecent(surface: GlobalSearchSurface): readonly string[] {
  return RECENT_MEMORY.get(surface) ?? [];
}

export function rememberGlobalSearchQuery(surface: GlobalSearchSurface, value: string): readonly string[] {
  const query = normalizeGlobalSearchInput(value);
  const current = readGlobalSearchRecent(surface);
  if (!isGlobalSearchQueryReady(query)) return current;
  const folded = foldGlobalSearchText(query);
  const next = [query, ...current.filter((entry) => foldGlobalSearchText(entry) !== folded)].slice(
    0,
    GLOBAL_SEARCH_RECENT_LIMIT,
  );
  RECENT_MEMORY.set(surface, next);
  return next;
}

/** `/` focuses the search unless the user is already typing somewhere else. */
export function isGlobalSearchFocusShortcut(event: {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly targetEditable: boolean;
}): boolean {
  return event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.targetEditable;
}

export function globalSearchKindsFor(surface: GlobalSearchSurface): readonly GlobalSearchKind[] {
  return surface === "admin" ? ADMIN_GLOBAL_SEARCH_KINDS : CLINIC_GLOBAL_SEARCH_KINDS;
}

export function globalSearchPathFor(surface: GlobalSearchSurface): string {
  return surface === "admin" ? "/api/admin/search" : "/api/search";
}

/** Saved searches (`?sq=`): the surface's own endpoint, `POST /` to save and `GET /:id` to read. */
export function globalSearchStatesPathFor(surface: GlobalSearchSurface): string {
  return surface === "admin" ? "/api/admin/search/states" : "/api/search/states";
}

/** A saved search as the server stores it: the canonical text and the category. */
export type GlobalSearchSavedState = {
  readonly q: string;
  readonly kinds: readonly GlobalSearchKind[];
};

const KIND_LABELS: Readonly<Record<GlobalSearchKind, string>> = {
  clinic: "Clínicas",
  report: "Informes",
  particular_token: "Tokens particulares",
  tracking_case: "Seguimientos",
  clinic_user: "Usuarios de clínica",
};

const KIND_SINGULAR_LABELS: Readonly<Record<GlobalSearchKind, string>> = {
  clinic: "Clínica",
  report: "Informe",
  particular_token: "Token particular",
  tracking_case: "Seguimiento",
  clinic_user: "Usuario de clínica",
};

export function globalSearchKindLabel(kind: GlobalSearchKind): string {
  return KIND_LABELS[kind];
}

export function globalSearchKindSingularLabel(kind: GlobalSearchKind): string {
  return KIND_SINGULAR_LABELS[kind];
}

const STATUS_LABELS: Readonly<Partial<Record<GlobalSearchKind, Readonly<Record<string, string>>>>> = {
  report: { uploaded: "Cargado", processing: "En proceso", ready: "Listo", delivered: "Entregado" },
  particular_token: { active: "Activo", inactive: "Inactivo" },
  tracking_case: {
    reception: "Recepción de muestra",
    processing: "Procesamiento",
    evaluation: "Evaluación",
    report_development: "Desarrollo de informe",
    delivered: "Informe disponible",
  },
  clinic_user: { clinic_owner: "Titular", clinic_staff: "Equipo" },
};

export function globalSearchStatusLabel(kind: GlobalSearchKind, status: string | null): string | null {
  if (!status) return null;
  return STATUS_LABELS[kind]?.[status] ?? status;
}

export const GLOBAL_SEARCH_REPORT_STATUS_OPTIONS: readonly {
  readonly value: GlobalSearchReportStatus;
  readonly label: string;
}[] = GLOBAL_SEARCH_REPORT_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS.report?.[value] ?? value,
}));

export const GLOBAL_SEARCH_STUDY_TYPE_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
  ...STUDY_TYPE_LABELS,
].map(([value, label]) => ({ value, label }));

const FACT_LABELS: Readonly<Record<string, string>> = {
  studyType: "Tipo de estudio",
  species: "Especie",
  tokenLast4: "Token",
  estimatedDeliveryAt: "Entrega estimada",
};

function formatIsoDay(value: string): string {
  const day = value.slice(0, 10);
  const [year, month, date] = day.split("-");
  return year && month && date ? `${date}/${month}/${year}` : value;
}

export function formatGlobalSearchDate(value: string | null): string | null {
  return value ? formatIsoDay(value) : null;
}

export function formatGlobalSearchFact(fact: GlobalSearchFact): GlobalSearchFact {
  const label = FACT_LABELS[fact.label] ?? fact.label;
  if (fact.label === "studyType") {
    return { label, value: STUDY_TYPE_LABELS.get(fact.value) ?? fact.value };
  }
  if (fact.label === "tokenLast4") return { label, value: `•••• ${fact.value}` };
  if (fact.label === "estimatedDeliveryAt") return { label, value: formatIsoDay(fact.value) };
  return { label, value: fact.value };
}

/** Accent- and case-insensitive fold, shared with the module shortcuts. */
export function foldGlobalSearchText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function normalizeGlobalSearchInput(value: string): string {
  return collapseGlobalSearchText(value).slice(0, GLOBAL_SEARCH_MAX_QUERY);
}

export function isGlobalSearchQueryReady(value: string): boolean {
  return normalizeGlobalSearchInput(value).length >= GLOBAL_SEARCH_MIN_QUERY;
}

/**
 * A search can run with words of its own or with filters alone (`status:ready`,
 * the «Estado» select with no words): filter-only searches are valid.
 */
export function isGlobalSearchRequestReady(
  surface: GlobalSearchSurface,
  query: string,
  filters: GlobalSearchFilters,
): boolean {
  return isGlobalSearchQueryReady(query) || hasGlobalSearchFilterOperators(surface, query, filters);
}

/** Parses the answer of `GET /states/:id`; `null` when it is not a saved search. */
export function readGlobalSearchSavedState(
  surface: GlobalSearchSurface,
  body: { readonly q?: unknown; readonly kinds?: unknown },
): GlobalSearchSavedState | null {
  if (typeof body.q !== "string" || body.q.length === 0 || body.q.length > GLOBAL_SEARCH_MAX_QUERY) return null;
  const allowed = new Set<string>(globalSearchKindsFor(surface));
  const kinds =
    typeof body.kinds === "string" && body.kinds
      ? body.kinds.split(",").filter((kind): kind is GlobalSearchKind => allowed.has(kind))
      : [];
  return { q: body.q, kinds: [...new Set(kinds)] };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_ID = /^[1-9]\d{0,8}$/;

/** Report-only filters narrow the search to reports, exactly like the API. */
export function hasGlobalSearchReportFilters(filters: GlobalSearchFilters): boolean {
  return Boolean(filters.status || filters.studyType || filters.from || filters.to);
}

export type GlobalSearchFilterKey = "status" | "studyType" | "from" | "to" | "clinicId";

export type GlobalSearchFilterChip = { readonly key: GlobalSearchFilterKey; readonly label: string };

/** Applied filters as removable chips, in the order of the filters panel. */
export function describeGlobalSearchFilterChips(
  surface: GlobalSearchSurface,
  filters: GlobalSearchFilters,
): readonly GlobalSearchFilterChip[] {
  const chips: GlobalSearchFilterChip[] = [];
  if (filters.status) {
    chips.push({ key: "status", label: globalSearchStatusLabel("report", filters.status) ?? filters.status });
  }
  if (filters.studyType) {
    chips.push({ key: "studyType", label: STUDY_TYPE_LABELS.get(filters.studyType) ?? filters.studyType });
  }
  if (ISO_DAY.test(filters.from)) chips.push({ key: "from", label: `Desde ${formatIsoDay(filters.from)}` });
  if (ISO_DAY.test(filters.to)) chips.push({ key: "to", label: `Hasta ${formatIsoDay(filters.to)}` });
  if (surface === "admin" && POSITIVE_ID.test(filters.clinicId)) {
    chips.push({ key: "clinicId", label: `Clínica #${filters.clinicId}` });
  }
  return chips;
}

export function clearGlobalSearchFilter(
  filters: GlobalSearchFilters,
  key: GlobalSearchFilterKey,
): GlobalSearchFilters {
  return { ...filters, [key]: EMPTY_GLOBAL_SEARCH_FILTERS[key] };
}

export function buildGlobalSearchQueryString(
  surface: GlobalSearchSurface,
  request: GlobalSearchRequest,
): string {
  const params = new URLSearchParams();
  // One model: the words and every filter travel as the canonical `q`; only
  // the category (`kinds`) and the paging stay as their own parameters.
  const resolved = resolveGlobalSearchQuery(surface, request.query, request.filters);
  params.set("q", resolved.text);

  const kinds = resolveGlobalSearchRequestKinds(surface, resolved.filters);
  const continuation = isGlobalSearchContinuation(request);
  if (continuation) {
    // A cursor continues exactly one kind; anything else is a caller bug the
    // API would reject, so it never leaves the client.
    if (kinds.length !== 1) throw new Error("El cursor de búsqueda requiere un único tipo de entidad.");
    if (!request.cursor || request.cursor.length > GLOBAL_SEARCH_MAX_CURSOR_LENGTH) {
      throw new Error("Cursor de búsqueda fuera de contrato.");
    }
  }
  if (kinds.length > 0) params.set("kinds", kinds.join(","));

  params.set("limit", String(request.limit));
  if (continuation) {
    params.set("cursor", request.cursor);
  } else if (request.offset > 0) {
    params.set("offset", String(Math.min(request.offset, GLOBAL_SEARCH_MAX_OFFSET)));
  }
  return params.toString();
}

/** The kinds a request actually searches: report filters narrow to reports, like the API. */
export function resolveGlobalSearchRequestKinds(
  surface: GlobalSearchSurface,
  filters: GlobalSearchFilters,
): readonly GlobalSearchKind[] {
  if (hasGlobalSearchReportFilters(filters)) return ["report"];
  const allowed = new Set(globalSearchKindsFor(surface));
  return filters.kinds.filter((kind) => allowed.has(kind));
}

export function globalSearchHitKey(hit: Pick<GlobalSearchHit, "kind" | "id">): string {
  return `${hit.kind}:${hit.id}`;
}

export type GlobalSearchHitGroup = {
  readonly kind: GlobalSearchKind;
  readonly hits: readonly GlobalSearchHit[];
  readonly hasMore: boolean;
};

/** Groups ranked hits by kind, in the surface's canonical kind order. */
export function groupGlobalSearchHits(
  surface: GlobalSearchSurface,
  result: GlobalSearchResult,
): readonly GlobalSearchHitGroup[] {
  const groups: GlobalSearchHitGroup[] = [];
  for (const kind of globalSearchKindsFor(surface)) {
    const hits = result.hits.filter((hit) => hit.kind === kind);
    const hasMore = result.groups.some((group) => group.kind === kind && group.hasMore);
    if (hits.length > 0) groups.push({ kind, hits, hasMore });
  }
  return groups;
}

/** Query parameter both report modules read to open one report by id. */
export const GLOBAL_SEARCH_REPORT_ID_PARAM = "reportId";

/**
 * Where a hit lives inside its module.
 *
 * Reports (and tracking cases linked to one) carry `?reportId=`: the module
 * resolves that id through the authorized by-id read (`GET /api/reports/:id`,
 * `GET /api/admin/report-workflow/:id`) and opens it even when it is not on
 * the loaded page. The other entities have no by-id read yet: they land on
 * their module with the row anchor, which positions the row only when the
 * loaded page holds it.
 */
export function buildGlobalSearchDestination(
  surface: GlobalSearchSurface,
  hit: GlobalSearchHit,
): string {
  const reportId = hit.target.reportId;

  if (surface === "clinic") {
    if (hit.kind === "particular_token") {
      return `${ROUTES.dashboard}?module=tokens#clinic-particular-token-${hit.id}`;
    }
    return reportId
      ? `${ROUTES.dashboardInformes}?${GLOBAL_SEARCH_REPORT_ID_PARAM}=${reportId}`
      : ROUTES.dashboardInformes;
  }

  switch (hit.kind) {
    case "clinic":
      return `${ROUTES.dashboardAdmin}?module=admin-clinics`;
    case "clinic_user":
      return `${ROUTES.dashboardAdmin}?module=admin-users-roles`;
    case "particular_token":
      return `${ROUTES.dashboardAdmin}?module=admin-particular-tokens#admin-particular-token-${hit.id}`;
    case "report":
    case "tracking_case":
    default:
      return reportId
        ? `${ROUTES.dashboardAdmin}?module=admin-report-upload&${GLOBAL_SEARCH_REPORT_ID_PARAM}=${reportId}`
        : `${ROUTES.dashboardAdmin}?module=admin-report-upload`;
  }
}

/** Whether the destination opens one record by id (vs. a module landing). */
export function globalSearchDestinationOpensRecord(destination: string): boolean {
  const query = destination.split("#")[0].split("?")[1];
  return query ? new URLSearchParams(query).has(GLOBAL_SEARCH_REPORT_ID_PARAM) : false;
}

export function globalSearchDestinationModule(destination: string): string | null {
  const query = destination.split("#")[0].split("?")[1];
  return query ? new URLSearchParams(query).get("module") : null;
}
