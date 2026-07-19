import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createUpdateFieldVisit,
  type LogisticsFieldVisitUpdateRepository,
} from "../../../../server/features/logistics/application/index.ts";

type StubFieldVisit = {
  id: number;
  clinicId: number;
  status: string;
  notes: string | null;
};

type StubUpdateInput = {
  status?: string;
  notes?: string | null;
};

type RepositoryResult = StubFieldVisit | null | undefined;

function createRepositoryStub(behavior: {
  result?: RepositoryResult;
  error?: Error;
}) {
  const calls: Array<{
    id: number;
    clinicId: number;
    input: StubUpdateInput;
  }> = [];

  const repository: LogisticsFieldVisitUpdateRepository<
    StubFieldVisit,
    StubUpdateInput
  > = {
    updateClinicScopedFieldVisit: (id, clinicId, input) => {
      calls.push({ id, clinicId, input });
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.result);
    },
  };

  return { repository, calls };
}

test("updateFieldVisit reenvía id, clinicId e input combinado una vez y devuelve por identidad", async () => {
  const input: StubUpdateInput = {
    status: "in_progress",
    notes: "Ingreso confirmado",
  };
  const result: StubFieldVisit = {
    id: 42,
    clinicId: 7,
    status: "in_progress",
    notes: "Ingreso confirmado",
  };
  const { repository, calls } = createRepositoryStub({ result });
  const updateFieldVisit = createUpdateFieldVisit(repository);

  const received = await updateFieldVisit(42, 7, input);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { id: 42, clinicId: 7, input });
  assert.strictEqual(calls[0]?.input, input);
  assert.strictEqual(received, result);
});

test("updateFieldVisit preserva null", async () => {
  const { repository, calls } = createRepositoryStub({ result: null });
  const updateFieldVisit = createUpdateFieldVisit(repository);

  const received = await updateFieldVisit(42, 7, { status: "done" });

  assert.equal(calls.length, 1);
  assert.strictEqual(received, null);
});

test("updateFieldVisit preserva undefined", async () => {
  const { repository, calls } = createRepositoryStub({ result: undefined });
  const updateFieldVisit = createUpdateFieldVisit(repository);

  const received = await updateFieldVisit(42, 7, { status: "done" });

  assert.equal(calls.length, 1);
  assert.strictEqual(received, undefined);
});

test("updateFieldVisit propaga el error original del puerto sin envolverlo", async () => {
  const originalError = new Error("fallo de actualización");
  const { repository, calls } = createRepositoryStub({ error: originalError });
  const updateFieldVisit = createUpdateFieldVisit(repository);
  let caught: unknown;

  await assert.rejects(
    updateFieldVisit(42, 7, { status: "canceled" }),
    (error: unknown) => {
      caught = error;
      return error === originalError;
    },
  );

  assert.equal(calls.length, 1);
  assert.strictEqual(caught, originalError);
});

const APPLICATION_FILES = [
  "server/features/logistics/application/update-field-visit.ts",
  "server/features/logistics/application/ports/logistics-field-visit-update-repository.ts",
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

test("el caso de uso update field visit de M09 no importa HTTP ni persistencia concreta", () => {
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
