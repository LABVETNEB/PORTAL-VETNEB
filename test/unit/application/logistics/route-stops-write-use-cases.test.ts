import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createRouteStopsWriteUseCases,
  type LogisticsRouteStopsWriteRepository,
} from "../../../../server/features/logistics/application/index.ts";

type StubRouteStop = { id: number; routePlanId: number; sequence: number };
type StubCreateInput = { routePlanId: number; clinicId: number; fieldVisitId: number };
type StubUpdateInput = { sequence?: number; status?: string };

function createRepositoryStub(behavior: {
  created?: StubRouteStop | null;
  updated?: StubRouteStop | null;
  error?: Error;
}) {
  const createCalls: StubCreateInput[] = [];
  const updateCalls: Array<{ id: number; clinicId: number; input: StubUpdateInput }> = [];

  const repository: LogisticsRouteStopsWriteRepository<
    StubRouteStop,
    StubCreateInput,
    StubUpdateInput
  > = {
    createRouteStopForClinicRoutePlan: (input) => {
      createCalls.push(input);
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.created ?? null);
    },
    updateClinicScopedRouteStop: (id, clinicId, input) => {
      updateCalls.push({ id, clinicId, input });
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.updated ?? null);
    },
  };

  return { repository, createCalls, updateCalls };
}

test("createRouteStop reenvía el input por identidad, delega una vez y devuelve por identidad", async () => {
  const input: StubCreateInput = { routePlanId: 42, clinicId: 7, fieldVisitId: 55 };
  const created: StubRouteStop = { id: 5, routePlanId: 42, sequence: 1 };
  const { repository, createCalls } = createRepositoryStub({ created });
  const useCases = createRouteStopsWriteUseCases(repository);

  const result = await useCases.createRouteStop(input);

  assert.equal(createCalls.length, 1);
  assert.strictEqual(createCalls[0], input);
  assert.strictEqual(result, created);
});

test("createRouteStop propaga null del puerto sin transformarlo", async () => {
  const { repository } = createRepositoryStub({ created: null });
  const useCases = createRouteStopsWriteUseCases(repository);

  const result = await useCases.createRouteStop({
    routePlanId: 42,
    clinicId: 7,
    fieldVisitId: 55,
  });

  assert.equal(result, null);
});

test("updateRouteStop reenvía id, clinicId e input por identidad, delega una vez y devuelve por identidad", async () => {
  const input: StubUpdateInput = { sequence: 3, status: "done" };
  const updated: StubRouteStop = { id: 5, routePlanId: 42, sequence: 3 };
  const { repository, updateCalls } = createRepositoryStub({ updated });
  const useCases = createRouteStopsWriteUseCases(repository);

  const result = await useCases.updateRouteStop(5, 7, input);

  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].id, 5);
  assert.equal(updateCalls[0].clinicId, 7);
  assert.strictEqual(updateCalls[0].input, input);
  assert.strictEqual(result, updated);
});

test("updateRouteStop propaga null del puerto sin transformarlo", async () => {
  const { repository } = createRepositoryStub({ updated: null });
  const useCases = createRouteStopsWriteUseCases(repository);

  const result = await useCases.updateRouteStop(404, 7, {});

  assert.equal(result, null);
});

test("las escrituras de stop propagan el error original del puerto por identidad", async () => {
  const originalError = new Error("fallo de escritura de stop");
  const { repository } = createRepositoryStub({ error: originalError });
  const useCases = createRouteStopsWriteUseCases(repository);

  for (const invoke of [
    () => useCases.createRouteStop({ routePlanId: 42, clinicId: 7, fieldVisitId: 55 }),
    () => useCases.updateRouteStop(5, 7, {}),
  ]) {
    let caught: unknown;
    await assert.rejects(invoke(), (error: unknown) => {
      caught = error;
      return error === originalError;
    });
    assert.strictEqual(caught, originalError);
  }
});

// --- Frontera de dependencias de las escrituras de stop (M08) ---

const APPLICATION_FILES = [
  "server/features/logistics/application/route-stops-write-use-cases.ts",
  "server/features/logistics/application/ports/logistics-route-stops-write-repository.ts",
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

test("las escrituras de stop de M08 no importan HTTP ni persistencia concreta", () => {
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
