import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";

const root = process.cwd();
const applicationDir = "server/features/users-roles/application";
const routeFile = "server/routes/admin-users-roles.fastify.ts";

function read(path: string) {
  return readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");
}

function walk(path: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) files.push(...walk(child));
    if (entry.isFile() && entry.name.endsWith(".ts")) files.push(child);
  }
  return files.sort();
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
  return relative(root, join(root, dirname(file), specifier))
    .replaceAll("\\", "/");
}

test("Users/Roles application sólo depende de domain/index y de sí misma", () => {
  const violations: string[] = [];

  for (const file of walk(applicationDir)) {
    const source = read(file);
    for (const specifier of importSpecifiers(source)) {
      const target = resolveTarget(file, specifier);
      const allowed =
        target.startsWith(`${applicationDir}/`) ||
        target === "server/features/users-roles/domain/index.ts";
      if (!allowed) violations.push(`${file}: ${specifier} -> ${target}`);
    }

    for (const marker of [
      "fastify",
      "drizzle",
      "server/db",
      "server/lib",
      "Audit",
      "audit",
      "auth",
      "Cors",
      "CORS",
      "hash",
      "session",
      "fetch(",
      "process.",
    ]) {
      if (source.includes(marker)) violations.push(`${file}: ${marker}`);
    }
  }

  assert.deepEqual(violations, []);
});

test("el puerto Users/Roles es mínimo y cada operación tiene caso de uso", () => {
  const port = read(
    `${applicationDir}/ports/admin-users-roles-repository.ts`,
  );
  const useCases = read(
    `${applicationDir}/admin-users-roles-use-cases.ts`,
  );

  assert.equal(
    (port.match(/getAdminUsersRolesSnapshot:/g) ?? []).length,
    1,
  );
  assert.equal((port.match(/changeClinicUserRole:/g) ?? []).length, 1);
  assert.equal(
    (port.match(/Promise</g) ?? []).length,
    2,
  );
  assert.match(useCases, /listAdminUsersRoles:/);
  assert.match(useCases, /repository\.getAdminUsersRolesSnapshot\(query\)/);
  assert.match(useCases, /repository\.changeClinicUserRole\(input\)/);
});

test("la factory pública tiene consumidor productivo y los handlers delegan", () => {
  const index = read(`${applicationDir}/index.ts`);
  const route = read(routeFile);

  assert.match(index, /createAdminUsersRolesUseCases/);
  assert.equal(
    (route.match(/createAdminUsersRolesUseCases\s*\(/g) ?? []).length,
    1,
  );
  assert.match(
    route,
    /usersRolesUseCases\.listAdminUsersRoles\(params\)/,
  );
  assert.match(
    route,
    /usersRolesUseCases\.changeClinicUserRole\(\{/,
  );
  assert.doesNotMatch(route, /deps\.getAdminUsersRolesSnapshot\(/);
  assert.doesNotMatch(route, /deps\.changeClinicUserRole\(/);
});

test("credenciales siguen en Clinics y M43 no fue anticipado", () => {
  const route = read(routeFile);
  const featureSource = walk("server/features/users-roles")
    .map(read)
    .join("\n");

  assert.match(route, /updateAdminClinicUserCredentialsCommand\(/);
  assert.match(
    route,
    /features\/clinics\/admin-clinics-command-service\.ts/,
  );
  assert.doesNotMatch(featureSource, /Credentials|password|passwordHash/);
  assert.equal(
    existsSync(join(root, "server/features/users-roles/infrastructure")),
    false,
  );
  assert.equal(existsSync(join(root, "server/db-admin-users-roles.ts")), true);
  assert.doesNotMatch(featureSource, /\b(?:compat|legacy|shim)\b/i);
});
