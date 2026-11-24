import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

import {
  STORAGE_ORPHAN_DEFAULT_MIN_AGE_MS,
  parseReportObjectKey,
  resolveStorageOrphanMinAgeMs,
  buildFailedStorageOrphanInventory,
  runStorageOrphanInventory,
  type StorageListPage,
  type StorageObjectListingPort,
  type StorageOrphanInventoryDependencies,
  type StorageReferenceLookup,
} from "../../../server/storage-orphan-inventory.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.CORS_ORIGIN ??=
  "https://portal-vetneb-frontend-staging.onrender.com";

const { createStorageObjectListing, StorageListingError } = await import(
  "../../../server/lib/supabase.ts"
);
const { ENV } = await import("../../../server/lib/env.ts");
const { adminSystemMaintenanceNativeRoutes } = await import(
  "../../../server/routes/admin-system-maintenance.fastify.ts"
);

const NOW_MS = Date.parse("2026-11-24T12:00:00.000Z");
const OLD = "2026-11-20T00:00:00.000Z";
const RECENT = "2026-11-24T10:00:00.000Z";

function objectKey(clinicId: number, serial: number, name?: string) {
  const ts = String(1700000000000 + serial);
  const random = serial.toString(16).padStart(12, "0");
  return `clinics/${clinicId}/${ts}-${random}-${name ?? "informe-sensible.pdf"}`;
}

function scripted(pages: Array<StorageListPage | Error>) {
  const calls: Array<{ prefix: string; cursor: string | null; limit: number }> = [];
  const listing: StorageObjectListingPort = {
    async listPage(input) {
      calls.push(input);
      const next = pages[calls.length - 1];
      if (next === undefined) {
        throw new Error("pagina inesperada");
      }
      if (next instanceof Error) {
        throw next;
      }
      return next;
    },
  };
  return { listing, calls };
}

function referencing(paths: string[] = []): StorageReferenceLookup {
  const set = new Set(paths);
  return async (batch) => new Set(batch.filter((path) => set.has(path)));
}

function build(
  pages: Array<StorageListPage | Error>,
  overrides: Partial<StorageOrphanInventoryDependencies> = {},
) {
  const { listing, calls } = scripted(pages);
  const run = () =>
    runStorageOrphanInventory({
      listing,
      lookupReferencedPaths: referencing(),
      now: () => NOW_MS,
      ...overrides,
    });
  return { run, calls };
}

test("SEC-09D: recorre todas las paginas por cursor desde clinics/ e incluye clinicas ya borradas de PostgreSQL", async () => {
  const deletedClinicObject = objectKey(999, 3);
  const { listing, calls } = scripted([
    { objects: [{ key: objectKey(1, 1), createdAt: OLD }], nextCursor: "c1" },
    { objects: [{ key: objectKey(2, 2), createdAt: OLD }], nextCursor: "c2" },
    { objects: [{ key: deletedClinicObject, createdAt: OLD }], nextCursor: null },
  ]);
  const lookedUp: string[] = [];
  const result = await runStorageOrphanInventory({
    listing,
    lookupReferencedPaths: async (batch) => {
      lookedUp.push(...batch);
      return new Set([objectKey(1, 1)]);
    },
    now: () => NOW_MS,
  });

  assert.equal(result.status, "complete");
  assert.equal(result.complete, true);
  assert.equal(result.inspected.pages, 3);
  assert.equal(result.inspected.uniqueObjects, 3);
  assert.equal(result.observed.referenced, 1);
  assert.equal(result.observed.orphanCandidates, 2);
  assert.equal(lookedUp.includes(deletedClinicObject), true);
  assert.deepEqual(
    calls.map((call) => [call.prefix, call.cursor]),
    [
      ["clinics/", null],
      ["clinics/", "c1"],
      ["clinics/", "c2"],
    ],
  );
});

test("SEC-09D: un cursor repetido falla cerrado como listado incompleto", async () => {
  const { run } = build([
    { objects: [{ key: objectKey(1, 1), createdAt: OLD }], nextCursor: "c1" },
    { objects: [{ key: objectKey(1, 2), createdAt: OLD }], nextCursor: "c1" },
  ]);
  const result = await run();

  assert.equal(result.status, "failed");
  assert.equal(result.failureReason, "incomplete_listing");
  assert.equal(result.complete, false);
});

test("SEC-09D: un fallo en una pagina intermedia es un error explicito, nunca un conteo limpio", async () => {
  const { run } = build([
    { objects: [{ key: objectKey(1, 1), createdAt: OLD }], nextCursor: "c1" },
    new Error("Paciente Maria Gomez tutor@example.com"),
  ]);
  const result = await run();
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "failed");
  assert.equal(result.failureReason, "listing_failed");
  assert.equal(result.failureErrorName, "Error");
  assert.equal(result.complete, false);
  assert.equal(serialized.includes("Maria"), false);
  assert.equal(serialized.includes("tutor@example.com"), false);
  assert.equal(result.observed.orphanCandidates, 0);
});

test("SEC-09D: una respuesta con forma invalida falla cerrado", async () => {
  const invalidObjects = build([
    { objects: "no-array", nextCursor: null } as unknown as StorageListPage,
  ]);
  const emptyCursor = build([{ objects: [], nextCursor: "" }]);

  assert.equal((await invalidObjects.run()).failureReason, "invalid_page");
  assert.equal((await emptyCursor.run()).failureReason, "invalid_page");
});

test("SEC-09D: los limites de paginas, objetos y duracion producen un resultado truncado, no total", async () => {
  const manyPages = build(
    [
      { objects: [{ key: objectKey(1, 1), createdAt: OLD }], nextCursor: "c1" },
      { objects: [{ key: objectKey(1, 2), createdAt: OLD }], nextCursor: "c2" },
    ],
    { limits: { maxPages: 1 } },
  );
  const manyObjects = build(
    [
      {
        objects: [
          { key: objectKey(1, 1), createdAt: OLD },
          { key: objectKey(1, 2), createdAt: OLD },
        ],
        nextCursor: null,
      },
    ],
    { limits: { maxObjects: 1 } },
  );
  let tick = 0;
  const slow = build(
    [
      { objects: [{ key: objectKey(1, 1), createdAt: OLD }], nextCursor: "c1" },
      { objects: [{ key: objectKey(1, 2), createdAt: OLD }], nextCursor: null },
    ],
    {
      limits: { maxDurationMs: 10 },
      now: () => {
        tick += 1;
        return NOW_MS + (tick > 3 ? 1000 : 0);
      },
    },
  );

  const pagesResult = await manyPages.run();
  const objectsResult = await manyObjects.run();
  const slowResult = await slow.run();

  assert.equal(pagesResult.status, "truncated");
  assert.equal(pagesResult.truncationReason, "max_pages");
  assert.equal(pagesResult.complete, false);
  assert.equal(objectsResult.status, "truncated");
  assert.equal(objectsResult.truncationReason, "max_objects");
  assert.equal(objectsResult.inspected.uniqueObjects, 1);
  assert.equal(slowResult.status, "truncated");
  assert.equal(slowResult.truncationReason, "deadline");
  assert.equal(slowResult.complete, false);
});

test("SEC-09D: el presupuesto de duracion tambien rige la reverificacion de candidatos", async () => {
  let clock = NOW_MS;
  let lookups = 0;
  const { listing } = scripted([
    {
      objects: [
        { key: objectKey(1, 1), createdAt: OLD },
        { key: objectKey(1, 2), createdAt: OLD },
        { key: objectKey(1, 3), createdAt: OLD },
      ],
      nextCursor: null,
    },
  ]);
  const result = await runStorageOrphanInventory({
    listing,
    now: () => clock,
    limits: { referenceBatchSize: 1, maxDurationMs: 30 },
    lookupReferencedPaths: async () => {
      lookups += 1;
      clock += 9;
      return new Set();
    },
  });

  assert.equal(result.status, "truncated");
  assert.equal(result.truncationReason, "deadline");
  assert.equal(result.complete, false);
  assert.equal(lookups < 6, true, "no se ejecutan todos los lotes de la segunda pasada");
  assert.equal(result.observed.unverified > 0, true);
  assert.equal(
    result.observed.orphanCandidates + result.observed.unverified,
    3,
    "cada elegible es candidato verificado o no verificado, nunca ambos",
  );
});

test("SEC-09D: exactamente maxObjects objetos sin mas paginas es un inventario completo", async () => {
  const { run } = build(
    [{ objects: [{ key: objectKey(1, 1), createdAt: OLD }], nextCursor: null }],
    { limits: { maxObjects: 1 } },
  );

  assert.equal((await run()).status, "complete");
});

test("SEC-09D: un objeto referenciado nunca es candidato", async () => {
  const referenced = objectKey(1, 1);
  const { run } = build(
    [{ objects: [{ key: referenced, createdAt: OLD }], nextCursor: null }],
    { lookupReferencedPaths: referencing([referenced]) },
  );
  const result = await run();

  assert.equal(result.observed.referenced, 1);
  assert.equal(result.observed.referencedDuringInventory, 0);
  assert.equal(result.observed.orphanCandidates, 0);
  assert.deepEqual(result.candidates, []);
});

test("SEC-09D: objetos recientes y de antiguedad desconocida o invalida nunca son candidatos", async () => {
  const { run } = build([
    {
      objects: [
        { key: objectKey(1, 1), createdAt: RECENT },
        { key: objectKey(1, 2), createdAt: null },
        { key: objectKey(1, 3), createdAt: undefined },
        { key: objectKey(1, 4), createdAt: "no-es-una-fecha" },
        { key: objectKey(1, 5), createdAt: "2027-01-01T00:00:00.000Z" },
        { key: objectKey(1, 6), createdAt: "" },
      ],
      nextCursor: null,
    },
  ]);
  const result = await run();

  assert.equal(result.observed.tooRecent, 1);
  assert.equal(result.observed.unknownAge, 5);
  assert.equal(result.observed.orphanCandidates, 0);
});

test("SEC-09D: avatares, paths legados y formas fuera del patron exacto nunca son candidatos", async () => {
  const outsidePattern = [
    "clinic-avatars/12/1700000000000-abcdef012345-avatar.png",
    "reports/12/1700000000000-abcdef012345-legado.pdf",
    "clinics/12/sub/1700000000000-abcdef012345-anidado.pdf",
    "clinics/12/.emptyFolderPlaceholder",
    "clinics/0/1700000000000-abcdef012345-cero.pdf",
    "clinics/abc/1700000000000-abcdef012345-x.pdf",
    "clinics/12/1700000000000-ABCDEF012345-mayusculas.pdf",
    "clinics/12/1700000000000-abcdef012345-",
    "clinics/12",
  ];
  const { run } = build([
    {
      objects: outsidePattern.map((path) => ({ key: path, createdAt: OLD })),
      nextCursor: null,
    },
  ]);
  const result = await run();

  assert.equal(result.observed.unrecognized, outsidePattern.length);
  assert.equal(result.observed.orphanCandidates, 0);
  assert.equal(parseReportObjectKey(objectKey(12, 1))?.clinicId, 12);
  assert.equal(parseReportObjectKey(undefined), null);
});

test("SEC-09D: una referencia que aparece durante el inventario retira al objeto de los candidatos", async () => {
  const racing = objectKey(1, 1);
  const stable = objectKey(1, 2);
  let calls = 0;
  const { listing } = scripted([
    {
      objects: [
        { key: racing, createdAt: OLD },
        { key: stable, createdAt: OLD },
      ],
      nextCursor: null,
    },
  ]);
  const result = await runStorageOrphanInventory({
    listing,
    now: () => NOW_MS,
    lookupReferencedPaths: async (batch) => {
      calls += 1;
      return new Set(calls === 1 ? [] : batch.filter((path) => path === racing));
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.observed.referencedDuringInventory, 1);
  assert.equal(result.observed.referenced, 1);
  assert.equal(result.observed.orphanCandidates, 1);
});

test("SEC-09D: un fallo al comprobar referencias falla cerrado", async () => {
  const { run } = build(
    [{ objects: [{ key: objectKey(1, 1), createdAt: OLD }], nextCursor: null }],
    {
      lookupReferencedPaths: async () => {
        throw new Error("select storage_path from reports");
      },
    },
  );
  const result = await run();

  assert.equal(result.status, "failed");
  assert.equal(result.failureReason, "reference_check_failed");
  assert.equal(JSON.stringify(result).includes("select"), false);
});

test("SEC-09D: las entradas duplicadas entre paginas se deduplican por clave", async () => {
  const repeated = objectKey(1, 1);
  const { run } = build([
    { objects: [{ key: repeated, createdAt: OLD }], nextCursor: "c1" },
    {
      objects: [
        { key: repeated, createdAt: OLD },
        { key: objectKey(1, 2), createdAt: OLD },
      ],
      nextCursor: null,
    },
  ]);
  const result = await run();

  assert.equal(result.inspected.uniqueObjects, 2);
  assert.equal(result.inspected.duplicateEntries, 1);
  assert.equal(result.observed.orphanCandidates, 2);
});

test("SEC-09D: no hay llamadas remotas ni consultas superpuestas (sin conexion retenida durante Storage)", async () => {
  let listingActive = 0;
  let lookupActive = 0;
  let overlaps = 0;
  const pages: StorageListPage[] = [
    { objects: [{ key: objectKey(1, 1), createdAt: OLD }], nextCursor: "c1" },
    { objects: [{ key: objectKey(1, 2), createdAt: OLD }], nextCursor: null },
  ];
  let index = 0;
  const result = await runStorageOrphanInventory({
    now: () => NOW_MS,
    limits: { referenceBatchSize: 1 },
    listing: {
      async listPage() {
        overlaps += lookupActive;
        listingActive += 1;
        await new Promise((resolve) => setImmediate(resolve));
        listingActive -= 1;
        const page = pages[index];
        index += 1;
        return page;
      },
    },
    lookupReferencedPaths: async () => {
      overlaps += listingActive + lookupActive;
      lookupActive += 1;
      await new Promise((resolve) => setImmediate(resolve));
      lookupActive -= 1;
      return new Set();
    },
  });

  assert.equal(result.status, "complete");
  assert.equal(overlaps, 0);
  assert.equal(listingActive + lookupActive, 0);
});

test("SEC-09D: el resultado no expone paths, nombres de archivo ni datos clinicos", async () => {
  const sensitive = objectKey(7, 1, "Maria_Gomez_biopsia.pdf");
  const { run } = build([
    { objects: [{ key: sensitive, createdAt: OLD }], nextCursor: null },
  ]);
  const result = await run();
  const serialized = JSON.stringify(result);

  assert.equal(result.observed.orphanCandidates, 1);
  assert.equal(serialized.includes("Maria"), false);
  assert.equal(serialized.includes("biopsia"), false);
  assert.equal(serialized.includes("clinics/7"), false);
  assert.equal(serialized.includes(sensitive), false);
  assert.deepEqual(Object.keys(result.candidates[0]).sort(), ["objectRef", "pathDigest"]);
  assert.match(result.candidates[0].pathDigest, /^[0-9a-f]{64}$/);
  assert.match(result.candidates[0].objectRef, /^\d{10,}-[0-9a-f]{12}$/);
});

test("SEC-09D: los candidatos no se etiquetan como seguros para eliminar y la muestra se acota", async () => {
  const objects = Array.from({ length: 150 }, (_, index) => ({
    key: objectKey(3, index + 1),
    createdAt: OLD,
  }));
  const { run } = build([{ objects, nextCursor: null }]);
  const result = await run();

  assert.equal(result.dryRun, true);
  assert.equal(result.deletionSafety, "not_assessed");
  assert.equal(result.observed.orphanCandidates, 150);
  assert.equal(result.candidates.length, 100);
  assert.equal(result.candidatesSampleTruncated, true);
});

test("SEC-09D: el umbral de antiguedad solo se configura hacia arriba", async () => {
  const twentyFiveHoursAgo = new Date(NOW_MS - 25 * 60 * 60 * 1000).toISOString();
  const objects = [{ key: objectKey(1, 1), createdAt: twentyFiveHoursAgo }];
  const strict = build([{ objects, nextCursor: null }], {
    minAgeMs: 48 * 60 * 60 * 1000,
  });
  const lowered = build([{ objects, nextCursor: null }], { minAgeMs: 1 });

  assert.equal(resolveStorageOrphanMinAgeMs(1), STORAGE_ORPHAN_DEFAULT_MIN_AGE_MS);
  assert.equal(resolveStorageOrphanMinAgeMs(Number.NaN), STORAGE_ORPHAN_DEFAULT_MIN_AGE_MS);
  assert.equal(resolveStorageOrphanMinAgeMs(undefined), STORAGE_ORPHAN_DEFAULT_MIN_AGE_MS);
  assert.equal(resolveStorageOrphanMinAgeMs(72 * 60 * 60 * 1000), 72 * 60 * 60 * 1000);
  assert.equal((await strict.run()).observed.tooRecent, 1);
  assert.equal((await lowered.run()).observed.orphanCandidates, 1);
});

type ListV2Call = Record<string, unknown>;
type ListV2Response = { data: unknown; error: unknown };

function fakeStorage(responses: ListV2Response[]) {
  const calls: ListV2Call[] = [];
  const bucketIds: string[] = [];
  const storage = {
    from(bucketId: string) {
      bucketIds.push(bucketId);
      return {
        async listV2(options: ListV2Call) {
          calls.push(options);
          return responses[calls.length - 1];
        },
      };
    },
  };
  return { storage: storage as never, calls, bucketIds };
}

const PAGE = {
  hasNext: false,
  folders: [],
  objects: [
    {
      name: "x",
      key: "clinics/1/1700000000001-000000000001-a.pdf",
      id: "1",
      created_at: "2026-11-20T00:00:00.000Z",
      updated_at: "2026-11-20T00:00:00.000Z",
      metadata: null,
      last_accessed_at: "2026-11-20T00:00:00.000Z",
    },
  ],
};

test("SEC-09D adaptador: lista plano por prefijo con cursor y devuelve solo clave y fecha de creacion", async () => {
  const { storage, calls, bucketIds } = fakeStorage([
    { data: { ...PAGE, hasNext: true, nextCursor: "cur-2" }, error: null },
    { data: PAGE, error: null },
  ]);
  const listing = createStorageObjectListing(storage, "reports-test");

  const first = await listing.listPage({ prefix: "clinics/", cursor: null, limit: 500 });
  const second = await listing.listPage({ prefix: "clinics/", cursor: "cur-2", limit: 500 });

  assert.deepEqual(first, {
    objects: [
      { key: "clinics/1/1700000000001-000000000001-a.pdf", createdAt: "2026-11-20T00:00:00.000Z" },
    ],
    nextCursor: "cur-2",
  });
  assert.equal(second.nextCursor, null);
  assert.deepEqual(bucketIds, ["reports-test", "reports-test"]);
  assert.equal(calls[0].prefix, "clinics/");
  assert.equal(calls[0].with_delimiter, false);
  assert.equal("cursor" in calls[0], false);
  assert.equal(calls[1].cursor, "cur-2");
  assert.equal(calls[0].deleteMarkers, "exclude");
  assert.equal(calls[0].noncurrentVersions, "exclude");
});

test("SEC-09D adaptador: falla cerrado ante error, forma invalida, cursor ausente o entrada sin clave", async () => {
  const cases: Array<[string, ListV2Response]> = [
    ["error del proveedor", { data: null, error: new Error("Paciente Maria Gomez") }],
    ["sin datos", { data: null, error: null }],
    ["objects no es lista", { data: { hasNext: false, objects: "x" }, error: null }],
    ["hasNext no booleano", { data: { objects: [] }, error: null }],
    ["hasNext sin cursor", { data: { ...PAGE, hasNext: true }, error: null }],
    ["cursor vacio", { data: { ...PAGE, hasNext: true, nextCursor: "" }, error: null }],
    [
      "entrada sin clave",
      { data: { ...PAGE, objects: [{ name: "a", id: "1" }] }, error: null },
    ],
    [
      "clave fuera del prefijo",
      { data: { ...PAGE, objects: [{ name: "a", key: "reports/1/a.pdf" }] }, error: null },
    ],
  ];

  for (const [label, response] of cases) {
    const { storage } = fakeStorage([response]);
    const listing = createStorageObjectListing(storage, "b");

    await assert.rejects(
      listing.listPage({ prefix: "clinics/", cursor: null, limit: 10 }),
      (error: unknown) =>
        error instanceof StorageListingError && !/Maria/.test(error.message),
      label,
    );
  }
});

test("SEC-09D adaptador: omite marcadores de borrado y la fecha no textual queda como desconocida", async () => {
  const { storage } = fakeStorage([
    {
      data: {
        hasNext: false,
        folders: [],
        objects: [
          { name: "d", key: "clinics/1/1700000000002-000000000002-d.pdf", is_delete_marker: true },
          { name: "n", key: "clinics/1/1700000000003-000000000003-n.pdf", created_at: 123 },
        ],
      },
      error: null,
    },
  ]);
  const page = await createStorageObjectListing(storage, "b").listPage({
    prefix: "clinics/",
    cursor: null,
    limit: 10,
  });

  assert.deepEqual(page.objects, [
    { key: "clinics/1/1700000000003-000000000003-n.pdf", createdAt: null },
  ]);
});

test("SEC-09D adaptador: solo expone lectura (listPage) y su fuente no usa operaciones de escritura", () => {
  const { storage } = fakeStorage([]);
  const listing = createStorageObjectListing(storage, "b");

  assert.deepEqual(Object.keys(listing), ["listPage"]);
});

const ORIGIN = "https://portal-vetneb-frontend-staging.onrender.com";
const SNAPSHOT = {
  dryRun: true as const,
  generatedAt: "2026-05-07T00:00:00.000Z",
  candidates: [],
  totals: { candidateRecords: 0, supportedCandidateRecords: 0, unsupportedGroups: 0 },
};

async function buildApp(overrides: {
  inventory?: () => Promise<ReturnType<typeof buildFailedStorageOrphanInventory>>;
  authenticated?: boolean;
}) {
  const app = Fastify();
  let snapshotCalls = 0;

  await app.register(adminSystemMaintenanceNativeRoutes, {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () =>
      overrides.authenticated === false
        ? null
        : {
            adminUserId: 1,
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            lastAccess: new Date("2026-05-06T23:35:00.000Z"),
          },
    getAdminUserById: async () => ({ id: 1, username: "VETNEB" }),
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    now: () => Date.UTC(2026, 4, 7, 0, 0, 0),
    getMaintenancePurgeDryRunSnapshot: async () => {
      snapshotCalls += 1;
      return SNAPSHOT;
    },
    ...(overrides.inventory ? { getStorageOrphanInventory: overrides.inventory } : {}),
  });

  return { app, snapshotCalls: () => snapshotCalls };
}

const authHeaders = {
  cookie: `${ENV.adminCookieName}=admin-session-token`,
  origin: ORIGIN,
};

test("SEC-09D ruta: sin solicitud explicita no se ejecuta ningun inventario remoto y la respuesta no cambia", async () => {
  let inventoryCalls = 0;
  const { app } = await buildApp({
    inventory: async () => {
      inventoryCalls += 1;
      return buildFailedStorageOrphanInventory(new Date(), "listing_failed");
    },
  });

  try {
    for (const payload of [undefined, {}, { includeStorageOrphans: false }, { includeStorageOrphans: "true" }]) {
      const response = await app.inject({
        method: "POST",
        url: "/purge-dry-run",
        headers: authHeaders,
        ...(payload === undefined ? {} : { payload }),
      });
      const body = JSON.parse(response.body);

      assert.equal(response.statusCode, 200);
      assert.equal("storageOrphanInventory" in body, false);
      assert.deepEqual(body.totals, SNAPSHOT.totals);
    }
    assert.equal(inventoryCalls, 0);
  } finally {
    await app.close();
  }
});

test("SEC-09D ruta: includeStorageOrphans=true ejecuta el inventario una vez y lo informa separado de los totales", async () => {
  let inventoryCalls = 0;
  const { app, snapshotCalls } = await buildApp({
    inventory: async () => {
      inventoryCalls += 1;
      return buildFailedStorageOrphanInventory(new Date("2026-05-07T00:00:00.000Z"), "listing_failed", "StorageListingError");
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/purge-dry-run",
      headers: authHeaders,
      payload: { includeStorageOrphans: true },
    });
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(inventoryCalls, 1);
    assert.equal(snapshotCalls(), 1);
    assert.equal(body.storageOrphanInventory.status, "failed");
    assert.equal(body.storageOrphanInventory.complete, false);
    assert.equal(body.storageOrphanInventory.deletionSafety, "not_assessed");
    assert.deepEqual(body.totals, SNAPSHOT.totals);
    assert.deepEqual(body.candidates, []);
  } finally {
    await app.close();
  }
});

test("SEC-09D ruta: un inventario que lanza se informa como failed y no rompe el mantenimiento existente", async () => {
  const { app } = await buildApp({
    inventory: async () => {
      throw new Error("Paciente Maria Gomez");
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/purge-dry-run",
      headers: authHeaders,
      payload: { includeStorageOrphans: true },
    });
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(body.storageOrphanInventory.status, "failed");
    assert.equal(body.storageOrphanInventory.failureReason, "inventory_unavailable");
    assert.equal(response.body.includes("Maria"), false);
    assert.deepEqual(body.totals, SNAPSHOT.totals);
  } finally {
    await app.close();
  }
});

test("SEC-09D ruta: exige sesion admin y origen confiable antes de cualquier inventario", async () => {
  let inventoryCalls = 0;
  const inventory = async () => {
    inventoryCalls += 1;
    return buildFailedStorageOrphanInventory(new Date(), "listing_failed");
  };
  const unauthenticated = await buildApp({ inventory, authenticated: false });
  const untrusted = await buildApp({ inventory });

  try {
    const noSession = await unauthenticated.app.inject({
      method: "POST",
      url: "/purge-dry-run",
      headers: { origin: ORIGIN },
      payload: { includeStorageOrphans: true },
    });
    const badOrigin = await untrusted.app.inject({
      method: "POST",
      url: "/purge-dry-run",
      headers: { ...authHeaders, origin: "https://evil.example.com" },
      payload: { includeStorageOrphans: true },
    });

    assert.equal(noSession.statusCode, 401);
    assert.equal(badOrigin.statusCode, 403);
    assert.equal(inventoryCalls, 0);
  } finally {
    await unauthenticated.app.close();
    await untrusted.app.close();
  }
});
