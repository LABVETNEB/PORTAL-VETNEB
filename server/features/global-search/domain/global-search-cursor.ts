import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import type { GlobalSearchCriteria, GlobalSearchKind } from "./global-search.ts";

/**
 * GLOBAL-SEARCH-3A · opaque keyset cursor of one entity stream.
 *
 * A cursor names the last row a client received, in the entity's own total
 * order (`rank` ASC, sort timestamp DESC, `id` DESC): the next page is every
 * row strictly after it. It carries position only — rank, the exact sort
 * timestamp as PostgreSQL prints it, the row id and an expiry — never a name,
 * a query text or any clinical value.
 *
 * It is bound to its search context by an HMAC computed over the payload AND
 * the context (surface, session tenant, admin clinic filter, entity, query and
 * filters), so the context itself never travels in the token: a cursor minted
 * for another clinic, query, filter or entity fails verification, and any
 * edit of the position does too. The cursor grants nothing: tenant and filters
 * are always re-applied from the session and the request.
 */

export const GLOBAL_SEARCH_CURSOR_VERSION = "v1";
/** Cursors are short-lived navigation state, not bookmarks. */
export const GLOBAL_SEARCH_CURSOR_TTL_SECONDS = 2 * 60 * 60;
export const GLOBAL_SEARCH_CURSOR_MAX_LENGTH = 512;

/** Last row of a page, in the entity's sort key. */
export type GlobalSearchPosition = {
  readonly rank: number;
  /** `timestamp::text` of the entity's sort column, microsecond-exact. */
  readonly sortKey: string;
  readonly id: number;
};

export type GlobalSearchCursorContext = {
  readonly surface: "clinic" | "admin";
  /** Session clinic (clinic surface) or admin clinic filter (`null` = all). */
  readonly tenant: number | null;
  readonly kind: GlobalSearchKind;
  readonly criteria: GlobalSearchCriteria;
};

const SORT_KEY_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;
const TOKEN_PATTERN = /^v1\.([A-Za-z0-9_-]{1,400})\.([A-Za-z0-9_-]{43})$/;
const MAX_ID = 2_147_483_647;
const CLOCK_SKEW_SECONDS = 60;

/**
 * Purpose-bound HMAC key derived (HKDF-SHA256) from a server-only secret, so
 * the secret itself is never used as a MAC key and no new configuration is
 * needed. Rotating the secret only invalidates live cursors.
 */
export function deriveGlobalSearchCursorKey(serverSecret: string): Uint8Array {
  if (!serverSecret) {
    throw new Error("Global search cursors require a server secret");
  }
  return new Uint8Array(
    hkdfSync("sha256", serverSecret, "vetneb.global-search", `cursor/${GLOBAL_SEARCH_CURSOR_VERSION}`, 32),
  );
}

function contextString(context: GlobalSearchCursorContext): string {
  const { criteria } = context;
  return JSON.stringify([
    "vetneb.global-search.cursor",
    GLOBAL_SEARCH_CURSOR_VERSION,
    context.surface,
    context.tenant,
    context.kind,
    criteria.needle.text,
    criteria.reportStatus,
    criteria.studyType,
    criteria.createdFrom?.toISOString() ?? null,
    criteria.createdTo?.toISOString() ?? null,
  ]);
}

function sign(payload: string, context: GlobalSearchCursorContext, key: Uint8Array): Buffer {
  return createHmac("sha256", key).update(`${GLOBAL_SEARCH_CURSOR_VERSION}.${payload}\n${contextString(context)}`).digest();
}

function isPosition(value: unknown): value is GlobalSearchPosition {
  if (!value || typeof value !== "object") return false;
  const { rank, sortKey, id } = value as Record<string, unknown>;
  return (
    Number.isInteger(rank) &&
    (rank as number) >= 0 &&
    (rank as number) <= 3 &&
    typeof sortKey === "string" &&
    SORT_KEY_PATTERN.test(sortKey) &&
    Number.isInteger(id) &&
    (id as number) > 0 &&
    (id as number) <= MAX_ID
  );
}

export function encodeGlobalSearchCursor(
  position: GlobalSearchPosition,
  context: GlobalSearchCursorContext,
  key: Uint8Array,
  nowSeconds: number,
): string {
  if (!isPosition(position)) {
    throw new Error("Invalid global search cursor position");
  }
  const payload = Buffer.from(
    JSON.stringify({
      k: context.kind,
      r: position.rank,
      t: position.sortKey,
      i: position.id,
      e: Math.floor(nowSeconds) + GLOBAL_SEARCH_CURSOR_TTL_SECONDS,
    }),
  ).toString("base64url");
  return `${GLOBAL_SEARCH_CURSOR_VERSION}.${payload}.${sign(payload, context, key).toString("base64url")}`;
}

/**
 * The position of a valid cursor for exactly this context, or `null`: an
 * unknown version, a malformed token, a forged or edited payload, a cursor of
 * another context or an expired one are all the same rejection.
 */
export function decodeGlobalSearchCursor(
  token: unknown,
  context: GlobalSearchCursorContext,
  key: Uint8Array,
  nowSeconds: number,
): GlobalSearchPosition | null {
  if (typeof token !== "string" || token.length > GLOBAL_SEARCH_CURSOR_MAX_LENGTH) return null;
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return null;
  const [, payload, mac] = match;

  const expected = sign(payload, context, key);
  const received = Buffer.from(mac, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== "object") return null;
  const { k, r, t, i, e } = decoded as Record<string, unknown>;
  if (k !== context.kind || !Number.isInteger(e)) return null;
  const now = Math.floor(nowSeconds);
  if ((e as number) < now || (e as number) > now + GLOBAL_SEARCH_CURSOR_TTL_SECONDS + CLOCK_SKEW_SECONDS) {
    return null;
  }
  const position = { rank: r, sortKey: t, id: i };
  return isPosition(position) ? position : null;
}
