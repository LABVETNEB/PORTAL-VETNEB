import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("route surface tests usan fixtures compartidos sin stubs locales de profesionales públicos", () => {
  const source = readSource(
    "test/public-professionals-route-surface-invariants.test.ts",
  );

  assert.ok(
    source.includes('from "./helpers/public-professionals-fixtures.ts"'),
    "route surface debe importar fixtures compartidos",
  );

  assert.ok(
    source.includes("buildPublicProfessionalsRouteFixtureStubs"),
    "route surface debe usar buildPublicProfessionalsRouteFixtureStubs",
  );

  assert.equal(
    source.includes("function buildPublicProfessionalsRouteStubs()"),
    false,
    "route surface no debe reintroducir stubs locales",
  );

  assert.equal(
    source.includes("searchPublicProfessionals: async () => ({"),
    false,
    "route surface no debe duplicar searchPublicProfessionals local",
  );

  assert.equal(
    source.includes("createSignedStorageUrl: async"),
    false,
    "route surface no debe duplicar signing fake local",
  );
});

test("tests recientes de profesionales públicos comparten el helper de fixtures", () => {
  const checkedFiles = [
    "test/public-professionals-response-headers-invariants.test.ts",
    "test/public-professionals-logging-invariants.test.ts",
    "test/public-professionals-route-surface-invariants.test.ts",
  ];

  for (const file of checkedFiles) {
    const source = readSource(file);

    assert.ok(
      source.includes('from "./helpers/public-professionals-fixtures.ts"'),
      `${file} debe importar fixtures compartidos`,
    );

    assert.ok(
      source.includes("buildPublicProfessionalsRouteFixtureStubs"),
      `${file} debe usar buildPublicProfessionalsRouteFixtureStubs`,
    );
  }
});
