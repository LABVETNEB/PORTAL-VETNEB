import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("getAdminUsersRolesSnapshot filtra por search usando ilike parametrizado (sin concatenar SQL crudo)", () => {
  const source = read(
    "server/features/users-roles/infrastructure/admin-users-roles-repository.ts",
  );

  assert.ok(
    source.includes("ilike(adminUsers.username, `%${search}%`)"),
    "debe filtrar admin users por username con ilike",
  );
  assert.ok(
    source.includes("ilike(clinicUsers.username, `%${search}%`)"),
    "debe filtrar clinic users por username con ilike",
  );
  assert.ok(
    source.includes("ilike(clinics.name, `%${search}%`)"),
    "debe filtrar clinic users por nombre de clínica con ilike",
  );

  assert.equal(
    /db\.execute\s*\(\s*`/.test(source) || /sql\.raw\(/.test(source),
    false,
    "no debe construir SQL crudo/raw para el filtro de búsqueda",
  );
});

test("search vacío o undefined equivale a no aplicar filtro (normalizeSearch)", () => {
  const source = read(
    "server/features/users-roles/infrastructure/admin-users-roles-repository.ts",
  );

  const fnStart = source.indexOf("function normalizeSearch(");
  assert.ok(fnStart >= 0, "normalizeSearch debe existir");

  const fnEnd = source.indexOf("\n}\n", fnStart) + 3;
  const fn = source.slice(fnStart, fnEnd);

  assert.ok(fn.includes(".trim()"), "normalizeSearch debe hacer trim()");
  assert.ok(
    fn.includes("trimmed || undefined"),
    "un search vacío tras trim debe normalizarse a undefined",
  );
});

test("search compone (AND) con el filtro de role existente para clinic users", () => {
  const source = read(
    "server/features/users-roles/infrastructure/admin-users-roles-repository.ts",
  );

  const fnStart = source.indexOf(
    "export async function getAdminUsersRolesSnapshot(",
  );
  assert.ok(fnStart >= 0);
  const fnEnd = source.indexOf(
    "\nexport async function changeClinicUserRole(",
  );
  const fnBody = source.slice(fnStart, fnEnd);

  assert.ok(
    fnBody.includes("clinicFilters.push(eq(clinicUsers.role, params.role))"),
    "debe seguir empujando el filtro de role cuando aplica",
  );
  const normalizedFnBody = fnBody.replace(/\s+/g, " ");
  assert.ok(
    normalizedFnBody.includes(
      "or( ilike(clinicUsers.username, `%${search}%`), ilike(clinics.name, `%${search}%`), )",
    ),
    "debe empujar el filtro de search (OR username/clinicName) junto al de role",
  );
  assert.ok(
    fnBody.includes("clinicFilters.length > 0 ? and(...clinicFilters) : undefined"),
    "debe combinar los filtros de clinic con and() cuando hay más de uno",
  );
});

test("search se aplica tanto al conteo (total/totalPages) como al listado paginado", () => {
  const source = read(
    "server/features/users-roles/infrastructure/admin-users-roles-repository.ts",
  );

  const fnStart = source.indexOf(
    "export async function getAdminUsersRolesSnapshot(",
  );
  const fnEnd = source.indexOf(
    "\nexport async function changeClinicUserRole(",
  );
  const fnBody = source.slice(fnStart, fnEnd);

  const adminSearchWhereUsages = (
    fnBody.match(/\.where\(adminSearchWhere\)/g) ?? []
  ).length;
  assert.ok(
    adminSearchWhereUsages >= 2,
    "adminSearchWhere debe aplicarse tanto al count como al select paginado de adminUsers",
  );

  const clinicWhereUsages = (fnBody.match(/\.where\(clinicWhere\)/g) ?? [])
    .length;
  assert.ok(
    clinicWhereUsages >= 2,
    "clinicWhere (role + search) debe aplicarse tanto al count como al select paginado de clinicUsers",
  );

  assert.ok(
    fnBody.includes(
      ".leftJoin(clinics, eq(clinics.id, clinicUsers.clinicId))",
    ),
    "el conteo de clinicUsers debe unirse con clinics para poder filtrar por nombre de clínica",
  );
});

test("AdminUsersRolesQuery expone search opcional sin romper el shape existente", () => {
  const source = read(
    "server/features/users-roles/application/ports/admin-users-roles-repository.ts",
  );

  const typeStart = source.indexOf("export type AdminUsersRolesQuery = {");
  const typeEnd = source.indexOf("};", typeStart) + 2;
  const typeBody = source.slice(typeStart, typeEnd);

  assert.ok(typeBody.includes("userType?: AdminRoleUserType;"));
  assert.ok(typeBody.includes("role?: AdminRoleUserRole;"));
  assert.ok(typeBody.includes("limit?: number;"));
  assert.ok(typeBody.includes("offset?: number;"));
  assert.ok(typeBody.includes("search?: string;"));
});

test("la ruta acepta search como query param opcional y lo normaliza con trim", () => {
  const source = read("server/routes/admin-users-roles.fastify.ts");

  assert.ok(
    source.includes("search?: string;"),
    "AdminUsersRolesRequestQuery debe declarar search opcional",
  );

  const fnStart = source.indexOf("function parseSearchParam(");
  assert.ok(fnStart >= 0, "parseSearchParam debe existir");
  const fnEnd = source.indexOf("\n}\n", fnStart) + 3;
  const fn = source.slice(fnStart, fnEnd);

  assert.ok(fn.includes(".trim()"));
  assert.ok(fn.includes("trimmed || undefined"));

  assert.ok(
    source.includes("const search = parseSearchParam(query.search);"),
    "parseUsersRolesQuery debe invocar parseSearchParam",
  );
  assert.ok(
    source.includes("...(search ? { search } : {}),"),
    "search sólo debe incluirse en la query cuando está presente",
  );
});
