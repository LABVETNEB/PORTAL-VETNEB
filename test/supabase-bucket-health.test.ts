import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.SUPABASE_STORAGE_BUCKET ??= "reports";

const {
  ensureStorageBucketExists,
  checkStorageHealth,
  supabase,
} = await import("../server/lib/supabase.ts");

test("ensureStorageBucketExists devuelve bucket existente sin crear uno nuevo", async () => {
  const originalGetBucket = supabase.storage.getBucket;
  const originalCreateBucket = supabase.storage.createBucket;

  let capturedBucket: string | null = null;
  let createBucketCalls = 0;

  const existingBucket = {
    id: "bucket-id",
    name: "reports",
    public: false,
  };

  (supabase.storage as any).getBucket = async (bucket: string) => {
    capturedBucket = bucket;

    return {
      data: existingBucket,
      error: null,
    };
  };

  (supabase.storage as any).createBucket = async () => {
    createBucketCalls += 1;

    return {
      data: null,
      error: null,
    };
  };

  try {
    const result = await ensureStorageBucketExists();

    assert.deepEqual(result, existingBucket);
  } finally {
    (supabase.storage as any).getBucket = originalGetBucket;
    (supabase.storage as any).createBucket = originalCreateBucket;
  }

  assert.equal(capturedBucket, "reports");
  assert.equal(createBucketCalls, 0);
});

test("ensureStorageBucketExists crea bucket cuando no existe", async () => {
  const originalGetBucket = supabase.storage.getBucket;
  const originalCreateBucket = supabase.storage.createBucket;

  let capturedCreateBucketName: string | null = null;
  let capturedCreateBucketOptions: unknown = null;

  const createdBucket = {
    name: "reports",
    public: false,
  };

  (supabase.storage as any).getBucket = async () => {
    return {
      data: null,
      error: null,
    };
  };

  (supabase.storage as any).createBucket = async (
    bucketName: string,
    options: unknown,
  ) => {
    capturedCreateBucketName = bucketName;
    capturedCreateBucketOptions = options;

    return {
      data: createdBucket,
      error: null,
    };
  };

  try {
    const result = await ensureStorageBucketExists();

    assert.deepEqual(result, createdBucket);
  } finally {
    (supabase.storage as any).getBucket = originalGetBucket;
    (supabase.storage as any).createBucket = originalCreateBucket;
  }

  assert.equal(capturedCreateBucketName, "reports");
  assert.deepEqual(capturedCreateBucketOptions, {
    public: false,
  });
});

test("ensureStorageBucketExists propaga error de createBucket", async () => {
  const originalGetBucket = supabase.storage.getBucket;
  const originalCreateBucket = supabase.storage.createBucket;

  const expectedError = new Error("create bucket failed");

  (supabase.storage as any).getBucket = async () => {
    return {
      data: null,
      error: null,
    };
  };

  (supabase.storage as any).createBucket = async () => {
    return {
      data: null,
      error: expectedError,
    };
  };

  try {
    await assert.rejects(
      ensureStorageBucketExists(),
      (error: unknown) => error === expectedError,
    );
  } finally {
    (supabase.storage as any).getBucket = originalGetBucket;
    (supabase.storage as any).createBucket = originalCreateBucket;
  }
});

test("checkStorageHealth devuelve bucket cuando storage responde correctamente", async () => {
  const originalGetBucket = supabase.storage.getBucket;

  let capturedBucket: string | null = null;

  const bucketData = {
    id: "bucket-id",
    name: "reports",
    public: false,
  };

  (supabase.storage as any).getBucket = async (bucket: string) => {
    capturedBucket = bucket;

    return {
      data: bucketData,
      error: null,
    };
  };

  try {
    const result = await checkStorageHealth();

    assert.deepEqual(result, bucketData);
  } finally {
    (supabase.storage as any).getBucket = originalGetBucket;
  }

  assert.equal(capturedBucket, "reports");
});

test("checkStorageHealth propaga error de getBucket", async () => {
  const originalGetBucket = supabase.storage.getBucket;

  const expectedError = new Error("healthcheck failed");

  (supabase.storage as any).getBucket = async () => {
    return {
      data: null,
      error: expectedError,
    };
  };

  try {
    await assert.rejects(
      checkStorageHealth(),
      (error: unknown) => error === expectedError,
    );
  } finally {
    (supabase.storage as any).getBucket = originalGetBucket;
  }
});
