import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile, readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import {
  descendants,
  evaluate,
  parseTsx,
  unwrap,
} from "./dashboard-source-oracle.ts";

const HERO_PATH = "frontend/src/components/dashboard/DashboardHubHero.tsx";
const HUB_PATH = "frontend/src/components/dashboard/DashboardModuleHub.tsx";
const CLINIC_CONTROLLER_PATH =
  "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";
const ADMIN_CONTROLLER_PATH =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const CATALOG_PATH =
  "frontend/src/features/dashboard/config/dashboardModules.ts";
const CONFIG_BARREL_PATH = "frontend/src/features/dashboard/config/index.ts";

// TEST-GLOBAL-07 (G06-D06): the workspace state is initialised by executing its
// initializer — no `initialModule` resolves to the catalog default, a given one
// is kept. `initialModule ?? DEFAULT_CLINIC_MODULE` stays in the source when
// the result is overridden (C.15.1 M-D16).
function initialWorkspace(source: string, catalog: string, barrel: string) {
  const file = parseTsx(source, CLINIC_CONTROLLER_PATH);
  const declarations = descendants(file, ts.isVariableDeclaration);
  const states = declarations.filter(
    (declaration) =>
      ts.isArrayBindingPattern(declaration.name) &&
      declaration.name.elements.map((element) => element.getText()).join(",") ===
        "activeModule,setActiveModule",
  );
  const call =
    states.length === 1 && states[0].initializer ? unwrap(states[0].initializer) : undefined;
  const importsDefault = file.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "@/features/dashboard/config" &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) => element.name.text === "DEFAULT_CLINIC_MODULE" && !element.propertyName,
      ),
  );
  const shadowed = declarations.some(
    (declaration) => declaration.name.getText() === "DEFAULT_CLINIC_MODULE",
  );
  // The import resolves through the config barrel: it must forward the catalog
  // binding, neither declaring its own nor forwarding another module's.
  const barrelFile = parseTsx(barrel, CONFIG_BARREL_PATH);
  const forwardsCatalog = barrelFile.statements.some(
    (statement) =>
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "./dashboardModules" &&
      (statement.exportClause === undefined ||
        (ts.isNamedExports(statement.exportClause) &&
          statement.exportClause.elements.some(
            (element) => element.name.text === "DEFAULT_CLINIC_MODULE" && !element.propertyName,
          ))),
  );
  const barrelOverrides =
    descendants(barrelFile, ts.isVariableDeclaration).some(
      (declaration) => declaration.name.getText() === "DEFAULT_CLINIC_MODULE",
    ) ||
    descendants(barrelFile, ts.isExportSpecifier).some(
      (specifier) =>
        specifier.name.text === "DEFAULT_CLINIC_MODULE" &&
        !(
          ts.isExportDeclaration(specifier.parent.parent) &&
          specifier.parent.parent.moduleSpecifier !== undefined &&
          ts.isStringLiteral(specifier.parent.parent.moduleSpecifier) &&
          specifier.parent.parent.moduleSpecifier.text === "./dashboardModules"
        ),
    );
  const [catalogDefault] = descendants(parseTsx(catalog, CATALOG_PATH), ts.isVariableDeclaration)
    .filter((declaration) => declaration.name.getText() === "DEFAULT_CLINIC_MODULE")
    .map((declaration) => (declaration.initializer ? unwrap(declaration.initializer) : undefined));
  const defaultModule =
    catalogDefault && ts.isStringLiteral(catalogDefault) ? catalogDefault.text : undefined;

  if (
    !call ||
    !ts.isCallExpression(call) ||
    call.expression.getText() !== "useState" ||
    call.arguments.length !== 1
  ) {
    return "activeModule is not a single useState(initial)";
  }

  const [initializer] = call.arguments;

  return {
    defaultFromCatalog: importsDefault && !shadowed && forwardsCatalog && !barrelOverrides,
    catalogDefault: defaultModule ?? "not a literal",
    resolved: [undefined, null, "informes", "logistica"].map((initialModule) => {
      const initial = evaluate(initializer, { initialModule, DEFAULT_CLINIC_MODULE: defaultModule });
      return typeof initial === "function" ? initial() : initial;
    }),
  };
}

// ── Hero component: presentational and accessible ────────────────────────────

test("DashboardHubHero exports a typed presentational hero component", () => {
  const source = read(HERO_PATH);

  assert.ok(source.includes("export type DashboardHubHeroProps"));
  assert.ok(source.includes("export type DashboardHubHeroMetric"));
  assert.ok(source.includes("export type DashboardHubHeroStatusTone"));
  assert.ok(source.includes("export function DashboardHubHero("));
  assert.ok(source.includes('variant: "clinic" | "admin";'));
  assert.ok(source.includes("metrics: DashboardHubHeroMetric[];"));
});

test("DashboardHubHero keeps hub-hero landmark, heading id and metric/action contracts", () => {
  const source = read(HERO_PATH);

  assert.ok(source.includes("data-dashboard-hub-hero={variant}"));
  assert.ok(source.includes('aria-labelledby="dashboard-hub-hero-title"'));
  assert.ok(source.includes('id="dashboard-hub-hero-title"'));
  assert.ok(source.includes("metrics.map((metric) =>"));
  assert.ok(source.includes("onClick={onPrimaryAction}"));
  assert.ok(source.includes("focus-visible:ring-2"));
});

test("DashboardHubHero does not fetch data or import server/public surfaces", () => {
  const source = read(HERO_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes('from "@/lib/api"'), false);
  assert.equal(source.includes('from "@/app/api'), false);
  assert.equal(source.includes('from "next/headers"'), false);
  assert.equal(source.includes("@/components/public/"), false);
  assert.equal(source.toLowerCase().includes("middleware"), false);
});

test("DashboardHubHero stores or renders no sensitive identifiers", () => {
  const source = read(HERO_PATH).toLowerCase();

  for (const forbidden of [
    "session",
    "auth",
    "cookie",
    "token",
    "password",
    "secret",
    "jwt",
    "bearer",
    "hash",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `hero must not reference ${forbidden}`,
    );
  }
});

// ── Module hub: optional hero slot above cards ───────────────────────────────

test("DashboardModuleHub renders the hero slot outside the module-card section", () => {
  const source = read(HUB_PATH);

  assert.ok(source.includes("hero?: ReactNode;"));
  assert.ok(source.includes("hero,"));
  assert.ok(source.includes('data-dashboard-hub-hero-slot="true"'));
  assert.ok(source.includes('data-dashboard-module-hub="true"'));
  assert.ok(source.includes("data-dashboard-module-card={card.moduleId}"));

  // Regression guard for the E2E `hub.locator("button")` selector: the hero
  // (with its CTA button) must render BEFORE/OUTSIDE the module-card section so
  // it is never counted among the hub's accessible module cards.
  const heroSlotIndex = source.indexOf('data-dashboard-hub-hero-slot="true"');
  const moduleHubIndex = source.indexOf('data-dashboard-module-hub="true"');
  assert.ok(heroSlotIndex >= 0);
  assert.ok(moduleHubIndex >= 0);
  assert.ok(
    heroSlotIndex < moduleHubIndex,
    "hero slot must render before (outside) the module-card section",
  );
});

// ── Clinic controller wiring ─────────────────────────────────────────────────

test("clinic controller opens directly into a module workspace with the shared rail (no hub)", () => {
  const source = read(CLINIC_CONTROLLER_PATH);

  assert.equal(source.includes('import { DashboardHubHero } from "./DashboardHubHero";'), false);
  assert.equal(source.includes('import { DashboardModuleHub } from "./DashboardModuleHub";'), false);

  // No home/hub: none of the clinic cockpit markup may remain.
  assert.equal(source.includes('data-clinic-cockpit="true"'), false);
  assert.equal(source.includes('data-clinic-cockpit-status="true"'), false);
  assert.equal(source.includes('data-clinic-cockpit-attention="true"'), false);
  assert.equal(source.includes('data-clinic-cockpit-continuity="true"'), false);
  assert.equal(source.includes('data-clinic-cockpit-activity="true"'), false);
  assert.equal(source.includes('data-clinic-cockpit-modules="true"'), false);
  assert.equal(source.includes('data-clinic-cockpit-primary-actions="true"'), false);
  assert.equal(source.includes('data-dashboard-module-hub'), false);
  assert.equal(source.includes('Módulos clínicos'), false);

  // B09: the stage holds no navigation at all. The single mobile owner
  // (`DashboardMobileNav`) sits at shell level and the B07/B08 lateral band
  // owns >=768px, so the controller only resolves the active module — always to
  // a real one (operational default), because there is no hub.
  assert.equal(source.includes("DashboardModuleRail"), false);
  // The operational default lives in the config catalog (single source of
  // truth); the controller imports and re-exports it for compatibility and
  // always resolves to it.
  assert.ok(
    source.includes('import type { ClinicModule } from "@/features/dashboard/config";'),
  );
  assert.ok(source.includes('export { DEFAULT_CLINIC_MODULE };'));
  assert.ok(
    read(CATALOG_PATH).includes(
      'export const DEFAULT_CLINIC_MODULE: ClinicModule = "operaciones";',
    ),
  );
  assert.ok(source.includes('initialModule ?? DEFAULT_CLINIC_MODULE'));

  const catalog = read(CATALOG_PATH);
  const barrel = read(CONFIG_BARREL_PATH);
  const opensDefault = {
    defaultFromCatalog: true,
    catalogDefault: "operaciones",
    resolved: ["operaciones", "operaciones", "informes", "logistica"],
  };
  assert.deepEqual(initialWorkspace(source, catalog, barrel), opensDefault);

  const overridden = source.replace(
    "initialModule ?? DEFAULT_CLINIC_MODULE,",
    () => '(initialModule ?? DEFAULT_CLINIC_MODULE) && ("informes" as ClinicModule),',
  );
  assert.notEqual(overridden, source);
  assert.deepEqual(initialWorkspace(overridden, catalog, barrel), {
    ...opensDefault,
    resolved: ["informes", "informes", "informes", "informes"],
  });

  // The operational stage wrapper contract is preserved.
  assert.ok(source.includes('data-dashboard-module-stage="true"'));
  assert.ok(source.includes('data-clinic-dashboard-stage="true"'));
  assert.equal(source.includes('variant="admin"'), false);
});

// ── Admin controller wiring ──────────────────────────────────────────────────

test("admin controller no longer renders the hub hero (admin hub retired at every width)", () => {
  const source = read(ADMIN_CONTROLLER_PATH);

  // Desktop/tablet space pass: the hero was part of the admin hub, which the
  // reference captures retire from 768px up (pre-C05 retired it below 768px).
  for (const retired of ["DashboardHubHero", "adminHero", "auditEntriesCount", "eventTypesCount", "activateModule"]) {
    assert.equal(source.includes(retired), false, `retired: ${retired}`);
  }
});

test("admin page forwards live audit counts to the command center, not the controller", () => {
  const source = read(ADMIN_PAGE_PATH);
  const controller = source.slice(source.indexOf("<AdminDashboardWorkspaceController"));

  assert.ok(source.includes("auditEntriesCount={auditOverviewSnapshot.pagination.total}"));
  assert.ok(source.includes("eventTypesCount={eventTypesCount}"));
  assert.equal(controller.includes("auditEntriesCount="), false, "the controller takes no hero counts");
  assert.equal(controller.includes("systemStatusLabel="), false);
});

// ── Scope invariant: no new dependency surfaced by this feature ──────────────

test("hero feature does not register itself as a dependency", () => {
  const rootPkg = readSourceFile("package.json");
  const frontendPkg = readSourceFile("frontend/package.json");

  assert.equal(rootPkg.includes("DashboardHubHero"), false);
  assert.equal(frontendPkg.includes("DashboardHubHero"), false);
});
