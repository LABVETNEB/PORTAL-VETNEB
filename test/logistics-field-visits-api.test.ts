import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(process.cwd(), "server", "routes", "logistics-field-visits.fastify.ts"),
  "utf8",
);

const fastifyAppSource = readFileSync(
  resolve(process.cwd(), "server", "fastify-app.ts"),
  "utf8",
);

test("logistics field visit API is registered under the clinic logistics prefix", () => {
  assert.match(fastifyAppSource, /logisticsFieldVisitsNativeRoutes/);
  assert.match(fastifyAppSource, /LogisticsFieldVisitsNativeRoutesOptions/);
  assert.match(fastifyAppSource, /logisticsFieldVisitsRoutes\?: LogisticsFieldVisitsNativeRoutesOptions/);
  assert.match(fastifyAppSource, /prefix: "\/api\/logistics\/field-visits"/);
});

test("logistics field visit API exposes minimal clinic endpoints", () => {
  assert.match(routeSource, /export const logisticsFieldVisitsNativeRoutes/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/", async/);
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/", async/);
  assert.match(routeSource, /app\.patch<[\s\S]*>\("\/:fieldVisitId", async/);
  assert.match(routeSource, /app\.options\("\/", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/:fieldVisitId", optionsHandler\)/);
});

test("logistics field visit API authenticates clinic users with existing session machinery", () => {
  assert.match(routeSource, /getSessionToken\(request\)/);
  assert.match(routeSource, /ENV\.cookieName/);
  assert.match(routeSource, /deps\.hashSessionToken\(token\)/);
  assert.match(routeSource, /deps\.getActiveSessionByToken\(tokenHash\)/);
  assert.match(routeSource, /deps\.getClinicUserById\(session\.clinicUserId\)/);
  assert.match(routeSource, /deps\.updateSessionLastAccess\(tokenHash\)/);
  assert.match(routeSource, /buildClearSessionCookie\(\)/);
});

test("logistics field visit API keeps all reads and writes clinic scoped", () => {
  assert.match(routeSource, /clinicId: auth\.clinicId/);
  assert.match(routeSource, /deps\.listClinicFieldVisits\(params\)/);
  assert.match(routeSource, /buildCreateFieldVisitInput\(request\.body, auth\.clinicId\)/);
  assert.match(routeSource, /deps\.createFieldVisit\(parsed\.input\)/);
  assert.match(routeSource, /deps\.updateClinicScopedFieldVisit\(\s*fieldVisitId,\s*auth\.clinicId,\s*parsed\.input,\s*\)/);
});

test("logistics field visit API validates contracts and pagination before calling DB helpers", () => {
  assert.match(routeSource, /FIELD_VISIT_SOURCE_TYPES/);
  assert.match(routeSource, /FIELD_VISIT_STATUSES/);
  assert.match(routeSource, /parsePositiveInt\(request\.query\.limit, 50, 100\)/);
  assert.match(routeSource, /parseOffset\(request\.query\.offset\)/);
  assert.match(routeSource, /parseFieldVisitStatus\(request\.query\.status\)/);
  assert.match(routeSource, /parseFieldVisitSourceType\(request\.query\.sourceType\)/);
  assert.match(routeSource, /parseNonNegativeIntegerField\([\s\S]*body\.serviceDurationMin/);
});

test("logistics field visit API keeps unsafe methods behind trusted-origin checks", () => {
  assert.match(routeSource, /const UNSAFE_METHODS = new Set\(\["POST", "PUT", "PATCH", "DELETE"\]\)/);
  assert.match(routeSource, /function enforceTrustedOrigin/);
  assert.match(routeSource, /if \(!enforceTrustedOrigin\(request, reply, allowedOrigins\)\)/);
  assert.match(routeSource, /Origen no permitido/);
});


test("logistics field visit API exposes clinic-scoped location endpoints", () => {
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/:fieldVisitId\/location", async/);
  assert.match(routeSource, /app\.put<[\s\S]*>\("\/:fieldVisitId\/location", async/);
  assert.match(routeSource, /app\.options\("\/:fieldVisitId\/location", optionsHandler\)/);
  assert.match(routeSource, /GET,POST,PUT,PATCH,OPTIONS/);
});

test("logistics field visit API wires visit location DB helpers through injectable deps", () => {
  assert.match(routeSource, /getVisitLocationForClinicVisit\?:/);
  assert.match(routeSource, /upsertVisitLocationForClinicVisit\?:/);
  assert.match(routeSource, /dbLogistics\.getVisitLocationForClinicVisit/);
  assert.match(routeSource, /dbLogistics\.upsertVisitLocationForClinicVisit/);
  assert.match(routeSource, /deps\.getVisitLocationForClinicVisit\(\s*fieldVisitId,\s*auth\.clinicId,\s*\)/);
  assert.match(routeSource, /deps\.upsertVisitLocationForClinicVisit\(parsed\.input\)/);
});

test("logistics field visit API validates visit location payload before upsert", () => {
  assert.match(routeSource, /function buildUpsertVisitLocationInput/);
  assert.match(routeSource, /addressRaw es obligatorio/);
  assert.match(routeSource, /parseOptionalNumberField\(body\.lat, "lat"\)/);
  assert.match(routeSource, /parseOptionalNumberField\(body\.lng, "lng"\)/);
  assert.match(routeSource, /VISIT_LOCATION_GEO_QUALITIES/);
  assert.match(routeSource, /parseVisitLocationGeoQuality\(body\.geoQuality\)/);
});

test("logistics field visit API serializes visit location without exposing non-schema fields", () => {
  assert.match(routeSource, /function serializeVisitLocation/);
  assert.match(routeSource, /addressRaw: location\.addressRaw/);
  assert.match(routeSource, /geoQuality: location\.geoQuality/);
  assert.match(routeSource, /updatedAt: serializeDate\(location\.updatedAt\)/);
  assert.doesNotMatch(routeSource, /createdAt: serializeDate\(location\.createdAt\)/);
});

test("logistics field visit API keeps location writes behind trusted-origin checks", () => {
  assert.match(routeSource, /app\.put<[\s\S]*>\("\/:fieldVisitId\/location", async/);
  assert.match(routeSource, /if \(!enforceTrustedOrigin\(request, reply, allowedOrigins\)\)/);
  assert.match(routeSource, /auth\.clinicId/);
});


test("logistics field visit API exposes clinic-scoped time-window endpoints", () => {
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/:fieldVisitId\/time-windows", async/);
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/:fieldVisitId\/time-windows", async/);
  assert.match(routeSource, /app\.options\("\/:fieldVisitId\/time-windows", optionsHandler\)/);
  assert.match(routeSource, /GET,POST,PUT,PATCH,OPTIONS/);
});

test("logistics field visit API wires time-window DB helpers through injectable deps", () => {
  assert.match(routeSource, /createTimeWindowForClinicVisit\?:/);
  assert.match(routeSource, /listTimeWindowsForClinicVisit\?:/);
  assert.match(routeSource, /dbLogistics\.createTimeWindowForClinicVisit/);
  assert.match(routeSource, /dbLogistics\.listTimeWindowsForClinicVisit/);
  assert.match(routeSource, /deps\.listTimeWindowsForClinicVisit\(\s*fieldVisitId,\s*auth\.clinicId,\s*\)/);
  assert.match(routeSource, /deps\.createTimeWindowForClinicVisit\(parsed\.input\)/);
});

test("logistics field visit API validates time-window payload before create", () => {
  assert.match(routeSource, /function buildCreateTimeWindowInput/);
  assert.match(routeSource, /parseDateField\(body\.windowStart, "windowStart"\)/);
  assert.match(routeSource, /parseDateField\(body\.windowEnd, "windowEnd"\)/);
  assert.match(routeSource, /windowStart debe ser anterior a windowEnd/);
  assert.match(routeSource, /normalizeOptionalText\(body\.timezone\)/);
  assert.match(routeSource, /parseOptionalBooleanField\(body\.isHard, "isHard"\)/);
});

test("logistics field visit API serializes time windows with stable public shape", () => {
  assert.match(routeSource, /function serializeTimeWindow/);
  assert.match(routeSource, /windowStart: serializeDate\(timeWindow\.windowStart\)/);
  assert.match(routeSource, /windowEnd: serializeDate\(timeWindow\.windowEnd\)/);
  assert.match(routeSource, /timezone: timeWindow\.timezone/);
  assert.match(routeSource, /isHard: timeWindow\.isHard/);
  assert.match(routeSource, /createdAt: serializeDate\(timeWindow\.createdAt\)/);
  assert.match(routeSource, /updatedAt: serializeDate\(timeWindow\.updatedAt\)/);
});

test("logistics field visit API keeps time-window writes behind trusted-origin checks", () => {
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/:fieldVisitId\/time-windows", async/);
  assert.match(routeSource, /if \(!enforceTrustedOrigin\(request, reply, allowedOrigins\)\)/);
  assert.match(routeSource, /auth\.clinicId/);
});
