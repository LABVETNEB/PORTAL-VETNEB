import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createListFieldVisits,
  type LogisticsFieldVisitsReadRepository,
} from "../../../../server/features/logistics/application/index.ts";

type StubFieldVisit = {
  id: number;
  clinicId: number;
  status: string;
};

type StubListParams = {
  clinicId: number;
  status?: string;
  limit: number;
  offset: number;
};

function createRepositoryStub(behavior: {
  result?: StubFieldVisit[];
  error?: Error;
}) {
  const calls: StubListParams[] = [];

  const repository: LogisticsFieldVisitsReadRepository<
    StubFieldVisit,
    StubListParams
  > = {
    listClinicFieldVisits: (params) => {
      calls.push(params);
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.result ?? []);
    },
  };

  return { repository, calls };
}

test("listFieldVisits reenvía params por identidad una vez y devuelve el array por identidad", async () => {
  const params: StubListParams = {
    clinicId: 7,
    status: "pending",
    limit: 50,
    offset: 0,
  };
  const result: StubFieldVisit[] = [
    { id: 1, clinicId: 7, status: "pending" },
    { id: 2, clinicId: 7, status: "pending" },
  ];
  const { repository, calls } = createRepositoryStub({ result });
  const listFieldVisits = createListFieldVisits(repository);

  const received = await listFieldVisits(params);

  assert.equal(calls.length, 1);
  assert.strictEqual(calls[0], params);
  assert.strictEqual(received, result);
});

test("listFieldVisits preserva el array vacío del puerto", async () => {
  const result: StubFieldVisit[] = [];
  const { repository, calls } = createRepositoryStub({ result });
  const listFieldVisits = createListFieldVisits(repository);

  const received = await listFieldVisits({ clinicId: 7, limit: 50, offset: 0 });

  assert.equal(calls.length, 1);
  assert.strictEqual(received, result);
  assert.deepEqual(received, []);
});

test("listFieldVisits realiza llamadas independientes sin memorizar resultados", async () => {
  const { repository, calls } = createRepositoryStub({ result: [] });
  const listFieldVisits = createListFieldVisits(repository);

  const first: StubListParams = { clinicId: 7, limit: 50, offset: 0 };
  const second: StubListParams = { clinicId: 7, limit: 50, offset: 50 };

  await listFieldVisits(first);
  await listFieldVisits(second);

  assert.equal(calls.length, 2);
  assert.strictEqual(calls[0], first);
  assert.strictEqual(calls[1], second);
});

test("listFieldVisits propaga el error original del puerto sin envolverlo", async () => {
  const originalError = new Error("fallo de listado");
  const { repository, calls } = createRepositoryStub({ error: originalError });
  const listFieldVisits = createListFieldVisits(repository);
  let caught: unknown;

  await assert.rejects(
    listFieldVisits({ clinicId: 7, limit: 50, offset: 0 }),
    (error: unknown) => {
      caught = error;
      return error === originalError;
    },
  );

  assert.equal(calls.length, 1);
  assert.strictEqual(caught, originalError);
});

const APPLICATION_FILES = [
  "server/features/logistics/application/list-field-visits.ts",
  "server/features/logistics/application/ports/logistics-field-visits-read-repository.ts",
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

test("el caso de uso list field visits de M15 no importa HTTP ni persistencia concreta", () => {
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
