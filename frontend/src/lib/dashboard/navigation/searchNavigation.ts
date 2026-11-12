// Input adapter of the saved-search coordinate (GLOBAL-SEARCH-DRIVE-A4).
//
// The URL carries ONLY an opaque id (`?sq=<uuid v4>`) of a search the server
// keeps for the session; the query itself never travels in it (it holds patient
// and tutor names). `search` is a coordinate of the machine's `NavLocation`, so
// selecting, undoing and redoing a search are the machine's own transitions
// (single flight, supersede, history): this file adds NO event, NO owner and
// does not touch `window.history`.
//
// It does three things and nothing else:
//   1. reads and writes the `sq` parameter (`readSearchParam`, `withSearchParam`);
//   2. hands the bar's request to the mounted provider (`requestSearchSelection`),
//      the same shape as `requestAdminModuleActivate` / `requestClinicModuleActivate`;
//   3. publishes the `search` of the machine's `display` to the bar
//      (`publishDisplayedSearch` / `subscribeDisplayedSearch`).
//
// `true` from `requestSearchSelection` means the owner took the selection and
// the caller must not navigate; `false` means it could not (no owner mounted,
// BOOTING / FAILED, no module on screen) and the search simply works without
// a `?sq=`.
//
// NO IMPORTS, no DOM: the provider registers itself and publishes.

export const SEARCH_QUERY_PARAM = "sq";

const SEARCH_STATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Only a lowercase UUID v4 is an id: the same grammar the server accepts. */
export function isSearchStateId(value: unknown): value is string {
  return typeof value === "string" && SEARCH_STATE_ID.test(value);
}

/** The `sq` of a URL, or `null` when absent, repeated or not a UUID v4. */
export function readSearchParam(query: { readonly getAll: (name: string) => string[] }): string | null {
  const values = query.getAll(SEARCH_QUERY_PARAM);
  return values.length === 1 && isSearchStateId(values[0]) ? values[0] : null;
}

/** `href` with `sq` appended before any fragment; unchanged without a valid id. */
export function withSearchParam(href: string, search: string | null | undefined): string {
  if (!isSearchStateId(search)) return href;
  const hashAt = href.indexOf("#");
  const base = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  return `${base}${base.includes("?") ? "&" : "?"}${SEARCH_QUERY_PARAM}=${search}${hash}`;
}

/** The `search` of a location, `null` when it has none. */
export function searchOfLocation(location: { readonly kind: string; readonly search?: string }): string | null {
  return isSearchStateId(location.search) ? location.search : null;
}

export type SearchNavigationOwner = {
  /**
   * Selects the location on screen with this saved search (`null`: without
   * one). `true` when the selection was dispatched to the machine.
   */
  readonly select: (search: string | null) => boolean;
};

let owner: SearchNavigationOwner | null = null;
let displayed: string | null = null;
const listeners = new Set<() => void>();

/** The provider registers on mount; the returned function unregisters it. */
export function registerSearchNavigationOwner(next: SearchNavigationOwner): () => void {
  owner = next;
  return () => {
    if (owner === next) owner = null;
  };
}

/** `true` means the navigation owner took the selection: the caller must not navigate. */
export function requestSearchSelection(search: string | null): boolean {
  if (owner === null) return false;
  if (search !== null && !isSearchStateId(search)) return false;
  return owner.select(search);
}

/** The provider publishes the machine's `display.search` (`null`: none, or no owner). */
export function publishDisplayedSearch(search: string | null): void {
  const next = isSearchStateId(search) ? search : null;
  if (next === displayed) return;
  displayed = next;
  for (const listener of [...listeners]) listener();
}

export function getDisplayedSearch(): string | null {
  return displayed;
}

export function subscribeDisplayedSearch(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
