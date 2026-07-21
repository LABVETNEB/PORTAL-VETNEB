import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createVisitLocationUseCases,
  type LogisticsVisitLocationRepository,
} from "../../../../server/features/logistics/application/index.ts";

type StubVisitLocation = {
  id: number;
  fieldVisitId: number;
  addressRaw: string;
};

type StubUpsertInput = {
  fieldVisitId: number;
  clinicId: number;
  addressRaw: string;
};

type RepositoryResult = StubVisitLocation | null | undefined;

function createRepositoryStub(behavior: {
  getResult?: RepositoryResult;
  upsertResult?: RepositoryResult;
  getError?: Error;
  upsertError?: Error;
}) {
  const getCalls: Array<{ fieldVisitId: number; clinicId: number }> = [];
  const upsertCalls: StubUpsertInput[] = [];

  const repository: LogisticsVisitLocationRepository<
    StubVisitLocation,
    StubUpsertInput
  > = {
    getVisitLocationForClinicVisit: (fieldVisitId, clinicId) => {
      getCalls.push({ fieldVisitId, clinicId });
      return behavior.getError
        ? Promise.reject(behavior.getError)
        : Promise.resolve(behavior.getResult);
    },
    upsertVisitLocationForClinicVisit: (input) => {
      upsertCalls.push(input);
      return behavior.upsertError
        ? Promise.reject(behavior.upsertError)
        : Promise.resolve(behavior.upsertResult);
    },
  };

  return { repository, getCalls, upsertCalls };
}

test("getVisitLocation reenvía fieldVisitId y clinicId una vez y devuelve el resultado por identidad", async () => {
  const result: StubVisitLocation = {
    id: 3,
    fieldVisitId: 42,
    addressRaw: "Av. Siempreviva 742",
  };
  const { repository, getCalls, upsertCalls } = createRepositoryStub({
    getResult: result,
  });
  const visitLocationUseCases = createVisitLocationUseCases(repository);

  const received = await visitLocationUseCases.getVisitLocation(42, 7);

  assert.equal(getCalls.length, 1);
  assert.deepEqual(getCalls[0], { fieldVisitId: 42, clinicId: 7 });
  assert.equal(upsertCalls.length, 0);
  assert.strictEqual(received, result);
});

test("getVisitLocation preserva null y undefined", async () => {
  const nullStub = createRepositoryStub({ getResult: null });
  const nullUseCases = createVisitLocationUseCases(nullStub.repository);
  assert.strictEqual(await nullUseCases.getVisitLocation(42, 7), null);
  assert.equal(nullStub.getCalls.length, 1);

  const undefinedStub = createRepositoryStub({ getResult: undefined });
  const undefinedUseCases = createVisitLocationUseCases(
    undefinedStub.repository,
  );
  assert.strictEqual(await undefinedUseCases.getVisitLocation(42, 7), undefined);
  assert.equal(undefinedStub.getCalls.length, 1);
});

test("upsertVisitLocation reenvía el input por identidad una vez y devuelve el resultado por identidad", async () => {
  const input: StubUpsertInput = {
    fieldVisitId: 42,
    clinicId: 7,
    addressRaw: "Av. Siempreviva 742",
  };
  const result: StubVisitLocation = {
    id: 3,
    fieldVisitId: 42,
    addressRaw: "Av. Siempreviva 742",
  };
  const { repository, getCalls, upsertCalls } = createRepositoryStub({
    upsertResult: result,
  });
  const visitLocationUseCases = createVisitLocationUseCases(repository);

  const received = await visitLocationUseCases.upsertVisitLocation(input);

  assert.equal(upsertCalls.length, 1);
  assert.strictEqual(upsertCalls[0], input);
  assert.equal(getCalls.length, 0);
  assert.strictEqual(received, result);
});

test("upsertVisitLocation preserva null y undefined", async () => {
  const input: StubUpsertInput = {
    fieldVisitId: 42,
    clinicId: 7,
    addressRaw: "Av. Siempreviva 742",
  };

  const nullStub = createRepositoryStub({ upsertResult: null });
  const nullUseCases = createVisitLocationUseCases(nullStub.repository);
  assert.strictEqual(await nullUseCases.upsertVisitLocation(input), null);
  assert.equal(nullStub.upsertCalls.length, 1);

  const undefinedStub = createRepositoryStub({ upsertResult: undefined });
  const undefinedUseCases = createVisitLocationUseCases(
    undefinedStub.repository,
  );
  assert.strictEqual(
    await undefinedUseCases.upsertVisitLocation(input),
    undefined,
  );
  assert.equal(undefinedStub.upsertCalls.length, 1);
});

test("las operaciones de visit location propagan el error original del puerto sin envolverlo", async () => {
  const getError = new Error("fallo de lectura de ubicación");
  const upsertError = new Error("fallo de upsert de ubicación");
  const { repository, getCalls, upsertCalls } = createRepositoryStub({
    getError,
    upsertError,
  });
  const visitLocationUseCases = createVisitLocationUseCases(repository);

  await assert.rejects(
    visitLocationUseCases.getVisitLocation(42, 7),
    (error: unknown) => error === getError,
  );
  await assert.rejects(
    visitLocationUseCases.upsertVisitLocation({
      fieldVisitId: 42,
      clinicId: 7,
      addressRaw: "Av. Siempreviva 742",
    }),
    (error: unknown) => error === upsertError,
  );

  assert.equal(getCalls.length, 1);
  assert.equal(upsertCalls.length, 1);
});

const APPLICATION_FILES = [
  "server/features/logistics/application/visit-location-use-cases.ts",
  "server/features/logistics/application/ports/logistics-visit-location-repository.ts",
] as const;

function listImportSpecifiers(source: string): string[] {
  return Array.from(
    source.matchAll(
      /\bfrom\s+["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g,
    ),
    (match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
  );
}

const FORBIDDEN_IMPORT_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "fastify", pattern: /^fastify(\/|$)/ },
  { label: "server/db-logistics", pattern: /db-logistics/ },
  { label: "server/db", pattern: /(^|\/)db(\.ts)?$/ },
  { label: "drizzle-orm", pattern: /^drizzle-orm(\/|$)/ },
  { label: "drizzle/schema", pattern: /drizzle\/schema/ },
  { label: "server/lib", pattern: /(^|\/)lib\// },
  { label: "server/routes", pattern: /(^|\/)routes\// },
];

test("los casos de uso de visit location de M15 no importan HTTP ni persistencia concreta", () => {
  const violations: string[] = [];

  for (const file of APPLICATION_FILES) {
    const source = readFileSync(join(process.cwd(), ...file.split("/")), "utf8");
    for (const specifier of listImportSpecifiers(source)) {
      for (const { label, pattern } of FORBIDDEN_IMPORT_RULES) {
        if (pattern.test(specifier)) {
          violations.push(`${file}: ${label} ("${specifier}")`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});
