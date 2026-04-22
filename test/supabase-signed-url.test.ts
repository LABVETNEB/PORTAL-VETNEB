import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.SUPABASE_STORAGE_BUCKET ??= "reports";

const supabaseModule = await import("../server/lib/supabase.ts");
const {
  createSignedStorageUrl,
  createSignedReportUrl,
  createSignedReportDownloadUrl,
  deleteStorageObject,
  supabase,
} = supabaseModule;

test("createSignedStorageUrl devuelve signedUrl cuando storage responde correctamente", async () => {
  const originalFrom = supabase.storage.from;

  let capturedBucket: string | null = null;
  let capturedPath: string | null = null;
  let capturedExpires: number | null = null;

  (supabase.storage as any).from = (bucket: string) => {
    capturedBucket = bucket;

    return {
      createSignedUrl: async (path: string, expires: number) => {
        capturedPath = path;
        capturedExpires = expires;

        return {
          data: {
            signedUrl: "https://example.com/signed/report.pdf",
          },
          error: null,
        };
      },
    };
  };

  try {
    const result = await createSignedStorageUrl("clinics/7/report.pdf");

    assert.equal(result, "https://example.com/signed/report.pdf");
  } finally {
    (supabase.storage as any).from = originalFrom;
  }

  assert.equal(capturedBucket, "reports");
  assert.equal(capturedPath, "clinics/7/report.pdf");
  assert.equal(typeof capturedExpires, "number");
  assert.equal((capturedExpires ?? 0) > 0, true);
});

test("createSignedStorageUrl lanza error cuando falta signedUrl", async () => {
  const originalFrom = supabase.storage.from;

  (supabase.storage as any).from = () => ({
    createSignedUrl: async () => ({
      data: {
        signedUrl: null,
      },
      error: null,
    }),
  });

  try {
    await assert.rejects(
      createSignedStorageUrl("clinics/7/report.pdf"),
      /No se pudo generar la URL firmada del archivo/,
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
  }
});

test("createSignedStorageUrl propaga error de storage", async () => {
  const originalFrom = supabase.storage.from;
  const expectedError = new Error("signed url error");

  (supabase.storage as any).from = () => ({
    createSignedUrl: async () => ({
      data: null,
      error: expectedError,
    }),
  });

  try {
    await assert.rejects(
      createSignedStorageUrl("clinics/7/report.pdf"),
      (error: unknown) => error === expectedError,
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
  }
});

test("createSignedReportUrl delega en createSignedStorageUrl", async () => {
  const originalFrom = supabase.storage.from;

  let capturedPath: string | null = null;

  (supabase.storage as any).from = () => ({
    createSignedUrl: async (path: string) => {
      capturedPath = path;

      return {
        data: {
          signedUrl: "https://example.com/signed/delegated.pdf",
        },
        error: null,
      };
    },
  });

  try {
    const result = await createSignedReportUrl("clinics/9/report-final.pdf");

    assert.equal(result, "https://example.com/signed/delegated.pdf");
  } finally {
    (supabase.storage as any).from = originalFrom;
  }

  assert.equal(capturedPath, "clinics/9/report-final.pdf");
});

test("createSignedReportDownloadUrl usa nombre de descarga explicito cuando se provee", async () => {
  const originalFrom = supabase.storage.from;

  let capturedPath: string | null = null;
  let capturedExpires: number | null = null;
  let capturedOptions: unknown = null;

  (supabase.storage as any).from = () => ({
    createSignedUrl: async (path: string, expires: number, options: unknown) => {
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

  try {
    const result = await createSignedReportDownloadUrl(
      "clinics/5/report.pdf",
      "mi-reporte.pdf",
    );

    assert.equal(result, "https://example.com/download/report.pdf");
  } finally {
    (supabase.storage as any).from = originalFrom;
  }

  assert.equal(capturedPath, "clinics/5/report.pdf");
  assert.equal(typeof capturedExpires, "number");
  assert.deepEqual(capturedOptions, {
    download: "mi-reporte.pdf",
  });
});

test("createSignedReportDownloadUrl usa download true cuando no se provee nombre", async () => {
  const originalFrom = supabase.storage.from;

  let capturedOptions: unknown = null;

  (supabase.storage as any).from = () => ({
    createSignedUrl: async (_path: string, _expires: number, options: unknown) => {
      capturedOptions = options;

      return {
        data: {
          signedUrl: "https://example.com/download/default.pdf",
        },
        error: null,
      };
    },
  });

  try {
    const result = await createSignedReportDownloadUrl("clinics/5/report.pdf");

    assert.equal(result, "https://example.com/download/default.pdf");
  } finally {
    (supabase.storage as any).from = originalFrom;
  }

  assert.deepEqual(capturedOptions, {
    download: true,
  });
});

test("createSignedReportDownloadUrl lanza error cuando storage falla", async () => {
  const originalFrom = supabase.storage.from;
  const expectedError = new Error("download signed url error");

  (supabase.storage as any).from = () => ({
    createSignedUrl: async () => ({
      data: null,
      error: expectedError,
    }),
  });

  try {
    await assert.rejects(
      createSignedReportDownloadUrl("clinics/5/report.pdf"),
      (error: unknown) => error === expectedError,
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
  }
});

test("deleteStorageObject elimina path en el bucket configurado", async () => {
  const originalFrom = supabase.storage.from;

  let capturedBucket: string | null = null;
  let capturedPaths: string[] | null = null;

  (supabase.storage as any).from = (bucket: string) => {
    capturedBucket = bucket;

    return {
      remove: async (paths: string[]) => {
        capturedPaths = paths;

        return {
          error: null,
        };
      },
    };
  };

  try {
    await deleteStorageObject("clinics/5/report.pdf");
  } finally {
    (supabase.storage as any).from = originalFrom;
  }

  assert.equal(capturedBucket, "reports");
  assert.deepEqual(capturedPaths, ["clinics/5/report.pdf"]);
});

test("deleteStorageObject propaga error de remove", async () => {
  const originalFrom = supabase.storage.from;
  const expectedError = new Error("remove error");

  (supabase.storage as any).from = () => ({
    remove: async () => ({
      error: expectedError,
    }),
  });

  try {
    await assert.rejects(
      deleteStorageObject("clinics/5/report.pdf"),
      (error: unknown) => error === expectedError,
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
  }
});
