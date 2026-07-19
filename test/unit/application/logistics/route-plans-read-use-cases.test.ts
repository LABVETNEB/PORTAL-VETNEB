import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createRoutePlansReadUseCases,
  type LogisticsRoutePlansReadRepository,
} from "../../../../server/features/logistics/application/index.ts";

// Tipos de stub propios del test: el caso de uso es unit-testable sin Fastify,
// sin DB y sin tipos concretos del schema.
type StubListParams = {
  clinicId: number;
  status?: string;
  limit: number;
  offset: number;
};

type StubRoutePlan = { id: number; clinicId: number; serviceDate: Date };
type StubRouteStop = { id: number; routePlanId: number; sequence: number };

function createRepositoryStub(behavior: {
  routePlans?: StubRoutePlan[];
  routePlan?: StubRoutePlan | null;
  routeStops?: StubRouteStop[];
  error?: Error;
}) {
  const listParamsCalls: StubListParams[] = [];
  const getCalls: Array<{ id: number; clinicId: number }> = [];
  const stopsCalls: Array<{ routePlanId: number; clinicId: number }> = [];

  const repository: LogisticsRoutePlansReadRepository<
    StubRoutePlan,
    StubRouteStop,
    StubListParams
  > = {
    listClinicRoutePlans: (params) => {
      listParamsCalls.push(params);
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.routePlans ?? []);
    },
    getClinicScopedRoutePlan: (id, clinicId) => {
      getCalls.push({ id, clinicId });
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.routePlan ?? null);
    },
    listRouteStopsForClinicRoutePlan: (routePlanId, clinicId) => {
      stopsCalls.push({ routePlanId, clinicId });
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.routeStops ?? []);
    },
  };

  return { repository, listParamsCalls, getCalls, stopsCalls };
}

test("listRoutePlans reenvía los params exactos por identidad y delega una sola vez", async () => {
  const params: StubListParams = {
    clinicId: 7,
    status: "released",
    limit: 13,
    offset: 29,
  };
  const { repository, listParamsCalls } = createRepositoryStub({});
  const useCases = createRoutePlansReadUseCases(repository);

  await useCases.listRoutePlans(params);

  assert.equal(listParamsCalls.length, 1);
  assert.strictEqual(listParamsCalls[0], params);
});

test("listRoutePlans devuelve el resultado del puerto por identidad, sin mapear ni clonar", async () => {
  const routePlans = [{ id: 1, clinicId: 7, serviceDate: new Date() }];
  const { repository } = createRepositoryStub({ routePlans });
  const useCases = createRoutePlansReadUseCases(repository);

  const result = await useCases.listRoutePlans({
    clinicId: 7,
    limit: 50,
    offset: 0,
  });

  assert.strictEqual(result, routePlans);
  assert.strictEqual(result[0], routePlans[0]);
});

test("getRoutePlan reenvía id y clinicId, delega una vez y devuelve por identidad", async () => {
  const serviceDate = new Date("2026-05-01T00:00:00.000Z");
  const routePlan = { id: 42, clinicId: 7, serviceDate };
  const { repository, getCalls } = createRepositoryStub({ routePlan });
  const useCases = createRoutePlansReadUseCases(repository);

  const result = await useCases.getRoutePlan(42, 7);

  assert.equal(getCalls.length, 1);
  assert.deepEqual(getCalls[0], { id: 42, clinicId: 7 });
  assert.strictEqual(result, routePlan);
  assert.strictEqual(result?.serviceDate, serviceDate);
});

test("getRoutePlan propaga null del puerto sin transformarlo", async () => {
  const { repository } = createRepositoryStub({ routePlan: null });
  const useCases = createRoutePlansReadUseCases(repository);

  const result = await useCases.getRoutePlan(404, 7);

  assert.equal(result, null);
});

test("listRoutePlanStops reenvía routePlanId y clinicId, delega una vez y devuelve por identidad", async () => {
  const routeStops = [{ id: 5, routePlanId: 42, sequence: 1 }];
  const { repository, stopsCalls } = createRepositoryStub({ routeStops });
  const useCases = createRoutePlansReadUseCases(repository);

  const result = await useCases.listRoutePlanStops(42, 7);

  assert.equal(stopsCalls.length, 1);
  assert.deepEqual(stopsCalls[0], { routePlanId: 42, clinicId: 7 });
  assert.strictEqual(result, routeStops);
});

test("los casos de uso de lectura propagan el error original del puerto por identidad", async () => {
  const originalError = new Error("fallo de lectura route-plans");
  const { repository } = createRepositoryStub({ error: originalError });
  const useCases = createRoutePlansReadUseCases(repository);

  for (const invoke of [
    () => useCases.listRoutePlans({ clinicId: 7, limit: 50, offset: 0 }),
    () => useCases.getRoutePlan(42, 7),
    () => useCases.listRoutePlanStops(42, 7),
  ]) {
    let caught: unknown;
    await assert.rejects(invoke(), (error: unknown) => {
      caught = error;
      return error === originalError;
    });
    assert.strictEqual(caught, originalError);
  }
});

// --- Frontera de dependencias de las lecturas de route-plans (M07) ---

const APPLICATION_FILES = [
  "server/features/logistics/application/route-plans-read-use-cases.ts",
  "server/features/logistics/application/ports/logistics-route-plans-read-repository.ts",
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

test("las lecturas de route-plans de M07 no importan HTTP ni persistencia concreta", () => {
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
