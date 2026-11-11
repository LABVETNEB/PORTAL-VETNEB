import { ADMIN_GLOBAL_SEARCH_KINDS, GLOBAL_SEARCH_MAX_QUERY_LENGTH } from "./global-search.ts";
import { parseGlobalSearchLanguage } from "./global-search-query.ts";

/** GLOBAL-SEARCH-DRIVE-A4: opaque, session-bound, short-lived saved searches. */
export const GLOBAL_SEARCH_STATE_TTL_MS = 24 * 60 * 60 * 1000;
export const GLOBAL_SEARCH_STATE_MAX_PER_SESSION = 20;
export const GLOBAL_SEARCH_STATE_UNAVAILABLE_ERROR = "Búsqueda guardada no disponible";
export const GLOBAL_SEARCH_STATE_INVALID_ERROR = "Búsqueda guardada inválida";

const STATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isGlobalSearchStateId(value: unknown): value is string {
  return typeof value === "string" && STATE_ID.test(value);
}

export type GlobalSearchStateOwner = {
  readonly surface: "clinic" | "admin";
  /** SHA-256 of the session cookie of the authenticated surface. */
  readonly sessionTokenHash: string;
};

export type GlobalSearchStateRecord = {
  readonly queryText: string;
  readonly kinds: string | null;
};

export type GlobalSearchStateParse =
  | { readonly ok: true; readonly record: GlobalSearchStateRecord }
  | { readonly ok: false; readonly error: string };

/**
 * The body is the canonical text and the category only: never results, cursors
 * or anything else. The text must be a valid query of its own and the kinds
 * must belong to the surface, so a state can never widen what the caller may
 * search.
 */
export function parseGlobalSearchStateBody(
  body: unknown,
  allowedKinds: readonly string[],
): GlobalSearchStateParse {
  const invalid = { ok: false, error: GLOBAL_SEARCH_STATE_INVALID_ERROR } as const;
  if (!body || typeof body !== "object") return invalid;
  const { q, kinds } = body as { q?: unknown; kinds?: unknown };
  if (typeof q !== "string") return invalid;
  const text = q.replace(/\s+/g, " ").trim();
  if (!text || text.length > GLOBAL_SEARCH_MAX_QUERY_LENGTH) return invalid;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return invalid;
  }
  if (!parseGlobalSearchLanguage(text).ok) return invalid;

  let normalizedKinds: string | null = null;
  if (kinds !== undefined && kinds !== null && kinds !== "") {
    if (typeof kinds !== "string") return invalid;
    const list = kinds.split(",");
    const known = new Set<string>(ADMIN_GLOBAL_SEARCH_KINDS);
    if (
      list.length > ADMIN_GLOBAL_SEARCH_KINDS.length ||
      list.some((kind) => !known.has(kind) || !allowedKinds.includes(kind)) ||
      new Set(list).size !== list.length
    ) {
      return invalid;
    }
    normalizedKinds = list.join(",");
  }
  return { ok: true, record: { queryText: text, kinds: normalizedKinds } };
}

/** min(24 h, remaining session lifetime); null when the session is already over. */
export function resolveGlobalSearchStateExpiry(nowMs: number, sessionExpiresAt: Date | null): Date | null {
  const ttl = nowMs + GLOBAL_SEARCH_STATE_TTL_MS;
  const expiresMs = sessionExpiresAt ? Math.min(ttl, sessionExpiresAt.getTime()) : ttl;
  return expiresMs > nowMs ? new Date(expiresMs) : null;
}
