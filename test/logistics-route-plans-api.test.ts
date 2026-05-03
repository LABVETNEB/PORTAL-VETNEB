import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(process.cwd(), "server", "routes", "logistics-route-plans.fastify.ts"),
  "utf8",
);

const fastifyAppSource = readFileSync(
  resolve(process.cwd(), "server", "fastify-app.ts"),
  "utf8",
);

test("logistics route plans API is registered under the clinic logistics prefix", () => {
  assert.match(fastifyAppSource, /logisticsRoutePlansNativeRoutes/);
  assert.match(fastifyAppSource, /LogisticsRoutePlansNativeRoutesOptions/);
  assert.match(fastifyAppSource, /logisticsRoutePlansRoutes\?: LogisticsRoutePlansNativeRoutesOptions/);
  assert.match(fastifyAppSource, /prefix: "\/api\/logistics\/route-plans"/);
});

test("logistics route plans API exposes minimal clinic route plan endpoints", () => {
  assert.match(routeSource, /export const logisticsRoutePlansNativeRoutes/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/", async/);
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/", async/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/:routePlanId", async/);
  assert.match(routeSource, /app\.patch<[\s\S]*>\("\/:routePlanId", async/);
  assert.match(routeSource, /app\.options\("\/:routePlanId", optionsHandler\)/);
});

test("logistics route plans API exposes clinic route stop endpoints", () => {
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/:routePlanId\/stops", async/);
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/:routePlanId\/stops", async/);
  assert.match(routeSource, /app\.patch<[\s\S]*>\("\/:routePlanId\/stops\/:routeStopId", async/);
  assert.match(routeSource, /app\.options\("\/:routePlanId\/stops", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/:routePlanId\/stops\/:routeStopId", optionsHandler\)/);
});

test("logistics route plans API authenticates clinic users with existing session machinery", () => {
  assert.match(routeSource, /getSessionToken\(request\)/);
  assert.match(routeSource, /ENV\.cookieName/);
  assert.match(routeSource, /deps\.hashSessionToken\(token\)/);
  assert.match(routeSource, /deps\.getActiveSessionByToken\(tokenHash\)/);
  assert.match(routeSource, /deps\.getClinicUserById\(session\.clinicUserId\)/);
  assert.match(routeSource, /deps\.updateSessionLastAccess\(tokenHash\)/);
});

test("logistics route plans API wires route plan DB helpers through injectable deps", () => {
  assert.match(routeSource, /createRoutePlan\?:/);
  assert.match(routeSource, /getClinicScopedRoutePlan\?:/);
  assert.match(routeSource, /listClinicRoutePlans\?:/);
  assert.match(routeSource, /updateClinicScopedRoutePlan\?:/);
  assert.match(routeSource, /dbLogistics\.createRoutePlan/);
  assert.match(routeSource, /dbLogistics\.getClinicScopedRoutePlan/);
  assert.match(routeSource, /dbLogistics\.listClinicRoutePlans/);
  assert.match(routeSource, /dbLogistics\.updateClinicScopedRoutePlan/);
});

test("logistics route plans API wires route stop DB helpers through injectable deps", () => {
  assert.match(routeSource, /createRouteStopForClinicRoutePlan\?:/);
  assert.match(routeSource, /listRouteStopsForClinicRoutePlan\?:/);
  assert.match(routeSource, /updateClinicScopedRouteStop\?:/);
  assert.match(routeSource, /dbLogistics\.createRouteStopForClinicRoutePlan/);
  assert.match(routeSource, /dbLogistics\.listRouteStopsForClinicRoutePlan/);
  assert.match(routeSource, /dbLogistics\.updateClinicScopedRouteStop/);
});

test("logistics route plans API keeps all route plan operations clinic scoped", () => {
  assert.match(routeSource, /clinicId: auth\.clinicId/);
  assert.match(routeSource, /deps\.listClinicRoutePlans\(params\)/);
  assert.match(routeSource, /deps\.getClinicScopedRoutePlan\(\s*routePlanId,\s*auth\.clinicId,\s*\)/);
  assert.match(routeSource, /deps\.updateClinicScopedRoutePlan\(\s*routePlanId,\s*auth\.clinicId,\s*parsed\.input,\s*\)/);
});

test("logistics route plans API validates route plan contract before DB calls", () => {
  assert.match(routeSource, /ROUTE_PLAN_STATUSES/);
  assert.match(routeSource, /ROUTE_PLANNING_MODES/);
  assert.match(routeSource, /ROUTE_PLAN_OBJECTIVES/);
  assert.match(routeSource, /parseDateField\(body\.serviceDate, "serviceDate"\)/);
  assert.match(routeSource, /parsePositiveInt\(request\.query\.limit, 50, 100\)/);
  assert.match(routeSource, /parseOffset\(request\.query\.offset\)/);
});

test("logistics route plans API validates route stop contract before DB calls", () => {
  assert.match(routeSource, /ROUTE_STOP_STATUSES/);
  assert.match(routeSource, /function buildCreateRouteStopInput/);
  assert.match(routeSource, /parsePositiveIntegerField\(\s*body\.fieldVisitId,\s*"fieldVisitId",\s*\)/);
  assert.match(routeSource, /parsePositiveIntegerField\(body\.sequence, "sequence"\)/);
  assert.match(routeSource, /parseOptionalDateField\(body\.etaStart, "etaStart"\)/);
  assert.match(routeSource, /parseOptionalDateField\(body\.etaEnd, "etaEnd"\)/);
});

test("logistics route plans API serializes route plans and stops with stable public shape", () => {
  assert.match(routeSource, /function serializeRoutePlan/);
  assert.match(routeSource, /serviceDate: serializeDate\(routePlan\.serviceDate\)/);
  assert.match(routeSource, /planningMode: routePlan\.planningMode/);
  assert.match(routeSource, /function serializeRouteStop/);
  assert.match(routeSource, /routePlanId: routeStop\.routePlanId/);
  assert.match(routeSource, /sequence: routeStop\.sequence/);
});

test("logistics route plans API keeps unsafe methods behind trusted-origin checks", () => {
  assert.match(routeSource, /const UNSAFE_METHODS = new Set\(\["POST", "PUT", "PATCH", "DELETE"\]\)/);
  assert.match(routeSource, /function enforceTrustedOrigin/);
  assert.match(routeSource, /if \(!enforceTrustedOrigin\(request, reply, allowedOrigins\)\)/);
  assert.match(routeSource, /Origen no permitido/);
});
