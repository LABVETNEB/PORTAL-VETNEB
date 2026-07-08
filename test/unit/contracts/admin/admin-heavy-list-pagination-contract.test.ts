import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const { normalizeListPagination } = await import(
  "../../../../server/lib/list-pagination.ts"
);

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("normalizeListPagination aplica defaults conservadores", () => {
  assert.deepEqual(normalizeListPagination(undefined), {
    limit: 50,
    offset: 0,
  });
});

test("normalizeListPagination clampa max limit y offset", () => {
  assert.deepEqual(
    normalizeListPagination({
      limit: 999,
      offset: 999_999,
    }),
    {
      limit: 100,
      offset: 100_000,
    },
  );
});

test("normalizeListPagination normaliza limit y offset inválidos", () => {
  assert.deepEqual(
    normalizeListPagination({
      limit: Number.NaN,
      offset: -5,
    }),
    {
      limit: 50,
      offset: 0,
    },
  );
});

test("listadores backend compartidos normalizan paginación antes de consultar", () => {
  const files = [
    "server/db-particular.ts",
    "server/db-report-access.ts",
    "server/db-study-tracking.ts",
    "server/db-report-workflow.ts",
    "server/db-admin-clinics.ts",
    "server/db-admin-failed-login-alerts.ts",
  ];

  for (const file of files) {
    const source = readSource(file);
    assert.match(source, /normalizeListPagination\(/, file);
    assert.match(source, /\.limit\(limit\)[\s\S]*\.offset\(offset\)/, file);
  }

  const sessionsSource = readSource("server/db-admin-sessions.ts");
  assert.match(sessionsSource, /normalizeListPagination\(/);
  assert.match(sessionsSource, /const fetchLimit = limit \+ offset/);
  assert.match(sessionsSource, /\.limit\(fetchLimit\)/);
});

test("admin users roles pagina consultas DB antes de combinar resultados", () => {
  const source = readSource("server/db-admin-users-roles.ts");

  assert.match(
    source,
    /\.from\(adminUsers\)[\s\S]*\.limit\(adminLimit\)[\s\S]*\.offset\(adminOffset\)/,
  );
  assert.match(
    source,
    /\.from\(clinicUsers\)[\s\S]*\.limit\(clinicLimit\)[\s\S]*\.offset\(clinicOffset\)/,
  );
  assert.match(source, /total: adminTotal \+ clinicTotal/);
});
