/**
 * D-10: a router payload that fails after a later navigation superseded it
 * must not leave the document.
 *
 * Next 16.4 (up to 16.5 canary) turns a failed payload into a document
 * navigation without asking whether its navigation is still the current one:
 * the hard retry of `server-patch-reducer` runs `completeHardNavigation` before
 * its own `previousTree !== state.tree` staleness check. A late 524 of an
 * abandoned flight, or a 500 of a retry that a selection overtook, then reloads
 * the abandoned URL over the latest selection.
 *
 * Only the latest navigation payload may fail into the document fallback. The
 * failure of one that a later navigation payload superseded is withheld: to the
 * router it is a flight that never answers, which is what the owner already
 * makes of an abandoned flight (F1). Answers, prefetches, Server Actions and
 * every other request reach their caller exactly as the network gave them.
 *
 * @see test/unit/ui/dashboard/dashboard-navigation-superseded-flight.test.ts
 * @see docs/implementation/d10-late-navigation-failure.md
 */

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const RSC_HEADER = "rsc";
const PREFETCH_HEADER = "next-router-prefetch";

const WITHHELD: Promise<never> = new Promise(() => {});

function isNavigationPayload(input: RequestInfo | URL, init: RequestInit | undefined): boolean {
  const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  if (method !== "GET") return false;
  const headers = new Headers(init?.headers ?? request?.headers);
  return headers.get(RSC_HEADER) === "1" && !headers.has(PREFETCH_HEADER);
}

export function guardSupersededFlights(fetchImpl: Fetch): Fetch {
  let latest = 0;
  return (input, init) => {
    if (!isNavigationPayload(input, init)) return fetchImpl(input, init);
    const ticket = ++latest;
    const superseded = () => ticket !== latest;
    return fetchImpl(input, init).then(
      (response) => (!response.ok && superseded() ? WITHHELD : response),
      (error: unknown) => (superseded() && !init?.signal?.aborted ? WITHHELD : Promise.reject(error)),
    );
  };
}

/** Wraps `target.fetch`; the returned function restores it unless another wrapper replaced the guard. */
export function installSupersededFlightGuard(target: { fetch: Fetch }): () => void {
  const original = target.fetch;
  const guarded = guardSupersededFlights((input, init) => original.call(target, input, init));
  target.fetch = guarded;
  return () => {
    if (target.fetch === guarded) target.fetch = original;
  };
}
