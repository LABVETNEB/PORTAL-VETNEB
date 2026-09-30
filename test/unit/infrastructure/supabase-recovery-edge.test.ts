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
  createSignedStorageUrl,
  createSignedReportDownloadUrl,
} = await import("../../../server/lib/supabase.ts");

test("ensureStorageBucketExists crea bucket cuando getBucket devuelve error", async () => {
  let capturedBucketName: string | null = null;
  let capturedCreateOptions: unknown = null;

  const createdBucket = {
    name: "reports",
    public: false,
  };

  const { storage } = createStoragePortFake({
    getBucket: async () => ({
      data: null,
      error: createStorageApiError("bucket lookup failed"),
    }),
    createBucket: async (bucketName, options) => {
      capturedBucketName = bucketName;
      capturedCreateOptions = options;

      return {
        data: createdBucket,
        error: null,
      };
    },
  });

  const result = await ensureStorageBucketExists(storage);

  assert.deepEqual(result, createdBucket);
  assert.equal(capturedBucketName, "reports");
  assert.deepEqual(capturedCreateOptions, {
    public: false,
  });
});

test("createSignedStorageUrl usa fallback cuando data viene null sin error", async () => {
  const { storage } = createStoragePortFake({
    // 10B residual: el tipo del SDK excluye {data: null, error: null}, la rama defensiva bajo prueba.
    createSignedUrl: async () => ({ data: null, error: null }) as any,
  });

  await assert.rejects(
    createSignedStorageUrl("clinics/3/report.pdf", storage),
    /No se pudo generar la URL firmada del archivo/,
  );
});

test("createSignedReportDownloadUrl usa fallback cuando signedUrl no existe y no hay error", async () => {
  let capturedOptions: unknown = null;

  const { storage } = createStoragePortFake({
    createSignedUrl: async (_path, _expires, options) => {
      capturedOptions = options;

      // 10B residual: el tipo del SDK exige signedUrl string, la rama defensiva bajo prueba.
      return { data: { signedUrl: undefined }, error: null } as any;
    },
  });

  await assert.rejects(
    createSignedReportDownloadUrl("clinics/9/report.pdf", "descarga.pdf", storage),
    /No se pudo generar la URL firmada de descarga/,
  );

  assert.deepEqual(capturedOptions, {
    download: "descarga.pdf",
  });
});
