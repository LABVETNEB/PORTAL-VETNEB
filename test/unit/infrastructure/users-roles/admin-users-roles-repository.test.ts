import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repositoryFile =
  "server/features/users-roles/infrastructure/admin-users-roles-repository.ts";
const portFile =
  "server/features/users-roles/application/ports/admin-users-roles-repository.ts";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function importSpecifiers(source: string) {
  return Array.from(
    source.matchAll(
      /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    ),
    (match) => match[1] ?? match[2],
  );
}

test("repository Users/Roles implementa exactamente las dos operaciones del puerto", () => {
  const repository = read(repositoryFile);
  const port = read(portFile);

  assert.deepEqual(
    Array.from(
      repository.matchAll(
        /export async function (\w+)\s*\(/g,
      ),
      (match) => match[1],
    ),
    ["getAdminUsersRolesSnapshot", "changeClinicUserRole"],
  );
  assert.equal(
    (port.match(/getAdminUsersRolesSnapshot:/g) ?? []).length,
    1,
  );
  assert.equal(
    (port.match(/changeClinicUserRole:/g) ?? []).length,
    1,
  );
});

test("repository conserva imports canónicos y no asume ownership HTTP, Auth o Clinics", () => {
  const source = read(repositoryFile);

  assert.deepEqual(importSpecifiers(source), [
    "drizzle-orm",
    "../../../db.ts",
    "../../../../drizzle/schema.ts",
    "../domain/index.ts",
    "../application/index.ts",
    "../../../lib/list-pagination.ts",
  ]);

  for (const marker of [
    "fastify",
    "FastifyRequest",
    "FastifyReply",
    "/routes/",
    "auth-security",
    "/clinics/",
    "credentials",
    "password",
    "hashPassword",
    "permissions.ts",
  ]) {
    assert.equal(source.toLowerCase().includes(marker.toLowerCase()), false, marker);
  }
});

test("snapshot conserva búsqueda ilike, filtros, counts y paginación combinada", () => {
  const source = read(repositoryFile);

  for (const marker of [
    "normalizeListPagination(params)",
    "ilike(adminUsers.username, `%${search}%`)",
    "ilike(clinicUsers.username, `%${search}%`)",
    "ilike(clinics.name, `%${search}%`)",
    "clinicFilters.push(eq(clinicUsers.role, params.role))",
    "and(...clinicFilters)",
    "sql<number>`count(*)::int`",
    "const [adminCountRows, clinicCountRows] = await Promise.all",
    "const [adminRows, clinicRows] = await Promise.all",
    ".limit(adminLimit)",
    ".offset(adminOffset)",
    ".limit(clinicLimit)",
    ".offset(clinicOffset)",
    "total: adminTotal + clinicTotal",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

test("cambio de rol conserva guard del último owner y el límite transaccional existente", () => {
  const source = read(repositoryFile);
  const start = source.indexOf(
    "export async function changeClinicUserRole(",
  );
  assert.ok(start >= 0);
  const changeRole = source.slice(start);

  assert.equal(
    changeRole.match(/\.transaction\s*\(/g)?.length ?? 0,
    0,
    "el baseline M43 no envolvía el cambio de rol en una transacción",
  );
  for (const marker of [
    'reason: "not_found"',
    'current.role === "clinic_owner"',
    'input.role === "clinic_staff"',
    'eq(clinicUsers.role, "clinic_owner")',
    "ne(clinicUsers.id, input.clinicUserId)",
    'reason: "last_clinic_owner"',
    "roleChanged: false",
    "updatedAt: input.now ?? new Date()",
    "roleChanged: true",
  ]) {
    assert.ok(changeRole.includes(marker), marker);
  }
});
