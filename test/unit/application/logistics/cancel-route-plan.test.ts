import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createCancelRoutePlan,
  type LogisticsRoutePlanCancelRepository,
} from "../../../../server/features/logistics/application/index.ts";

// El resultado del puerto es opaco para el caso de uso (unión éxito/rechazo del
// dominio, igual que el seam `RoutePlanLifecycleTransitionResult`).
type StubResult =
  | { routePlan: { id: number; status: string }; currentStatus?: undefined }
  | { routePlan?: undefined; currentStatus: string };

function createRepositoryStub(behavior: { result?: StubResult; error?: Error }) {
  const calls: Array<{ id: number; clinicId: number }> = [];

  const repository: LogisticsRoutePlanCancelRepository<StubResult> = {
    cancelClinicScopedRoutePlan: (id, clinicId) => {
      calls.push({ id, clinicId });
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(
            behavior.result ?? { routePlan: { id, status: "canceled" } },
          );
    },
  };

  return { repository, calls };
}

test("cancelRoutePlan reenvía id y clinicId, delega una vez y devuelve por identidad", async () => {
  const result: StubResult = { routePlan: { id: 42, status: "canceled" } };
  const { repository, calls } = createRepositoryStub({ result });
  const cancelRoutePlan = createCancelRoutePlan(repository);

  const received = await cancelRoutePlan(42, 7);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { id: 42, clinicId: 7 });
  assert.strictEqual(received, result);
});

test("cancelRoutePlan preserva por identidad el resultado de rechazo del dominio", async () => {
  const result: StubResult = { currentStatus: "completed" };
  const { repository } = createRepositoryStub({ result });
  const cancelRoutePlan = createCancelRoutePlan(repository);

  const received = await cancelRoutePlan(42, 7);

  assert.strictEqual(received, result);
});

test("cancelRoutePlan propaga el error original del puerto sin envolverlo", async () => {
  const originalError = new Error("fallo de cancelación");
  const { repository } = createRepositoryStub({ error: originalError });
  const cancelRoutePlan = createCancelRoutePlan(repository);

  let caught: unknown;

  await assert.rejects(cancelRoutePlan(42, 7), (error: unknown) => {
    caught = error;
    return error === originalError;
  });

  assert.strictEqual(caught, originalError);
});

// --- Frontera de dependencias del caso de uso cancel (M08) ---

const APPLICATION_FILES = [
  "server/features/logistics/application/cancel-route-plan.ts",
  "server/features/logistics/application/ports/logistics-route-plan-cancel-repository.ts",
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

test("el caso de uso cancel de M08 no importa HTTP ni persistencia concreta", () => {
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
