import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { readSourceFile } from "../../helpers/tracked-source-files.ts";

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
      const source = readSourceFile(`server/routes/${fileName}`);
      const markers = legacyTimingMarkers.filter((marker) =>
        source.includes(marker),
      );

      return markers.length > 0
        ? [`${fileName}: ${markers.join(", ")}`]
        : [];
    });

  assert.deepEqual(offenders, []);
});
