import test from "node:test";
import assert from "node:assert/strict";
import { readSourceFile } from "../../../helpers/tracked-source-files.ts";

const routeSource = readSourceFile("server/routes/particular-audit.fastify.ts");

test("particular audit route uses shared session last access helper", () => {
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
