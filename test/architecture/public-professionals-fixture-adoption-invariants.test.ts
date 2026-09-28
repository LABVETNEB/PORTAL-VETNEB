import test from "node:test";
import assert from "node:assert/strict";
import { readSourceFile as readSource } from "../helpers/tracked-source-files.ts";

const PUBLIC_PROFESSIONALS_FACTORY_IMPORT =
  "../../../factories/public-professionals.ts";
const PUBLIC_PROFESSIONALS_MOCK_IMPORT =
  "../../../mocks/public-professionals-route.ts";

test("route surface tests usan fixtures compartidos sin stubs locales de profesionales públicos", () => {
  const source = readSource(
    "test/integration/adapters/controllers/public-professionals-route-surface-invariants.test.ts",
  );

  assert.ok(
    source.includes(`from "${PUBLIC_PROFESSIONALS_FACTORY_IMPORT}"`) &&
      source.includes(`from "${PUBLIC_PROFESSIONALS_MOCK_IMPORT}"`),
    "route surface debe importar factory y mock compartidos",
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

test("tests recientes de profesionales públicos comparten el mock canónico", () => {
  const checkedFiles = [
    "test/integration/adapters/controllers/public-professionals-response-headers-invariants.test.ts",
    "test/integration/adapters/controllers/public-professionals-logging-invariants.test.ts",
    "test/integration/adapters/controllers/public-professionals-route-surface-invariants.test.ts",
  ];

  for (const file of checkedFiles) {
    const source = readSource(file);

    assert.ok(
      source.includes(`from "${PUBLIC_PROFESSIONALS_MOCK_IMPORT}"`),
      `${file} debe importar el mock compartido`,
    );

    assert.ok(
      source.includes("buildPublicProfessionalsRouteFixtureStubs"),
      `${file} debe usar buildPublicProfessionalsRouteFixtureStubs`,
    );
  }
});
