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

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

test("createFastifyApp registra profesionales públicos desde el router nativo esperado", () => {
  const source = readSource("server/fastify-app.ts");

  assert.ok(
    source.includes(
      'from "./routes/public-professionals.fastify.ts";',
    ),
    "createFastifyApp debe importar el router nativo public-professionals.fastify.ts",
  );

  assert.equal(
    countOccurrences(source, "publicProfessionalsNativeRoutes"),
    2,
    "publicProfessionalsNativeRoutes debe aparecer solo en import y register esperados",
  );

  assert.equal(
    countOccurrences(source, "await app.register(publicProfessionalsNativeRoutes, {"),
    1,
    "createFastifyApp debe registrar publicProfessionalsNativeRoutes una sola vez",
  );
});

test("createFastifyApp mantiene el prefix público canónico sin aliases legacy", () => {
  const source = readSource("server/fastify-app.ts");

  assert.equal(
    countOccurrences(source, 'prefix: "/api/public/professionals"'),
    1,
    "el prefix canónico /api/public/professionals debe registrarse una sola vez",
  );

  for (const forbiddenPrefix of [
    'prefix: "/api/professionals"',
    'prefix: "/api/public/clinics"',
    'prefix: "/api/public/clinic"',
    'prefix: "/api/public/search"',
    'prefix: "/api/public/specialties"',
    'prefix: "/api/specialties"',
  ]) {
    assert.ok(
      !source.includes(forbiddenPrefix),
      `createFastifyApp no debe registrar alias público legacy: ${forbiddenPrefix}`,
    );
  }
});

test("createFastifyApp inyecta solo las opciones públicas de profesionales en su router", () => {
  const source = readSource("server/fastify-app.ts");
  const registerStart = source.indexOf(
    "await app.register(publicProfessionalsNativeRoutes, {",
  );

  assert.notEqual(
    registerStart,
    -1,
    "falta el registro de publicProfessionalsNativeRoutes",
  );

  const registerEnd = source.indexOf("\n  });", registerStart);

  assert.notEqual(
    registerEnd,
    -1,
    "no se pudo encontrar el cierre del registro de publicProfessionalsNativeRoutes",
  );

  const registerBlock = source.slice(registerStart, registerEnd);

  assert.ok(
    registerBlock.includes('prefix: "/api/public/professionals"'),
    "el registro debe conservar el prefix público canónico",
  );

  assert.ok(
    registerBlock.includes("...(options.publicProfessionalsRoutes ?? {})"),
    "el registro debe inyectar solamente options.publicProfessionalsRoutes",
  );

  for (const forbiddenOptions of [
    "options.clinicPublicProfileRoutes",
    "options.clinicAuthRoutes",
    "options.adminAuthRoutes",
    "options.reportsRoutes",
    "options.reportAccessTokensRoutes",
    "options.publicReportAccessRoutes",
  ]) {
    assert.ok(
      !registerBlock.includes(forbiddenOptions),
      `el router público de profesionales no debe recibir ${forbiddenOptions}`,
    );
  }
});

test("router público de profesionales conserva endpoints search y detail esperados", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");

  assert.equal(
    countOccurrences(source, 'app.get<{'),
    2,
    "el router público de profesionales debe exponer solo search y detail",
  );

  assert.ok(
    source.includes('"/search"'),
    "el router público debe conservar GET /search",
  );

  assert.ok(
    source.includes('"/:clinicId"'),
    "el router público debe conservar GET /:clinicId",
  );

  for (const forbiddenRoute of [
    'app.post(',
    'app.put(',
    'app.patch(',
    'app.delete(',
    '"/clinic/:clinicId"',
    '"/professionals/:clinicId"',
    '"/public/:clinicId"',
  ]) {
    assert.ok(
      !source.includes(forbiddenRoute),
      `el router público de profesionales no debe exponer ruta inesperada: ${forbiddenRoute}`,
    );
  }
});

