import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(process.cwd(), "server", "routes", "admin-audit.fastify.ts"),
  "utf8",
);

const adapterSource = readFileSync(
  resolve(process.cwd(), "server", "lib", "fastify-admin-auth.ts"),
  "utf8",
);

test("admin audit route uses shared session last access helper", () => {
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
