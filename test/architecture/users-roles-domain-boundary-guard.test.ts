import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const domainDir = "server/features/users-roles/domain";
const domainIndex = `${domainDir}/index.ts`;

function read(path: string) {
  return readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");
}

function domainTsFiles() {
  return readdirSync(join(root, domainDir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => `${domainDir}/${entry.name}`)
    .sort();
}

function importSpecifiers(source: string) {
  return Array.from(
    source.matchAll(
      /\b(?:from|import)\s*(?:\(\s*)?["']([^"']+)["']\s*\)?/g,
    ),
    (match) => match[1],
  );
}

test("Users/Roles domain tiene inventario y barrel exactos", () => {
  assert.deepEqual(domainTsFiles(), [
    domainIndex,
    `${domainDir}/user-role-policy.ts`,
  ]);

  const index = read(domainIndex);
  assert.equal(
    importSpecifiers(index).join(","),
    "./user-role-policy.ts",
  );
  for (const symbol of [
    "ADMIN_ROLE_USER_TYPES",
    "ADMIN_ROLE_USER_ROLES",
    "ADMIN_CLINIC_USER_ROLES",
    "parseAdminRoleUserType",
    "parseAdminRoleUserRole",
    "parseAdminClinicUserRole",
  ]) {
    assert.match(index, new RegExp(`\\b${symbol}\\b`));
  }
});

test("Users/Roles domain permanece puro y determinístico", () => {
  const violations: string[] = [];
  const forbidden = [
    /fastify/i,
    /drizzle/i,
    /schema/i,
    /(?:^|\/)db(?:-|\/|\.|$)/i,
    /(?:^|\/)(application|infrastructure|routes|lib)(?:\/|$)/i,
    /node:(?:fs|http|https|net|process)/i,
  ];

  for (const file of domainTsFiles()) {
    const source = read(file);
    for (const specifier of importSpecifiers(source)) {
      if (forbidden.some((pattern) => pattern.test(specifier))) {
        violations.push(`${file}: ${specifier}`);
      }
    }
    for (const marker of [
      "process.",
      "fetch(",
      "new Date(",
      "Date.now(",
      "getClinicPermissions",
      "canManageClinicUsers",
    ]) {
      if (source.includes(marker)) {
        violations.push(`${file}: ${marker}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Users/Roles domain fija catálogos exactos sin enums ni permisos duplicados", () => {
  const source = read(`${domainDir}/user-role-policy.ts`);

  assert.match(
    source,
    /ADMIN_ROLE_USER_TYPES = \["admin", "clinic"\] as const/,
  );
  assert.match(
    source,
    /ADMIN_ROLE_USER_ROLES = \[\s*"admin",\s*"clinic_owner",\s*"clinic_staff",\s*\] as const/,
  );
  assert.match(
    source,
    /ADMIN_CLINIC_USER_ROLES = \[\s*"clinic_owner",\s*"clinic_staff",\s*\] as const/,
  );
  assert.doesNotMatch(source, /\benum\b/);
  assert.doesNotMatch(source, /canUploadReports|canManageLogistics/);
});

test("los consumidores productivos usan domain/index.ts", () => {
  const route = read("server/routes/admin-users-roles.fastify.ts");
  const persistence = read(
    "server/features/users-roles/infrastructure/admin-users-roles-repository.ts",
  );

  assert.match(route, /features\/users-roles\/domain\/index\.ts/);
  assert.match(persistence, /\.\.\/domain\/index\.ts/);
  assert.doesNotMatch(
    `${route}\n${persistence}`,
    /features\/users-roles\/domain\/user-role-policy\.ts/,
  );
});
