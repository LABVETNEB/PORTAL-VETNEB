import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

const ADMIN = "frontend/src/app/dashboard/admin";
const PATHS = {
  tokens: `${ADMIN}/AdminParticularTokensCard.tsx`,
  clinics: `${ADMIN}/AdminClinicsManagementCard.tsx`,
  auditCard: `${ADMIN}/AdminAuditCard.tsx`,
  auditTable: `${ADMIN}/AdminAuditDenseTable.tsx`,
  auditMobile: `${ADMIN}/AdminMobileAuditModule.tsx`,
  auditFilters: `${ADMIN}/AdminAuditFilterBar.tsx`,
  auditDetail: `${ADMIN}/AdminAuditDetailDialog.tsx`,
} as const;
type Sources = Record<keyof typeof PATHS, string>;

const read = (): Sources =>
  Object.fromEntries(Object.entries(PATHS).map(([key, path]) => [key, readSourceFile(path)])) as Sources;

function c18Violations(s: Sources): string[] {
  const violations: string[] = [];
  const need = (key: keyof Sources, pattern: RegExp | string, why: string) => {
    const ok = typeof pattern === "string" ? s[key].includes(pattern) : pattern.test(s[key]);
    if (!ok) violations.push(`${key}: ${why}`);
  };
  const forbid = (key: keyof Sources, pattern: RegExp | string, why: string) => {
    const hit = typeof pattern === "string" ? s[key].includes(pattern) : pattern.test(s[key]);
    if (hit) violations.push(`${key}: ${why}`);
  };

  // Tokens: C01/C03/C10/C11/C13 on the same client window and operations.
  need("tokens", /<CollectionWorkspace\s+ref=\{setDesktopBodyNode\}\s+data-dashboard-adaptive-rows-canvas="true"/, "the measured desktop canvas is the CollectionWorkspace");
  need("tokens", '<ContentList as="tbody">', "desktop rows are the C01 list");
  need("tokens", '<ContentList as="div" className="contents divide-y divide-vetneb-line/60">', "the mobile list keeps its row dividers (pitch) on the C01 list");
  need("tokens", "<CollectionHeader>", "sticky C01 header bound to the canvas reserve");
  need("tokens", /<CollectionState variant="(?:loading|error)"/, "loading/error go through C03");
  need("tokens", /<SuperSearchField\s+label="Nombre de clínica"/, "mobile clinic search is the C10 pill inside the same submit form");
  need("tokens", "<ActiveFilterChips filters={activeFilters} onClearAll={clearAdvancedFilters} />", "applied filters are C11 chips");
  need("tokens", /<DetailsPane label=[\s\S]*?<DetailsMetadata/, "the summary tab composes C13");
  need("tokens", "usePagedRows(filteredTokens, rowsPerPage)", "client pagination owner unchanged");
  for (const operation of ["loadMoreTokens()", "handleDeleteToken(selectedToken)", "createAdminParticularToken(", "Token ****{selectedToken.tokenLast4}"]) {
    need("tokens", operation, `operation preserved: ${operation}`);
  }
  forbid("tokens", /<(?:TableHeader|TableBody|TableRow)\b/, "legacy table sections replaced by C01");
  forbid("tokens", /<(?:CollectionPager|BulkActionMenu|SelectionToolbar)\b|useCollectionSelection/, "C18 adds no pager geometry or selection without a server operation");

  // Clínicas: C01/C03 only; C04 sort, server window, search and pager untouched.
  need("clinics", /<CollectionWorkspace\s+ref=\{setDesktopBodyNode\}/, "the measured desktop canvas is the CollectionWorkspace");
  need("clinics", /<ContentListItem as="tr"\s+key=\{`\$\{clinic\.clinicId\}/, "desktop rows are C01 items");
  need("clinics", /<ContentListItem as="article"\s+key=\{`mobile-/, "mobile cards are C01 items");
  need("clinics", '<ContentList as="div" className="contents divide-y divide-vetneb-line/60">', "the mobile list keeps its row dividers");
  need("clinics", /<CollectionState\s+variant="loading"\s+skeleton="table"/, "loading goes through C03 with the same skeleton");
  need("clinics", 'aria-label="Paginación de clínicas"', "the labelled pager landmark stays");
  need("clinics", "...(submittedSearch ? { search: submittedSearch } : {}),", "search request unchanged");
  need("clinics", "const effectiveLimit = rowsPerPage;", "server limit owner unchanged");
  need("clinics", '<TableHead aria-sort={clinicsAriaSort(appliedSort, "name")}>', "C04 sort header unchanged");
  forbid("clinics", /<(?:EmptyState|LoadingState|TableHeader|TableBody|TableRow)\b/, "legacy adapters and table sections replaced");
  forbid("clinics", /<(?:SuperSearchField|CollectionPager)\b/, "the 40px pill and touch pager would move A02/A03 geometry");

  // Auditoría: URL/query contract of S1 is the same GET form, now hosted by C12.
  need("auditFilters", /<FilterBar\s+action="\/dashboard\/admin"\s+method="get"/, "S1 stays a GET form on /dashboard/admin");
  need("auditFilters", '<input type="hidden" name="module" value="audit-log" />', "deep link module param preserved");
  need("auditFilters", 'href="/dashboard/admin?module=audit-log"', "Limpiar keeps the URL reset");
  need("auditFilters", /<AdvancedFilterSheet[\s\S]*?title="Filtrar auditoría"[\s\S]*?<FilterForm \{\.\.\.props\} mobile \/>[\s\S]*?<\/AdvancedFilterSheet>/, "mobile filters are the C12 sheet hosting the same form");
  forbid("auditFilters", /ModuleDialog|onSubmit|router\.(?:push|replace)|preventDefault/, "no client-side rewrite of the S1 submission");
  need("auditTable", '<CollectionState variant="error"', "load failure goes through C03");
  need("auditTable", '<CollectionState variant="empty"', "empty goes through C03");
  forbid("auditTable", /<(?:TableHeader|TableBody|TableRow)\b/, "header row is a C01 item");
  need("auditMobile", /<CollectionState\s+variant="empty"/, "mobile empty goes through C03");
  need("auditDetail", /<DetailsPane label=\{`Detalle del evento \$\{row\.id\}`\}>[\s\S]*?<DetailsMetadata/, "detail composes C13");
  for (const field of ["row.eventCode", "row.date", "row.actor", "row.entity", "row.action", "row.detail"]) {
    need("auditDetail", field, `safe field kept: ${field}`);
  }
  need("auditCard", 'aria-label="Paginación de auditoría"', "the labelled footer pager stays");
  need("auditCard", "style={DASHBOARD_PAGER_RESERVATION}", "pager reservation unchanged");
  return violations;
}

test("C18 migrates Tokens, Clínicas and Auditoría to the shared primitives without moving operations or geometry", () => {
  assert.deepEqual(c18Violations(read()), []);
});

test("C18 guard rejects reverting each module to its pre-C18 grammar", () => {
  const sources = read();
  const mutants: ReadonlyArray<readonly [keyof Sources, string, string]> = [
    ["tokens", "<CollectionWorkspace\n            ref={setDesktopBodyNode}", "<div\n            ref={setDesktopBodyNode}"],
    ["tokens", '<ContentList as="div" className="contents divide-y divide-vetneb-line/60">', '<ContentList as="div">'],
    ["tokens", '<SuperSearchField\n              label="Nombre de clínica"', '<input\n              aria-label="Nombre de clínica"'],
    ["tokens", "<ActiveFilterChips filters={activeFilters} onClearAll={clearAdvancedFilters} />", "{null}"],
    ["tokens", "usePagedRows(filteredTokens, rowsPerPage)", "usePagedRows(filteredTokens, 30)"],
    ["clinics", "renderClinicsEmptyState() {", "renderClinicsEmptyState() { const legacy = <EmptyState title=\"x\" />;"],
    ["clinics", 'aria-label="Paginación de clínicas"', 'aria-label="Paginación"'],
    ["clinics", "const effectiveLimit = rowsPerPage;", "const effectiveLimit = 20;"],
    ["auditFilters", 'method="get"', 'method="post"'],
    ["auditFilters", "<AdvancedFilterSheet", "<ModuleDialog"],
    ["auditFilters", '<input type="hidden" name="module" value="audit-log" />', ""],
    ["auditDetail", "<DetailsPane", "<section"],
    ["auditTable", '<CollectionState variant="error"', '<div role="alert"'],
  ];
  for (const [key, anchor, replacement] of mutants) {
    const at = sources[key].indexOf(anchor);
    assert.ok(at >= 0 && at === sources[key].lastIndexOf(anchor), `unique ${key} anchor: ${anchor}`);
    const mutated = sources[key].replace(anchor, () => replacement);
    assert.notEqual(mutated, sources[key]);
    assert.notDeepEqual(c18Violations({ ...sources, [key]: mutated }), [], `mutation must be rejected: ${key} ${anchor}`);
  }
});
