import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createSlaReadUseCases,
  type LogisticsSlaReadModelsRepository,
} from "../../../../server/features/logistics/application/index.ts";

type StubSlaPolicy = {
  id: number;
  clinicId: number;
  targetType: string;
};

type StubSlaInstance = {
  id: number;
  clinicId: number;
  status: string;
};

type StubSlaSummary = {
  clinicId: number;
  total: number;
  active: number;
};

type StubListPoliciesParams = {
  clinicId: number;
  targetType?: string;
  limit?: number;
  offset?: number;
};

type StubListInstancesParams = {
  clinicId: number;
  status?: string;
  targetType?: string;
  targetId?: number;
  limit?: number;
  offset?: number;
};

type PoliciesCall = { args: unknown[]; params: StubListPoliciesParams };
type InstancesCall = { args: unknown[]; params: StubListInstancesParams };
type SummaryCall = { args: unknown[]; clinicId: number };

function createRepositoryStub(behavior: {
  policies?: StubSlaPolicy[];
  instances?: StubSlaInstance[];
  summary?: StubSlaSummary;
  error?: Error;
}) {
  const policiesCalls: PoliciesCall[] = [];
  const instancesCalls: InstancesCall[] = [];
  const summaryCalls: SummaryCall[] = [];

  const reject = <T,>(): Promise<T> => Promise.reject(behavior.error);

  const repository: LogisticsSlaReadModelsRepository<
    StubSlaPolicy,
    StubSlaInstance,
    StubSlaSummary,
    StubListPoliciesParams,
    StubListInstancesParams
  > = {
    listActiveClinicSlaPolicies: (...args: [StubListPoliciesParams]) => {
      policiesCalls.push({ args, params: args[0] });
      return behavior.error
        ? reject<StubSlaPolicy[]>()
        : Promise.resolve(behavior.policies ?? []);
    },
    listClinicSlaInstances: (...args: [StubListInstancesParams]) => {
      instancesCalls.push({ args, params: args[0] });
      return behavior.error
        ? reject<StubSlaInstance[]>()
        : Promise.resolve(behavior.instances ?? []);
    },
    getClinicSlaSummary: (...args: [number]) => {
      summaryCalls.push({ args, clinicId: args[0] });
      return behavior.error
        ? reject<StubSlaSummary>()
        : Promise.resolve(
            behavior.summary ?? { clinicId: args[0], total: 0, active: 0 },
          );
    },
  };

  return { repository, policiesCalls, instancesCalls, summaryCalls };
}

test("listActivePolicies reenvía los params una vez y devuelve la lista por identidad", async () => {
  const params: StubListPoliciesParams = {
    clinicId: 7,
    targetType: "route_plan",
    limit: 50,
    offset: 0,
  };
  const policies: StubSlaPolicy[] = [
    { id: 1, clinicId: 7, targetType: "route_plan" },
  ];
  const { repository, policiesCalls, instancesCalls, summaryCalls } =
    createRepositoryStub({ policies });
  const useCases = createSlaReadUseCases(repository);

  const received = await useCases.listActivePolicies(params);

  assert.equal(policiesCalls.length, 1);
  assert.equal(policiesCalls[0]?.args.length, 1);
  assert.strictEqual(policiesCalls[0]?.params, params);
  assert.strictEqual(received, policies);
  assert.equal(instancesCalls.length, 0);
  assert.equal(summaryCalls.length, 0);
});

test("listActivePolicies preserva array vacío y no muta los params", async () => {
  const params: StubListPoliciesParams = { clinicId: 7 };
  const snapshot = { ...params };
  const empty: StubSlaPolicy[] = [];
  const { repository, policiesCalls } = createRepositoryStub({
    policies: empty,
  });
  const useCases = createSlaReadUseCases(repository);

  const received = await useCases.listActivePolicies(params);

  assert.equal(policiesCalls.length, 1);
  assert.strictEqual(received, empty);
  assert.deepEqual(received, []);
  assert.deepEqual(params, snapshot);
});

test("listInstances reenvía los params una vez y devuelve la lista por identidad", async () => {
  const params: StubListInstancesParams = {
    clinicId: 7,
    status: "active",
    targetType: "route_plan",
    targetId: 22,
    limit: 25,
    offset: 10,
  };
  const instances: StubSlaInstance[] = [
    { id: 3, clinicId: 7, status: "active" },
  ];
  const { repository, instancesCalls, policiesCalls, summaryCalls } =
    createRepositoryStub({ instances });
  const useCases = createSlaReadUseCases(repository);

  const received = await useCases.listInstances(params);

  assert.equal(instancesCalls.length, 1);
  assert.equal(instancesCalls[0]?.args.length, 1);
  assert.strictEqual(instancesCalls[0]?.params, params);
  assert.strictEqual(received, instances);
  assert.equal(policiesCalls.length, 0);
  assert.equal(summaryCalls.length, 0);
});

test("listInstances preserva array vacío y no muta los params", async () => {
  const params: StubListInstancesParams = { clinicId: 7 };
  const snapshot = { ...params };
  const empty: StubSlaInstance[] = [];
  const { repository, instancesCalls } = createRepositoryStub({
    instances: empty,
  });
  const useCases = createSlaReadUseCases(repository);

  const received = await useCases.listInstances(params);

  assert.equal(instancesCalls.length, 1);
  assert.strictEqual(received, empty);
  assert.deepEqual(received, []);
  assert.deepEqual(params, snapshot);
});

test("getSummary reenvía el clinicId una vez y devuelve el objeto por identidad", async () => {
  const summary: StubSlaSummary = { clinicId: 7, total: 5, active: 3 };
  const { repository, summaryCalls, policiesCalls, instancesCalls } =
    createRepositoryStub({ summary });
  const useCases = createSlaReadUseCases(repository);

  const received = await useCases.getSummary(7);

  assert.equal(summaryCalls.length, 1);
  assert.deepEqual(summaryCalls[0]?.args, [7]);
  assert.strictEqual(summaryCalls[0]?.clinicId, 7);
  assert.strictEqual(received, summary);
  assert.equal(policiesCalls.length, 0);
  assert.equal(instancesCalls.length, 0);
});

test("cada lectura delega exactamente una vez sin invocar operaciones adyacentes", async () => {
  const { repository, policiesCalls, instancesCalls, summaryCalls } =
    createRepositoryStub({});
  const useCases = createSlaReadUseCases(repository);

  await useCases.listActivePolicies({ clinicId: 7 });
  assert.equal(policiesCalls.length, 1);
  assert.equal(instancesCalls.length, 0);
  assert.equal(summaryCalls.length, 0);

  await useCases.listInstances({ clinicId: 7 });
  assert.equal(policiesCalls.length, 1);
  assert.equal(instancesCalls.length, 1);
  assert.equal(summaryCalls.length, 0);

  await useCases.getSummary(7);
  assert.equal(policiesCalls.length, 1);
  assert.equal(instancesCalls.length, 1);
  assert.equal(summaryCalls.length, 1);
});

test("cada lectura propaga el error original del puerto sin envolverlo", async () => {
  const originalError = new Error("fallo de lectura SLA");
  const { repository, policiesCalls, instancesCalls, summaryCalls } =
    createRepositoryStub({ error: originalError });
  const useCases = createSlaReadUseCases(repository);

  for (const invoke of [
    () => useCases.listActivePolicies({ clinicId: 7 }),
    () => useCases.listInstances({ clinicId: 7 }),
    () => useCases.getSummary(7),
  ]) {
    let caught: unknown;

    await assert.rejects(invoke(), (error: unknown) => {
      caught = error;
      return error === originalError;
    });

    assert.strictEqual(caught, originalError);
  }

  assert.equal(policiesCalls.length, 1);
  assert.equal(instancesCalls.length, 1);
  assert.equal(summaryCalls.length, 1);
});

const APPLICATION_FILES = [
  "server/features/logistics/application/sla-read-use-cases.ts",
  "server/features/logistics/application/ports/logistics-sla-read-models-repository.ts",
] as const;

const PORT_FILE =
  "server/features/logistics/application/ports/logistics-sla-read-models-repository.ts";

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

test("los casos de uso de lectura SLA de M16 no importan HTTP ni persistencia concreta", () => {
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

test("el puerto de read models SLA de M16 no tiene imports (contrato estructural puro)", () => {
  const source = readFileSync(
    join(process.cwd(), ...PORT_FILE.split("/")),
    "utf8",
  );

  assert.deepEqual(listImportSpecifiers(source), []);
});
