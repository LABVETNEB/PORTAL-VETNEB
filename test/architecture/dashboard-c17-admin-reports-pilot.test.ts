import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

const card = () => readSourceFile("frontend/src/app/dashboard/admin/AdminReportsCard.tsx");
const page = () => readSourceFile("frontend/src/app/dashboard/admin/page.tsx");

test("C17 mounts the real reports module in its existing scaffold and collection grammar", () => {
  const source = card();
  assert.match(page(), /id="admin-report-upload"[\s\S]*?<AdminReportsCard \/>/);
  assert.match(readSourceFile("frontend/src/components/dashboard/DashboardModuleWorkspace.tsx"), /<WorkspaceScaffold\b/);
  for (const primitive of ["CollectionWorkspace", "CollectionHeader", "ContentList", "ContentListItem", "CollectionState", "CollectionPager"]) {
    assert.match(source, new RegExp(`<${primitive}\\b`), `${primitive} must render in reports`);
  }
  assert.match(source, /data-dashboard-adaptive-rows-canvas="true"/);
  assert.match(source, /getAdminReportWorkflow\(\{[\s\S]*?limit: query\.limit,[\s\S]*?offset: query\.offset/);
});

test("C17 gives S3 and the collection one owner without expanding the report API", () => {
  const source = card();
  assert.match(source, /<SuperSearchField\b/);
  assert.match(source, /<ActiveFilterChips\b/);
  assert.match(source, /<AdvancedFilterSheet\b/);
  assert.match(source, /useCollectionSelection<number>\(/);
  assert.match(source, /<SelectionToolbar\b/);
  assert.match(source, /<ActionMenu\b/);
  assert.match(source, /<DetailsPane\b/);
  assert.match(source, /<DetailsHeader\b/);
  assert.match(source, /<DetailsMetadata\b/);
  assert.doesNotMatch(source, /<BulkActionMenu\b/, "no server bulk operation exists for reports");
  assert.match(source, /report: filterDraft\.report\.trim\(\)/);
  assert.match(source, /setOffset\(0\)/);
  assert.doesNotMatch(source, /getAdminReportWorkflow\(\{[^}]*?(?:sort|search|filters):/);
});

test("G11-a keeps the S3 refresh button named when its label is hidden below sm", () => {
  const source = card();
  const refresh = source.match(/<Button\b(?:(?!<\/Button>)[\s\S])*?<span className="hidden sm:inline">Actualizar<\/span>\s*<\/Button>/);
  assert.ok(refresh, "the S3 refresh button must exist");
  assert.match(refresh[0], /\baria-label="Actualizar"[\s\S]*<RefreshCw aria-hidden="true" \/>/);
});
