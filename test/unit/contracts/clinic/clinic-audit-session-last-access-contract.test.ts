import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(process.cwd(), "server", "routes", "clinic-audit.fastify.ts"),
  "utf8",
);

const adapterSource = readFileSync(
  resolve(process.cwd(), "server", "lib", "fastify-clinic-auth.ts"),
  "utf8",
);

// WBR-08c: migrated to the canonical clinic auth helper, which now owns the
// session last-access refresh (mirrors the admin family's split).
test("clinic audit route uses shared session last access helper", () => {
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
