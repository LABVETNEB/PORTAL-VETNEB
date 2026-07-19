import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createRoutePlansWriteUseCases,
  type LogisticsRoutePlansWriteRepository,
} from "../../../../server/features/logistics/application/index.ts";

type StubRoutePlan = { id: number; clinicId: number; status: string };
type StubCreateInput = { clinicId: number; serviceDate: Date; label: string };
type StubUpdateInput = { label?: string; notes?: string };

function createRepositoryStub(behavior: {
  created?: StubRoutePlan | null;
  updated?: StubRoutePlan | null;
  error?: Error;
}) {
  const createCalls: StubCreateInput[] = [];
  const updateCalls: Array<{ id: number; clinicId: number; input: StubUpdateInput }> = [];

  const repository: LogisticsRoutePlansWriteRepository<
    StubRoutePlan,
    StubCreateInput,
    StubUpdateInput
  > = {
    createRoutePlan: (input) => {
      createCalls.push(input);
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.created ?? null);
    },
    updateClinicScopedRoutePlan: (id, clinicId, input) => {
      updateCalls.push({ id, clinicId, input });
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.updated ?? null);
    },
  };

  return { repository, createCalls, updateCalls };
}

test("createRoutePlan reenvía el input por identidad, delega una vez y devuelve por identidad", async () => {
  const input: StubCreateInput = {
    clinicId: 7,
    serviceDate: new Date("2026-05-01T00:00:00.000Z"),
    label: "ruta A",
  };
  const created: StubRoutePlan = { id: 1, clinicId: 7, status: "draft" };
  const { repository, createCalls } = createRepositoryStub({ created });
  const useCases = createRoutePlansWriteUseCases(repository);

  const result = await useCases.createRoutePlan(input);

  assert.equal(createCalls.length, 1);
  assert.strictEqual(createCalls[0], input);
  assert.strictEqual(result, created);
});

test("createRoutePlan propaga null del puerto sin transformarlo", async () => {
  const { repository } = createRepositoryStub({ created: null });
  const useCases = createRoutePlansWriteUseCases(repository);

  const result = await useCases.createRoutePlan({
    clinicId: 7,
    serviceDate: new Date(),
    label: "x",
  });

  assert.equal(result, null);
});

test("updateRoutePlan reenvía id, clinicId e input por identidad, delega una vez y devuelve por identidad", async () => {
  const input: StubUpdateInput = { label: "ruta B", notes: "n" };
  const updated: StubRoutePlan = { id: 42, clinicId: 7, status: "released" };
  const { repository, updateCalls } = createRepositoryStub({ updated });
  const useCases = createRoutePlansWriteUseCases(repository);

  const result = await useCases.updateRoutePlan(42, 7, input);

  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].id, 42);
  assert.equal(updateCalls[0].clinicId, 7);
  assert.strictEqual(updateCalls[0].input, input);
  assert.strictEqual(result, updated);
});

test("updateRoutePlan propaga null del puerto sin transformarlo", async () => {
  const { repository } = createRepositoryStub({ updated: null });
  const useCases = createRoutePlansWriteUseCases(repository);

  const result = await useCases.updateRoutePlan(404, 7, {});

  assert.equal(result, null);
});

test("las escrituras de plan propagan el error original del puerto por identidad", async () => {
  const originalError = new Error("fallo de escritura de plan");
  const { repository } = createRepositoryStub({ error: originalError });
  const useCases = createRoutePlansWriteUseCases(repository);

  for (const invoke of [
    () => useCases.createRoutePlan({ clinicId: 7, serviceDate: new Date(), label: "x" }),
    () => useCases.updateRoutePlan(42, 7, {}),
  ]) {
    let caught: unknown;
    await assert.rejects(invoke(), (error: unknown) => {
      caught = error;
      return error === originalError;
    });
    assert.strictEqual(caught, originalError);
  }
});

// --- Frontera de dependencias de las escrituras de plan (M08) ---

const APPLICATION_FILES = [
  "server/features/logistics/application/route-plans-write-use-cases.ts",
  "server/features/logistics/application/ports/logistics-route-plans-write-repository.ts",
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

test("las escrituras de plan de M08 no importan HTTP ni persistencia concreta", () => {
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
