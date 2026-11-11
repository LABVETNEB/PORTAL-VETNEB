import {
  GLOBAL_SEARCH_STATE_UNAVAILABLE_ERROR,
  isGlobalSearchStateId,
  parseGlobalSearchStateBody,
  type GlobalSearchStateOwner,
  type GlobalSearchStateRecord,
} from "../domain/index.ts";

export type GlobalSearchStateRepository = {
  /**
   * Stores (or reuses) a state for the owning session and returns its id, or
   * null when that session no longer exists or has expired. Enforces the
   * per-session cap under a per-session lock.
   */
  save(owner: GlobalSearchStateOwner, record: GlobalSearchStateRecord, nowMs: number): Promise<{ id: string } | null>;
  /** The record only if it is unexpired AND belongs to exactly this session and surface. */
  find(owner: GlobalSearchStateOwner, id: string, nowMs: number): Promise<GlobalSearchStateRecord | null>;
};

export type GlobalSearchStateOutcome<T> =
  | { readonly ok: true; readonly result: T }
  | { readonly ok: false; readonly status: 400 | 404; readonly error: string };

const UNAVAILABLE = {
  ok: false,
  status: 404,
  error: GLOBAL_SEARCH_STATE_UNAVAILABLE_ERROR,
} as const;

/**
 * Missing, malformed, expired, foreign (other session, user, clinic or
 * surface) states all answer the same 404: the id never grants anything and
 * its existence is not disclosed.
 */
export function createGlobalSearchStates(
  repository: GlobalSearchStateRepository,
  allowedKinds: readonly string[],
  now: () => number = () => Date.now(),
) {
  return {
    async save(owner: GlobalSearchStateOwner, body: unknown): Promise<GlobalSearchStateOutcome<{ id: string }>> {
      const parsed = parseGlobalSearchStateBody(body, allowedKinds);
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      const saved = await repository.save(owner, parsed.record, now());
      return saved ? { ok: true, result: saved } : UNAVAILABLE;
    },
    async load(owner: GlobalSearchStateOwner, id: unknown): Promise<GlobalSearchStateOutcome<GlobalSearchStateRecord>> {
      if (!isGlobalSearchStateId(id)) return UNAVAILABLE;
      const found = await repository.find(owner, id, now());
      return found ? { ok: true, result: found } : UNAVAILABLE;
    },
  };
}
