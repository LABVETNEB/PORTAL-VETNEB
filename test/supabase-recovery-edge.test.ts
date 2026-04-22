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
  createSignedStorageUrl,
  createSignedReportDownloadUrl,
  supabase,
} = await import("../server/lib/supabase.ts");

test("ensureStorageBucketExists crea bucket cuando getBucket devuelve error", async () => {
  const originalGetBucket = supabase.storage.getBucket;
  const originalCreateBucket = supabase.storage.createBucket;

  let capturedBucketName: string | null = null;
  let capturedCreateOptions: unknown = null;

  const createdBucket = {
    name: "reports",
    public: false,
  };

  (supabase.storage as any).getBucket = async () => {
    return {
      data: null,
      error: new Error("bucket lookup failed"),
    };
  };

  (supabase.storage as any).createBucket = async (
    bucketName: string,
    options: unknown,
  ) => {
    capturedBucketName = bucketName;
    capturedCreateOptions = options;

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

  assert.equal(capturedBucketName, "reports");
  assert.deepEqual(capturedCreateOptions, {
    public: false,
  });
});

test("createSignedStorageUrl usa fallback cuando data viene null sin error", async () => {
  const originalFrom = supabase.storage.from;

  (supabase.storage as any).from = () => ({
    createSignedUrl: async () => ({
      data: null,
      error: null,
    }),
  });

  try {
    await assert.rejects(
      createSignedStorageUrl("clinics/3/report.pdf"),
      /No se pudo generar la URL firmada del archivo/,
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
  }
});

test("createSignedReportDownloadUrl usa fallback cuando signedUrl no existe y no hay error", async () => {
  const originalFrom = supabase.storage.from;

  let capturedOptions: unknown = null;

  (supabase.storage as any).from = () => ({
    createSignedUrl: async (_path: string, _expires: number, options: unknown) => {
      capturedOptions = options;

      return {
        data: {
          signedUrl: undefined,
        },
        error: null,
      };
    },
  });

  try {
    await assert.rejects(
      createSignedReportDownloadUrl("clinics/9/report.pdf", "descarga.pdf"),
      /No se pudo generar la URL firmada de descarga/,
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
  }

  assert.deepEqual(capturedOptions, {
    download: "descarga.pdf",
  });
});
