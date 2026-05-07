import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(process.cwd(), "server", "routes", "reports-status.fastify.ts"),
  "utf8",
);

test("reports status route uses shared session last access helper", () => {
  assert.match(
    routeSource,
    /import \{ shouldRefreshSessionLastAccess \} from "\.\.\/lib\/session-last-access\.ts";/,
  );
  assert.match(
    routeSource,
    /shouldRefreshSessionLastAccess\(session\.lastAccess \?\? null, now\(\)\)/,
  );
  assert.doesNotMatch(routeSource, /SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS/);
  assert.doesNotMatch(routeSource, /function shouldRefreshSessionLastAccess/);
});
