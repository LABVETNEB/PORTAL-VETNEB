import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const TOKENS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const HORIZONTAL_NAV_PATH =
  "frontend/src/components/dashboard/DashboardHorizontalNav.tsx";
const GLOBALS_PATH = "frontend/src/app/globals.css";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

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
// two complete pages (17 × 2 = 34) at the largest measured adaptive cardinality.
// The hook remains the page-size owner and "Cargar más" keeps its explicit batch.
test("admin tokens keeps a bounded two-page adaptive window plus cargar más", () => {
  const source = read(TOKENS_CARD_PATH);

  assert.ok(source.includes("const TOKENS_FALLBACK_ROWS = 9;"));
  assert.ok(
    source.includes("const TOKENS_MAX_OBSERVED_ADAPTIVE_ROWS = 17;"),
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
  assert.ok(source.includes("useAdaptiveItemsPerPage"));
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

test("admin tokens recomputa pagina localmente y descarta respuestas viejas (anti-race)", () => {
  const source = read(TOKENS_CARD_PATH);

  assert.ok(source.includes("const latestRequestRef = useRef(0);"));
  assert.ok(source.includes("const requestId = ++latestRequestRef.current;"));
  assert.ok(source.includes("if (requestId !== latestRequestRef.current) return;"));

  // Desktop keeps the nine-row floor (App Shell contract), mobile floors at one.
  assert.ok(
    source.includes(
      "minItems: isDesktopMeasurement ? TOKENS_FALLBACK_ROWS : 1,",
    ),
  );
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
  const nav = read(HORIZONTAL_NAV_PATH);
  const globals = read(GLOBALS_PATH);
  const mainStart = globals.indexOf("  .dashboard-main {");
  const mainEnd = globals.indexOf("  }", mainStart);
  const mainBlock = globals.slice(mainStart, mainEnd);

  assert.ok(page.includes('id="admin-particular-tokens"'));
  assert.ok(page.includes("<AdminParticularTokensCard />"));
  assert.ok(
    nav.includes("?module=admin-particular-tokens"),
    "horizontal navigation must preserve the module query contract",
  );
  assert.ok(mainStart >= 0);
  assert.ok(mainBlock.includes("overflow-hidden"));
  assert.equal(card.includes("overflow-y-auto"), false);
  assert.equal(card.includes("overflow-y-scroll"), false);
  assert.equal(card.includes("data-dashboard-scroll-region"), false);
});
