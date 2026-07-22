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
  const exportedStart = source.indexOf(
    `export async function ${functionName}(`,
  );
  const localStart = source.indexOf(`async function ${functionName}(`);
  const start = exportedStart >= 0 ? exportedStart : localStart;

  assert.notEqual(start, -1, `falta la función ${functionName}`);

  const nextFunctionStart = source.indexOf("\nfunction ", start + 1);
  const nextAsyncFunctionStart = source.indexOf(
    "\nasync function ",
    start + 1,
  );
  const exportStart = source.indexOf("\nexport ", start + 1);
  const candidates = [
    nextFunctionStart,
    nextAsyncFunctionStart,
    exportStart,
  ].filter((index) => index > start);
  const end = Math.min(...candidates);

  assert.ok(
    Number.isFinite(end),
    `no se pudo encontrar el fin de la función ${functionName}`,
  );

  return source.slice(start, end);
}

function extractReturnedObjectKeys(functionSource: string): string[] {
  const returnStart = functionSource.indexOf("return {");

  assert.notEqual(
    returnStart,
    -1,
    "serializePublicProfessional debe devolver un objeto literal",
  );

  const returnEnd = functionSource.indexOf("\n  };", returnStart);

  assert.notEqual(
    returnEnd,
    -1,
    "no se pudo encontrar el cierre del objeto público retornado",
  );

  const returnedObject = functionSource.slice(returnStart, returnEnd);
  const keyMatches = returnedObject.matchAll(
    /^\s{4}([a-zA-Z][a-zA-Z0-9]*)(?::|,)/gm,
  );

  return [...keyMatches].map((match) => match[1]);
}

test("serializePublicProfessional expone solamente campos públicos esperados", () => {
  const source = readSource("server/features/public-professionals/public-professionals-query-service.ts");
  const serializePublicProfessional = extractFunction(source, "serializePublicProfessional");

  assert.deepEqual(extractReturnedObjectKeys(serializePublicProfessional), [
    "clinicId",
    "displayName",
    "avatarUrl",
    "specialtyText",
    "servicesText",
    "email",
    "phone",
    "locality",
    "country",
    "aboutText",
    "updatedAt",
    "relevance",
    "profileQualityScore",
  ]);

  for (const forbiddenKey of [
    "id:",
    "clinic_id:",
    "clinicName:",
    "avatarStoragePath:",
    "avatar_storage_path:",
    "searchText:",
    "specialtyNormalized:",
    "servicesNormalized:",
    "isSearchEligible:",
    "createdAt:",
    "deletedAt:",
    "password:",
    "sessionToken:",
    "tokenHash:",
    "rawToken:",
    "metadata:",
  ]) {
    assert.ok(
      !serializePublicProfessional.includes(forbiddenKey),
      `serializePublicProfessional no debe exponer ${forbiddenKey}`,
    );
  }
});

test("serializeProfessional firma avatarStoragePath sin exponer el path crudo", () => {
  const source = readSource("server/features/public-professionals/public-professionals-query-service.ts");
  const avatarUrlHelper = extractFunction(source, "resolvePublicAvatarUrl");
  const serializePublicProfessional = extractFunction(source, "serializePublicProfessional");

  assert.ok(
    avatarUrlHelper.includes("if (!row.avatarStoragePath)"),
    "avatarStoragePath ausente debe devolver null",
  );
  assert.ok(
    avatarUrlHelper.includes("return await createSignedStorageUrl(row.avatarStoragePath);"),
    "avatarStoragePath debe convertirse a avatarUrl firmado o null",
  );
  assert.ok(avatarUrlHelper.includes("catch {"));
  assert.ok(avatarUrlHelper.includes("return null;"));
  assert.ok(
    serializePublicProfessional.includes(
      "const avatarUrl = await resolvePublicAvatarUrl(\n    row,\n    createSignedStorageUrl,\n  );",
    ),
    "serializePublicProfessional debe delegar la firma segura de avatar",
  );

  assert.ok(
    serializePublicProfessional.includes("avatarUrl,"),
    "el payload público debe exponer avatarUrl",
  );

  assert.ok(
    !serializePublicProfessional.includes("avatarStoragePath:"),
    "el payload público no debe exponer avatarStoragePath",
  );
});

test("serializePublicProfessional conserva relevance público con defaults seguros", () => {
  const source = readSource("server/features/public-professionals/public-professionals-query-service.ts");
  const serializePublicProfessional = extractFunction(source, "serializePublicProfessional");

  assert.ok(
    serializePublicProfessional.includes("relevance: {\n      rank: row.rank ?? 0,\n      similarity: row.similarity ?? 0,\n      score: row.score ?? 0,\n    },"),
    "relevance debe mantener rank/similarity/score con defaults 0",
  );

  for (const rawRankingField of ["rank:", "similarity:", "score:"]) {
    const occurrences = serializePublicProfessional.split(rawRankingField).length - 1;

    assert.equal(
      occurrences,
      1,
      `${rawRankingField} debe exponerse solo dentro de relevance`,
    );
  }
});

test("serializePublicProfessional mantiene fechas y calidad pública sin fallback ambiguo", () => {
  const source = readSource("server/features/public-professionals/public-professionals-query-service.ts");
  const serializePublicProfessional = extractFunction(source, "serializePublicProfessional");

  assert.ok(
    serializePublicProfessional.includes("updatedAt: row.updatedAt,"),
    "updatedAt debe salir desde row.updatedAt para que Fastify serialice ISO estable",
  );

  assert.ok(
    serializePublicProfessional.includes(
      "profileQualityScore: row.profileQualityScore ?? null,",
    ),
    "profileQualityScore debe preservar número público o null",
  );

  assert.ok(
    !serializePublicProfessional.includes("new Date("),
    "serializePublicProfessional no debe inventar fechas",
  );

  assert.ok(
    !serializePublicProfessional.includes("Date.now("),
    "serializePublicProfessional no debe depender del reloj",
  );
});

test("search y detail usan la misma serialización pública", () => {
  const source = readSource("server/features/public-professionals/public-professionals-query-service.ts");

  assert.ok(
    source.includes(
      "result.rows.map((row) =>\n      serializePublicProfessional(\n        row,\n        deps.createSignedStorageUrl,\n      ),\n    ),",
    ),
    "search debe serializar cada resultado con serializePublicProfessional",
  );

  assert.ok(
    source.includes(
      "return serializePublicProfessional(\n    row,\n    deps.createSignedStorageUrl,\n  );",
    ),
    "detail debe serializar con serializePublicProfessional",
  );
});
