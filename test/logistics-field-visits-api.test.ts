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
