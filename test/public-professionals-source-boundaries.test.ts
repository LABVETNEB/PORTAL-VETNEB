import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";

const SOURCE_ROOT = process.cwd();

function listFilesRecursive(relativeDir: string): string[] {
  const rootDir = resolve(SOURCE_ROOT, relativeDir);
  if (!existsSync(rootDir)) {
    return [];
  }

  const files: string[] = [];
  const walk = (absoluteDir: string): void => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolute = resolve(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        files.push(relative(SOURCE_ROOT, absolute).split(sep).join("/"));
      }
    }
  };

  walk(rootDir);
  return files;
}

// Resolve a legacy test-root path to its current canonical location, tolerating tests
// already migrated into enterprise subdirectories (TEST-ARCH-13/15). Prefers the exact
// path; falls back to a unique basename match under the same top-level directory. Zero or
// multiple matches return undefined so the caller fails explicitly (no silent match).
function resolveExistingSourcePath(relativePath: string): string | undefined {
  const normalized = relativePath.split(sep).join("/");
  if (existsSync(resolve(SOURCE_ROOT, normalized))) {
    return normalized;
  }

  const targetName = basename(normalized);
  const topDir = normalized.split("/")[0];
  const matches = listFilesRecursive(topDir).filter(
    (candidate) => basename(candidate) === targetName,
  );

  return matches.length === 1 ? matches[0] : undefined;
}

function readSource(relativePath: string): string {
  const resolved = resolveExistingSourcePath(relativePath);
  assert.ok(resolved, `source not found for ${relativePath}`);
  return readFileSync(resolve(SOURCE_ROOT, resolved), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function extractImports(source: string): string[] {
  return [...source.matchAll(/^import[\s\S]*?;$/gm)].map((match) => match[0]);
}

function extractFunction(source: string, functionName: string): string {
  const declarationPatterns = [
    `async function ${functionName}(`,
    `function ${functionName}(`,
  ];

  const start = declarationPatterns
    .map((pattern) => source.indexOf(pattern))
    .find((index) => index >= 0);

  assert.notEqual(start, undefined, `falta la función ${functionName}`);

  const paramsStart = source.indexOf("(", start);
  assert.notEqual(paramsStart, -1, `faltan parámetros de ${functionName}`);

  let paramsDepth = 0;
  let paramsEnd = -1;

  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index];

    if (char === "(") {
      paramsDepth += 1;
    }

    if (char === ")") {
      paramsDepth -= 1;

      if (paramsDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }

  assert.notEqual(paramsEnd, -1, `no se pudo cerrar parámetros de ${functionName}`);

  const bodyStart = source.indexOf("{", paramsEnd);
  assert.notEqual(bodyStart, -1, `falta el cuerpo de ${functionName}`);

  let bodyDepth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") {
      bodyDepth += 1;
    }

    if (char === "}") {
      bodyDepth -= 1;

      if (bodyDepth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`no se pudo extraer ${functionName}`);
}
function extractPluginBody(source: string): string {
  const marker = "export const publicProfessionalsNativeRoutes";
  const start = source.indexOf(marker);

  assert.notEqual(start, -1, "falta publicProfessionalsNativeRoutes");

  return source.slice(start);
}

test("router público de profesionales no importa DB ni storage de forma estática", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const imports = extractImports(source);
  const staticImportBlock = imports.join("\n");

  assert.ok(
    imports.length > 0,
    "el test debe poder inspeccionar imports estáticos",
  );

  assert.ok(
    !staticImportBlock.includes("db-public-professionals"),
    "el router público no debe acoplarse a DB mediante import estático",
  );

  assert.ok(
    !staticImportBlock.includes("../lib/supabase"),
    "el router público no debe acoplarse a storage mediante import estático",
  );

  assert.ok(
    staticImportBlock.includes("../lib/env.ts"),
    "CORS/env sí debe seguir siendo una dependencia explícita del router",
  );

  assert.ok(
    staticImportBlock.includes("../lib/public-professionals-rate-limit.ts"),
    "las constantes de rate limit sí deben seguir importadas explícitamente",
  );

  assert.ok(
    staticImportBlock.includes("../middlewares/request-logger.ts"),
    "logging sanitizado sí debe seguir importado explícitamente",
  );
});

test("defaults de DB y storage quedan aislados en loaders dinámicos específicos", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");

  const searchLoader = extractFunction(source, "loadDefaultSearchPublicProfessionals");
  const detailLoader = extractFunction(
    source,
    "loadDefaultGetPublicProfessionalByClinicId",
  );
  const signingLoader = extractFunction(source, "loadDefaultCreateSignedStorageUrl");

  assert.ok(
    searchLoader.includes('await import("../db-public-professionals.ts")'),
    "search default debe cargar DB solo desde su loader dinámico",
  );
  assert.ok(
    searchLoader.includes("return module.searchPublicProfessionals;"),
    "search loader debe devolver solo searchPublicProfessionals",
  );
  assert.ok(
    !searchLoader.includes("getPublicProfessionalByClinicId"),
    "search loader no debe mezclar helper de detail",
  );

  assert.ok(
    detailLoader.includes('await import("../db-public-professionals.ts")'),
    "detail default debe cargar DB solo desde su loader dinámico",
  );
  assert.ok(
    detailLoader.includes("return module.getPublicProfessionalByClinicId;"),
    "detail loader debe devolver solo getPublicProfessionalByClinicId",
  );
  assert.ok(
    !detailLoader.includes("searchPublicProfessionals;"),
    "detail loader no debe mezclar helper de search",
  );

  assert.ok(
    signingLoader.includes('await import("../lib/supabase.ts")'),
    "signing default debe cargar storage solo desde su loader dinámico",
  );
  assert.ok(
    signingLoader.includes("return module.createSignedStorageUrl;"),
    "signing loader debe devolver solo createSignedStorageUrl",
  );
  assert.ok(
    !signingLoader.includes("db-public-professionals"),
    "signing loader no debe conocer DB pública",
  );
});

test("router prioriza helpers inyectados antes de cargar defaults", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const pluginBody = extractPluginBody(source);

  assert.ok(
    pluginBody.includes(
      "const searchPublicProfessionals =\n    options.searchPublicProfessionals ??\n    (await loadDefaultSearchPublicProfessionals());",
    ),
    "search debe usar override inyectado antes del default",
  );

  assert.ok(
    pluginBody.includes(
      "const getPublicProfessionalByClinicId =\n    options.getPublicProfessionalByClinicId ??\n    (await loadDefaultGetPublicProfessionalByClinicId());",
    ),
    "detail debe usar override inyectado antes del default",
  );

  assert.ok(
    pluginBody.includes(
      "const createSignedStorageUrl =\n    options.createSignedStorageUrl ??\n    (await loadDefaultCreateSignedStorageUrl());",
    ),
    "signing debe usar override inyectado antes del default",
  );

  assert.ok(
    pluginBody.indexOf("options.searchPublicProfessionals") <
      pluginBody.indexOf("loadDefaultSearchPublicProfessionals"),
    "search no debe cargar default antes de evaluar override",
  );

  assert.ok(
    pluginBody.indexOf("options.getPublicProfessionalByClinicId") <
      pluginBody.indexOf("loadDefaultGetPublicProfessionalByClinicId"),
    "detail no debe cargar default antes de evaluar override",
  );

  assert.ok(
    pluginBody.indexOf("options.createSignedStorageUrl") <
      pluginBody.indexOf("loadDefaultCreateSignedStorageUrl"),
    "signing no debe cargar default antes de evaluar override",
  );
});

test("serialización pública no consulta storage salvo por createSignedStorageUrl", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const avatarUrlHelper = extractFunction(source, "resolvePublicAvatarUrl");
  const serializer = extractFunction(source, "serializeProfessional");

  assert.ok(
    serializer.includes("createSignedStorageUrl: CreateSignedStorageUrlFn"),
    "serializeProfessional debe recibir signing como dependencia inyectada",
  );

  assert.ok(
    avatarUrlHelper.includes("return await createSignedStorageUrl(row.avatarStoragePath);"),
    "serializeProfessional debe firmar solo cuando existe avatarStoragePath",
  );

  assert.ok(
    avatarUrlHelper.includes("return null;"),
    "serializeProfessional debe devolver avatarUrl null cuando no hay avatar",
  );

  assert.ok(
    serializer.includes("const avatarUrl = await resolvePublicAvatarUrl(row, createSignedStorageUrl);"),
    "serializeProfessional debe delegar solo en el helper de avatar público",
  );

  assert.ok(
    !serializer.includes("await import("),
    "serializeProfessional no debe cargar módulos dinámicamente",
  );

  assert.ok(
    !serializer.includes("supabase"),
    "serializeProfessional no debe conocer Supabase directamente",
  );

  assert.ok(
    !serializer.includes("storage"),
    "serializeProfessional no debe conocer storage directo",
  );

  assert.ok(
    !serializer.includes("db"),
    "serializeProfessional no debe consultar DB",
  );
});

test("tests del router público usan harness inyectado sin DB ni storage reales", () => {
  const source = readSource("test/public-professionals.fastify.test.ts");
  const imports = extractImports(source).join("\n");
  const createTestApp = extractFunction(source, "createTestApp");

  assert.ok(
    !imports.includes("db-public-professionals"),
    "los tests fastify del router público no deben importar DB pública real",
  );

  assert.ok(
    !imports.includes("../server/lib/supabase"),
    "los tests fastify del router público no deben importar storage real",
  );

  assert.match(
    createTestApp,
    /searchPublicProfessionals:\s*async\s*\(\)\s*=>\s*\(\{\s*rows:\s*\[\],\s*total:\s*0,\s*limit:\s*20,\s*offset:\s*0,\s*\}\)/,
    "createTestApp debe mantener search default determinístico",
  );

  assert.match(
    createTestApp,
    /getPublicProfessionalByClinicId:\s*async\s*\(\)\s*=>\s*null/,
    "createTestApp debe mantener detail default sin DB",
  );

  assert.match(
    createTestApp,
    /createSignedStorageUrl:\s*async\s*\(path:\s*string\)\s*=>\s*`signed:\$\{path\}`/,
    "createTestApp debe mantener signing default sin storage real",
  );

  assert.match(
    createTestApp,
    /\.\.\.overrides/,
    "createTestApp debe permitir overrides por test",
  );
});
