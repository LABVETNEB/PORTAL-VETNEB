import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createCreateRouteEvent,
  type LogisticsRouteEventWriteRepository,
} from "../../../../server/features/logistics/application/index.ts";

type StubRouteEvent = {
  id: number;
  clinicId: number;
  routePlanId: number | null;
  routeStopId: number | null;
  eventType: string;
  payload: Record<string, unknown> | null;
};

type StubCreateInput = {
  clinicId: number;
  routePlanId?: number | null;
  routeStopId?: number | null;
  eventType: string;
  eventTime?: Date;
  payload?: Record<string, unknown> | null;
  lat?: number | null;
  lng?: number | null;
  source?: string;
};

type RepositoryResult = StubRouteEvent | null | undefined;

function createRepositoryStub(behavior: {
  result?: RepositoryResult;
  error?: Error;
}) {
  const calls: Array<{ args: unknown[]; input: StubCreateInput }> = [];

  const repository: LogisticsRouteEventWriteRepository<
    StubRouteEvent,
    StubCreateInput
  > = {
    createRouteEvent: (...args: [StubCreateInput]) => {
      calls.push({ args, input: args[0] });
      return behavior.error
        ? Promise.reject(behavior.error)
        : Promise.resolve(behavior.result);
    },
  };

  return { repository, calls };
}

function buildInput(overrides: Partial<StubCreateInput> = {}): StubCreateInput {
  return {
    clinicId: 7,
    routePlanId: 11,
    routeStopId: 22,
    eventType: "stop_arrived",
    eventTime: new Date("2026-07-20T10:00:00.000Z"),
    payload: { note: "llegada" },
    lat: -34.6,
    lng: -58.4,
    source: "manual",
    ...overrides,
  };
}

test("createRouteEvent delega exactamente una vez con el mismo input y devuelve por identidad", async () => {
  const input = buildInput();
  const result: StubRouteEvent = {
    id: 501,
    clinicId: 7,
    routePlanId: 11,
    routeStopId: 22,
    eventType: "stop_arrived",
    payload: { note: "llegada" },
  };
  const { repository, calls } = createRepositoryStub({ result });
  const createRouteEvent = createCreateRouteEvent(repository);

  const received = await createRouteEvent(input);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.args.length, 1);
  assert.strictEqual(calls[0]?.input, input);
  assert.strictEqual(received, result);
});

test("createRouteEvent no muta el input ni aplica defaults", async () => {
  const input = buildInput({
    routePlanId: null,
    routeStopId: null,
    payload: null,
    lat: null,
    lng: null,
  });
  const snapshot = { ...input };
  const { repository, calls } = createRepositoryStub({ result: undefined });
  const createRouteEvent = createCreateRouteEvent(repository);

  await createRouteEvent(input);

  assert.equal(calls.length, 1);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(calls[0]?.input, snapshot);
  assert.equal(calls[0]?.input.source, "manual");
});

test("createRouteEvent preserva un input mínimo sin campos opcionales", async () => {
  const input: StubCreateInput = { clinicId: 7, eventType: "note" };
  const { repository, calls } = createRepositoryStub({ result: undefined });
  const createRouteEvent = createCreateRouteEvent(repository);

  await createRouteEvent(input);

  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0]?.input ?? {}), [
    "clinicId",
    "eventType",
  ]);
  assert.equal("source" in (calls[0]?.input ?? {}), false);
});

test("createRouteEvent preserva null", async () => {
  const { repository, calls } = createRepositoryStub({ result: null });
  const createRouteEvent = createCreateRouteEvent(repository);

  const received = await createRouteEvent(buildInput());

  assert.equal(calls.length, 1);
  assert.strictEqual(received, null);
});

test("createRouteEvent preserva undefined", async () => {
  const { repository, calls } = createRepositoryStub({ result: undefined });
  const createRouteEvent = createCreateRouteEvent(repository);

  const received = await createRouteEvent(buildInput());

  assert.equal(calls.length, 1);
  assert.strictEqual(received, undefined);
});

test("createRouteEvent propaga el error original del puerto sin envolverlo", async () => {
  const originalError = new Error("fallo de append");
  const { repository, calls } = createRepositoryStub({ error: originalError });
  const createRouteEvent = createCreateRouteEvent(repository);
  let caught: unknown;

  await assert.rejects(createRouteEvent(buildInput()), (error: unknown) => {
    caught = error;
    return error === originalError;
  });

  assert.equal(calls.length, 1);
  assert.strictEqual(caught, originalError);
});

test("createRouteEvent no invoca ninguna otra operación adyacente del puerto", async () => {
  const observed: string[] = [];
  const repository: LogisticsRouteEventWriteRepository<
    StubRouteEvent,
    StubCreateInput
  > & {
    listClinicRouteEvents: () => Promise<StubRouteEvent[]>;
    listIncrementalClinicRouteEvents: () => Promise<StubRouteEvent[]>;
  } = {
    createRouteEvent: async (input) => {
      observed.push("createRouteEvent");
      return { ...input, id: 1 } as unknown as StubRouteEvent;
    },
    listClinicRouteEvents: async () => {
      observed.push("listClinicRouteEvents");
      return [];
    },
    listIncrementalClinicRouteEvents: async () => {
      observed.push("listIncrementalClinicRouteEvents");
      return [];
    },
  };

  const createRouteEvent = createCreateRouteEvent(repository);
  await createRouteEvent(buildInput());

  assert.deepEqual(observed, ["createRouteEvent"]);
});

const APPLICATION_FILES = [
  "server/features/logistics/application/create-route-event.ts",
  "server/features/logistics/application/ports/logistics-route-event-write-repository.ts",
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

test("el caso de uso create route event de M10 no importa HTTP ni persistencia concreta", () => {
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
