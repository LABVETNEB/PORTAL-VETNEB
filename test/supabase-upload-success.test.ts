import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.SUPABASE_STORAGE_BUCKET ??= "reports";

const {
  uploadReport,
  uploadClinicAvatar,
  supabase,
} = await import("../server/lib/supabase.ts");

test("uploadReport sube archivo con path sanitizado y opciones esperadas", async () => {
  const originalFrom = supabase.storage.from;
  const originalDateNow = Date.now;
  const originalMathRandom = Math.random;

  let capturedBucket: string | null = null;
  let capturedPath: string | null = null;
  let capturedFile: Buffer | null = null;
  let capturedOptions: unknown = null;

  Date.now = () => 1710000000000;
  Math.random = () => 0.123456789;

  (supabase.storage as any).from = (bucket: string) => {
    capturedBucket = bucket;

    return {
      upload: async (path: string, file: Buffer, options: unknown) => {
        capturedPath = path;
        capturedFile = file;
        capturedOptions = options;

        return {
          error: null,
        };
      },
    };
  };

  const file = Buffer.from("pdf-content");

  try {
    const result = await uploadReport({
      file,
      fileName: "reporte final.pdf",
      clinicId: 7,
      mimeType: "application/pdf",
    });

    assert.equal(
      result,
      "clinics/7/1710000000000-4fzzzxjy-reporte_final.pdf",
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
    Date.now = originalDateNow;
    Math.random = originalMathRandom;
  }

  assert.equal(capturedBucket, "reports");
  assert.equal(
    capturedPath,
    "clinics/7/1710000000000-4fzzzxjy-reporte_final.pdf",
  );
  assert.equal(capturedFile, file);
  assert.deepEqual(capturedOptions, {
    contentType: "application/pdf",
    upsert: false,
  });
});

test("uploadReport usa nombre fallback cuando fileName viene vacío", async () => {
  const originalFrom = supabase.storage.from;
  const originalDateNow = Date.now;
  const originalMathRandom = Math.random;

  let capturedPath: string | null = null;

  Date.now = () => 1710000000001;
  Math.random = () => 0.123456789;

  (supabase.storage as any).from = () => ({
    upload: async (path: string) => {
      capturedPath = path;

      return {
        error: null,
      };
    },
  });

  try {
    const result = await uploadReport({
      file: Buffer.from("pdf-content"),
      fileName: "",
      clinicId: 8,
      mimeType: "application/pdf",
    });

    assert.equal(
      result,
      "clinics/8/1710000000001-4fzzzxjy-report",
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
    Date.now = originalDateNow;
    Math.random = originalMathRandom;
  }

  assert.equal(
    capturedPath,
    "clinics/8/1710000000001-4fzzzxjy-report",
  );
});

test("uploadReport propaga error de upload cuando mimeType es válido", async () => {
  const originalFrom = supabase.storage.from;
  const expectedError = new Error("upload report failed");

  (supabase.storage as any).from = () => ({
    upload: async () => ({
      error: expectedError,
    }),
  });

  try {
    await assert.rejects(
      uploadReport({
        file: Buffer.from("pdf-content"),
        fileName: "reporte.pdf",
        clinicId: 7,
        mimeType: "application/pdf",
      }),
      (error: unknown) => error === expectedError,
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
  }
});

test("uploadClinicAvatar sube avatar con path sanitizado y opciones esperadas", async () => {
  const originalFrom = supabase.storage.from;
  const originalDateNow = Date.now;
  const originalMathRandom = Math.random;

  let capturedBucket: string | null = null;
  let capturedPath: string | null = null;
  let capturedFile: Buffer | null = null;
  let capturedOptions: unknown = null;

  Date.now = () => 1710000000002;
  Math.random = () => 0.123456789;

  (supabase.storage as any).from = (bucket: string) => {
    capturedBucket = bucket;

    return {
      upload: async (path: string, file: Buffer, options: unknown) => {
        capturedPath = path;
        capturedFile = file;
        capturedOptions = options;

        return {
          error: null,
        };
      },
    };
  };

  const file = Buffer.from("avatar-content");

  try {
    const result = await uploadClinicAvatar({
      file,
      fileName: "avatar clinica.webp",
      clinicId: 12,
      mimeType: "image/webp",
    });

    assert.equal(
      result,
      "clinic-avatars/12/1710000000002-4fzzzxjy-avatar_clinica.webp",
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
    Date.now = originalDateNow;
    Math.random = originalMathRandom;
  }

  assert.equal(capturedBucket, "reports");
  assert.equal(
    capturedPath,
    "clinic-avatars/12/1710000000002-4fzzzxjy-avatar_clinica.webp",
  );
  assert.equal(capturedFile, file);
  assert.deepEqual(capturedOptions, {
    contentType: "image/webp",
    upsert: false,
  });
});

test("uploadClinicAvatar usa nombre fallback cuando fileName viene vacío", async () => {
  const originalFrom = supabase.storage.from;
  const originalDateNow = Date.now;
  const originalMathRandom = Math.random;

  let capturedPath: string | null = null;

  Date.now = () => 1710000000003;
  Math.random = () => 0.123456789;

  (supabase.storage as any).from = () => ({
    upload: async (path: string) => {
      capturedPath = path;

      return {
        error: null,
      };
    },
  });

  try {
    const result = await uploadClinicAvatar({
      file: Buffer.from("avatar-content"),
      fileName: "",
      clinicId: 15,
      mimeType: "image/png",
    });

    assert.equal(
      result,
      "clinic-avatars/15/1710000000003-4fzzzxjy-avatar",
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
    Date.now = originalDateNow;
    Math.random = originalMathRandom;
  }

  assert.equal(
    capturedPath,
    "clinic-avatars/15/1710000000003-4fzzzxjy-avatar",
  );
});

test("uploadClinicAvatar propaga error de upload cuando mimeType es válido", async () => {
  const originalFrom = supabase.storage.from;
  const expectedError = new Error("upload avatar failed");

  (supabase.storage as any).from = () => ({
    upload: async () => ({
      error: expectedError,
    }),
  });

  try {
    await assert.rejects(
      uploadClinicAvatar({
        file: Buffer.from("avatar-content"),
        fileName: "avatar.png",
        clinicId: 10,
        mimeType: "image/png",
      }),
      (error: unknown) => error === expectedError,
    );
  } finally {
    (supabase.storage as any).from = originalFrom;
  }
});
