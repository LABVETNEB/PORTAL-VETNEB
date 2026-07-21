import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createTimeWindowUseCases,
  type LogisticsTimeWindowsRepository,
} from "../../../../server/features/logistics/application/index.ts";

type StubTimeWindow = {
  id: number;
  fieldVisitId: number;
  isHard: boolean;
};

type StubCreateInput = {
  fieldVisitId: number;
  clinicId: number;
  isHard?: boolean;
};

type RepositoryResult = StubTimeWindow | null | undefined;

function createRepositoryStub(behavior: {
  listResult?: StubTimeWindow[];
  createResult?: RepositoryResult;
  listError?: Error;
  createError?: Error;
}) {
  const listCalls: Array<{ fieldVisitId: number; clinicId: number }> = [];
  const createCalls: StubCreateInput[] = [];

  const repository: LogisticsTimeWindowsRepository<
    StubTimeWindow,
    StubCreateInput
  > = {
    listTimeWindowsForClinicVisit: (fieldVisitId, clinicId) => {
      listCalls.push({ fieldVisitId, clinicId });
      return behavior.listError
        ? Promise.reject(behavior.listError)
        : Promise.resolve(behavior.listResult ?? []);
    },
    createTimeWindowForClinicVisit: (input) => {
      createCalls.push(input);
      return behavior.createError
        ? Promise.reject(behavior.createError)
        : Promise.resolve(behavior.createResult);
    },
  };

  return { repository, listCalls, createCalls };
}

test("listTimeWindows reenvía fieldVisitId y clinicId una vez y devuelve el array por identidad", async () => {
  const result: StubTimeWindow[] = [
    { id: 1, fieldVisitId: 42, isHard: true },
    { id: 2, fieldVisitId: 42, isHard: false },
  ];
  const { repository, listCalls, createCalls } = createRepositoryStub({
    listResult: result,
  });
  const timeWindowUseCases = createTimeWindowUseCases(repository);

  const received = await timeWindowUseCases.listTimeWindows(42, 7);

  assert.equal(listCalls.length, 1);
  assert.deepEqual(listCalls[0], { fieldVisitId: 42, clinicId: 7 });
  assert.equal(createCalls.length, 0);
  assert.strictEqual(received, result);
});

test("listTimeWindows preserva el array vacío del puerto", async () => {
  const result: StubTimeWindow[] = [];
  const { repository, listCalls } = createRepositoryStub({
    listResult: result,
  });
  const timeWindowUseCases = createTimeWindowUseCases(repository);

  const received = await timeWindowUseCases.listTimeWindows(42, 7);

  assert.equal(listCalls.length, 1);
  assert.strictEqual(received, result);
  assert.deepEqual(received, []);
});

test("createTimeWindow reenvía el input por identidad una vez y devuelve el resultado por identidad", async () => {
  const input: StubCreateInput = { fieldVisitId: 42, clinicId: 7, isHard: true };
  const result: StubTimeWindow = { id: 3, fieldVisitId: 42, isHard: true };
  const { repository, listCalls, createCalls } = createRepositoryStub({
    createResult: result,
  });
  const timeWindowUseCases = createTimeWindowUseCases(repository);

  const received = await timeWindowUseCases.createTimeWindow(input);

  assert.equal(createCalls.length, 1);
  assert.strictEqual(createCalls[0], input);
  assert.equal(listCalls.length, 0);
  assert.strictEqual(received, result);
});

test("createTimeWindow preserva null y undefined", async () => {
  const input: StubCreateInput = { fieldVisitId: 42, clinicId: 7 };

  const nullStub = createRepositoryStub({ createResult: null });
  const nullUseCases = createTimeWindowUseCases(nullStub.repository);
  assert.strictEqual(await nullUseCases.createTimeWindow(input), null);
  assert.equal(nullStub.createCalls.length, 1);

  const undefinedStub = createRepositoryStub({ createResult: undefined });
  const undefinedUseCases = createTimeWindowUseCases(undefinedStub.repository);
  assert.strictEqual(await undefinedUseCases.createTimeWindow(input), undefined);
  assert.equal(undefinedStub.createCalls.length, 1);
});

test("las operaciones de time windows propagan el error original del puerto sin envolverlo", async () => {
  const listError = new Error("fallo de listado de ventanas");
  const createError = new Error("fallo de creación de ventana");
  const { repository, listCalls, createCalls } = createRepositoryStub({
    listError,
    createError,
  });
  const timeWindowUseCases = createTimeWindowUseCases(repository);

  await assert.rejects(
    timeWindowUseCases.listTimeWindows(42, 7),
    (error: unknown) => error === listError,
  );
  await assert.rejects(
    timeWindowUseCases.createTimeWindow({ fieldVisitId: 42, clinicId: 7 }),
    (error: unknown) => error === createError,
  );

  assert.equal(listCalls.length, 1);
  assert.equal(createCalls.length, 1);
});

const APPLICATION_FILES = [
  "server/features/logistics/application/time-window-use-cases.ts",
  "server/features/logistics/application/ports/logistics-time-windows-repository.ts",
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

test("los casos de uso de time windows de M15 no importan HTTP ni persistencia concreta", () => {
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
