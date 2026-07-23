
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const featureDir = "server/features/clinics";
const infrastructureDir = featureDir + "/infrastructure";
const repositoryFile =
  infrastructureDir + "/admin-clinics-repository.ts";
const barrelFile = infrastructureDir + "/index.ts";
const legacyShimFile =
  ["server", "db-admin-clinics.ts"].join("/");
const queryServiceFile =
  featureDir + "/admin-clinics-query-service.ts";
const commandServiceFile =
  featureDir + "/admin-clinics-command-service.ts";
const publicProfileQueryServiceFile =
  featureDir + "/clinic-public-profile-query-service.ts";
const publicProfileCommandServiceFile =
  featureDir + "/clinic-public-profile-command-service.ts";
const publicProfileRouteFile =
  "server/routes/clinic-public-profile.fastify.ts";
const publicProfessionalsBarrelFile =
  "server/features/public-professionals/infrastructure/index.ts";
const publicProfessionalsMappingFile =
  "server/features/public-professionals/infrastructure/public-professionals-mapping.ts";
const publicProfessionalsRepositoryFile =
  "server/features/public-professionals/infrastructure/public-professionals-repository.ts";
const applicationDir = featureDir + "/application";

const routeConsumers = [
  "server/routes/admin-clinics.fastify.ts",
  "server/routes/admin-users-roles.fastify.ts",
] as const;

const publicTypeExports = [
  "AdminClinicUserSummary",
  "AdminClinicSummary",
  "AdminClinicManagementSummary",
  "AdminClinicsSnapshot",
  "AdminClinicCreateInput",
  "AdminClinicUpdateInput",
  "AdminClinicUserCredentialsUpdateInput",
  "AdminClinicDeleteInput",
  "AdminClinicCreateResult",
  "AdminClinicUserCredentialsUpdateResult",
] as const;

const publicFunctionExports = [
  "listAdminClinics",
  "createAdminClinicWithUser",
  "updateAdminClinic",
  "getAdminClinicById",
  "deleteAdminClinic",
  "updateAdminClinicUserCredentials",
] as const;

function readText(relativePath: string): string {
  return readFileSync(
    join(repoRoot, relativePath),
    "utf8",
  ).replace(/\r\n/g, "\n");
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function listImportSpecifiers(source: string): string[] {
  return Array.from(
    source.matchAll(
      /\bfrom\s+["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g,
    ),
    (match) =>
      match[1] ??
      match[2] ??
      match[3] ??
      match[4] ??
      "",
  );
}

function resolveSpecifier(
  file: string,
  specifier: string,
): string {
  if (!specifier.startsWith(".")) {
    return normalizePath(specifier);
  }

  const resolved = normalizePath(
    relative(
      repoRoot,
      join(repoRoot, dirname(file), specifier),
    ),
  );

  if (resolved.endsWith(".ts")) {
    return resolved;
  }

  const tsFile = resolved + ".ts";

  if (existsSync(join(repoRoot, tsFile))) {
    return tsFile;
  }

  const indexFile = resolved + "/index.ts";

  if (existsSync(join(repoRoot, indexFile))) {
    return indexFile;
  }

  return resolved;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test(
  "Clinics infrastructure contiene repository y barrel reales",
  () => {
    assert.equal(
      existsSync(join(repoRoot, infrastructureDir)),
      true,
    );
    assert.equal(
      existsSync(join(repoRoot, repositoryFile)),
      true,
    );
    assert.equal(
      existsSync(join(repoRoot, barrelFile)),
      true,
    );

    const source = readText(repositoryFile);

    assert.ok(source.length > 15_000);
    assert.match(
      source,
      /export async function listAdminClinics\(/,
    );
    assert.match(
      source,
      /export async function createAdminClinicWithUser\(/,
    );
    assert.match(
      source,
      /export async function deleteAdminClinic\(/,
    );
  },
);

test(
  "El repository conserva la superficie pública R0",
  () => {
    const source = stripComments(
      readText(repositoryFile),
    );

    for (const name of publicTypeExports) {
      assert.match(
        source,
        new RegExp(
          "\\bexport\\s+type\\s+" + name + "\\b",
        ),
      );
    }

    for (const name of publicFunctionExports) {
      assert.match(
        source,
        new RegExp(
          "\\bexport\\s+async\\s+function\\s+" +
            name +
            "\\s*\\(",
        ),
      );
    }
  },
);

test(
  "El barrel permanece canónico y el shim fue retirado",
  () => {
    const barrelLines = stripComments(
      readText(barrelFile),
    )
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    assert.deepEqual(barrelLines, [
      'export * from "./admin-clinics-repository.ts";',
    ]);

    assert.equal(
      existsSync(join(repoRoot, legacyShimFile)),
      false,
    );
  },
);

test(
  "El repository sólo importa persistencia autorizada",
  () => {
    const allowed = new Set([
      "server/db.ts",
      "drizzle/schema.ts",
      "server/lib/list-pagination.ts",
    ]);

    const violations: string[] = [];

    for (
      const specifier of listImportSpecifiers(
        readText(repositoryFile),
      )
    ) {
      if (
        specifier === "drizzle-orm" ||
        specifier.startsWith("drizzle-orm/")
      ) {
        continue;
      }

      const resolved = resolveSpecifier(
        repositoryFile,
        specifier,
      );

      if (!allowed.has(resolved)) {
        violations.push(
          specifier + " -> " + resolved,
        );
      }
    }

    assert.deepEqual(violations, []);
  },
);

test(
  "Infrastructure no depende de transporte ni auth",
  () => {
    const source = readText(repositoryFile);

    const targets = listImportSpecifiers(source).map(
      (specifier) =>
        resolveSpecifier(repositoryFile, specifier),
    );

    const forbidden = targets.filter(
      (target) =>
        target === "fastify" ||
        target.startsWith("server/routes/") ||
        target.includes("/application/") ||
        target.startsWith("server/middlewares/") ||
        /(^|\/)(auth|cors|audit|email|supabase)([./-]|$)/i.test(
          target,
        ) ||
        target.startsWith("frontend/"),
    );

    assert.deepEqual(forbidden, []);

    for (const symbol of [
      "FastifyRequest",
      "FastifyReply",
      "authenticateFastifyAdmin",
      "enforceTrustedOrigin",
      "writeAuditLog",
    ]) {
      assert.equal(
        source.includes(symbol),
        false,
      );
    }
  },
);

test(
  "El repository conserva dos transacciones exactas",
  () => {
    const source = readText(repositoryFile);

    assert.equal(
      source.match(/\.transaction\s*\(/g)?.length ?? 0,
      2,
    );

    const createStart = source.indexOf(
      "export async function createAdminClinicWithUser(",
    );
    const updateStart = source.indexOf(
      "export async function updateAdminClinic(",
    );
    const deleteStart = source.indexOf(
      "export async function deleteAdminClinic(",
    );
    const credentialsStart = source.indexOf(
      "export async function updateAdminClinicUserCredentials(",
    );

    assert.ok(createStart >= 0);
    assert.ok(updateStart > createStart);
    assert.ok(deleteStart > updateStart);
    assert.ok(credentialsStart > deleteStart);

    const createSource = source.slice(
      createStart,
      updateStart,
    );
    const deleteSource = source.slice(
      deleteStart,
      credentialsStart,
    );

    assert.equal(
      createSource.match(/\.transaction\s*\(/g)?.length ??
        0,
      1,
    );
    assert.equal(
      deleteSource.match(/\.transaction\s*\(/g)?.length ??
        0,
      1,
    );
  },
);

test(
  "Se conservan SQL legacy, ISO y asociación clínica-usuario",
  () => {
    const source = readText(repositoryFile);

    for (const marker of [
      "column_name = 'clinic_id'",
      "pg_get_serial_sequence",
      'insert into "clinics"',
      '"clinic_id"',
      "buildLegacyClinicExternalId(reservedClinicId)",
      "now.toISOString()",
      "::timestamptz",
      "toIsoDate(row.createdAt)",
      "toIsoDate(row.updatedAt)",
      "clinicId: clinic.clinicId",
      "passwordHash: input.passwordHash",
      "role: input.role",
    ]) {
      assert.ok(
        source.includes(marker),
        marker,
      );
    }
  },
);

test(
  "La cascada delete conserva el orden crítico",
  () => {
    const source = readText(repositoryFile);
    const deleteStart = source.indexOf(
      "export async function deleteAdminClinic(",
    );
    const deleteSource = source.slice(deleteStart);

    const markers = [
      ".delete(reportAccessTokens)",
      ".delete(reportAccessTokens)",
      ".delete(particularSessions)",
      ".delete(activeSessions)",
      ".delete(studyTrackingNotifications)",
      ".delete(routeEvents)",
      ".delete(routeStops)",
      ".delete(routeStops)",
      ".delete(visitLocations)",
      ".delete(timeWindows)",
      ".delete(studyTrackingCases)",
      ".delete(slaInstances)",
      ".delete(slaPolicies)",
      ".delete(routePlans)",
      ".delete(fieldVisits)",
      ".delete(particularTokens)",
      ".delete(reports)",
      ".delete(clinicPublicSearch)",
      ".delete(clinicPublicProfiles)",
      ".delete(clinicUsers)",
      'update "audit_log" set "clinic_id" = null',
      ".delete(clinics)",
    ];

    let cursor = -1;

    for (const marker of markers) {
      const current = deleteSource.indexOf(
        marker,
        cursor + 1,
      );

      assert.ok(
        current > cursor,
        marker,
      );

      cursor = current;
    }
  },
);

test("Los servicios directos Clinics existen sin application", () => {
  assert.equal(existsSync(join(repoRoot, queryServiceFile)), true);
  assert.equal(existsSync(join(repoRoot, commandServiceFile)), true);
  assert.equal(existsSync(join(repoRoot, applicationDir)), false);
});

test(
  "Los servicios consumen infrastructure canónica sin transporte, auditoría, CORS ni auth",
  () => {
    for (const serviceFile of [
      queryServiceFile,
      commandServiceFile,
    ]) {
      const source = readText(serviceFile);
      const targets = listImportSpecifiers(source).map(
        (specifier) =>
          resolveSpecifier(serviceFile, specifier),
      );

      assert.ok(targets.includes(barrelFile), serviceFile);
      assert.equal(targets.includes(legacyShimFile), false);
      assert.equal(targets.includes(repositoryFile), false);

      for (const forbidden of [
        "Fastify",
        "AUDIT_EVENTS",
        "writeAuditLog",
        "getAllowedOrigins",
        "enforceTrustedOrigin",
        "authenticateFastifyAdmin",
        "auth-security",
      ]) {
        assert.equal(
          source.includes(forbidden),
          false,
          `${serviceFile}: ${forbidden}`,
        );
      }
    }
  },
);

test(
  "Las rutas consumen servicios, nunca infrastructure ni el shim",
  () => {
    const expectedServices = new Map([
      [
        "server/routes/admin-clinics.fastify.ts",
        [queryServiceFile, commandServiceFile],
      ],
      [
        "server/routes/admin-users-roles.fastify.ts",
        [commandServiceFile],
      ],
    ]);

    for (const routeFile of routeConsumers) {
      const targets = listImportSpecifiers(
        readText(routeFile),
      ).map((specifier) =>
        resolveSpecifier(routeFile, specifier),
      );

      for (const serviceFile of expectedServices.get(routeFile) ?? []) {
        assert.ok(
          targets.includes(serviceFile),
          `${routeFile}: ${serviceFile}`,
        );
      }

      assert.equal(targets.includes(legacyShimFile), false);
      assert.equal(targets.includes(repositoryFile), false);
      assert.equal(targets.includes(barrelFile), false);
    }
  },
);

test(
  "Las rutas no vuelven a llamar inline los métodos DB Clinics",
  () => {
    const directCallPattern =
      /\bdeps\.(?:listAdminClinics|createAdminClinicWithUser|getAdminClinicById|updateAdminClinic|deleteAdminClinic|updateAdminClinicUserCredentials)\s*\(/g;

    for (const routeFile of routeConsumers) {
      assert.deepEqual(
        readText(routeFile).match(directCallPattern) ?? [],
        [],
        routeFile,
      );
    }
  },
);

test(
  "admin-users-roles delega sólo el comando Clinics de credenciales",
  () => {
    const source = readText(
      "server/routes/admin-users-roles.fastify.ts",
    );

    assert.equal(
      source.match(
        /\bupdateAdminClinicUserCredentialsCommand\s*\(/g,
      )?.length ?? 0,
      1,
    );

    for (const unrelatedCommand of [
      "createAdminClinicCommand",
      "updateAdminClinicCommand",
      "deleteAdminClinicCommand",
      "listAdminClinicsQuery",
      "getAdminClinicQuery",
    ]) {
      assert.equal(source.includes(unrelatedCommand), false);
    }
  },
);

test(
  "Los contratos source-only leen el repository canónico",
  () => {
    const source = readText(
      "test/unit/contracts/admin/admin-clinics-db-contract.test.ts",
    );

    assert.ok(
      source.includes(repositoryFile),
    );
    assert.equal(
      source.includes(
        'read("server/db-admin-clinics.ts")',
      ),
      false,
    );
  },
);

test(
  "M27 no crea application",
  () => {
    assert.equal(
      existsSync(join(repoRoot, applicationDir)),
      false,
    );
  },
);

test("M28 agrega servicios directos de perfil público sin application", () => {
  assert.equal(
    existsSync(
      join(repoRoot, publicProfileQueryServiceFile),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(repoRoot, publicProfileCommandServiceFile),
    ),
    true,
  );
  assert.equal(
    existsSync(join(repoRoot, applicationDir)),
    false,
  );
});

test("Los servicios M28 consumen sólo el barrel público de Public Professionals", () => {
  for (const serviceFile of [
    publicProfileQueryServiceFile,
    publicProfileCommandServiceFile,
  ]) {
    const source = readText(serviceFile);
    const targets = listImportSpecifiers(source).map(
      (specifier) =>
        resolveSpecifier(serviceFile, specifier),
    );

    assert.ok(
      targets.includes(
        publicProfessionalsBarrelFile,
      ),
      serviceFile,
    );
    assert.equal(
      targets.includes(
        publicProfessionalsMappingFile,
      ),
      false,
      serviceFile,
    );
    assert.equal(
      targets.includes(
        publicProfessionalsRepositoryFile,
      ),
      false,
      serviceFile,
    );

    for (const forbidden of [
      "FastifyRequest",
      "FastifyReply",
      "enforceTrustedOrigin",
      "getAllowedOrigins",
      "getClinicPermissions",
      "buildRequestLogLine",
      "createRuntimeTimer",
      "writeAuditLog",
    ]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${serviceFile}: ${forbidden}`,
      );
    }
  }
});

test("La ruta M28 consume servicios Clinics y no infraestructura Public Professionals", () => {
  const source = readText(publicProfileRouteFile);
  const targets = listImportSpecifiers(source).map(
    (specifier) =>
      resolveSpecifier(
        publicProfileRouteFile,
        specifier,
      ),
  );

  assert.ok(
    targets.includes(publicProfileQueryServiceFile),
  );
  assert.ok(
    targets.includes(publicProfileCommandServiceFile),
  );
  assert.equal(
    targets.includes(publicProfessionalsBarrelFile),
    false,
  );
  assert.equal(
    targets.includes(publicProfessionalsMappingFile),
    false,
  );
  assert.equal(
    targets.includes(
      publicProfessionalsRepositoryFile,
    ),
    false,
  );
  assert.equal(
    targets.includes("server/lib/supabase.ts"),
    false,
  );
});

test("Los servicios M28 no se importan entre sí ni crean ciclos con la ruta", () => {
  const queryTargets = listImportSpecifiers(
    readText(publicProfileQueryServiceFile),
  ).map((specifier) =>
    resolveSpecifier(
      publicProfileQueryServiceFile,
      specifier,
    ),
  );
  const commandTargets = listImportSpecifiers(
    readText(publicProfileCommandServiceFile),
  ).map((specifier) =>
    resolveSpecifier(
      publicProfileCommandServiceFile,
      specifier,
    ),
  );

  assert.equal(
    queryTargets.includes(
      publicProfileCommandServiceFile,
    ),
    false,
  );
  assert.equal(
    commandTargets.includes(
      publicProfileQueryServiceFile,
    ),
    false,
  );
  assert.equal(
    queryTargets.includes(publicProfileRouteFile),
    false,
  );
  assert.equal(
    commandTargets.includes(publicProfileRouteFile),
    false,
  );
});

test("M28 preserva Options públicas y el registro en fastify-app", () => {
  const routeSource = readText(publicProfileRouteFile);
  const optionsStart = routeSource.indexOf(
    "export type ClinicPublicProfileNativeRoutesOptions = {",
  );
  const optionsEnd = routeSource.indexOf(
    "\n};",
    optionsStart,
  );
  const optionsSource = routeSource.slice(
    optionsStart,
    optionsEnd,
  );

  assert.ok(optionsStart >= 0);

  for (const property of [
    "deleteActiveSession",
    "getActiveSessionByToken",
    "getClinicUserById",
    "updateSessionLastAccess",
    "hashSessionToken",
    "getClinicById",
    "getClinicPublicProfileByClinicId",
    "buildClinicPublicProfileResponse",
    "evaluateClinicPublicProfilePublication",
    "minPublicProfileQualityScore",
    "patchClinicPublicProfile",
    "removeClinicPublicAvatar",
    "syncClinicPublicSearch",
    "createSignedStorageUrl",
    "uploadClinicAvatar",
    "deleteStorageObject",
    "now",
  ]) {
    assert.ok(
      optionsSource.includes(`${property}?:`),
      property,
    );
  }

  const appSource = readText("server/fastify-app.ts");
  assert.match(
    appSource,
    /app\.register\(clinicPublicProfileNativeRoutes,\s*\{\s*prefix: "\/api\/clinic\/profile"/s,
  );
});
