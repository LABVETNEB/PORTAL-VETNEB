import test from "node:test";
import assert from "node:assert/strict";
import {
  createStorageApiError,
  createStoragePortFake,
} from "../../mocks/storage-port.ts";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.SUPABASE_STORAGE_BUCKET ??= "reports";

const {
  ensureStorageBucketExists,
  checkStorageHealth,
} = await import("../../../server/lib/supabase.ts");

test("ensureStorageBucketExists devuelve bucket existente sin crear uno nuevo", async () => {
  let capturedBucket: string | null = null;
  let createBucketCalls = 0;

  const existingBucket = {
    id: "bucket-id",
    name: "reports",
    owner: "",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    public: false,
  };

  const { storage } = createStoragePortFake({
    getBucket: async (bucket) => {
      capturedBucket = bucket;

      return {
        data: existingBucket,
        error: null,
      };
    },
    createBucket: async (bucketName) => {
      createBucketCalls += 1;

      return {
        data: { name: bucketName },
        error: null,
      };
    },
  });

  const result = await ensureStorageBucketExists(storage);

  assert.deepEqual(result, existingBucket);
  assert.equal(capturedBucket, "reports");
  assert.equal(createBucketCalls, 0);
});

test("ensureStorageBucketExists crea bucket cuando no existe", async () => {
  let capturedCreateBucketName: string | null = null;
  let capturedCreateBucketOptions: unknown = null;

  const createdBucket = {
    name: "reports",
    public: false,
  };

  const { storage } = createStoragePortFake({
    // 10B residual: el tipo del SDK excluye {data: null, error: null}, la rama defensiva bajo prueba.
    getBucket: async () => ({ data: null, error: null }) as any,
    createBucket: async (bucketName, options) => {
      capturedCreateBucketName = bucketName;
      capturedCreateBucketOptions = options;

      return {
        data: createdBucket,
        error: null,
      };
    },
  });

  const result = await ensureStorageBucketExists(storage);

  assert.deepEqual(result, createdBucket);
  assert.equal(capturedCreateBucketName, "reports");
  assert.deepEqual(capturedCreateBucketOptions, {
    public: false,
  });
});

test("ensureStorageBucketExists propaga error de createBucket", async () => {
  const expectedError = createStorageApiError("create bucket failed");

  const { storage } = createStoragePortFake({
    // 10B residual: el tipo del SDK excluye {data: null, error: null}, la rama defensiva bajo prueba.
    getBucket: async () => ({ data: null, error: null }) as any,
    createBucket: async () => ({
      data: null,
      error: expectedError,
    }),
  });

  await assert.rejects(
    ensureStorageBucketExists(storage),
    (error: unknown) => error === expectedError,
  );
});

test("checkStorageHealth devuelve bucket cuando storage responde correctamente", async () => {
  let capturedBucket: string | null = null;

  const bucketData = {
    id: "bucket-id",
    name: "reports",
    owner: "",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    public: false,
  };

  const { storage } = createStoragePortFake({
    getBucket: async (bucket) => {
      capturedBucket = bucket;

      return {
        data: bucketData,
        error: null,
      };
    },
  });

  const result = await checkStorageHealth(storage);

  assert.deepEqual(result, bucketData);
  assert.equal(capturedBucket, "reports");
});

test("checkStorageHealth propaga error de getBucket", async () => {
  const expectedError = createStorageApiError("healthcheck failed");

  const { storage } = createStoragePortFake({
    getBucket: async () => ({
      data: null,
      error: expectedError,
    }),
  });

  await assert.rejects(
    checkStorageHealth(storage),
    (error: unknown) => error === expectedError,
  );
});
