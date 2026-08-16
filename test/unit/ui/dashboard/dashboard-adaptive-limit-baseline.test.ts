import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

type FrozenObservation = {
  moduleId: string;
  viewportSlug: string;
  variantId: string | null;
  leafKey: string;
  source: string;
  limit: number;
  offset: number;
  secondPageCount: number;
  provenance: string;
};

const FIXTURE_PATH =
  "frontend/e2e/fixtures/dashboard-adaptive-limit-baseline.ts";
const HELPER_PATH = "frontend/e2e/helpers/dashboard-adaptive-limit-matrix.ts";
const SPEC_PATH = "frontend/e2e/regression/dashboard-adaptive-limit-baseline.spec.ts";

test("A03 frozen baseline is complete, exact and source-backed", () => {
  const fixture = readFileSync(resolve(process.cwd(), FIXTURE_PATH), "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const helper = readFileSync(resolve(process.cwd(), HELPER_PATH), "utf8");
  const spec = readFileSync(resolve(process.cwd(), SPEC_PATH), "utf8");
  const observationBlock = fixture
    .split("  observations: [\n", 2)[1]
    ?.split("  ],\n  platformObservations:", 1)[0];
  const platformBlock = fixture
    .split("  platformObservations: {\n", 2)[1]
    ?.split("\n  },\n};", 1)[0];

  assert.ok(observationBlock, "fixture must expose a literal observations array");
  assert.ok(platformBlock, "fixture must expose a literal platformObservations object");
  const observations = observationBlock
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FrozenObservation);
  const platformKeys = [...platformBlock.matchAll(/^    ([a-z0-9_-]+): \[$/gm)].map(
    (match) => match[1],
  );
  const linuxObservationBlock = platformBlock
    .split("    linux: [\n", 2)[1]
    ?.split("\n    ],", 1)[0];

  assert.deepEqual(platformKeys, ["linux"]);
  assert.ok(linuxObservationBlock, "fixture must expose a literal Linux observations array");
  const linuxObservations = linuxObservationBlock
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FrozenObservation);

  assert.ok(fixture.includes("schema: A03_BASELINE_SCHEMA"));
  assert.ok(fixture.includes("baseCommit: A03_BASELINE_COMMIT"));
  assert.ok(
    helper.includes(
      'export const A03_BASELINE_COMMIT = "11e735c5613bb8869186a228ffec0588c463a669";',
    ),
  );
  assert.ok(fixture.includes('platform: "win32"'));
  assert.ok(fixture.includes('browser: "chromium"'));
  assert.ok(fixture.includes("devicePixelRatio: 1"));
  assert.ok(fixture.includes("moduleCount: 15"));
  assert.ok(fixture.includes("viewportCount: 13"));
  assert.ok(fixture.includes("primaryRecordCount: 195"));
  assert.ok(fixture.includes("leafObservationCount: 234"));
  assert.ok(
    spec.includes('const A03_PLATFORM_CAPTURE_MODE = "off" as "off" | "capture";'),
  );
  assert.equal(observations.length, 234);
  assert.equal(new Set(observations.map((entry) => entry.leafKey)).size, 234);
  assert.equal(
    new Set(observations.map((entry) => `${entry.moduleId}::${entry.viewportSlug}`)).size,
    195,
  );
  assert.equal(linuxObservations.length, 234);
  assert.equal(new Set(linuxObservations.map((entry) => entry.leafKey)).size, 234);
  assert.equal(
    new Set(linuxObservations.map((entry) => `${entry.moduleId}::${entry.viewportSlug}`)).size,
    195,
  );
  assert.deepEqual(
    linuxObservations.map((entry) => entry.leafKey).sort(),
    observations.map((entry) => entry.leafKey).sort(),
  );

  for (const observation of [...observations, ...linuxObservations]) {
    assert.ok(observation.moduleId.length > 0);
    assert.ok(observation.viewportSlug.length > 0);
    assert.ok(
      observation.variantId === null ||
        (typeof observation.variantId === "string" && observation.variantId.length > 0),
    );
    assert.ok(observation.leafKey.length > 0);
    assert.ok(["server-request", "url-query", "client-slice"].includes(observation.source));
    assert.ok(Number.isInteger(observation.limit) && observation.limit > 0);
    assert.ok(Number.isInteger(observation.offset) && observation.offset >= 0);
    assert.equal(observation.secondPageCount, observation.limit);
    assert.ok(observation.provenance.length > 0);
  }
});
