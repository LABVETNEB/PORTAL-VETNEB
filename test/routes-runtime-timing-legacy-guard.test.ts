import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const routesDir = resolve(process.cwd(), "server", "routes");

const legacyTimingMarkers = [
  "REQUEST_START_TIME_KEY",
  "process.hrtime.bigint",
];

test("native route files do not use legacy request timing markers", () => {
  const offenders = readdirSync(routesDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .sort()
    .flatMap((fileName) => {
      const source = readFileSync(join(routesDir, fileName), "utf8");
      const markers = legacyTimingMarkers.filter((marker) =>
        source.includes(marker),
      );

      return markers.length > 0
        ? [`${fileName}: ${markers.join(", ")}`]
        : [];
    });

  assert.deepEqual(offenders, []);
});
