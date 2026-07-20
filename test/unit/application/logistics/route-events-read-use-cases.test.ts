import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createRouteEventsReadUseCases,
  type LogisticsRouteEventsReadRepository,
} from "../../../../server/features/logistics/application/index.ts";

type StubRouteEvent = {
  id: number;
  clinicId: number;
  routePlanId: number | null;
  eventType: string;
};

type StubListParams = {
  clinicId: number;
  routePlanId?: number;
  routeStopId?: number;
  eventType?: string;
  afterId?: number;
  limit?: number;
  offset?: number;
};

type StubRoutePlanListParams = Omit<StubListParams, "clinicId" | "routePlanId">;

type ListCall = { args: unknown[]; params: StubListParams };
type RoutePlanCall = {
  args: unknown[];
  routePlanId: number;
  clinicId: number;
  params?: StubRoutePlanListParams;
};
type PollCall = {
  args: unknown[];
  clinicId: number;
  afterId: number;
  limit?: number;
};

function createRepositoryStub(behavior: {
  list?: StubRouteEvent[];
  routePlan?: StubRouteEvent[];
  poll?: StubRouteEvent[];
  error?: Error;
}) {
  const listCalls: ListCall[] = [];
  const routePlanCalls: RoutePlanCall[] = [];
  const pollCalls: PollCall[] = [];

  const reject = <T,>(): Promise<T> => Promise.reject(behavior.error);

  const repository: LogisticsRouteEventsReadRepository<
    StubRouteEvent,
    StubListParams,
    StubRoutePlanListParams
  > = {
    listClinicRouteEvents: (...args: [StubListParams]) => {
      listCalls.push({ args, params: args[0] });
      return behavior.error
        ? reject<StubRouteEvent[]>()
        : Promise.resolve(behavior.list ?? []);
    },
    listRouteEventsForClinicRoutePlan: (
      ...args: [number, number, (StubRoutePlanListParams | undefined)?]
    ) => {
      routePlanCalls.push({
        args,
        routePlanId: args[0],
        clinicId: args[1],
        params: args[2],
      });
      return behavior.error
        ? reject<StubRouteEvent[]>()
        : Promise.resolve(behavior.routePlan ?? []);
    },
    listIncrementalClinicRouteEvents: (
      ...args: [number, number, (number | undefined)?]
    ) => {
      pollCalls.push({
        args,
        clinicId: args[0],
        afterId: args[1],
        limit: args[2],
      });
      return behavior.error
        ? reject<StubRouteEvent[]>()
        : Promise.resolve(behavior.poll ?? []);
    },
  };

  return { repository, listCalls, routePlanCalls, pollCalls };
}

test("listRouteEvents reenvía los params una vez y devuelve la lista por identidad", async () => {
  const params: StubListParams = {
    clinicId: 7,
    routePlanId: 11,
    routeStopId: 22,
    eventType: "stop_arrived",
    afterId: 0,
    limit: 50,
    offset: 0,
  };
  const list: StubRouteEvent[] = [
    { id: 1, clinicId: 7, routePlanId: 11, eventType: "stop_arrived" },
  ];
  const { repository, listCalls, routePlanCalls, pollCalls } =
    createRepositoryStub({ list });
  const useCases = createRouteEventsReadUseCases(repository);

  const received = await useCases.listRouteEvents(params);

  assert.equal(listCalls.length, 1);
  assert.equal(listCalls[0]?.args.length, 1);
  assert.strictEqual(listCalls[0]?.params, params);
  assert.strictEqual(received, list);
  assert.equal(routePlanCalls.length, 0);
  assert.equal(pollCalls.length, 0);
});

test("listRouteEvents preserva array vacío y no muta los params", async () => {
  const params: StubListParams = { clinicId: 7 };
  const snapshot = { ...params };
  const empty: StubRouteEvent[] = [];
  const { repository, listCalls } = createRepositoryStub({ list: empty });
  const useCases = createRouteEventsReadUseCases(repository);

  const received = await useCases.listRouteEvents(params);

  assert.equal(listCalls.length, 1);
  assert.strictEqual(received, empty);
  assert.deepEqual(received, []);
  assert.deepEqual(params, snapshot);
});

test("listRoutePlanEvents reenvía routePlanId, clinicId y params en orden", async () => {
  const params: StubRoutePlanListParams = {
    routeStopId: 22,
    eventType: "stop_arrived",
    afterId: 5,
    limit: 25,
    offset: 10,
  };
  const routePlan: StubRouteEvent[] = [
    { id: 3, clinicId: 7, routePlanId: 11, eventType: "stop_arrived" },
  ];
  const { repository, routePlanCalls, listCalls, pollCalls } =
    createRepositoryStub({ routePlan });
  const useCases = createRouteEventsReadUseCases(repository);

  const received = await useCases.listRoutePlanEvents(11, 7, params);

  assert.equal(routePlanCalls.length, 1);
  assert.deepEqual(routePlanCalls[0]?.args, [11, 7, params]);
  assert.strictEqual(routePlanCalls[0]?.params, params);
  assert.strictEqual(received, routePlan);
  assert.equal(listCalls.length, 0);
  assert.equal(pollCalls.length, 0);
});

test("listRoutePlanEvents preserva params undefined sin sustituirlo por un default", async () => {
  const { repository, routePlanCalls } = createRepositoryStub({});
  const useCases = createRouteEventsReadUseCases(repository);

  const received = await useCases.listRoutePlanEvents(11, 7);

  assert.equal(routePlanCalls.length, 1);
  assert.strictEqual(routePlanCalls[0]?.params, undefined);
  assert.deepEqual(routePlanCalls[0]?.args, [11, 7, undefined]);
  assert.deepEqual(received, []);
});

test("listRoutePlanEvents devuelve lista vacía para un plan sin eventos", async () => {
  const empty: StubRouteEvent[] = [];
  const { repository, routePlanCalls } = createRepositoryStub({
    routePlan: empty,
  });
  const useCases = createRouteEventsReadUseCases(repository);

  const received = await useCases.listRoutePlanEvents(9999, 7, {});

  assert.equal(routePlanCalls.length, 1);
  assert.equal(routePlanCalls[0]?.routePlanId, 9999);
  assert.equal(routePlanCalls[0]?.clinicId, 7);
  assert.strictEqual(received, empty);
});

test("pollRouteEvents reenvía clinicId, afterId y limit en orden", async () => {
  const poll: StubRouteEvent[] = [
    { id: 12, clinicId: 7, routePlanId: null, eventType: "note" },
  ];
  const { repository, pollCalls, listCalls, routePlanCalls } =
    createRepositoryStub({ poll });
  const useCases = createRouteEventsReadUseCases(repository);

  const received = await useCases.pollRouteEvents(7, 11, 50);

  assert.equal(pollCalls.length, 1);
  assert.deepEqual(pollCalls[0]?.args, [7, 11, 50]);
  assert.strictEqual(received, poll);
  assert.equal(listCalls.length, 0);
  assert.equal(routePlanCalls.length, 0);
});

test("pollRouteEvents preserva limit undefined y afterId 0 sin aplicar defaults", async () => {
  const { repository, pollCalls } = createRepositoryStub({});
  const useCases = createRouteEventsReadUseCases(repository);

  const received = await useCases.pollRouteEvents(7, 0);

  assert.equal(pollCalls.length, 1);
  assert.deepEqual(pollCalls[0]?.args, [7, 0, undefined]);
  assert.strictEqual(pollCalls[0]?.afterId, 0);
  assert.strictEqual(pollCalls[0]?.limit, undefined);
  assert.deepEqual(received, []);
});

test("cada lectura propaga el error original del puerto sin envolverlo", async () => {
  const originalError = new Error("fallo de lectura");
  const { repository, listCalls, routePlanCalls, pollCalls } =
    createRepositoryStub({ error: originalError });
  const useCases = createRouteEventsReadUseCases(repository);

  for (const invoke of [
    () => useCases.listRouteEvents({ clinicId: 7 }),
    () => useCases.listRoutePlanEvents(11, 7, {}),
    () => useCases.pollRouteEvents(7, 0, 50),
  ]) {
    let caught: unknown;

    await assert.rejects(invoke(), (error: unknown) => {
      caught = error;
      return error === originalError;
    });

    assert.strictEqual(caught, originalError);
  }

  assert.equal(listCalls.length, 1);
  assert.equal(routePlanCalls.length, 1);
  assert.equal(pollCalls.length, 1);
});

const APPLICATION_FILES = [
  "server/features/logistics/application/route-events-read-use-cases.ts",
  "server/features/logistics/application/ports/logistics-route-events-read-repository.ts",
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

test("los casos de uso de lectura de route events de M10 no importan HTTP ni persistencia concreta", () => {
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
