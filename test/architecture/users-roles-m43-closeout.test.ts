import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const featureDir = "server/features/users-roles";
const compositionFile =
  `${featureDir}/admin-users-roles-route-composition.ts`;
const repositoryFile =
  `${featureDir}/infrastructure/admin-users-roles-repository.ts`;
const routeFile = "server/routes/admin-users-roles.fastify.ts";
const legacyFile = "server/db-admin-users-roles.ts";
const permissionsFile = "server/lib/permissions.ts";
const closeoutFile =
  "docs/implementation/m43-users-roles-repository-thin-route-closeout.md";

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function walk(path: string): string[] {
  return readdirSync(resolve(root, path), { withFileTypes: true })
    .flatMap((entry) => {
      const child = `${path}/${entry.name}`;
      return entry.isDirectory() ? walk(child) : [child];
    })
    .sort();
}

test("M43 materializa composition e infrastructure y retira el repository raíz", () => {
  for (const path of [
    compositionFile,
    repositoryFile,
    `${featureDir}/infrastructure/index.ts`,
    `${featureDir}/infrastructure/README.md`,
    closeoutFile,
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }

  assert.equal(existsSync(resolve(root, legacyFile)), false);
});

test("composition conserva laziness, singleton y composición única de use cases", () => {
  const source = read(compositionFile);

  assert.equal(
    (source.match(/\blet defaultDepsPromise\b/g) ?? []).length,
    1,
  );
  assert.match(source, /if \(!defaultDepsPromise\)/);
  assert.match(source, /import\("\.\/infrastructure\/index\.ts"\)/);
  assert.equal(
    (source.match(/createAdminUsersRolesUseCases\s*\(/g) ?? []).length,
    1,
  );
  assert.match(source, /createAdminUsersRolesRouteComposition/);
  assert.match(source, /options\.getAdminUsersRolesSnapshot/);
  assert.match(source, /options\.changeClinicUserRole/);
  assert.match(source, /options\.updateAdminClinicUserCredentials/);

  for (const forbidden of [
    'from "fastify"',
    "drizzle-orm",
    "permissions.ts",
    "app.get(",
    "app.patch(",
    "app.options(",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("AdminUsersRolesNativeRoutesOptions conserva su superficie pública", () => {
  const route = read(routeFile);
  const composition = read(compositionFile);

  assert.match(
    route,
    /export type AdminUsersRolesNativeRoutesOptions\s*=\s*[\s\S]*AdminUsersRolesRouteCompositionOptions/,
  );
  for (const option of [
    "deleteAdminSession",
    "getAdminSessionWithUser",
    "updateAdminSessionLastAccess",
    "hashSessionToken",
    "getAdminUsersRolesSnapshot",
    "changeClinicUserRole",
    "updateAdminClinicUserCredentials",
    "hashPassword",
    "writeAuditLog",
    "now",
  ]) {
    assert.match(composition, new RegExp(`\\b${option}\\?`), option);
  }
});

test("route registra los seis endpoints en el orden contractual", () => {
  const source = read(routeFile);
  const markers = [
    'app.options("/", optionsHandler)',
    'app.options("/clinic/:clinicUserId/role", optionsHandler)',
    'app.options("/clinic/:clinicUserId/credentials", optionsHandler)',
    "app.get<{ Querystring: AdminUsersRolesRequestQuery }>",
    "app.patch<{",
    '}>("/clinic/:clinicUserId/role", async (request, reply) => {',
    "app.patch<{",
    '}>("/clinic/:clinicUserId/credentials", async (request, reply) => {',
  ];
  let cursor = -1;

  for (const marker of markers) {
    const next = source.indexOf(marker, cursor + 1);
    assert.ok(next > cursor, marker);
    cursor = next;
  }
});

test("route es thin y delega en composition sin repository concreto", () => {
  const source = read(routeFile);

  assert.match(source, /createAdminUsersRolesRouteComposition\(options\)/);
  assert.match(
    source,
    /usersRolesUseCases\.listAdminUsersRoles\(params\)/,
  );
  assert.match(
    source,
    /usersRolesUseCases\.changeClinicUserRole\(\{/,
  );
  for (const forbidden of [
    "defaultDepsPromise",
    "loadDefaultDeps",
    "createAdminUsersRolesUseCases",
    "db-admin-users-roles",
    "admin-users-roles-repository",
    "/infrastructure/",
    "drizzle-orm",
    "updateAdminClinicUserCredentialsCommand",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("domain, application e infrastructure no poseen credenciales ni permisos", () => {
  const source = [
    ...walk(`${featureDir}/domain`),
    ...walk(`${featureDir}/application`),
    ...walk(`${featureDir}/infrastructure`),
  ]
    .filter((path) => path.endsWith(".ts"))
    .map(read)
    .join("\n");

  assert.doesNotMatch(
    source,
    /credentials|password|passwordHash|hashPassword/i,
  );
  assert.doesNotMatch(
    source,
    /lib\/permissions\.ts|getClinicPermissions|ClinicPermissions/,
  );
  assert.equal(existsSync(resolve(root, permissionsFile)), true);
});

test("closeout M43 declara cierre de Fase J sin inventar estado Git", () => {
  const source = read(closeoutFile);

  for (const marker of [
    "M43 — Users/Roles repository + thin-route closeout",
    "da73eb1291bc89b4ec505d22e337b173dd01219e",
    "M43: cerrado",
    "Fase J",
    "Git/GitHub",
    "Rollback",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
  assert.doesNotMatch(source, /M43:\s*`?NOT_RUN`?/);
});
