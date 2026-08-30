import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.SUPABASE_STORAGE_BUCKET ??= "reports";

const { uploadReport, uploadClinicAvatar, supabase } = await import(
  "../../../server/lib/supabase.ts"
);

const HEX_RANDOM_SEGMENT = /^[0-9a-f]{12}$/;
// The last path segment has the shape {timestamp}-{randomHex}-{filename};
// splitting the whole path on "-" is unsafe because prefixes like
// "clinic-avatars" also contain a hyphen, so extract via the file segment.
const RANDOM_SEGMENT_IN_FILENAME = /^\d+-([0-9a-f]{12})-/;

function extractRandomSegment(storagePath: string): string {
  const fileSegment = storagePath.split("/").pop()!;
  const match = fileSegment.match(RANDOM_SEGMENT_IN_FILENAME);
  assert.ok(match, `could not extract random segment from ${storagePath}`);
  return match![1]!;
}

function stubUpload(): { getCapturedPaths: () => string[] } {
  const capturedPaths: string[] = [];
  (supabase.storage as any).from = () => ({
    upload: async (path: string) => {
      capturedPaths.push(path);
      return { error: null };
    },
  });
  return { getCapturedPaths: () => capturedPaths };
}

test("server/lib/supabase.ts no usa Math.random para generar paths de storage", () => {
  const source = readFileSync(
    resolve(process.cwd(), "server/lib/supabase.ts"),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /Math\.random\(/,
    "server/lib/supabase.ts no debe usar Math.random() para ningun path de storage",
  );
  assert.match(
    source,
    /import crypto from "node:crypto";/,
    "server/lib/supabase.ts debe importar el modulo crypto de Node",
  );
  assert.match(
    source,
    /crypto\.randomBytes\(6\)\.toString\("hex"\)/,
    "el componente random del path debe venir de crypto.randomBytes, no de Math.random",
  );
});

test("buildReportStoragePath (via uploadReport) usa un segmento random hexadecimal de 12 caracteres con la primitive real", async () => {
  const originalFrom = supabase.storage.from;
  const { getCapturedPaths } = stubUpload();

  try {
    const result = await uploadReport({
      file: Buffer.from("pdf-content"),
      fileName: "reporte.pdf",
      clinicId: 3,
      mimeType: "application/pdf",
    });

    const randomSegment = extractRandomSegment(result);
    assert.match(randomSegment, HEX_RANDOM_SEGMENT);
    assert.equal(getCapturedPaths()[0], result);
  } finally {
    (supabase.storage as any).from = originalFrom;
  }
});

test("buildClinicAvatarStoragePath (via uploadClinicAvatar) usa un segmento random hexadecimal de 12 caracteres con la primitive real", async () => {
  const originalFrom = supabase.storage.from;
  const { getCapturedPaths } = stubUpload();

  try {
    const result = await uploadClinicAvatar({
      file: Buffer.from("avatar-content"),
      fileName: "avatar.png",
      clinicId: 4,
      mimeType: "image/png",
    });

    const randomSegment = extractRandomSegment(result);
    assert.match(randomSegment, HEX_RANDOM_SEGMENT);
    assert.equal(getCapturedPaths()[0], result);
  } finally {
    (supabase.storage as any).from = originalFrom;
  }
});

test("uploadReport genera 1000 paths distintos con la primitive random real (no Math.random)", async () => {
  const originalFrom = supabase.storage.from;
  const { getCapturedPaths } = stubUpload();
  const N = 1000;

  try {
    for (let i = 0; i < N; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await uploadReport({
        file: Buffer.from("pdf-content"),
        fileName: "reporte.pdf",
        clinicId: 1,
        mimeType: "application/pdf",
      });
    }
  } finally {
    (supabase.storage as any).from = originalFrom;
  }

  const paths = getCapturedPaths();
  assert.equal(paths.length, N);
  assert.equal(new Set(paths).size, N, "los N paths generados deben ser unicos");

  for (const path of paths) {
    assert.match(extractRandomSegment(path), HEX_RANDOM_SEGMENT);
  }
});

test("el path de storage no incorpora informacion sensible mas alla del nombre sanitizado", async () => {
  const originalFrom = supabase.storage.from;
  const { getCapturedPaths } = stubUpload();

  try {
    await uploadReport({
      file: Buffer.from("pdf-content"),
      fileName: "reporte.pdf",
      clinicId: 42,
      mimeType: "application/pdf",
    });
  } finally {
    (supabase.storage as any).from = originalFrom;
  }

  const [result] = getCapturedPaths();
  assert.equal(result!.split("/").length, 3, "clinics/{clinicId}/{filename} debe conservar 3 segmentos");
  assert.ok(result!.startsWith("clinics/42/"));
});

test("supabase-storage-path-randomness guardrail source stays ascii only", () => {
  const source = readFileSync(
    resolve(process.cwd(), "test/unit/infrastructure/supabase-storage-path-randomness.test.ts"),
    "utf8",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `supabase-storage-path-randomness source must stay ascii-only at index ${index}`,
    );
  }
});
