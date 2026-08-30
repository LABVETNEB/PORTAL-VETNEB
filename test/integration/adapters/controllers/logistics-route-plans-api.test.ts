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

test("logistics route plans API delegates clinic authentication to the canonical helper", () => {
  assert.match(routeSource, /from "\.\.\/lib\/fastify-clinic-auth\.ts"/);
  assert.match(routeSource, /authenticateFastifyClinicUser\(request, reply, deps, now\)/);
  assert.match(routeSource, /getActiveSessionByToken\?:/);
  assert.match(routeSource, /getClinicUserById\?:/);
  assert.match(routeSource, /updateSessionLastAccess\?:/);
});

test("logistics route plans API wires route plan DB helpers through injectable deps", () => {
  assert.match(routeSource, /createRoutePlan\?:/);
  assert.match(routeSource, /getClinicScopedRoutePlan\?:/);
  assert.match(routeSource, /listClinicRoutePlans\?:/);
  assert.match(routeSource, /updateClinicScopedRoutePlan\?:/);
  assert.match(routeSource, /routePlansDb\.createRoutePlan/);
  assert.match(routeSource, /routePlansDb\.getClinicScopedRoutePlan/);
  assert.match(routeSource, /routePlansDb\.listClinicRoutePlans/);
  assert.match(routeSource, /routePlansDb\.updateClinicScopedRoutePlan/);
});

test("logistics route plans API wires route stop DB helpers through injectable deps", () => {
  assert.match(routeSource, /createRouteStopForClinicRoutePlan\?:/);
  assert.match(routeSource, /listRouteStopsForClinicRoutePlan\?:/);
  assert.match(routeSource, /updateClinicScopedRouteStop\?:/);
  assert.match(routeSource, /routePlansDb\.createRouteStopForClinicRoutePlan/);
  assert.match(routeSource, /routePlansDb\.listRouteStopsForClinicRoutePlan/);
  assert.match(routeSource, /routePlansDb\.updateClinicScopedRouteStop/);
});

test("logistics route plans API keeps all route plan operations clinic scoped", () => {
  assert.match(routeSource, /clinicId: auth\.clinicId/);
  // M14: el listado se resuelve vía el caso de uso de cache con params
  // clinic-scoped construidos en la ruta.
  assert.match(routeSource, /routePlansCache\.getRoutePlansListSnapshot\(\s*params,/);
  assert.match(routeSource, /routePlansRead\.getRoutePlan\(\s*routePlanId,\s*auth\.clinicId,\s*\)/);
  assert.match(routeSource, /routePlansWrite\.updateRoutePlan\(\s*routePlanId,\s*auth\.clinicId,\s*parsed\.input,\s*\)/);
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


test("logistics route plans API exposes release lifecycle endpoints", () => {
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/:routePlanId\/release", async/);
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/:routePlanId\/start", async/);
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/:routePlanId\/complete", async/);
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/:routePlanId\/cancel", async/);
  assert.match(routeSource, /app\.options\("\/:routePlanId\/release", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/:routePlanId\/cancel", optionsHandler\)/);
});

test("logistics route plans API wires lifecycle transition helper through injectable deps", () => {
  assert.match(routeSource, /transitionClinicScopedRoutePlanStatus\?:/);
  assert.match(routeSource, /RoutePlanLifecycleAction/);
  assert.match(routeSource, /RoutePlanLifecycleTransitionResult/);
  assert.match(routeSource, /routePlansDb\.transitionClinicScopedRoutePlanStatus/);
  // release/start/complete (fuera de M08) conservan la llamada directa a la dep
  // vía el default del helper de lifecycle.
  assert.match(routeSource, /deps\.transitionClinicScopedRoutePlanStatus\(\s*routePlanId,\s*clinicId,\s*action\s*\)/);
});

test("logistics route plans API keeps lifecycle writes clinic scoped and trusted-origin protected", () => {
  assert.match(routeSource, /function getLifecycleActionError/);
  assert.match(routeSource, /async function handleRoutePlanLifecycleAction/);
  assert.match(routeSource, /if \(!enforceTrustedOrigin\(request, reply, allowedOrigins\)\)/);
  assert.match(routeSource, /auth\.clinicId/);
  assert.match(routeSource, /currentStatus: result\.currentStatus/);
  assert.match(routeSource, /Transicion de estado no permitida/);
});

test("logistics route plans API exposes heuristic generation endpoint", () => {
  assert.match(routeSource, /app\.options\("\/heuristic", optionsHandler\)/);
  assert.match(routeSource, /app\.post<[\s\S]*>\("\/heuristic", async/);
  assert.match(routeSource, /buildGenerateHeuristicRoutePlanInput/);
  assert.match(routeSource, /await generateHeuristicRoutePlan\(parsed\.input\)/);
  assert.match(routeSource, /createRuntimeTimer/);
  assert.match(routeSource, /planningDurationMs/);
  assert.match(routeSource, /planning:\s*{\s*mode: "heuristic"/);
});

test("logistics route plans API wires heuristic generation through injectable deps", () => {
  assert.match(routeSource, /GenerateHeuristicRoutePlanInput/);
  assert.match(routeSource, /GenerateHeuristicRoutePlanResult/);
  assert.match(routeSource, /generateHeuristicRoutePlan\?:/);
  assert.match(routeSource, /routePlansDb\.generateHeuristicRoutePlan/);
  assert.match(routeSource, /options\.generateHeuristicRoutePlan/);
});

test("logistics route plans API validates heuristic generation input before DB calls", () => {
  assert.match(routeSource, /parseFieldVisitIds/);
  assert.match(routeSource, /const MAX_ROUTE_PLAN_FIELD_VISIT_IDS = 100/);
  assert.match(routeSource, /if \(value\.length > MAX_ROUTE_PLAN_FIELD_VISIT_IDS\)/);
  assert.match(
    routeSource,
    /fieldVisitIds no puede incluir mas de \$\{MAX_ROUTE_PLAN_FIELD_VISIT_IDS\} visitas/,
  );
  assert.match(routeSource, /fieldVisitIds debe incluir al menos una visita/);
  assert.match(routeSource, /parseOptionalRoutePlanningPoint/);
  assert.match(routeSource, /startLocation debe incluir lat\/lng validos/);
  assert.match(routeSource, /parseOptionalPositiveNumberField/);
  assert.match(routeSource, /travelSpeedKmh/);
  assert.match(routeSource, /fallbackLegMinutes/);
});

test("logistics route plans API keeps heuristic planning call behind 400 validation cut-off", () => {
  assert.match(
    routeSource,
    /const parsed = buildGenerateHeuristicRoutePlanInput\([\s\S]*?if \(!parsed\.input\) {[\s\S]*?return reply\.code\(400\)\.send\({[\s\S]*?}\);\s*}\s*const planningTimer = createRuntimeTimer\(\);\s*const result = await generateHeuristicRoutePlan\(parsed\.input\);/,
  );
});

test("logistics route plans API keeps heuristic generation clinic scoped and trusted-origin protected", () => {
  assert.match(routeSource, /if \(!enforceTrustedOrigin\(request, reply, allowedOrigins\)\)/);
  assert.match(routeSource, /auth\.clinicId/);
  assert.match(routeSource, /createdByType: "clinic"/);
  assert.match(routeSource, /createdById,/);
  assert.match(routeSource, /missingFieldVisitIds/);
});

test("logistics route plans API exposes route compliance metrics endpoint", () => {
  assert.match(routeSource, /calculateRouteStopComplianceMetrics/);
  assert.match(routeSource, /RouteStopComplianceInput/);
  assert.match(routeSource, /buildRouteStopComplianceInputs/);
  assert.match(routeSource, /"\/:routePlanId\/metrics"/);
  // M14: plan y stops clinic-scoped se resuelven dentro del caso de uso de
  // cache; el cálculo puro de métricas sigue en el serializer de la ruta.
  assert.match(
    routeSource,
    /routePlansCache\.getRoutePlanMetricsSnapshot\(\s*\{\s*clinicId: auth\.clinicId,\s*routePlanId,/,
  );
  assert.match(routeSource, /metrics: calculateRouteStopComplianceMetrics\(metricInputs\.inputs\)/);
});

test("logistics route plans API validates route compliance metrics tolerances", () => {
  assert.match(routeSource, /distanceTolerancePercent/);
  assert.match(routeSource, /timeToleranceMin/);
  assert.match(routeSource, /toleranceMin/);
  assert.match(routeSource, /parseOptionalPositiveNumberField\(\s*query\.distanceTolerancePercent/);
  assert.match(routeSource, /parseOptionalPositiveNumberField\(\s*query\.timeToleranceMin/);
  assert.match(routeSource, /parseOptionalPositiveNumberField\(\s*query\.toleranceMin/);
});

test("logistics route plans API enforces role-aware logistics route plan permissions", () => {
  assert.match(routeSource, /fastify-clinic-auth\.ts/);
  assert.match(routeSource, /authenticateFastifyClinicUser/);
  assert.match(routeSource, /getClinicPermissions\(auth\.role\)\.canManageLogisticsRoutePlans/);
  assert.match(routeSource, /UNSAFE_METHODS\.has\(request\.method\.toUpperCase\(\)\)/);
  assert.match(routeSource, /Permisos insuficientes para logistica/);
});

test("logistics route plans API audits lifecycle transitions", () => {
  assert.match(routeSource, /writeAuditLog\?:/);
  assert.match(routeSource, /writeAuditLog: audit\.writeAuditLog/);
  assert.match(routeSource, /AUDIT_EVENTS\.LOGISTICS_ROUTE_PLAN_LIFECYCLE_CHANGED/);
  assert.match(routeSource, /await deps\.writeAuditLog\(createAuditRequestLike\(request, auth\),/);
  assert.match(routeSource, /routePlanId,/);
  assert.match(routeSource, /action,/);
});

test("logistics route plans API delegates read and heuristic flows to the M07 application use cases", () => {
  // 1. La ruta importa los casos de uso de lectura/heuristic desde el barrel.
  //    (La lista de miembros del import crece con M08; se comprueba presencia.)
  assert.match(routeSource, /from "\.\.\/features\/logistics\/application\/index\.ts";/);
  assert.match(routeSource, /createRoutePlansReadUseCases,/);
  assert.match(routeSource, /createGenerateHeuristicRoutePlan,/);

  // 2. Los puertos se adaptan desde el seam LogisticsRoutePlansNativeRoutesOptions
  //    (deps ya resueltas), una sola vez a nivel plugin, antes de registrar
  //    handlers.
  const readCompositionPattern =
    /const routePlansRead = createRoutePlansReadUseCases\(\{\s*listClinicRoutePlans:\s*deps\.listClinicRoutePlans,\s*getClinicScopedRoutePlan:\s*deps\.getClinicScopedRoutePlan,\s*listRouteStopsForClinicRoutePlan:\s*deps\.listRouteStopsForClinicRoutePlan,\s*\}\);/;
  const heuristicCompositionPattern =
    /const generateHeuristicRoutePlan = createGenerateHeuristicRoutePlan\(\{\s*generateHeuristicRoutePlan:\s*deps\.generateHeuristicRoutePlan,\s*\}\);/;
  assert.match(routeSource, readCompositionPattern);
  assert.match(routeSource, heuristicCompositionPattern);

  const handlersStart = routeSource.indexOf("app.options(");
  assert.ok(handlersStart > 0, "no se encontró la región de handlers");
  assert.ok(
    routeSource.search(readCompositionPattern) < handlersStart,
    "la composición de lecturas debe ocurrir antes de los handlers",
  );
  assert.ok(
    routeSource.search(heuristicCompositionPattern) < handlersStart,
    "la composición del generador debe ocurrir antes de los handlers",
  );

  // 3–4. Ningún handler invoca directamente las deps de lectura/heuristic: cada
  //      `deps.<op>` de estas cuatro operaciones sólo aparece en la zona de
  //      composición (antes de los handlers). La adaptación desde deps es legítima.
  for (const op of [
    "deps.listClinicRoutePlans",
    "deps.getClinicScopedRoutePlan",
    "deps.listRouteStopsForClinicRoutePlan",
    "deps.generateHeuristicRoutePlan",
  ]) {
    assert.ok(
      routeSource.lastIndexOf(op) < handlersStart,
      `${op} no debe invocarse dentro de un handler (sólo en composición)`,
    );
  }

  // Los handlers delegan en los casos de uso. (Desde M14 el listado cacheado
  // delega en el caso de uso de cache; detalle y stops siguen en routePlansRead.)
  assert.match(routeSource, /await routePlansCache\.getRoutePlansListSnapshot\(/);
  assert.match(routeSource, /await routePlansRead\.getRoutePlan\(/);
  assert.match(routeSource, /routePlansRead\.listRoutePlanStops\(/);
  assert.match(routeSource, /await generateHeuristicRoutePlan\(parsed\.input\)/);

  // 5. La carga default sigue en el loader, desde M14 vía el adapter DB de infrastructure.
  assert.match(routeSource, /routePlansDb\.listClinicRoutePlans/);
  assert.match(routeSource, /routePlansDb\.getClinicScopedRoutePlan/);
  assert.match(routeSource, /routePlansDb\.listRouteStopsForClinicRoutePlan/);
  assert.match(routeSource, /routePlansDb\.generateHeuristicRoutePlan/);

  // Las escrituras (create/update de plan y stop) y el lifecycle cancel se
  // delegan en application a partir de M08; su contrato vive en el test dedicado.
});

test("logistics route plans application layer (M07) stays free of HTTP and DB imports", () => {
  const applicationFiles = [
    "server/features/logistics/application/route-plans-read-use-cases.ts",
    "server/features/logistics/application/generate-heuristic-route-plan.ts",
    "server/features/logistics/application/ports/logistics-route-plans-read-repository.ts",
    "server/features/logistics/application/ports/logistics-route-plan-generator.ts",
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

test("logistics route plans API delegates write and cancel flows to the M08 application use cases", () => {
  // 1. La ruta importa los casos de uso de escritura y cancel desde el barrel.
  assert.match(
    routeSource,
    /import \{\s*createCancelRoutePlan,\s*createGenerateHeuristicRoutePlan,\s*createRoutePlansCacheUseCases,\s*createRoutePlansReadUseCases,\s*createRoutePlansWriteUseCases,\s*createRouteStopsWriteUseCases,\s*\} from "\.\.\/features\/logistics\/application\/index\.ts";/,
  );

  // 2. Los tres adaptadores M08 se componen desde deps, una sola vez, antes de
  //    registrar handlers.
  const plansWritePattern =
    /const routePlansWrite = createRoutePlansWriteUseCases\(\{\s*createRoutePlan:\s*deps\.createRoutePlan,\s*updateClinicScopedRoutePlan:\s*deps\.updateClinicScopedRoutePlan,\s*\}\);/;
  const stopsWritePattern =
    /const routeStopsWrite = createRouteStopsWriteUseCases\(\{\s*createRouteStopForClinicRoutePlan:\s*deps\.createRouteStopForClinicRoutePlan,\s*updateClinicScopedRouteStop:\s*deps\.updateClinicScopedRouteStop,\s*\}\);/;
  const cancelPattern =
    /const cancelRoutePlan = createCancelRoutePlan\(\{\s*cancelClinicScopedRoutePlan:\s*\(id, clinicId\) =>\s*deps\.transitionClinicScopedRoutePlanStatus\(id, clinicId, "cancel"\),\s*\}\);/;
  assert.match(routeSource, plansWritePattern);
  assert.match(routeSource, stopsWritePattern);
  assert.match(routeSource, cancelPattern);

  const handlersStart = routeSource.indexOf("app.options(");
  assert.ok(handlersStart > 0, "no se encontró la región de handlers");
  for (const pattern of [plansWritePattern, stopsWritePattern, cancelPattern]) {
    assert.ok(
      routeSource.search(pattern) < handlersStart,
      "la composición de escritura/cancel debe ocurrir antes de los handlers",
    );
  }

  // 3. Ningún handler invoca directamente las deps de escritura de plan/stop:
  //    cada `deps.<op>` sólo aparece en la zona de composición.
  for (const op of [
    "deps.createRoutePlan",
    "deps.updateClinicScopedRoutePlan",
    "deps.createRouteStopForClinicRoutePlan",
    "deps.updateClinicScopedRouteStop",
  ]) {
    assert.ok(
      routeSource.lastIndexOf(op) < handlersStart,
      `${op} no debe invocarse dentro de un handler (sólo en composición)`,
    );
  }

  // Los handlers de escritura delegan en los casos de uso.
  assert.match(routeSource, /await routePlansWrite\.createRoutePlan\(parsed\.input\)/);
  assert.match(routeSource, /await routePlansWrite\.updateRoutePlan\(/);
  assert.match(routeSource, /await routeStopsWrite\.createRouteStop\(parsed\.input\)/);
  assert.match(routeSource, /await routeStopsWrite\.updateRouteStop\(/);

  // 4. Sólo cancel se rutea por el caso de uso: su registración pasa
  //    `cancelRoutePlan` como transición al helper compartido.
  assert.match(
    routeSource,
    /handleRoutePlanLifecycleAction\("cancel", request, reply, cancelRoutePlan\)/,
  );

  // 5. release/start/complete permanecen fuera de M08: registran con 3 args y
  //    usan el default del helper (deps.transition), sin pasar caso de uso.
  for (const action of ["release", "start", "complete"]) {
    const pattern = new RegExp(
      `handleRoutePlanLifecycleAction\\("${action}", request, reply\\)`,
    );
    assert.match(routeSource, pattern);
  }
  assert.doesNotMatch(
    routeSource,
    /handleRoutePlanLifecycleAction\("(release|start|complete)", request, reply, /,
  );

  // 6. La carga default sigue en el loader, desde M14 vía el adapter DB de infrastructure.
  assert.match(routeSource, /routePlansDb\.createRoutePlan/);
  assert.match(routeSource, /routePlansDb\.updateClinicScopedRoutePlan/);
  assert.match(routeSource, /routePlansDb\.createRouteStopForClinicRoutePlan/);
  assert.match(routeSource, /routePlansDb\.updateClinicScopedRouteStop/);
  assert.match(routeSource, /routePlansDb\.transitionClinicScopedRoutePlanStatus/);
});

test("logistics route plans write/cancel application layer (M08) stays free of HTTP and DB imports", () => {
  const applicationFiles = [
    "server/features/logistics/application/route-plans-write-use-cases.ts",
    "server/features/logistics/application/route-stops-write-use-cases.ts",
    "server/features/logistics/application/cancel-route-plan.ts",
    "server/features/logistics/application/ports/logistics-route-plans-write-repository.ts",
    "server/features/logistics/application/ports/logistics-route-stops-write-repository.ts",
    "server/features/logistics/application/ports/logistics-route-plan-cancel-repository.ts",
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

test("logistics route plans API delegates cache read-through and invalidation to the M14 application use case", () => {
  // 1. La ruta compone el caso de uso de cache desde el barrel y el adapter de
  //    infrastructure (nunca el shim legacy ni el cache canónico directo).
  assert.match(routeSource, /createRoutePlansCacheUseCases,/);
  assert.match(
    routeSource,
    /import \{ createLogisticsRoutePlansCacheAdapter \} from "\.\.\/features\/logistics\/infrastructure\/logistics-route-plans-cache-adapter\.ts";/,
  );
  assert.doesNotMatch(routeSource, /lib\/logistics-route-plans-cache\.ts/);
  assert.doesNotMatch(
    routeSource,
    /infrastructure\/logistics-route-plans-cache\.ts/,
  );
  assert.doesNotMatch(
    routeSource,
    /getCachedRoutePlansSnapshot|setCachedRoutePlansSnapshot|clearRoutePlansCache|getCachedRoutePlanMetricsSnapshot|setCachedRoutePlanMetricsSnapshot|clearRoutePlanMetricsCache/,
  );

  // 1b. La ruta no referencia db-logistics de ninguna forma (estática, dinámica,
  //     type-only o textual): tipos y carga default llegan por el adapter DB de
  //     infrastructure. Bloquea también el acceso directo a símbolos del
  //     canónico fuera del objeto del adapter.
  assert.doesNotMatch(routeSource, /db-logistics/);
  assert.match(
    routeSource,
    /} from "\.\.\/features\/logistics\/infrastructure\/logistics-route-plans-db-adapter\.ts";/,
  );
  assert.match(
    routeSource,
    /\)\s*\.createLogisticsRoutePlansDbAdapter\(\)/,
  );

  // 2. Composición única del caso de uso de cache, desde el seam de deps ya
  //    resuelto, antes de registrar handlers.
  const cacheCompositionPattern =
    /const routePlansCache = createRoutePlansCacheUseCases\(\{\s*repository:\s*\{\s*listClinicRoutePlans:\s*deps\.listClinicRoutePlans,\s*getClinicScopedRoutePlan:\s*deps\.getClinicScopedRoutePlan,\s*listRouteStopsForClinicRoutePlan:\s*deps\.listRouteStopsForClinicRoutePlan,\s*\},\s*cache:\s*createLogisticsRoutePlansCacheAdapter<\s*RoutePlansListSnapshot,\s*RoutePlanMetricsSnapshot\s*>\(\),\s*now,\s*\}\);/;
  assert.match(routeSource, cacheCompositionPattern);

  const handlersStart = routeSource.indexOf("app.options(");
  assert.ok(handlersStart > 0, "no se encontró la región de handlers");
  assert.ok(
    routeSource.search(cacheCompositionPattern) < handlersStart,
    "la composición del caso de uso de cache debe ocurrir antes de los handlers",
  );

  // 3. La ruta escribe X-Logistics-Cache exclusivamente desde el cacheStatus
  //    retornado por el caso de uso; en error/404 no hay cacheStatus ni header.
  assert.match(
    routeSource,
    /markLogisticsCacheStatus\(reply, result\.cacheStatus\)/,
  );
  assert.doesNotMatch(routeSource, /markLogisticsCacheStatus\(reply, "HIT"\)/);
  assert.doesNotMatch(routeSource, /markLogisticsCacheStatus\(reply, "MISS"\)/);

  // 4. El serializer de métricas es puro: cierra sobre datos planos extraídos
  //    de la query, valida tolerancias tras resolver el plan (404 precede al
  //    400) y señaliza el rechazo con el error tipado que la ruta mapea a 400.
  assert.match(routeSource, /const toleranceQuery = \{/);
  assert.match(routeSource, /class MetricsToleranceValidationError extends Error/);
  assert.match(
    routeSource,
    /if \(error instanceof MetricsToleranceValidationError\) \{\s*return reply\.code\(400\)\.send\(\{/,
  );

  // 5. Las siete mutaciones invalidan cache vía el caso de uso, con el mismo
  //    alcance previo a M14 (heurística/PATCH plan/lifecycle = lista + métricas
  //    del plan; create = sólo lista; stops = sólo métricas del plan).
  assert.match(
    routeSource,
    /routePlansCache\.invalidateAfterRoutePlanMutation\(\s*auth\.clinicId,\s*result\.routePlan\.id,\s*\)/,
  );
  assert.match(
    routeSource,
    /routePlansCache\.invalidateAfterRoutePlanCreated\(auth\.clinicId\)/,
  );
  assert.match(
    routeSource,
    /routePlansCache\.invalidateAfterRoutePlanMutation\(auth\.clinicId, routePlanId\)/,
  );
  assert.match(
    routeSource,
    /routePlansCache\.invalidateAfterRouteStopMutation\(auth\.clinicId, routePlanId\)/,
  );
});

test("logistics route plans cache application layer (M14) stays free of HTTP and DB imports", () => {
  const applicationFiles = [
    "server/features/logistics/application/route-plans-cache-use-cases.ts",
    "server/features/logistics/application/ports/logistics-route-plans-cache-repository.ts",
  ] as const;

  const forbiddenSpecifierRules: Array<{ label: string; pattern: RegExp }> = [
    { label: "fastify", pattern: /^fastify(\/|$)/ },
    { label: "server/db-logistics", pattern: /db-logistics/ },
    { label: "server/db", pattern: /(^|\/)db(\.ts)?$/ },
    { label: "drizzle-orm", pattern: /^drizzle-orm(\/|$)/ },
    { label: "drizzle/schema", pattern: /drizzle\/schema/ },
    { label: "server/lib", pattern: /(^|\/)lib\// },
    { label: "server/routes", pattern: /(^|\/)routes\// },
    { label: "infrastructure", pattern: /(^|\/)infrastructure\// },
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
