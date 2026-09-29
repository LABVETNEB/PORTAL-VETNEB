import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const API_CLIENT_PATH = "frontend/src/lib/api.ts";

test("frontend reports api client does not import report mock dataset", () => {
  const source = read(API_CLIENT_PATH);

  assert.equal(source.includes('from "@/lib/mock-data"'), false);
  assert.equal(source.includes("MOCK_REPORTS"), false);
});

test("frontend reports api client uses real reports endpoints", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getReports("));
  assert.ok(source.includes("apiFetch<{ reports: Report[] }>("));
  assert.ok(source.includes("`/api/reports${qs ? `?${qs}` : \"\"}`"));
  assert.ok(source.includes("export async function searchReports("));
  assert.ok(source.includes("`/api/reports/search${qs ? `?${qs}` : \"\"}`"));
});

test("frontend reports api client returns empty state instead of mock fallback", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(
    source.includes('console.warn("[API] getReports: endpoint no disponible")'),
  );
  assert.ok(
    source.includes(
      'console.warn("[API] searchReports: endpoint no disponible")',
    ),
  );
  assert.equal(
    source.includes('console.warn("[API] getReports: usando mock data")'),
    false,
  );
  assert.equal(
    source.includes('console.warn("[API] searchReports: usando mock data")'),
    false,
  );
});
