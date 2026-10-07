import assert from "node:assert/strict";
import test from "node:test";
import { readDashboardCssSource } from "../helpers/read-dashboard-css-source.ts";
import { readSourceFile as read } from "../helpers/tracked-source-files.ts";

// ── CLINIC-DT · clinic desktop/tablet space pass (Nico, clinicas.zip) ─────────
// From 768px up the clinic dashboard gives its chrome back to the modules: the
// module header band, the summary runs and the section intros marked red on
// the reference captures are RETIRED; the controls marked yellow are MOVED up
// (one instance per regime, same handler); Informes, Logística and Tokens page
// with Anterior/Siguiente only, centered; Perfil becomes avatar + single-open
// section rows + save. limit/offset, C04, C05 and the backend are frozen, and
// below 768px nothing changes. Runtime proof: CLINIC-DT-SPACE
// (frontend/e2e/clinic/shell/dashboard-clinic-desktop-tablet-space.spec.ts).

const COMMAND_CENTER = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
const INFORMES = "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx";
const LOGISTICA = "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx";
const PERFIL = "frontend/src/components/dashboard/ClinicPublicProfileCard.tsx";
const TOKENS = "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx";
const PAGER = "frontend/src/components/dashboard/DashboardPager.tsx";
const PASSWORD = "frontend/src/components/dashboard/PasswordChangePanel.tsx";
const MODULE_CARD = "frontend/src/components/dashboard/ModuleCard.tsx";
const CONTROLLER = "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";
const WORKSPACES = [COMMAND_CENTER, INFORMES, LOGISTICA, PERFIL, TOKENS] as const;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.ok(from !== -1, `missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to !== -1, `missing ${end} after ${start}`);
  return source.slice(from, to);
}

function count(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

test("CLINIC-DT · the module header band is reclaimed from 768px up for the clinic surface only", () => {
  const css = readDashboardCssSource();
  const block = between(
    css,
    "/* clinic-desktop-tablet-module-header-reclaim:start */",
    "/* clinic-desktop-tablet-module-header-reclaim:end */",
  );
  assert.ok(block.includes("@media (min-width: 768px)"), "desktop/tablet regime only");
  assert.ok(
    /\[data-vetneb-app-shell-surface="clinic"\]\s+\[data-dashboard-module-workspace\]\s+\.dashboard-workspace-header\s*\{\s*display: none !important;/.test(block),
    "the band is hidden on the clinic surface",
  );
  assert.ok(
    /\[data-vetneb-app-shell-surface="clinic"\]\s+\[data-dashboard-module-workspace\]\s+\[data-dashboard-module-viewport\]\s*\{\s*padding-top: 0 !important;/.test(block),
    "and its 16px gap goes with it",
  );
  assert.ok(
    /\[data-clinic-profile-editor="true"\] > \.dashboard-module-card-chips\s*\{\s*display: none;/.test(block),
    "Perfil's chips give way to the section rows",
  );
  // The section keeps its accessible name: the controller still feeds the title.
  const controller = read(CONTROLLER);
  assert.ok(controller.includes("title={meta.title}"));
  assert.ok(controller.includes('title: "Centro de operaciones"'));
});

test("CLINIC-DT · no clinic workspace mounts a summary run (red on every capture)", () => {
  for (const path of WORKSPACES) {
    const source = read(path);
    assert.equal(source.includes("ModuleMetricRun"), false, `${path}: summary run retired`);
    assert.equal(source.includes("data-dashboard-b14-metrics"), false, `${path}: no run hook`);
  }
});

test("CLINIC-DT · Operaciones: intro retired visually, tabs and cards first", () => {
  const source = read(COMMAND_CENTER);
  assert.equal(source.includes("header={"), false, "no band above the chips");
  assert.ok(source.includes('className="dashboard-section-heading md:sr-only"'), "heading = accessible name only");
  assert.ok(source.includes('className="dashboard-section-description md:hidden"'), "description stops painting");
  assert.ok(source.includes('aria-labelledby="clinic-command-center-heading"'));
  for (const label of ['label: "Métricas"', 'label: "Recientes"', 'label: "Estado"']) {
    assert.ok(source.includes(label), `${label} stays`);
  }
  assert.ok(source.includes("<StatsCards stats={stats} />"), "the four cards stay");
});

test("CLINIC-DT · Informes and Tokens: filters left, actions right, in one wrapping band", () => {
  const informes = read(INFORMES);
  const informesBand = between(informes, 'data-clinic-reports-toolbar="true"', "</div>\n      <div");
  assert.ok(informesBand.includes("{!reportsLoadError ? renderAdvancedFilterForm() : null}"), "Informes filters moved into the band");
  assert.ok(informesBand.indexOf("renderAdvancedFilterForm()") < informesBand.indexOf("{fullModuleLink}"), "filters before the CTA");
  assert.equal(count(informes, "renderAdvancedFilterForm()"), 1, "one desktop filter bar");
  assert.ok(informes.includes("md:shrink md:grow md:basis-[36rem]"), "the bar's basis is its grid's width");
  assert.ok(informes.includes("minmax(8.5rem,0.85fr)_minmax(8.5rem,0.85fr)"), "date fields cannot overflow their tracks");

  const tokens = read(TOKENS);
  const tokensBand = between(tokens, 'data-clinic-access-toolbar="true"', "<ModuleDialog");
  assert.ok(tokensBand.includes("{tokens.length ? renderAdvancedFilterForm() : null}"), "Tokens filters moved into the band");
  assert.ok(tokensBand.includes("md:flex-wrap md:justify-end"), "actions wrap right when both do not fit");
  assert.equal(count(tokens, "renderAdvancedFilterForm()"), 1, "one desktop filter bar");
  assert.ok(tokens.includes("md:shrink md:grow md:basis-[36rem]"));
  assert.ok(tokens.includes("minmax(8.5rem,0.85fr)_minmax(8.5rem,0.85fr)"));
  // Red: description line, list header band ("Últimos tokens…", "Pág. N").
  assert.ok(tokens.includes('                  : "hidden text-muted-foreground"'), "default description never paints");
  for (const retired of ["Últimos tokens de la clínica", "Lista paginada sin scroll interno.", "ParticularTokensPanelHeader"]) {
    assert.equal(tokens.includes(retired), false, `${retired} retired`);
  }
  // Yellow: both actions keep their single handler.
  assert.equal(count(tokens, "onClick={() => void loadTokens(effectiveFetchLimit)}"), 1);
  assert.equal(count(tokens, "onClick={() => setIsCreateDialogOpen(true)}"), 1);
});

test("CLINIC-DT · Logística: summary retired, CTA right-aligned from 768px up", () => {
  const source = read(LOGISTICA);
  assert.ok(source.includes("p-1.5 md:justify-end"));
  assert.equal(count(source, "{fullModuleLink}"), 1);
});

test("CLINIC-DT · clinic pagers paint Anterior/Siguiente only from 768px up; logic untouched", () => {
  const informes = stripComments(read(INFORMES));
  assert.ok(informes.includes('data-clinic-reports-pagination-status="true"\n                className="min-w-16 text-center md:hidden"'));
  assert.ok(informes.includes("disabled={!pagedReports.hasPrev}"));
  assert.ok(informes.includes("disabled={!pagedReports.hasNext}"));

  const tokens = stripComments(read(TOKENS));
  assert.ok(tokens.includes('data-clinic-access-pagination-status="true"\n                      className="min-w-16 text-center md:hidden"'));
  const tokensPager = between(tokens, "<ParticularTokensPanelFooter", "</ParticularTokensPanelFooter>");
  assert.ok(tokensPager.includes('className="flex items-center justify-center gap-1.5"'), "centered at every width");
  assert.equal(tokensPager.includes("md:justify-end"), false, "no longer pushed right from 768px up");
  assert.ok(tokens.includes("disabled={!pagedTokens.hasPrev || isLoadingTokens}"));
  // Review P2: the phone-only painted state keeps an assistive equivalent
  // from 768px up (live, atomic, never painted there, absent on phones).
  const announcement = between(tokensPager, 'data-clinic-access-pagination-announcement="true"', "</span>");
  assert.ok(announcement.includes('className="hidden md:block md:sr-only"'));
  assert.ok(announcement.includes('aria-live="polite"'));
  assert.ok(announcement.includes('aria-atomic="true"'));
  assert.ok(announcement.includes("Página ${pagedTokens.page + 1} de ${pagedTokens.pageCount}"));

  const logistica = read(LOGISTICA);
  assert.ok(logistica.includes('pageStateRegime="phone-only"'));
  const pager = read(PAGER);
  assert.ok(pager.includes('pageStateRegime === "phone-only" && "md:hidden"'));
  assert.ok(pager.includes('pageStateRegime?: "phone-only";'), "opt-in: admin and the full routes keep their pager");
  // The sr-only range announcement survives on every clinic pager.
  assert.ok(informes.includes('<span className="sr-only" aria-live="polite">'));
  assert.ok(logistica.includes("rangeLabel={"));
});

test("CLINIC-DT · frozen contracts: page size, fetch windows and row pitch untouched", () => {
  const informes = read(INFORMES);
  assert.ok(informes.includes("fallbackItems: REPORTS_PAGE_SIZE,\n    minItems: 2,"));
  assert.ok(informes.includes('data-dashboard-row-pitch="regular"'));
  const logistica = read(LOGISTICA);
  assert.ok(logistica.includes('data-dashboard-row-pitch="tall"'));
  const tokens = read(TOKENS);
  assert.ok(tokens.includes("const TOKENS_FETCH_LIMIT_MAX = 36;"));
  assert.ok(tokens.includes("const TOKENS_FETCH_PAGE_MULTIPLIER = 3;"));
  assert.ok(tokens.includes('data-dashboard-row-pitch="regular"'));
});

test("CLINIC-DT · Perfil: avatar on top, single-open rows in order, one form, save last", () => {
  const source = read(PERFIL);
  const stack = between(source, "const profileStack = (", "const hasProfileLoadState");
  const order = [
    "{statusTab}",
    'renderSectionToggle("datos")',
    'renderSection("datos", detailsTab)',
    'renderSectionToggle("contacto")',
    'renderSection("contacto", contactTab)',
    'renderSectionToggle("contenido")',
    'renderSection("contenido", contentTab)',
    "renderSectionToggle(PASSWORD_TAB_ID)",
    "renderSection(\n        PASSWORD_TAB_ID,",
    'data-clinic-profile-desktop-actions="true"',
    "{saveProfileButton}",
  ].map((needle) => {
    const index = stack.indexOf(needle);
    assert.ok(index !== -1, `stack contains ${needle}`);
    return index;
  });
  assert.deepEqual([...order].sort((a, b) => a - b), order, "avatar → Datos → Contacto → Contenido → Cambiar contraseña → Guardar");
  assert.ok(stack.includes("md:max-w-3xl"), "rows keep a readable width on wide desktops");

  // Single source of truth: the chips (<768px) and the rows (>=768px) drive the
  // same activeTabId; a row toggles between its section and none.
  assert.ok(source.includes("activeId={activeTabId}"));
  assert.ok(source.includes("current === sectionId ? STATUS_TAB_ID : sectionId"));
  assert.ok(source.includes("aria-expanded={isOpen}"));
  assert.ok(source.includes("aria-controls={`${sectionBaseId}-section-${sectionId}`}"));
  assert.ok(source.includes('type="button"\n        id={`${sectionBaseId}-toggle-${sectionId}`}'), "rows are native buttons");
  assert.ok(source.includes("focus-visible:ring-2"), "visible focus on the rows");

  // State: values live in formState; the password panel stays mounted hidden;
  // one profile form for every section; the save handler is unchanged.
  assert.ok(source.includes("{isOpen || keepMounted ? content : null}"));
  assert.equal(count(source, "id={PROFILE_FORM_ID}"), 1);
  assert.equal(count(source, "onSubmit={handleSubmit}"), 1);
  assert.ok(source.includes("updateClinicPublicProfile(buildPayload(formState))"));
  assert.equal(count(source, "const saveProfileButton = !isPasswordTabActive ? ("), 1, "one save control, rendered per regime");

  // Red: the summary line paints only for loading/error from 768px up; the
  // footer hint stops painting there. Errors and statuses still render.
  assert.ok(source.includes('!hasProfileLoadState && "md:hidden"'));
  assert.ok(source.includes('!errorMessage && !statusMessage && "md:hidden"'));
  assert.ok(source.includes('<p className="clinical-alert-error px-3 py-1.5" role="alert">'));
  assert.ok(source.includes('<p className="clinical-alert-success px-3 py-1.5" role="status">'));
  // Review P2: the avatar stays operable with "Cambiar contraseña" open from
  // 768px up, so its feedback mounts there while (and only while) a message
  // exists; phones keep the password chip footer-less.
  assert.ok(source.includes("!isPasswordTabActive || errorMessage || statusMessage ? ("));
  assert.ok(source.includes('isPasswordTabActive && "max-md:hidden"'));
  // Yellow: the publication badge is kept and closes the stack next to save.
  assert.equal(count(source, "{publicationBadge}"), 2);
});

test("CLINIC-DT · shared primitives change only by opt-in props (admin untouched)", () => {
  const card = read(MODULE_CARD);
  assert.ok(card.includes("readonly panelClassName?: string;"));
  assert.ok(card.includes("className={cn(PANEL_CLASS, className)}"));
  const password = read(PASSWORD);
  assert.ok(password.includes("embeddedFromMd = false,"));
  assert.ok(password.includes('embeddedFromMd && "md:hidden"'));
  for (const admin of [
    "frontend/src/app/dashboard/admin/page.tsx",
    "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx",
  ]) {
    const source = read(admin);
    assert.equal(source.includes("embeddedFromMd"), false, `${admin} does not opt in`);
    assert.equal(source.includes("pageStateRegime"), false, `${admin} does not opt in`);
  }
});
