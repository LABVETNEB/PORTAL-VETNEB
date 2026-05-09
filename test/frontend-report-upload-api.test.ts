import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const API_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend api client keeps multipart FormData content type browser-managed", () => {
  const source = read(API_PATH);

  assert.ok(source.includes("const hasFormDataBody ="));
  assert.ok(source.includes('typeof FormData !== "undefined"'));
  assert.ok(source.includes("options.body instanceof FormData"));
  assert.ok(source.includes("!hasFormDataBody"));
  assert.ok(source.includes('headers.set("Content-Type", "application/json")'));
});

test("frontend api client exposes admin report upload endpoint", () => {
  const source = read(API_PATH);

  assert.ok(source.includes("type AdminReportUploadResponse"));
  assert.ok(source.includes("success: true"));
  assert.ok(source.includes("message: string"));
  assert.ok(source.includes("report: Report"));
  assert.ok(source.includes("export async function uploadAdminReport("));
  assert.ok(source.includes("formData: FormData"));
  assert.ok(source.includes('"/api/admin/reports/upload"'));
  assert.ok(source.includes('method: "POST"'));
  assert.ok(source.includes("body: formData"));
});

test("frontend api client keeps report upload scoped to API layer only", () => {
  const source = read(API_PATH);

  assert.equal(source.includes("UploadReportModal"), false);
  assert.equal(source.includes("document."), false);
  assert.equal(source.includes("window."), false);
});
