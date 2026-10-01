import assert from "node:assert/strict";
import test from "node:test";
import {
  createStorageApiError,
  createStoragePortFake,
} from "../../mocks/storage-port.ts";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.SUPABASE_STORAGE_BUCKET = "reports";

const { createSignedStorageUrl, deleteStorageObject, uploadReport } = await import(
  "../../../server/lib/supabase.ts"
);

test("storage usa el puerto inyectado con el bucket, path y errores observables", async () => {
  const signedUrlCalls: Array<{ path: string; expires: number }> = [];
  const removedPaths: Array<ReadonlyArray<string | { path: string; versionId: string }>> = [];
  const uploadedPaths: string[] = [];
  const { storage, fromCalls } = createStoragePortFake({
    upload: async (path) => {
      uploadedPaths.push(path);
      return { data: { id: "object-09", path, fullPath: `reports/${path}` }, error: null };
    },
    createSignedUrl: async (path, expires) => {
      signedUrlCalls.push({ path, expires });
      return { data: { signedUrl: "https://example.test/signed/report.pdf" }, error: null };
    },
    remove: async (paths) => {
      removedPaths.push(paths);
      return { data: [], error: null };
    },
  });

  assert.equal(
    await createSignedStorageUrl("clinics/9/report.pdf", storage),
    "https://example.test/signed/report.pdf",
  );
  const storagePath = await uploadReport(
    {
      file: Buffer.from("report-09"),
      fileName: "report-09.pdf",
      clinicId: 9,
      mimeType: "application/pdf",
    },
    storage,
  );
  await deleteStorageObject("clinics/9/report.pdf", storage);

  assert.deepEqual(fromCalls, ["reports", "reports", "reports"]);
  assert.deepEqual(signedUrlCalls.map(({ path }) => path), ["clinics/9/report.pdf"]);
  assert.equal(signedUrlCalls[0]?.expires > 0, true);
  assert.deepEqual(uploadedPaths, [storagePath]);
  assert.match(storagePath, /^clinics\/9\/\d+-[a-f0-9]{12}-report-09\.pdf$/);
  assert.deepEqual(
    removedPaths.map((paths) => paths.map((entry) => typeof entry === "string" ? entry : entry.path)),
    [["clinics/9/report.pdf"]],
  );

  const expected = createStorageApiError("remote remove rejected");
  const rejected = createStoragePortFake({
    remove: async () => ({ data: null, error: expected }),
  });

  await assert.rejects(
    deleteStorageObject("clinics/9/report.pdf", rejected.storage),
    (error: unknown) => error === expected,
  );
});
