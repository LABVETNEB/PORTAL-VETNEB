import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const feature = "server/features/report-access";
const domain = `${feature}/domain`;
const application = `${feature}/application`;
const infrastructure = `${feature}/infrastructure`;
const composition =
  `${feature}/composition/report-access-route-composition.ts`;
const routes = [
  "server/routes/admin-report-access-tokens.fastify.ts",
  "server/routes/report-access-tokens.fastify.ts",
  "server/routes/public-report-access.fastify.ts",
];

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");
}

function walk(path: string): string[] {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    return entry.isDirectory() ? walk(child) : [child];
  });
}

function importTargets(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const result: string[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      result.push(
        specifier.startsWith(".")
          ? relative(
              root,
              resolve(root, dirname(path), specifier),
            ).replaceAll("\\", "/")
          : specifier,
      );
    }
    node.forEachChild(visit);
  }
  visit(source);
  return result;
}

test("M34 conserva sólo su feature y Reports avanza independientemente hasta M38", () => {
  for (const path of [
    `${feature}/README.md`,
    `${domain}/report-access.ts`,
    `${application}/admin-report-access-operations.ts`,
    `${application}/clinic-report-access-operations.ts`,
    `${application}/public-report-access-operations.ts`,
    `${infrastructure}/report-access-repository.ts`,
    composition,
    "docs/implementation/m34-report-access-domain-repository-thin-closeout.md",
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }
  assert.equal(existsSync(resolve(root, "server/features/reports")), true);
  assert.equal(
    existsSync(resolve(root, "server/features/reports/application")),
    true,
  );
  assert.equal(
    existsSync(resolve(root, "server/features/reports/infrastructure")),
    true,
  );
  assert.equal(
    existsSync(resolve(root, "server/features/reports/composition")),
    true,
  );
  assert.ok(read("server/features/reports/README.md").includes("M37"));
  assert.equal(
    existsSync(
      resolve(
        root,
        "server/features/reports/application/report-command-use-cases.ts",
      ),
    ),
    true,
  );
  assert.equal(
    existsSync(
      resolve(
        root,
        "docs/implementation/m37-reports-workflow-data-notification-ports.md",
      ),
    ),
    true,
  );
  assert.equal(
    existsSync(
      resolve(
        root,
        "server/features/reports/infrastructure/db-report-workflow.ts",
      ),
    ),
    false,
  );
  assert.equal(existsSync(resolve(root, "server/features/report-access-v2")), false);
});

test("domain y application respetan sus boundaries", () => {
  for (const path of walk(domain).filter((file) => file.endsWith(".ts"))) {
    const source = read(path).toLowerCase();
    for (const marker of [
      "fastify",
      "drizzle",
      "schema.ts",
      "supabase",
      "audit",
      "rate-limit",
      "http",
    ]) {
      assert.equal(source.includes(marker), false, `${path}: ${marker}`);
    }
  }
  for (const path of walk(application).filter((file) => file.endsWith(".ts"))) {
    const source = read(path).toLowerCase();
    for (const marker of ["fastify", "drizzle", "schema.ts"]) {
      assert.equal(source.includes(marker), false, `${path}: ${marker}`);
    }
    assert.equal(
      importTargets(path).some((target) =>
        target.startsWith(`${infrastructure}/`),
      ),
      false,
      path,
    );
  }
});

test("repository legacy está eliminado y las siete operaciones permanecen", () => {
  assert.equal(existsSync(resolve(root, "server/db-report-access.ts")), false);
  const repository = read(`${infrastructure}/report-access-repository.ts`);
  for (const operation of [
    "createReportAccessToken",
    "getReportAccessTokenById",
    "getClinicScopedReportAccessToken",
    "listReportAccessTokens",
    "revokeReportAccessToken",
    "recordReportAccessTokenAccess",
    "getReportAccessTokenWithReportByTokenHash",
  ]) {
    assert.match(repository, new RegExp(`export async function ${operation}\\b`));
  }
  for (const path of walk("server").filter((file) => file.endsWith(".ts"))) {
    assert.equal(
      importTargets(path).some((target) => target === "server/db-report-access.ts"),
      false,
      path,
    );
  }
});

test("rutas quedan conectadas a application sin Drizzle ni repository directo", () => {
  for (const route of routes) {
    const source = read(route);
    const targets = importTargets(route);
    assert.ok(
      targets.includes("server/features/report-access/application/index.ts"),
      route,
    );
    assert.ok(targets.includes(composition), route);
    assert.equal(source.includes("drizzle-orm"), false, route);
    assert.equal(
      targets.some((target) => target.startsWith(`${infrastructure}/`)),
      false,
      route,
    );
    for (const operation of [
      "deps.createReportAccessToken(",
      "deps.getReportAccessTokenById(",
      "deps.getClinicScopedReportAccessToken(",
      "deps.listReportAccessTokens(",
      "deps.revokeReportAccessToken(",
      "deps.recordReportAccessTokenAccess(",
      "deps.getReportAccessTokenWithReportByTokenHash(",
    ]) {
      assert.equal(source.includes(operation), false, `${route}: ${operation}`);
    }
  }
});

test("orden de borde permanece anclado en rutas y negocio en application", () => {
  for (const route of routes.slice(0, 2)) {
    const source = read(route);
    const trusted = source.indexOf("enforceTrustedOrigin(request, reply");
    const rate = source.indexOf("applyMutationRateLimit(request, reply)");
    const auth = source.indexOf(
      route.includes("admin-")
        ? "authenticateAdminUser(request, reply"
        : "authenticateClinicUser(request, reply",
    );
    assert.ok(trusted >= 0 && trusted < rate && rate < auth, route);
  }
  const publicRoute = read(routes[2]);
  assert.ok(
    publicRoute.indexOf("getOrCreateRateLimitEntry(") <
      publicRoute.indexOf("reportAccessTokenRawTokenSchema.safeParse("),
  );
  const publicApplication = read(
    `${application}/public-report-access-operations.ts`,
  );
  assert.ok(
    publicApplication.indexOf("recordReportAccessTokenAccess(") <
      publicApplication.indexOf("createSignedReportUrl("),
  );
  assert.ok(
    publicApplication.indexOf("createSignedReportDownloadUrl(") <
      publicApplication.indexOf("writeAuditLog("),
  );
});
