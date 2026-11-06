import type { FastifyReply } from "fastify";

import { logError, serializeError } from "./logger.ts";
import { consumeRateLimitAttempt, type RateLimitStore } from "./rate-limit-store.ts";

/**
 * GLOBAL-SEARCH-3C: server budget of `GET /api/search` and
 * `GET /api/admin/search`.
 *
 * The unit is one entity query: a request costs as many units as entity kinds
 * it will run (a bar suggestion over every kind costs 3 in Clinica and 5 in
 * Admin; a cursor window costs 1). Two fixed windows per actor: a short burst
 * window that lets typing and fast paging through, and a sustained window that
 * caps automation.
 */
export type GlobalSearchRateLimitSurface = "clinic" | "admin";

export type GlobalSearchRateLimitWindow = {
  readonly name: "burst" | "sustained";
  readonly windowMs: number;
  readonly max: number;
};

export const GLOBAL_SEARCH_RATE_LIMIT_KEY_VERSION = "v1";

export const GLOBAL_SEARCH_RATE_LIMIT_POLICY: Readonly<
  Record<GlobalSearchRateLimitSurface, readonly GlobalSearchRateLimitWindow[]>
> = {
  clinic: [
    { name: "burst", windowMs: 10 * 1000, max: 60 },
    { name: "sustained", windowMs: 10 * 60 * 1000, max: 600 },
  ],
  admin: [
    { name: "burst", windowMs: 10 * 1000, max: 100 },
    { name: "sustained", windowMs: 10 * 60 * 1000, max: 1000 },
  ],
};

export const GLOBAL_SEARCH_RATE_LIMIT_ERROR_MESSAGE =
  "Demasiadas búsquedas seguidas. Esperá unos segundos y volvé a intentar.";
export const GLOBAL_SEARCH_RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "La búsqueda no está disponible en este momento. Reintentá en unos segundos.";
export const GLOBAL_SEARCH_RATE_LIMIT_UNAVAILABLE_RETRY_SECONDS = 5;
export const GLOBAL_SEARCH_RATE_LIMIT_EXPOSED_HEADERS =
  "RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After";

/** The validated actor; never a value read from the query string. */
export type GlobalSearchRateLimitActor =
  | { readonly surface: "clinic"; readonly clinicId: number; readonly userId: number }
  | { readonly surface: "admin"; readonly userId: number };

/**
 * One key per actor and window. A user (not a session) is the actor, so other
 * tabs or a second login share the budget. Query text, filters, kinds, the
 * `clinicId` parameter and cursors never take part. The store persists only
 * the SHA-256 of this key.
 */
export function buildGlobalSearchRateLimitKey(
  actor: GlobalSearchRateLimitActor,
  window: GlobalSearchRateLimitWindow["name"],
): string {
  const scope =
    actor.surface === "clinic"
      ? `clinic:${actor.clinicId}:user:${actor.userId}`
      : `admin:user:${actor.userId}`;

  return `global-search:${GLOBAL_SEARCH_RATE_LIMIT_KEY_VERSION}:${scope}:${window}`;
}

type WindowUsage = {
  readonly window: GlobalSearchRateLimitWindow;
  readonly count: number;
  readonly resetAt: number;
};

function secondsUntil(resetAt: number, now: number): number {
  return Math.max(Math.ceil((resetAt - now) / 1000), 0);
}

function setRateLimitHeaders(reply: FastifyReply, usages: readonly WindowUsage[], now: number) {
  const remainingOf = (usage: WindowUsage) => Math.max(usage.window.max - usage.count, 0);
  const tightest = [...usages].sort(
    (a, b) => remainingOf(a) - remainingOf(b) || b.resetAt - a.resetAt,
  )[0];

  reply.header(
    "RateLimit-Policy",
    usages.map((usage) => `${usage.window.max};w=${Math.ceil(usage.window.windowMs / 1000)}`).join(", "),
  );

  if (tightest) {
    reply.header("RateLimit-Limit", String(tightest.window.max));
    reply.header("RateLimit-Remaining", String(remainingOf(tightest)));
    reply.header("RateLimit-Reset", String(secondsUntil(tightest.resetAt, now)));
  }
}

/**
 * Charges the request to every window of its actor, atomically per window and
 * shared by every backend instance, BEFORE any search SQL runs.
 *
 * Returns `true` when the search may run. Otherwise the reply is already sent:
 * 429 with `Retry-After` when a window is exhausted, or 503 when the store
 * cannot be reached (the protection never fails open).
 */
export async function applyGlobalSearchRateLimit(input: {
  /** Resolved inside the guarded block: a store that cannot be built is a store failure. */
  readonly store: () => RateLimitStore | Promise<RateLimitStore>;
  readonly actor: GlobalSearchRateLimitActor;
  /** Entity queries the request will run (`globalSearchQueryUnits`). */
  readonly units: number;
  readonly reply: FastifyReply;
  readonly requestId: string;
  readonly now: number;
}): Promise<boolean> {
  const { store, actor, reply, now } = input;
  const windows = GLOBAL_SEARCH_RATE_LIMIT_POLICY[actor.surface];
  const units = Number.isInteger(input.units) && input.units > 0 ? input.units : 1;

  let usages: WindowUsage[];

  try {
    const resolved = await store();
    usages = await Promise.all(
      windows.map(async (window) => {
        const entry = await consumeRateLimitAttempt(
          resolved,
          buildGlobalSearchRateLimitKey(actor, window.name),
          { windowMs: window.windowMs, now, units },
        );
        return { window, count: entry.count, resetAt: entry.resetAt };
      }),
    );
  } catch (error) {
    logError("GLOBAL_SEARCH_RATE_LIMIT_STORE_ERROR", {
      requestId: input.requestId,
      surface: actor.surface,
      error: serializeError(error),
    });
    reply.header("Retry-After", String(GLOBAL_SEARCH_RATE_LIMIT_UNAVAILABLE_RETRY_SECONDS));
    reply.code(503).send({ success: false, error: GLOBAL_SEARCH_RATE_LIMIT_UNAVAILABLE_MESSAGE });
    return false;
  }

  setRateLimitHeaders(reply, usages, now);

  const exceeded = usages.filter((usage) => usage.count > usage.window.max);

  if (exceeded.length === 0) {
    return true;
  }

  const retryAfter = Math.max(1, ...exceeded.map((usage) => secondsUntil(usage.resetAt, now)));
  reply.header("Retry-After", String(retryAfter));
  reply.code(429).send({ success: false, error: GLOBAL_SEARCH_RATE_LIMIT_ERROR_MESSAGE });
  return false;
}

/** Production adapter: the shared persistent table, without per-request cleanup. */
export async function createDefaultGlobalSearchRateLimitStore(): Promise<RateLimitStore> {
  const db = await import("../db.ts");
  const { createPersistentRateLimitStore } = await import("./rate-limit-store.ts");

  return createPersistentRateLimitStore({
    get: db.getLoginRateLimitEntry,
    set: db.setLoginRateLimitEntry,
    increment: db.incrementLoginRateLimitEntry,
    consume: db.consumeRateLimitUnits,
    delete: db.deleteLoginRateLimitEntry,
  });
}
