import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const domainDir = "server/features/users-roles/domain";
const applicationDir = "server/features/users-roles/application";
const domainTestDir = "test/unit/domain/users-roles";
const applicationTestDir = "test/unit/application/users-roles";
const self = "users-roles-suite-completeness.test.ts";

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function names(path: string, suffix: string) {
  return readdirSync(join(root, path), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => entry.name.slice(0, -suffix.length))
    .sort();
}

test("cada módulo productivo de domain y application tiene test correlativo", () => {
  const domainModules = names(domainDir, ".ts").filter(
    (name) => name !== "index",
  );
  const domainTests = names(domainTestDir, ".test.ts");
  const applicationModules = names(applicationDir, ".ts").filter(
    (name) => name !== "index",
  );
  const applicationTests = names(applicationTestDir, ".test.ts").filter(
    (name) => `${name}.test.ts` !== self,
  );

  assert.deepEqual(domainTests, domainModules);
  assert.deepEqual(applicationTests, applicationModules);
});

test("los barrels cubren todos los módulos y puertos", () => {
  const domainIndex = read(`${domainDir}/index.ts`);
  const applicationIndex = read(`${applicationDir}/index.ts`);
  const portsIndex = read(`${applicationDir}/ports/index.ts`);

  for (const module of names(domainDir, ".ts").filter(
    (name) => name !== "index",
  )) {
    assert.match(domainIndex, new RegExp(`\\./${module}\\.ts`));
  }
  for (const module of names(applicationDir, ".ts").filter(
    (name) => name !== "index",
  )) {
    assert.match(applicationIndex, new RegExp(`\\./${module}\\.ts`));
  }
  for (const port of names(`${applicationDir}/ports`, ".ts").filter(
    (name) => name !== "index",
  )) {
    assert.match(portsIndex, new RegExp(`\\./${port}\\.ts`));
  }
});

test("cada puerto tiene consumidor y los casos de uso públicos tienen test", () => {
  const useCaseFile =
    `${applicationDir}/admin-users-roles-use-cases.ts`;
  const useCaseSource = read(useCaseFile);
  const testSource = read(
    `${applicationTestDir}/admin-users-roles-use-cases.test.ts`,
  );

  assert.match(
    useCaseSource,
    /ports\/admin-users-roles-repository\.ts/,
  );
  for (const operation of [
    "listAdminUsersRoles",
    "changeClinicUserRole",
  ]) {
    assert.match(useCaseSource, new RegExp(`\\b${operation}\\b`));
    assert.match(testSource, new RegExp(`\\b${operation}\\b`));
  }
});

test("Users/Roles no duplica el endpoint de credenciales", () => {
  const productionSources = [
    ...names(domainDir, ".ts")
      .map((name) => `${domainDir}/${name}.ts`),
    ...names(applicationDir, ".ts")
      .map((name) => `${applicationDir}/${name}.ts`),
    ...names(`${applicationDir}/ports`, ".ts")
      .map((name) => `${applicationDir}/ports/${name}.ts`),
  ].map(read).join("\n");

  assert.doesNotMatch(
    productionSources,
    /credentials|password|hashPassword|updateAdminClinicUserCredentials/i,
  );
});
