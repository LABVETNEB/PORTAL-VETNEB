import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const API_CLIENT_PATH = "frontend/src/lib/api.ts";

test("frontend logistics api client does not import logistics mock datasets", () => {
  const source = read(API_CLIENT_PATH);

  assert.equal(source.includes("MOCK_FIELD_VISITS"), false);
  assert.equal(source.includes("MOCK_ROUTE_PLANS"), false);
  assert.equal(source.includes("MOCK_ROUTE_METRICS"), false);
});

test("frontend logistics api client uses real logistics endpoints", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes('"/api/logistics/field-visits"'));
  assert.ok(source.includes('"/api/logistics/route-plans"'));
  assert.ok(source.includes("`/api/logistics/route-plans/${planId}/metrics`"));
});

test("frontend logistics api client returns empty state instead of mock fallback", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(
    source.includes(
      'console.warn("[API] getLogisticsFieldVisits: endpoint no disponible")',
    ),
  );
  assert.ok(
    source.includes(
      'console.warn("[API] getRoutePlans: endpoint no disponible")',
    ),
  );
  assert.ok(
    source.includes(
      'console.warn("[API] getRoutePlanMetrics: endpoint no disponible")',
    ),
  );
  assert.ok(
    source.includes(
      'console.warn("[API] getRoutePlanMetrics: requiere planId para usar endpoint real")',
    ),
  );
});
