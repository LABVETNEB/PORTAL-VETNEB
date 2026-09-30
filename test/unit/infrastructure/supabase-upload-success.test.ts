import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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
  uploadReport,
  uploadClinicAvatar,
} = await import("../../../server/lib/supabase.ts");

test("uploadReport sube archivo con path sanitizado y opciones esperadas", async () => {
  const originalDateNow = Date.now;
  const originalRandomBytes = crypto.randomBytes;

  let capturedPath: string | null = null;
  let capturedFile: unknown = null;
  let capturedOptions: unknown = null;

  Date.now = () => 1710000000000;
  (crypto as any).randomBytes = () => Buffer.from("aabbccddeeff", "hex");

  const { storage, fromCalls } = createStoragePortFake({
    upload: async (path, file, options) => {
      capturedPath = path;
      capturedFile = file;
      capturedOptions = options;

      return {
        data: { id: "object-id", path, fullPath: `reports/${path}` },
        error: null,
      };
    },
  });

  const file = Buffer.from("pdf-content");

  try {
    const result = await uploadReport(
      {
        file,
        fileName: "reporte final.pdf",
        clinicId: 7,
        mimeType: "application/pdf",
      },
      storage,
    );

    assert.equal(
      result,
      "clinics/7/1710000000000-aabbccddeeff-reporte_final.pdf",
    );
  } finally {
    Date.now = originalDateNow;
    crypto.randomBytes = originalRandomBytes;
  }

  assert.deepEqual(fromCalls, ["reports"]);
  assert.equal(
    capturedPath,
    "clinics/7/1710000000000-aabbccddeeff-reporte_final.pdf",
  );
  assert.equal(capturedFile, file);
  assert.deepEqual(capturedOptions, {
    contentType: "application/pdf",
    upsert: false,
  });
});

test("uploadReport usa nombre fallback cuando fileName viene vacío", async () => {
  const originalDateNow = Date.now;
  const originalRandomBytes = crypto.randomBytes;

  let capturedPath: string | null = null;

  Date.now = () => 1710000000001;
  (crypto as any).randomBytes = () => Buffer.from("aabbccddeeff", "hex");

  const { storage } = createStoragePortFake({
    upload: async (path) => {
      capturedPath = path;

      return {
        data: { id: "object-id", path, fullPath: `reports/${path}` },
        error: null,
      };
    },
  });

  try {
    const result = await uploadReport(
      {
        file: Buffer.from("pdf-content"),
        fileName: "",
        clinicId: 8,
        mimeType: "application/pdf",
      },
      storage,
    );

    assert.equal(
      result,
      "clinics/8/1710000000001-aabbccddeeff-report",
    );
  } finally {
    Date.now = originalDateNow;
    crypto.randomBytes = originalRandomBytes;
  }

  assert.equal(
    capturedPath,
    "clinics/8/1710000000001-aabbccddeeff-report",
  );
});

test("uploadReport propaga error de upload cuando mimeType es válido", async () => {
  const expectedError = createStorageApiError("upload report failed");

  const { storage } = createStoragePortFake({
    upload: async () => ({
      data: null,
      error: expectedError,
    }),
  });

  await assert.rejects(
    uploadReport(
      {
        file: Buffer.from("pdf-content"),
        fileName: "reporte.pdf",
        clinicId: 7,
        mimeType: "application/pdf",
      },
      storage,
    ),
    (error: unknown) => error === expectedError,
  );
});

test("uploadClinicAvatar sube avatar con path sanitizado y opciones esperadas", async () => {
  const originalDateNow = Date.now;
  const originalRandomBytes = crypto.randomBytes;

  let capturedPath: string | null = null;
  let capturedFile: unknown = null;
  let capturedOptions: unknown = null;

  Date.now = () => 1710000000002;
  (crypto as any).randomBytes = () => Buffer.from("aabbccddeeff", "hex");

  const { storage, fromCalls } = createStoragePortFake({
    upload: async (path, file, options) => {
      capturedPath = path;
      capturedFile = file;
      capturedOptions = options;

      return {
        data: { id: "object-id", path, fullPath: `reports/${path}` },
        error: null,
      };
    },
  });

  const file = Buffer.from("avatar-content");

  try {
    const result = await uploadClinicAvatar(
      {
        file,
        fileName: "avatar clinica.webp",
        clinicId: 12,
        mimeType: "image/webp",
      },
      storage,
    );

    assert.equal(
      result,
      "clinic-avatars/12/1710000000002-aabbccddeeff-avatar_clinica.webp",
    );
  } finally {
    Date.now = originalDateNow;
    crypto.randomBytes = originalRandomBytes;
  }

  assert.deepEqual(fromCalls, ["reports"]);
  assert.equal(
    capturedPath,
    "clinic-avatars/12/1710000000002-aabbccddeeff-avatar_clinica.webp",
  );
  assert.equal(capturedFile, file);
  assert.deepEqual(capturedOptions, {
    contentType: "image/webp",
    upsert: false,
  });
});

test("uploadClinicAvatar usa nombre fallback cuando fileName viene vacío", async () => {
  const originalDateNow = Date.now;
  const originalRandomBytes = crypto.randomBytes;

  let capturedPath: string | null = null;

  Date.now = () => 1710000000003;
  (crypto as any).randomBytes = () => Buffer.from("aabbccddeeff", "hex");

  const { storage } = createStoragePortFake({
    upload: async (path) => {
      capturedPath = path;

      return {
        data: { id: "object-id", path, fullPath: `reports/${path}` },
        error: null,
      };
    },
  });

  try {
    const result = await uploadClinicAvatar(
      {
        file: Buffer.from("avatar-content"),
        fileName: "",
        clinicId: 15,
        mimeType: "image/png",
      },
      storage,
    );

    assert.equal(
      result,
      "clinic-avatars/15/1710000000003-aabbccddeeff-avatar",
    );
  } finally {
    Date.now = originalDateNow;
    crypto.randomBytes = originalRandomBytes;
  }

  assert.equal(
    capturedPath,
    "clinic-avatars/15/1710000000003-aabbccddeeff-avatar",
  );
});

test("uploadClinicAvatar propaga error de upload cuando mimeType es válido", async () => {
  const expectedError = createStorageApiError("upload avatar failed");

  const { storage } = createStoragePortFake({
    upload: async () => ({
      data: null,
      error: expectedError,
    }),
  });

  await assert.rejects(
    uploadClinicAvatar(
      {
        file: Buffer.from("avatar-content"),
        fileName: "avatar.png",
        clinicId: 10,
        mimeType: "image/png",
      },
      storage,
    ),
    (error: unknown) => error === expectedError,
  );
});
test("uploadReport neutraliza path traversal y separadores de ruta en fileName", async () => {
  const originalDateNow = Date.now;
  const originalRandomBytes = crypto.randomBytes;

  let capturedPath: string | null = null;

  Date.now = () => 1710000000100;
  (crypto as any).randomBytes = () => Buffer.from("aabbccddeeff", "hex");

  const { storage } = createStoragePortFake({
    upload: async (path) => {
      capturedPath = path;

      return {
        data: { id: "object-id", path, fullPath: `reports/${path}` },
        error: null,
      };
    },
  });

  try {
    const result = await uploadReport(
      {
        file: Buffer.from("pdf-content"),
        fileName: "..\\../Luna final #1.pdf",
        clinicId: 17,
        mimeType: "application/pdf",
      },
      storage,
    );

    assert.equal(
      result,
      "clinics/17/1710000000100-aabbccddeeff-Luna_final_1.pdf",
    );
    assert.equal(capturedPath, result);
    assert.equal(result.split("/").length, 3);
    assert.equal(result.includes(".."), false);
    assert.equal(result.includes("\\"), false);
    assert.equal(result.includes(" "), false);
    assert.equal(result.startsWith("http://"), false);
    assert.equal(result.startsWith("https://"), false);
  } finally {
    Date.now = originalDateNow;
    crypto.randomBytes = originalRandomBytes;
  }
});

test("uploadClinicAvatar neutraliza path traversal y separadores de ruta en fileName", async () => {
  const originalDateNow = Date.now;
  const originalRandomBytes = crypto.randomBytes;

  let capturedPath: string | null = null;

  Date.now = () => 1710000000101;
  (crypto as any).randomBytes = () => Buffer.from("aabbccddeeff", "hex");

  const { storage } = createStoragePortFake({
    upload: async (path) => {
      capturedPath = path;

      return {
        data: { id: "object-id", path, fullPath: `reports/${path}` },
        error: null,
      };
    },
  });

  try {
    const result = await uploadClinicAvatar(
      {
        file: Buffer.from("avatar-content"),
        fileName: "../avatar final.png",
        clinicId: 21,
        mimeType: "image/png",
      },
      storage,
    );

    assert.equal(
      result,
      "clinic-avatars/21/1710000000101-aabbccddeeff-avatar_final.png",
    );
    assert.equal(capturedPath, result);
    assert.equal(result.split("/").length, 3);
    assert.equal(result.includes(".."), false);
    assert.equal(result.includes("\\"), false);
    assert.equal(result.includes(" "), false);
    assert.equal(result.startsWith("http://"), false);
    assert.equal(result.startsWith("https://"), false);
  } finally {
    Date.now = originalDateNow;
    crypto.randomBytes = originalRandomBytes;
  }
});
