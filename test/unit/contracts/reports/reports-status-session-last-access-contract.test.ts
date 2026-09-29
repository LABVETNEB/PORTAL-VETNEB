import test from "node:test";
import assert from "node:assert/strict";
import { readSourceFile } from "../../../helpers/tracked-source-files.ts";

const routeSource = readSourceFile("server/routes/reports-status.fastify.ts");

const adapterSource = readSourceFile("server/lib/fastify-clinic-auth.ts");

// WBR-08b: migrated to the canonical clinic auth helper, which now owns the
// session last-access refresh (mirrors the admin family's split above).
test("reports status route uses shared session last access helper", () => {
  assert.match(routeSource, /authenticateFastifyClinicUser/);
  assert.match(
    adapterSource,
    /import \{ shouldRefreshSessionLastAccess \} from "\.\/session-last-access\.ts";/,
  );
  assert.match(
    adapterSource,
    /shouldRefreshSessionLastAccess\(session\.lastAccess \?\? null, now\(\)\)/,
  );
  assert.doesNotMatch(adapterSource, /SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS/);
  assert.doesNotMatch(adapterSource, /function shouldRefreshSessionLastAccess/);
});
