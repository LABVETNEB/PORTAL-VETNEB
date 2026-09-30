import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { parseTsx } from "../dashboard/dashboard-source-oracle.ts";
import { functionNamed, writesAfterRequest } from "./source-function-runner.ts";

const TOKENS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
// B08 retired DashboardHorizontalNav. Reachability of an admin module is now
// a property of the canonical catalog the lateral navigation derives from,
// rather than of one component's private item list — a strictly stronger
// anchor: it also fails if the module loses its glyph.
const MODULE_CATALOG_PATH = "frontend/src/features/dashboard/config/dashboardModules.ts";

// State writes of both token loaders once their request is in flight, for a
// current and a superseded request, resolving and failing.
async function tokenLoadWrites(source: string) {
  const file = parseTsx(source, TOKENS_CARD_PATH);
  const outcomes: Record<string, string[]> = {};

  for (const loader of ["loadTokens", "loadMoreTokens"]) {
    for (const superseded of [false, true]) {
      for (const fails of [false, true]) {
        outcomes[`${loader}:${superseded ? "superseded" : "current"}-${fails ? "failure" : "success"}`] =
          await writesAfterRequest(functionNamed(file, loader), {
            fetcher: "getAdminParticularTokens",
            setters: [
              "setIsLoadingTokens",
              "setIsLoadingMoreTokens",
              "setErrorMessage",
              "setTokens",
              "setHasMoreFromServer",
              "setSelectedTokenId",
            ],
            bindings: {
              TOKENS_INITIAL_ADAPTIVE_WINDOW_SIZE: 90,
              TOKENS_LOAD_MORE_BATCH_SIZE: 30,
              isLoadingMoreTokens: false,
              hasMoreFromServer: true,
              tokens: [],
            },
            response: { particularTokens: [] },
            superseded,
            fails,
          });
      }
    }
  }

  return outcomes;
}
const MODULE_ICONS_PATH = "frontend/src/components/dashboard/dashboardModuleIcons.ts";
const GLOBALS_PATH = "frontend/src/app/globals.css";

const FORBIDDEN_OVERSIZED = [
  "text-2xl",
  "text-3xl",
  "p-6",
  "p-8",
  "gap-6",
  "gap-8",
  "h-14",
  "h-16",
];

// The endpoint exposes no `total`, so the initial bounded window must cover
// two complete pages (18 × 2 = 36) at the largest measured adaptive cardinality.
// The hook remains the page-size owner and "Cargar más" keeps its explicit batch.
test("admin tokens keeps a bounded two-page adaptive window plus cargar más", () => {
  const source = read(TOKENS_CARD_PATH);

  assert.ok(source.includes("const TOKENS_FALLBACK_ROWS = 9;"));
  assert.ok(
    source.includes("const TOKENS_MAX_OBSERVED_ADAPTIVE_ROWS = 18;"),
  );
  assert.ok(
    source.includes(
      "TOKENS_MAX_OBSERVED_ADAPTIVE_ROWS * 2;",
    ),
  );
  assert.ok(source.includes("const TOKENS_ADAPTIVE_MAX_ROWS = 30;"));
  assert.ok(source.includes("const TOKENS_LOAD_MORE_BATCH_SIZE = 30;"));
  assert.ok(source.includes("limit: TOKENS_INITIAL_ADAPTIVE_WINDOW_SIZE,"));
  assert.ok(source.includes("limit: TOKENS_LOAD_MORE_BATCH_SIZE,"));
  assert.ok(source.includes("maxItems: TOKENS_ADAPTIVE_MAX_ROWS,"));
  assert.equal(source.includes("TOKENS_SUPERSET_CAP"), false);
  assert.ok(source.includes("useDashboardCanvasCapacity"));
  assert.ok(source.includes("usePagedRows"));
  assert.ok(source.includes("hasMoreFromServer"));
  assert.equal(source.includes("const PAGE_SIZE = 9;"), false);
  assert.equal(source.includes("const MOBILE_PAGE_SIZE"), false);
  assert.equal(source.includes("window.matchMedia"), false);
  assert.equal(source.includes("isMobileViewport"), false);
  assert.equal(source.includes("loadMobileTokens"), false);
  assert.equal(source.includes("const canGoNext = tokens.length === PAGE_SIZE;"), false);
  assert.ok(source.includes("Anterior"));
  assert.ok(source.includes("Siguiente"));
  assert.ok(source.includes("Cargar más"));
  assert.equal(source.includes("limit: 8, offset: 0"), false);
  assert.equal(source.includes("PAGE_SIZE_OPTIONS"), false);
  assert.equal(source.includes("25/50/100"), false);
});

test("admin tokens recomputa pagina localmente y descarta respuestas viejas (anti-race)", async () => {
  const source = read(TOKENS_CARD_PATH);

  assert.ok(source.includes("const latestRequestRef = useRef(0);"));
  assert.ok(source.includes("const requestId = ++latestRequestRef.current;"));
  assert.ok(source.includes("if (requestId !== latestRequestRef.current) return;"));

  // Desktop keeps the nine-row floor (App Shell contract), mobile floors at
  // one. Expressed per canvas now that each presentation owns its capacity,
  // instead of branching on whether a measured header height was non-zero.
  assert.ok(source.includes("canvasNode: desktopBodyNode,"));
  assert.ok(source.includes("canvasNode: mobileBodyNode,"));
  assert.ok(source.includes("minItems: TOKENS_FALLBACK_ROWS,"));
  assert.ok(source.includes("minItems: 1,"));

  const latestWins = {
    "loadTokens:current-success": ["setTokens", "setHasMoreFromServer", "setSelectedTokenId", "setIsLoadingTokens"],
    "loadTokens:current-failure": [
      "setTokens",
      "setHasMoreFromServer",
      "setSelectedTokenId",
      "setErrorMessage",
      "setIsLoadingTokens",
    ],
    "loadTokens:superseded-success": [],
    "loadTokens:superseded-failure": [],
    "loadMoreTokens:current-success": ["setTokens", "setHasMoreFromServer", "setIsLoadingMoreTokens"],
    "loadMoreTokens:current-failure": ["setErrorMessage", "setIsLoadingMoreTokens"],
    "loadMoreTokens:superseded-success": [],
    "loadMoreTokens:superseded-failure": [],
  };
  assert.deepEqual(await tokenLoadWrites(source), latestWins);

  const unguarded = source.replace(
    /if \(requestId !== latestRequestRef\.current\) return;/g,
    "if (false)\n$&",
  );
  assert.notEqual(unguarded, source);
  assert.notDeepEqual(await tokenLoadWrites(unguarded), latestWins);
});

test("admin tokens toolbar is mobile-safe and wraps actions", () => {
  const source = read(TOKENS_CARD_PATH);

  assert.ok(source.includes('data-admin-particulars-toolbar="true"'));
  assert.ok(source.includes('data-admin-filter-bar={mobile ? "advanced-mobile" : "advanced"}'));
  assert.ok(source.includes('data-admin-particulars-mobile-list="true"'));
  assert.ok(source.includes("FilterBar,"));
  assert.ok(source.includes("FilterField,"));
  assert.ok(source.includes('const density: FilterBarDensity = mobile ? "comfortable" : "compact";'));
  assert.ok(source.includes("hidden shrink-0 md:grid md:grid-cols-4"));
  assert.ok(source.includes("dashboardFilterControlClassName(density)"));
  assert.ok(source.includes("dashboardFilterActionClassName(density)"));
  assert.ok(source.includes("Filtros avanzados de tokens particulares mobile"));
  assert.ok(source.includes("Todos los tokens"));
  assert.ok(source.includes("lg:grid-cols-[1.05fr_1.25fr_0.8fr_1fr_0.8fr_0.85fr_0.85fr_auto_auto]"));
  assert.ok(source.includes('"Filtros avanzados de tokens particulares"'));
});

test("admin tokens replaces row cards and inline detail with a dense table and dialogs", () => {
  const source = read(TOKENS_CARD_PATH);

  assert.ok(source.includes('aria-label="Tabla de tokens particulares"'));
  assert.ok(source.includes("<Table"));
  assert.ok(source.includes("[&_th]:h-7"));
  assert.ok(source.includes('className="py-0.5"'));
  assert.ok(source.includes('className="h-7 px-2 text-xs"'));
  assert.ok(source.includes("<ModuleDialog"));
  assert.ok(source.includes('title={`Token ****${selectedToken.tokenLast4}`}'));
  assert.equal(source.includes("dashboard-inline-detail"), false);
  assert.equal(source.includes('data-detail-state="selected"'), false);

  for (const forbidden of FORBIDDEN_OVERSIZED) {
    assert.equal(
      source.includes(forbidden),
      false,
      `Admin Tokens must not use oversized class ${forbidden}`,
    );
  }
});

test("admin tokens keeps secrets masked outside the one-time creation dialog", () => {
  const source = read(TOKENS_CARD_PATH);

  assert.ok(source.includes("****{token.tokenLast4}"));
  assert.ok(source.includes("Token ****{selectedToken.tokenLast4}"));
  assert.ok(source.includes("El token completo solo se muestra una vez"));
  assert.ok(source.includes("isGeneratedTokenConfirmed"));
  assert.equal(source.includes("tokenHash"), false);
  assert.equal(source.includes("dangerouslySetInnerHTML"), false);
  assert.equal(source.includes("console.log"), false);
  assert.equal(source.includes("console.info"), false);
});

test("admin token tracking is loaded on demand without a per-row Promise.all", () => {
  const source = read(TOKENS_CARD_PATH);

  assert.ok(source.includes("Load exactly one case when the"));
  assert.ok(source.includes("!isDetailDialogOpen"));
  assert.ok(source.includes("particularTokenId: tokenId"));
  assert.ok(source.includes("trackingLoadedTokenIds"));
  assert.equal(source.includes("Promise.all"), false);
  assert.equal(source.includes("nextTokens.map(async"), false);
});

test("admin tokens preserves route integration and global no-scroll", () => {
  const card = read(TOKENS_CARD_PATH);
  const page = read(ADMIN_PAGE_PATH);
  const catalog = read(MODULE_CATALOG_PATH);
  const globals = read(GLOBALS_PATH);
  const mainStart = globals.indexOf("  .dashboard-main {");
  const mainEnd = globals.indexOf("  }", mainStart);
  const mainBlock = globals.slice(mainStart, mainEnd);

  assert.ok(page.includes('id="admin-particular-tokens"'));
  assert.ok(page.includes("<AdminParticularTokensCard />"));
  assert.ok(
    catalog.includes('moduleId: "admin-particular-tokens"') &&
      read(MODULE_ICONS_PATH).includes('"admin-particular-tokens":'),
    "horizontal navigation must preserve the module query contract",
  );
  assert.ok(mainStart >= 0);
  assert.ok(mainBlock.includes("overflow-hidden"));
  assert.equal(card.includes("overflow-y-auto"), false);
  assert.equal(card.includes("overflow-y-scroll"), false);
  assert.equal(card.includes("data-dashboard-scroll-region"), false);
});
