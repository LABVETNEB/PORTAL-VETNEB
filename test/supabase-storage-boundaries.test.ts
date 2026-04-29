import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SUPABASE_SOURCE_PATH = "server/lib/supabase.ts";
const source = readFileSync(resolve(process.cwd(), SUPABASE_SOURCE_PATH), "utf8")
  .replace(/\r\n/g, "\n");

function extractExportedFunction(functionName: string): string {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);

  assert.notEqual(start, -1, `${functionName} debe existir en ${SUPABASE_SOURCE_PATH}`);

  const next = source.indexOf("\nexport async function ", start + marker.length);

  return source.slice(start, next === -1 ? source.length : next);
}

test("storage boundaries mantienen bucket privado y no exponen public URLs", () => {
  assert.match(
    source,
    /createBucket\(ENV\.supabaseStorageBucket,\s*\{\s*public:\s*false,\s*\}\)/s,
  );
  assert.equal(source.includes("public: true"), false);
  assert.equal(source.includes("getPublicUrl"), false);
  assert.equal(source.includes("createPublicUrl"), false);
});

test("storage boundaries generan signed URLs sólo con TTL configurado por ENV", () => {
  const createSignedStorageUrlSource = extractExportedFunction(
    "createSignedStorageUrl",
  );
  const createSignedReportDownloadUrlSource = extractExportedFunction(
    "createSignedReportDownloadUrl",
  );

  assert.match(
    createSignedStorageUrlSource,
    /\.createSignedUrl\(storagePath,\s*ENV\.signedUrlExpiresInSeconds\)/,
  );
  assert.match(
    createSignedReportDownloadUrlSource,
    /\.createSignedUrl\(storagePath,\s*ENV\.signedUrlExpiresInSeconds,\s*\{/,
  );
  assert.equal(createSignedStorageUrlSource.includes("getPublicUrl"), false);
  assert.equal(createSignedReportDownloadUrlSource.includes("getPublicUrl"), false);
});

test("storage boundaries suben archivos con storage path privado y upsert deshabilitado", () => {
  const uploadReportSource = extractExportedFunction("uploadReport");
  const uploadClinicAvatarSource = extractExportedFunction("uploadClinicAvatar");

  for (const functionSource of [uploadReportSource, uploadClinicAvatarSource]) {
    assert.match(functionSource, /\.upload\(storagePath,\s*file,\s*\{/);
    assert.match(functionSource, /contentType:\s*mimeType/);
    assert.match(functionSource, /upsert:\s*false/);
    assert.match(functionSource, /return storagePath;/);
    assert.equal(functionSource.includes("signedUrl"), false);
    assert.equal(functionSource.includes("getPublicUrl"), false);
    assert.equal(functionSource.includes("return data"), false);
  }
});

test("storage boundaries sanitizan nombres antes de construir paths persistibles", () => {
  assert.match(source, /function sanitizeFileName\(fileName: string, fallback: string\)/);
  assert.match(source, /\.replace\(\/\\\.\+\/g,\s*"\."\)/);
  assert.match(source, /\.replace\(\/\^\[\._-\]\+\|\[\._-\]\+\$\/g,\s*""\)/);
  assert.match(source, /return sanitized \|\| fallback;/);
  assert.match(source, /sanitizeFileName\(fileName,\s*"report"\)/);
  assert.match(source, /sanitizeFileName\(fileName,\s*"avatar"\)/);
});
