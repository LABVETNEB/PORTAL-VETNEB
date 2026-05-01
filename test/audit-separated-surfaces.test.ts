import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertContainsInOrder(
  source: string,
  markers: readonly string[],
  context: string,
): void {
  let lastIndex = -1;

  for (const marker of markers) {
    const index = source.indexOf(marker);

    assert.notEqual(index, -1, `${context} debe contener marker: ${marker}`);
    assert.ok(
      index > lastIndex,
      `${context} debe conservar orden esperado para marker: ${marker}`,
    );

    lastIndex = index;
  }
}

function extractRegisterBlock(source: string, routeName: string): string {
  const marker = `await app.register(${routeName}, {`;
  const start = source.indexOf(marker);

  assert.notEqual(start, -1, `Debe existir registro de ${routeName}`);

  const nextRegister = source.indexOf("\n  await app.register(", start + marker.length);
  const end = nextRegister === -1 ? source.length : nextRegister;

  return source.slice(start, end);
}

test("audit surfaces quedan montadas por dominio sin aliases cruzados", () => {
  const source = readSource("server/fastify-app.ts");

  assertContainsInOrder(
    source,
    [
      'adminAuditNativeRoutes, {',
      'prefix: "/api/admin/audit-log"',
      'clinicAuditNativeRoutes, {',
      'prefix: "/api/clinic/audit-log"',
      'particularAuditNativeRoutes, {',
      'prefix: "/api/particular/audit-log"',
    ],
    "createFastifyApp audit surfaces",
  );

  assert.match(
    source,
    /import\s+\{\s*adminAuditNativeRoutes,\s*type AdminAuditNativeRoutesOptions,\s*\}\s+from "\.\/routes\/admin-audit\.fastify\.ts";/s,
  );
  assert.match(
    source,
    /import\s+\{\s*clinicAuditNativeRoutes,\s*type ClinicAuditNativeRoutesOptions,\s*\}\s+from "\.\/routes\/clinic-audit\.fastify\.ts";/s,
  );

  const adminAuditRegister = extractRegisterBlock(source, "adminAuditNativeRoutes");
  const clinicAuditRegister = extractRegisterBlock(source, "clinicAuditNativeRoutes");

  assert.match(adminAuditRegister, /prefix: "\/api\/admin\/audit-log"/);
  assert.doesNotMatch(
    adminAuditRegister,
    /prefix: "\/api\/clinic\/audit-log"/,
    "admin audit no debe montarse en superficie clinic",
  );

  assert.match(clinicAuditRegister, /prefix: "\/api\/clinic\/audit-log"/);
  assert.doesNotMatch(
    clinicAuditRegister,
    /prefix: "\/api\/admin\/audit-log"/,
    "clinic audit no debe montarse en superficie admin",
  );
  const particularAuditRegister = extractRegisterBlock(
    source,
    "particularAuditNativeRoutes",
  );

  assert.match(particularAuditRegister, /prefix: "\/api\/particular\/audit-log"/);
  assert.doesNotMatch(
    particularAuditRegister,
    /prefix: "\/api\/admin\/audit-log"|prefix: "\/api\/clinic\/audit-log"/,
    "particular audit no debe montarse en superficie admin o clinic",
  );
});

test("admin audit mantiene superficie global y cookie admin exclusiva", () => {
  const source = readSource("server/routes/admin-audit.fastify.ts");

  assert.match(source, /export type AdminAuditNativeRoutesOptions/);
  assert.match(source, /getAdminSessionToken\(request: FastifyRequest\)/);
  assert.match(source, /cookies\[ENV\.adminCookieName\]/);
  assert.match(source, /authenticateAdminUser\(request, reply, deps, now\)/);
  assert.match(source, /app\.get<[\s\S]*?>\("\/export\.csv"/);
  assert.match(source, /app\.get<[\s\S]*?>\("\/"/);

  assert.match(
    source,
    /listAuditLog: dbAudit\.listAuditLog/,
    "admin audit debe consultar el log global",
  );
  assert.match(
    source,
    /buildAdminAuditListFilters: defaultBuildAdminAuditListFilters/,
    "admin audit debe usar filtros globales",
  );

  assert.doesNotMatch(source, /cookies\[ENV\.cookieName\]/);
  assert.doesNotMatch(source, /cookies\[ENV\.particularCookieName\]/);
  assert.doesNotMatch(source, /buildClinicAuditListFilters/);
});

test("clinic audit mantiene superficie clinic-scoped y cookie clinic exclusiva", () => {
  const source = readSource("server/routes/clinic-audit.fastify.ts");

  assert.match(source, /export type ClinicAuditNativeRoutesOptions/);
  assert.match(source, /getSessionToken\(request: FastifyRequest\)/);
  assert.match(source, /cookies\[ENV\.cookieName\]/);
  assert.match(source, /authenticateClinicUser\(request, reply, deps, now\)/);
  assert.match(source, /app\.get<[\s\S]*?>\("\/export\.csv"/);
  assert.match(source, /app\.get<[\s\S]*?>\("\/"/);

  assert.match(
    source,
    /buildClinicAuditListFilters: defaultBuildClinicAuditListFilters/,
    "clinic audit debe usar filtros clinic-scoped",
  );
  assert.match(
    source,
    /request\.query \?\? \{\},\s*auth\.clinicId/s,
    "clinic audit debe forzar clinicId desde la sesión",
  );
  assert.match(
    source,
    /clinicId: auth\.clinicId/,
    "payload de filtros debe exponer clinicId autenticado",
  );

  assert.doesNotMatch(source, /cookies\[ENV\.adminCookieName\]/);
  assert.doesNotMatch(source, /cookies\[ENV\.particularCookieName\]/);
  assert.doesNotMatch(source, /buildAdminAuditListFilters/);
});

test("audit filter helpers separan core neutral de facades por dominio", () => {
  const core = readSource("server/lib/audit-log.ts");
  const admin = readSource("server/lib/admin-audit.ts");
  const clinic = readSource("server/lib/clinic-audit.ts");
  const particular = readSource("server/lib/particular-audit.ts");

  assert.match(core, /export function buildAuditListFilters/);
  assert.match(core, /export function buildClinicAuditListFilters/);
  assert.match(core, /export function buildParticularAuditListFilters/);
  assert.match(core, /export function buildAuditCsv/);

  assert.match(admin, /buildAuditListFilters as buildAdminAuditListFilters/);
  assert.match(admin, /buildAuditCsv as buildAdminAuditCsv/);
  assert.match(admin, /buildGlobalAuditCsvFilename as buildAdminAuditCsvFilename/);

  assert.match(clinic, /buildClinicAuditListFilters/);
  assert.match(clinic, /buildAuditCsv/);
  assert.match(clinic, /clinic-audit-log-/);

  assert.match(particular, /buildParticularAuditListFilters/);
  assert.match(particular, /buildParticularAuditCsvFilename/);

  assert.doesNotMatch(
    readSource("server/routes/clinic-audit.fastify.ts"),
    /\.\.\/lib\/admin-audit\.ts/,
    "clinic audit route no debe importar helpers desde admin-audit",
  );
  assert.doesNotMatch(
    readSource("server/routes/particular-audit.fastify.ts"),
    /\.\.\/lib\/admin-audit\.ts/,
    "particular audit route no debe importar helpers desde admin-audit",
  );
});

test("particular audit mantiene superficie propia y cookie particular exclusiva", () => {
  const fastifyApp = readSource("server/fastify-app.ts");
  const source = readSource("server/routes/particular-audit.fastify.ts");

  assert.match(fastifyApp, /particularAuditNativeRoutes/);
  assert.match(fastifyApp, /prefix: "\/api\/particular\/audit-log"/);
  assert.match(source, /export type ParticularAuditNativeRoutesOptions/);
  assert.match(source, /cookies\[ENV\.particularCookieName\]/);
  assert.match(source, /authenticateParticularUser\(\s*request,\s*reply,\s*deps,\s*now,?\s*\)/s);
  assert.match(source, /listParticularAuditLog\(\s*filters,\s*particular\.tokenId/s);
  assert.match(source, /listParticularAuditLog\(\s*exportFilters,\s*particular\.tokenId/s);
  assert.match(source, /particularTokenId: particular\.tokenId/);

  assert.doesNotMatch(source, /cookies\[ENV\.adminCookieName\]/);
  assert.doesNotMatch(source, /cookies\[ENV\.cookieName\]/);
});
