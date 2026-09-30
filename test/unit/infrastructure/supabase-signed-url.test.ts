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

const supabaseModule = await import("../../../server/lib/supabase.ts");
const {
  createSignedStorageUrl,
  createSignedReportUrl,
  createSignedReportDownloadUrl,
  deleteStorageObject,
} = supabaseModule;

test("createSignedStorageUrl devuelve signedUrl cuando storage responde correctamente", async () => {
  let capturedPath: string | null = null;
  let capturedExpires: number | null = null;

  const { storage, fromCalls } = createStoragePortFake({
    createSignedUrl: async (path, expires) => {
      capturedPath = path;
      capturedExpires = expires;

      return {
        data: {
          signedUrl: "https://example.com/signed/report.pdf",
        },
        error: null,
      };
    },
  });

  const result = await createSignedStorageUrl("clinics/7/report.pdf", storage);

  assert.equal(result, "https://example.com/signed/report.pdf");
  assert.deepEqual(fromCalls, ["reports"]);
  assert.equal(capturedPath, "clinics/7/report.pdf");
  assert.equal(typeof capturedExpires, "number");
  assert.equal((capturedExpires ?? 0) > 0, true);
});

test("createSignedStorageUrl lanza error cuando falta signedUrl", async () => {
  const { storage } = createStoragePortFake({
    // 10B residual: el tipo del SDK exige signedUrl string, la rama defensiva bajo prueba.
    createSignedUrl: async () => ({ data: { signedUrl: null }, error: null }) as any,
  });

  await assert.rejects(
    createSignedStorageUrl("clinics/7/report.pdf", storage),
    /No se pudo generar la URL firmada del archivo/,
  );
});

test("createSignedStorageUrl propaga error de storage", async () => {
  const expectedError = createStorageApiError("signed url error");

  const { storage } = createStoragePortFake({
    createSignedUrl: async () => ({
      data: null,
      error: expectedError,
    }),
  });

  await assert.rejects(
    createSignedStorageUrl("clinics/7/report.pdf", storage),
    (error: unknown) => error === expectedError,
  );
});

test("createSignedReportUrl delega en createSignedStorageUrl", async () => {
  let capturedPath: string | null = null;

  const { storage } = createStoragePortFake({
    createSignedUrl: async (path) => {
      capturedPath = path;

      return {
        data: {
          signedUrl: "https://example.com/signed/delegated.pdf",
        },
        error: null,
      };
    },
  });

  const result = await createSignedReportUrl("clinics/9/report-final.pdf", storage);

  assert.equal(result, "https://example.com/signed/delegated.pdf");
  assert.equal(capturedPath, "clinics/9/report-final.pdf");
});

test("createSignedReportDownloadUrl usa nombre de descarga explicito cuando se provee", async () => {
  let capturedPath: string | null = null;
  let capturedExpires: number | null = null;
  let capturedOptions: unknown = null;

  const { storage } = createStoragePortFake({
    createSignedUrl: async (path, expires, options) => {
      capturedPath = path;
      capturedExpires = expires;
      capturedOptions = options;

      return {
        data: {
          signedUrl: "https://example.com/download/report.pdf",
        },
        error: null,
      };
    },
  });

  const result = await createSignedReportDownloadUrl(
    "clinics/5/report.pdf",
    "mi-reporte.pdf",
    storage,
  );

  assert.equal(result, "https://example.com/download/report.pdf");
  assert.equal(capturedPath, "clinics/5/report.pdf");
  assert.equal(typeof capturedExpires, "number");
  assert.deepEqual(capturedOptions, {
    download: "mi-reporte.pdf",
  });
});

test("createSignedReportDownloadUrl usa download true cuando no se provee nombre", async () => {
  let capturedOptions: unknown = null;

  const { storage } = createStoragePortFake({
    createSignedUrl: async (_path, _expires, options) => {
      capturedOptions = options;

      return {
        data: {
          signedUrl: "https://example.com/download/default.pdf",
        },
        error: null,
      };
    },
  });

  const result = await createSignedReportDownloadUrl(
    "clinics/5/report.pdf",
    undefined,
    storage,
  );

  assert.equal(result, "https://example.com/download/default.pdf");
  assert.deepEqual(capturedOptions, {
    download: true,
  });
});

test("createSignedReportDownloadUrl lanza error cuando storage falla", async () => {
  const expectedError = createStorageApiError("download signed url error");

  const { storage } = createStoragePortFake({
    createSignedUrl: async () => ({
      data: null,
      error: expectedError,
    }),
  });

  await assert.rejects(
    createSignedReportDownloadUrl("clinics/5/report.pdf", undefined, storage),
    (error: unknown) => error === expectedError,
  );
});

test("deleteStorageObject elimina path en el bucket configurado", async () => {
  let capturedPaths: unknown = null;

  const { storage, fromCalls } = createStoragePortFake({
    remove: async (paths) => {
      capturedPaths = paths;

      return {
        data: [],
        error: null,
      };
    },
  });

  await deleteStorageObject("clinics/5/report.pdf", storage);

  assert.deepEqual(fromCalls, ["reports"]);
  assert.deepEqual(capturedPaths, ["clinics/5/report.pdf"]);
});

test("deleteStorageObject propaga error de remove", async () => {
  const expectedError = createStorageApiError("remove error");

  const { storage } = createStoragePortFake({
    remove: async () => ({
      data: null,
      error: expectedError,
    }),
  });

  await assert.rejects(
    deleteStorageObject("clinics/5/report.pdf", storage),
    (error: unknown) => error === expectedError,
  );
});
