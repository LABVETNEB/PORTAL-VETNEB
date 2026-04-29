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
  const start = source.indexOf(`async function ${functionName}(`);

  assert.notEqual(start, -1, `falta la función ${functionName}`);

  const nextFunctionStart = source.indexOf("\nfunction ", start + 1);
  const exportStart = source.indexOf("\nexport ", start + 1);
  const candidates = [nextFunctionStart, exportStart].filter(
    (index) => index > start,
  );
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
    "serializeProfessional debe devolver un objeto literal",
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

test("serializeProfessional expone solamente campos públicos esperados", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const serializeProfessional = extractFunction(source, "serializeProfessional");

  assert.deepEqual(extractReturnedObjectKeys(serializeProfessional), [
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
      !serializeProfessional.includes(forbiddenKey),
      `serializeProfessional no debe exponer ${forbiddenKey}`,
    );
  }
});

test("serializeProfessional firma avatarStoragePath sin exponer el path crudo", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const serializeProfessional = extractFunction(source, "serializeProfessional");

  assert.ok(
    serializeProfessional.includes(
      "const avatarUrl = row.avatarStoragePath\n    ? await createSignedStorageUrl(row.avatarStoragePath)\n    : null;",
    ),
    "avatarStoragePath debe convertirse a avatarUrl firmado o null",
  );

  assert.ok(
    serializeProfessional.includes("avatarUrl,"),
    "el payload público debe exponer avatarUrl",
  );

  assert.ok(
    !serializeProfessional.includes("avatarStoragePath:"),
    "el payload público no debe exponer avatarStoragePath",
  );
});

test("serializeProfessional conserva relevance público con defaults seguros", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const serializeProfessional = extractFunction(source, "serializeProfessional");

  assert.ok(
    serializeProfessional.includes("relevance: {\n      rank: row.rank ?? 0,\n      similarity: row.similarity ?? 0,\n      score: row.score ?? 0,\n    },"),
    "relevance debe mantener rank/similarity/score con defaults 0",
  );

  for (const rawRankingField of ["rank:", "similarity:", "score:"]) {
    const occurrences = serializeProfessional.split(rawRankingField).length - 1;

    assert.equal(
      occurrences,
      1,
      `${rawRankingField} debe exponerse solo dentro de relevance`,
    );
  }
});

test("serializeProfessional mantiene fechas y calidad pública sin fallback ambiguo", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");
  const serializeProfessional = extractFunction(source, "serializeProfessional");

  assert.ok(
    serializeProfessional.includes("updatedAt: row.updatedAt,"),
    "updatedAt debe salir desde row.updatedAt para que Fastify serialice ISO estable",
  );

  assert.ok(
    serializeProfessional.includes(
      "profileQualityScore: row.profileQualityScore ?? null,",
    ),
    "profileQualityScore debe preservar número público o null",
  );

  assert.ok(
    !serializeProfessional.includes("new Date("),
    "serializeProfessional no debe inventar fechas",
  );

  assert.ok(
    !serializeProfessional.includes("Date.now("),
    "serializeProfessional no debe depender del reloj",
  );
});

test("search y detail usan la misma serialización pública", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");

  assert.ok(
    source.includes(
      "result.rows.map((row) =>\n          serializeProfessional(row, createSignedStorageUrl),\n        ),",
    ),
    "search debe serializar cada resultado con serializeProfessional",
  );

  assert.ok(
    source.includes(
      "professional: await serializeProfessional(\n          professional,\n          createSignedStorageUrl,\n        ),",
    ),
    "detail debe serializar con serializeProfessional",
  );
});

