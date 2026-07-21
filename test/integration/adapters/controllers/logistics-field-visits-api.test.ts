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
  assert.match(routeSource, /await listFieldVisits\(params\)/);
  assert.match(routeSource, /buildCreateFieldVisitInput\(request\.body, auth\.clinicId\)/);
  assert.match(routeSource, /await createFieldVisitUseCase\(parsed\.input\)/);
  assert.match(routeSource, /updateFieldVisit\(\s*fieldVisitId,\s*auth\.clinicId,\s*parsed\.input,\s*\)/);
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


test("logistics field visit API exposes clinic-scoped location endpoints", () => {
  assert.match(routeSource, /app\.get<[\s\S]*>\("\/:fieldVisitId\/location", async/);
  assert.match(routeSource, /app\.put<[\s\S]*>\("\/:fieldVisitId\/location", async/);
  assert.match(routeSource, /app\.options\("\/:fieldVisitId\/location", optionsHandler\)/);
  assert.match(routeSource, /GET,POST,PUT,PATCH,OPTIONS/);
});

test("logistics field visit API wires visit location DB helpers through injectable deps", () => {
  assert.match(routeSource, /getVisitLocationForClinicVisit\?:/);
  assert.match(routeSource, /upsertVisitLocationForClinicVisit\?:/);
  assert.match(routeSource, /fieldVisitsDb\.getVisitLocationForClinicVisit/);
  assert.match(routeSource, /fieldVisitsDb\.upsertVisitLocationForClinicVisit/);
  assert.match(routeSource, /visitLocationUseCases\.getVisitLocation\(\s*fieldVisitId,\s*auth\.clinicId,\s*\)/);
  assert.match(routeSource, /visitLocationUseCases\.upsertVisitLocation\(\s*parsed\.input,\s*\)/);
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
  assert.match(routeSource, /fieldVisitsDb\.createTimeWindowForClinicVisit/);
  assert.match(routeSource, /fieldVisitsDb\.listTimeWindowsForClinicVisit/);
  assert.match(routeSource, /timeWindowUseCases\.listTimeWindows\(\s*fieldVisitId,\s*auth\.clinicId,\s*\)/);
  assert.match(routeSource, /timeWindowUseCases\.createTimeWindow\(parsed\.input\)/);
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

test("logistics field visit API enforces role-aware logistics field visit permissions", () => {
  assert.match(routeSource, /type ClinicUserRole/);
  assert.match(routeSource, /normalizeClinicUserRole\(clinicUser\.role, "clinic_staff"\)/);
  assert.match(routeSource, /getClinicPermissions\(auth\.role\)\.canManageLogisticsFieldVisits/);
  assert.match(routeSource, /UNSAFE_METHODS\.has\(request\.method\.toUpperCase\(\)\)/);
  assert.match(routeSource, /Permisos insuficientes para logistica/);
});

test("logistics field visit API delegates only PATCH update to the M09 application use case", () => {
  const compositionPattern =
    /const updateFieldVisit = createUpdateFieldVisit\(\{\s*updateClinicScopedFieldVisit: deps\.updateClinicScopedFieldVisit,\s*\}\);/;
  assert.match(routeSource, compositionPattern);

  const handlersStart = routeSource.indexOf("app.options(");
  assert.ok(handlersStart > 0, "no se encontró la región de handlers");
  assert.ok(
    routeSource.search(compositionPattern) < handlersStart,
    "la composición M09 debe ocurrir antes de los handlers",
  );
  assert.ok(
    routeSource.lastIndexOf("deps.updateClinicScopedFieldVisit") < handlersStart,
    "PATCH no debe invocar directamente deps.updateClinicScopedFieldVisit",
  );
  assert.match(
    routeSource,
    /const updated = await updateFieldVisit\(\s*fieldVisitId,\s*auth\.clinicId,\s*parsed\.input,\s*\);/,
  );
  assert.match(routeSource, /fieldVisitsDb\.updateClinicScopedFieldVisit/);
});

test("M15 delegates the six remaining handlers to application use cases composed once", () => {
  // Import de las factories desde el barrel público de application.
  assert.match(
    routeSource,
    /import \{\s*createCreateFieldVisit,\s*createListFieldVisits,\s*createTimeWindowUseCases,\s*createUpdateFieldVisit,\s*createVisitLocationUseCases,\s*\} from "\.\.\/features\/logistics\/application\/index\.ts";/,
  );

  const handlersStart = routeSource.indexOf("app.options(");
  assert.ok(handlersStart > 0, "no se encontró la región de handlers");

  // Composición exacta de cada factory M15, una sola vez y antes de los handlers.
  const compositions: Array<{ name: string; pattern: RegExp }> = [
    {
      name: "createListFieldVisits",
      pattern:
        /const listFieldVisits = createListFieldVisits\(\{\s*listClinicFieldVisits: deps\.listClinicFieldVisits,\s*\}\);/,
    },
    {
      name: "createCreateFieldVisit",
      pattern:
        /const createFieldVisitUseCase = createCreateFieldVisit\(\{\s*createFieldVisit: deps\.createFieldVisit,\s*\}\);/,
    },
    {
      name: "createVisitLocationUseCases",
      pattern:
        /const visitLocationUseCases = createVisitLocationUseCases\(\{\s*getVisitLocationForClinicVisit: deps\.getVisitLocationForClinicVisit,\s*upsertVisitLocationForClinicVisit: deps\.upsertVisitLocationForClinicVisit,\s*\}\);/,
    },
    {
      name: "createTimeWindowUseCases",
      pattern:
        /const timeWindowUseCases = createTimeWindowUseCases\(\{\s*listTimeWindowsForClinicVisit: deps\.listTimeWindowsForClinicVisit,\s*createTimeWindowForClinicVisit: deps\.createTimeWindowForClinicVisit,\s*\}\);/,
    },
  ];

  for (const { name, pattern } of compositions) {
    assert.match(routeSource, pattern);
    assert.ok(
      routeSource.search(pattern) < handlersStart,
      `la composición de ${name} debe ocurrir antes de los handlers`,
    );
    assert.equal(
      routeSource.match(new RegExp(`\\b${name}\\s*\\(`, "g"))?.length ?? 0,
      1,
      `${name} debe componerse exactamente una vez`,
    );
  }

  // Los seis handlers restantes delegan en los casos de uso M15.
  for (const marker of [
    "await listFieldVisits(params)",
    "await createFieldVisitUseCase(parsed.input)",
    "await visitLocationUseCases.getVisitLocation(",
    "await visitLocationUseCases.upsertVisitLocation(",
    "await timeWindowUseCases.listTimeWindows(",
    "await timeWindowUseCases.createTimeWindow(parsed.input)",
  ]) {
    assert.ok(routeSource.includes(marker), `debe delegar mediante ${marker}`);
  }

  // Cero llamadas persistentes directas dentro de handlers: las deps de
  // persistencia sólo pueden referenciarse (sin invocar) en las composiciones.
  assert.doesNotMatch(
    routeSource,
    /deps\.(createFieldVisit|listClinicFieldVisits|updateClinicScopedFieldVisit|getVisitLocationForClinicVisit|upsertVisitLocationForClinicVisit|createTimeWindowForClinicVisit|listTimeWindowsForClinicVisit)\s*\(/,
    "ningún handler puede invocar directamente una dependencia de persistencia",
  );

  // La secuencia observable del PATCH permanece intacta.
  assert.match(
    routeSource,
    /if \(!enforceTrustedOrigin\(request, reply, allowedOrigins\)\)[\s\S]*?authenticateClinicUser\(request, reply, deps, now\)[\s\S]*?canManageLogisticsFieldVisits[\s\S]*?parseEntityId\(request\.params\.fieldVisitId\)[\s\S]*?buildUpdateFieldVisitInput\(request\.body\)[\s\S]*?updateFieldVisit\(/,
  );
});

test("M15 loads default persistence only through the field visits DB adapter", () => {
  // La ruta no contiene ninguna referencia a db-logistics: ni import estático,
  // ni dinámico, ni type-only, ni textual.
  assert.doesNotMatch(routeSource, /db-logistics/);

  // Tipos de I/O provenientes del adapter de infrastructure.
  assert.match(
    routeSource,
    /import type \{[\s\S]*?\} from "\.\.\/features\/logistics\/infrastructure\/logistics-field-visits-db-adapter\.ts";/,
  );

  // Carga default lazy vía la factory del adapter, dentro de loadDefaultDeps.
  assert.match(
    routeSource,
    /const fieldVisitsDb = \(\s*await import\(\s*"\.\.\/features\/logistics\/infrastructure\/logistics-field-visits-db-adapter\.ts"\s*\)\s*\)\.createLogisticsFieldVisitsDbAdapter\(\);/,
  );

  // Las siete operaciones de persistencia provienen del adapter.
  for (const operation of [
    "createFieldVisit",
    "listClinicFieldVisits",
    "updateClinicScopedFieldVisit",
    "getVisitLocationForClinicVisit",
    "upsertVisitLocationForClinicVisit",
    "createTimeWindowForClinicVisit",
    "listTimeWindowsForClinicVisit",
  ]) {
    assert.ok(
      routeSource.includes(`fieldVisitsDb.${operation}`),
      `loadDefaultDeps debe componer ${operation} desde el adapter`,
    );
  }
});

test("logistics field visit M09 application files stay free of HTTP and DB imports", () => {
  const applicationFiles = [
    "server/features/logistics/application/update-field-visit.ts",
    "server/features/logistics/application/ports/logistics-field-visit-update-repository.ts",
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
