import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { readDashboardCssSource } from "../helpers/read-dashboard-css-source.ts";

// ─────────────────────────────────────────────────────────────────────────────
// PR-TRUNC · Terminal-surface text integrity, static contract.
//
// WHY THIS GUARD IS NOT `assert(!source.includes("truncate"))`
//
// Truncation is not a defect by itself. A COLLECTION row may legitimately
// truncate: it is a compact representation, it is not where the record is read,
// and a detail surface next to it carries the full value. The audit kept those
// (admin audit dense table → AdminAuditDetailDialog; admin clinics table →
// ClinicEditDrawer; clinic logistics rows → the visit dialog).
//
// What is never legitimate is truncation on the TERMINAL surface — the
// DETAIL / DIALOG / INSPECTOR a row opens into. There is nothing deeper to
// open, so a value hidden there is hidden for good. Measured on the shipped
// build with long synthetic values at 360x800: the admin token detail rendered
// "Muestra" at scrollWidth 528 against clientWidth 137, clamped "Detalle de
// lesión" to 32px of a 96px text, and the admin report detail showed 15% of a
// long study type.
//
// So this guard CENSUSES the terminal regions explicitly, by component and by
// the exact region inside it, and bans the hiding grammars only there. Adding a
// new detail surface without registering it here is the one gap it cannot see;
// the E2E counterpart
// (frontend/e2e/platform/app-shell/dashboard-detail-text-integrity.spec.ts)
// closes it at runtime by measuring the rendered boxes.
//
// Fail-closed: every census asserts its region actually matched before scanning
// it, so a rename or a refactor fails here instead of passing vacuously.
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_DIALOG_TSX = "frontend/src/components/dashboard/ModuleDialog.tsx";

/** Grammars that hide part of a value. None may appear in a terminal region. */
const HIDING_GRAMMARS: readonly { readonly pattern: RegExp; readonly name: string }[] = [
  { pattern: /\btruncate\b/, name: "truncate" },
  { pattern: /\bline-clamp-\d\b/, name: "line-clamp-N" },
  { pattern: /\bsm:truncate\b/, name: "sm:truncate" },
  { pattern: /\bwhitespace-nowrap\b/, name: "whitespace-nowrap" },
  { pattern: /text-overflow:\s*ellipsis/, name: "text-overflow: ellipsis" },
];

type TerminalRegion = {
  /** Human label used in every failure message. */
  readonly label: string;
  readonly file: string;
  /** Literal that opens the region; the census fails if it is absent. */
  readonly start: string;
  /** Literal that closes it. */
  readonly end: string;
  /** Values whose full text is contractual on this surface. */
  readonly contractualValues: readonly string[];
};

// The census. One entry per DETAIL / DIALOG / INSPECTOR body that renders a
// datum as its terminal surface, on BOTH roles.
const TERMINAL_REGIONS: readonly TerminalRegion[] = [
  {
    label: "ADMIN · particular token detail dialog (summary tab)",
    file: "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx",
    start: 'role="tabpanel" aria-label="Resumen del token"',
    end: "detailTab === \"tracking\"",
    contractualValues: [
      "selectedToken.sampleLocation",
      "selectedToken.sampleEvolution",
      "selectedToken.detailsLesion",
      "selectedToken.petBreed",
    ],
  },
  {
    label: "ADMIN · report workflow detail dialog",
    file: "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
    start: 'title={`Informe #${selectedReport.id}`}',
    end: "Etapa operativa",
    contractualValues: [
      "selectedReport.patientName",
      "selectedReport.fileName",
      "studyLabel(selectedReport.studyType)",
    ],
  },
  {
    label: "ADMIN · audit event detail dialog",
    file: "frontend/src/app/dashboard/admin/AdminAuditDetailDialog.tsx",
    start: "<dl className=",
    end: "</dl>",
    contractualValues: [
      "row.eventCode",
      "row.actor",
      "row.entity",
      "row.action",
      "row.detail",
    ],
  },
  {
    label: "ADMIN · failed login attempt detail dialog",
    file: "frontend/src/app/dashboard/admin/AdminFailedLoginDetailDialog.tsx",
    start: "<dl className=",
    end: "</dl>",
    contractualValues: [
      "alert.username",
      "alert.ipAddress",
      "alert.userAgent",
      "alert.createdAt",
      "surfaceLabel",
      "reasonLabel",
    ],
  },
  {
    label: "ADMIN · users and roles detail dialog",
    file: "frontend/src/app/dashboard/admin/AdminUserRoleDetailDialog.tsx",
    start: "<dl className=",
    end: "</dl>",
    contractualValues: [
      "user.username",
      "clinicLabel",
      "clinicMetadata",
      "userTypeLabel",
      "roleLabel",
      "user.createdAt",
      "user.updatedAt",
    ],
  },
  {
    label: "CLINIC · particular token detail dialog",
    file: "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx",
    start: "<dl className=\"grid grid-cols-1 divide-y divide-vetneb-line/55",
    end: "Seguimiento",
    contractualValues: [
      "selectedToken.sampleLocation",
      "selectedToken.sampleEvolution",
      "selectedToken.detailsLesion",
      "selectedToken.petBreed",
    ],
  },
  {
    label: "CLINIC · informes workspace summary detail dialog",
    file: "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
    start: 'data-clinic-reports-detail-dialog="true"',
    end: "Documento seguro",
    contractualValues: [
      "selectedReport.patientName",
      "selectedReport.studyType",
      "formatReportFile(selectedReport)",
    ],
  },
  {
    label: "CLINIC · logistics visit detail dialog",
    file: "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx",
    start: 'data-clinic-logistics-detail-dialog="true"',
    end: "Abrir visitas en módulo completo",
    contractualValues: ["selectedVisit.clinicName", "selectedVisit.address"],
  },
  {
    label: "CLINIC · informes master-detail canvas (desktop panel + mobile dialog)",
    file: "frontend/src/app/dashboard/informes/InformesReportsList.tsx",
    start: "function renderReportDetailCanvas(",
    end: "Visualización y descarga del archivo disponible.",
    contractualValues: [
      "getReportTitle(report)",
      "report.clinicName",
      "report.patientName",
      "report.studyType",
      "report.fileName",
    ],
  },
];

function read(file: string): string {
  return readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function sliceRegion(source: string, region: TerminalRegion): string {
  const startIndex = source.indexOf(region.start);
  assert.notEqual(
    startIndex,
    -1,
    `${region.label}: region start marker not found in ${region.file}. ` +
      "The detail surface was renamed or removed; realign this census, do not delete it.",
  );

  const endIndex = source.indexOf(region.end, startIndex + region.start.length);
  assert.notEqual(
    endIndex,
    -1,
    `${region.label}: region end marker not found after the start marker in ${region.file}.`,
  );

  const slice = source.slice(startIndex, endIndex);
  assert.ok(
    slice.length > 120,
    `${region.label}: region resolved to ${slice.length} characters, which cannot be a real detail body. ` +
      "A vacuous census is a failure, not a pass.",
  );
  return slice;
}

test("PR-TRUNC · the terminal-surface census is non-empty and covers both roles", () => {
  assert.ok(
    TERMINAL_REGIONS.length >= 9,
    "the census must keep covering every audited detail surface",
  );

  const roles = new Set(TERMINAL_REGIONS.map((r) => r.label.split(" ·")[0]));
  assert.ok(roles.has("ADMIN"), "the census must cover admin detail surfaces");
  assert.ok(roles.has("CLINIC"), "the census must cover clinic detail surfaces");
});

test("PR-TRUNC · no DETAIL/DIALOG/INSPECTOR region hides part of a value", () => {
  for (const region of TERMINAL_REGIONS) {
    const slice = sliceRegion(read(region.file), region);

    for (const grammar of HIDING_GRAMMARS) {
      assert.equal(
        grammar.pattern.test(slice),
        false,
        `${region.label}: \`${grammar.name}\` is forbidden on a terminal surface. ` +
          "There is no deeper surface to open, so anything it hides is lost. " +
          "Use `.dashboard-detail-value` (wrap + overflow-wrap) instead; if the " +
          "content genuinely exceeds the viewport, let the sanctioned local " +
          "scroll owner absorb it.",
      );
    }
  }
});

test("PR-TRUNC · every contractual value is still rendered by its detail region", () => {
  for (const region of TERMINAL_REGIONS) {
    const slice = sliceRegion(read(region.file), region);

    for (const value of region.contractualValues) {
      assert.ok(
        slice.includes(value),
        `${region.label}: \`${value}\` must stay rendered by this detail region. ` +
          "Removing a field is not a valid way to satisfy the truncation contract.",
      );
    }
  }
});

test("PR-TRUNC · the detail-value grammar exists and cannot clip", () => {
  const css = readDashboardCssSource();

  assert.ok(
    css.includes(".dashboard-detail-value"),
    "`.dashboard-detail-value` must be declared in the dashboard CSS composition root",
  );

  const start = css.indexOf(".dashboard-detail-value");
  const end = css.indexOf("}", start);
  assert.notEqual(end, -1, "`.dashboard-detail-value` block must be closed");
  const block = css.slice(start, end);

  for (const declaration of [
    "white-space: normal",
    "overflow-wrap: anywhere",
    "min-width: 0",
  ]) {
    assert.ok(
      block.includes(declaration),
      `\`.dashboard-detail-value\` must declare \`${declaration}\``,
    );
  }

  for (const forbidden of [
    "overflow: hidden",
    "-webkit-line-clamp",
    "text-overflow: ellipsis",
    "white-space: nowrap",
    "max-height",
  ]) {
    assert.equal(
      block.includes(forbidden),
      false,
      `\`.dashboard-detail-value\` must never declare \`${forbidden}\`: it is the grammar that GUARANTEES full text`,
    );
  }
});

test("PR-TRUNC · ModuleDialog owns exactly one local scroll owner for its body", () => {
  const source = read(MODULE_DIALOG_TSX);

  assert.ok(
    source.includes('data-module-dialog-body="true"'),
    "the ModuleDialog body must carry its anchor so the E2E contract can measure it",
  );

  const bodyIndex = source.indexOf('data-module-dialog-body="true"');
  const bodyEnd = source.indexOf("{children}", bodyIndex);
  assert.notEqual(bodyEnd, -1, "the ModuleDialog body must still render its children");
  const body = source.slice(bodyIndex, bodyEnd);

  assert.ok(
    body.includes("overflow-y-auto"),
    "the ModuleDialog body must be the local scroll owner: `.clinical-modal` is " +
      "`overflow-hidden` and the panel is capped at `max-h-[88vh]`, so without it " +
      "any taller body is CLIPPED with no way to reach the hidden part",
  );
  assert.ok(
    body.includes("min-h-0"),
    "the ModuleDialog body must keep `min-h-0` so the flex column can actually shrink it",
  );

  // The header and the footer stay OUT of the scroll owner: critical actions
  // must remain visible without scrolling (AGENTS §10).
  const header = source.slice(0, bodyIndex);
  assert.equal(
    header.includes("overflow-y-auto"),
    false,
    "the ModuleDialog header must not become a second scroll owner",
  );
  const footer = source.slice(source.indexOf("{footer ?"));
  assert.equal(
    footer.includes("overflow-y-auto"),
    false,
    "the ModuleDialog footer must not become a second scroll owner",
  );
});

test("PR-TRUNC · collection surfaces that legitimately truncate still expose the full value", () => {
  // The three retained SAFE_TRUNCATION collections, each pinned to the exact
  // mechanism that makes them safe. If the mechanism goes, the truncation is no
  // longer safe and this guard says so.
  const cases: readonly { file: string; mechanism: string; why: string }[] = [
    {
      file: "frontend/src/app/dashboard/admin/AdminAuditDenseTable.tsx",
      mechanism: "<AdminAuditDetailDialog row={row} />",
      why: "the dense audit row truncates; the detail dialog is what makes it safe",
    },
    {
      file: "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
      mechanism: "setEditingClinic(clinic)",
      why: "the clinics row truncates; ClinicEditDrawer carries the full values",
    },
    {
      file: "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx",
      mechanism: "setSelectedVisitId(visit.id)",
      why: "the logistics row truncates; the visit detail dialog carries the full values",
    },
  ];

  for (const testCase of cases) {
    const source = read(testCase.file);
    assert.ok(
      source.includes(testCase.mechanism),
      `${testCase.file}: ${testCase.why}. Missing \`${testCase.mechanism}\`.`,
    );
  }

  // Failed logins: the row truncates the user agent in a pitch-locked table, so
  // the DIALOG is what makes that truncation safe. `title` was rejected as the
  // mechanism — hover-only, unreliable for assistive technology, invisible to
  // touch — so the pin is the dialog, on BOTH presentations of the card.
  const failedLogins = read(
    "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  );
  const failedLoginTriggers = failedLogins.split(
    "<AdminFailedLoginDetailDialog",
  ).length - 1;
  assert.equal(
    failedLoginTriggers,
    2,
    "AdminFailedLoginAlertsReadOnlyCard truncates the user agent in a pitch-locked table: the detail dialog is its full-value mechanism and must be mounted on BOTH the desktop row and the mobile row",
  );
  assert.equal(
    failedLogins.includes("title={alert.userAgent"),
    false,
    "a `title` attribute must not be reintroduced as the full-value mechanism: it is hover-only and not an accessible disclosure",
  );

  // Users/roles: the finding is CLOSED the same way. The row keeps truncating
  // `username` and the clinic name (the table is pitch-locked, so wrapping there
  // would clip vertically and move A03), and the detail dialog is what makes
  // that truncation safe — on BOTH presentations, never a `title`.
  const usersRoles = read(
    "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
  );

  // 1. The collection may still truncate: that is not the defect.
  assert.ok(
    /truncate[^"]*"[\s\S]{0,80}\{user\.username\}/.test(usersRoles),
    "the users/roles row is a compact pitch-locked representation and may keep truncating the username",
  );

  // 2 + 5. An accessible terminal disclosure exists, on desktop AND mobile.
  const usersRolesTriggers =
    usersRoles.split("<AdminUserRoleDetailDialog").length - 1;
  assert.equal(
    usersRolesTriggers,
    2,
    "AdminUsersRolesReadOnlyCard must mount the detail dialog on BOTH the desktop row and the mobile row; a disclosure that only exists on one presentation leaves the other truncation unsafe",
  );

  // 4 + 6. `title` must never be the mechanism again for these two fields.
  for (const titleOnly of [
    "title={user.username}",
    "title={getClinicMetadata(user)",
  ]) {
    assert.equal(
      usersRoles.includes(titleOnly),
      false,
      `\`${titleOnly}\` must not come back as the full-value mechanism: \`title\` is hover-only, unreliable for assistive technology and invisible to touch`,
    );
  }

  // 3. The dialog must actually carry both values, not just exist. The census
  // above already forbids hiding grammars inside it.
  const usersRolesDialog = read(
    "frontend/src/app/dashboard/admin/AdminUserRoleDetailDialog.tsx",
  );
  for (const value of ["{user.username}", "{clinicLabel}"]) {
    assert.ok(
      usersRolesDialog.includes(value),
      `AdminUserRoleDetailDialog must render ${value} in full — it is the terminal surface for that datum`,
    );
  }

  // The disclosure is READ-ONLY: role mutation stays in the row's own control.
  assert.equal(
    /handleChangeClinicRole|onChange|<input|<select/.test(usersRolesDialog),
    false,
    "AdminUserRoleDetailDialog must stay read-only: it discloses a record, it does not edit users or roles",
  );
});
