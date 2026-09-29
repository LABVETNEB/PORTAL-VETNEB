import test from "node:test";
import assert from "node:assert/strict";
import { readSourceFile } from "../../../helpers/tracked-source-files.ts";

const routeSource = readSourceFile("server/routes/admin-auth.fastify.ts");

const adapterSource = readSourceFile("server/lib/fastify-admin-auth.ts");

test("admin auth route uses shared session last access helper", () => {
  assert.match(routeSource, /authenticateFastifyAdmin/);
  assert.match(
    adapterSource,
    /import \{ shouldRefreshSessionLastAccess \} from "\.\/session-last-access\.ts";/,
  );
  assert.match(
    adapterSource,
    /shouldRefreshSessionLastAccess\(session\.lastAccess \?\? null, deps\.now\(\)\)/,
  );
  assert.doesNotMatch(adapterSource, /SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS/);
  assert.doesNotMatch(adapterSource, /function shouldRefreshSessionLastAccess/);
});
