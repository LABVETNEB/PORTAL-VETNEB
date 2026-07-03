import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const INFORMES_LIST_PATH =
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const CLINIC_TOKENS_CARD_PATH =
  "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx";
const PARTICULARES_CONTENT_PATH =
  "frontend/src/components/public/ParticularesContent.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const ADMIN_AUDIT_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminAuditCard.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("notification click targets render stable clinic, particular, and admin anchors", () => {
  const informesList = read(INFORMES_LIST_PATH);
  const clinicTokensCard = read(CLINIC_TOKENS_CARD_PATH);
  const particularesContent = read(PARTICULARES_CONTENT_PATH);
  const adminPage = read(ADMIN_PAGE_PATH);
  const adminAuditCard = read(ADMIN_AUDIT_CARD_PATH);

  assert.ok(
    informesList.includes("id={`report-${report.id}`}"),
    "clinic informes rows must expose report-{id} anchors",
  );
  assert.ok(
    clinicTokensCard.includes('id="clinic-particular-tokens"'),
    "clinic token section anchor must remain present",
  );
  assert.ok(
    clinicTokensCard.includes("id={`clinic-particular-token-${token.id}`}"),
    "clinic token cards must expose clinic-particular-token-{id} anchors",
  );
  assert.ok(
    particularesContent.includes('id="particular-study-tracking"'),
    "particular study tracking block must expose its anchor",
  );
  assert.ok(
    particularesContent.includes('id="particular-report"'),
    "particular linked report block must expose its anchor",
  );
  assert.ok(
    adminPage.includes('id="admin-particular-tokens"'),
    "admin particular token section anchor must exist",
  );
  assert.ok(
    adminAuditCard.includes('id="admin-notifications"'),
    "admin notifications section anchor must exist",
  );
});
