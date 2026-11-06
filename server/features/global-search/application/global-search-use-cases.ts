import {
  ADMIN_GLOBAL_SEARCH_KINDS,
  CLINIC_GLOBAL_SEARCH_KINDS,
  decodeGlobalSearchCursor,
  encodeGlobalSearchCursor,
  mergeGlobalSearchHits,
  parseGlobalSearchQuery,
  type AdminGlobalSearchKind,
  type ClinicGlobalSearchKind,
  type GlobalSearchCriteria,
  type GlobalSearchCursorContext,
  type GlobalSearchHit,
  type GlobalSearchParseError,
  type GlobalSearchResult,
} from "../domain/index.ts";

/**
 * One row of an entity page: the hit returned to the client and the exact
 * sort key (`timestamp::text`) the keyset cursor needs. The sort key never
 * leaves the server except inside a signed cursor.
 */
export type GlobalSearchRow = {
  readonly hit: GlobalSearchHit;
  readonly sortKey: string;
};

/**
 * Tenant scope is a REQUIRED argument of every clinic port: the clinic id is
 * resolved by the route from the authenticated session and there is no port
 * signature through which an unscoped clinic search could be expressed.
 * Each port returns at most `criteria.limit + 1` rows (the extra row only
 * signals `hasMore`; no COUNT query runs), strictly after `criteria.after`
 * when it is set.
 */
export type ClinicGlobalSearchRepository = {
  readonly [K in ClinicGlobalSearchKind]: (
    clinicId: number,
    criteria: GlobalSearchCriteria,
  ) => Promise<GlobalSearchRow[]>;
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
  ) => Promise<GlobalSearchRow[]>;
};

/** Cursor signing; without a key the search still works and offers no cursor. */
export type GlobalSearchCursorOptions = {
  readonly cursorKey?: Uint8Array;
  readonly now?: () => number;
};

export type GlobalSearchOutcome =
  | { readonly ok: true; readonly result: GlobalSearchResult }
  | GlobalSearchParseError;

const INVALID_CURSOR: GlobalSearchParseError = {
  ok: false,
  status: 400,
  error: "Cursor de búsqueda inválido",
};

type ScopeContext = Omit<GlobalSearchCursorContext, "kind" | "criteria">;

async function runSearch<TKind extends AdminGlobalSearchKind>(
  kinds: readonly TKind[],
  criteria: GlobalSearchCriteria,
  scope: ScopeContext,
  options: GlobalSearchCursorOptions,
  fetchKind: (kind: TKind, criteria: GlobalSearchCriteria) => Promise<GlobalSearchRow[]>,
): Promise<GlobalSearchOutcome> {
  const nowSeconds = (options.now?.() ?? Date.now()) / 1000;
  let effective = criteria;

  if (criteria.cursor !== null) {
    // The parser guarantees exactly one kind together with a cursor.
    const after = options.cursorKey
      ? decodeGlobalSearchCursor(
          criteria.cursor,
          { ...scope, kind: kinds[0], criteria },
          options.cursorKey,
          nowSeconds,
        )
      : null;
    if (!after) return INVALID_CURSOR;
    effective = { ...criteria, after };
  }

  const pages = await Promise.all(
    kinds.map(async (kind) => ({ kind, rows: await fetchKind(kind, effective) })),
  );

  const nextCursors = new Map<AdminGlobalSearchKind, string | null>();
  for (const { kind, rows } of pages) {
    const last = rows.length > effective.limit ? rows[effective.limit - 1] : undefined;
    nextCursors.set(
      kind,
      last && options.cursorKey
        ? encodeGlobalSearchCursor(
            { rank: last.hit.rank, sortKey: last.sortKey, id: last.hit.id },
            { ...scope, kind, criteria },
            options.cursorKey,
            nowSeconds,
          )
        : null,
    );
  }

  const { hits, groups } = mergeGlobalSearchHits(
    pages.map(({ kind, rows }) => ({ kind, rows: rows.map((row) => row.hit) })),
    effective.limit,
  );

  return {
    ok: true,
    result: {
      query: criteria.needle.text,
      hits,
      groups: groups.map((group) => ({ ...group, nextCursor: nextCursors.get(group.kind) ?? null })),
      limit: criteria.limit,
      offset: criteria.offset,
    },
  };
}

export function createClinicGlobalSearch(
  repository: ClinicGlobalSearchRepository,
  options: GlobalSearchCursorOptions = {},
) {
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

    return runSearch(
      parsed.kinds,
      parsed.criteria,
      { surface: "clinic", tenant: sessionClinicId },
      options,
      (kind, criteria) => repository[kind](sessionClinicId, criteria),
    );
  };
}

export function createAdminGlobalSearch(
  repository: AdminGlobalSearchRepository,
  options: GlobalSearchCursorOptions = {},
) {
  return async function searchAdmin(
    query: Record<string, unknown>,
    clinicFilter: number | null,
  ): Promise<GlobalSearchOutcome> {
    const parsed = parseGlobalSearchQuery(query, ADMIN_GLOBAL_SEARCH_KINDS);

    if (!parsed.ok) {
      return parsed;
    }

    return runSearch(
      parsed.kinds,
      parsed.criteria,
      { surface: "admin", tenant: clinicFilter },
      options,
      (kind, criteria) => repository[kind](criteria, clinicFilter),
    );
  };
}
