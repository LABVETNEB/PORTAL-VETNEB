// test/frontend-csp-report-endpoint-contract.test.ts
// VETNEB #748 - Contract tests for /api/security/csp-report.
//
// Two layers:
//   1) Source-level contract: the route.ts file must contain certain
//      structural guarantees (no console.log of raw payload, redaction,
//      size limit, accepted content types).
//   2) Functional: import POST/GET/etc and assert response shapes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  POST,
  GET,
  PUT,
  PATCH,
  DELETE,
  OPTIONS,
  HEAD,
} from "../frontend/src/app/api/security/csp-report/route.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROUTE_SOURCE_PATH = resolve(
  __dirname,
  "../frontend/src/app/api/security/csp-report/route.ts",
);
const ROUTE_SOURCE = readFileSync(ROUTE_SOURCE_PATH, "utf8");

// ----- Source-level contract -----

test("source: declares Node runtime", () => {
  assert.match(ROUTE_SOURCE, /runtime\s*=\s*["']nodejs["']/);
});

test("source: declares dynamic = force-dynamic", () => {
  assert.match(ROUTE_SOURCE, /dynamic\s*=\s*["']force-dynamic["']/);
});

test("source: accepts application/csp-report content type", () => {
  assert.match(ROUTE_SOURCE, /application\/csp-report/);
});

test("source: accepts application/reports+json content type", () => {
  assert.match(ROUTE_SOURCE, /application\/reports\+json/);
});

test("source: has a 16 KB body size guard", () => {
  // Allow either "16 * 1024" literal or "16384"
  assert.ok(
    /16\s*\*\s*1024/.test(ROUTE_SOURCE) || /\b16384\b/.test(ROUTE_SOURCE),
    "expected a 16 KB body size constant in route source",
  );
});

test("source: never logs raw payload via console.log/info/debug/table", () => {
  // Allow console.warn only with the sanitized object label.
  assert.ok(
    !/console\.log\s*\(/.test(ROUTE_SOURCE),
    "console.log must not appear",
  );
  assert.ok(
    !/console\.info\s*\(/.test(ROUTE_SOURCE),
    "console.info must not appear",
  );
  assert.ok(
    !/console\.debug\s*\(/.test(ROUTE_SOURCE),
    "console.debug must not appear",
  );
  assert.ok(
    !/console\.table\s*\(/.test(ROUTE_SOURCE),
    "console.table must not appear",
  );
});

test("source: redacts script-sample / sample fields", () => {
  assert.match(ROUTE_SOURCE, /\[redacted\]/);
});

test("source: strips query and hash from URLs", () => {
  assert.ok(
    /split\(["']\?["']\)/.test(ROUTE_SOURCE) &&
      /split\(["']#["']\)/.test(ROUTE_SOURCE),
    "expected query and hash stripping in URL sanitization",
  );
});

test("source: imports no new runtime dependencies", () => {
  // Only allowed imports: none (handler uses Web standard Request/Response).
  // Specifically must NOT import next/server, next/headers, axios, etc.
  assert.ok(
    !/from\s+["']next\/server["']/.test(ROUTE_SOURCE),
    "must not import next/server",
  );
  assert.ok(
    !/from\s+["']next\/headers["']/.test(ROUTE_SOURCE),
    "must not import next/headers",
  );
  assert.ok(
    !/from\s+["']axios["']/.test(ROUTE_SOURCE),
    "must not import axios",
  );
});

test("source: does not use browser storage", () => {
  assert.ok(!/localStorage/.test(ROUTE_SOURCE));
  assert.ok(!/sessionStorage/.test(ROUTE_SOURCE));
  assert.ok(!/indexedDB/i.test(ROUTE_SOURCE));
});

test("source: does not preserve original-policy field", () => {
  // We deliberately drop original-policy. Sanity check.
  assert.ok(!/originalPolicy/.test(ROUTE_SOURCE));
  assert.ok(!/original-policy/.test(ROUTE_SOURCE));
});

// ----- Functional contract -----

function makeRequest(
  body: string,
  contentType = "application/csp-report",
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/security/csp-report", {
    method: "POST",
    headers: { "content-type": contentType, ...extraHeaders },
    body,
  });
}

test("POST returns 204 for legacy { csp-report } payload", async () => {
  const body = JSON.stringify({
    "csp-report": {
      "document-uri": "https://example.test/?token=secret",
      "blocked-uri": "https://evil.test/x.js?secret=1",
      "violated-directive": "script-src",
      "script-sample": "alert(document.cookie)",
    },
  });
  const res = await POST(makeRequest(body));
  assert.equal(res.status, 204);
});

test("POST returns 204 for Reporting API array payload", async () => {
  const body = JSON.stringify([
    {
      type: "csp-violation",
      age: 0,
      url: "https://example.test/",
      body: {
        documentURL: "https://example.test/?token=secret",
        blockedURL: "https://evil.test/x.js",
        effectiveDirective: "script-src-elem",
        disposition: "report",
        sample: "alert(1)",
      },
    },
  ]);
  const res = await POST(makeRequest(body, "application/reports+json"));
  assert.equal(res.status, 204);
});

test("POST returns 415 for unsupported content type", async () => {
  const res = await POST(makeRequest("{}", "text/plain"));
  assert.equal(res.status, 415);
});

test("POST returns 413 when content-length declares > 16 KB", async () => {
  const big = "x".repeat(8); // tiny body, but lie about length
  const res = await POST(
    makeRequest(big, "application/csp-report", {
      "content-length": String(64 * 1024),
    }),
  );
  assert.equal(res.status, 413);
});

test("POST returns 413 when actual body length > 16 KB", async () => {
  const big = JSON.stringify({ "csp-report": { x: "a".repeat(32 * 1024) } });
  const res = await POST(makeRequest(big));
  assert.equal(res.status, 413);
});

test("POST measures the actual body limit in UTF-8 bytes", async () => {
  const big = JSON.stringify({ "csp-report": { x: "á".repeat(9 * 1024) } });
  assert.ok(big.length < 16 * 1024);
  assert.ok(Buffer.byteLength(big, "utf8") > 16 * 1024);

  const res = await POST(makeRequest(big));
  assert.equal(res.status, 413);
});

test("POST returns 204 silently on invalid JSON", async () => {
  const res = await POST(makeRequest("not json at all"));
  assert.equal(res.status, 204);
});

test("POST returns 204 on empty body", async () => {
  const res = await POST(makeRequest(""));
  assert.equal(res.status, 204);
});

test("GET returns 405 with Allow: POST", async () => {
  const res = await GET();
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "POST");
});

test("PUT/PATCH/DELETE/OPTIONS/HEAD return 405", async () => {
  for (const handler of [PUT, PATCH, DELETE, OPTIONS, HEAD]) {
    const res = await handler();
    assert.equal(res.status, 405);
  }
});

test("POST does not echo raw payload in response body", async () => {
  const secret = "VERY_SECRET_TOKEN_DO_NOT_ECHO";
  const body = JSON.stringify({
    "csp-report": { "document-uri": `https://x.test/?t=${secret}` },
  });
  const res = await POST(makeRequest(body));
  const text = await res.text();
  assert.equal(text, "", "204 response must have empty body");
});

// ─── Payload contract additions (#752) ───────────────────────────────────────
// Browsers send content-type parameters (charset), flat bodies without the
// csp-report wrapper, application/json as a fallback, and Reporting API batches
// that may contain mixed report types. These four cases were not covered above.

test("POST accepts application/csp-report with charset parameter (browsers send this)", async () => {
  // Browsers commonly send: Content-Type: application/csp-report; charset=utf-8
  // extractBaseContentType() must strip the parameter before the Set lookup.
  const body = JSON.stringify({
    "csp-report": { "violated-directive": "script-src" },
  });
  const res = await POST(
    makeRequest(body, "application/csp-report; charset=utf-8"),
  );
  assert.equal(
    res.status,
    204,
    "content-type with charset parameter must not be rejected as 415",
  );
});

test("POST accepts application/json content type (functional)", async () => {
  // application/json is listed as an accepted fallback for tests / curl.
  // Verify the functional path, not just the source constant.
  const body = JSON.stringify({
    "csp-report": { "violated-directive": "style-src" },
  });
  const res = await POST(makeRequest(body, "application/json"));
  assert.equal(res.status, 204);
});

test("POST returns 204 for flat body without csp-report wrapper", async () => {
  // pickReportBody() treats a bare object with no recognized wrapper as flat body.
  // This covers test clients and edge cases where browsers omit the wrapper.
  const body = JSON.stringify({
    effectiveDirective: "img-src",
    documentURL: "https://example.test/page",
    disposition: "report",
  });
  const res = await POST(makeRequest(body));
  assert.equal(res.status, 204);
});

test("POST returns 204 silently for Reporting API array with no csp-violation entries", async () => {
  // A browser may batch mixed report types. Entries with unknown types must be
  // ignored gracefully. pickReportBody() returns null; endpoint must still 204.
  const body = JSON.stringify([
    { type: "deprecation", age: 0, url: "https://example.test/", body: {} },
    { type: "intervention", age: 0, url: "https://example.test/", body: {} },
  ]);
  const res = await POST(makeRequest(body, "application/reports+json"));
  assert.equal(res.status, 204);
});
