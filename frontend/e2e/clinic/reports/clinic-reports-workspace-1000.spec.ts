import { expect, test, type Page, type Request } from "@playwright/test";

const POPULATED_CLINIC_COOKIE = "e2e_populated_clinic_session";
const REPORT_ROW_ID = /^report-(\d+)$/;
const INFORMES_PATHNAME = "/dashboard/informes";

type WorkspaceState = {
  rowIds: number[];
  text: string;
  paginationText: string | null;
  summary: Record<string, string>;
  pathname: string;
  search: string;
  viewport: { width: number; height: number };
  pagerVisible: boolean;
  errorVisible: boolean;
  emptyVisible: boolean;
  loadingVisible: boolean;
  rowsCanvasHeight: number;
  firstRowHeight: number;
  htmlOverflowY: number;
  bodyOverflowY: number;
};

async function setPopulatedClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: POPULATED_CLINIC_COOKIE,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function readWorkspaceState(page: Page): Promise<WorkspaceState> {
  return page.evaluate((rowPatternSource) => {
    const rowPattern = new RegExp(rowPatternSource);
    const reportRowElements = Array.from(
      document.querySelectorAll<HTMLElement>("#reports-master-list [id]"),
    ).filter((element) => rowPattern.test(element.id));
    const reportRows = reportRowElements.flatMap((element) => {
      const match = element.id.match(rowPattern);

      return match ? [Number(match[1])] : [];
    });
    const pagination = document.querySelector<HTMLElement>(
      '[aria-label="Paginación de informes"]',
    );
    const summary = Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>(".surface-soft")).flatMap(
        (card) => {
          const [label, value] = Array.from(card.querySelectorAll("p")).map(
            (node) => node.textContent?.trim() ?? "",
          );

          return label && value ? [[label, value]] : [];
        },
      ),
    );
    const rowsCanvas = document.querySelector<HTMLElement>(
      '[data-informes-rows-canvas="true"]',
    );
    const firstRow = reportRowElements[0] ?? null;
    const pagerRect = pagination?.getBoundingClientRect();
    const rowsCanvasRect = rowsCanvas?.getBoundingClientRect();
    const firstRowRect = firstRow?.getBoundingClientRect();
    const bodyText = document.body.innerText;
    const html = document.documentElement;
    const body = document.body;

    return {
      rowIds: reportRows,
      text: bodyText,
      paginationText: pagination?.innerText ?? null,
      summary,
      pathname: window.location.pathname,
      search: window.location.search,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pagerVisible: Boolean(pagerRect && pagerRect.width > 0 && pagerRect.height > 0),
      errorVisible: document.querySelector('[role="alert"]') !== null,
      emptyVisible: bodyText.includes("No hay informes disponibles."),
      loadingVisible:
        document.querySelector('[aria-busy="true"]') !== null ||
        bodyText.includes("Cargando informes"),
      rowsCanvasHeight: rowsCanvasRect?.height ?? 0,
      firstRowHeight: firstRowRect?.height ?? 0,
      htmlOverflowY: Math.max(0, html.scrollHeight - html.clientHeight),
      bodyOverflowY: Math.max(0, body.scrollHeight - body.clientHeight),
    };
  }, REPORT_ROW_ID.source);
}

async function expectWorkspaceReady(page: Page) {
  await expect(page.locator("#reports-master-list")).toBeVisible({
    timeout: 8_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport
//
// The workspace paginates through a Next Server Action, NOT through the URL:
// `getInformesPage` is POSTed to /dashboard/informes with a `next-action`
// header and `[{ page, pageSize, query?, status?, studyType? }]` as its
// argument list. The URL only ever carries the FILTER state, which is why the
// filter assertions below still read searchParams while the pager ones never
// do. A03 classifies this same module as `server-request` /
// `next-server-action` / `page-pagesize`.
//
// The response is a Flight/RSC stream, so it is used as a synchronisation
// signal only and never parsed. Independence comes from three separate
// sources: the REQUEST payload (window size), the fixture's deterministic ID
// order (window contents) and the DOM (what actually rendered).
// ─────────────────────────────────────────────────────────────────────────────

type InformesAction = {
  page: number;
  pageSize: number;
  query: string | null;
  status: string | null;
  studyType: string | null;
};

function parseInformesAction(request: Request): InformesAction | null {
  if (request.method() !== "POST") return null;
  if (new URL(request.url()).pathname !== INFORMES_PATHNAME) return null;

  const headers = request.headers();
  if (!Object.keys(headers).some((name) => name.toLowerCase() === "next-action")) {
    return null;
  }

  const body = request.postData();
  if (!body) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || typeof parsed[0] !== "object" || parsed[0] === null) {
    return null;
  }

  const args = parsed[0] as Record<string, unknown>;
  if (!Number.isInteger(args.page) || (args.page as number) < 1) return null;
  if (!Number.isInteger(args.pageSize) || (args.pageSize as number) < 1) return null;

  const text = (value: unknown) => (typeof value === "string" ? value : null);

  return {
    page: args.page as number,
    pageSize: args.pageSize as number,
    query: text(args.query),
    status: text(args.status),
    studyType: text(args.studyType),
  };
}

/**
 * Collects every adaptive window request. It is armed BEFORE the trigger that
 * causes one — navigation, filter submit or pager click — so a window that
 * lands early is observed rather than missed.
 */
function observeInformesActions(page: Page) {
  const observed: InformesAction[] = [];
  const onRequest = (request: Request) => {
    const action = parseInformesAction(request);
    if (action) observed.push(action);
  };

  page.on("request", onRequest);
  page.once("close", () => page.off("request", onRequest));

  return {
    latest: () => observed.at(-1) ?? null,
    /** Binds the wait to the exact request AND to its terminal network event. */
    async awaitWindow(
      trigger: () => Promise<void>,
      matches: (action: InformesAction) => boolean,
      label: string,
    ): Promise<InformesAction> {
      const requestPromise = page.waitForRequest((request) => {
        const action = parseInformesAction(request);
        return action !== null && matches(action);
      });

      await trigger();

      const request = await requestPromise;
      const response = await request.response();
      expect(response, `${label}: server action response`).not.toBeNull();
      await response!.finished();

      const action = parseInformesAction(request);
      expect(action, `${label}: server action payload`).not.toBeNull();
      return action!;
    },
    dispose: () => page.off("request", onRequest),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset
//
// The ORDER of these ids is a fixture contract and stays literal. The size of
// the window that slices them is NOT: it is whatever the adaptive engine
// measured, read back from the request payload. Each sequence is a bounded
// prefix, so every consumer asserts the prefix is long enough before slicing —
// a page size that outgrows it must fail loudly, never silently pass.
// ─────────────────────────────────────────────────────────────────────────────

/** Unfiltered fixture order: 1000 consecutive ids from 8401. */
const ALL_IDS = Array.from({ length: 24 }, (_, index) => 8401 + index);
const ALL_TOTAL = 1000;

/** `status=delivered` order. */
const DELIVERED_IDS = [8403, 8404, 8408, 8412, 8416, 8420];
const DELIVERED_TOTAL = 251;

/** `query=Paciente E2E` + `status=delivered` + `studyType=Necropsia` order. */
const COMBINED_IDS = [
  8420, 8440, 8460, 8480, 8500, 8520, 8540, 8560, 8580, 8600, 8620, 8640,
];
const COMBINED_TOTAL = 50;

type ExpectedWindow = {
  orderedIds: readonly number[];
  total: number;
  page: number;
};

function windowFor(expected: ExpectedWindow, pageSize: number, label: string) {
  const offset = (expected.page - 1) * pageSize;
  // A window is bounded by the page size AND by what is left in the result set,
  // so the last (or only) page of a small filter legitimately renders fewer
  // rows than the measured capacity.
  const expectedCount = Math.max(0, Math.min(expected.total, offset + pageSize) - offset);
  expect(
    offset + expectedCount,
    `${label}: known id prefix (${expected.orderedIds.length}) must cover page ${expected.page} at page size ${pageSize}`,
  ).toBeLessThanOrEqual(expected.orderedIds.length);

  const rowIds = expected.orderedIds.slice(offset, offset + expectedCount);
  const totalPages = Math.max(1, Math.ceil(expected.total / pageSize));

  return {
    rowIds,
    total: String(expected.total),
    showing: expected.total === 0 ? "0" : `${offset + 1}-${offset + rowIds.length}`,
    pageOf: `${expected.page} / ${totalPages}`,
    // CMP-09: pager label wording aligned to Admin's "Pág. X / Y" (G-010).
    paginationContains: `Pág. ${expected.page} / ${totalPages}`,
  };
}

/**
 * Polls until the rendered window, the summary and the pager all agree with the
 * page size the runtime actually requested. The adaptive engine boots from a
 * fallback window before the measured one lands, so a single snapshot can catch
 * rows and summary disagreeing; the poll is semantic, not a sleep.
 */
async function settleWindow(
  page: Page,
  actions: ReturnType<typeof observeInformesActions>,
  expected: ExpectedWindow,
  label: string,
): Promise<{ state: WorkspaceState; pageSize: number }> {
  let settled: { state: WorkspaceState; pageSize: number } | null = null;

  await expect(async () => {
    const latest = actions.latest();
    const state = await readWorkspaceState(page);

    // The runtime only re-requests when the measured window differs from the
    // one the server already rendered. Since CMP-09 pinned the rows to the
    // canonical 44px pitch, the measurement can land exactly on
    // INFORMES_FALLBACK_ROWS (e.g. a 256px canvas at 1280x720 measures 6), and
    // then no server action is emitted because none is needed. The effective
    // page size is therefore read from the rendered window in that case; every
    // semantic assertion below is unchanged, and paginating still requires a
    // real request through `awaitWindow`.
    if (latest) {
      expect(latest.page, `${label}: requested page`).toBe(expected.page);
    }

    const pageSize = latest ? latest.pageSize : state.rowIds.length;
    const target = windowFor(expected, pageSize, label);

    expect(state.loadingVisible, `${label}: settled (not loading)`).toBe(false);
    expect(state.rowIds, `${label}: rendered window`).toEqual(target.rowIds);
    expect(state.summary.Total, `${label}: total`).toBe(target.total);
    expect(state.summary.Mostrando, `${label}: shown range`).toBe(target.showing);
    expect(state.summary.Página, `${label}: page indicator`).toBe(target.pageOf);
    expect(state.paginationText, `${label}: pager`).toContain(
      target.paginationContains,
    );

    settled = { state, pageSize };
    // 20s budget: under multi-file contention the dev server compiles routes on
    // demand and the fallback → measured window transition can take seconds.
  }).toPass({ timeout: 20_000 });

  return settled!;
}

/** Hydration guard: submitting the same filter is idempotent, so the click can
 * be retried until the URL reflects the requested filters. Filters — unlike
 * pagination — ARE a URL contract, and that navigation is what delivers the
 * filtered window: the client only re-requests afterwards when the measured
 * page size differs from the server-rendered one, so callers assert the URL
 * here and the resulting window through `settleWindow`, never a server action
 * that is emitted only incidentally. Pagination, which never touches the URL,
 * still goes through `advanceToNextPage`/`awaitWindow`. */
async function submitFilters(page: Page, matchesUrl: (url: URL) => boolean) {
  await expect(async () => {
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(matchesUrl, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

/** Advances one page through the Server Action, never through the URL. */
async function advanceToNextPage(
  page: Page,
  actions: ReturnType<typeof observeInformesActions>,
  currentPage: number,
  pageSize: number,
  label: string,
): Promise<InformesAction> {
  return actions.awaitWindow(
    async () => {
      const next = page.getByRole("button", { name: "Página siguiente" });
      await expect(next, `${label}: next-page control`).toBeEnabled();
      await next.click();
    },
    (action) => action.page === currentPage + 1 && action.pageSize === pageSize,
    label,
  );
}

async function openSettledWorkspace(page: Page) {
  const actions = observeInformesActions(page);

  await setPopulatedClinicSession(page);
  await page.goto(INFORMES_PATHNAME);
  await expectWorkspaceReady(page);

  const settled = await settleWindow(
    page,
    actions,
    { orderedIds: ALL_IDS, total: ALL_TOTAL, page: 1 },
    "first page",
  );

  // Hard regression guard for the adaptive capacity collapse: with 1000 reports
  // and a full-height desktop workspace the measured window must hold more than
  // one row. A future regression to a single row FAILS here — it is never
  // absorbed as an expected failure.
  expect(
    settled.pageSize,
    "adaptive window must not collapse to a single row at 1280x720",
  ).toBeGreaterThan(1);

  return { actions, ...settled };
}

test.describe("clinic reports workspace 1000-report fixture (CAP-C3)", () => {
  test("first page renders a bounded slice and coherent 1000-report pagination", async ({
    page,
  }) => {
    const { state } = await openSettledWorkspace(page);

    expect(state.text).not.toContain("Paciente E2E 0999");
  });

  test("pagination advances to a later page without rendering the full fixture", async ({
    page,
  }) => {
    const { actions, pageSize } = await openSettledWorkspace(page);

    await advanceToNextPage(page, actions, 1, pageSize, "page 2");
    await settleWindow(
      page,
      actions,
      { orderedIds: ALL_IDS, total: ALL_TOTAL, page: 2 },
      "page 2",
    );
  });

  test("status filter keeps limit/offset pagination semantics in the workspace", async ({
    page,
  }) => {
    const { actions } = await openSettledWorkspace(page);

    await page.getByLabel("Filtrar por estado").selectOption("delivered");
    await submitFilters(
      page,
      (url) => url.searchParams.get("status") === "delivered",
    );

    await expectWorkspaceReady(page);
    await settleWindow(
      page,
      actions,
      { orderedIds: DELIVERED_IDS, total: DELIVERED_TOTAL, page: 1 },
      "status filter",
    );
  });

  // Plain passing contract: this filter legitimately yields a single result, so
  // the anti-collapse guard above deliberately does not apply here — one row is
  // the correct answer, not a collapsed window.
  test("query search narrows the workspace through the compact filter form", async ({
    page,
  }) => {
    const { actions } = await openSettledWorkspace(page);

    await page.getByLabel("Buscar informes").fill("Paciente E2E 0100");
    await submitFilters(
      page,
      (url) => url.searchParams.get("query") === "Paciente E2E 0100",
    );

    await expectWorkspaceReady(page);
    await settleWindow(
      page,
      actions,
      { orderedIds: [8500], total: 1, page: 1 },
      "query search",
    );
    // R-07 made the pager an always-visible fixture of the list; a single-page
    // result keeps it mounted showing "1 de 1".
    await expect(
      page.locator('[aria-label="Paginación de informes"]'),
    ).toContainText("Pág. 1 / 1");
  });

  test("combined query, status and studyType filters keep totalPages coherent", async ({
    page,
  }) => {
    const { actions } = await openSettledWorkspace(page);

    await page.getByLabel("Buscar informes").fill("Paciente E2E");
    await page.getByLabel("Filtrar por estado").selectOption("delivered");
    await page.getByLabel("Filtrar por tipo de estudio").fill("Necropsia");
    await submitFilters(page, (url) => {
      return (
        url.searchParams.get("query") === "Paciente E2E" &&
        url.searchParams.get("status") === "delivered" &&
        url.searchParams.get("studyType") === "Necropsia"
      );
    });

    await expectWorkspaceReady(page);
    const filtered = await settleWindow(
      page,
      actions,
      { orderedIds: COMBINED_IDS, total: COMBINED_TOTAL, page: 1 },
      "combined filters",
    );

    await advanceToNextPage(page, actions, 1, filtered.pageSize, "combined page 2");
    await settleWindow(
      page,
      actions,
      { orderedIds: COMBINED_IDS, total: COMBINED_TOTAL, page: 2 },
      "combined page 2",
    );
  });
});
