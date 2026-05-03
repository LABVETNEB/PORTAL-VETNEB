import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(process.cwd(), "server", "routes", "logistics-route-events.fastify.ts"),
  "utf8",
);

const fastifyAppSource = readFileSync(
  resolve(process.cwd(), "server", "fastify-app.ts"),
  "utf8",
);

test("logistics route events API is registered under the clinic logistics prefix", () => {
  assert.match(fastifyAppSource, /logisticsRouteEventsNativeRoutes/);
  assert.match(fastifyAppSource, /LogisticsRouteEventsNativeRoutesOptions/);
  assert.match(fastifyAppSource, /logisticsRouteEventsRoutes\?: LogisticsRouteEventsNativeRoutesOptions/);
  assert.match(fastifyAppSource, /prefix: "\/api\/logistics\/route-events"/);
});

test("logistics route events API exposes list, create, route-plan scoped, and polling endpoints", () => {
  assert.match(routeSource, /export const logisticsRouteEventsNativeRoutes/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/", async/);
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/", async/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/poll", async/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/route-plans\/:routePlanId", async/);
  assert.match(routeSource, /app\.options\("\/poll", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/route-plans\/:routePlanId", optionsHandler\)/);
});

test("logistics route events API authenticates clinic users with existing session machinery", () => {
  assert.match(routeSource, /getSessionToken\(request\)/);
  assert.match(routeSource, /ENV\.cookieName/);
  assert.match(routeSource, /deps\.hashSessionToken\(token\)/);
  assert.match(routeSource, /deps\.getActiveSessionByToken\(tokenHash\)/);
  assert.match(routeSource, /deps\.getClinicUserById\(session\.clinicUserId\)/);
  assert.match(routeSource, /deps\.updateSessionLastAccess\(tokenHash\)/);
});

test("logistics route events API wires route event DB helpers through injectable deps", () => {
  assert.match(routeSource, /createRouteEvent\?:/);
  assert.match(routeSource, /listClinicRouteEvents\?:/);
  assert.match(routeSource, /listRouteEventsForClinicRoutePlan\?:/);
  assert.match(routeSource, /listIncrementalClinicRouteEvents\?:/);
  assert.match(routeSource, /dbLogistics\.createRouteEvent/);
  assert.match(routeSource, /dbLogistics\.listClinicRouteEvents/);
  assert.match(routeSource, /dbLogistics\.listRouteEventsForClinicRoutePlan/);
  assert.match(routeSource, /dbLogistics\.listIncrementalClinicRouteEvents/);
});

test("logistics route events API keeps reads clinic scoped", () => {
  assert.match(routeSource, /buildListRouteEventsParams\(request\.query, auth\.clinicId\)/);
  assert.match(routeSource, /deps\.listClinicRouteEvents\(parsed\.params\)/);
  assert.match(routeSource, /deps\.listIncrementalClinicRouteEvents\(\s*auth\.clinicId,\s*afterId,\s*limit,\s*\)/);
  assert.match(routeSource, /deps\.listRouteEventsForClinicRoutePlan\(\s*routePlanId,\s*auth\.clinicId,\s*params,\s*\)/);
});

test("logistics route events API validates route event create payload before DB calls", () => {
  assert.match(routeSource, /ROUTE_EVENT_TYPES/);
  assert.match(routeSource, /ROUTE_EVENT_SOURCES/);
  assert.match(routeSource, /function buildCreateRouteEventInput/);
  assert.match(routeSource, /eventType es obligatorio/);
  assert.match(routeSource, /parseOptionalEntityId\(body\.routePlanId, "routePlanId"\)/);
  assert.match(routeSource, /parseOptionalEntityId\(body\.routeStopId, "routeStopId"\)/);
  assert.match(routeSource, /parseRouteEventPayload\(body\.payload\)/);
  assert.match(routeSource, /parseOptionalNumberField\(body\.lat, "lat"\)/);
  assert.match(routeSource, /parseOptionalNumberField\(body\.lng, "lng"\)/);
});

test("logistics route events API supports incremental polling with stable cursor output", () => {
  assert.match(routeSource, /function parseAfterId/);
  assert.match(routeSource, /const afterId = parseAfterId\(request\.query\.afterId\)/);
  assert.match(routeSource, /const lastEventId = routeEvents\.at\(-1\)\?\.id \?\? afterId/);
  assert.match(routeSource, /polling: \{\s*afterId,\s*limit,\s*\}/);
});

test("logistics route events API serializes route events with stable public shape", () => {
  assert.match(routeSource, /function serializeRouteEvent/);
  assert.match(routeSource, /id: routeEvent\.id/);
  assert.match(routeSource, /routePlanId: routeEvent\.routePlanId/);
  assert.match(routeSource, /routeStopId: routeEvent\.routeStopId/);
  assert.match(routeSource, /eventType: routeEvent\.eventType/);
  assert.match(routeSource, /eventTime: serializeDate\(routeEvent\.eventTime\)/);
  assert.match(routeSource, /payload: routeEvent\.payload/);
  assert.match(routeSource, /createdAt: serializeDate\(routeEvent\.createdAt\)/);
});

test("logistics route events API keeps event writes behind trusted-origin checks", () => {
  assert.match(routeSource, /const UNSAFE_METHODS = new Set\(\["POST", "PUT", "PATCH", "DELETE"\]\)/);
  assert.match(routeSource, /function enforceTrustedOrigin/);
  assert.match(routeSource, /if \(!enforceTrustedOrigin\(request, reply, allowedOrigins\)\)/);
  assert.match(routeSource, /Origen no permitido/);
});
