import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const kernelFile = "server/lib/permissions.ts";
const featureDir = "server/features/users-roles";

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function walk(path: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) files.push(...walk(child));
    if (entry.isFile()) files.push(child);
  }
  return files;
}

function walkTs(path: string): string[] {
  return walk(path).filter((file) => file.endsWith(".ts"));
}

test("permissions.ts permanece como kernel compartido en su path canónico", () => {
  assert.equal(existsSync(join(root, kernelFile)), true);
  const source = read(kernelFile);
  assert.match(source, /export function getClinicPermissions/);
  assert.match(source, /export type ClinicPermissions/);
});

test("Users/Roles no copia, reexporta ni importa el kernel de permisos", () => {
  const violations: string[] = [];

  for (const file of walk(featureDir)) {
    const normalized = file.replaceAll("\\", "/");
    if (/permissions\.ts$/i.test(normalized)) {
      violations.push(`${normalized}: copia de permissions.ts`);
    }
    if (!normalized.endsWith(".ts")) {
      continue;
    }

    const source = read(normalized);
    if (/getClinicPermissions|ClinicPermissions/.test(source)) {
      violations.push(`${normalized}: API del kernel duplicada o reexportada`);
    }
    if (/lib\/permissions\.ts/.test(source)) {
      violations.push(`${normalized}: import del kernel`);
    }
  }

  assert.deepEqual(violations, []);
});

test("el fan-in productivo del kernel sigue siendo cross-context", () => {
  const consumers = walkTs("server")
    .filter((file) => file !== kernelFile)
    .filter((file) => read(file).includes("permissions.ts"))
    .sort();

  // WBR-07 retired the dead server/middlewares/auth.ts (a permissions.ts
  // consumer); WBR-08b centralized reports.fastify.ts's role normalization
  // into server/lib/fastify-clinic-auth.ts, which is now the consumer in
  // its place. Net: 14 - 2 (retired middleware + reports.fastify.ts) + 1
  // (fastify-clinic-auth.ts) = 13.
  assert.equal(consumers.length, 13);
  assert.ok(consumers.some((file) => file.includes("logistics-")));
  assert.ok(consumers.some((file) => file.includes("reports")));
  assert.ok(consumers.some((file) => file.includes("clinic")));
  assert.equal(
    consumers.some((file) => file.startsWith(`${featureDir}/`)),
    false,
  );
});
