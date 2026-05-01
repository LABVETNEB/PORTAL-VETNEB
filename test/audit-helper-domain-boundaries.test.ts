import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("audit helper domain split mantiene archivos esperados", () => {
  assert.deepEqual(
    [
      "server/lib/audit-log.ts",
      "server/lib/admin-audit.ts",
      "server/lib/clinic-audit.ts",
      "server/lib/particular-audit.ts",
    ].map((file) => [file, existsSync(resolve(process.cwd(), file))]),
    [
      ["server/lib/audit-log.ts", true],
      ["server/lib/admin-audit.ts", true],
      ["server/lib/clinic-audit.ts", true],
      ["server/lib/particular-audit.ts", true],
    ],
  );
});

test("audit-log core conserva helpers neutrales compartidos", () => {
  const source = readSource("server/lib/audit-log.ts");

  assert.match(source, /export const AUDIT_ACTOR_TYPES/);
  assert.match(source, /export const AUDIT_EVENTS/);
  assert.match(source, /export type AuditListFilters/);
  assert.match(source, /export function buildAuditListFilters/);
  assert.match(source, /export function buildClinicAuditListFilters/);
  assert.match(source, /export function buildParticularAuditListFilters/);
  assert.match(source, /export function buildAuditCsv/);
  assert.match(source, /export function buildGlobalAuditCsvFilename/);

  assert.doesNotMatch(source, /export function buildAdminAuditListFilters/);
  assert.doesNotMatch(source, /export function buildAdminAuditCsv/);
});

test("admin-audit facade preserva contrato legacy sin duplicar implementación", () => {
  const source = readSource("server/lib/admin-audit.ts");

  assert.match(source, /from "\.\/audit-log\.ts"/);
  assert.match(source, /AUDIT_ACTOR_TYPES as ADMIN_AUDIT_ACTOR_TYPES/);
  assert.match(source, /AUDIT_EVENTS as ADMIN_AUDIT_EVENTS/);
  assert.match(source, /buildAuditListFilters as buildAdminAuditListFilters/);
  assert.match(source, /buildAuditCsv as buildAdminAuditCsv/);
  assert.match(
    source,
    /buildGlobalAuditCsvFilename as buildAdminAuditCsvFilename/,
  );
  assert.doesNotMatch(source, /function parsePositiveInt|function escapeCsvCell/);
});

test("clinic y particular audit routes consumen facades de su dominio", () => {
  const clinicRoute = readSource("server/routes/clinic-audit.fastify.ts");
  const particularRoute = readSource("server/routes/particular-audit.fastify.ts");

  assert.match(clinicRoute, /from "\.\.\/lib\/clinic-audit\.ts"/);
  assert.match(particularRoute, /from "\.\.\/lib\/particular-audit\.ts"/);

  assert.doesNotMatch(clinicRoute, /from "\.\.\/lib\/admin-audit\.ts"/);
  assert.doesNotMatch(particularRoute, /from "\.\.\/lib\/admin-audit\.ts"/);
});

test("db audit usa tipos y serialización del core neutral", () => {
  const source = readSource("server/db-audit.ts");

  assert.match(source, /from "\.\/lib\/audit-log\.ts"/);
  assert.match(source, /AuditListFilters/);
  assert.match(source, /serializeAuditLogListItem/);
  assert.doesNotMatch(source, /AdminAuditListFilters/);
  assert.doesNotMatch(source, /from "\.\/lib\/admin-audit/);
});
