import { expect, type Page, type Request } from "@playwright/test";
import { waitForAdaptiveConvergence } from "./dashboard-adaptive-limit-matrix";

// The informes full route renders `min(reports, measuredLimit)` rows. The first
// paint uses the server fallback page size; once the canvas is measured, a
// changed limit is fetched through the `getInformesPage` Server Action (POST
// /dashboard/informes with a `next-action` header) and React keeps the previous
// rows painted for the whole flight. "The row count stopped changing for N ms"
// is therefore satisfiable mid-flight. Settled means: no window request in
// flight, the rows canvas drained its ResizeObserver/rAF pipeline, and no new
// window request was dispatched while it drained.

const INFORMES_PATHNAME = "/dashboard/informes";
export const INFORMES_ROWS_CANVAS = '[data-informes-rows-canvas="true"]';

function isInformesWindowRequest(request: Request): boolean {
  if (request.method() !== "POST") return false;
  if (new URL(request.url()).pathname !== INFORMES_PATHNAME) return false;
  return Object.keys(request.headers()).some((name) => name.toLowerCase() === "next-action");
}

export type InformesWindowRequests = {
  readonly inFlight: () => number;
  readonly started: () => number;
};

/**
 * Must be armed BEFORE the navigation, so the post-measurement window request
 * cannot start unobserved. Both terminal events settle a request: a Server
 * Action can end in `requestfailed` (net::ERR_ABORTED) after its result applied.
 */
export function trackInformesWindowRequests(page: Page): InformesWindowRequests {
  const inFlight = new Set<Request>();
  let started = 0;

  page.on("request", (request) => {
    if (!isInformesWindowRequest(request)) return;
    inFlight.add(request);
    started += 1;
  });
  const onTerminal = (request: Request) => {
    inFlight.delete(request);
  };
  page.on("requestfinished", onTerminal);
  page.on("requestfailed", onTerminal);

  return { inFlight: () => inFlight.size, started: () => started };
}

/** Returns the settled, non-empty rendered row count of the informes list. */
export async function settleInformesRows(
  page: Page,
  requests: InformesWindowRequests,
  label: string,
  timeout: number,
): Promise<number> {
  const rows = page.locator("#reports-master-list [id^='report-']");
  let count = 0;

  await expect(async () => {
    expect(requests.inFlight(), `${label}: adaptive window request in flight`).toBe(0);
    const startedBefore = requests.started();
    await waitForAdaptiveConvergence(page, INFORMES_ROWS_CANVAS, label);
    expect(
      requests.started(),
      `${label}: a new adaptive window request started while the canvas drained`,
    ).toBe(startedBefore);
    expect(requests.inFlight(), `${label}: adaptive window request in flight`).toBe(0);
    count = await rows.count();
    expect(count, `${label}: at least one row rendered`).toBeGreaterThan(0);
  }).toPass({ timeout });

  return count;
}
