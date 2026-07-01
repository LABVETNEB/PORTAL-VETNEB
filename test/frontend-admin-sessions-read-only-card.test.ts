import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx";
const MOBILE_MODULE_PATH =
  "frontend/src/app/dashboard/admin/AdminMobileSessionsModule.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin sessions card keeps PAGE_SIZE only as fallback, not as the direct limit", () => {
  const source = read(CARD_PATH);

  assert.ok(source.includes("const SESSIONS_FALLBACK_ROWS = 8;"));
  assert.ok(source.includes("fallbackItems: SESSIONS_FALLBACK_ROWS,"));
  assert.equal(source.includes("const PAGE_SIZE = 8;"), false);
  assert.equal(source.includes("limit: PAGE_SIZE"), false);
});

test("admin sessions card introduces the hybrid superset cap of 32", () => {
  const source = read(CARD_PATH);

  assert.ok(source.includes("const SESSIONS_SUPERSET_CAP = 32;"));
  assert.ok(source.includes("maxItems: SESSIONS_SUPERSET_CAP,"));
});

test("admin sessions card derives the effective limit from the adaptive hook", () => {
  const source = read(CARD_PATH);

  assert.ok(
    source.includes(
      'import { useAdaptiveItemsPerPage } from "@/hooks/useAdaptiveItemsPerPage";',
    ),
  );
  assert.ok(source.includes("const { itemsPerPage: rowsPerPage } = useAdaptiveItemsPerPage({"));
  assert.ok(source.includes("const effectiveLimit = rowsPerPage;"));
  assert.ok(source.includes("limit: effectiveLimit,"));
});

test("admin sessions card measures a real rows container per presentation", () => {
  const source = read(CARD_PATH);

  assert.ok(source.includes('data-admin-sesiones-list-body="true"'));
  assert.ok(source.includes("containerNode: measurement.containerNode,"));
  assert.ok(source.includes("itemHeightPx: measurement.rowHeightPx,"));
  assert.ok(source.includes("headerHeightPx: measurement.headerHeightPx,"));
  assert.ok(source.includes("new ResizeObserver("));
  assert.ok(source.includes("ref={index === 0 ? setDesktopRowNode : undefined}"));
  assert.ok(source.includes("ref={index === 0 ? setMobileRowNode : undefined}"));
});

test("admin sessions card recomputes offset when the limit changes and clamps to total", () => {
  const source = read(CARD_PATH);

  assert.ok(
    source.includes(
      "let nextOffset = Math.floor(currentOffset / effectiveLimit) * effectiveLimit;",
    ),
  );
  assert.ok(source.includes("const total = snapshotRef.current?.total;"));
  assert.ok(
    source.includes(
      "(Math.ceil(total / effectiveLimit) - 1) * effectiveLimit,",
    ),
  );
  assert.ok(source.includes("nextOffset = Math.min(nextOffset, lastValidOffset);"));
});

test("admin sessions card guards concurrent fetches with a request id", () => {
  const source = read(CARD_PATH);

  assert.ok(source.includes("const latestRequestRef = useRef(0);"));
  assert.ok(source.includes("const requestId = latestRequestRef.current + 1;"));
  assert.ok(source.includes("latestRequestRef.current = requestId;"));
  assert.ok(source.includes("if (requestId !== latestRequestRef.current) return;"));
});

test("admin sessions card pages by the effective limit, not a fixed size", () => {
  const source = read(CARD_PATH);

  assert.ok(source.includes("const page = Math.floor(offset / effectiveLimit) + 1;"));
  assert.ok(
    source.includes(
      "Math.max(1, Math.ceil(snapshot.total / effectiveLimit))",
    ),
  );
  assert.ok(source.includes("setOffset(Math.max(offset - effectiveLimit, 0));"));
  assert.ok(source.includes("setOffset(offset + effectiveLimit);"));
});

test("admin sessions filters reset offset to zero on change", () => {
  const source = read(CARD_PATH);

  // Both presentations reset the offset inside the select onChange handlers.
  const resetCount = source.split("setOffset(0);").length - 1;
  assert.ok(resetCount >= 4, `expected filter handlers to reset offset, got ${resetCount}`);
});

test("admin sessions card exposes stable data attributes for tests", () => {
  const source = read(CARD_PATH);

  assert.ok(source.includes('data-admin-sesiones-card="true"'));
  assert.ok(source.includes('data-admin-sesiones-list-body="true"'));
  assert.ok(source.includes('data-admin-sesiones-row="true"'));
  assert.ok(source.includes('data-admin-sesiones-pagination="true"'));
  assert.ok(source.includes("data-admin-sesiones-page-size={effectiveLimit}"));
  // Preserves the legacy mobile ops-module contract used by e2e.
  assert.ok(source.includes('data-admin-mobile-ops-module="sessions"'));
  assert.ok(source.includes('data-admin-mobile-ops-item="true"'));
});

test("admin sessions card no longer uses matchMedia or MOBILE_PAGE_SIZE as a source of truth", () => {
  const source = read(CARD_PATH);

  assert.equal(source.includes("matchMedia"), false);
  assert.equal(source.includes("MOBILE_PAGE_SIZE"), false);
  assert.equal(source.includes("isDesktopViewport"), false);
  assert.equal(source.includes("isMobileViewport"), false);
});

test("admin sessions card collapses the mobile module into a single runtime", () => {
  const source = read(CARD_PATH);
  const mobile = read(MOBILE_MODULE_PATH);

  assert.equal(source.includes("AdminMobileSessionsModule"), false);
  assert.ok(source.includes('import { AdminMobileOpsPager } from "./AdminMobileOpsPager";'));

  // The former mobile module keeps no data source of its own.
  assert.equal(mobile.includes("getAdminSessions"), false);
  assert.equal(mobile.includes("MOBILE_PAGE_SIZE"), false);
  assert.equal(mobile.includes("matchMedia"), false);
});

test("admin sessions card does not leak secrets or widen the network surface", () => {
  const source = read(CARD_PATH);

  for (const forbidden of [
    "sessionToken",
    "tokenHash",
    "password",
    "cookie",
    "fetch(",
    "console.log",
    "console.info",
    "dangerouslySetInnerHTML",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden marker: ${forbidden}`);
  }
});
