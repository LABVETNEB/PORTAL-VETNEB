// What an HTTP cache may do with a served response, read from the response
// itself (RFC 9111). Pure and without imports: the E2E contract applies it to
// what the application serves, and the Node contract in
// test/unit/infrastructure/frontend-next-config-private-cache-headers.test.ts
// applies it to what next.config.ts declares and to mutated policies.

export type CacheKind = "shared" | "private";

export type ServedSurface =
  // Prerendered HTML under a stable URL, identical for every visitor.
  | "public-document"
  // Prerendered HTML that is the entry point of a session.
  | "access-document"
  // The router payload of a document route (React Server Components).
  | "flight"
  // Anything behind a session: documents, redirects towards login, APIs.
  | "private"
  // The URL changes with the bytes.
  | "immutable-asset"
  // The bytes can change under the same URL.
  | "stable-asset"
  // The document sw.js must be able to precache when it installs.
  | "offline-fallback"
  // Any other answer of a document route: a 304, a 404, a dynamic page.
  | "revalidated";

export type ServedResponse = {
  readonly cacheControl?: string | null;
  readonly contentType?: string | null;
  readonly vary?: string | null;
  readonly expires?: string | null;
  readonly date?: string | null;
  readonly setCookie?: string | null;
};

// The two entry-point documents can only show their policy under `next start`:
// `next dev` stamps `no-cache, must-revalidate` over every application page.
export type ServedBy = "next-start" | "next-dev";

export const PUBLIC_DOCUMENT_PATHS = [
  "/",
  "/servicios",
  "/profesionales",
  "/clinicas",
  "/contacto",
  "/precios",
  "/offline",
  "/citologia-veterinaria",
  "/histopatologia-veterinaria",
  "/informes-veterinarios",
  "/laboratorio-patologico-veterinario",
] as const;

export const ACCESS_DOCUMENT_PATHS = ["/login", "/particulares"] as const;

const ONE_YEAR_SECONDS = 31_536_000;
const STABLE_ASSET_MAX_SECONDS = 3_600;

export function parseCacheControl(value: string | null | undefined): Map<string, string | null> {
  const directives = new Map<string, string | null>();

  for (const part of (value ?? "").match(/[^,"]+(?:"[^"]*"[^,"]*)*/g) ?? []) {
    const separator = part.indexOf("=");
    const name = (separator === -1 ? part : part.slice(0, separator)).trim().toLowerCase();

    if (name) {
      const value = separator === -1 ? null : part.slice(separator + 1).trim().replace(/^"|"$/g, "");

      // Caches disagree on which of two different values counts: neither does.
      directives.set(name, directives.has(name) && directives.get(name) !== value ? "" : value);
    }
  }

  return directives;
}

// A qualified form (`private="set-cookie"`) restricts a field, not the response.
function isUnqualified(directives: Map<string, string | null>, name: string): boolean {
  return directives.get(name) === null;
}

function seconds(directives: Map<string, string | null>, name: string): number | null {
  const raw = directives.get(name);

  if (raw === undefined) {
    return null;
  }

  // A directive that cannot be read is not a zero: it is treated as the
  // longest lifetime, so a malformed policy can never pass as a safe one.
  return raw !== null && /^\d+$/.test(raw) ? Number(raw) : Number.POSITIVE_INFINITY;
}

// Only the fixed HTTP date format: Date.parse alone also reads "0" as a date.
function httpDate(value: string | null | undefined): number {
  return /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value ?? "")
    ? Date.parse(value as string)
    : Number.NaN;
}

export function isStorableBy(kind: CacheKind, response: ServedResponse): boolean {
  const directives = parseCacheControl(response.cacheControl);

  return !directives.has("no-store") && !(kind === "shared" && isUnqualified(directives, "private"));
}

// Seconds during which a cache of that kind may answer with this response
// without contacting the origin. Zero means every reuse is validated first,
// and only what the response states can prove it: a response that states no
// lifetime leaves the cache free to choose one (RFC 9111 §4.2.2), so it is
// read as unbounded, never as zero. `must-revalidate` alone states none.
export function unvalidatedReuseSeconds(kind: CacheKind, response: ServedResponse): number {
  const directives = parseCacheControl(response.cacheControl);

  if (!isStorableBy(kind, response)) {
    return 0;
  }

  const staleWindow = Math.max(
    seconds(directives, "stale-while-revalidate") ?? 0,
    seconds(directives, "stale-if-error") ?? 0,
  );

  if (isUnqualified(directives, "no-cache")) {
    return staleWindow;
  }

  const explicit =
    (kind === "shared" ? seconds(directives, "s-maxage") : null) ?? seconds(directives, "max-age");

  if (explicit !== null) {
    return explicit + staleWindow;
  }

  const servedAt = response.date ? httpDate(response.date) : Date.now();
  const expiresAt = httpDate(response.expires);

  // A date that cannot be read bounds nothing. RFC 9111 §5.3 tells a cache to
  // take an unreadable Expires as already expired; a contract cannot rest on
  // every cache doing so.
  if (!Number.isNaN(expiresAt) && !Number.isNaN(servedAt)) {
    return Math.max(0, (expiresAt - servedAt) / 1000) + staleWindow;
  }

  return Number.POSITIVE_INFINITY;
}

function varies(response: ServedResponse, header: string): boolean {
  return (response.vary ?? "")
    .split(",")
    .some((name) => name.trim().toLowerCase() === header);
}

function isHtml(response: ServedResponse): boolean {
  return (response.contentType ?? "").toLowerCase().startsWith("text/html");
}

// A response that must never be reused without the origin's say: a document,
// its router payload, the fallback the worker copies.
function revalidatingViolations(response: ServedResponse): string[] {
  const directives = parseCacheControl(response.cacheControl);
  const violations: string[] = [];

  for (const kind of ["shared", "private"] as const) {
    const reuse = unvalidatedReuseSeconds(kind, response);

    if (reuse > 0) {
      violations.push(
        Number.isFinite(reuse)
          ? `a ${kind} cache may reuse it for ${reuse}s without validation`
          : `nothing it states keeps a ${kind} cache from reusing it without validation`,
      );
    }
  }

  if (directives.has("immutable")) {
    violations.push("immutable: a reload would not validate it");
  }

  if (response.setCookie) {
    violations.push("carries Set-Cookie");
  }

  return violations;
}

export function cachePolicyViolations(
  surface: ServedSurface,
  response: ServedResponse,
  servedBy: ServedBy = "next-start",
): string[] {
  const directives = parseCacheControl(response.cacheControl);
  const violations: string[] = [];

  switch (surface) {
    case "public-document": {
      violations.push(...revalidatingViolations(response));

      if (!isHtml(response)) {
        violations.push("is not an HTML document");
      }

      // Stored and validated, never refetched whole: `no-store` would also
      // take the document out of the back/forward cache.
      if (!isStorableBy("shared", response) || !isStorableBy("private", response)) {
        violations.push("cannot be stored, so it cannot be validated either");
      }

      break;
    }

    case "access-document": {
      violations.push(...revalidatingViolations(response));

      if (!isHtml(response)) {
        violations.push("is not an HTML document");
      }

      if (servedBy === "next-start" && isStorableBy("shared", response)) {
        violations.push("a shared cache may store an entry-point document");
      }

      break;
    }

    case "flight": {
      violations.push(...revalidatingViolations(response));

      if (!(response.contentType ?? "").toLowerCase().startsWith("text/x-component")) {
        violations.push("is not a router payload");
      }

      // Same URL as the document: only this header keeps a cache from
      // answering a navigation with the payload, or the reverse.
      if (!varies(response, "rsc")) {
        violations.push("does not vary on the rsc request header");
      }

      break;
    }

    case "private": {
      if (!directives.has("no-store")) {
        violations.push("is not no-store");
      }

      if (directives.has("public")) {
        violations.push("is declared public");
      }

      break;
    }

    case "immutable-asset": {
      if (!directives.has("immutable") || !directives.has("public")) {
        violations.push("is not public and immutable");
      }

      const lifetime = unvalidatedReuseSeconds("private", response);

      if (!Number.isFinite(lifetime) || lifetime < ONE_YEAR_SECONDS) {
        violations.push("does not state a lifetime of at least a year");
      }

      break;
    }

    case "stable-asset": {
      if (directives.has("immutable")) {
        violations.push("immutable under a URL whose bytes can change");
      }

      if (!isStorableBy("shared", response)) {
        violations.push("cannot be stored");
      }

      for (const kind of ["shared", "private"] as const) {
        if (unvalidatedReuseSeconds(kind, response) > STABLE_ASSET_MAX_SECONDS) {
          violations.push(`nothing it states limits a ${kind} cache to ${STABLE_ASSET_MAX_SECONDS}s of reuse`);
        }
      }

      break;
    }

    case "offline-fallback": {
      // sw.js refuses to install on a copy that is no-store or private, and
      // fetches it again only when it installs.
      if (!isStorableBy("shared", response)) {
        violations.push("the service worker cannot precache it");
      }

      if (!isHtml(response)) {
        violations.push("is not an HTML document");
      }

      if (directives.has("immutable")) {
        violations.push("immutable under a URL whose bytes can change");
      }

      if (response.setCookie) {
        violations.push("carries Set-Cookie");
      }

      break;
    }

    case "revalidated": {
      violations.push(...revalidatingViolations(response));

      break;
    }
  }

  return violations;
}
