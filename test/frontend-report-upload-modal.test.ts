import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const UPLOAD_MODAL_PATH = "frontend/src/components/dashboard/UploadReportModal.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend upload report modal remains available as admin-only implementation", () => {
  assert.equal(existsSync(resolve(process.cwd(), UPLOAD_MODAL_PATH)), true);

  const source = read(UPLOAD_MODAL_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("uploadAdminReport"));
  assert.ok(source.includes("getAdminUsersRoles"));
  assert.ok(source.includes("getAdminParticularTokens"));
  assert.ok(source.includes("createAdminStudyTrackingCase"));
  assert.ok(source.includes("uploadAdminReport"));
});

test("frontend informes page does not expose admin upload modal in clinic dashboard", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.equal(source.includes('import { UploadReportModal } from "@/components/dashboard/UploadReportModal"'), false);
  assert.equal(source.includes("<UploadReportModal />"), false);
  assert.ok(source.includes("Lectura clinic-scoped conectada a"));
  assert.ok(source.includes("dashboard administrador"));
});

