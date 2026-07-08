import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DESTINATIONS_PATH = "frontend/src/lib/notification-destinations.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);

  return source.slice(startIndex, endIndex);
}

test("buildNotificationDestination uses ROUTES and exposes a pure destination helper", () => {
  const source = read(DESTINATIONS_PATH);

  assert.ok(source.includes('import { ROUTES } from "./routes";'));
  assert.ok(source.includes("export function buildNotificationDestination("));
  assert.ok(source.includes("function isTrackingNotification("));
  assert.ok(source.includes("function isReportNotification("));
  assert.equal(source.includes("window."), false);
  assert.equal(source.includes("router."), false);
});

test("buildNotificationDestination admin routes tracking/report notifications to report upload workflow", () => {
  const source = read(DESTINATIONS_PATH);
  const adminCase = sectionBetween(source, 'case "admin":', 'case "clinic":');

  assert.ok(adminCase.includes("isTrackingNotification(notification)"));
  assert.ok(adminCase.includes("notification.reportId"));
  assert.ok(
    adminCase.includes(
      "`${ROUTES.dashboardAdmin}?module=admin-report-upload${",
    ),
  );
  assert.ok(adminCase.includes("`#report-${notification.reportId}`"));
  assert.ok(
    adminCase.includes(
      "`${ROUTES.dashboardAdmin}?module=admin-particular-tokens#admin-particular-token-${notification.particularTokenId}`",
    ),
  );
  assert.ok(
    adminCase.includes("`${ROUTES.dashboardAdmin}?module=audit-log`"),
  );
});

test("buildNotificationDestination clinic routes report ids and token ids to anchors", () => {
  const source = read(DESTINATIONS_PATH);
  const clinicCase = sectionBetween(
    source,
    'case "clinic":',
    'case "particular":',
  );

  assert.ok(clinicCase.includes("if (notification.reportId)"));
  assert.ok(
    clinicCase.includes(
      "`${ROUTES.dashboardInformes}#report-${notification.reportId}`",
    ),
  );
  assert.ok(clinicCase.includes("if (notification.particularTokenId)"));
  assert.ok(
    clinicCase.includes(
      "`${ROUTES.dashboard}#clinic-particular-token-${notification.particularTokenId}`",
    ),
  );
  assert.ok(
    clinicCase.includes(
      "if (isTrackingNotification(notification) || isReportNotification(notification))",
    ),
  );
  assert.ok(clinicCase.includes("return ROUTES.dashboardInformes;"));
  assert.ok(clinicCase.includes("return ROUTES.dashboard;"));
});

test("buildNotificationDestination particular routes report and study tracking notifications", () => {
  const source = read(DESTINATIONS_PATH);
  const particularCase = sectionBetween(source, 'case "particular":', "\n  }\n}");

  assert.ok(particularCase.includes("if (notification.reportId)"));
  assert.ok(
    particularCase.includes("`${ROUTES.particulares}#particular-report`"),
  );
  assert.ok(
    particularCase.includes(
      "notification.particularTokenId || notification.studyTrackingCaseId",
    ),
  );
  assert.ok(
    particularCase.includes(
      "`${ROUTES.particulares}#particular-study-tracking`",
    ),
  );
  assert.ok(particularCase.includes("return ROUTES.particulares;"));
});

test("admin notification destinations use the ?module= contract with valid module ids", () => {
  const source = read(DESTINATIONS_PATH);
  const controller = read(
    "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx",
  );
  const adminCase = sectionBetween(source, 'case "admin":', 'case "clinic":');

  const adminModuleIds = [...adminCase.matchAll(/\?module=([a-z-]+)/g)].map(
    (match) => match[1],
  );

  assert.ok(adminModuleIds.includes("admin-report-upload"));
  assert.ok(adminModuleIds.includes("admin-particular-tokens"));
  assert.ok(adminModuleIds.includes("audit-log"));

  for (const moduleId of adminModuleIds) {
    assert.ok(
      controller.includes(`"${moduleId}"`),
      `notification module ${moduleId} must be a valid admin module`,
    );
  }
});

test("notification destinations stay internal and keep clinic/particular anchors", () => {
  const source = read(DESTINATIONS_PATH);
  const clinicCase = sectionBetween(
    source,
    'case "clinic":',
    'case "particular":',
  );

  assert.ok(clinicCase.includes("#report-${notification.reportId}"));
  assert.ok(
    clinicCase.includes(
      "#clinic-particular-token-${notification.particularTokenId}",
    ),
  );

  assert.equal(
    /https?:\/\//.test(source),
    false,
    "notification destinations must stay internal (no external URLs)",
  );
});
