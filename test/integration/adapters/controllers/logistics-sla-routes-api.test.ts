import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(process.cwd(), "server", "routes", "logistics-sla.fastify.ts"),
  "utf8",
);

const appSource = readFileSync(
  resolve(process.cwd(), "server", "fastify-app.ts"),
  "utf8",
);

test("logistics SLA API exposes read-only policy, instance, overdue and summary endpoints", () => {
  assert.match(routeSource, /export const logisticsSlaNativeRoutes/);
  assert.match(routeSource, /app\.get\("\/summary", async/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/overdue", async/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/policies", async/);
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/instances", async/);
  assert.match(routeSource, /app\.options\("\/summary", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/overdue", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/policies", optionsHandler\)/);
  assert.match(routeSource, /app\.options\("\/instances", optionsHandler\)/);
  assert.match(routeSource, /GET,OPTIONS/);
});

test("logistics SLA API reuses shared CORS helpers without adding mutating-origin enforcement", () => {
  assert.match(routeSource, /from "\.\.\/lib\/cors-headers\.ts";/);
  assert.match(routeSource, /  getAllowedOriginForCors,/);
  assert.match(routeSource, /  getAllowedOrigins,/);
  assert.match(routeSource, /  getRequestOrigin,/);
  assert.match(routeSource, /function applyCorsHeaders\(/);
  assert.match(routeSource, /reply\.header\("access-control-allow-methods", "GET,OPTIONS"\)/);

  assert.doesNotMatch(routeSource, /function getAllowedOrigins/);
  assert.doesNotMatch(routeSource, /function normalizeOrigin/);
  assert.doesNotMatch(routeSource, /function getOriginHeader/);
  assert.doesNotMatch(routeSource, /function getAllowedOriginForCors/);
  assert.doesNotMatch(routeSource, /function getRequestOrigin/);
  assert.doesNotMatch(routeSource, /function enforceTrustedOrigin/);
  assert.doesNotMatch(routeSource, /enforceTrustedOrigin\(/);
  assert.doesNotMatch(routeSource, /UNSAFE_METHODS/);
});

test("logistics SLA API wires DB helpers through injectable deps", () => {
  assert.match(routeSource, /listActiveClinicSlaPolicies\?:/);
  assert.match(routeSource, /listClinicSlaInstances\?:/);
  assert.match(routeSource, /getClinicSlaSummary\?:/);
  assert.match(routeSource, /listOverdueActiveClinicSlaInstances\?:/);
  assert.match(routeSource, /slaDb\.listActiveClinicSlaPolicies/);
  assert.match(routeSource, /slaDb\.listClinicSlaInstances/);
  assert.match(routeSource, /slaDb\.getClinicSlaSummary/);
  assert.match(routeSource, /slaDb\.listOverdueActiveClinicSlaInstances/);
  assert.match(routeSource, /slaReads\.listActivePolicies\(parsed\.params\)/);
  assert.match(routeSource, /slaReads\.listInstances\(parsed\.params\)/);
  assert.match(routeSource, /slaReads\.getSummary\(auth\.clinicId\)/);
});

test("M16 loads the default SLA persistence through the infrastructure adapter, not the shim", () => {
  // Los seis tipos de I/O se importan del adapter de infrastructure (no del shim).
  assert.match(
    routeSource,
    /import type \{\s*ClinicSlaSummary,\s*ListActiveClinicSlaPoliciesParams,\s*ListClinicSlaInstancesParams,\s*ListOverdueActiveClinicSlaInstancesParams,\s*SlaInstance,\s*SlaPolicy,\s*\} from "\.\.\/features\/logistics\/infrastructure\/logistics-sla-db-adapter\.ts";/,
  );

  // La carga default (lazy, dentro de loadDefaultDeps) compone la factory del
  // adapter DB exactamente una vez.
  const adapterComposition =
    /const slaDb = \(\s*await import\(\s*"\.\.\/features\/logistics\/infrastructure\/logistics-sla-db-adapter\.ts"\s*\)\s*\)\.createLogisticsSlaDbAdapter\(\);/;
  assert.match(routeSource, adapterComposition);
  assert.equal(
    routeSource.match(/createLogisticsSlaDbAdapter\(\)/g)?.length,
    1,
    "el adapter DB debe componerse exactamente una vez",
  );

  // Las cuatro operaciones de persistencia se cablean desde el adapter.
  assert.match(
    routeSource,
    /listActiveClinicSlaPolicies: slaDb\.listActiveClinicSlaPolicies/,
  );
  assert.match(
    routeSource,
    /listClinicSlaInstances: slaDb\.listClinicSlaInstances/,
  );
  assert.match(
    routeSource,
    /listOverdueActiveClinicSlaInstances:\s*slaDb\.listOverdueActiveClinicSlaInstances/,
  );
  assert.match(routeSource, /getClinicSlaSummary: slaDb\.getClinicSlaSummary/);

  // La carga default sigue siendo lazy dentro de loadDefaultDeps.
  assert.match(routeSource, /async function loadDefaultDeps\(/);

  // Refuerzo textual M16: cero referencias (estáticas, dinámicas, type-only o
  // en comentarios) al módulo db-logistics dentro de la ruta thin.
  assert.doesNotMatch(routeSource, /db-logistics/);
});

test("logistics SLA API delegates the three remaining reads to the M16 application use cases", () => {
  // La ruta importa createSlaReadUseCases del barrel, junto al caso de uso M06.
  assert.match(
    routeSource,
    /import \{\s*createListOverdueActiveSlaInstances,\s*createSlaReadUseCases,\s*\} from "\.\.\/features\/logistics\/application\/index\.ts";/,
  );

  // createSlaReadUseCases se compone exactamente una vez, con las tres deps.
  const readsComposition =
    /const slaReads = createSlaReadUseCases\(\{\s*listActiveClinicSlaPolicies: deps\.listActiveClinicSlaPolicies,\s*listClinicSlaInstances: deps\.listClinicSlaInstances,\s*getClinicSlaSummary: deps\.getClinicSlaSummary,\s*\}\);/;
  assert.match(routeSource, readsComposition);
  assert.equal(
    routeSource.match(/createSlaReadUseCases\(/g)?.length,
    1,
    "createSlaReadUseCases debe componerse exactamente una vez",
  );

  // La composición M06 permanece intacta y también se compone una sola vez.
  assert.match(
    routeSource,
    /const listOverdueActiveSlaInstances = createListOverdueActiveSlaInstances\(\{\s*listOverdueActiveClinicSlaInstances:\s*deps\.listOverdueActiveClinicSlaInstances,\s*\}\);/,
  );
  assert.equal(
    routeSource.match(/createListOverdueActiveSlaInstances\(/g)?.length,
    1,
    "el caso de uso M06 debe componerse exactamente una vez",
  );

  // Las composiciones ocurren antes de registrar handlers.
  const firstHandlerIndex = routeSource.indexOf("app.options(");
  assert.ok(routeSource.search(readsComposition) < firstHandlerIndex);

  // Los tres handlers delegan en los casos de uso M16.
  assert.match(routeSource, /const summary = await slaReads\.getSummary\(auth\.clinicId\);/);
  assert.match(
    routeSource,
    /const policies = await slaReads\.listActivePolicies\(parsed\.params\);/,
  );
  assert.match(
    routeSource,
    /const instances = await slaReads\.listInstances\(parsed\.params\);/,
  );

  // /overdue sigue delegando en el caso de uso M06.
  assert.match(
    routeSource,
    /const instances = await listOverdueActiveSlaInstances\(parsed\.params\);/,
  );

  // Las tres operaciones ya no se invocan directamente vía deps dentro de los
  // handlers: la única referencia legítima a deps.* de estas tres operaciones
  // vive en la zona de composición del caso de uso M16.
  assert.equal(
    routeSource.match(/deps\.getClinicSlaSummary/g)?.length,
    1,
    "deps.getClinicSlaSummary sólo debe aparecer en la composición de slaReads",
  );
  assert.equal(
    routeSource.match(/deps\.listActiveClinicSlaPolicies/g)?.length,
    1,
    "deps.listActiveClinicSlaPolicies sólo debe aparecer en la composición de slaReads",
  );
  assert.equal(
    routeSource.match(/deps\.listClinicSlaInstances/g)?.length,
    1,
    "deps.listClinicSlaInstances sólo debe aparecer en la composición de slaReads",
  );
  assert.doesNotMatch(routeSource, /deps\.getClinicSlaSummary\(auth\.clinicId\)/);
  assert.doesNotMatch(
    routeSource,
    /deps\.listActiveClinicSlaPolicies\(parsed\.params\)/,
  );
  assert.doesNotMatch(
    routeSource,
    /deps\.listClinicSlaInstances\(parsed\.params\)/,
  );
});

test("logistics SLA API delegates overdue reads to the M06 application use case", () => {
  // 1. La ruta importa el caso de uso M06 desde el barrel de application
  //    (junto al caso de uso de lectura M16, en el mismo bloque de import).
  assert.match(
    routeSource,
    /import \{[\s\S]*?\bcreateListOverdueActiveSlaInstances\b[\s\S]*?\} from "\.\.\/features\/logistics\/application\/index\.ts";/,
  );

  // 2. El puerto se adapta desde el seam LogisticsSlaNativeRoutesOptions
  //    (deps ya resueltas), una sola vez a nivel plugin, no por request.
  const compositionPattern =
    /const listOverdueActiveSlaInstances = createListOverdueActiveSlaInstances\(\{\s*listOverdueActiveClinicSlaInstances:\s*deps\.listOverdueActiveClinicSlaInstances,\s*\}\);/;
  assert.match(routeSource, compositionPattern);

  const compositionIndex = routeSource.search(compositionPattern);
  const firstHandlerIndex = routeSource.indexOf("app.options(");
  assert.ok(compositionIndex >= 0);
  assert.ok(
    compositionIndex < firstHandlerIndex,
    "la composición del puerto debe ocurrir antes de registrar handlers",
  );

  // Bloque del handler GET /overdue, delimitado para no afectar la zona de
  // composición ni las demás rutas.
  const overdueHandlerStart = routeSource.indexOf(
    '("/overdue", async (request, reply) => {',
  );
  const overdueHandlerEnd = routeSource.indexOf('app.get("/summary"');
  assert.ok(overdueHandlerStart >= 0, "handler /overdue no encontrado");
  assert.ok(overdueHandlerEnd > overdueHandlerStart, "límite del handler /overdue no encontrado");
  const overdueHandlerSource = routeSource.slice(
    overdueHandlerStart,
    overdueHandlerEnd,
  );

  // 3. El handler delega en el caso de uso con los params ya parseados.
  assert.match(
    overdueHandlerSource,
    /const instances = await listOverdueActiveSlaInstances\(parsed\.params\);/,
  );

  // 4. El handler ya no invoca la dependencia del seam directamente; la
  //    composición fuera del handler sigue siendo legítima.
  assert.doesNotMatch(
    overdueHandlerSource,
    /deps\.listOverdueActiveClinicSlaInstances/,
  );

  // 6–8. Auth, permisos y parsing preceden a la consulta overdue.
  const authIndex = overdueHandlerSource.indexOf("await authenticateClinicUser(");
  const permissionIndex = overdueHandlerSource.indexOf("canViewLogisticsSla");
  const parseIndex = overdueHandlerSource.indexOf(
    "buildListOverdueSlaInstancesParams(",
  );
  const useCaseIndex = overdueHandlerSource.indexOf(
    "await listOverdueActiveSlaInstances(",
  );
  assert.ok(authIndex >= 0, "auth ausente en el handler overdue");
  assert.ok(permissionIndex > authIndex, "permisos deben seguir a auth");
  assert.ok(parseIndex > permissionIndex, "parsing debe seguir a permisos");
  assert.ok(useCaseIndex > parseIndex, "la consulta debe seguir al parsing");
});

test("logistics SLA application layer stays free of HTTP and DB imports", () => {
  const applicationFiles = [
    "server/features/logistics/application/index.ts",
    "server/features/logistics/application/list-overdue-active-sla-instances.ts",
    "server/features/logistics/application/ports/logistics-sla-read-repository.ts",
    "server/features/logistics/application/sla-read-use-cases.ts",
    "server/features/logistics/application/ports/logistics-sla-read-models-repository.ts",
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

test("logistics SLA API keeps reads clinic scoped and paginated", () => {
  assert.match(routeSource, /buildListSlaPoliciesParams\(request\.query, auth\.clinicId\)/);
  assert.match(routeSource, /buildListSlaInstancesParams\(request\.query, auth\.clinicId\)/);
  assert.match(routeSource, /slaReads\.getSummary\(auth\.clinicId\)/);
  assert.match(routeSource, /clinicId,/);
  assert.match(routeSource, /parsePositiveInt\(query\.limit, 50, 100\)/);
  assert.match(routeSource, /parseOffset\(query\.offset\)/);
  assert.match(routeSource, /pagination:/);
});

test("logistics SLA API validates status and target filters before DB reads", () => {
  assert.match(routeSource, /SLA_TARGET_TYPES/);
  assert.match(routeSource, /SLA_INSTANCE_STATUSES/);
  assert.match(routeSource, /parseSlaTargetType\(query\.targetType\)/);
  assert.match(routeSource, /parseSlaInstanceStatus\(query\.status\)/);
  assert.match(routeSource, /parseOptionalEntityId\(query\.targetId, "targetId"\)/);
});

test("fastify app registers logistics SLA routes under dedicated prefix", () => {
  assert.match(appSource, /logisticsSlaNativeRoutes/);
  assert.match(appSource, /type LogisticsSlaNativeRoutesOptions/);
  assert.match(appSource, /logisticsSlaRoutes\?: LogisticsSlaNativeRoutesOptions/);
  assert.match(appSource, /prefix: "\/api\/logistics\/sla"/);
});

test("logistics SLA API validates overdue route filters before DB reads", () => {
  assert.match(routeSource, /buildListOverdueSlaInstancesParams/);
  assert.match(routeSource, /parseOptionalDate\(\s*query\.dueAtOrBefore,\s*"dueAtOrBefore",\s*\)/);
  assert.match(routeSource, /parseSlaTargetType\(query\.targetType\)/);
  assert.match(routeSource, /dueAtOrBefore: dueAtOrBefore\.value \?\? new Date\(now\(\)\)/);
});

test("logistics SLA API enforces role-aware logistics SLA read permissions", () => {
  assert.match(routeSource, /type ClinicUserRole/);
  assert.match(routeSource, /normalizeClinicUserRole\(clinicUser\.role, "clinic_staff"\)/);
  assert.match(routeSource, /getClinicPermissions\(auth\.role\)\.canViewLogisticsSla/);
  assert.match(routeSource, /Permisos insuficientes para logistica/);
});
