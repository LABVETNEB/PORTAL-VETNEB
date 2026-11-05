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
export const GLOBAL_SEARCH_MAX_QUERY = 80;
export const GLOBAL_SEARCH_SUGGESTION_LIMIT = 5;
export const GLOBAL_SEARCH_PAGE_SIZE = 20;
export const GLOBAL_SEARCH_MAX_OFFSET = 500;
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

export type GlobalSearchRequest = {
  readonly query: string;
  readonly filters: GlobalSearchFilters;
  readonly limit: number;
  readonly offset: number;
};

export function globalSearchKindsFor(surface: GlobalSearchSurface): readonly GlobalSearchKind[] {
  return surface === "admin" ? ADMIN_GLOBAL_SEARCH_KINDS : CLINIC_GLOBAL_SEARCH_KINDS;
}

export function globalSearchPathFor(surface: GlobalSearchSurface): string {
  return surface === "admin" ? "/api/admin/search" : "/api/search";
}

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
  return value.replace(/\s+/g, " ").trim().slice(0, GLOBAL_SEARCH_MAX_QUERY);
}

export function isGlobalSearchQueryReady(value: string): boolean {
  return normalizeGlobalSearchInput(value).length >= GLOBAL_SEARCH_MIN_QUERY;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_ID = /^[1-9]\d{0,8}$/;

/** Report-only filters narrow the search to reports, exactly like the API. */
export function hasGlobalSearchReportFilters(filters: GlobalSearchFilters): boolean {
  return Boolean(filters.status || filters.studyType || filters.from || filters.to);
}

export function buildGlobalSearchQueryString(
  surface: GlobalSearchSurface,
  request: GlobalSearchRequest,
): string {
  const params = new URLSearchParams();
  params.set("q", normalizeGlobalSearchInput(request.query));

  const allowed = new Set(globalSearchKindsFor(surface));
  const kinds = hasGlobalSearchReportFilters(request.filters)
    ? (["report"] as const)
    : request.filters.kinds.filter((kind) => allowed.has(kind));
  if (kinds.length > 0) params.set("kinds", kinds.join(","));

  const { status, studyType, from, to, clinicId } = request.filters;
  if (status) params.set("status", status);
  if (studyType) params.set("studyType", studyType);
  if (ISO_DAY.test(from)) params.set("from", from);
  if (ISO_DAY.test(to)) params.set("to", to);
  if (surface === "admin" && POSITIVE_ID.test(clinicId)) params.set("clinicId", clinicId);

  params.set("limit", String(request.limit));
  if (request.offset > 0) params.set("offset", String(Math.min(request.offset, GLOBAL_SEARCH_MAX_OFFSET)));
  return params.toString();
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

/**
 * Where a hit lives inside its module. The anchor ids are the ones the module
 * rows already render (the same ones `buildNotificationDestination` targets).
 */
export function buildGlobalSearchDestination(
  surface: GlobalSearchSurface,
  hit: GlobalSearchHit,
): string {
  const reportAnchor = hit.target.reportId ? `#report-${hit.target.reportId}` : "";

  if (surface === "clinic") {
    switch (hit.kind) {
      case "particular_token":
        return `${ROUTES.dashboard}?module=tokens#clinic-particular-token-${hit.id}`;
      case "report":
      case "tracking_case":
      default:
        return `${ROUTES.dashboardInformes}${reportAnchor}`;
    }
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
      return `${ROUTES.dashboardAdmin}?module=admin-report-upload${reportAnchor}`;
  }
}

export function globalSearchDestinationModule(destination: string): string | null {
  const query = destination.split("#")[0].split("?")[1];
  return query ? new URLSearchParams(query).get("module") : null;
}
