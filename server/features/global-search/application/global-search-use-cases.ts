import {
  ADMIN_GLOBAL_SEARCH_KINDS,
  CLINIC_GLOBAL_SEARCH_KINDS,
  mergeGlobalSearchHits,
  parseGlobalSearchQuery,
  type AdminGlobalSearchKind,
  type ClinicGlobalSearchKind,
  type GlobalSearchCriteria,
  type GlobalSearchHit,
  type GlobalSearchParseError,
  type GlobalSearchResult,
} from "../domain/index.ts";

/**
 * Tenant scope is a REQUIRED argument of every clinic port: the clinic id is
 * resolved by the route from the authenticated session and there is no port
 * signature through which an unscoped clinic search could be expressed.
 * Each port returns at most `criteria.limit + 1` rows (the extra row only
 * signals `hasMore`; no COUNT query runs).
 */
export type ClinicGlobalSearchRepository = {
  readonly [K in ClinicGlobalSearchKind]: (
    clinicId: number,
    criteria: GlobalSearchCriteria,
  ) => Promise<GlobalSearchHit[]>;
};

/**
 * Admin ports take an optional clinic filter. It narrows, it never grants:
 * the admin session already reads every clinic through the existing
 * `/api/admin/*` surfaces.
 */
export type AdminGlobalSearchRepository = {
  readonly [K in AdminGlobalSearchKind]: (
    criteria: GlobalSearchCriteria,
    clinicId: number | null,
  ) => Promise<GlobalSearchHit[]>;
};

export type GlobalSearchOutcome =
  | { readonly ok: true; readonly result: GlobalSearchResult }
  | GlobalSearchParseError;

function buildResult(
  criteria: GlobalSearchCriteria,
  pages: ReadonlyArray<{ kind: AdminGlobalSearchKind; rows: GlobalSearchHit[] }>,
): GlobalSearchResult {
  const { hits, groups } = mergeGlobalSearchHits(pages, criteria.limit);

  return {
    query: criteria.needle.text,
    hits,
    groups,
    limit: criteria.limit,
    offset: criteria.offset,
  };
}

export function createClinicGlobalSearch(repository: ClinicGlobalSearchRepository) {
  return async function searchClinic(
    sessionClinicId: number,
    query: Record<string, unknown>,
  ): Promise<GlobalSearchOutcome> {
    if (!Number.isSafeInteger(sessionClinicId) || sessionClinicId <= 0) {
      throw new Error("Clinic global search requires an authenticated clinic scope");
    }

    const parsed = parseGlobalSearchQuery(query, CLINIC_GLOBAL_SEARCH_KINDS);

    if (!parsed.ok) {
      return parsed;
    }

    const pages = await Promise.all(
      parsed.kinds.map(async (kind) => ({
        kind,
        rows: await repository[kind](sessionClinicId, parsed.criteria),
      })),
    );

    return { ok: true, result: buildResult(parsed.criteria, pages) };
  };
}

export function createAdminGlobalSearch(repository: AdminGlobalSearchRepository) {
  return async function searchAdmin(
    query: Record<string, unknown>,
    clinicFilter: number | null,
  ): Promise<GlobalSearchOutcome> {
    const parsed = parseGlobalSearchQuery(query, ADMIN_GLOBAL_SEARCH_KINDS);

    if (!parsed.ok) {
      return parsed;
    }

    const pages = await Promise.all(
      parsed.kinds.map(async (kind) => ({
        kind,
        rows: await repository[kind](parsed.criteria, clinicFilter),
      })),
    );

    return { ok: true, result: buildResult(parsed.criteria, pages) };
  };
}
