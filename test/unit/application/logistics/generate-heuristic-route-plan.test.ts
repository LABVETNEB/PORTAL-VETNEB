import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createGenerateHeuristicRoutePlan,
  type LogisticsRoutePlanGenerator,
} from "../../../../server/features/logistics/application/index.ts";

// Tipos de stub propios del test: el caso de uso no conoce Fastify, DB ni el
// schema. `TInput`/`TResult` son opacos para el caso de uso.
type StubInput = {
  clinicId: number;
  serviceDate: Date;
  fieldVisitIds: number[];
};

type StubResult =
  | { routePlan: { id: number }; warnings: string[]; reason?: undefined }
  | { routePlan?: undefined; reason: "no_visits" };

function createGeneratorStub(behavior: {
  result?: StubResult;
  error?: Error;
}) {
  const receivedInputs: StubInput[] = [];

  const generator: LogisticsRoutePlanGenerator<StubInput, StubResult> = {
    generateHeuristicRoutePlan: (input) => {
      receivedInputs.push(input);
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(
            behavior.result ?? { routePlan: { id: 1 }, warnings: [] },
          );
    },
  };

  return { generator, receivedInputs };
}

test("el caso de uso reenvía el input exacto al generador por identidad y delega una vez", async () => {
  const input: StubInput = {
    clinicId: 7,
    serviceDate: new Date("2026-05-01T00:00:00.000Z"),
    fieldVisitIds: [11, 22, 33],
  };
  const { generator, receivedInputs } = createGeneratorStub({});
  const generateHeuristicRoutePlan = createGenerateHeuristicRoutePlan(generator);

  await generateHeuristicRoutePlan(input);

  assert.equal(receivedInputs.length, 1);
  assert.strictEqual(receivedInputs[0], input);
  assert.strictEqual(receivedInputs[0].fieldVisitIds, input.fieldVisitIds);
});

test("el caso de uso devuelve el resultado del generador por identidad, sin mapear ni clonar", async () => {
  const result: StubResult = {
    routePlan: { id: 99 },
    warnings: ["ventana ajustada"],
  };
  const { generator } = createGeneratorStub({ result });
  const generateHeuristicRoutePlan = createGenerateHeuristicRoutePlan(generator);

  const received = await generateHeuristicRoutePlan({
    clinicId: 7,
    serviceDate: new Date(),
    fieldVisitIds: [1],
  });

  assert.strictEqual(received, result);
});

test("el caso de uso preserva el resultado de rechazo del dominio sin reinterpretarlo", async () => {
  const result: StubResult = { reason: "no_visits" };
  const { generator } = createGeneratorStub({ result });
  const generateHeuristicRoutePlan = createGenerateHeuristicRoutePlan(generator);

  const received = await generateHeuristicRoutePlan({
    clinicId: 7,
    serviceDate: new Date(),
    fieldVisitIds: [],
  });

  assert.strictEqual(received, result);
});

test("el caso de uso propaga el error original del generador sin envolverlo", async () => {
  const originalError = new Error("fallo de generación heurística");
  const { generator } = createGeneratorStub({ error: originalError });
  const generateHeuristicRoutePlan = createGenerateHeuristicRoutePlan(generator);

  let caught: unknown;

  await assert.rejects(
    generateHeuristicRoutePlan({
      clinicId: 7,
      serviceDate: new Date(),
      fieldVisitIds: [1],
    }),
    (error: unknown) => {
      caught = error;
      return error === originalError;
    },
  );

  assert.strictEqual(caught, originalError);
});

// --- Frontera de dependencias del generador heurístico (M07) ---

const APPLICATION_FILES = [
  "server/features/logistics/application/generate-heuristic-route-plan.ts",
  "server/features/logistics/application/ports/logistics-route-plan-generator.ts",
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

test("el generador heurístico de M07 no importa HTTP ni persistencia concreta", () => {
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
