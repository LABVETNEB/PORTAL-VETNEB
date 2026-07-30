import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { listTrackedSourceFiles } from "../helpers/tracked-source-files.ts";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const FACTORY_PATH = "test/factories/public-professionals.ts";
const MOCK_PATH = "test/mocks/public-professionals-route.ts";

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("public professionals support mantiene APIs canónicas separadas", () => {
  const factorySource = readSource(FACTORY_PATH);
  const mockSource = readSource(MOCK_PATH);

  assert.match(
    factorySource,
    /export function buildPublicProfessionalFixtureRow\(/,
  );
  assert.match(
    mockSource,
    /export function buildPublicProfessionalsRouteFixtureStubs\(/,
  );
  assert.match(
    mockSource,
    /type PublicProfessionalsRouteFixtureStubs =/,
  );
  assert.equal(factorySource.includes("searchPublicProfessionals"), false);
  assert.equal(mockSource.includes("process.env"), false);
});

test("runtime no importa factories ni mocks de profesionales públicos", () => {
  const offenders = listTrackedSourceFiles(".")
    .filter((file) => !file.startsWith("test/"))
    .filter((file) => {
      const source = readSource(file);
      return (
        source.includes("factories/public-professionals") ||
        source.includes("mocks/public-professionals-route")
      );
    });

  assert.deepEqual(offenders, []);
});

test("soporte de profesionales públicos no usa infraestructura real", () => {
  const source = `${readSource(FACTORY_PATH)}\n${readSource(MOCK_PATH)}`;

  for (const forbiddenToken of [
    "process.env",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "createClient",
    "postgres(",
    "drizzle(",
    ".storage",
    "readFileSync",
    "writeFileSync",
    "fetch(",
  ]) {
    assert.equal(source.includes(forbiddenToken), false, forbiddenToken);
  }
});
