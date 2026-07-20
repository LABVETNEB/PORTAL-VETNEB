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
  assert.match(routeSource, /routeEventsRead\.listRouteEvents\(parsed\.params\)/);
  assert.match(routeSource, /routeEventsRead\.pollRouteEvents\(\s*auth\.clinicId,\s*afterId,\s*limit,\s*\)/);
  assert.match(routeSource, /routeEventsRead\.listRoutePlanEvents\(\s*routePlanId,\s*auth\.clinicId,\s*params,\s*\)/);
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
  assert.match(routeSource, /from "\.\.\/lib\/cors-headers\.ts";/);
  assert.match(routeSource, /UNSAFE_METHODS,/);
  assert.match(routeSource, /enforceTrustedOrigin,/);
  assert.match(routeSource, /getAllowedOriginForCors,/);
  assert.match(routeSource, /getAllowedOrigins,/);
  assert.match(routeSource, /getRequestOrigin,/);
  assert.match(routeSource, /function applyCorsHeaders/);
  assert.doesNotMatch(routeSource, /const UNSAFE_METHODS = new Set\(\["POST", "PUT", "PATCH", "DELETE"\]\)/);
  assert.doesNotMatch(routeSource, /function getAllowedOrigins/);
  assert.doesNotMatch(routeSource, /function normalizeOrigin/);
  assert.doesNotMatch(routeSource, /function getRequestOrigin/);
  assert.doesNotMatch(routeSource, /function enforceTrustedOrigin/);
  assert.match(routeSource, /if \(!enforceTrustedOrigin\(request, reply, allowedOrigins\)\)/);
  assert.match(routeSource, /Origen no permitido/);
});

test("logistics route events API enforces role-aware logistics route event permissions", () => {
  assert.match(routeSource, /type ClinicUserRole/);
  assert.match(routeSource, /normalizeClinicUserRole\(clinicUser\.role, "clinic_staff"\)/);
  assert.match(routeSource, /getClinicPermissions\(auth\.role\)\.canManageLogisticsRouteEvents/);
  assert.match(routeSource, /UNSAFE_METHODS\.has\(request\.method\.toUpperCase\(\)\)/);
  assert.match(routeSource, /Permisos insuficientes para logistica/);
});

test("logistics route events API audits route event creation", () => {
  assert.match(routeSource, /writeAuditLog\?:/);
  assert.match(routeSource, /writeAuditLog: audit\.writeAuditLog/);
  assert.match(routeSource, /AUDIT_EVENTS\.LOGISTICS_ROUTE_EVENT_CREATED/);
  assert.match(routeSource, /await deps\.writeAuditLog\(createAuditRequestLike\(request, auth\),/);
  assert.match(routeSource, /routeEventId: routeEvent\.id/);
  assert.match(routeSource, /eventType: routeEvent\.eventType/);
});

test("logistics route events API delegates the four data operations to M10 application use cases", () => {
  assert.match(
    routeSource,
    /import \{\s*createCreateRouteEvent,\s*createRouteEventsReadUseCases,\s*\} from "\.\.\/features\/logistics\/application\/index\.ts";/,
  );

  const writeComposition =
    /const createRouteEvent = createCreateRouteEvent\(\{\s*createRouteEvent: deps\.createRouteEvent,\s*\}\);/;
  const readComposition =
    /const routeEventsRead = createRouteEventsReadUseCases\(\{\s*listClinicRouteEvents: deps\.listClinicRouteEvents,\s*listRouteEventsForClinicRoutePlan: deps\.listRouteEventsForClinicRoutePlan,\s*listIncrementalClinicRouteEvents: deps\.listIncrementalClinicRouteEvents,\s*\}\);/;

  assert.match(routeSource, writeComposition);
  assert.match(routeSource, readComposition);

  const handlersStart = routeSource.indexOf("app.options(");
  assert.ok(handlersStart > 0, "no se encontró la región de handlers");
  assert.ok(
    routeSource.search(writeComposition) < handlersStart,
    "la composición de escritura M10 debe ocurrir antes de los handlers",
  );
  assert.ok(
    routeSource.search(readComposition) < handlersStart,
    "la composición de lectura M10 debe ocurrir antes de los handlers",
  );

  assert.match(routeSource, /const routeEvent = await createRouteEvent\(parsed\.input\);/);
  assert.match(routeSource, /await routeEventsRead\.listRouteEvents\(parsed\.params\)/);
  assert.match(routeSource, /await routeEventsRead\.pollRouteEvents\(/);
  assert.match(routeSource, /await routeEventsRead\.listRoutePlanEvents\(/);
});

test("logistics route events handlers no longer invoke the four deps directly", () => {
  const handlersStart = routeSource.indexOf("app.options(");
  assert.ok(handlersStart > 0, "no se encontró la región de handlers");

  for (const dependency of [
    "deps.createRouteEvent",
    "deps.listClinicRouteEvents",
    "deps.listRouteEventsForClinicRoutePlan",
    "deps.listIncrementalClinicRouteEvents",
  ]) {
    assert.ok(
      routeSource.lastIndexOf(dependency) < handlersStart,
      `${dependency} no debe invocarse desde los handlers`,
    );
  }

  assert.doesNotMatch(routeSource, /deps\.createRouteEvent\(parsed\.input\)/);
  assert.doesNotMatch(routeSource, /deps\.listClinicRouteEvents\(parsed\.params\)/);
  assert.doesNotMatch(routeSource, /deps\.listIncrementalClinicRouteEvents\(\s*auth\.clinicId/);
  assert.doesNotMatch(routeSource, /deps\.listRouteEventsForClinicRoutePlan\(\s*routePlanId/);
});

test("M10 keeps OPTIONS, audit ordering and HTTP responsibilities inside Fastify", () => {
  assert.match(routeSource, /app\.options\("\/", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/poll", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/route-plans\/:routePlanId", optionsHandler\)/);
  assert.match(routeSource, /const optionsHandler = async \(/);
  assert.match(routeSource, /reply\.header\("access-control-allow-methods", "GET,POST,OPTIONS"\)/);
  assert.match(routeSource, /return reply\.code\(204\)\.send\(\)/);

  assert.match(
    routeSource,
    /if \(!enforceTrustedOrigin\(request, reply, allowedOrigins\)\)[\s\S]*?authenticateClinicUser\(request, reply, deps, now\)[\s\S]*?canManageLogisticsRouteEvents[\s\S]*?buildCreateRouteEventInput\(request\.body, auth\.clinicId\)[\s\S]*?await createRouteEvent\(parsed\.input\)[\s\S]*?Plan de ruta o parada no encontrada[\s\S]*?await deps\.writeAuditLog\([\s\S]*?reply\.code\(201\)/,
  );

  assert.match(routeSource, /function serializeRouteEvent/);
  assert.match(routeSource, /routeEvents\.map\(\(routeEvent\) =>\s*serializeRouteEvent\(routeEvent\),\s*\)/);
});

test("logistics route events M10 application files stay free of HTTP and DB imports", () => {
  const applicationFiles = [
    "server/features/logistics/application/create-route-event.ts",
    "server/features/logistics/application/route-events-read-use-cases.ts",
    "server/features/logistics/application/ports/logistics-route-event-write-repository.ts",
    "server/features/logistics/application/ports/logistics-route-events-read-repository.ts",
  ] as const;
  const forbiddenSpecifierRules: Array<{ label: string; pattern: RegExp }> = [
    { label: "fastify", pattern: /^fastify(\/|$)/ },
    { label: "server/db-logistics", pattern: /db-logistics/ },
    { label: "server/db", pattern: /(^|\/)db(\.ts)?$/ },
    { label: "drizzle-orm", pattern: /^drizzle-orm(\/|$)/ },
    { label: "drizzle/schema", pattern: /drizzle\/schema/ },
    { label: "server/lib", pattern: /(^|\/)lib\// },
    { label: "server/routes", pattern: /(^|\/)routes\// },
  ];
  const violations: string[] = [];

  for (const file of applicationFiles) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    const specifiers = Array.from(
      source.matchAll(
        /\bfrom\s+["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g,
      ),
      (match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
    );

    for (const specifier of specifiers) {
      for (const { label, pattern } of forbiddenSpecifierRules) {
        if (pattern.test(specifier)) {
          violations.push(`${file}: ${label} ("${specifier}")`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});
