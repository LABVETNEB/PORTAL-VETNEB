import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const featureDir = "server/features/users-roles";
const infrastructureDir = `${featureDir}/infrastructure`;
const repositoryFile =
  `${infrastructureDir}/admin-users-roles-repository.ts`;
const barrelFile = `${infrastructureDir}/index.ts`;
const compositionFile =
  `${featureDir}/admin-users-roles-route-composition.ts`;
const routeFile = "server/routes/admin-users-roles.fastify.ts";
const legacyFile = "server/db-admin-users-roles.ts";
const portFile =
  `${featureDir}/application/ports/admin-users-roles-repository.ts`;

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

function importSpecifiers(source: string) {
  return Array.from(
    source.matchAll(
      /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    ),
    (match) => match[1] ?? match[2],
  );
}

function resolveTarget(file: string, specifier: string) {
  if (!specifier.startsWith(".")) return specifier;
  return relative(root, resolve(root, dirname(file), specifier))
    .replaceAll("\\", "/");
}

test("Users/Roles infrastructure contiene repository, barrel y README canónicos", () => {
  for (const path of [
    infrastructureDir,
    repositoryFile,
    barrelFile,
    `${infrastructureDir}/README.md`,
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }

  assert.equal(
    read(barrelFile).trim(),
    'export * from "./admin-users-roles-repository.ts";',
  );
  assert.equal(existsSync(resolve(root, legacyFile)), false);
});

test("repository implementa exactamente las dos operaciones del puerto", () => {
  const repository = read(repositoryFile);
  const port = read(portFile);
  const repositoryOperations = Array.from(
    repository.matchAll(/export async function (\w+)\s*\(/g),
    (match) => match[1],
  );

  assert.deepEqual(repositoryOperations, [
    "getAdminUsersRolesSnapshot",
    "changeClinicUserRole",
  ]);
  assert.equal(
    (port.match(/getAdminUsersRolesSnapshot:/g) ?? []).length,
    1,
  );
  assert.equal(
    (port.match(/changeClinicUserRole:/g) ?? []).length,
    1,
  );
});

test("infrastructure sólo importa persistencia y barrels Users/Roles autorizados", () => {
  const allowed = new Set([
    "drizzle-orm",
    "server/db.ts",
    "drizzle/schema.ts",
    `${featureDir}/domain/index.ts`,
    `${featureDir}/application/index.ts`,
    "server/lib/list-pagination.ts",
  ]);
  const violations: string[] = [];

  for (const file of walk(infrastructureDir).filter((path) =>
    path.endsWith(".ts"),
  )) {
    for (const specifier of importSpecifiers(read(file))) {
      const target = resolveTarget(file, specifier);
      if (file === barrelFile && target === repositoryFile) continue;
      if (!allowed.has(target)) {
        violations.push(`${file}: ${specifier} -> ${target}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("infrastructure no posee Fastify, HTTP, Auth, Clinics, auditoría ni credenciales", () => {
  const source = walk(infrastructureDir)
    .filter((path) => path.endsWith(".ts"))
    .map(read)
    .join("\n");

  for (const marker of [
    "Fastify",
    "http",
    "authenticate",
    "session",
    "cors",
    "audit",
    "/clinics/",
    "credentials",
    "password",
    "hashPassword",
    "permissions.ts",
  ]) {
    assert.equal(
      source.toLowerCase().includes(marker.toLowerCase()),
      false,
      marker,
    );
  }
});

test("route consume composition y no conoce repository concreto", () => {
  const route = read(routeFile);
  const composition = read(compositionFile);
  const routeTargets = importSpecifiers(route).map((specifier) =>
    resolveTarget(routeFile, specifier),
  );
  const compositionTargets = importSpecifiers(composition).map(
    (specifier) => resolveTarget(compositionFile, specifier),
  );

  assert.ok(routeTargets.includes(compositionFile));
  assert.equal(routeTargets.includes(repositoryFile), false);
  assert.equal(routeTargets.includes(barrelFile), false);
  assert.equal(route.includes("db-admin-users-roles"), false);
  assert.ok(
    compositionTargets.includes(
      `${featureDir}/application/index.ts`,
    ),
  );
  assert.ok(compositionTargets.includes(barrelFile));
  assert.equal(compositionTargets.includes(repositoryFile), false);
});

test("no queda shim, reexport ni import productivo al repository raíz retirado", () => {
  assert.equal(existsSync(resolve(root, legacyFile)), false);

  const consumers = walk("server")
    .filter((path) => path.endsWith(".ts"))
    .filter((path) =>
      importSpecifiers(read(path))
        .map((specifier) => resolveTarget(path, specifier))
        .includes(legacyFile),
    );

  assert.deepEqual(consumers, []);
});
