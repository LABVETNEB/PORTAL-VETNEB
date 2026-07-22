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

const retiredPublicProfessionalsPaths = [
  ["server", "db-public-professionals.ts"].join("/"),
  ["server", "lib", "public-professionals-rate-limit.ts"].join("/"),
  ["server", "lib", "professional-bank-eligibility.ts"].join("/"),
] as const;

test("M24 mantiene retirados los tres paths legacy de Public Professionals", () => {
  for (const retiredPath of retiredPublicProfessionalsPaths) {
    assert.equal(
      existsSync(resolve(SOURCE_ROOT, retiredPath)),
      false,
      `${retiredPath} debe permanecer eliminado después del cierre M24`,
    );
  }
});

test("router público conserva sólo HTTP y dependencias cross-cutting", () => {
  const source = readSource(
    "server/routes/public-professionals.fastify.ts",
  );
  const imports = extractImports(source);
  const staticImportBlock = imports.join("\n");

  assert.ok(imports.length > 0);

  assert.ok(
    !staticImportBlock.includes("db-public-professionals"),
    "la ruta no debe importar el path DB retirado",
  );

  assert.ok(
    !staticImportBlock.includes("../lib/supabase"),
    "la ruta no debe importar storage",
  );

  assert.ok(
    !staticImportBlock.includes(
      "../lib/public-professionals-rate-limit.ts",
    ),
    "la ruta no debe importar el path de rate limit retirado",
  );

  assert.ok(
    staticImportBlock.includes(
      "../features/public-professionals/public-professionals-query-service.ts",
    ),
    "la ruta debe consumir el query service",
  );

  assert.ok(
    staticImportBlock.includes(
      "../features/public-professionals/infrastructure/public-professionals-rate-limit.ts",
    ),
    "la ruta debe consumir el rate limit canónico",
  );

  assert.ok(
    staticImportBlock.includes("../lib/env.ts"),
    "CORS/env permanece en la ruta",
  );

  assert.ok(
    staticImportBlock.includes(
      "../middlewares/request-logger.ts",
    ),
    "logging permanece en la ruta",
  );
});

test("query service aísla los defaults de DB y storage", () => {
  const source = readSource(
    "server/features/public-professionals/public-professionals-query-service.ts",
  );

  const loader = extractFunction(
    source,
    "loadDefaultPublicProfessionalsQueryDeps",
  );

  assert.ok(
    loader.includes('import("./infrastructure/index.ts")'),
    "debe cargar el barrel canónico",
  );

  assert.ok(
    loader.includes('import("../../lib/supabase.ts")'),
    "debe cargar storage fuera de la ruta",
  );

  assert.ok(
    !loader.includes("db-public-professionals"),
    "no debe importar el path DB retirado",
  );
});

test("router delega search y detail al query service", () => {
  const source = readSource(
    "server/routes/public-professionals.fastify.ts",
  );

  const pluginBody = extractPluginBody(source);

  assert.ok(
    pluginBody.includes(
      "resolvePublicProfessionalsQueryDeps({",
    ),
  );

  assert.ok(
    pluginBody.includes(
      "searchPublicProfessionalsDirectory(",
    ),
  );

  assert.ok(
    pluginBody.includes(
      "getPublicProfessionalDetail(",
    ),
  );

  assert.ok(
    !source.includes("serializeProfessional("),
    "la serialización no debe permanecer en la ruta",
  );

  assert.ok(
    !source.includes("resolvePublicAvatarUrl("),
    "la firma de avatar no debe permanecer en la ruta",
  );

  assert.ok(
    !source.includes("result.rows.map("),
    "la ruta no debe mapear filas de DB",
  );

  assert.ok(
    !source.includes("loadDefaultSearchPublicProfessionals"),
    "la ruta no debe contener loaders DB",
  );

  assert.ok(
    !source.includes("loadDefaultCreateSignedStorageUrl"),
    "la ruta no debe contener loader de storage",
  );
});

test("query service prioriza overrides y conserva seams inyectables", () => {
  const source = readSource(
    "server/features/public-professionals/public-professionals-query-service.ts",
  );

  const resolver = extractFunction(
    source,
    "resolvePublicProfessionalsQueryDeps",
  );

  assert.ok(
    resolver.includes(
      "overrides.searchPublicProfessionals ??",
    ),
  );

  assert.ok(
    resolver.includes(
      "overrides.getPublicProfessionalByClinicId ??",
    ),
  );

  assert.ok(
    resolver.includes(
      "overrides.createSignedStorageUrl ??",
    ),
  );
});
