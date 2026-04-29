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

function extractFunction(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}(`);

  assert.notEqual(start, -1, `falta la función ${functionName}`);

  const nextFunctionStart = source.indexOf("\nfunction ", start + 1);
  const asyncFunctionStart = source.indexOf("\nasync function ", start + 1);
  const exportStart = source.indexOf("\nexport ", start + 1);
  const candidates = [nextFunctionStart, asyncFunctionStart, exportStart].filter(
    (index) => index > start,
  );
  const end = Math.min(...candidates);

  assert.ok(
    Number.isFinite(end),
    `no se pudo encontrar el fin de la función ${functionName}`,
  );

  return source.slice(start, end);
}

function extractSearchRouteHandler(source: string): string {
  const start = source.indexOf('"/search"');

  assert.notEqual(start, -1, "falta la ruta GET /search");

  const detailStart = source.indexOf('"/:clinicId"', start);

  assert.notEqual(detailStart, -1, "falta la ruta GET /:clinicId");

  return source.slice(start, detailStart);
}

function extractDetailRouteHandler(source: string): string {
  const start = source.indexOf('"/:clinicId"');

  assert.notEqual(start, -1, "falta la ruta GET /:clinicId");

  return source.slice(start);
}

test("normalizeText conserva solo strings no vacíos y trimeados", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const normalizeText = extractFunction(source, "normalizeText");

  assert.ok(
    normalizeText.includes(
      'return typeof value === "string" && value.trim() ? value.trim() : undefined;',
    ),
    "normalizeText debe devolver trim para strings con contenido o undefined para blanks/no strings",
  );

  assert.ok(
    !normalizeText.includes("String("),
    "normalizeText no debe convertir números u objetos a texto buscable",
  );

  assert.ok(
    !normalizeText.includes("toLowerCase("),
    "normalizeText no debe alterar casing de filtros públicos",
  );
});

test("search prioriza q sobre query y publica blanks como null", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const searchRoute = extractSearchRouteHandler(source);

  assert.ok(
    searchRoute.includes(
      "const query = normalizeText(request.query.q ?? request.query.query);",
    ),
    "q debe tener prioridad sobre query usando nullish coalescing",
  );

  assert.ok(
    searchRoute.includes("const locality = normalizeText(request.query.locality);"),
    "locality debe pasar por normalizeText",
  );

  assert.ok(
    searchRoute.includes("const country = normalizeText(request.query.country);"),
    "country debe pasar por normalizeText",
  );

  assert.ok(
    searchRoute.includes(
      "filters: {\n          query: query ?? null,\n          locality: locality ?? null,\n          country: country ?? null,\n        },",
    ),
    "los filtros públicos deben publicar null cuando internamente son undefined",
  );

  assert.ok(
    !searchRoute.includes("request.query.query ?? request.query.q"),
    "query no debe tener prioridad sobre q",
  );
});

test("parsePositiveInt mantiene fallback, máximo y rechazo de no positivos", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const parsePositiveInt = extractFunction(source, "parsePositiveInt");

  assert.ok(
    parsePositiveInt.includes("const parsed = Number(value);"),
    "parsePositiveInt debe convertir usando Number",
  );

  assert.ok(
    parsePositiveInt.includes("if (!Number.isInteger(parsed) || parsed <= 0)"),
    "parsePositiveInt debe rechazar no enteros, cero y negativos",
  );

  assert.ok(
    parsePositiveInt.includes("return fallback;"),
    "parsePositiveInt debe usar fallback ante valores inválidos",
  );

  assert.ok(
    parsePositiveInt.includes(
      "return typeof max === \"number\" ? Math.min(parsed, max) : parsed;",
    ),
    "parsePositiveInt debe aplicar máximo cuando se provee",
  );
});

test("search mantiene limit con fallback 20, máximo 50 y offset con fallback 0", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const searchRoute = extractSearchRouteHandler(source);

  assert.ok(
    searchRoute.includes("const limit = parsePositiveInt(request.query.limit, 20, 50);"),
    "limit debe tener fallback 20 y máximo 50",
  );

  assert.ok(
    searchRoute.includes("const offset = parseOffset(request.query.offset, 0);"),
    "offset debe tener fallback 0",
  );

  assert.ok(
    searchRoute.includes(
      "const result = await searchPublicProfessionals({\n        query,\n        locality,\n        country,\n        limit,\n        offset,\n      });",
    ),
    "search debe pasar query/locality/country/limit/offset ya normalizados al helper público",
  );

  assert.ok(
    searchRoute.includes(
      "pagination: {\n          limit: result.limit,\n          offset: result.offset,\n        },",
    ),
    "la paginación pública debe reflejar el resultado normalizado del helper",
  );
});

test("parseOffset acepta solo enteros no negativos", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const parseOffset = extractFunction(source, "parseOffset");

  assert.ok(
    parseOffset.includes("const parsed = Number(value);"),
    "parseOffset debe convertir usando Number",
  );

  assert.ok(
    parseOffset.includes("if (!Number.isInteger(parsed) || parsed < 0)"),
    "parseOffset debe rechazar no enteros y negativos",
  );

  assert.ok(
    parseOffset.includes("return fallback;"),
    "parseOffset debe usar fallback ante valores inválidos",
  );

  assert.ok(
    parseOffset.includes("return parsed;"),
    "parseOffset debe conservar enteros no negativos válidos",
  );
});

test("parseClinicId acepta solo enteros positivos y detail rechaza inválidos antes del helper", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const parseClinicId = extractFunction(source, "parseClinicId");
  const detailRoute = extractDetailRouteHandler(source);

  assert.ok(
    parseClinicId.includes("const parsed = Number(value);"),
    "parseClinicId debe convertir usando Number",
  );

  assert.ok(
    parseClinicId.includes(
      "return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;",
    ),
    "parseClinicId debe aceptar solo enteros positivos",
  );

  assert.ok(
    detailRoute.includes("const clinicId = parseClinicId(request.params.clinicId);"),
    "detail debe parsear clinicId con parseClinicId",
  );

  assert.ok(
    detailRoute.includes(
      'if (!clinicId) {\n        return reply.code(400).send({\n          success: false,\n          error: "ID de clinica invalido",\n        });\n      }',
    ),
    "detail debe responder 400 antes de llamar al helper cuando clinicId es inválido",
  );

  assert.ok(
    detailRoute.indexOf("if (!clinicId)") <
      detailRoute.indexOf("await getPublicProfessionalByClinicId(clinicId)"),
    "la validación de clinicId debe ocurrir antes del lookup público",
  );
});
