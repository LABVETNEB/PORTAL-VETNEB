import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

const ADMIN = "frontend/src/app/dashboard/admin";
const PATHS = {
  pricing: `${ADMIN}/AdminPricingEditorCard.tsx`,
  pricingMobile: `${ADMIN}/AdminMobilePricingModule.tsx`,
  maintenance: `${ADMIN}/AdminMaintenanceDryRunCard.tsx`,
  maintenanceMobile: `${ADMIN}/AdminMobileMaintenanceModule.tsx`,
  schema: `${ADMIN}/AdminSchemaHealthStatusCard.tsx`,
  healthMobile: `${ADMIN}/AdminMobileHealthModule.tsx`,
  summary: `${ADMIN}/AdminCommandCenter.tsx`,
  summaryMobile: `${ADMIN}/AdminMobileCommandModule.tsx`,
  page: `${ADMIN}/page.tsx`,
} as const;
type Sources = Record<keyof typeof PATHS, string>;

const read = (): Sources =>
  Object.fromEntries(Object.entries(PATHS).map(([key, path]) => [key, readSourceFile(path)])) as Sources;

const LATER_PRIMITIVES =
  /<(?:SuperSearchField|FilterChip|ActiveFilterChips|AdvancedFilterSheet|SelectionToolbar|BulkActionMenu|DetailsPane)\b|useCollectionSelection|aria-sort/;

function c20Violations(s: Sources): string[] {
  const violations: string[] = [];
  const need = (key: keyof Sources, pattern: RegExp | string, why: string) => {
    const ok = typeof pattern === "string" ? s[key].includes(pattern) : pattern.test(s[key]);
    if (!ok) violations.push(`${key}: ${why}`);
  };
  const forbid = (key: keyof Sources, pattern: RegExp | string, why: string) => {
    const hit = typeof pattern === "string" ? s[key].includes(pattern) : pattern.test(s[key]);
    if (hit) violations.push(`${key}: ${why}`);
  };

  for (const key of ["pricing", "pricingMobile", "maintenance", "maintenanceMobile", "schema", "healthMobile"] as const) {
    need(key, '} from "@/features/dashboard/presentation/surfaces";', "primitives come through the surfaces boundary");
    forbid(key, /<(?:EmptyState|ErrorState|LoadingState|CompactPager)\b|className="surface-empty"/, "legacy state adapters, compact adapter and ad hoc empty blocks are replaced");
    forbid(key, LATER_PRIMITIVES, "C20 adds no search, filter, selection, sorting or details geometry to non-tabular surfaces");
  }

  // Precios: the per-item manual form, Guardar todos and the single unpaged GET stay; forms are never list items.
  need("pricing", /<CollectionWorkspace\s+ref=\{setFormsBodyNode\}\s+data-dashboard-adaptive-rows-canvas="true"\s+data-dashboard-row-pitch="regular"/, "the measured forms canvas is the CollectionWorkspace");
  need("pricing", '<ContentList as="div" className="contents divide-y divide-vetneb-line/60">', "the form rows keep their separator inside a `contents` C01 list");
  need("pricing", /<form\s+key=\{item\.id\}\s+data-admin-pricing-item-form\s+data-dashboard-adaptive-row="true"/, "each study stays a native form row locked to the pitch");
  need("pricing", /\{fitsInOneView \? null : \(\s*<CollectionPager\s+variant="compact"/, "the overflow pager is the C02 compact variant and only mounts on overflow");
  need("pricing", /<CollectionState\s+variant="error"\s+tone="warning"[\s\S]*?message=\{loadError\}/, "load error is the C03 alert");
  need("pricing", /<CollectionState\s+variant="loading"[\s\S]*?label="Cargando precios\.\.\."/, "loading keeps the text the A02 matrix waits on");
  need("pricing", /<CollectionState\s+variant="empty"[\s\S]*?description=\{EMPTY_STATE_MESSAGE\}/, "empty keeps its copy");
  need("pricing", "const response = await updateAdminPricingItem(itemId, payload);", "per-item save preserved");
  need("pricing", "const response = await updateAdminPricingItem(id, payload);", "Guardar todos preserved");
  need("pricing", "data-save-all", "Guardar todos keeps its marker");
  need("pricing", "const snapshot = await getAdminPricing();", "one GET of the catalog");
  forbid("pricing", /\blimit\b|\boffset\b/, "pricing never sizes or offsets a request");
  forbid("pricing", /<ContentListItem\b/, "a native form is not a C01 item");

  need("pricingMobile", '<ContentList as="div" className="contents">', "the catalog buttons stay flex items of the gapped canvas");
  need("pricingMobile", /<button\s+key=\{item\.id\}\s+type="button"\s+data-admin-mobile-config-item="true"\s+data-dashboard-adaptive-row="true"/, "each catalog row stays the button that selects the study");
  need("pricingMobile", /<CollectionState\s+variant="loading"[\s\S]*?label="Cargando precios…"/, "catalog loading through C03");
  need("pricingMobile", /<CollectionState\s+variant="empty"\s+title="Sin precios configurados\."/, "empty keeps the text the A02 matrix rejects as loaded");
  need("pricingMobile", "await updateAdminPricingItem(current.id, payload);", "mobile save preserved");
  if ((s.pricingMobile.match(/<AdminMobileOpsPager\b/g) ?? []).length !== 2) {
    violations.push("pricingMobile: editor and catalog keep their mobile pagers");
  }

  // Mantenimiento: dry-run only; the canvas itself is the list because A03 counts its direct children.
  need("maintenance", /<ContentList\s+as="div"\s+ref=\{setCandidatesListNode\}\s+data-admin-maintenance-candidates-list="true"\s+data-dashboard-adaptive-rows-canvas="true"\s+data-dashboard-row-pitch="card"\s+data-dashboard-row-gap="loose"/, "the measured candidates canvas is the C01 list");
  need("maintenance", /<ContentListItem\s+as="div"\s+ref=\{ref\}\s+data-dashboard-adaptive-row="true"/, "each candidate group is a C01 item locked to the pitch");
  need("maintenance", /<CollectionPager\s+variant="compact"[\s\S]*?itemLabel="grupos"/, "the candidate pager is the C02 compact variant");
  need("maintenance", /<CollectionState\s+variant="error"[\s\S]*?message=\{error\}/, "the dry-run error is announced by the C03 alert");
  need("maintenance", /<CollectionState\s+variant="empty"\s+title="Sin análisis ejecutado"/, "initial state through C03");
  need("maintenance", "const result = await getAdminMaintenancePurgeDryRun();", "only the dry-run endpoint is called");
  forbid("maintenance", /delete|purge\(/, "no destructive maintenance operation");

  need("maintenanceMobile", /<ContentList\s+as="div"\s+ref=\{setCandidatesListNode\}\s+data-admin-mobile-maintenance-candidates-list="true"/, "the measured mobile canvas is the C01 list");
  need("maintenanceMobile", /<ContentListItem\s+as="div"\s+key=\{candidate\.category\}\s+data-admin-mobile-config-item="true"\s+data-admin-mobile-maintenance-candidate-row="true"\s+data-dashboard-adaptive-row="true"/, "candidate rows are C01 items with the A03 row marker");
  need("maintenanceMobile", /<CollectionState\s+variant="loading"[\s\S]*?label="Consultando estado de esquema…"/, "schema loading keeps the text the A02 matrix waits on");
  need("maintenanceMobile", "pagedCandidates.setPage(0);\n          setSnapshot(nextSnapshot);", "fresh dataset and first page publish in one batch");
  forbid("maintenanceMobile", /delete|purge\(/, "no destructive maintenance operation");

  // Estado del sistema: the error alert the A02 matrix detects and the HTTP sanitization stay.
  need("schema", '<div role="alert" className="clinical-alert-error">', "the load error keeps the alert the A02 matrix detects");
  need("schema", 'if (message.startsWith("HTTP ")) {', "raw HTTP failures stay sanitized");
  need("schema", /<CollectionState\s+variant="loading"[\s\S]*?label="Consultando estado de esquema\.\.\."/, "loading keeps the text the A02 matrix waits on");
  need("schema", /<ContentList as="ul"[^>]*>\s*\{snapshot\.missing\.map\(\(missingColumn\) => \(\s*<ContentListItem\s+as="li"/, "missing columns are the C01 list");
  need("healthMobile", /<ContentList\s+as="div"\s+className="grid min-h-0 flex-1 gap-1\.5 overflow-hidden"\s+style=\{\{ gridTemplateRows:/, "the service rows keep their equal-row grid as the C01 list");
  need("healthMobile", /<ContentListItem\s+as="div"\s+key=\{service\.label\}\s+data-admin-mobile-status-item="true"/, "each service is a C01 item");
  need("healthMobile", /<CollectionState\s+variant="loading"[\s\S]*?label="Consultando estado de esquema\.\.\."/, "schema loading through C03");
  need("healthMobile", '<div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5 overflow-hidden">', "runtime stays four metric tiles, not a list");
  for (const key of ["schema", "healthMobile"] as const) {
    forbid(key, /cookie|password|DATABASE_URL|connectionString|stack/i, "no secret, credential or stack reaches the status surface");
  }

  // Resumen: no collection, so no collection primitive; the server page keeps the client barrel out.
  for (const key of ["summary", "summaryMobile"] as const) {
    forbid(key, /<(?:CollectionWorkspace|CollectionHeader|ContentList|ContentListItem|CollectionState|CollectionPager)\b/, "metric tiles and notes are not a collection");
    need(key, "<AdminOverviewQuickLinks />", "quick links stay");
  }
  need("summary", 'role="group"', "metrics keep their group");
  need("summaryMobile", '<AdminFailedLoginAlertsReadOnlyCard presentation="mobile" />', "Alertas keeps the C19 card");
  forbid("page", "@/features/dashboard/presentation/surfaces", "the server page renders the services grid without the client surfaces barrel");
  need("page", '{ id: "servicios", label: "Servicios", content: healthServicesGrid },', "desktop Servicios tab unchanged");
  return violations;
}

test("C20 adopts the applicable primitives in Precios, Mantenimiento and Estado and leaves Resumen without a collection", () => {
  assert.deepEqual(c20Violations(read()), []);
});

test("C20 guard rejects reverting each module to its pre-C20 grammar or moving an operation", () => {
  const sources = read();
  const mutants: ReadonlyArray<readonly [keyof Sources, string, string]> = [
    ["pricing", "<CollectionWorkspace\n        ref={setFormsBodyNode}", "<div\n        ref={setFormsBodyNode}"],
    ["pricing", '<ContentList as="div" className="contents divide-y divide-vetneb-line/60">', '<ContentList as="div">'],
    ["pricing", '<CollectionPager\n          variant="compact"', "<CompactPager"],
    ["pricing", "const response = await updateAdminPricingItem(id, payload);", "const response = { pricingItem: null as never };"],
    ["pricingMobile", 'title="Sin precios configurados."', 'title="Sin precios"'],
    ["maintenance", "<ContentList\n              as=\"div\"\n              ref={setCandidatesListNode}", "<div\n              ref={setCandidatesListNode}"],
    ["maintenance", "message={error}", "message={String(error)}"],
    ["maintenanceMobile", "pagedCandidates.setPage(0);\n          setSnapshot(nextSnapshot);", "setSnapshot(nextSnapshot);\n          pagedCandidates.setPage(0);"],
    ["schema", '<div role="alert" className="clinical-alert-error">', '<div role="alert">'],
    ["schema", 'label="Consultando estado de esquema..."', 'label="Cargando..."'],
    ["healthMobile", "<ContentListItem\n            as=\"div\"\n            key={service.label}", "<div\n            key={service.label}"],
    ["summary", "<AdminOverviewQuickLinks />", '<ContentList as="div" />'],
  ];
  for (const [key, anchor, replacement] of mutants) {
    const at = sources[key].indexOf(anchor);
    assert.ok(at >= 0 && at === sources[key].lastIndexOf(anchor), `unique ${key} anchor: ${anchor}`);
    const mutated = sources[key].replace(anchor, () => replacement);
    assert.notEqual(mutated, sources[key]);
    assert.notDeepEqual(c20Violations({ ...sources, [key]: mutated }), [], `mutation must be rejected: ${key} ${anchor}`);
  }
});
