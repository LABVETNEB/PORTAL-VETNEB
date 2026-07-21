import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createCreateFieldVisit,
  type LogisticsFieldVisitCreateRepository,
} from "../../../../server/features/logistics/application/index.ts";

type StubFieldVisit = {
  id: number;
  clinicId: number;
  status: string;
  notes: string | null;
};

type StubCreateInput = {
  clinicId: number;
  status?: string;
  priority?: number;
  notes?: string | null;
};

type RepositoryResult = StubFieldVisit | null | undefined;

function createRepositoryStub(behavior: {
  result?: RepositoryResult;
  error?: Error;
}) {
  const calls: StubCreateInput[] = [];

  const repository: LogisticsFieldVisitCreateRepository<
    StubFieldVisit,
    StubCreateInput
  > = {
    createFieldVisit: (input) => {
      calls.push(input);
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.result);
    },
  };

  return { repository, calls };
}

test("createFieldVisit reenvía el input por identidad una vez y devuelve el resultado por identidad", async () => {
  const input: StubCreateInput = {
    clinicId: 7,
    status: "pending",
    priority: 2,
    notes: "Visita programada",
  };
  const result: StubFieldVisit = {
    id: 42,
    clinicId: 7,
    status: "pending",
    notes: "Visita programada",
  };
  const { repository, calls } = createRepositoryStub({ result });
  const createFieldVisitUseCase = createCreateFieldVisit(repository);

  const received = await createFieldVisitUseCase(input);

  assert.equal(calls.length, 1);
  assert.strictEqual(calls[0], input);
  assert.strictEqual(received, result);
});

test("createFieldVisit preserva null", async () => {
  const { repository, calls } = createRepositoryStub({ result: null });
  const createFieldVisitUseCase = createCreateFieldVisit(repository);

  const received = await createFieldVisitUseCase({ clinicId: 7 });

  assert.equal(calls.length, 1);
  assert.strictEqual(received, null);
});

test("createFieldVisit preserva undefined", async () => {
  const { repository, calls } = createRepositoryStub({ result: undefined });
  const createFieldVisitUseCase = createCreateFieldVisit(repository);

  const received = await createFieldVisitUseCase({ clinicId: 7 });

  assert.equal(calls.length, 1);
  assert.strictEqual(received, undefined);
});

test("createFieldVisit propaga el error original del puerto sin envolverlo", async () => {
  const originalError = new Error("fallo de creación");
  const { repository, calls } = createRepositoryStub({ error: originalError });
  const createFieldVisitUseCase = createCreateFieldVisit(repository);
  let caught: unknown;

  await assert.rejects(
    createFieldVisitUseCase({ clinicId: 7, status: "pending" }),
    (error: unknown) => {
      caught = error;
      return error === originalError;
    },
  );

  assert.equal(calls.length, 1);
  assert.strictEqual(caught, originalError);
});

const APPLICATION_FILES = [
  "server/features/logistics/application/create-field-visit.ts",
  "server/features/logistics/application/ports/logistics-field-visit-create-repository.ts",
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

test("el caso de uso create field visit de M15 no importa HTTP ni persistencia concreta", () => {
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
