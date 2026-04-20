import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.SUPABASE_STORAGE_BUCKET ??= "reports";

const {
  ALLOWED_MIME_TYPES,
  ALLOWED_AVATAR_MIME_TYPES,
  uploadReport,
  uploadClinicAvatar,
} = await import("../server/lib/supabase.ts");

test("ALLOWED_MIME_TYPES conserva formatos de informe permitidos", () => {
  assert.deepEqual(ALLOWED_MIME_TYPES, [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
});

test("ALLOWED_AVATAR_MIME_TYPES conserva formatos de avatar permitidos", () => {
  assert.deepEqual(ALLOWED_AVATAR_MIME_TYPES, [
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
});

test("ALLOWED_AVATAR_MIME_TYPES es subconjunto de ALLOWED_MIME_TYPES", () => {
  const allowed = new Set(ALLOWED_MIME_TYPES);

  for (const mimeType of ALLOWED_AVATAR_MIME_TYPES) {
    assert.equal(allowed.has(mimeType), true);
  }
});

test("uploadReport rechaza mime type no permitido antes de tocar storage", async () => {
  await assert.rejects(
    uploadReport({
      file: Buffer.from("hola"),
      fileName: "reporte.txt",
      clinicId: 7,
      mimeType: "text/plain",
    }),
    /Tipo de archivo no permitido: text\/plain/,
  );
});

test("uploadClinicAvatar rechaza mime type no permitido antes de tocar storage", async () => {
  await assert.rejects(
    uploadClinicAvatar({
      file: Buffer.from("hola"),
      fileName: "avatar.gif",
      clinicId: 7,
      mimeType: "image/gif",
    }),
    /Tipo de avatar no permitido: image\/gif/,
  );
});
