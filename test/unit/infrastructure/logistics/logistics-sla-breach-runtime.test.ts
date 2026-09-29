import test from "node:test";
import assert from "node:assert/strict";

import { markOverdueSlaBreachesWithDb } from "../../../../server/features/logistics/infrastructure/sla-breach-db.ts";
import { readSourceFile } from "../../../helpers/tracked-source-files.ts";

const slaBreachDbSource = readSourceFile("server/features/logistics/infrastructure/sla-breach-db.ts");

test("SLA breach runtime DB-wired entrypoint imports DB helper lazily and delegates through the domain core", () => {
  assert.equal(typeof markOverdueSlaBreachesWithDb, "function");

  assert.match(
    slaBreachDbSource,
    // M12: la persistencia canónica vive en la misma capa infrastructure; el
    // adaptador ya no consume el shim raíz `server/db-logistics.ts`.
    /const\s+\{\s*markOverdueActiveClinicSlaInstancesBreached\s*\}\s*=\s*await\s+import\(\s*"\.\/db-logistics\.ts"\s*\)/,
  );

  assert.match(
    slaBreachDbSource,
    /return\s+markOverdueSlaBreaches\(\s*input,\s*\{\s*markOverdueActiveClinicSlaInstancesBreached,\s*now:\s*options\.now,\s*\}\s*\)/,
  );
});

test("SLA breach runtime DB adapter consumes the domain core through the public barrel", () => {
  assert.match(
    slaBreachDbSource,
    /import\s+\{[^}]*markOverdueSlaBreaches[^}]*\}\s+from\s+"\.\.\/domain\/index\.ts"/s,
  );
});
