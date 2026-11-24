import assert from "node:assert/strict";
import test from "node:test";

import { readSourceFile as source } from "../../helpers/tracked-source-files.ts";

const inventory = source("server/storage-orphan-inventory.ts");
const maintenance = source("server/db-maintenance.ts");
const supabaseSource = source("server/lib/supabase.ts");
const route = source("server/routes/admin-system-maintenance.fastify.ts");

const adapter = supabaseSource.slice(
  supabaseSource.indexOf("export function createStorageObjectListing"),
);
const referenceWiring = maintenance.slice(
  maintenance.indexOf("async function lookupReferencedReportPaths"),
);

test("SEC-09D estructura: el inventario y el adaptador de listado no contienen operaciones destructivas ni de escritura", () => {
  for (const forbidden of [
    "deleteStorageObject",
    ".remove(",
    ".delete(",
    ".move(",
    ".copy(",
    ".upload(",
    "createSignedUrl",
  ]) {
    assert.equal(inventory.includes(forbidden), false, `inventario: ${forbidden}`);
    assert.equal(adapter.includes(forbidden), false, `adaptador: ${forbidden}`);
    assert.equal(referenceWiring.includes(forbidden), false, `referencias: ${forbidden}`);
  }
});

test("SEC-09D estructura: el modulo del inventario no importa base de datos ni Storage y la consulta de referencias no retiene conexiones", () => {
  assert.equal(/from "\.\/db\.ts"|from "drizzle-orm|from "postgres"|supabase/.test(inventory), false);
  assert.equal(/\.transaction\(|\.reserve\(|pgClient|begin\(/.test(referenceWiring), false);
  assert.match(referenceWiring, /\.where\(inArray\(reports\.storagePath, paths\)\)/);
});

test("SEC-09D estructura: storage_orphans conserva supported=false y destructiveAction=null", () => {
  const group = maintenance.slice(
    maintenance.indexOf('category: "storage_orphans"'),
    maintenance.indexOf("];", maintenance.indexOf('category: "storage_orphans"')),
  );

  assert.match(group, /count: 0,\s+supported: false,\s+destructiveAction: null/);
  assert.equal(/supported: true/.test(group), false);
});

test("SEC-09D estructura: el inventario remoto solo corre con includeStorageOrphans=true y nunca desde la tarjeta administrativa", () => {
  assert.match(route, /includeStorageOrphans === true/);
  assert.equal(
    (route.match(/resolveStorageOrphanInventory\(options/g) ?? []).length,
    1,
  );

  for (const frontendPath of [
    "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx",
    "frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx",
    "frontend/src/lib/api.ts",
  ]) {
    assert.equal(
      source(frontendPath).includes("includeStorageOrphans"),
      false,
      frontendPath,
    );
  }
});
