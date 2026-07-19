import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createListOverdueActiveSlaInstances,
  type ListOverdueActiveSlaInstancesInput,
  type LogisticsSlaReadRepository,
} from "../../../../server/features/logistics/application/index.ts";

// Tipos de stub deliberadamente propios del test: demuestran que el caso de uso
// es unit-testable sin Fastify, sin DB y sin tipos concretos del schema.
type StubTargetType = "field_visit" | "route_plan";

type StubSlaInstance = {
  id: number;
  clinicId: number;
  dueAt: Date;
  metadata: { source: string };
};

function createRepositoryStub(behavior: {
  result?: StubSlaInstance[];
  error?: Error;
}) {
  const receivedInputs: Array<
    ListOverdueActiveSlaInstancesInput<StubTargetType>
  > = [];

  const repository: LogisticsSlaReadRepository<StubSlaInstance, StubTargetType> = {
    listOverdueActiveClinicSlaInstances: (input) => {
      receivedInputs.push(input);

      if (behavior.error) {
        return Promise.reject(behavior.error);
      }

      return Promise.resolve(behavior.result ?? []);
    },
  };

  return { repository, receivedInputs };
}

test("el caso de uso reenvía el input exacto al puerto con valores no-default", async () => {
  const dueAtOrBefore = new Date("2026-03-04T05:06:07.089Z");
  const input: ListOverdueActiveSlaInstancesInput<StubTargetType> = {
    clinicId: 7,
    dueAtOrBefore,
    targetType: "route_plan",
    limit: 13,
    offset: 29,
  };
  const { repository, receivedInputs } = createRepositoryStub({ result: [] });
  const listOverdueActiveSlaInstances =
    createListOverdueActiveSlaInstances(repository);

  await listOverdueActiveSlaInstances(input);

  assert.equal(receivedInputs.length, 1);

  const received = receivedInputs[0];
  assert.strictEqual(received, input);
  assert.equal(received.clinicId, 7);
  assert.strictEqual(received.dueAtOrBefore, dueAtOrBefore);
  assert.equal(received.targetType, "route_plan");
  assert.equal(received.limit, 13);
  assert.equal(received.offset, 29);
});

test("el caso de uso invoca el puerto exactamente una vez por ejecución", async () => {
  const { repository, receivedInputs } = createRepositoryStub({ result: [] });
  const listOverdueActiveSlaInstances =
    createListOverdueActiveSlaInstances(repository);

  await listOverdueActiveSlaInstances({
    clinicId: 3,
    dueAtOrBefore: new Date("2026-05-05T00:00:00.000Z"),
  });

  assert.equal(receivedInputs.length, 1);

  await listOverdueActiveSlaInstances({
    clinicId: 3,
    dueAtOrBefore: new Date("2026-05-06T00:00:00.000Z"),
  });

  assert.equal(receivedInputs.length, 2);
});

test("el caso de uso devuelve el resultado del puerto por identidad, sin mapear ni clonar", async () => {
  const dueAt = new Date("2026-05-01T12:00:00.000Z");
  const instance: StubSlaInstance = {
    id: 21,
    clinicId: 7,
    dueAt,
    metadata: { source: "unit-test" },
  };
  const repositoryResult = [instance];
  const { repository } = createRepositoryStub({ result: repositoryResult });
  const listOverdueActiveSlaInstances =
    createListOverdueActiveSlaInstances(repository);

  const result = await listOverdueActiveSlaInstances({
    clinicId: 7,
    dueAtOrBefore: new Date("2026-05-05T00:00:00.000Z"),
  });

  assert.strictEqual(result, repositoryResult);
  assert.strictEqual(result[0], instance);
  assert.strictEqual(result[0].dueAt, dueAt);
  assert.strictEqual(result[0].metadata, instance.metadata);
});

test("el caso de uso propaga el error original del puerto sin envolverlo ni reemplazarlo", async () => {
  const originalError = new Error("fallo de lectura overdue");
  const { repository } = createRepositoryStub({ error: originalError });
  const listOverdueActiveSlaInstances =
    createListOverdueActiveSlaInstances(repository);

  let caught: unknown;

  await assert.rejects(
    listOverdueActiveSlaInstances({
      clinicId: 7,
      dueAtOrBefore: new Date("2026-05-05T00:00:00.000Z"),
    }),
    (error: unknown) => {
      caught = error;
      return error === originalError;
    },
  );

  assert.strictEqual(caught, originalError);
});

// --- Frontera de dependencias de la capa application (M06) ---

const APPLICATION_FILES = [
  "server/features/logistics/application/index.ts",
  "server/features/logistics/application/list-overdue-active-sla-instances.ts",
  "server/features/logistics/application/ports/logistics-sla-read-repository.ts",
] as const;

// Se escanean únicamente import specifiers (no texto libre ni comentarios),
// para evitar falsos positivos sobre documentación o nombres de test.
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

test("la capa application de M06 no importa HTTP ni persistencia concreta", () => {
  const violations: string[] = [];

  for (const file of APPLICATION_FILES) {
    const source = readFileSync(
      join(process.cwd(), ...file.split("/")),
      "utf8",
    );

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
