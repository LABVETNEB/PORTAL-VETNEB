import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import test from "node:test";
import ts from "typescript";
import { readSourceFile, listSourceFiles } from "../../helpers/tracked-source-files.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

const WRITE_ATTRIBUTION_BOUNDARIES = {
  admin: {
    persistedCreateKeys: ["createdByAdminId", "createdByAdminUserId"],
    persistedNullKeys: ["createdByClinicUserId"],
    auditRequestContext: "admin",
    auditMetadataVia: "admin",
  },
  clinic: {
    persistedCreateKeys: ["createdByClinicUserId"],
    persistedUpdateKeys: ["changedByClinicUserId", "revokedByClinicUserId"],
    persistedNullKeys: ["createdByAdminId", "createdByAdminUserId", "changedByAdminUserId", "revokedByAdminUserId"],
    auditRequestContext: "auth",
    auditMetadataVia: "clinic",
  },
  particular: {
    sessionKey: "particularTokenId",
    filterKey: "particular.tokenId",
  },
  publicReportAccessToken: {
    actorBuilder: "buildPublicReportAccessTokenActor",
    actorKey: "actorReportAccessTokenId",
    targetKey: "targetReportAccessTokenId",
  },
} as const;

function listFilesRecursive(relativeDir: string): string[] {
  const rootDir = resolve(REPO_ROOT, relativeDir);
  if (!existsSync(rootDir)) {
    return [];
  }

  return listSourceFiles(rootDir).map((file) =>
    relative(REPO_ROOT, resolve(rootDir, file)).split(sep).join("/"),
  );
}

// Resolve a legacy test-root path to its current canonical location, tolerating tests
// already migrated into enterprise subdirectories (TEST-ARCH-13/15). Prefers the exact
// path; falls back to a unique basename match under the same top-level directory. Zero or
// multiple matches return undefined so the caller fails explicitly (no silent match).
function resolveExistingSourcePath(relativePath: string): string | undefined {
  const normalized = relativePath.split(sep).join("/");
  if (existsSync(resolve(REPO_ROOT, normalized))) {
    return normalized;
  }

  const targetName = basename(normalized);
  const topDir = normalized.split("/")[0];
  const matches = listFilesRecursive(topDir).filter(
    (candidate) => basename(candidate) === targetName,
  );

  return matches.length === 1 ? matches[0] : undefined;
}

function readSource(relativePath: string): string {
  const resolved = resolveExistingSourcePath(relativePath);
  assert.ok(resolved, `source not found for ${relativePath}`);
  return readSourceFile(resolved);
}

function assertContains(source: string, marker: string, context: string) {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertMatches(source: string, pattern: RegExp, context: string) {
  assert.match(source, pattern, `${context} must match ${pattern}`);
}

const ADMIN_REPORT_ACCESS_ROUTE = "server/routes/admin-report-access-tokens.fastify.ts";
const ADMIN_REPORT_ACCESS_APPLICATION = "server/features/report-access/application/admin-report-access-operations.ts";
const ADMIN_PARTICULAR_ROUTE = "server/routes/admin-particular-tokens.fastify.ts";
const ADMIN_PARTICULAR_APPLICATION = "server/features/particular-access/application/admin-particular-access-operations.ts";
const ADMIN_STUDY_TRACKING_ROUTE = "server/routes/admin-study-tracking.fastify.ts";
const ADMIN_STUDY_TRACKING_APPLICATION = "server/features/study-tracking/application/admin-study-tracking-operations.ts";
const CLINIC_REPORT_ACCESS_ROUTE = "server/routes/report-access-tokens.fastify.ts";
const CLINIC_REPORT_ACCESS_APPLICATION = "server/features/report-access/application/clinic-report-access-operations.ts";
const CLINIC_PARTICULAR_ROUTE = "server/routes/particular-tokens.fastify.ts";
const CLINIC_PARTICULAR_APPLICATION = "server/features/particular-access/application/clinic-particular-access-operations.ts";
const CLINIC_STUDY_TRACKING_ROUTE = "server/routes/study-tracking.fastify.ts";
const CLINIC_STUDY_TRACKING_APPLICATION = "server/features/study-tracking/application/clinic-study-tracking-operations.ts";
const REPORTS_STATUS_ROUTE = "server/routes/reports-status.fastify.ts";
const PARTICULAR_AUDIT_ROUTE = "server/routes/particular-audit.fastify.ts";
const PARTICULAR_STUDY_TRACKING_ROUTE = "server/routes/particular-study-tracking.fastify.ts";
const PUBLIC_REPORT_ACCESS_ROUTE = "server/routes/public-report-access.fastify.ts";
const PUBLIC_REPORT_ACCESS_APPLICATION = "server/features/report-access/application/public-report-access-operations.ts";
const AUDIT_SOURCE = "server/lib/audit.ts";
const AUDIT_LOG_SOURCE = "server/lib/audit-log.ts";

type LegacyMarker = readonly [marker: string | RegExp, context: string];

// Single source of the legacy presence markers: the legacy tests assert them on the real
// tree and the mutation proofs replay them on mutated sources to show they stay green.
const LEGACY_ATTRIBUTION_MARKERS: Readonly<Record<string, readonly LegacyMarker[]>> = {
  [ADMIN_REPORT_ACCESS_ROUTE]: [["createAuditRequestLike(request, admin)", "admin report access token audit actor"]],
  [ADMIN_REPORT_ACCESS_APPLICATION]: [
    ["createdByClinicUserId: null", "admin report access token create attribution"],
    ["createdByAdminUserId: actor.id", "admin report access token create attribution"],
    ["revokedByClinicUserId: null", "admin report access token revoke attribution"],
    ["revokedByAdminUserId: actor.id", "admin report access token revoke attribution"],
    ['createdVia: "admin"', "admin report access token audit metadata"],
    ['revokedVia: "admin"', "admin report access token audit metadata"],
  ],
  [ADMIN_PARTICULAR_ROUTE]: [],
  [ADMIN_PARTICULAR_APPLICATION]: [
    ["createdByAdminId: adminId", "admin particular token create attribution"],
    ["createdByClinicUserId: null", "admin particular token create attribution"],
  ],
  [ADMIN_STUDY_TRACKING_ROUTE]: [["createAuditRequestLike(request, admin)", "admin study tracking audit actor"]],
  [ADMIN_STUDY_TRACKING_APPLICATION]: [
    ["createdByAdminId: input.actor.adminId", "admin study tracking create attribution"],
    ["createdByClinicUserId: null", "admin study tracking create attribution"],
    ['createdVia: "admin"', "admin study tracking audit metadata"],
  ],
  [CLINIC_REPORT_ACCESS_ROUTE]: [["createAuditRequestLike(request, auth)", "clinic report access token audit actor"]],
  [CLINIC_REPORT_ACCESS_APPLICATION]: [
    ["createdByClinicUserId: actor.clinicUserId", "clinic report access token create attribution"],
    ["createdByAdminUserId: null", "clinic report access token create attribution"],
    ["revokedByClinicUserId: actor.clinicUserId", "clinic report access token revoke attribution"],
    ["revokedByAdminUserId: null", "clinic report access token revoke attribution"],
    ['createdVia: "clinic"', "clinic report access token audit metadata"],
    ['revokedVia: "clinic"', "clinic report access token audit metadata"],
  ],
  [CLINIC_PARTICULAR_ROUTE]: [],
  [CLINIC_PARTICULAR_APPLICATION]: [
    ["createdByAdminId: null", "clinic particular token create attribution"],
    ["createdByClinicUserId: actor.clinicUserId", "clinic particular token create attribution"],
  ],
  [CLINIC_STUDY_TRACKING_ROUTE]: [["createAuditRequestLike(request, auth)", "clinic study tracking audit actor"]],
  [CLINIC_STUDY_TRACKING_APPLICATION]: [
    ["createdByAdminId: null", "clinic study tracking create attribution"],
    ["createdByClinicUserId: input.actor.clinicUserId", "clinic study tracking create attribution"],
    ['createdVia: "clinic"', "clinic study tracking audit metadata"],
  ],
  [REPORTS_STATUS_ROUTE]: [
    ["changedByClinicUserId: auth.id", "clinic report status attribution"],
    ["changedByAdminUserId: null", "clinic report status attribution"],
    ["createAuditRequestLike(request, auth)", "clinic report status audit actor"],
  ],
  [PARTICULAR_AUDIT_ROUTE]: [
    [/getParticularTokenById\(\s*session\.particularTokenId/s, "particular audit session attribution"],
    ["particularTokenId: particular.tokenId", "particular audit filter attribution"],
  ],
  [PARTICULAR_STUDY_TRACKING_ROUTE]: [
    [/getParticularTokenById\(\s*session\.particularTokenId/s, "particular study tracking session attribution"],
    ["particularTokenId: particular.tokenId", "particular study tracking notification attribution"],
  ],
  [PUBLIC_REPORT_ACCESS_ROUTE]: [
    ["buildPublicActor: buildPublicReportAccessTokenActor", "public report access actor composition"],
  ],
  [PUBLIC_REPORT_ACCESS_APPLICATION]: [
    ["deps.buildPublicActor(record.token.id)", "public report access actor attribution"],
    ["targetReportAccessTokenId: record.token.id", "public report access target attribution"],
    ["clinicId: record.token.clinicId", "public report access clinic attribution"],
    ["reportId: record.token.reportId", "public report access report attribution"],
  ],
  [AUDIT_SOURCE]: [
    ["actorAdminUserId: actor.adminUserId ?? null", "audit insert admin actor attribution"],
    ["actorClinicUserId: actor.clinicUserId ?? null", "audit insert clinic actor attribution"],
    ["actorReportAccessTokenId: actor.reportAccessTokenId ?? null", "audit insert public token actor attribution"],
    ["targetReportAccessTokenId: input.targetReportAccessTokenId ?? null", "audit insert target token attribution"],
    ["buildPublicReportAccessTokenActor", "audit public token actor builder"],
  ],
  [AUDIT_LOG_SOURCE]: [
    ['"actorAdminUserId"', "audit export admin actor attribution"],
    ['"actorClinicUserId"', "audit export clinic actor attribution"],
    ['"actorReportAccessTokenId"', "audit export public token actor attribution"],
    ['"targetReportAccessTokenId"', "audit export target token attribution"],
  ],
};

function assertLegacyAttributionMarkers(file: string, source: string): void {
  const markers = LEGACY_ATTRIBUTION_MARKERS[file];
  assert.ok(markers, `legacy attribution markers must be registered for ${file}`);
  for (const [marker, context] of markers) {
    if (typeof marker === "string") {
      assertContains(source, marker, context);
    } else {
      assertMatches(source, marker, context);
    }
  }
}

test("write attribution matrix documents admin clinic particular and public token actors", () => {
  assert.deepEqual(WRITE_ATTRIBUTION_BOUNDARIES, {
    admin: {
      persistedCreateKeys: ["createdByAdminId", "createdByAdminUserId"],
      persistedNullKeys: ["createdByClinicUserId"],
      auditRequestContext: "admin",
      auditMetadataVia: "admin",
    },
    clinic: {
      persistedCreateKeys: ["createdByClinicUserId"],
      persistedUpdateKeys: ["changedByClinicUserId", "revokedByClinicUserId"],
      persistedNullKeys: ["createdByAdminId", "createdByAdminUserId", "changedByAdminUserId", "revokedByAdminUserId"],
      auditRequestContext: "auth",
      auditMetadataVia: "clinic",
    },
    particular: {
      sessionKey: "particularTokenId",
      filterKey: "particular.tokenId",
    },
    publicReportAccessToken: {
      actorBuilder: "buildPublicReportAccessTokenActor",
      actorKey: "actorReportAccessTokenId",
      targetKey: "targetReportAccessTokenId",
    },
  });
});

test("admin writes persist admin attribution and audit through admin context", () => {
  for (const file of [
    ADMIN_REPORT_ACCESS_ROUTE,
    ADMIN_REPORT_ACCESS_APPLICATION,
    ADMIN_PARTICULAR_ROUTE,
    ADMIN_PARTICULAR_APPLICATION,
    ADMIN_STUDY_TRACKING_ROUTE,
    ADMIN_STUDY_TRACKING_APPLICATION,
  ]) {
    assertLegacyAttributionMarkers(file, readSource(file));
  }
});

test("clinic writes persist clinic attribution and audit through clinic context", () => {
  for (const file of [
    CLINIC_REPORT_ACCESS_ROUTE,
    CLINIC_REPORT_ACCESS_APPLICATION,
    CLINIC_PARTICULAR_ROUTE,
    CLINIC_PARTICULAR_APPLICATION,
    CLINIC_STUDY_TRACKING_ROUTE,
    CLINIC_STUDY_TRACKING_APPLICATION,
    REPORTS_STATUS_ROUTE,
  ]) {
    assertLegacyAttributionMarkers(file, readSource(file));
  }
});

test("particular and public access attribution derive from authenticated or raw tokens", () => {
  for (const file of [
    PARTICULAR_AUDIT_ROUTE,
    PARTICULAR_STUDY_TRACKING_ROUTE,
    PUBLIC_REPORT_ACCESS_ROUTE,
    PUBLIC_REPORT_ACCESS_APPLICATION,
  ]) {
    assertLegacyAttributionMarkers(file, readSource(file));
  }
});

test("audit helpers preserve actor and target attribution fields", () => {
  for (const file of [AUDIT_SOURCE, AUDIT_LOG_SOURCE]) {
    assertLegacyAttributionMarkers(file, readSource(file));
  }
});

test("runtime attribution tests remain explicit for critical writes", () => {
  const adminParticularTokenTests = readSource("test/admin-particular-tokens.fastify.test.ts");
  const particularTokenTests = readSource("test/particular-tokens.fastify.test.ts");
  const reportAccessTokenTests = readSource("test/report-access-tokens.fastify.test.ts");
  const adminReportAccessTokenTests = readSource("test/admin-report-access-tokens.fastify.test.ts");
  const reportsStatusTests = readSource("test/reports-status.fastify.test.ts");
  const studyTrackingTests = readSource("test/study-tracking.fastify.test.ts");
  const adminStudyTrackingTests = readSource("test/admin-study-tracking.fastify.test.ts");
  const publicReportAccessTests = readSource("test/public-report-access.fastify.test.ts");

  assertContains(adminParticularTokenTests, "assert.equal(createCalls[0].createdByAdminId, 1)", "admin particular token runtime attribution");
  assertContains(adminParticularTokenTests, "assert.equal(createCalls[0].createdByClinicUserId, null)", "admin particular token runtime attribution");

  assertContains(particularTokenTests, "assert.equal(createCalls[0].createdByAdminId, null)", "clinic particular token runtime attribution");
  assertContains(particularTokenTests, "assert.equal(createCalls[0].createdByClinicUserId, 9)", "clinic particular token runtime attribution");

  assertContains(reportAccessTokenTests, "assert.equal(createCalls[0].createdByClinicUserId, 9)", "clinic report access token runtime attribution");
  assertContains(reportAccessTokenTests, "assert.equal(auditCalls[0].targetReportAccessTokenId, 9)", "clinic report access token audit attribution");

  assertContains(adminReportAccessTokenTests, "assert.equal(createCalls[0].createdByClinicUserId, null)", "admin report access token runtime attribution");
  assertContains(adminReportAccessTokenTests, "assert.equal(auditCalls[0].targetReportAccessTokenId, 9)", "admin report access token audit attribution");

  assertContains(reportsStatusTests, "changedByClinicUserId: 9", "clinic report status runtime attribution");
  assertContains(reportsStatusTests, "changedByAdminUserId: null", "clinic report status runtime attribution");

  assertContains(studyTrackingTests, "assert.equal(response.statusCode, 403)", "clinic study tracking runtime authorization");
  assertContains(
    studyTrackingTests,
    'error: "Solo administración puede crear seguimientos"',
    "clinic study tracking runtime authorization",
  );

  assertContains(adminStudyTrackingTests, "assert.equal(createCalls[0].createdByAdminId, 1)", "admin study tracking runtime attribution");
  assertContains(adminStudyTrackingTests, "assert.equal(createCalls[0].createdByClinicUserId, null)", "admin study tracking runtime attribution");

  assertContains(publicReportAccessTests, "assert.equal(auditCalls[0].targetReportAccessTokenId, token.id)", "public report access runtime attribution");
});

// ── Executable attribution oracle ───────────────────────────────────────────
// The legacy markers above only prove that some text exists somewhere in a file. The
// oracle below executes the real application modules and audit sink from their source
// text against recording ports, and parses the route call sites, so the value that
// actually reaches each write (after spreads, aliases, overrides and branches) is what
// gets compared. Every id below is distinct: swapping an actor for a clinic, a target or
// another actor always changes an observed value.

const ADMIN_ID = 7101;
const CLINIC_ID = 7202;
const CLINIC_USER_ID = 7303;
const REPORT_ID = 7404;
const REPORT_ACCESS_TOKEN_ID = 7505;
const PARTICULAR_TOKEN_ID = 7606;
const TRACKING_CASE_ID = 7707;
const PARTICULAR_SESSION_ID = 7808;
const TARGET_ADMIN_USER_ID = 7909;
const TARGET_CLINIC_USER_ID = 8010;
const NOTIFICATION_ID = 8111;
const SENTINEL_IDS = [
  ADMIN_ID,
  CLINIC_ID,
  CLINIC_USER_ID,
  REPORT_ID,
  REPORT_ACCESS_TOKEN_ID,
  PARTICULAR_TOKEN_ID,
  TRACKING_CASE_ID,
  PARTICULAR_SESSION_ID,
  TARGET_ADMIN_USER_ID,
  TARGET_CLINIC_USER_ID,
  NOTIFICATION_ID,
];

const AUDIT_REQUEST = Object.freeze({ sentinel: "route-audit-request" });
const ADMIN_PRINCIPAL = { id: ADMIN_ID, username: "admin-sentinel" };
const CLINIC_PRINCIPAL = { id: CLINIC_USER_ID, clinicId: CLINIC_ID, username: "clinic-sentinel", role: "clinic_owner" };
const RAW_REPORT_ACCESS_TOKEN = "raw-report-access-token-c0de";
const RAW_PARTICULAR_TOKEN = "raw-particular-token-4d2e";
const RAW_PARTICULAR_SESSION = "raw-particular-session";

// Keys that carry who performed a write. Any such key outside the expected set is an
// incompatible actor, so the comparison is always on the full attribution subset.
const ATTRIBUTION_KEY = /^(created|revoked|changed)By[A-Z]|^actor[A-Z]/;
const ROUTE_ATTRIBUTION_KEY = /^actor$|^(created|revoked|changed)By[A-Z]|^actor[A-Z]/;
const TARGET_KEY = /^target[A-Z]/;
const CHANNEL_KEY = /Via$/;

const VIOLATION_KINDS = [
  "parse",
  "load",
  "completion",
  "call-count",
  "attribution",
  "value",
  "audit-request",
  "audit-actor",
  "audit-target",
  "audit-channel",
  "audit-scope",
  "sink-row",
  "route-call",
  "route-argument",
  "route-principal",
  "route-helper",
  "route-import",
  "route-port",
  "route-write",
  "route-wiring",
  "route-container",
  "route-spread",
  "write-census",
] as const;
type ViolationKind = (typeof VIOLATION_KINDS)[number];

// Completeness mechanisms of the oracle. Each can be switched off only by the meta-tests
// that prove it is load-bearing; the guard itself always runs all of them.
const EVALUATOR_CHECKS = [
  "write-census",
  "port-wiring",
  "container-use",
  "spread-identity",
  "import-ledger",
  "application-census",
] as const;
type EvaluatorCheck = (typeof EVALUATOR_CHECKS)[number];
type DisabledChecks = ReadonlySet<EvaluatorCheck>;
const ALL_CHECKS: DisabledChecks = new Set();

function violation(kind: ViolationKind, label: string, message: string): string {
  return `[${kind}] ${label}: ${message}`;
}

function json(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" ? (value as UnknownRecord) : {};
}

function pick(record: UnknownRecord, pattern: RegExp): UnknownRecord {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => pattern.test(key))
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}

function sorted(record: UnknownRecord): UnknownRecord {
  return pick(record, /.*/);
}

type RecordedCall = { readonly name: string; readonly args: readonly unknown[] };

// Arguments are copied when the port is called, so a later mutation of the same object
// never rewrites what the port received. The route audit request keeps its identity.
function snapshot(value: unknown): unknown {
  if (value === AUDIT_REQUEST) {
    return AUDIT_REQUEST;
  }
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

function createRecorder() {
  const calls: RecordedCall[] = [];
  return {
    port(name: string, result: (...args: never[]) => unknown = () => undefined) {
      return (...args: unknown[]): unknown => {
        calls.push({ name, args: args.map(snapshot) });
        return (result as (...values: unknown[]) => unknown)(...args);
      };
    },
    named(name: string): RecordedCall[] {
      return calls.filter((call) => call.name === name);
    },
    counts(): UnknownRecord {
      const counts: Record<string, number> = {};
      for (const call of calls) {
        counts[call.name] = (counts[call.name] ?? 0) + 1;
      }
      return sorted(counts);
    },
  };
}
type Recorder = ReturnType<typeof createRecorder>;

function calledOnce(recorder: Recorder, name: string, label: string, violations: string[]): UnknownRecord[] | undefined {
  const calls = recorder.named(name);
  if (calls.length !== 1) {
    violations.push(violation("call-count", label, `${name} must be called exactly once (got ${calls.length})`));
    return undefined;
  }
  return calls[0].args.map(asRecord);
}

function calledTimes(recorder: Recorder, name: string, times: number, label: string, violations: string[]): UnknownRecord[] {
  const calls = recorder.named(name);
  if (calls.length !== times) {
    violations.push(violation("call-count", label, `${name} must be called ${times} time(s) (got ${calls.length})`));
    return [];
  }
  return calls.map((call) => asRecord(call.args[0]));
}

function expectAttribution(violations: string[], label: string, sink: string, payload: UnknownRecord, expected: UnknownRecord): void {
  const actual = pick(payload, ATTRIBUTION_KEY);
  if (!isDeepStrictEqual(actual, sorted(expected))) {
    violations.push(violation("attribution", label, `${sink} attribution must be ${json(sorted(expected))} (got ${json(actual)})`));
  }
}

function expectValues(violations: string[], label: string, sink: string, payload: UnknownRecord, expected: UnknownRecord): void {
  for (const [key, value] of Object.entries(expected)) {
    if (!Object.hasOwn(payload, key) || !isDeepStrictEqual(payload[key], value)) {
      violations.push(violation("value", label, `${sink}.${key} must be ${json(value)} (got ${json(payload[key])})`));
    }
  }
}

type ExpectedAudit = {
  readonly event: string;
  readonly clinicId: number;
  readonly reportId: number;
  readonly targets: UnknownRecord;
  readonly channel: UnknownRecord;
  readonly actor?: UnknownRecord;
};

function expectAudits(recorder: Recorder, label: string, expected: readonly ExpectedAudit[], violations: string[]): void {
  const calls = recorder.named("writeAuditLog");
  if (calls.length !== expected.length) {
    violations.push(violation("call-count", label, `writeAuditLog must be called ${expected.length} time(s) (got ${calls.length})`));
    return;
  }
  expected.forEach((audit, index) => {
    const where = `${label} audit #${index + 1}`;
    const [request, rawInput] = calls[index].args;
    const input = asRecord(rawInput);
    if (request !== AUDIT_REQUEST) {
      violations.push(violation("audit-request", where, "must receive the route audit request context unchanged"));
    }
    for (const key of ["event", "clinicId", "reportId"] as const) {
      if (!isDeepStrictEqual(input[key], audit[key])) {
        violations.push(violation("audit-scope", where, `${key} must be ${json(audit[key])} (got ${json(input[key])})`));
      }
    }
    const targets = pick(input, TARGET_KEY);
    if (!isDeepStrictEqual(targets, sorted(audit.targets))) {
      violations.push(violation("audit-target", where, `targets must be ${json(sorted(audit.targets))} (got ${json(targets)})`));
    }
    if (audit.actor === undefined) {
      if (Object.hasOwn(input, "actor")) {
        violations.push(violation("audit-actor", where, `must not override the request actor (got ${json(input.actor)})`));
      }
    } else if (!isDeepStrictEqual(input.actor, audit.actor)) {
      violations.push(violation("audit-actor", where, `actor must be ${json(audit.actor)} (got ${json(input.actor)})`));
    }
    const channel = pick(asRecord(input.metadata), CHANNEL_KEY);
    if (!isDeepStrictEqual(channel, sorted(audit.channel))) {
      violations.push(violation("audit-channel", where, `channel metadata must be ${json(sorted(audit.channel))} (got ${json(channel)})`));
    }
  });
}

const CANONICAL_PRINTER = ts.createPrinter({ removeComments: true });

// AST text without comments or layout: comments, strings and templates are never
// mistaken for the expressions they merely spell out.
function canonical(node: ts.Node, file: ts.SourceFile): string {
  return CANONICAL_PRINTER.printNode(ts.EmitHint.Unspecified, node, file)
    .replace(/\s+/g, " ")
    .replace(/,\s*([)\]}])/g, " $1")
    .replace(/\s+([)\]])/g, "$1")
    .trim();
}

function parseSource(source: string, fileName: string): ts.SourceFile | undefined {
  const { diagnostics = [] } = ts.transpileModule(source, { fileName, reportDiagnostics: true });
  return diagnostics.length > 0
    ? undefined
    : ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function descendants<T extends ts.Node>(root: ts.Node, match: (node: ts.Node) => node is T): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node): void => {
    if (match(node)) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(root, visit);
  return found;
}

function isBindingName(identifier: ts.Identifier): boolean {
  const parent = identifier.parent;
  return (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isBindingElement(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isImportSpecifier(parent) ||
      ts.isImportClause(parent) ||
      ts.isNamespaceImport(parent)) &&
    (parent as ts.NamedDeclaration).name === identifier
  );
}

// Every declaration binding `name` under `root`, whatever the scope: a shadowing
// declaration anywhere makes the reference ambiguous.
function bindingDeclarations(root: ts.Node, name: string): ts.Node[] {
  return descendants(root, ts.isIdentifier)
    .filter((identifier) => identifier.text === name && isBindingName(identifier))
    .map((identifier) => identifier.parent);
}

const TRANSPILE_COMPILER_OPTIONS: ts.CompilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
};

class AttributionSourceError extends Error {
  readonly kind: ViolationKind;

  constructor(kind: ViolationKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

// Executes the whole module from its source text. Runtime imports resolve only to the
// declared doubles; an unexpected import, a parse error or a duplicated factory fails.
function loadModule(
  source: string,
  fileName: string,
  imports: Readonly<Record<string, UnknownRecord>>,
  factory: string,
): (...args: unknown[]) => unknown {
  const file = parseSource(source, fileName);
  if (file === undefined) {
    throw new AttributionSourceError("parse", "source must parse as TypeScript before evaluation");
  }
  if (bindingDeclarations(file, factory).length !== 1) {
    throw new AttributionSourceError("load", `${factory} must be declared exactly once`);
  }
  const { outputText } = ts.transpileModule(source, { fileName, compilerOptions: TRANSPILE_COMPILER_OPTIONS });
  const moduleExports: UnknownRecord = {};
  const requireDouble = (specifier: string): unknown => {
    if (!Object.hasOwn(imports, specifier)) {
      throw new AttributionSourceError("load", `unexpected runtime import ${specifier}`);
    }
    return imports[specifier];
  };
  new Function("exports", "require", "module", outputText)(moduleExports, requireDouble, { exports: moduleExports });
  const exported = moduleExports[factory];
  if (typeof exported !== "function") {
    throw new AttributionSourceError("load", `${factory} must be exported as a function`);
  }
  return exported as (...args: unknown[]) => unknown;
}

// Compiles one module-level function declaration alone; free names resolve only to the
// declared doubles, so a helper that reaches for anything else throws.
function compileDeclaration(
  file: ts.SourceFile,
  name: string,
  freeNames: Readonly<UnknownRecord>,
): (...args: unknown[]) => unknown {
  const declarations = bindingDeclarations(file, name);
  const declaration = declarations[0];
  if (declarations.length !== 1 || !ts.isFunctionDeclaration(declaration) || declaration.parent !== file) {
    throw new AttributionSourceError("load", `${name} must be declared exactly once at module level`);
  }
  const { outputText } = ts.transpileModule(CANONICAL_PRINTER.printNode(ts.EmitHint.Unspecified, declaration, file), {
    compilerOptions: TRANSPILE_COMPILER_OPTIONS,
  });
  const names = Object.keys(freeNames);
  return new Function(...names, `${outputText}\nreturn ${name};`)(...names.map((key) => freeNames[key])) as (
    ...args: unknown[]
  ) => unknown;
}

function asViolation(label: string, error: unknown): string {
  if (error instanceof AttributionSourceError) {
    return violation(error.kind, label, error.message);
  }
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return violation("completion", label, `operation must run to completion against recording ports (${message})`);
}

type Operations = Record<string, (...args: unknown[]) => Promise<unknown>>;

function operationsFrom(factory: (...args: unknown[]) => unknown, deps: UnknownRecord): Operations {
  return asRecord(factory(deps)) as Operations;
}

// ── Application writes ─────────────────────────────────────────────────────

const REPORT_ACCESS_DOMAIN_DOUBLE = {
  belongsToClinic: (left: unknown, right: unknown) => left === right,
  canAccessReportPublicly: () => true,
  getReportAccessTokenState: () => "active",
};

function reportAccessTokenRecord(): UnknownRecord {
  return {
    id: REPORT_ACCESS_TOKEN_ID,
    clinicId: CLINIC_ID,
    reportId: REPORT_ID,
    tokenLast4: "c0de",
    expiresAt: null,
    revokedAt: null,
    accessCount: 0,
    lastAccessAt: null,
  };
}

function reportAccessPorts(recorder: Recorder): UnknownRecord {
  return {
    generateSessionToken: () => RAW_REPORT_ACCESS_TOKEN,
    hashSessionToken: (token: string) => `hash:${token}`,
    getClinicById: async (id: unknown) => (id === CLINIC_ID ? { id } : null),
    getReportById: async (id: unknown) => (id === REPORT_ID ? { id, clinicId: CLINIC_ID } : null),
    getClinicScopedReportById: async (id: unknown, clinicId: unknown) =>
      id === REPORT_ID && clinicId === CLINIC_ID ? { id, clinicId } : null,
    getReportAccessTokenById: async (id: unknown) => (id === REPORT_ACCESS_TOKEN_ID ? reportAccessTokenRecord() : null),
    getClinicScopedReportAccessToken: async (id: unknown, clinicId: unknown) =>
      id === REPORT_ACCESS_TOKEN_ID && clinicId === CLINIC_ID ? reportAccessTokenRecord() : null,
    listReportAccessTokens: async () => [],
    createReportAccessToken: recorder.port("createReportAccessToken", async () => reportAccessTokenRecord()),
    revokeReportAccessToken: recorder.port("revokeReportAccessToken", async () => ({
      ...reportAccessTokenRecord(),
      revokedAt: new Date(0),
    })),
    writeAuditLog: recorder.port("writeAuditLog", async () => undefined),
  };
}

function particularTokenRecord(createdBy: "admin" | "clinic"): UnknownRecord {
  return {
    id: PARTICULAR_TOKEN_ID,
    clinicId: CLINIC_ID,
    reportId: REPORT_ID,
    petName: "Luna",
    isActive: true,
    createdByAdminId: createdBy === "admin" ? ADMIN_ID : null,
    createdByClinicUserId: createdBy === "clinic" ? CLINIC_USER_ID : null,
  };
}

function particularAccessImports(recorder: Recorder): Record<string, UnknownRecord> {
  return {
    "../../study-tracking/index.ts": {
      createTokenStudyTrackingOperations: () => ({
        ensureTrackingForToken: recorder.port("ensureTrackingForToken", async () => ({
          id: TRACKING_CASE_ID,
          reportId: REPORT_ID,
        })),
      }),
    },
    "../domain/index.ts": {
      belongsToClinic: (left: unknown, right: unknown) => left === right,
      getParticularTokenLast4: (raw: string) => raw.slice(-4),
    },
  };
}

function particularAccessPorts(recorder: Recorder, createdBy: "admin" | "clinic"): UnknownRecord {
  return {
    generateSessionToken: () => RAW_PARTICULAR_TOKEN,
    hashSessionToken: (token: string) => `hash:${token}`,
    sendParticularTokenEmail: async () => ({ sent: true }),
    studyTracking: {},
    now: () => 0,
    getClinicById: async (id: unknown) => (id === CLINIC_ID ? { id } : null),
    getReportById: async (id: unknown) => (id === REPORT_ID ? { id, clinicId: CLINIC_ID } : null),
    getClinicScopedReportById: async (id: unknown, clinicId: unknown) =>
      id === REPORT_ID && clinicId === CLINIC_ID ? { id, clinicId } : null,
    createParticularToken: recorder.port("createParticularToken", async () => particularTokenRecord(createdBy)),
    revokeParticularToken: recorder.port("revokeParticularToken", async () => undefined),
    createStudyTrackingNotification: recorder.port("createStudyTrackingNotification", async () => ({ id: NOTIFICATION_ID })),
  };
}

// The first delivery reports unavailability and the second throws: both cleanup
// branches must revoke the token that was just created, and nothing else.
function failingEmailPorts(recorder: Recorder, createdBy: "admin" | "clinic"): UnknownRecord {
  let attempts = 0;
  return {
    ...particularAccessPorts(recorder, createdBy),
    sendParticularTokenEmail: async () => {
      attempts += 1;
      if (attempts > 1) {
        throw new Error("smtp unavailable");
      }
      return { sent: false, reason: "unavailable" };
    },
  };
}

function expectCleanupRevokes(recorder: Recorder, label: string, violations: string[]): void {
  const revoked = recorder.named("revokeParticularToken").map((call) => call.args[0]);
  if (!isDeepStrictEqual(revoked, [PARTICULAR_TOKEN_ID, PARTICULAR_TOKEN_ID])) {
    violations.push(violation("value", label, `revokeParticularToken must revoke the created token ${PARTICULAR_TOKEN_ID} on both failure branches (got ${json(revoked)})`));
  }
}

const PARTICULAR_TOKEN_DATA = {
  reportId: REPORT_ID,
  recipientEmail: "tutor@example.test",
  tutorLastName: "Sentinel",
  petName: "Luna",
  petAge: null,
  petBreed: null,
  petSex: null,
  petSpecies: null,
  sampleLocation: null,
  sampleEvolution: null,
  detailsLesion: null,
  extractionDate: null,
  shippingDate: null,
};

function trackingCaseRecord(): UnknownRecord {
  return {
    id: TRACKING_CASE_ID,
    clinicId: CLINIC_ID,
    reportId: REPORT_ID,
    particularTokenId: PARTICULAR_TOKEN_ID,
    receptionAt: new Date(0),
    estimatedDeliveryAt: new Date(0),
    estimatedDeliveryWasManuallyAdjusted: false,
    currentStage: "reception",
    specialStainRequired: true,
    specialStainNotifiedAt: null,
    paymentUrl: null,
    adminContactEmail: null,
    adminContactPhone: null,
    notes: null,
  };
}

function studyTrackingImports(): Record<string, UnknownRecord> {
  const passThrough = (repository: unknown) => repository;
  return {
    "../domain/index.ts": {
      applyEstimatedDeliveryRules: () => ({
        estimatedDeliveryAt: new Date(0),
        estimatedDeliveryAutoCalculatedAt: new Date(0),
        estimatedDeliveryWasManuallyAdjusted: false,
      }),
      applyStageTimestampDefaults: (_current: unknown, next: unknown) => next,
      shouldCreateSpecialStainNotification: () => true,
    },
    "./study-tracking-command-use-cases.ts": {
      createAdminStudyTrackingCommandUseCases: passThrough,
      createClinicStudyTrackingCommandUseCases: passThrough,
    },
    "./study-tracking-query-use-cases.ts": {
      createAdminStudyTrackingQueryUseCases: passThrough,
      createClinicStudyTrackingQueryUseCases: passThrough,
    },
    "./study-tracking-side-effect-use-cases.ts": {
      createStudyTrackingSideEffectUseCases: (ports: {
        notification: { sendSpecialStainRequiredEmail: (input: unknown) => unknown };
        audit: { writeAuditLog: (request: unknown, input: unknown) => unknown };
      }) => ({
        sendSpecialStainRequiredEmail: (input: unknown) => ports.notification.sendSpecialStainRequiredEmail(input),
        writeAuditLog: (request: unknown, input: unknown) => ports.audit.writeAuditLog(request, input),
      }),
    },
  };
}

function studyTrackingPorts(recorder: Recorder): UnknownRecord {
  return {
    queryRepository: {},
    commandRepository: {
      createStudyTrackingCase: recorder.port("createStudyTrackingCase", async () => trackingCaseRecord()),
      createStudyTrackingNotification: recorder.port("createStudyTrackingNotification", async () => ({
        id: NOTIFICATION_ID,
        studyTrackingCaseId: TRACKING_CASE_ID,
        clinicId: CLINIC_ID,
        reportId: REPORT_ID,
        particularTokenId: PARTICULAR_TOKEN_ID,
        type: "special_stain_required",
        title: "Se requiere tinción especial",
      })),
      // Like the repository update, undefined columns are left untouched.
      updateStudyTrackingCase: recorder.port("updateStudyTrackingCase", async (_id: unknown, patch: unknown) => ({
        ...trackingCaseRecord(),
        ...Object.fromEntries(Object.entries(asRecord(patch)).filter(([, value]) => value !== undefined)),
      })),
    },
    referenceRepository: {
      getClinicById: async (id: unknown) =>
        id === CLINIC_ID ? { id, name: "Clinic Sentinel", contactEmail: "clinic@example.test" } : null,
      getReportById: async (id: unknown) => (id === REPORT_ID ? { id, clinicId: CLINIC_ID } : null),
      getClinicScopedReportById: async (id: unknown, clinicId: unknown) =>
        id === REPORT_ID && clinicId === CLINIC_ID ? { id, clinicId } : null,
      getParticularTokenById: async (id: unknown) => (id === PARTICULAR_TOKEN_ID ? { id, clinicId: CLINIC_ID } : null),
      updateParticularTokenReport: recorder.port("updateParticularTokenReport", async () => undefined),
    },
    notification: { sendSpecialStainRequiredEmail: async () => ({ sent: true }) },
    audit: { writeAuditLog: recorder.port("writeAuditLog", async () => undefined) },
    auditEvents: {
      caseCreated: "study_tracking.case.created",
      caseUpdated: "study_tracking.case.updated",
      notificationCreated: "study_tracking.notification.created",
    },
    createDate: () => new Date(0),
  };
}

// The case, its notifications and the token relink all target the same tracking case,
// clinic and particular token; a swapped id writes onto another resource.
function expectStudyTrackingTargets(
  recorder: Recorder,
  label: string,
  counts: { readonly notifications: number; readonly caseUpdates: number },
  violations: string[],
): void {
  const links = recorder.named("updateParticularTokenReport").map((call) => call.args);
  if (!isDeepStrictEqual(links, [[PARTICULAR_TOKEN_ID, REPORT_ID]])) {
    violations.push(violation("value", label, `updateParticularTokenReport must relink token ${PARTICULAR_TOKEN_ID} to report ${REPORT_ID} once (got ${json(links)})`));
  }
  for (const notification of calledTimes(recorder, "createStudyTrackingNotification", counts.notifications, label, violations)) {
    expectValues(violations, label, "createStudyTrackingNotification", notification, {
      studyTrackingCaseId: TRACKING_CASE_ID,
      clinicId: CLINIC_ID,
      particularTokenId: PARTICULAR_TOKEN_ID,
    });
  }
  const caseUpdates = recorder.named("updateStudyTrackingCase").map((call) => call.args[0]);
  if (!isDeepStrictEqual(caseUpdates, Array.from({ length: counts.caseUpdates }, () => TRACKING_CASE_ID))) {
    violations.push(violation("value", label, `updateStudyTrackingCase must target case ${TRACKING_CASE_ID} ${counts.caseUpdates} time(s) (got ${json(caseUpdates)})`));
  }
}

function studyTrackingAudits(channel: "admin" | "clinic"): ExpectedAudit[] {
  return [
    {
      event: "study_tracking.case.created",
      clinicId: CLINIC_ID,
      reportId: REPORT_ID,
      targets: {},
      channel: { createdVia: channel },
    },
    {
      event: "study_tracking.notification.created",
      clinicId: CLINIC_ID,
      reportId: REPORT_ID,
      targets: {},
      channel: { createdVia: channel },
    },
  ];
}

type ApplicationScenario = {
  readonly label: string;
  readonly file: string;
  // Exact calls of every recording port (writes, audit, actor builder): a write the
  // scenario does not expect is unregistered even when every expected one is correct.
  readonly recorded: Readonly<Record<string, number>>;
  readonly run: (source: string, recorder: Recorder, violations: string[]) => Promise<void>;
};

const APPLICATION_SCENARIOS: readonly ApplicationScenario[] = [
  {
    label: "admin report access token create",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    recorded: { createReportAccessToken: 1, writeAuditLog: 1 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, { "../domain/index.ts": REPORT_ACCESS_DOMAIN_DOUBLE }, "createAdminReportAccessOperations");
      await operationsFrom(factory, reportAccessPorts(recorder)).createToken(
        { clinicId: CLINIC_ID, reportId: REPORT_ID, expiresAt: null },
        { ...ADMIN_PRINCIPAL },
        AUDIT_REQUEST,
      );
      const [payload] = calledOnce(recorder, "createReportAccessToken", this.label, violations) ?? [];
      if (payload) {
        expectValues(violations, this.label, "createReportAccessToken", payload, { clinicId: CLINIC_ID, reportId: REPORT_ID });
        expectAttribution(violations, this.label, "createReportAccessToken", payload, {
          createdByClinicUserId: null,
          createdByAdminUserId: ADMIN_ID,
          revokedByClinicUserId: null,
          revokedByAdminUserId: null,
        });
      }
      expectAudits(recorder, this.label, [
        {
          event: "report_access_token.created",
          clinicId: CLINIC_ID,
          reportId: REPORT_ID,
          targets: { targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID },
          channel: { createdVia: "admin" },
        },
      ], violations);
    },
  },
  {
    label: "admin report access token revoke",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    recorded: { revokeReportAccessToken: 1, writeAuditLog: 1 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, { "../domain/index.ts": REPORT_ACCESS_DOMAIN_DOUBLE }, "createAdminReportAccessOperations");
      await operationsFrom(factory, reportAccessPorts(recorder)).revokeToken(REPORT_ACCESS_TOKEN_ID, { ...ADMIN_PRINCIPAL }, AUDIT_REQUEST);
      const [payload] = calledOnce(recorder, "revokeReportAccessToken", this.label, violations) ?? [];
      if (payload) {
        expectValues(violations, this.label, "revokeReportAccessToken", payload, { id: REPORT_ACCESS_TOKEN_ID });
        expectAttribution(violations, this.label, "revokeReportAccessToken", payload, {
          revokedByClinicUserId: null,
          revokedByAdminUserId: ADMIN_ID,
        });
      }
      expectAudits(recorder, this.label, [
        {
          event: "report_access_token.revoked",
          clinicId: CLINIC_ID,
          reportId: REPORT_ID,
          targets: { targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID },
          channel: { revokedVia: "admin" },
        },
      ], violations);
    },
  },
  {
    label: "clinic report access token create",
    file: CLINIC_REPORT_ACCESS_APPLICATION,
    recorded: { createReportAccessToken: 1, writeAuditLog: 1 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, {}, "createClinicReportAccessOperations");
      await operationsFrom(factory, reportAccessPorts(recorder)).createToken(
        { reportId: REPORT_ID, expiresAt: null },
        { clinicId: CLINIC_ID, clinicUserId: CLINIC_USER_ID },
        AUDIT_REQUEST,
      );
      const [payload] = calledOnce(recorder, "createReportAccessToken", this.label, violations) ?? [];
      if (payload) {
        expectValues(violations, this.label, "createReportAccessToken", payload, { clinicId: CLINIC_ID, reportId: REPORT_ID });
        expectAttribution(violations, this.label, "createReportAccessToken", payload, {
          createdByClinicUserId: CLINIC_USER_ID,
          createdByAdminUserId: null,
          revokedByClinicUserId: null,
          revokedByAdminUserId: null,
        });
      }
      expectAudits(recorder, this.label, [
        {
          event: "report_access_token.created",
          clinicId: CLINIC_ID,
          reportId: REPORT_ID,
          targets: { targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID },
          channel: { createdVia: "clinic" },
        },
      ], violations);
    },
  },
  {
    label: "clinic report access token revoke",
    file: CLINIC_REPORT_ACCESS_APPLICATION,
    recorded: { revokeReportAccessToken: 1, writeAuditLog: 1 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, {}, "createClinicReportAccessOperations");
      await operationsFrom(factory, reportAccessPorts(recorder)).revokeToken(
        REPORT_ACCESS_TOKEN_ID,
        { clinicId: CLINIC_ID, clinicUserId: CLINIC_USER_ID },
        AUDIT_REQUEST,
      );
      const [payload] = calledOnce(recorder, "revokeReportAccessToken", this.label, violations) ?? [];
      if (payload) {
        expectValues(violations, this.label, "revokeReportAccessToken", payload, { id: REPORT_ACCESS_TOKEN_ID });
        expectAttribution(violations, this.label, "revokeReportAccessToken", payload, {
          revokedByClinicUserId: CLINIC_USER_ID,
          revokedByAdminUserId: null,
        });
      }
      expectAudits(recorder, this.label, [
        {
          event: "report_access_token.revoked",
          clinicId: CLINIC_ID,
          reportId: REPORT_ID,
          targets: { targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID },
          channel: { revokedVia: "clinic" },
        },
      ], violations);
    },
  },
  {
    label: "admin particular token create",
    file: ADMIN_PARTICULAR_APPLICATION,
    recorded: { createParticularToken: 1, ensureTrackingForToken: 1, createStudyTrackingNotification: 1 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, particularAccessImports(recorder), "createAdminParticularAccessOperations");
      await operationsFrom(factory, particularAccessPorts(recorder, "admin")).createToken(
        { ...PARTICULAR_TOKEN_DATA, clinicId: CLINIC_ID },
        ADMIN_ID,
      );
      const [payload] = calledOnce(recorder, "createParticularToken", this.label, violations) ?? [];
      if (payload) {
        expectValues(violations, this.label, "createParticularToken", payload, { clinicId: CLINIC_ID, reportId: REPORT_ID });
        expectAttribution(violations, this.label, "createParticularToken", payload, {
          createdByAdminId: ADMIN_ID,
          createdByClinicUserId: null,
        });
      }
      const [tracking] = calledOnce(recorder, "ensureTrackingForToken", this.label, violations) ?? [];
      if (tracking) {
        expectValues(violations, this.label, "ensureTrackingForToken", { tokenId: asRecord(tracking.token).id }, { tokenId: PARTICULAR_TOKEN_ID });
        expectAttribution(violations, this.label, "ensureTrackingForToken", tracking, {
          createdByAdminId: ADMIN_ID,
          createdByClinicUserId: null,
        });
      }
      const [notification] = calledOnce(recorder, "createStudyTrackingNotification", this.label, violations) ?? [];
      if (notification) {
        expectValues(violations, this.label, "createStudyTrackingNotification", notification, {
          studyTrackingCaseId: TRACKING_CASE_ID,
          clinicId: CLINIC_ID,
          particularTokenId: PARTICULAR_TOKEN_ID,
        });
      }
    },
  },
  {
    // List, detail and report relinking backfill a missing tracking case for the token;
    // the case they create is attributed to the admin performing the request.
    label: "admin particular token tracking backfill",
    file: ADMIN_PARTICULAR_APPLICATION,
    recorded: { ensureTrackingForToken: 3, updateParticularTokenReport: 1 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, particularAccessImports(recorder), "createAdminParticularAccessOperations");
      const operations = operationsFrom(factory, {
        ...particularAccessPorts(recorder, "admin"),
        listParticularTokens: async () => [particularTokenRecord("admin")],
        getParticularTokenById: async (id: unknown) => (id === PARTICULAR_TOKEN_ID ? particularTokenRecord("admin") : null),
        updateParticularTokenReport: recorder.port("updateParticularTokenReport", async (id: unknown) =>
          id === PARTICULAR_TOKEN_ID ? particularTokenRecord("admin") : null,
        ),
      });
      await operations.listTokens({ limit: 10, offset: 0, adminId: ADMIN_ID });
      await operations.getToken(PARTICULAR_TOKEN_ID, ADMIN_ID);
      await operations.updateTokenReport(PARTICULAR_TOKEN_ID, REPORT_ID, ADMIN_ID);
      for (const tracking of calledTimes(recorder, "ensureTrackingForToken", 3, this.label, violations)) {
        expectValues(violations, this.label, "ensureTrackingForToken", { tokenId: asRecord(tracking.token).id }, { tokenId: PARTICULAR_TOKEN_ID });
        expectAttribution(violations, this.label, "ensureTrackingForToken", tracking, {
          createdByAdminId: ADMIN_ID,
          createdByClinicUserId: null,
        });
      }
    },
  },
  {
    label: "admin particular token email failure cleanup",
    file: ADMIN_PARTICULAR_APPLICATION,
    recorded: { createParticularToken: 2, revokeParticularToken: 2 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, particularAccessImports(recorder), "createAdminParticularAccessOperations");
      const operations = operationsFrom(factory, failingEmailPorts(recorder, "admin"));
      await operations.createToken({ ...PARTICULAR_TOKEN_DATA, clinicId: CLINIC_ID }, ADMIN_ID);
      await operations.createToken({ ...PARTICULAR_TOKEN_DATA, clinicId: CLINIC_ID }, ADMIN_ID);
      expectCleanupRevokes(recorder, this.label, violations);
    },
  },
  {
    label: "clinic particular token email failure cleanup",
    file: CLINIC_PARTICULAR_APPLICATION,
    recorded: { createParticularToken: 2, revokeParticularToken: 2 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, particularAccessImports(recorder), "createClinicParticularAccessOperations");
      const operations = operationsFrom(factory, failingEmailPorts(recorder, "clinic"));
      const actor = { clinicId: CLINIC_ID, clinicUserId: CLINIC_USER_ID };
      await operations.createToken({ ...PARTICULAR_TOKEN_DATA }, actor);
      await operations.createToken({ ...PARTICULAR_TOKEN_DATA }, actor);
      expectCleanupRevokes(recorder, this.label, violations);
    },
  },
  {
    label: "clinic particular token create",
    file: CLINIC_PARTICULAR_APPLICATION,
    recorded: { createParticularToken: 1, ensureTrackingForToken: 1 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, particularAccessImports(recorder), "createClinicParticularAccessOperations");
      await operationsFrom(factory, particularAccessPorts(recorder, "clinic")).createToken(
        { ...PARTICULAR_TOKEN_DATA },
        { clinicId: CLINIC_ID, clinicUserId: CLINIC_USER_ID },
      );
      const [payload] = calledOnce(recorder, "createParticularToken", this.label, violations) ?? [];
      if (payload) {
        expectValues(violations, this.label, "createParticularToken", payload, { clinicId: CLINIC_ID, reportId: REPORT_ID });
        expectAttribution(violations, this.label, "createParticularToken", payload, {
          createdByAdminId: null,
          createdByClinicUserId: CLINIC_USER_ID,
        });
      }
      const [tracking] = calledOnce(recorder, "ensureTrackingForToken", this.label, violations) ?? [];
      if (tracking) {
        expectValues(violations, this.label, "ensureTrackingForToken", { tokenId: asRecord(tracking.token).id }, { tokenId: PARTICULAR_TOKEN_ID });
        expectAttribution(violations, this.label, "ensureTrackingForToken", tracking, {
          createdByAdminId: null,
          createdByClinicUserId: CLINIC_USER_ID,
        });
      }
    },
  },
  {
    label: "admin study tracking create",
    file: ADMIN_STUDY_TRACKING_APPLICATION,
    recorded: { createStudyTrackingCase: 1, createStudyTrackingNotification: 1, updateParticularTokenReport: 1, updateStudyTrackingCase: 1, writeAuditLog: 2 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, studyTrackingImports(), "createAdminStudyTrackingOperations");
      await operationsFrom(factory, studyTrackingPorts(recorder)).createAdminStudyTrackingCase({
        actor: { adminId: ADMIN_ID },
        data: {
          clinicId: CLINIC_ID,
          reportId: REPORT_ID,
          particularTokenId: PARTICULAR_TOKEN_ID,
          labReceivedAt: new Date(0),
          currentStage: "reception",
          specialStainRequired: true,
        },
        auditRequest: AUDIT_REQUEST,
      });
      const [payload] = calledOnce(recorder, "createStudyTrackingCase", this.label, violations) ?? [];
      if (payload) {
        expectValues(violations, this.label, "createStudyTrackingCase", payload, {
          clinicId: CLINIC_ID,
          reportId: REPORT_ID,
          particularTokenId: PARTICULAR_TOKEN_ID,
        });
        expectAttribution(violations, this.label, "createStudyTrackingCase", payload, {
          createdByAdminId: ADMIN_ID,
          createdByClinicUserId: null,
        });
      }
      expectAudits(recorder, this.label, studyTrackingAudits("admin"), violations);
      expectStudyTrackingTargets(recorder, this.label, { notifications: 1, caseUpdates: 1 }, violations);
    },
  },
  {
    // The update records no persisted actor; its attribution is the admin request
    // context plus the channel metadata of the case audit and of every notification.
    label: "admin study tracking update",
    file: ADMIN_STUDY_TRACKING_APPLICATION,
    recorded: { createStudyTrackingNotification: 3, updateParticularTokenReport: 1, updateStudyTrackingCase: 2, writeAuditLog: 4 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, studyTrackingImports(), "createAdminStudyTrackingOperations");
      await operationsFrom(factory, studyTrackingPorts(recorder)).updateAdminStudyTrackingCase({
        trackingCaseId: TRACKING_CASE_ID,
        current: trackingCaseRecord(),
        data: { currentStage: "processing", specialStainRequired: false },
        auditRequest: AUDIT_REQUEST,
      });
      const notificationAudit: ExpectedAudit = {
        event: "study_tracking.notification.created",
        clinicId: CLINIC_ID,
        reportId: REPORT_ID,
        targets: {},
        channel: { createdVia: "admin" },
      };
      expectAudits(recorder, this.label, [
        {
          event: "study_tracking.case.updated",
          clinicId: CLINIC_ID,
          reportId: REPORT_ID,
          targets: {},
          channel: { updatedVia: "admin" },
        },
        notificationAudit,
        notificationAudit,
        notificationAudit,
      ], violations);
      expectStudyTrackingTargets(recorder, this.label, { notifications: 3, caseUpdates: 2 }, violations);
    },
  },
  {
    label: "clinic study tracking create",
    file: CLINIC_STUDY_TRACKING_APPLICATION,
    recorded: { createStudyTrackingCase: 1, createStudyTrackingNotification: 1, updateParticularTokenReport: 1, updateStudyTrackingCase: 1, writeAuditLog: 2 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, studyTrackingImports(), "createClinicStudyTrackingOperations");
      await operationsFrom(factory, studyTrackingPorts(recorder)).createClinicStudyTrackingCase({
        actor: { clinicId: CLINIC_ID, clinicUserId: CLINIC_USER_ID },
        data: {
          reportId: REPORT_ID,
          particularTokenId: PARTICULAR_TOKEN_ID,
          receptionAt: new Date(0),
          currentStage: "reception",
          specialStainRequired: true,
        },
        auditRequest: AUDIT_REQUEST,
      });
      const [payload] = calledOnce(recorder, "createStudyTrackingCase", this.label, violations) ?? [];
      if (payload) {
        expectValues(violations, this.label, "createStudyTrackingCase", payload, {
          clinicId: CLINIC_ID,
          reportId: REPORT_ID,
          particularTokenId: PARTICULAR_TOKEN_ID,
        });
        expectAttribution(violations, this.label, "createStudyTrackingCase", payload, {
          createdByAdminId: null,
          createdByClinicUserId: CLINIC_USER_ID,
        });
      }
      expectAudits(recorder, this.label, studyTrackingAudits("clinic"), violations);
      expectStudyTrackingTargets(recorder, this.label, { notifications: 1, caseUpdates: 1 }, violations);
    },
  },
  {
    label: "public report access",
    file: PUBLIC_REPORT_ACCESS_APPLICATION,
    recorded: { recordReportAccessTokenAccess: 1, buildPublicActor: 1, writeAuditLog: 1 },
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, { "../domain/index.ts": REPORT_ACCESS_DOMAIN_DOUBLE }, "createPublicReportAccessOperations");
      const publicActor = (tokenId: unknown) => ({ type: "public_report_access_token", reportAccessTokenId: tokenId });
      await operationsFrom(factory, {
        ...reportAccessPorts(recorder),
        getReportAccessTokenWithReportByTokenHash: async (hash: unknown) =>
          hash === `hash:${RAW_REPORT_ACCESS_TOKEN}`
            ? {
                token: reportAccessTokenRecord(),
                report: {
                  id: REPORT_ID,
                  clinicId: CLINIC_ID,
                  storagePath: "reports/sentinel.pdf",
                  fileName: "sentinel.pdf",
                  currentStatus: "delivered",
                },
              }
            : null,
        recordReportAccessTokenAccess: recorder.port("recordReportAccessTokenAccess", async () => ({
          ...reportAccessTokenRecord(),
          accessCount: 1,
          lastAccessAt: new Date(0),
        })),
        createSignedReportUrl: async () => "https://signed.example.test/preview",
        createSignedReportDownloadUrl: async () => "https://signed.example.test/download",
        buildPublicActor: recorder.port("buildPublicActor", publicActor),
      }).access(RAW_REPORT_ACCESS_TOKEN, 0, AUDIT_REQUEST);
      const [accessed] = calledOnce(recorder, "recordReportAccessTokenAccess", this.label, violations) ?? [];
      if (accessed !== undefined) {
        expectValues(violations, this.label, "recordReportAccessTokenAccess", { tokenId: recorder.named("recordReportAccessTokenAccess")[0].args[0] }, { tokenId: REPORT_ACCESS_TOKEN_ID });
      }
      expectAudits(recorder, this.label, [
        {
          event: "report.public_accessed",
          clinicId: CLINIC_ID,
          reportId: REPORT_ID,
          targets: { targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID },
          channel: {},
          actor: publicActor(REPORT_ACCESS_TOKEN_ID),
        },
      ], violations);
    },
  },
];

// ── Audit sink ─────────────────────────────────────────────────────────────

type SinkCase = {
  readonly label: string;
  readonly request: UnknownRecord;
  readonly input: (buildPublicActor: (id: number) => unknown) => UnknownRecord;
  readonly row: UnknownRecord;
};

const SINK_REQUEST = { method: "POST", originalUrl: "/api/sentinel", ip: "203.0.113.7", headers: { "user-agent": "sentinel-agent" } };
const NULL_ACTORS = { actorAdminUserId: null, actorClinicUserId: null, actorReportAccessTokenId: null };

const SINK_CASES: readonly SinkCase[] = [
  {
    label: "admin request",
    request: { ...SINK_REQUEST, adminAuth: { id: ADMIN_ID, username: "admin-sentinel" } },
    input: () => ({
      event: "sentinel.admin",
      clinicId: CLINIC_ID,
      reportId: REPORT_ID,
      targetAdminUserId: TARGET_ADMIN_USER_ID,
      targetClinicUserId: TARGET_CLINIC_USER_ID,
      targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID,
    }),
    row: {
      ...NULL_ACTORS,
      actorType: "admin_user",
      actorAdminUserId: ADMIN_ID,
      clinicId: CLINIC_ID,
      reportId: REPORT_ID,
      targetAdminUserId: TARGET_ADMIN_USER_ID,
      targetClinicUserId: TARGET_CLINIC_USER_ID,
      targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID,
      requestMethod: "POST",
      requestPath: "/api/sentinel",
      ipAddress: "203.0.113.7",
    },
  },
  {
    label: "clinic request",
    request: { ...SINK_REQUEST, auth: { id: CLINIC_USER_ID, clinicId: CLINIC_ID, username: "clinic-sentinel" } },
    input: () => ({ event: "sentinel.clinic", targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID }),
    row: {
      ...NULL_ACTORS,
      actorType: "clinic_user",
      actorClinicUserId: CLINIC_USER_ID,
      clinicId: CLINIC_ID,
      reportId: null,
      targetAdminUserId: null,
      targetClinicUserId: null,
      targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID,
    },
  },
  {
    label: "public token actor",
    request: { ...SINK_REQUEST },
    input: (buildPublicActor) => ({
      event: "sentinel.public",
      clinicId: CLINIC_ID,
      reportId: REPORT_ID,
      targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID,
      actor: buildPublicActor(REPORT_ACCESS_TOKEN_ID),
    }),
    row: {
      ...NULL_ACTORS,
      actorType: "public_report_access_token",
      actorReportAccessTokenId: REPORT_ACCESS_TOKEN_ID,
      clinicId: CLINIC_ID,
      reportId: REPORT_ID,
      targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID,
    },
  },
  {
    label: "explicit actor over an authenticated request",
    request: { ...SINK_REQUEST, auth: { id: CLINIC_USER_ID, clinicId: CLINIC_ID, username: "clinic-sentinel" } },
    input: (buildPublicActor) => ({
      event: "sentinel.public",
      clinicId: CLINIC_ID,
      targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID,
      actor: buildPublicActor(REPORT_ACCESS_TOKEN_ID),
    }),
    row: {
      ...NULL_ACTORS,
      actorType: "public_report_access_token",
      actorReportAccessTokenId: REPORT_ACCESS_TOKEN_ID,
      targetReportAccessTokenId: REPORT_ACCESS_TOKEN_ID,
    },
  },
  {
    label: "unauthenticated request",
    request: { ...SINK_REQUEST },
    input: () => ({ event: "sentinel.system" }),
    row: { ...NULL_ACTORS, actorType: "system", clinicId: null, targetReportAccessTokenId: null },
  },
];

// Drives the real sink (`createWriteAuditLog` → `buildAuditLogInsert` →
// `resolveAuditActorFromRequest`) and compares the row it hands to persistence.
async function evaluateAuditSink(source: string): Promise<string[]> {
  const label = "audit sink";
  const violations: string[] = [];
  try {
    const recorder = createRecorder();
    const createWriteAuditLog = loadModule(
      source,
      AUDIT_SOURCE,
      { "../middlewares/request-logger.ts": { sanitizeUrlForLogs: (url: unknown) => url } },
      "createWriteAuditLog",
    );
    const buildPublicActor = loadModule(
      source,
      AUDIT_SOURCE,
      { "../middlewares/request-logger.ts": { sanitizeUrlForLogs: (url: unknown) => url } },
      "buildPublicReportAccessTokenActor",
    ) as (id: number) => unknown;
    const writeAuditLog = createWriteAuditLog({
      createAuditLog: recorder.port("createAuditLog", async () => undefined),
      logInfo: () => undefined,
      logError: recorder.port("logError"),
      serializeError: (error: unknown) => String(error),
    }) as (request: unknown, input: unknown) => Promise<void>;
    for (const sinkCase of SINK_CASES) {
      await writeAuditLog(sinkCase.request, sinkCase.input(buildPublicActor));
    }
    const rows = recorder.named("createAuditLog");
    if (rows.length !== SINK_CASES.length || recorder.named("logError").length > 0) {
      violations.push(violation("call-count", label, `createAuditLog must persist one row per write (got ${rows.length} rows, ${recorder.named("logError").length} errors)`));
      return violations;
    }
    SINK_CASES.forEach((sinkCase, index) => {
      const row = asRecord(rows[index].args[0]);
      for (const [key, value] of Object.entries(sinkCase.row)) {
        if (!Object.hasOwn(row, key) || !isDeepStrictEqual(row[key], value)) {
          violations.push(violation("sink-row", `${label} ${sinkCase.label}`, `${key} must be ${json(value)} (got ${json(row[key])})`));
        }
      }
    });
  } catch (error) {
    violations.push(asViolation(label, error));
  }
  return violations;
}

// ── Route write surface ────────────────────────────────────────────────────
// A route reaches persistence only through its plugin options, the modules its loader
// imports and its static imports. Every port of the options contract is classified; every
// call into a port or an operations object is censused against the declared sites; every
// use of a dependency container, operations receiver or loaded module is positional; every
// spread is declared with its exact expression; and the runtime import surface is exact.
// A write the registry does not declare cannot be reached without tripping one of these.

type PortClass = "write" | "audit" | "session" | "read" | "effect" | "config";
type SinkClass = Exclude<PortClass, "config">;

// Derived from each port's production wiring (repository, audit, session or pure module).
const PORT_CLASSES: Readonly<Record<string, PortClass>> = {
  createActiveSession: "session",
  deleteActiveSession: "session",
  deleteAdminSession: "session",
  deleteParticularSession: "session",
  updateAdminSessionLastAccess: "session",
  updateParticularSessionLastAccess: "session",
  updateSessionLastAccess: "session",
  createParticularToken: "write",
  createReportAccessToken: "write",
  createStudyTrackingCase: "write",
  createStudyTrackingNotification: "write",
  deleteParticularToken: "write",
  markAllStudyTrackingNotificationsRead: "write",
  markAllStudyTrackingNotificationsReadScoped: "write",
  markStudyTrackingNotificationRead: "write",
  markStudyTrackingNotificationReadScoped: "write",
  recordReportAccessTokenAccess: "write",
  revokeParticularToken: "write",
  revokeReportAccessToken: "write",
  updateParticularTokenReport: "write",
  updateReportStatus: "write",
  updateStudyTrackingCase: "write",
  writeAuditLog: "audit",
  getActiveSessionByToken: "read",
  getAdminSessionByToken: "read",
  getAdminUserById: "read",
  getClinicById: "read",
  getClinicScopedParticularToken: "read",
  getClinicScopedReportAccessToken: "read",
  getClinicScopedReportById: "read",
  getClinicScopedStudyTrackingCase: "read",
  getClinicUserById: "read",
  getParticularSessionByToken: "read",
  getParticularStudyTrackingCase: "read",
  getParticularTokenById: "read",
  getReportAccessTokenById: "read",
  getReportAccessTokenWithReportByTokenHash: "read",
  getReportById: "read",
  getStudyTrackingCaseById: "read",
  getStudyTrackingCaseByReportId: "read",
  listParticularAuditLog: "read",
  listParticularTokens: "read",
  listReportAccessTokens: "read",
  listStudyTrackingCases: "read",
  listStudyTrackingNotifications: "read",
  buildAuditCsv: "effect",
  buildParticularAuditCsvFilename: "effect",
  buildParticularAuditListFilters: "effect",
  createSignedReportDownloadUrl: "effect",
  createSignedReportUrl: "effect",
  generateSessionToken: "effect",
  hashPassword: "effect",
  hashSessionToken: "effect",
  sendParticularTokenEmail: "effect",
  sendSpecialStainRequiredEmail: "effect",
  verifyPassword: "effect",
  createDate: "config",
  mutationRateLimitMaxAttempts: "config",
  mutationRateLimitStore: "config",
  mutationRateLimitWindowMs: "config",
  now: "config",
  publicReportAccessRateLimitMaxAttempts: "config",
  publicReportAccessRateLimitStore: "config",
  publicReportAccessRateLimitWindowMs: "config",
};

type ArgumentShape =
  | string
  | {
      readonly fields: Readonly<Record<string, ArgumentShape>>;
      // Leading spreads by exact expression and order. Absent: the object must not spread.
      readonly spreads?: readonly string[];
      readonly exact?: true;
    };

type RouteComposition = {
  readonly callee: string;
  readonly args: readonly (ArgumentShape | null)[];
  readonly count?: number;
};

type RouteCallSite = RouteComposition & {
  readonly sink: SinkClass | "operation-write" | "operation-read";
  // Calls made before any principal exists: authenticators and dependency wiring.
  readonly principal?: false;
};

type SpreadClass = "composition" | "write-argument" | "wiring" | "executed-helper" | "not-security-relevant";

type RouteSpread = {
  readonly expression: string;
  readonly context: string;
  readonly class: SpreadClass;
  readonly count?: number;
};

type RouteSurface = {
  readonly file: string;
  readonly optionsType: string;
  readonly principals: Readonly<Record<string, string>>;
  readonly calls: readonly RouteCallSite[];
  readonly compositions?: readonly RouteComposition[];
  // Identifiers that hold the port set: plugin options, loaded defaults, wired deps, caches.
  readonly containers: readonly string[];
  // Identifiers bound to a composition result; they may only be the root of a declared call.
  readonly receivers: readonly string[];
  // Functions whose result is a container and must bind to one.
  readonly containerFactories: readonly string[];
  // Destructuring source that binds containers and receivers per request.
  readonly runtime?: string;
  // Ports wired through something other than a pass-through (reads, effects, config only).
  readonly customWiring?: readonly string[];
  readonly spreads: readonly RouteSpread[];
  readonly runtimeImports: Readonly<Record<string, readonly string[]>>;
  readonly dynamicImports: readonly string[];
  readonly loaderCalls: readonly string[];
  readonly imports?: Readonly<Record<string, string>>;
  readonly auditRequestLike?: "admin" | "clinic";
  readonly authorization?: string;
  readonly particularAuthenticator?: true;
};

const ADMIN_PRINCIPALS = { admin: "await authenticateAdminUser(request, reply, deps, now)" };
const PARTICULAR_PRINCIPALS = { particular: "await authenticateParticularUser(request, reply, deps, now)" };
const CLINIC_ACTOR_ARGUMENT: ArgumentShape = { fields: { clinicId: "auth.clinicId", clinicUserId: "auth.id" } };
// The operations receive the route ports untouched: a wrapper around a persistence or
// audit port could rewrite the attribution after the application layer set it.
const PARTICULAR_COMPOSITION: ArgumentShape = {
  fields: {
    studyTracking: {
      fields: {
        getParticularStudyTrackingCase: "deps.getParticularStudyTrackingCase",
        getStudyTrackingCaseByReportId: "deps.getStudyTrackingCaseByReportId",
        createStudyTrackingCase: "deps.createStudyTrackingCase",
        updateStudyTrackingCase: "deps.updateStudyTrackingCase",
      },
      exact: true,
    },
    now: "now",
  },
  spreads: ["deps"],
  exact: true,
};
// The request body reaches the application only as validated data; the actor never
// travels in it.
const PARTICULAR_TOKEN_DATA_ARGUMENT: ArgumentShape = {
  fields: {
    reportId: 'typeof parsed.data.reportId === "number" ? parsed.data.reportId : null',
    detailsLesion: "parsed.data.detailsLesion ?? null",
  },
  spreads: ["parsed.data"],
  exact: true,
};
const AUDIT_PORT_COMPOSITION: ArgumentShape = { fields: { writeAuditLog: "nativeDeps.writeAuditLog" }, exact: true };
const SPECIAL_STAIN_NOTIFICATION_COMPOSITION: ArgumentShape = {
  fields: { sendSpecialStainRequiredEmail: "nativeDeps.sendSpecialStainRequiredEmail" },
  exact: true,
};
// Free globals the routes use; none performs I/O besides console logging, so a global
// persistence channel such as fetch is an unregistered runtime binding.
const ROUTE_GLOBALS = ["Date", "Error", "Math", "Set", "String", "console", "decodeURIComponent", "encodeURIComponent", "undefined"];
// Imported helpers that legitimately receive route ports: the session authenticators.
const PORT_CONSUMERS = ["authenticateFastifyAdmin", "authenticateFastifyClinicUser"];
const LOADER_CONTAINERS = ["options", "defaultDeps", "deps", "defaultDepsPromise"] as const;
const CACHED_LOADER = ["loadDefaultDeps"] as const;
const CORS_IMPORTS = ["enforceTrustedOrigin", "getAllowedOriginForCors", "getAllowedOrigins", "getRequestOrigin"];
const REQUIRED_CORS_IMPORTS = ["enforceTrustedOriginRequired as enforceTrustedOrigin", "getAllowedOriginForCors", "getAllowedOrigins", "getRequestOrigin"];
const COMMON_IMPORTS = {
  "../middlewares/request-logger.ts": ["logRequestCompletion"],
  "../lib/runtime-timing.ts": ["createRuntimeTimer"],
};
const REPORT_ACCESS_RATE_LIMIT_IMPORTS = {
  "../lib/report-access-token-rate-limit.ts": [
    "REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE",
    "REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS",
    "REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS",
  ],
  "../lib/rate-limit-store.ts": ["createMemoryRateLimitStore", "getOrCreateRateLimitEntry", "incrementRateLimitEntry"],
};
const REPORT_ACCESS_DYNAMIC_IMPORTS = ["../db.ts", "../features/reports/composition/index.ts", "../lib/audit.ts", "../lib/auth-security.ts"];
const STUDY_TRACKING_DYNAMIC_IMPORTS = [
  "../db.ts",
  "../features/particular-access/infrastructure/index.ts",
  "../features/reports/composition/index.ts",
  "../features/study-tracking/study-tracking-route-composition.ts",
  "../lib/audit.ts",
  "../lib/auth-security.ts",
  "../lib/email.ts",
];
const PARTICULAR_AUTHENTICATOR_SITES: readonly RouteCallSite[] = [
  { callee: "deps.hashSessionToken", sink: "effect", args: [null], principal: false },
  { callee: "deps.getParticularSessionByToken", sink: "read", args: [null], principal: false },
  { callee: "deps.deleteParticularSession", sink: "session", args: [null], count: 2, principal: false },
  { callee: "deps.getParticularTokenById", sink: "read", args: ["session.particularTokenId"], principal: false },
  { callee: "deps.updateParticularSessionLastAccess", sink: "session", args: [null], principal: false },
];
const CLINIC_REPORT_FALLBACK_SITE: RouteCallSite = { callee: "options.getReportById!", sink: "read", args: ["reportId"], principal: false };

function clinicPrincipals(authorization: string, deps: string): Readonly<Record<string, string>> {
  return {
    auth: `${authorization}(clinicAuth)`,
    clinicAuth: `await authenticateFastifyClinicUser(request, reply, ${deps}, now)`,
  };
}

function authorizationSpread(authorization: string): RouteSpread {
  return { expression: "auth", context: `return in ${authorization}`, class: "executed-helper" };
}

const ROUTE_SURFACES: readonly RouteSurface[] = [
  {
    file: ADMIN_REPORT_ACCESS_ROUTE,
    optionsType: "AdminReportAccessTokensNativeRoutesOptions",
    principals: ADMIN_PRINCIPALS,
    auditRequestLike: "admin",
    calls: [
      { callee: "reportAccess.createToken", sink: "operation-write", args: [null, "admin", "createAuditRequestLike(request, admin)"] },
      { callee: "reportAccess.revokeToken", sink: "operation-write", args: ["tokenId", "admin", "createAuditRequestLike(request, admin)"] },
      { callee: "reportAccess.listTokens", sink: "operation-read", args: [null] },
      { callee: "reportAccess.getToken", sink: "operation-read", args: ["tokenId"] },
    ],
    compositions: [{ callee: "createAdminReportAccessOperations", args: ["deps"] }],
    containers: LOADER_CONTAINERS,
    receivers: ["reportAccess"],
    containerFactories: CACHED_LOADER,
    spreads: [],
    runtimeImports: {
      ...COMMON_IMPORTS,
      ...REPORT_ACCESS_RATE_LIMIT_IMPORTS,
      "../features/report-access/application/index.ts": ["createAdminReportAccessOperations"],
      "../features/report-access/composition/report-access-route-composition.ts": ["loadReportAccessRepository"],
      "../features/report-access/index.ts": [
        "adminCreateReportAccessTokenSchema",
        "buildPublicReportAccessPath",
        "buildValidationError",
        "parseEntityId",
        "parseOffset",
        "parsePositiveInt",
        "serializeReportAccessToken",
        "serializeReportAccessTokenDetail",
      ],
      "../lib/cors-headers.ts": CORS_IMPORTS,
      "../lib/env.ts": ["ENV"],
      "../lib/fastify-admin-auth.ts": ["authenticateFastifyAdmin"],
    },
    dynamicImports: REPORT_ACCESS_DYNAMIC_IMPORTS,
    loaderCalls: ["loadReportAccessRepository"],
  },
  {
    file: CLINIC_REPORT_ACCESS_ROUTE,
    optionsType: "ReportAccessTokensNativeRoutesOptions",
    principals: clinicPrincipals("getReportAccessTokenAuthorization", "deps"),
    auditRequestLike: "clinic",
    authorization: "getReportAccessTokenAuthorization",
    calls: [
      { callee: "reportAccess.createToken", sink: "operation-write", args: [null, CLINIC_ACTOR_ARGUMENT, "createAuditRequestLike(request, auth)"] },
      { callee: "reportAccess.revokeToken", sink: "operation-write", args: ["tokenId", CLINIC_ACTOR_ARGUMENT, "createAuditRequestLike(request, auth)"] },
      { callee: "reportAccess.listTokens", sink: "operation-read", args: ["auth.clinicId", null, null, null] },
      { callee: "reportAccess.getToken", sink: "operation-read", args: ["tokenId", "auth.clinicId"] },
      CLINIC_REPORT_FALLBACK_SITE,
    ],
    compositions: [{ callee: "createClinicReportAccessOperations", args: ["deps"] }],
    containers: LOADER_CONTAINERS,
    receivers: ["reportAccess"],
    containerFactories: CACHED_LOADER,
    customWiring: ["getClinicScopedReportById"],
    spreads: [authorizationSpread("getReportAccessTokenAuthorization")],
    runtimeImports: {
      ...COMMON_IMPORTS,
      ...REPORT_ACCESS_RATE_LIMIT_IMPORTS,
      "../features/report-access/application/index.ts": ["createClinicReportAccessOperations"],
      "../features/report-access/composition/report-access-route-composition.ts": ["loadReportAccessRepository"],
      "../features/report-access/index.ts": [
        "buildPublicReportAccessPath",
        "buildValidationError",
        "clinicCreateReportAccessTokenSchema",
        "parseEntityId",
        "parseOffset",
        "parsePositiveInt",
        "serializeReportAccessToken",
        "serializeReportAccessTokenDetail",
      ],
      "../lib/cors-headers.ts": CORS_IMPORTS,
      "../lib/fastify-clinic-auth.ts": ["authenticateFastifyClinicUser"],
      "../lib/permissions.ts": ["getClinicPermissions"],
    },
    dynamicImports: REPORT_ACCESS_DYNAMIC_IMPORTS,
    loaderCalls: ["loadReportAccessRepository"],
  },
  {
    file: ADMIN_PARTICULAR_ROUTE,
    optionsType: "AdminParticularTokensNativeRoutesOptions",
    principals: ADMIN_PRINCIPALS,
    calls: [
      { callee: "adminOperations.createToken", sink: "operation-write", args: [PARTICULAR_TOKEN_DATA_ARGUMENT, "admin.id"] },
      // Listing, detail and relinking backfill a tracking case attributed to the admin.
      { callee: "adminOperations.listTokens", sink: "operation-write", args: [{ fields: { clinicId: "clinicId", limit: "limit", offset: "offset", adminId: "admin.id" }, exact: true }] },
      { callee: "adminOperations.getToken", sink: "operation-write", args: ["tokenId", "admin.id"] },
      { callee: "adminOperations.updateTokenReport", sink: "operation-write", args: ["tokenId", "parsed.data.reportId", "admin.id"] },
      // Deleting persists no actor column.
      { callee: "adminOperations.deleteToken", sink: "operation-write", args: ["tokenId"], count: 2 },
    ],
    compositions: [{ callee: "createAdminParticularAccessOperations", args: [PARTICULAR_COMPOSITION] }],
    containers: LOADER_CONTAINERS,
    receivers: ["adminOperations"],
    containerFactories: CACHED_LOADER,
    spreads: [
      { expression: "deps", context: "createAdminParticularAccessOperations()", class: "composition" },
      { expression: "parsed.data", context: "adminOperations.createToken()", class: "write-argument" },
      { expression: "getSafeEmailTransportErrorMetadata(result.error)", context: "console.error()", class: "not-security-relevant" },
    ],
    runtimeImports: {
      ...COMMON_IMPORTS,
      "../features/particular-access/application/index.ts": ["createAdminParticularAccessOperations"],
      "../features/particular-access/index.ts": [
        "adminCreateParticularTokenSchema",
        "buildValidationError",
        "parseEntityId",
        "parseOffset",
        "parsePositiveInt",
        "serializeParticularToken",
        "serializeParticularTokenDetail",
        "updateParticularTokenReportSchema",
      ],
      "../features/particular-access/particular-access-route-composition.ts": ["loadAdminParticularAccessRouteDeps"],
      "../lib/cors-headers.ts": CORS_IMPORTS,
      "../lib/email.ts": ["getSafeEmailTransportErrorMetadata"],
      "../lib/env.ts": ["ENV"],
      "../lib/fastify-admin-auth.ts": ["authenticateFastifyAdmin"],
    },
    dynamicImports: [],
    loaderCalls: ["loadAdminParticularAccessRouteDeps"],
  },
  {
    file: CLINIC_PARTICULAR_ROUTE,
    optionsType: "ParticularTokensNativeRoutesOptions",
    principals: clinicPrincipals("getParticularTokensAuthorization", "deps"),
    authorization: "getParticularTokensAuthorization",
    calls: [
      { callee: "clinicOperations.createToken", sink: "operation-write", args: [PARTICULAR_TOKEN_DATA_ARGUMENT, CLINIC_ACTOR_ARGUMENT] },
      { callee: "clinicOperations.listTokens", sink: "operation-read", args: ["auth.clinicId", "limit", "offset"] },
      { callee: "clinicOperations.getToken", sink: "operation-read", args: ["tokenId", "auth.clinicId"] },
      // Relinking persists no actor column; the clinic scope comes from the principal.
      { callee: "clinicOperations.updateTokenReport", sink: "operation-write", args: ["tokenId", "parsed.data.reportId", "auth.clinicId"] },
      CLINIC_REPORT_FALLBACK_SITE,
    ],
    compositions: [{ callee: "createClinicParticularAccessOperations", args: [PARTICULAR_COMPOSITION] }],
    containers: LOADER_CONTAINERS,
    receivers: ["clinicOperations"],
    containerFactories: CACHED_LOADER,
    customWiring: ["getClinicScopedReportById"],
    spreads: [
      authorizationSpread("getParticularTokensAuthorization"),
      { expression: "deps", context: "createClinicParticularAccessOperations()", class: "composition" },
      { expression: "parsed.data", context: "clinicOperations.createToken()", class: "write-argument" },
      { expression: "getSafeEmailTransportErrorMetadata(result.error)", context: "console.error()", class: "not-security-relevant" },
    ],
    runtimeImports: {
      ...COMMON_IMPORTS,
      "../features/particular-access/application/index.ts": ["createClinicParticularAccessOperations"],
      "../features/particular-access/index.ts": [
        "buildValidationError",
        "clinicCreateParticularTokenSchema",
        "parseEntityId",
        "parseOffset",
        "parsePositiveInt",
        "serializeParticularToken",
        "serializeParticularTokenDetail",
        "updateParticularTokenReportSchema",
      ],
      "../features/particular-access/particular-access-route-composition.ts": ["loadClinicParticularAccessRouteDeps"],
      "../lib/cors-headers.ts": CORS_IMPORTS,
      "../lib/email.ts": ["getSafeEmailTransportErrorMetadata"],
      "../lib/fastify-clinic-auth.ts": ["authenticateFastifyClinicUser"],
      "../lib/permissions.ts": ["getClinicPermissions", "normalizeClinicUserRole"],
    },
    dynamicImports: [],
    loaderCalls: ["loadClinicParticularAccessRouteDeps"],
  },
  {
    file: ADMIN_STUDY_TRACKING_ROUTE,
    optionsType: "AdminStudyTrackingNativeRoutesOptions",
    principals: ADMIN_PRINCIPALS,
    auditRequestLike: "admin",
    calls: [
      {
        callee: "adminOperations.createAdminStudyTrackingCase",
        sink: "operation-write",
        args: [{ fields: { actor: { fields: { adminId: "admin.id" } }, auditRequest: "createAuditRequestLike(request, admin)" } }],
      },
      {
        callee: "adminOperations.updateAdminStudyTrackingCase",
        sink: "operation-write",
        args: [{ fields: { auditRequest: "createAuditRequestLike(request, admin)" } }],
      },
      // Acknowledgements persist no actor column; the notification handlers authenticate
      // into authenticatedAdmin and pass no actor.
      { callee: "adminOperations.acknowledgeAdminStudyTrackingNotification", sink: "operation-write", args: ["notificationId"], principal: false },
      { callee: "adminOperations.acknowledgeAllAdminStudyTrackingNotifications", sink: "operation-write", args: [null] },
      { callee: "adminOperations.listAdminStudyTrackingNotifications", sink: "operation-read", args: [null], principal: false },
      { callee: "adminOperations.listAdminStudyTrackingCases", sink: "operation-read", args: [null] },
      { callee: "adminOperations.resolveAdminStudyTrackingCase", sink: "operation-read", args: [null], count: 2 },
    ],
    compositions: [
      {
        callee: "createAdminStudyTrackingOperations",
        args: [
          {
            fields: {
              queryRepository: {
                fields: {
                  getClinicScopedStudyTrackingCase: "nativeDeps.getClinicScopedStudyTrackingCase",
                  getStudyTrackingCaseById: "nativeDeps.getStudyTrackingCaseById",
                  listStudyTrackingCases: "nativeDeps.listStudyTrackingCases",
                  listStudyTrackingNotifications: "nativeDeps.listStudyTrackingNotifications",
                },
                exact: true,
              },
              commandRepository: {
                fields: {
                  createStudyTrackingCase: "nativeDeps.createStudyTrackingCase",
                  updateStudyTrackingCase: "nativeDeps.updateStudyTrackingCase",
                  createStudyTrackingNotification: "nativeDeps.createStudyTrackingNotification",
                  markStudyTrackingNotificationRead: "nativeDeps.markStudyTrackingNotificationRead",
                  markAllStudyTrackingNotificationsRead: "nativeDeps.markAllStudyTrackingNotificationsRead",
                },
                exact: true,
              },
              referenceRepository: {
                fields: {
                  getClinicById: "nativeDeps.getClinicById",
                  getReportById: "nativeDeps.getReportById",
                  getParticularTokenById: "nativeDeps.getParticularTokenById",
                  updateParticularTokenReport: "nativeDeps.updateParticularTokenReport",
                },
                exact: true,
              },
              notification: SPECIAL_STAIN_NOTIFICATION_COMPOSITION,
              audit: AUDIT_PORT_COMPOSITION,
              auditEvents: {
                fields: {
                  caseCreated: "AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
                  caseUpdated: "AUDIT_EVENTS.STUDY_TRACKING_CASE_UPDATED",
                  notificationCreated: "AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED",
                },
                exact: true,
              },
              createDate: "createDate",
            },
            exact: true,
          },
        ],
      },
    ],
    containers: ["options", "defaultDeps", "nativeDeps", "deps"],
    receivers: ["adminOperations"],
    containerFactories: CACHED_LOADER,
    spreads: [],
    runtimeImports: {
      ...COMMON_IMPORTS,
      "../features/study-tracking/application/index.ts": ["createAdminStudyTrackingOperations"],
      "../features/study-tracking/domain/index.ts": [
        "adminCreateStudyTrackingSchema",
        "buildValidationError",
        "parseBooleanQuery",
        "parseEntityId",
        "parseOffset",
        "parsePositiveInt",
        "serializeStudyTrackingCase",
        "serializeStudyTrackingNotification",
        "updateStudyTrackingSchema",
      ],
      "../lib/audit.ts": ["AUDIT_EVENTS"],
      "../lib/cors-headers.ts": CORS_IMPORTS,
      "../lib/env.ts": ["ENV"],
      "../lib/fastify-admin-auth.ts": ["authenticateFastifyAdmin"],
    },
    dynamicImports: STUDY_TRACKING_DYNAMIC_IMPORTS,
    loaderCalls: ["loadAdminStudyTrackingPersistence"],
  },
  {
    file: CLINIC_STUDY_TRACKING_ROUTE,
    optionsType: "StudyTrackingNativeRoutesOptions",
    principals: clinicPrincipals("getStudyTrackingAuthorization", "nativeDeps"),
    auditRequestLike: "clinic",
    authorization: "getStudyTrackingAuthorization",
    calls: [
      {
        callee: "clinicOperations.createClinicStudyTrackingCase",
        sink: "operation-write",
        args: [{ fields: { actor: CLINIC_ACTOR_ARGUMENT, auditRequest: "createAuditRequestLike(request, auth)" } }],
      },
      // Acknowledgements persist no actor column; the clinic scope comes from the principal.
      {
        callee: "clinicOperations.acknowledgeClinicStudyTrackingNotification",
        sink: "operation-write",
        args: [{ fields: { notificationId: "notificationId", clinicId: "auth.clinicId" }, exact: true }],
      },
      { callee: "clinicOperations.acknowledgeAllClinicStudyTrackingNotifications", sink: "operation-write", args: ["auth.clinicId"] },
      { callee: "clinicOperations.listClinicStudyTrackingNotifications", sink: "operation-read", args: [null] },
      { callee: "clinicOperations.listClinicStudyTrackingCases", sink: "operation-read", args: [null] },
      { callee: "clinicOperations.getClinicStudyTrackingCase", sink: "operation-read", args: [null] },
      CLINIC_REPORT_FALLBACK_SITE,
    ],
    compositions: [
      {
        callee: "createClinicStudyTrackingOperations",
        args: [
          {
            fields: {
              queryRepository: "nativeDeps",
              commandRepository: "nativeDeps",
              referenceRepository: "nativeDeps",
              notification: SPECIAL_STAIN_NOTIFICATION_COMPOSITION,
              audit: AUDIT_PORT_COMPOSITION,
              auditEvents: {
                fields: {
                  caseCreated: "AUDIT_EVENTS.STUDY_TRACKING_CASE_CREATED",
                  notificationCreated: "AUDIT_EVENTS.STUDY_TRACKING_NOTIFICATION_CREATED",
                },
                exact: true,
              },
              createDate: "createDate",
            },
            exact: true,
          },
        ],
      },
    ],
    containers: ["options", "defaultDeps", "nativeDeps"],
    receivers: ["clinicOperations"],
    containerFactories: CACHED_LOADER,
    customWiring: ["getClinicScopedReportById"],
    spreads: [
      { expression: "persistence", context: "return in loadDefaultDeps", class: "wiring" },
      authorizationSpread("getStudyTrackingAuthorization"),
    ],
    runtimeImports: {
      ...COMMON_IMPORTS,
      "../features/study-tracking/application/index.ts": ["createClinicStudyTrackingOperations"],
      "../features/study-tracking/domain/index.ts": [
        "buildValidationError",
        "clinicCreateStudyTrackingSchema",
        "parseBooleanQuery",
        "parseEntityId",
        "parseOffset",
        "parsePositiveInt",
        "serializeStudyTrackingCase",
        "serializeStudyTrackingNotification",
      ],
      "../lib/audit.ts": ["AUDIT_EVENTS"],
      "../lib/cors-headers.ts": REQUIRED_CORS_IMPORTS,
      "../lib/fastify-clinic-auth.ts": ["authenticateFastifyClinicUser"],
      "../lib/permissions.ts": ["getClinicPermissions", "normalizeClinicUserRole"],
    },
    dynamicImports: STUDY_TRACKING_DYNAMIC_IMPORTS,
    loaderCalls: ["loadClinicStudyTrackingPersistence"],
  },
  {
    file: REPORTS_STATUS_ROUTE,
    optionsType: "ReportsStatusNativeRoutesOptions",
    principals: clinicPrincipals("getReportsStatusAuthorization", "composition.auth"),
    auditRequestLike: "clinic",
    authorization: "getReportsStatusAuthorization",
    calls: [
      {
        callee: "composition.queries.transitionClinicReportStatus",
        sink: "operation-write",
        args: [{ fields: { clinicId: "auth.clinicId", changedByClinicUserId: "auth.id", changedByAdminUserId: "null" } }],
      },
      { callee: "composition.writeAuditLog", sink: "audit", args: ["createAuditRequestLike(request, auth)", { fields: {} }] },
    ],
    compositions: [{ callee: "createClinicReportStatusRouteComposition", args: ["options"] }],
    containers: ["options"],
    receivers: ["composition"],
    containerFactories: [],
    spreads: [authorizationSpread("getReportsStatusAuthorization")],
    runtimeImports: {
      ...COMMON_IMPORTS,
      "../features/reports/composition/index.ts": ["createClinicReportStatusRouteComposition"],
      "../features/reports/domain/index.ts": ["REPORT_STATUSES", "normalizeOptionalNote", "parseReportId", "parseReportStatus"],
      "../lib/audit.ts": ["AUDIT_EVENTS"],
      "../lib/cors-headers.ts": CORS_IMPORTS,
      "../lib/fastify-clinic-auth.ts": ["authenticateFastifyClinicUser"],
      "../lib/permissions.ts": ["getClinicPermissions"],
    },
    dynamicImports: [],
    loaderCalls: [],
  },
  {
    file: PARTICULAR_AUDIT_ROUTE,
    optionsType: "ParticularAuditNativeRoutesOptions",
    principals: PARTICULAR_PRINCIPALS,
    particularAuthenticator: true,
    calls: [
      { callee: "deps.listParticularAuditLog", sink: "read", args: [null, "particular.tokenId"], count: 2 },
      { callee: "deps.buildParticularAuditListFilters", sink: "effect", args: [null], count: 2 },
      { callee: "deps.buildAuditCsv", sink: "effect", args: [null] },
      { callee: "deps.buildParticularAuditCsvFilename", sink: "effect", args: [] },
      ...PARTICULAR_AUTHENTICATOR_SITES,
    ],
    containers: LOADER_CONTAINERS,
    receivers: [],
    containerFactories: CACHED_LOADER,
    customWiring: ["buildParticularAuditListFilters", "buildAuditCsv", "buildParticularAuditCsvFilename"],
    spreads: [{ expression: "filters", context: "const exportFilters", class: "not-security-relevant" }],
    runtimeImports: {
      ...COMMON_IMPORTS,
      "../lib/env.ts": ["ENV"],
      "../lib/particular-audit.ts": [
        "buildAuditCsv as defaultBuildAuditCsv",
        "buildParticularAuditCsvFilename as defaultBuildParticularAuditCsvFilename",
        "buildParticularAuditListFilters as defaultBuildParticularAuditListFilters",
      ],
      "../lib/session-last-access.ts": ["shouldRefreshSessionLastAccess"],
    },
    dynamicImports: ["../db-audit.ts", "../features/particular-access/infrastructure/index.ts", "../lib/auth-security.ts"],
    loaderCalls: [],
  },
  {
    file: PARTICULAR_STUDY_TRACKING_ROUTE,
    optionsType: "ParticularStudyTrackingNativeRoutesOptions",
    principals: PARTICULAR_PRINCIPALS,
    particularAuthenticator: true,
    calls: [
      { callee: "operations.getParticularStudyTrackingForToken", sink: "operation-read", args: ["particular.tokenId"] },
      {
        callee: "operations.listParticularStudyTrackingNotifications",
        sink: "operation-read",
        args: [{ fields: { particularTokenId: "particular.tokenId" } }],
      },
      {
        callee: "operations.acknowledgeParticularStudyTrackingNotification",
        sink: "operation-write",
        args: [{ fields: { particularTokenId: "particular.tokenId" } }],
      },
      { callee: "operations.acknowledgeAllParticularStudyTrackingNotifications", sink: "operation-write", args: ["particular.tokenId"] },
      ...PARTICULAR_AUTHENTICATOR_SITES,
    ],
    compositions: [
      {
        callee: "createParticularStudyTrackingOperations",
        args: [{ fields: { queryRepository: "nativeDeps", commandRepository: "nativeDeps" }, exact: true }],
      },
    ],
    containers: ["options", "defaultDeps", "nativeDeps", "deps", "runtimePromise"],
    receivers: ["operations"],
    containerFactories: ["loadDefaultDeps", "resolveParticularStudyTrackingRuntime", "createParticularStudyTrackingRuntimeResolver", "resolveRuntime"],
    runtime: "await resolveRuntime()",
    spreads: [{ expression: "persistence", context: "return in loadDefaultDeps", class: "wiring" }],
    runtimeImports: {
      ...COMMON_IMPORTS,
      "../features/study-tracking/application/index.ts": ["createParticularStudyTrackingOperations"],
      "../features/study-tracking/domain/index.ts": [
        "parseBooleanQuery",
        "parseEntityId",
        "parseOffset",
        "parsePositiveInt",
        "serializeStudyTrackingCase",
        "serializeStudyTrackingNotification",
      ],
      "../lib/cors-headers.ts": REQUIRED_CORS_IMPORTS,
      "../lib/env.ts": ["ENV"],
      "../lib/session-last-access.ts": ["shouldRefreshSessionLastAccess"],
    },
    dynamicImports: [
      "../features/particular-access/infrastructure/index.ts",
      "../features/study-tracking/study-tracking-route-composition.ts",
      "../lib/auth-security.ts",
    ],
    loaderCalls: ["loadParticularStudyTrackingPersistence"],
  },
  {
    file: PUBLIC_REPORT_ACCESS_ROUTE,
    optionsType: "PublicReportAccessNativeRoutesOptions",
    principals: {},
    calls: [{ callee: "reportAccess.access", sink: "operation-write", args: ["parsed.data", "currentTime", "request"] }],
    compositions: [
      {
        callee: "createPublicReportAccessOperations",
        args: [{ fields: { buildPublicActor: "buildPublicReportAccessTokenActor" }, spreads: ["deps"], exact: true }],
      },
    ],
    containers: LOADER_CONTAINERS,
    receivers: ["reportAccess"],
    containerFactories: CACHED_LOADER,
    customWiring: ["createSignedReportUrl", "createSignedReportDownloadUrl", "hashSessionToken"],
    spreads: [{ expression: "deps", context: "createPublicReportAccessOperations()", class: "composition" }],
    runtimeImports: {
      ...COMMON_IMPORTS,
      "../features/report-access/application/index.ts": ["createPublicReportAccessOperations"],
      "../features/report-access/composition/report-access-route-composition.ts": ["loadReportAccessRepository"],
      "../features/report-access/index.ts": ["reportAccessTokenRawTokenSchema", "serializePublicReportAccess"],
      "../lib/audit.ts": ["buildPublicReportAccessTokenActor"],
      "../lib/auth-security.ts": ["hashSessionToken as defaultHashSessionToken"],
      "../lib/cors-headers.ts": ["getAllowedOriginForCors", "getAllowedOrigins"],
      "../lib/env.ts": ["ENV"],
      "../lib/public-report-access-rate-limit.ts": [
        "PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE",
        "PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS",
        "PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS",
      ],
      "../lib/rate-limit-store.ts": ["consumeRateLimitAttempt", "createPersistentRateLimitStore"],
      "../lib/supabase.ts": [
        "createSignedReportDownloadUrl as defaultCreateSignedReportDownloadUrl",
        "createSignedReportUrl as defaultCreateSignedReportUrl",
      ],
    },
    dynamicImports: ["../db.ts", "../lib/audit.ts"],
    loaderCalls: ["createPersistentRateLimitStore", "loadReportAccessRepository"],
    imports: { buildPublicReportAccessTokenActor: "../lib/audit.ts" },
  },
];

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

// Wrappers that only re-type an expression.
function isRetyping(node: ts.Node): node is ts.ParenthesizedExpression | ts.NonNullExpression | ts.AsExpression | ts.SatisfiesExpression | ts.TypeAssertion {
  return ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node);
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (isRetyping(current)) {
    current = current.expression;
  }
  return current;
}

function outermost(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (isRetyping(current.parent) && current.parent.expression === current) {
    current = current.parent;
  }
  return current;
}

function literalText(expression: ts.Expression): string | undefined {
  return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression) ? expression.text : undefined;
}

function accessedName(node: ts.Node): string | undefined {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }
  return ts.isElementAccessExpression(node) ? literalText(node.argumentExpression) : undefined;
}

function calleeOf(expression: ts.Expression): ts.CallExpression | undefined {
  const outer = outermost(expression);
  return ts.isCallExpression(outer.parent) && outer.parent.expression === outer ? outer.parent : undefined;
}

function inTypePosition(node: ts.Node): boolean {
  for (let current = node.parent; current !== undefined && !ts.isSourceFile(current); current = current.parent) {
    if (ts.isTypeNode(current)) {
      return true;
    }
  }
  return false;
}

function isValueReference(identifier: ts.Identifier): boolean {
  const parent = identifier.parent;
  if (inTypePosition(identifier) || isBindingName(identifier)) {
    return false;
  }
  if ((ts.isPropertyAccessExpression(parent) || ts.isQualifiedName(parent)) && (ts.isPropertyAccessExpression(parent) ? parent.name : parent.right) === identifier) {
    return false;
  }
  if (
    (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent) || ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent)) &&
    parent.name === identifier
  ) {
    return false;
  }
  if (ts.isBindingElement(parent) && parent.propertyName === identifier) {
    return false;
  }
  return !(ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isTypeAliasDeclaration(parent) || ts.isTypeParameterDeclaration(parent) || ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent));
}

function isWithin(node: ts.Node, ancestor: ts.Node): boolean {
  for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
    if (current === ancestor) {
      return true;
    }
  }
  return false;
}

function moduleFunction(file: ts.SourceFile, name: string): ts.FunctionDeclaration | undefined {
  const matches = file.statements.filter((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  return matches.length === 1 ? matches[0] : undefined;
}

function moduleFunctionNames(file: ts.SourceFile): Set<string> {
  return new Set(file.statements.flatMap((statement) => (ts.isFunctionDeclaration(statement) && statement.name ? [statement.name.text] : [])));
}

function importedNames(file: ts.SourceFile): Set<string> {
  return new Set(
    descendants(file, (node): node is ts.Identifier => ts.isIdentifier(node) && isBindingName(node) && (ts.isImportSpecifier(node.parent) || ts.isImportClause(node.parent) || ts.isNamespaceImport(node.parent))).map(
      (identifier) => identifier.text,
    ),
  );
}

// Name of the nearest named function around `node`: a declaration or a const bound to one.
function enclosingName(node: ts.Node): string {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text;
    }
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) {
      return current.parent.name.text;
    }
  }
  return "<module>";
}

function withinFunctions(node: ts.Node, file: ts.SourceFile, names: readonly string[]): boolean {
  return names.some((name) => {
    const declaration = moduleFunction(file, name);
    return declaration !== undefined && isWithin(node, declaration);
  });
}

function spreadContext(spread: ts.SpreadAssignment | ts.SpreadElement): string {
  if (ts.isCallExpression(spread.parent)) {
    return `${canonicalText(spread.parent.expression)}()`;
  }
  let current: ts.Node = spread.parent;
  while (ts.isObjectLiteralExpression(current.parent) || ts.isArrayLiteralExpression(current.parent) || ts.isPropertyAssignment(current.parent) || ts.isSpreadAssignment(current.parent) || isRetyping(current.parent)) {
    current = current.parent;
  }
  const parent = current.parent;
  if (ts.isCallExpression(parent)) {
    return `${canonicalText(parent.expression)}()`;
  }
  if (ts.isReturnStatement(parent) || ts.isArrowFunction(parent)) {
    return `return in ${enclosingName(parent)}`;
  }
  if (ts.isVariableDeclaration(parent)) {
    return `const ${canonicalText(parent.name)}`;
  }
  return ts.SyntaxKind[parent.kind];
}

function canonicalText(node: ts.Node): string {
  return canonical(node, node.getSourceFile());
}

// A spread of a plain binding resolves, in its own function, to exactly one const: the
// wired dependency object for identifiers, the validated request data for member reads.
function spreadBindingProblem(expression: ts.Expression): string | undefined {
  const root = ts.isIdentifier(expression) ? expression : ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) ? expression.expression : undefined;
  if (root === undefined) {
    return "must be a plain binding, not a literal, call, conditional or nested spread";
  }
  const scope = enclosingFunction(expression) ?? expression.getSourceFile();
  const declarations = bindingDeclarations(scope, root.text);
  const declaration = declarations[0];
  if (
    declarations.length !== 1 ||
    !ts.isVariableDeclaration(declaration) ||
    (declaration.parent.flags & ts.NodeFlags.Const) === 0 ||
    (enclosingFunction(declaration) ?? declaration.getSourceFile()) !== scope ||
    declaration.initializer === undefined ||
    (ts.isIdentifier(expression) && !ts.isObjectLiteralExpression(unwrap(declaration.initializer)))
  ) {
    return `must resolve to a single const ${root.text} ${ts.isIdentifier(expression) ? "wired as an object literal " : ""}in its own scope`;
  }
  return undefined;
}

function checkArgument(
  expression: ts.Expression,
  shape: ArgumentShape,
  where: string,
  file: ts.SourceFile,
  label: string,
  violations: string[],
  disabled: DisabledChecks,
): void {
  if (typeof shape === "string") {
    const actual = canonical(expression, file);
    if (actual !== shape) {
      violations.push(violation("route-argument", label, `${where} must be ${shape} (got ${actual})`));
    }
    return;
  }
  if (!ts.isObjectLiteralExpression(expression)) {
    violations.push(violation("route-argument", label, `${where} must be an object literal (got ${canonical(expression, file)})`));
    return;
  }
  const fields = new Map<string, ts.Expression>();
  let lastSpread = -1;
  const positions = new Map<string, number>();
  const spreads: ts.SpreadAssignment[] = [];
  expression.properties.forEach((property, index) => {
    if (ts.isSpreadAssignment(property)) {
      lastSpread = index;
      spreads.push(property);
      if (shape.spreads === undefined) {
        violations.push(violation("route-argument", label, `${where} must not spread ${canonical(property.expression, file)}`));
      }
      return;
    }
    const [name, value] = ts.isPropertyAssignment(property)
      ? [propertyName(property.name), property.initializer]
      : ts.isShorthandPropertyAssignment(property)
        ? [property.name.text, property.name]
        : [undefined, undefined];
    if (name === undefined || value === undefined) {
      violations.push(violation("route-argument", label, `${where} must only hold plain named properties`));
      return;
    }
    if (fields.has(name)) {
      violations.push(violation("route-argument", label, `${where} must declare ${name} once`));
    }
    fields.set(name, value);
    positions.set(name, index);
  });
  // The spread contract names which expression may expand here, in which order, before
  // every explicit field; a boolean "some spread" would admit any wrapper.
  const expectedSpreads = shape.spreads ?? [];
  if (shape.spreads !== undefined && !disabled.has("spread-identity")) {
    const actual = spreads.map((spread) => canonical(spread.expression, file));
    if (!isDeepStrictEqual(actual, expectedSpreads)) {
      violations.push(violation("route-spread", label, `${where} must spread exactly ${json(expectedSpreads)} (got ${json(actual)})`));
    }
    spreads.forEach((spread, index) => {
      if (expression.properties.indexOf(spread) !== index) {
        violations.push(violation("route-spread", label, `${where} spread ${canonical(spread.expression, file)} must lead the object`));
      }
      const problem = spreadBindingProblem(spread.expression);
      if (problem !== undefined) {
        violations.push(violation("route-spread", label, `${where} spread ${canonical(spread.expression, file)} ${problem}`));
      }
    });
  }
  for (const [name, fieldShape] of Object.entries(shape.fields)) {
    const value = fields.get(name);
    if (value === undefined) {
      violations.push(violation("route-argument", label, `${where} must pass ${name}`));
      continue;
    }
    if ((positions.get(name) ?? -1) < lastSpread) {
      violations.push(violation("route-argument", label, `${where}.${name} must not be overridden by a later spread`));
    }
    checkArgument(value, fieldShape, `${where}.${name}`, file, label, violations, disabled);
  }
  for (const name of fields.keys()) {
    if (!Object.hasOwn(shape.fields, name) && (shape.exact || ROUTE_ATTRIBUTION_KEY.test(name))) {
      violations.push(violation("route-argument", label, `${where} must not carry the unexpected ${shape.exact ? "" : "attribution "}key ${name}`));
    }
  }
}

function enclosingFunction(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  let current = node.parent;
  while (current !== undefined && !ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current) && "body" in current) {
      return current as ts.FunctionLikeDeclaration;
    }
    current = current.parent;
  }
  return undefined;
}

function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

function rootIdentifier(expression: ts.Expression): string | undefined {
  let current = expression;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current) || isRetyping(current)) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : undefined;
}

// The principal that feeds a write is the handler's single const bound to the
// authenticated identity, never rebound, reassigned or patched before the write.
function checkPrincipals(handler: ts.Node, surface: RouteSurface, file: ts.SourceFile, label: string, violations: string[]): void {
  for (const [name, initializer] of Object.entries(surface.principals)) {
    const declarations = bindingDeclarations(handler, name);
    const declaration = declarations[0];
    if (
      declarations.length !== 1 ||
      !ts.isVariableDeclaration(declaration) ||
      (declaration.parent.flags & ts.NodeFlags.Const) === 0 ||
      declaration.initializer === undefined ||
      canonical(declaration.initializer, file) !== initializer
    ) {
      violations.push(violation("route-principal", label, `${name} must be bound once as const ${name} = ${initializer}`));
    }
    const writes = descendants(handler, (node): node is ts.Node =>
      (ts.isBinaryExpression(node) && isAssignmentOperator(node.operatorToken.kind) && rootIdentifier(node.left) === name) ||
      ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) &&
        rootIdentifier(node.operand) === name) ||
      (ts.isDeleteExpression(node) && rootIdentifier(node.expression) === name) ||
      (ts.isCallExpression(node) &&
        /^Object\.(assign|defineProperty|defineProperties)$/.test(canonical(node.expression, file)) &&
        node.arguments[0] !== undefined &&
        rootIdentifier(node.arguments[0]) === name),
    );
    if (writes.length > 0) {
      violations.push(violation("route-principal", label, `${name} must not be modified before the write (${canonical(writes[0], file)})`));
    }
  }
}

function checkCallSites(
  file: ts.SourceFile,
  surface: RouteSurface,
  sites: readonly (RouteComposition | RouteCallSite)[],
  kind: "call" | "composition",
  violations: string[],
  disabled: DisabledChecks,
): void {
  const calls = descendants(file, ts.isCallExpression);
  for (const site of sites) {
    const label = `${surface.file} ${site.callee}`;
    const matches = calls.filter((call) => canonical(call.expression, file) === site.callee);
    const expected = site.count ?? 1;
    if (matches.length !== expected) {
      violations.push(violation("route-call", label, `must be called exactly ${expected} time(s) (got ${matches.length})`));
      continue;
    }
    for (const call of matches) {
      if (call.arguments.length !== site.args.length) {
        violations.push(violation("route-argument", label, `must pass ${site.args.length} argument(s) (got ${call.arguments.length})`));
        continue;
      }
      site.args.forEach((shape, index) => {
        if (shape !== null) {
          checkArgument(call.arguments[index], shape, `argument ${index + 1}`, file, label, violations, disabled);
        }
      });
      if (kind === "call" && (site as RouteCallSite).principal !== false) {
        // A write outside any handler is judged against the whole module, where the
        // principal is never bound exactly once, so it fails closed.
        checkPrincipals(enclosingFunction(call) ?? file, surface, file, label, violations);
      }
      if (kind === "composition" && !disabled.has("container-use")) {
        // The operations object is bound once, to a declared receiver, and nowhere else.
        let holder: ts.Node = outermost(call);
        while (ts.isAwaitExpression(holder.parent)) {
          holder = outermost(holder.parent);
        }
        const binding = ts.isVariableDeclaration(holder.parent) || ts.isPropertyAssignment(holder.parent) ? holder.parent.name : undefined;
        if (binding === undefined || !ts.isIdentifier(binding) || !surface.receivers.includes(binding.text)) {
          violations.push(violation("route-container", label, `must be bound to a declared operations receiver ${json(surface.receivers)}`));
        }
      }
    }
  }
}

type PortContract = ReadonlyMap<string, ts.TypeNode | undefined>;

// The plugin options type is the injectable port contract of the route.
function portContract(file: ts.SourceFile, surface: RouteSurface): PortContract | string {
  const aliases = file.statements.filter((statement): statement is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(statement) && statement.name.text === surface.optionsType);
  const plugins = descendants(file, ts.isVariableDeclaration).filter(
    (declaration) =>
      declaration.type !== undefined &&
      ts.isTypeReferenceNode(declaration.type) &&
      canonical(declaration.type.typeName, file) === "FastifyPluginAsync" &&
      declaration.type.typeArguments?.length === 1 &&
      canonical(declaration.type.typeArguments[0], file) === surface.optionsType,
  );
  if (aliases.length !== 1 || !ts.isTypeLiteralNode(aliases[0].type) || plugins.length !== 1) {
    return `the plugin must be declared once as FastifyPluginAsync<${surface.optionsType}> over a type literal`;
  }
  const contract = new Map<string, ts.TypeNode | undefined>();
  for (const member of aliases[0].type.members) {
    const name = member.name === undefined ? undefined : propertyName(member.name);
    if (name === undefined || !ts.isPropertySignature(member)) {
      return `${surface.optionsType} must only declare named properties`;
    }
    contract.set(name, member.type);
  }
  return contract;
}

function isPromiseFunction(type: ts.TypeNode | undefined): boolean {
  return type !== undefined && ts.isFunctionTypeNode(type) && ts.isTypeReferenceNode(type.type) && canonical(type.type.typeName, type.getSourceFile()) === "Promise";
}

function sinkLabel(sink: SinkClass | "operation"): string {
  return {
    write: "persistence write",
    audit: "audit write",
    session: "session write",
    read: "port read",
    effect: "port effect",
    operation: "operation call",
  }[sink];
}

// Every port is classified, and every call into a port or an operations receiver is a
// declared site: DISCOVERED_WRITE_SINKS == DECLARED_WRITE_SINKS.
function checkWriteCensus(file: ts.SourceFile, surface: RouteSurface, contract: PortContract, violations: string[]): void {
  for (const [name, type] of contract) {
    const portClass = PORT_CLASSES[name];
    if (portClass === undefined) {
      violations.push(violation("route-port", `${surface.file} ${name}`, `unclassified port of ${surface.optionsType}`));
    } else if (portClass === "config" && isPromiseFunction(type)) {
      violations.push(violation("route-port", `${surface.file} ${name}`, "returns a Promise and cannot be classified config"));
    } else if (portClass !== "config" && (type === undefined || !ts.isFunctionTypeNode(type))) {
      violations.push(violation("route-port", `${surface.file} ${name}`, `is not a function and cannot be classified ${portClass}`));
    }
  }
  for (const name of surface.customWiring ?? []) {
    if (!contract.has(name) || !["read", "effect"].includes(PORT_CLASSES[name] ?? "")) {
      violations.push(violation("route-port", `${surface.file} ${name}`, "custom wiring is only allowed for read or effect ports of the contract"));
    }
  }
  const ports = new Set([...contract.keys()].filter((name) => PORT_CLASSES[name] !== undefined && PORT_CLASSES[name] !== "config"));
  const declared = new Map(surface.calls.map((site) => [site.callee, site]));
  for (const site of surface.calls) {
    const name = site.callee.replace(/!$/, "").split(".").at(-1) ?? "";
    if (ports.has(name) && site.sink !== PORT_CLASSES[name]) {
      violations.push(violation("route-port", `${surface.file} ${site.callee}`, `is declared ${site.sink} but ${name} is a ${PORT_CLASSES[name]} port`));
    }
  }
  const unregistered = new Set<string>();
  for (const call of descendants(file, ts.isCallExpression)) {
    const callee = unwrap(call.expression);
    const name = accessedName(callee);
    const root = rootIdentifier(callee);
    const sink = name !== undefined && ports.has(name) ? (PORT_CLASSES[name] as SinkClass) : root !== undefined && surface.receivers.includes(root) ? "operation" : undefined;
    const key = canonical(call.expression, file);
    if (sink !== undefined && !declared.has(key) && !unregistered.has(key)) {
      unregistered.add(key);
      violations.push(violation("route-write", surface.file, `unregistered ${sinkLabel(sink)}: ${key}`));
    }
  }
  // A port read without calling it is an alias unless it is the port's own wiring.
  for (const access of descendants(file, (node): node is ts.PropertyAccessExpression | ts.ElementAccessExpression => ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) {
    const name = accessedName(access);
    if (name === undefined || !ports.has(name) || inTypePosition(access) || calleeOf(access) !== undefined) {
      continue;
    }
    const outer = outermost(access);
    if (ts.isPrefixUnaryExpression(outer.parent) && outer.parent.operator === ts.SyntaxKind.ExclamationToken) {
      continue;
    }
    const wiring: string[] = [];
    for (let current: ts.Node = access; current.parent !== undefined; current = current.parent) {
      const parent = current.parent;
      if ((ts.isPropertyAssignment(parent) || ts.isVariableDeclaration(parent)) && parent.initializer === current) {
        wiring.push(parent.name.getText(file));
      }
    }
    const custom = wiring.some((key) => (surface.customWiring ?? []).includes(key)) && ["read", "effect"].includes(PORT_CLASSES[name] ?? "");
    if (!wiring.includes(name) && !custom) {
      violations.push(violation("route-write", `${surface.file} ${name}`, `unregistered reference to ${PORT_CLASSES[name]} port ${name}: ${canonical(outer.parent, file)}`));
    }
  }
}

function inDeclaredComposition(node: ts.Node, surface: RouteSurface, file: ts.SourceFile): boolean {
  const callees = new Set((surface.compositions ?? []).map((site) => site.callee));
  for (let current: ts.Node = node; current.parent !== undefined; current = current.parent) {
    if (ts.isCallExpression(current.parent) && current.parent.arguments.includes(current as ts.Expression)) {
      return callees.has(canonical(current.parent.expression, file));
    }
  }
  return false;
}

function objectHolder(literal: ts.ObjectLiteralExpression): ts.Node {
  let current: ts.Node = literal;
  while (ts.isPropertyAssignment(current.parent) || ts.isObjectLiteralExpression(current.parent) || isRetyping(current.parent)) {
    current = current.parent;
  }
  return current;
}

function isPortConsumer(callee: ts.Expression, surface: RouteSurface, file: ts.SourceFile, imports: Set<string>): boolean {
  const target = unwrap(callee);
  if (!ts.isIdentifier(target)) {
    return false;
  }
  const composition = (surface.compositions ?? []).some((site) => site.callee === target.text);
  return moduleFunctionNames(file).has(target.text) || (imports.has(target.text) && (PORT_CONSUMERS.includes(target.text) || composition));
}

// Objects that may carry ports: the wired containers, what a loader or container factory
// returns, and the port bags handed to the session authenticators.
function isWiringObject(literal: ts.ObjectLiteralExpression, surface: RouteSurface, file: ts.SourceFile, imports: Set<string>): boolean {
  const holder = objectHolder(literal);
  const parent = holder.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return surface.containers.includes(parent.name.text);
  }
  if (ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === holder)) {
    return withinFunctions(parent, file, surface.containerFactories);
  }
  if (ts.isCallExpression(parent) && parent.arguments.includes(holder as ts.Expression)) {
    const callee = unwrap(parent.expression);
    return ts.isIdentifier(callee) && imports.has(callee.text) && PORT_CONSUMERS.includes(callee.text);
  }
  return false;
}

function isPassThrough(value: ts.Expression, name: string): boolean {
  const plain = (expression: ts.Expression): boolean => {
    const inner = unwrap(expression);
    return ts.isPropertyAccessExpression(inner) && ts.isIdentifier(unwrap(inner.expression)) && inner.name.text === name;
  };
  const inner = unwrap(value);
  return plain(inner) || (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && plain(inner.left) && plain(inner.right));
}

// A port reaches the application exactly as the loader or the injector produced it.
function checkPortWiring(file: ts.SourceFile, surface: RouteSurface, contract: PortContract, violations: string[]): void {
  const ports = new Set([...contract.keys()].filter((name) => PORT_CLASSES[name] !== undefined && PORT_CLASSES[name] !== "config"));
  const imports = importedNames(file);
  for (const identifier of descendants(file, ts.isIdentifier)) {
    const parent = identifier.parent;
    const binds = isBindingName(identifier) || ((ts.isBindingElement(parent) || ts.isImportSpecifier(parent)) && parent.propertyName === identifier);
    // A custom-wired read or effect port may import its default implementation under an alias.
    const defaultImplementation = ts.isImportSpecifier(parent) && parent.propertyName === identifier && (surface.customWiring ?? []).includes(identifier.text);
    if (binds && ports.has(identifier.text) && !inTypePosition(identifier) && !defaultImplementation) {
      violations.push(violation("route-wiring", `${surface.file} ${identifier.text}`, `must not bind port ${identifier.text} outside the dependency wiring (${ts.SyntaxKind[parent.kind]})`));
    }
  }
  for (const literal of descendants(file, ts.isObjectLiteralExpression)) {
    if (inDeclaredComposition(literal, surface, file)) {
      continue;
    }
    for (const property of literal.properties) {
      if (property.name !== undefined && ts.isComputedPropertyName(property.name) && literalText(property.name.expression) === undefined) {
        violations.push(violation("route-wiring", surface.file, `object keys must be static (got ${canonical(property.name, file)})`));
        continue;
      }
      const name =
        property.name === undefined ? undefined : ts.isComputedPropertyName(property.name) ? literalText(property.name.expression) : propertyName(property.name);
      if (name === undefined || !ports.has(name)) {
        continue;
      }
      if (!ts.isPropertyAssignment(property)) {
        violations.push(violation("route-wiring", `${surface.file} ${name}`, "port must be wired as a plain property"));
      } else if (!isWiringObject(literal, surface, file, imports)) {
        violations.push(violation("route-wiring", `${surface.file} ${name}`, `port must not be re-keyed outside the dependency wiring (${canonical(property.initializer, file)})`));
      } else if (!(surface.customWiring ?? []).includes(name) && !isPassThrough(property.initializer, name)) {
        violations.push(violation("route-wiring", `${surface.file} ${name}`, `port must be wired as a pass-through (got ${canonical(property.initializer, file)})`));
      }
    }
  }
}

// Bindings produced inside the loader from dynamic imports or declared loader calls.
function loadedModules(file: ts.SourceFile, surface: RouteSurface): Set<string> {
  const loader = moduleFunction(file, "loadDefaultDeps");
  const names = new Set<string>();
  if (loader === undefined) {
    return names;
  }
  for (const declaration of descendants(loader, ts.isVariableDeclaration)) {
    let initializer = declaration.initializer === undefined ? undefined : unwrap(declaration.initializer);
    if (initializer !== undefined && ts.isAwaitExpression(initializer)) {
      initializer = unwrap(initializer.expression);
    }
    const loaded =
      initializer !== undefined &&
      ts.isCallExpression(initializer) &&
      (initializer.expression.kind === ts.SyntaxKind.ImportKeyword || surface.loaderCalls.includes(canonical(initializer.expression, file)));
    if (loaded) {
      for (const identifier of descendants(declaration.name, ts.isIdentifier).concat(ts.isIdentifier(declaration.name) ? [declaration.name] : [])) {
        if (isBindingName(identifier)) {
          names.add(identifier.text);
        }
      }
    }
  }
  return names;
}

function isContainerFactoryResult(call: ts.CallExpression, surface: RouteSurface, file: ts.SourceFile): boolean {
  let holder: ts.Node = outermost(call);
  while (ts.isAwaitExpression(holder.parent) || ts.isConditionalExpression(holder.parent) || isRetyping(holder.parent)) {
    holder = holder.parent;
  }
  const parent = holder.parent;
  const allowed = [...surface.containers, ...surface.containerFactories];
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return allowed.includes(parent.name.text);
  }
  if (ts.isVariableDeclaration(parent) && ts.isObjectBindingPattern(parent.name)) {
    return parent.name.elements.every((element) => ts.isIdentifier(element.name) && [...surface.containers, ...surface.receivers].includes(element.name.text));
  }
  if (ts.isBinaryExpression(parent) && isAssignmentOperator(parent.operatorToken.kind) && parent.right === holder) {
    return ts.isIdentifier(parent.left) && surface.containers.includes(parent.left.text);
  }
  return ts.isReturnStatement(parent) && withinFunctions(parent, file, surface.containerFactories);
}

// Dependency containers, operations receivers and loaded modules are only used in the
// positions the wiring needs; any other use could hand a port to an unmodelled caller.
function checkContainerUse(file: ts.SourceFile, surface: RouteSurface, contract: PortContract, violations: string[]): void {
  const imports = importedNames(file);
  const loaded = loadedModules(file, surface);
  const cachedContainer = (name: string): boolean =>
    descendants(file, ts.isVariableDeclaration).some((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name && (declaration.parent.flags & ts.NodeFlags.Let) !== 0);
  const loaderResult = (expression: ts.Expression): boolean => {
    const call = unwrap(expression);
    if (!ts.isCallExpression(call)) {
      return false;
    }
    const callee = unwrap(call.expression);
    return ts.isArrowFunction(callee) || ts.isFunctionExpression(callee) || [...surface.loaderCalls, ...surface.containerFactories].includes(canonical(call.expression, file));
  };
  for (const identifier of descendants(file, ts.isIdentifier)) {
    if (!isValueReference(identifier)) {
      continue;
    }
    const name = identifier.text;
    const outer = outermost(identifier);
    const parent = outer.parent;
    const report = (problem: string): void => {
      violations.push(violation("route-container", `${surface.file} ${name}`, `${problem}: ${canonical(parent, file)}`));
    };
    if (surface.containers.includes(name)) {
      if (ts.isPropertyAccessExpression(parent) && parent.expression === outer) {
        if (!contract.has(parent.name.text)) {
          report(`reads ${parent.name.text}, which is not a port of ${surface.optionsType}`);
        }
      } else if (ts.isElementAccessExpression(parent) && parent.expression === outer) {
        const key = literalText(parent.argumentExpression);
        if (key === undefined || !contract.has(key)) {
          report("reflective access to a dependency container");
        }
      } else if (ts.isCallExpression(parent) && parent.arguments.includes(outer)) {
        if (!isPortConsumer(parent.expression, surface, file, imports)) {
          report("passes a dependency container to an unmodelled callee");
        }
      } else if (ts.isVariableDeclaration(parent) && parent.initializer === outer) {
        if (!ts.isIdentifier(parent.name) || !surface.containers.includes(parent.name.text)) {
          report("aliases a dependency container");
        }
      } else if (ts.isPropertyAssignment(parent) || ts.isShorthandPropertyAssignment(parent)) {
        const literal = parent.parent;
        const key = propertyName(parent.name) ?? "";
        const returned = ts.isReturnStatement(objectHolder(literal).parent) && withinFunctions(literal, file, surface.containerFactories);
        if (!inDeclaredComposition(literal, surface, file) && !(returned && surface.containers.includes(key))) {
          report("stores a dependency container in an unmodelled object");
        }
      } else if (ts.isSpreadAssignment(parent) || ts.isSpreadElement(parent)) {
        // Judged by the spread census.
      } else if (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken) {
        // Presence test only.
      } else if (ts.isBinaryExpression(parent) && isAssignmentOperator(parent.operatorToken.kind) && parent.left === outer) {
        if (!cachedContainer(name) || !loaderResult(parent.right)) {
          report("reassigns a dependency container");
        }
      } else if (ts.isReturnStatement(parent)) {
        if (!withinFunctions(parent, file, surface.containerFactories)) {
          report("returns a dependency container from an unmodelled function");
        }
      } else {
        report("unmodelled use of a dependency container");
      }
    } else if (surface.receivers.includes(name)) {
      let chain: ts.Expression = outer;
      while ((ts.isPropertyAccessExpression(chain.parent) || isRetyping(chain.parent)) && chain.parent.expression === chain) {
        chain = chain.parent;
      }
      const principal = Object.entries(surface.principals).some(([binding, initializer]) =>
        descendants(file, ts.isVariableDeclaration).some(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === binding &&
            declaration.initializer !== undefined &&
            canonical(declaration.initializer, file) === initializer &&
            isWithin(identifier, declaration.initializer),
        ),
      );
      if (calleeOf(chain) === undefined && !principal) {
        report("uses an operations receiver outside a declared call");
      }
    } else if (loaded.has(name)) {
      const member = (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === outer;
      if (member && ts.isElementAccessExpression(parent) && literalText(parent.argumentExpression) === undefined) {
        report("reflective access to a loaded module");
      } else if (!member && calleeOf(outer) === undefined && !ts.isSpreadAssignment(parent)) {
        report("unmodelled use of a loaded module");
      }
    }
  }
  for (const identifier of descendants(file, ts.isIdentifier)) {
    if (!isBindingName(identifier) || !surface.receivers.includes(identifier.text) || ts.isImportSpecifier(identifier.parent)) {
      continue;
    }
    const declaration = identifier.parent;
    const fromRuntime =
      ts.isBindingElement(declaration) &&
      ts.isVariableDeclaration(declaration.parent.parent) &&
      declaration.parent.parent.initializer !== undefined &&
      canonical(declaration.parent.parent.initializer, file) === surface.runtime;
    let initializer = ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined ? unwrap(declaration.initializer) : undefined;
    if (initializer !== undefined && ts.isAwaitExpression(initializer)) {
      initializer = unwrap(initializer.expression);
    }
    const fromComposition =
      initializer !== undefined && ts.isCallExpression(initializer) && (surface.compositions ?? []).some((site) => site.callee === canonical(initializer.expression, file));
    if (!fromRuntime && !fromComposition) {
      violations.push(violation("route-container", `${surface.file} ${identifier.text}`, `operations receiver must be bound by a declared composition or ${surface.runtime ?? "no runtime"}`));
    }
  }
  for (const call of descendants(file, ts.isCallExpression)) {
    if (surface.containerFactories.includes(canonical(call.expression, file)) && !isContainerFactoryResult(call, surface, file)) {
      violations.push(violation("route-container", `${surface.file} ${canonical(call.expression, file)}`, "result must bind to a dependency container"));
    }
  }
}

// Every spread of the route is declared with its exact expression and context; the ones
// that can carry ports are validated where they are used.
function checkSpreadCensus(file: ts.SourceFile, surface: RouteSurface, violations: string[]): void {
  const discovered = new Map<string, number>();
  for (const spread of descendants(file, (node): node is ts.SpreadAssignment | ts.SpreadElement => ts.isSpreadAssignment(node) || ts.isSpreadElement(node))) {
    const key = `${canonical(spread.expression, file)} @ ${spreadContext(spread)}`;
    discovered.set(key, (discovered.get(key) ?? 0) + 1);
    const declared = surface.spreads.find((entry) => `${entry.expression} @ ${entry.context}` === key);
    if (declared?.class === "wiring") {
      const loader = moduleFunction(file, "loadDefaultDeps");
      const declarations = loader === undefined || !ts.isIdentifier(spread.expression) ? [] : bindingDeclarations(loader, spread.expression.text);
      const declaration = declarations[0];
      let initializer = declaration !== undefined && ts.isVariableDeclaration(declaration) && declaration.initializer ? unwrap(declaration.initializer) : undefined;
      if (initializer !== undefined && ts.isAwaitExpression(initializer)) {
        initializer = unwrap(initializer.expression);
      }
      if (declarations.length !== 1 || initializer === undefined || !ts.isCallExpression(initializer) || !surface.loaderCalls.includes(canonical(initializer.expression, file))) {
        violations.push(violation("route-spread", `${surface.file} ${key}`, "wiring spread must be a single loader binding from a declared loader call"));
      }
    }
  }
  const expected = new Map<string, number>();
  for (const entry of surface.spreads) {
    const key = `${entry.expression} @ ${entry.context}`;
    expected.set(key, (expected.get(key) ?? 0) + (entry.count ?? 1));
    const callee = entry.context.endsWith("()") ? entry.context.slice(0, -2) : undefined;
    const site = surface.calls.find((candidate) => candidate.callee === callee);
    const consistent =
      entry.class === "composition"
        ? (surface.compositions ?? []).some((composition) => composition.callee === callee)
        : entry.class === "write-argument"
          ? site !== undefined && ["operation-write", "write", "audit"].includes(site.sink)
          : entry.class === "wiring"
            ? entry.context === "return in loadDefaultDeps"
            : entry.class === "executed-helper"
              ? surface.authorization !== undefined && entry.context === `return in ${surface.authorization}`
              : callee === undefined || (site === undefined && !(surface.compositions ?? []).some((composition) => composition.callee === callee));
    if (!consistent) {
      violations.push(violation("route-spread", `${surface.file} ${key}`, `cannot be classified ${entry.class} in this context`));
    }
  }
  for (const key of new Set([...discovered.keys(), ...expected.keys()])) {
    if ((discovered.get(key) ?? 0) !== (expected.get(key) ?? 0)) {
      violations.push(violation("route-spread", `${surface.file} ${key}`, `${expected.has(key) ? "declared" : "unmodelled"} spread: expected ${expected.get(key) ?? 0}, got ${discovered.get(key) ?? 0}`));
    }
  }
}

function sortedMultiset(values: readonly string[]): string[] {
  return [...values].sort();
}

// The runtime import surface is exact, dynamic imports live only in the loader, and the
// loader calls nothing but the declared loaders.
function checkImportLedger(file: ts.SourceFile, surface: RouteSurface, violations: string[]): void {
  const actual: Record<string, string[]> = {};
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const clause = statement.importClause;
    const names: string[] = [];
    if (clause === undefined) {
      names.push("(side effect)");
    } else if (!clause.isTypeOnly) {
      if (clause.name) {
        names.push(`default as ${clause.name.text}`);
      }
      const bindings = clause.namedBindings;
      if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
        names.push(`* as ${bindings.name.text}`);
      } else if (bindings !== undefined) {
        for (const element of bindings.elements) {
          if (!element.isTypeOnly) {
            names.push(element.propertyName ? `${element.propertyName.text} as ${element.name.text}` : element.name.text);
          }
        }
      }
    }
    if (names.length > 0) {
      actual[statement.moduleSpecifier.text] = sortedMultiset([...(actual[statement.moduleSpecifier.text] ?? []), ...names]);
    }
  }
  for (const specifier of new Set([...Object.keys(actual), ...Object.keys(surface.runtimeImports)])) {
    const expected = sortedMultiset(surface.runtimeImports[specifier] ?? []);
    const found = actual[specifier] ?? [];
    if (!isDeepStrictEqual(found, expected)) {
      violations.push(violation("route-import", `${surface.file} ${specifier}`, `runtime imports must be ${json(expected)} (got ${json(found)})`));
    }
  }
  const bound = new Set(descendants(file, ts.isIdentifier).filter(isBindingName).map((identifier) => identifier.text));
  const globals = new Set<string>();
  for (const identifier of descendants(file, ts.isIdentifier)) {
    if (isValueReference(identifier) && !bound.has(identifier.text) && !ROUTE_GLOBALS.includes(identifier.text) && !globals.has(identifier.text)) {
      globals.add(identifier.text);
      violations.push(violation("route-import", `${surface.file} ${identifier.text}`, "unregistered global runtime binding"));
    }
  }
  const loader = moduleFunction(file, "loadDefaultDeps");
  const dynamic: string[] = [];
  const loaderCalls: string[] = [];
  for (const call of descendants(file, ts.isCallExpression)) {
    const inLoader = loader !== undefined && isWithin(call, loader);
    if (call.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = call.arguments.length === 1 ? literalText(call.arguments[0]) : undefined;
      dynamic.push(specifier ?? canonical(call, file));
      if (!inLoader || specifier === undefined) {
        violations.push(violation("route-import", `${surface.file} ${canonical(call, file)}`, "dynamic imports must be literal and live in loadDefaultDeps"));
      }
    } else if (inLoader) {
      const callee = unwrap(call.expression);
      if (!ts.isArrowFunction(callee) && !ts.isFunctionExpression(callee)) {
        loaderCalls.push(canonical(call.expression, file));
      }
    }
  }
  if (!isDeepStrictEqual(sortedMultiset(dynamic), sortedMultiset(surface.dynamicImports))) {
    violations.push(violation("route-import", surface.file, `dynamic imports must be ${json(sortedMultiset(surface.dynamicImports))} (got ${json(sortedMultiset(dynamic))})`));
  }
  if (!isDeepStrictEqual(sortedMultiset(loaderCalls), sortedMultiset(surface.loaderCalls))) {
    violations.push(violation("route-import", `${surface.file} loadDefaultDeps`, `loader calls must be ${json(sortedMultiset(surface.loaderCalls))} (got ${json(sortedMultiset(loaderCalls))})`));
  }
}

const HELPER_REQUEST = { method: "PATCH", url: "/api/sentinel", ip: "198.51.100.4", headers: { "user-agent": "sentinel-agent" } };

function replyDouble(): UnknownRecord {
  const reply: UnknownRecord = {};
  for (const method of ["code", "send", "header"]) {
    reply[method] = () => reply;
  }
  return reply;
}

async function checkRouteHelpers(file: ts.SourceFile, surface: RouteSurface, violations: string[]): Promise<void> {
  if (surface.auditRequestLike !== undefined) {
    const label = `${surface.file} createAuditRequestLike`;
    try {
      const helper = compileDeclaration(file, "createAuditRequestLike", {});
      const principal = surface.auditRequestLike === "admin" ? { ...ADMIN_PRINCIPAL } : { ...CLINIC_PRINCIPAL, canManageClinicUsers: true };
      const context = asRecord(helper({ ...HELPER_REQUEST }, principal));
      const identity =
        surface.auditRequestLike === "admin"
          ? asRecord(context.adminAuth).id === ADMIN_ID && context.auth === undefined
          : asRecord(context.auth).id === CLINIC_USER_ID && asRecord(context.auth).clinicId === CLINIC_ID && context.adminAuth === undefined;
      if (!identity) {
        violations.push(violation("route-helper", label, `must carry the authenticated ${surface.auditRequestLike} identity only (got ${json({ adminAuth: context.adminAuth, auth: context.auth })})`));
      }
      if (context.originalUrl !== HELPER_REQUEST.url || context.ip !== HELPER_REQUEST.ip || context.method !== HELPER_REQUEST.method) {
        violations.push(violation("route-helper", label, "must carry the request method, url and ip"));
      }
    } catch (error) {
      violations.push(asViolation(label, error));
    }
  }
  if (surface.authorization !== undefined) {
    const label = `${surface.file} ${surface.authorization}`;
    try {
      const helper = compileDeclaration(file, surface.authorization, {
        getClinicPermissions: () => ({ canManageClinicUsers: true }),
      });
      const authorized = asRecord(helper({ ...CLINIC_PRINCIPAL }));
      if (authorized.id !== CLINIC_USER_ID || authorized.clinicId !== CLINIC_ID) {
        violations.push(violation("route-helper", label, `must keep the authenticated clinic user id and clinicId (got ${json({ id: authorized.id, clinicId: authorized.clinicId })})`));
      }
    } catch (error) {
      violations.push(asViolation(label, error));
    }
  }
  if (surface.particularAuthenticator) {
    const label = `${surface.file} authenticateParticularUser`;
    try {
      const recorder = createRecorder();
      const authenticate = compileDeclaration(file, "authenticateParticularUser", {
        getParticularSessionToken: () => RAW_PARTICULAR_SESSION,
        buildClearParticularSessionCookie: () => "cleared",
        shouldRefreshSessionLastAccess: () => false,
      });
      const principal = asRecord(
        await authenticate({}, replyDouble(), {
          hashSessionToken: (token: string) => `hash:${token}`,
          getParticularSessionByToken: async (hash: unknown) =>
            hash === `hash:${RAW_PARTICULAR_SESSION}`
              ? { id: PARTICULAR_SESSION_ID, particularTokenId: PARTICULAR_TOKEN_ID, expiresAt: null, lastAccess: null }
              : null,
          getParticularTokenById: recorder.port("getParticularTokenById", async (id: unknown) =>
            id === PARTICULAR_TOKEN_ID ? { id, clinicId: CLINIC_ID, reportId: REPORT_ID, isActive: true } : null,
          ),
          deleteParticularSession: async () => undefined,
          updateParticularSessionLastAccess: async () => undefined,
        }, () => 0),
      );
      const lookups = recorder.named("getParticularTokenById").map((call) => call.args[0]);
      if (!isDeepStrictEqual(lookups, [PARTICULAR_TOKEN_ID]) || principal.tokenId !== PARTICULAR_TOKEN_ID || principal.clinicId !== CLINIC_ID) {
        violations.push(violation("route-helper", label, `must resolve the session particularTokenId to the token principal (lookups ${json(lookups)}, got ${json({ tokenId: principal.tokenId, clinicId: principal.clinicId })})`));
      }
    } catch (error) {
      violations.push(asViolation(label, error));
    }
  }
}

function checkImports(file: ts.SourceFile, surface: RouteSurface, violations: string[]): void {
  for (const [name, specifier] of Object.entries(surface.imports ?? {})) {
    const declarations = bindingDeclarations(file, name);
    const binding = declarations.length === 1 && ts.isImportSpecifier(declarations[0]) ? declarations[0] : undefined;
    const importDeclaration = binding?.parent.parent.parent;
    const valueImport =
      binding !== undefined &&
      importDeclaration !== undefined &&
      ts.isStringLiteral(importDeclaration.moduleSpecifier) &&
      importDeclaration.moduleSpecifier.text === specifier &&
      !binding.isTypeOnly &&
      !binding.parent.parent.isTypeOnly;
    if (!valueImport) {
      violations.push(violation("route-import", `${surface.file} ${name}`, `must be bound once, imported from ${specifier}`));
    }
  }
}

async function evaluateRouteSurface(surface: RouteSurface, source: string, disabled: DisabledChecks): Promise<string[]> {
  const file = parseSource(source, surface.file);
  if (file === undefined) {
    return [violation("parse", surface.file, "source must parse as TypeScript before evaluation")];
  }
  const violations: string[] = [];
  checkCallSites(file, surface, surface.calls, "call", violations, disabled);
  checkCallSites(file, surface, surface.compositions ?? [], "composition", violations, disabled);
  checkImports(file, surface, violations);
  await checkRouteHelpers(file, surface, violations);
  const contract = portContract(file, surface);
  if (typeof contract === "string") {
    if (!disabled.has("write-census")) {
      violations.push(violation("route-port", surface.file, contract));
    }
    return violations;
  }
  if (!disabled.has("write-census")) {
    checkWriteCensus(file, surface, contract, violations);
  }
  if (!disabled.has("port-wiring")) {
    checkPortWiring(file, surface, contract, violations);
  }
  if (!disabled.has("container-use")) {
    checkContainerUse(file, surface, contract, violations);
  }
  if (!disabled.has("spread-identity")) {
    checkSpreadCensus(file, surface, violations);
  }
  if (!disabled.has("import-ledger")) {
    checkImportLedger(file, surface, violations);
  }
  return violations;
}

// ── Evaluator ──────────────────────────────────────────────────────────────

async function evaluateApplicationScenario(scenario: ApplicationScenario, source: string, disabled: DisabledChecks): Promise<string[]> {
  const violations: string[] = [];
  const recorder = createRecorder();
  try {
    await scenario.run(source, recorder, violations);
  } catch (error) {
    violations.push(asViolation(scenario.label, error));
  }
  if (!disabled.has("application-census")) {
    const counts = recorder.counts();
    for (const name of [...new Set([...Object.keys(counts), ...Object.keys(scenario.recorded)])].sort()) {
      const expected = scenario.recorded[name] ?? 0;
      if (counts[name] !== expected && !(expected === 0 && counts[name] === undefined)) {
        violations.push(violation("write-census", scenario.label, `${expected === 0 ? "unregistered" : "miscounted"} application write ${name}: expected ${expected} call(s), got ${json(counts[name] ?? 0)}`));
      }
    }
  }
  return violations;
}

const EVALUATED_FILES = [
  ...new Set([
    ...APPLICATION_SCENARIOS.map((scenario) => scenario.file),
    ...ROUTE_SURFACES.map((surface) => surface.file),
    AUDIT_SOURCE,
  ]),
];

async function evaluateFile(file: string, source: string, disabled: DisabledChecks): Promise<string[]> {
  const violations: string[] = [];
  for (const scenario of APPLICATION_SCENARIOS.filter((candidate) => candidate.file === file)) {
    violations.push(...(await evaluateApplicationScenario(scenario, source, disabled)));
  }
  for (const surface of ROUTE_SURFACES.filter((candidate) => candidate.file === file)) {
    violations.push(...(await evaluateRouteSurface(surface, source, disabled)));
  }
  if (file === AUDIT_SOURCE) {
    violations.push(...(await evaluateAuditSink(source)));
  }
  return violations;
}

const REAL_SOURCES = new Map<string, string>();
const REAL_VIOLATIONS = new Map<string, Promise<string[]>>();

function realSource(file: string): string {
  let source = REAL_SOURCES.get(file);
  if (source === undefined) {
    source = readSource(file);
    REAL_SOURCES.set(file, source);
  }
  return source;
}

// Every file is evaluated against its own source; untouched files reuse the verdict on
// the real tree, so a mutation proof is always judged by the complete oracle. Only the
// meta-tests pass `disabled`, to show that each completeness mechanism is load-bearing.
async function evaluateWriteAttribution(
  overrides: Readonly<Record<string, string>> = {},
  disabled: DisabledChecks = ALL_CHECKS,
): Promise<string[]> {
  const violations: string[] = [];
  for (const file of EVALUATED_FILES) {
    if (Object.hasOwn(overrides, file)) {
      violations.push(...(await evaluateFile(file, overrides[file], disabled)));
    } else {
      let verdict = REAL_VIOLATIONS.get(file);
      if (verdict === undefined) {
        verdict = evaluateFile(file, realSource(file), ALL_CHECKS);
        REAL_VIOLATIONS.set(file, verdict);
      }
      violations.push(...(await verdict));
    }
  }
  return violations;
}

function legacyAccepts(overrides: Readonly<Record<string, string>>): boolean {
  try {
    for (const file of Object.keys(LEGACY_ATTRIBUTION_MARKERS)) {
      assertLegacyAttributionMarkers(file, overrides[file] ?? realSource(file));
    }
    return true;
  } catch {
    return false;
  }
}

function countOccurrences(source: string, target: string): number {
  return source.split(target).length - 1;
}

function replaceExactlyOnce(source: string, target: string, replacement: string): string {
  assert.ok(source.includes(target), `mutation target must exist: ${target}`);
  assert.equal(countOccurrences(source, target), 1, `mutation target must appear exactly once: ${target}`);
  return source.replace(target, () => replacement);
}

type Edit = readonly [target: string, replacement: string];

function mutate(file: string, ...edits: Edit[]): Record<string, string> {
  return { [file]: edits.reduce((source, [target, replacement]) => replaceExactlyOnce(source, target, replacement), realSource(file)) };
}

function kindsOf(violations: readonly string[]): string[] {
  return violations.flatMap((entry) => /^\[([a-z-]+)\]/.exec(entry)?.[1] ?? []);
}

async function assertMutationEscapesLegacyButFails(
  overrides: Readonly<Record<string, string>>,
  expected: readonly string[],
  context: string,
  legacy: "accepts" | "not-applicable" = "accepts",
): Promise<void> {
  if (legacy === "accepts") {
    assert.equal(legacyAccepts(overrides), true, `${context}: the legacy presence oracle must stay green on the mutated source`);
  }
  const violations = await evaluateWriteAttribution(overrides);
  for (const fragment of expected) {
    assert.ok(
      violations.some((entry) => entry.includes(fragment)),
      `${context}: expected a violation containing ${fragment}, got ${json(violations)}`,
    );
  }
}

test("write attribution evaluator accepts the current production writes and audit sink", async () => {
  assert.equal(new Set(SENTINEL_IDS).size, SENTINEL_IDS.length, "sentinel ids must be pairwise distinct");
  assert.deepEqual(await evaluateWriteAttribution(), []);
  assert.equal(legacyAccepts({}), true);
});

test("mutation proof: admin token create persisted with null admin attribution keeps every legacy marker but fails the executable oracle", async () => {
  const overrides = mutate(ADMIN_REPORT_ACCESS_APPLICATION, [
    "        createdByAdminUserId: actor.id,\n",
    "        createdByAdminUserId: null, // createdByAdminUserId: actor.id\n",
  ]);
  await assertMutationEscapesLegacyButFails(
    overrides,
    ['[attribution] admin report access token create: createReportAccessToken attribution must be {"createdByAdminUserId":7101'],
    "persisted admin attribution",
  );
});

test("mutation proof: clinic writes persisting clinicId as clinicUserId keep legacy markers but fail the executable oracle", async () => {
  await assertMutationEscapesLegacyButFails(
    mutate(CLINIC_REPORT_ACCESS_APPLICATION, [
      "        createdByClinicUserId: actor.clinicUserId,\n",
      "        createdByClinicUserId: actor.clinicId, // createdByClinicUserId: actor.clinicUserId\n",
    ]),
    ['[attribution] clinic report access token create: createReportAccessToken attribution must be {"createdByAdminUserId":null,"createdByClinicUserId":7303'],
    "clinic application actor",
  );
  await assertMutationEscapesLegacyButFails(
    mutate(CLINIC_REPORT_ACCESS_ROUTE, [
      "      { clinicId: auth.clinicId, clinicUserId: auth.id },\n      createAuditRequestLike(request, auth),\n    );\n\n    if (result.kind === \"report_not_found\")",
      "      { clinicId: auth.clinicId, clinicUserId: auth.clinicId },\n      createAuditRequestLike(request, auth),\n    );\n\n    if (result.kind === \"report_not_found\")",
    ]),
    ["[route-argument] server/routes/report-access-tokens.fastify.ts reportAccess.createToken: argument 2.clinicUserId must be auth.id (got auth.clinicId)"],
    "clinic route actor",
  );
  await assertMutationEscapesLegacyButFails(
    mutate(REPORTS_STATUS_ROUTE, [
      "      changedByClinicUserId: auth.id,\n",
      "      changedByClinicUserId: auth.clinicId, // changedByClinicUserId: auth.id\n",
    ]),
    ["[route-argument] server/routes/reports-status.fastify.ts composition.queries.transitionClinicReportStatus: argument 1.changedByClinicUserId must be auth.id (got auth.clinicId)"],
    "report status actor",
  );
});

test("mutation proof: admin attribution with a non-null incompatible clinic actor fails the null complement", async () => {
  await assertMutationEscapesLegacyButFails(
    mutate(ADMIN_REPORT_ACCESS_APPLICATION, [
      "        createdByClinicUserId: null,\n        createdByAdminUserId: actor.id,\n",
      "        createdByClinicUserId: actor.id, // createdByClinicUserId: null\n        createdByAdminUserId: actor.id,\n",
    ]),
    ['[attribution] admin report access token create: createReportAccessToken attribution must be {"createdByAdminUserId":7101,"createdByClinicUserId":null'],
    "admin null complement",
  );
  await assertMutationEscapesLegacyButFails(
    mutate(ADMIN_PARTICULAR_APPLICATION, [
      "        createdByClinicUserId: null,\n        tokenHash",
      "        createdByClinicUserId: adminId, // createdByClinicUserId: null\n        tokenHash",
    ]),
    ['[attribution] admin particular token create: createParticularToken attribution must be {"createdByAdminId":7101,"createdByClinicUserId":null}'],
    "admin particular null complement",
  );
});

test("mutation proof: actor and target swaps keep legacy markers but fail the executable oracle", async () => {
  await assertMutationEscapesLegacyButFails(
    mutate(ADMIN_REPORT_ACCESS_APPLICATION, [
      "        targetReportAccessTokenId: token.id,\n        metadata: {\n          tokenLast4: token.tokenLast4,\n          expiresAt",
      "        targetReportAccessTokenId: actor.id,\n        metadata: {\n          tokenLast4: token.tokenLast4,\n          expiresAt",
    ]),
    ['[audit-target] admin report access token create audit #1: targets must be {"targetReportAccessTokenId":7505} (got {"targetReportAccessTokenId":7101})'],
    "admin id used as audit target",
  );
  await assertMutationEscapesLegacyButFails(
    mutate(PUBLIC_REPORT_ACCESS_APPLICATION, [
      "        actor: deps.buildPublicActor(record.token.id),\n",
      "        actor: deps.buildPublicActor(record.report.id), // deps.buildPublicActor(record.token.id)\n",
    ]),
    ['[audit-actor] public report access audit #1: actor must be {"type":"public_report_access_token","reportAccessTokenId":7505} (got {"type":"public_report_access_token","reportAccessTokenId":7404})'],
    "public actor built from the report id",
  );
  await assertMutationEscapesLegacyButFails(
    mutate(ADMIN_REPORT_ACCESS_APPLICATION, [
      "        revokedByAdminUserId: actor.id,\n",
      "        revokedByAdminUserId: tokenId, // revokedByAdminUserId: actor.id\n",
    ]),
    ['[attribution] admin report access token revoke: revokeReportAccessToken attribution must be {"revokedByAdminUserId":7101,"revokedByClinicUserId":null} (got {"revokedByAdminUserId":7505'],
    "target token persisted as revoking actor",
  );
});

test("mutation proof: audit sink mapping the clinic actor to null keeps the legacy marker but fails the executable oracle", async () => {
  await assertMutationEscapesLegacyButFails(
    mutate(AUDIT_SOURCE, [
      "    actorClinicUserId: actor.clinicUserId ?? null,\n",
      "    actorClinicUserId: null, // actorClinicUserId: actor.clinicUserId ?? null\n",
    ]),
    ["[sink-row] audit sink clinic request: actorClinicUserId must be 7303 (got null)"],
    "audit sink clinic actor",
  );
});

type AttackCase = {
  readonly attack: string;
  readonly file: string;
  readonly edits: readonly Edit[];
  readonly expected: readonly string[];
  readonly legacy?: "accepts" | "not-applicable";
};

const ADMIN_CREATE_ACTOR: Edit = ["        createdByAdminUserId: actor.id,\n", "        createdByAdminUserId: null,\n"];
const ADMIN_CREATE_VIOLATION = '[attribution] admin report access token create: createReportAccessToken attribution must be {"createdByAdminUserId":7101';

const ATTACK_MATRIX: readonly AttackCase[] = [
  {
    attack: "correct marker only in a string",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [ADMIN_CREATE_ACTOR, ["export function createAdminReportAccessOperations<", 'export const ATTRIBUTION_NOTE = "createdByAdminUserId: actor.id";\n\nexport function createAdminReportAccessOperations<']],
    expected: [ADMIN_CREATE_VIOLATION],
  },
  {
    attack: "correct marker only in a template",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [ADMIN_CREATE_ACTOR, ["export function createAdminReportAccessOperations<", "export const ATTRIBUTION_NOTE = `createdByAdminUserId: actor.id`;\n\nexport function createAdminReportAccessOperations<"]],
    expected: [ADMIN_CREATE_VIOLATION],
  },
  {
    attack: "correct decoy object never reaches the sink",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [ADMIN_CREATE_ACTOR, ["      const rawToken = deps.generateSessionToken();\n      const tokenHash", "      const decoy = { createdByAdminUserId: actor.id };\n      void decoy;\n      const rawToken = deps.generateSessionToken();\n      const tokenHash"]],
    expected: [ADMIN_CREATE_VIOLATION],
  },
  {
    attack: "live write persists another number as the admin",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [["        createdByAdminUserId: actor.id,\n", "        createdByAdminUserId: data.clinicId, // createdByAdminUserId: actor.id\n"]],
    expected: ['(got {"createdByAdminUserId":7202'],
  },
  {
    attack: "spread after the actor overrides it",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [["        revokedByAdminUserId: null,\n      });\n      await deps.writeAuditLog(auditRequest, {\n        event: \"report_access_token.created\",", "        revokedByAdminUserId: null,\n        ...{ createdByAdminUserId: null },\n      });\n      await deps.writeAuditLog(auditRequest, {\n        event: \"report_access_token.created\","]],
    expected: [ADMIN_CREATE_VIOLATION],
  },
  {
    attack: "payload built correctly then mutated before the write",
    file: CLINIC_REPORT_ACCESS_APPLICATION,
    edits: [
      ["      const token = await deps.createReportAccessToken({\n        clinicId: actor.clinicId,", "      const payload = {\n        clinicId: actor.clinicId,"],
      ["        revokedByAdminUserId: null,\n      });\n      await deps.writeAuditLog(auditRequest, {\n        event: \"report_access_token.created\",", "        revokedByAdminUserId: null,\n      };\n      payload.createdByClinicUserId = actor.clinicId;\n      const token = await deps.createReportAccessToken(payload);\n      await deps.writeAuditLog(auditRequest, {\n        event: \"report_access_token.created\","],
    ],
    expected: ['(got {"createdByAdminUserId":null,"createdByClinicUserId":7202'],
  },
  {
    attack: "correct write only in a dead sibling branch",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [
      ["        revokedByAdminUserId: actor.id,\n", "        revokedByAdminUserId: null,\n"],
      ["      const token = await deps.revokeReportAccessToken({", "      if (tokenId < 0) {\n        await deps.revokeReportAccessToken({ id: tokenId, revokedByClinicUserId: null, revokedByAdminUserId: actor.id });\n      }\n      const token = await deps.revokeReportAccessToken({"],
    ],
    expected: ['[attribution] admin report access token revoke: revokeReportAccessToken attribution must be {"revokedByAdminUserId":7101'],
  },
  {
    attack: "revoke targets the admin id instead of the token",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [["        id: tokenId,\n        revokedByClinicUserId: null,", "        id: actor.id,\n        revokedByClinicUserId: null,"]],
    expected: ["[value] admin report access token revoke: revokeReportAccessToken.id must be 7505 (got 7101)"],
  },
  {
    attack: "incompatible actor field omitted",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [["        id: tokenId,\n        revokedByClinicUserId: null,\n", "        id: tokenId,\n"]],
    expected: ['(got {"revokedByAdminUserId":7101})'],
  },
  {
    attack: "clinic particular token scoped to the clinic user id",
    file: CLINIC_PARTICULAR_APPLICATION,
    edits: [["        clinicId: actor.clinicId,\n        reportId: data.reportId,", "        clinicId: actor.clinicUserId,\n        reportId: data.reportId,"]],
    expected: ["[value] clinic particular token create: createParticularToken.clinicId must be 7202 (got 7303)"],
  },
  {
    attack: "admin particular tracking propagation loses the admin",
    file: ADMIN_PARTICULAR_APPLICATION,
    edits: [["ensureTracking(particularToken, adminId)", "ensureTracking(particularToken, null)"]],
    expected: ['[attribution] admin particular token create: ensureTrackingForToken attribution must be {"createdByAdminId":7101'],
  },
  {
    attack: "clinic study tracking persists clinicId as creator",
    file: CLINIC_STUDY_TRACKING_APPLICATION,
    edits: [["        createdByClinicUserId: input.actor.clinicUserId,\n", "        createdByClinicUserId: input.actor.clinicId, // createdByClinicUserId: input.actor.clinicUserId\n"]],
    expected: ['(got {"createdByAdminId":null,"createdByClinicUserId":7202})'],
  },
  {
    attack: "correct marker only after the write",
    file: ADMIN_STUDY_TRACKING_APPLICATION,
    edits: [
      ["        createdByAdminId: input.actor.adminId,\n", "        createdByAdminId: null,\n"],
      ["export function createAdminStudyTrackingOperations<", 'export const ATTRIBUTION_NOTE = "createdByAdminId: input.actor.adminId";\n\nexport function createAdminStudyTrackingOperations<'],
    ],
    expected: ['[attribution] admin study tracking create: createStudyTrackingCase attribution must be {"createdByAdminId":7101'],
  },
  {
    attack: "sibling audit reports the wrong createdVia",
    file: ADMIN_STUDY_TRACKING_APPLICATION,
    edits: [["            title: studyTrackingNotification.title,\n            createdVia: \"admin\",", "            title: studyTrackingNotification.title,\n            createdVia: \"clinic\","]],
    expected: ['[audit-channel] admin study tracking create audit #2: channel metadata must be {"createdVia":"admin"} (got {"createdVia":"clinic"})'],
  },
  {
    attack: "revokedVia reports the wrong channel",
    file: CLINIC_REPORT_ACCESS_APPLICATION,
    edits: [["            revokedVia: \"clinic\",\n", "            revokedVia: \"admin\", // revokedVia: \"clinic\"\n"]],
    expected: ['[audit-channel] clinic report access token revoke audit #1: channel metadata must be {"revokedVia":"clinic"} (got {"revokedVia":"admin"})'],
  },
  {
    attack: "audit input overrides the request actor",
    file: CLINIC_REPORT_ACCESS_APPLICATION,
    edits: [["          event: \"report_access_token.revoked\",\n", "          event: \"report_access_token.revoked\",\n          actor: { type: \"system\" },\n"]],
    expected: ["[audit-actor] clinic report access token revoke audit #1: must not override the request actor"],
  },
  {
    attack: "audit written without the route request context",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [["      await deps.writeAuditLog(auditRequest, {\n        event: \"report_access_token.created\",", "      await deps.writeAuditLog({}, {\n        event: \"report_access_token.created\","]],
    expected: ["[audit-request] admin report access token create audit #1: must receive the route audit request context unchanged"],
  },
  {
    attack: "audit scoped to the clinic user instead of the clinic",
    file: CLINIC_REPORT_ACCESS_APPLICATION,
    edits: [["          event: \"report_access_token.revoked\",\n          clinicId: token.clinicId,", "          event: \"report_access_token.revoked\",\n          clinicId: actor.clinicUserId,"]],
    expected: ["[audit-scope] clinic report access token revoke audit #1: clinicId must be 7202 (got 7303)"],
  },
  {
    attack: "revoke audit skipped on the live branch",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [["      const report = token ? await deps.getReportById(token.reportId) : null;\n      if (token) {", "      const report = token ? await deps.getReportById(token.reportId) : null;\n      if (!token) {"]],
    expected: ["[call-count] admin report access token revoke: writeAuditLog must be called 1 time(s) (got 0)"],
  },
  {
    attack: "write routed to an alternative sink",
    file: CLINIC_REPORT_ACCESS_APPLICATION,
    edits: [["      const token = await deps.createReportAccessToken({\n        clinicId: actor.clinicId,", "      const token = await deps.createReportAccessTokenUnscoped({\n        clinicId: actor.clinicId,"]],
    expected: ["[completion] clinic report access token create: operation must run to completion against recording ports (TypeError: deps.createReportAccessTokenUnscoped is not a function)"],
  },
  {
    attack: "public actor built from the clinic id",
    file: PUBLIC_REPORT_ACCESS_APPLICATION,
    edits: [["        actor: deps.buildPublicActor(record.token.id),\n", "        actor: deps.buildPublicActor(record.token.clinicId), // deps.buildPublicActor(record.token.id)\n"]],
    expected: ['(got {"type":"public_report_access_token","reportAccessTokenId":7202})'],
  },
  {
    attack: "public audit target points at the report",
    file: PUBLIC_REPORT_ACCESS_APPLICATION,
    edits: [["        targetReportAccessTokenId: record.token.id,\n", "        targetReportAccessTokenId: record.token.reportId, // targetReportAccessTokenId: record.token.id\n"]],
    expected: ['[audit-target] public report access audit #1: targets must be {"targetReportAccessTokenId":7505} (got {"targetReportAccessTokenId":7404})'],
  },
  {
    attack: "public access counter written on another token",
    file: PUBLIC_REPORT_ACCESS_APPLICATION,
    edits: [["deps.recordReportAccessTokenAccess(record.token.id)", "deps.recordReportAccessTokenAccess(record.report.id)"]],
    expected: ["[value] public report access: recordReportAccessTokenAccess.tokenId must be 7505 (got 7404)"],
  },
  {
    attack: "audit sink maps the admin actor from the clinic field",
    file: AUDIT_SOURCE,
    edits: [["    actorAdminUserId: actor.adminUserId ?? null,\n", "    actorAdminUserId: actor.clinicUserId ?? null, // actorAdminUserId: actor.adminUserId ?? null\n"]],
    expected: ["[sink-row] audit sink admin request: actorAdminUserId must be 7101 (got null)"],
  },
  {
    attack: "audit sink persists through an overriding spread",
    file: AUDIT_SOURCE,
    edits: [["      await deps.createAuditLog(payload);", "      await deps.createAuditLog({ ...payload, actorAdminUserId: null });"]],
    expected: ["[sink-row] audit sink admin request: actorAdminUserId must be 7101 (got null)"],
  },
  {
    attack: "audit sink swaps target and actor clinic users",
    file: AUDIT_SOURCE,
    edits: [["    targetClinicUserId: input.targetClinicUserId ?? null,", "    targetClinicUserId: actor.clinicUserId ?? null,"]],
    expected: ["[sink-row] audit sink admin request: targetClinicUserId must be 8010 (got null)"],
  },
  {
    attack: "audit sink scopes clinic rows by the clinic user id",
    file: AUDIT_SOURCE,
    edits: [["    clinicId: input.clinicId ?? req.auth?.clinicId ?? null,", "    clinicId: input.clinicId ?? req.auth?.id ?? null,"]],
    expected: ["[sink-row] audit sink clinic request: clinicId must be 7202 (got 7303)"],
  },
  {
    attack: "audit sink ignores the explicit public actor",
    file: AUDIT_SOURCE,
    edits: [["  if (override) {\n", "  if (override && !req.auth) {\n"]],
    expected: ['[sink-row] audit sink explicit actor over an authenticated request: actorType must be "public_report_access_token" (got "clinic_user")'],
  },
  {
    attack: "clinic audit request context carries the clinic id as user id",
    file: CLINIC_REPORT_ACCESS_ROUTE,
    edits: [["          id: auth.id,\n          clinicId: auth.clinicId,\n          username: auth.username,\n          role: auth.role,\n          canManageClinicUsers", "          id: auth.clinicId,\n          clinicId: auth.clinicId,\n          username: auth.username,\n          role: auth.role,\n          canManageClinicUsers"]],
    expected: ["[route-helper] server/routes/report-access-tokens.fastify.ts createAuditRequestLike: must carry the authenticated clinic identity only"],
  },
  {
    attack: "sibling handler audits without the admin context",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [["      tokenId,\n      admin,\n      createAuditRequestLike(request, admin),", "      tokenId,\n      admin,\n      createAuditRequestLike(request),"]],
    expected: ["[route-argument] server/routes/admin-report-access-tokens.fastify.ts reportAccess.revokeToken: argument 3 must be createAuditRequestLike(request, admin) (got createAuditRequestLike(request))"],
  },
  {
    attack: "admin particular route passes the clinic id as admin",
    file: ADMIN_PARTICULAR_ROUTE,
    edits: [["      admin.id,\n    );\n\n    if (result.kind === \"clinic_not_found\")", "      parsed.data.clinicId,\n    );\n\n    if (result.kind === \"clinic_not_found\")"]],
    expected: ["[route-argument] server/routes/admin-particular-tokens.fastify.ts adminOperations.createToken: argument 2 must be admin.id (got parsed.data.clinicId)"],
  },
  {
    attack: "study tracking route actor adds an admin attribution key",
    file: CLINIC_STUDY_TRACKING_ROUTE,
    edits: [["        clinicUserId: auth.id,\n      },\n      data: parsed.data,", "        clinicUserId: auth.id,\n      },\n      createdByAdminId: null,\n      data: parsed.data,"]],
    expected: ["must not carry the unexpected attribution key createdByAdminId"],
  },
  {
    attack: "principal rebound to a forged clinic user",
    file: CLINIC_PARTICULAR_ROUTE,
    edits: [["    const auth = getParticularTokensAuthorization(clinicAuth);\n\n    if (!requireParticularTokenManagementPermission(auth, reply)) {\n      return reply;\n    }\n\n    const parsed", "    const auth = { ...getParticularTokensAuthorization(clinicAuth), id: clinicAuth.clinicId };\n\n    if (!requireParticularTokenManagementPermission(auth, reply)) {\n      return reply;\n    }\n\n    const parsed"]],
    expected: ["[route-principal] server/routes/particular-tokens.fastify.ts clinicOperations.createToken: auth must be bound once as const auth = getParticularTokensAuthorization(clinicAuth)"],
  },
  {
    attack: "principal patched before the write",
    file: REPORTS_STATUS_ROUTE,
    edits: [["    const reportId = parseReportId(request.params.reportId);", "    Object.assign(auth, { id: auth.clinicId });\n    const reportId = parseReportId(request.params.reportId);"]],
    expected: ["[route-principal] server/routes/reports-status.fastify.ts composition.queries.transitionClinicReportStatus: auth must not be modified before the write"],
  },
  {
    attack: "authorization helper overrides the clinic user id",
    file: CLINIC_REPORT_ACCESS_ROUTE,
    edits: [["function getReportAccessTokenAuthorization(\n  auth: FastifyAuthenticatedClinicUser,\n): AuthenticatedClinicUser {\n  const permissions = getClinicPermissions(auth.role);\n\n  return {\n    ...auth,\n", "function getReportAccessTokenAuthorization(\n  auth: FastifyAuthenticatedClinicUser,\n): AuthenticatedClinicUser {\n  const permissions = getClinicPermissions(auth.role);\n\n  return {\n    ...auth,\n    id: auth.clinicId,\n"]],
    expected: ["[route-helper] server/routes/report-access-tokens.fastify.ts getReportAccessTokenAuthorization: must keep the authenticated clinic user id and clinicId"],
  },
  {
    attack: "particular principal resolved from the session id",
    file: PARTICULAR_AUDIT_ROUTE,
    edits: [["  const particularToken = await deps.getParticularTokenById(\n    session.particularTokenId,\n  );", "  // getParticularTokenById(session.particularTokenId)\n  const particularToken = await deps.getParticularTokenById(\n    session.id,\n  );"]],
    expected: ["[route-helper] server/routes/particular-audit.fastify.ts authenticateParticularUser: must resolve the session particularTokenId to the token principal"],
  },
  {
    attack: "particular principal exposes the clinic id as token id",
    file: PARTICULAR_STUDY_TRACKING_ROUTE,
    edits: [["    tokenId: particularToken.id,\n", "    tokenId: particularToken.clinicId,\n"]],
    expected: ["[route-helper] server/routes/particular-study-tracking.fastify.ts authenticateParticularUser: must resolve the session particularTokenId to the token principal"],
  },
  {
    attack: "particular audit listing filtered by the clinic",
    file: PARTICULAR_AUDIT_ROUTE,
    edits: [["    const result = await deps.listParticularAuditLog(\n      filters,\n      particular.tokenId,\n    );", "    const result = await deps.listParticularAuditLog(\n      filters,\n      particular.clinicId,\n    );"]],
    expected: ["[route-argument] server/routes/particular-audit.fastify.ts deps.listParticularAuditLog: argument 2 must be particular.tokenId (got particular.clinicId)"],
  },
  {
    attack: "particular notification acknowledgement scoped by clinic",
    file: PARTICULAR_STUDY_TRACKING_ROUTE,
    edits: [["        notificationId,\n        particularTokenId: particular.tokenId,", "        notificationId,\n        particularTokenId: particular.clinicId,"]],
    expected: ["[route-argument] server/routes/particular-study-tracking.fastify.ts operations.acknowledgeParticularStudyTrackingNotification: argument 1.particularTokenId must be particular.tokenId (got particular.clinicId)"],
  },
  {
    attack: "public actor builder shadowed by a local forgery",
    file: PUBLIC_REPORT_ACCESS_ROUTE,
    edits: [["import { buildPublicReportAccessTokenActor } from \"../lib/audit.ts\";", "const buildPublicReportAccessTokenActor = (id: number) => ({ type: \"system\", reportAccessTokenId: id });"]],
    expected: ["[route-import] server/routes/public-report-access.fastify.ts buildPublicReportAccessTokenActor: must be bound once, imported from ../lib/audit.ts"],
  },
  {
    attack: "public composition overrides the actor builder with a later spread",
    file: PUBLIC_REPORT_ACCESS_ROUTE,
    edits: [["    buildPublicActor: buildPublicReportAccessTokenActor,\n  });", "    buildPublicActor: buildPublicReportAccessTokenActor,\n    ...options,\n  });"]],
    expected: ["argument 1.buildPublicActor must not be overridden by a later spread"],
  },
  {
    attack: "admin study tracking update audit reports the wrong updatedVia",
    file: ADMIN_STUDY_TRACKING_APPLICATION,
    edits: [["          updatedVia: \"admin\",\n", "          updatedVia: \"clinic\",\n"]],
    expected: ['[audit-channel] admin study tracking update audit #1: channel metadata must be {"updatedVia":"admin"} (got {"updatedVia":"clinic"})'],
  },
  {
    attack: "admin particular listing backfills tracking without the admin",
    file: ADMIN_PARTICULAR_APPLICATION,
    edits: [["ensureTracking(token, params.adminId)", "ensureTracking(token, null)"]],
    expected: ['[attribution] admin particular token tracking backfill: ensureTrackingForToken attribution must be {"createdByAdminId":7101'],
  },
  {
    attack: "email failure cleanup revokes the admin id instead of the token",
    file: ADMIN_PARTICULAR_APPLICATION,
    edits: [["        const cleanupError = await revokeAfterEmailFailure(\n          deps,\n          particularToken.id,\n        );\n        return {\n          kind: \"email_failed\",", "        const cleanupError = await revokeAfterEmailFailure(\n          deps,\n          adminId,\n        );\n        return {\n          kind: \"email_failed\","]],
    expected: ["[value] admin particular token email failure cleanup: revokeParticularToken must revoke the created token 7606 on both failure branches (got [7606,7101])"],
  },
  {
    attack: "clinic email failure cleanup revokes the clinic user id",
    file: CLINIC_PARTICULAR_APPLICATION,
    edits: [["          const cleanupError = await revokeAfterEmailFailure(\n            deps,\n            particularToken.id,\n          );", "          const cleanupError = await revokeAfterEmailFailure(\n            deps,\n            actor.clinicUserId,\n          );"]],
    expected: ["[value] clinic particular token email failure cleanup: revokeParticularToken must revoke the created token 7606 on both failure branches (got [7303,7606])"],
  },
  {
    attack: "admin study tracking update writes onto the clinic id",
    file: ADMIN_STUDY_TRACKING_APPLICATION,
    edits: [["      const updated = await commands.updateStudyTrackingCase(\n        input.trackingCaseId,", "      const updated = await commands.updateStudyTrackingCase(\n        input.current.clinicId,"]],
    expected: ["[value] admin study tracking update: updateStudyTrackingCase must target case 7707 2 time(s) (got [7202,7707])"],
  },
  {
    attack: "clinic study tracking relinks the token with swapped ids",
    file: CLINIC_STUDY_TRACKING_APPLICATION,
    edits: [["        await deps.referenceRepository.updateParticularTokenReport(\n          created.particularTokenId,\n          created.reportId,\n        );", "        await deps.referenceRepository.updateParticularTokenReport(\n          created.reportId,\n          created.particularTokenId,\n        );"]],
    expected: ["[value] clinic study tracking create: updateParticularTokenReport must relink token 7606 to report 7404 once (got [[7404,7606]])"],
  },
  {
    attack: "admin study tracking stage notification targets the clinic as case",
    file: ADMIN_STUDY_TRACKING_APPLICATION,
    edits: [["            studyTrackingCaseId: finalCase.id,\n            clinicId: finalCase.clinicId,", "            studyTrackingCaseId: finalCase.clinicId,\n            clinicId: finalCase.clinicId,"]],
    expected: ["[value] admin study tracking update: createStudyTrackingNotification.studyTrackingCaseId must be 7707 (got 7202)"],
  },
  {
    attack: "sibling write persists an unattributed study tracking case",
    file: ADMIN_STUDY_TRACKING_APPLICATION,
    edits: [["      const created = await commands.createStudyTrackingCase({\n        clinicId: input.data.clinicId,", "      await commands.createStudyTrackingCase({ ...input.data, createdByAdminId: null, createdByClinicUserId: null });\n      const created = await commands.createStudyTrackingCase({\n        clinicId: input.data.clinicId,"]],
    expected: ["[call-count] admin study tracking create: createStudyTrackingCase must be called exactly once (got 2)"],
  },
  {
    attack: "audit sink drops the persisted row",
    file: AUDIT_SOURCE,
    edits: [["      await deps.createAuditLog(payload);", "      void payload;"]],
    expected: ["[call-count] audit sink: createAuditLog must persist one row per write (got 0 rows"],
  },
  {
    attack: "admin audit request context rewrites the request path",
    file: ADMIN_STUDY_TRACKING_ROUTE,
    edits: [["    originalUrl: request.url,\n    ip: request.ip,\n    headers: request.headers,\n    adminAuth: {", "    originalUrl: \"/redacted\",\n    ip: request.ip,\n    headers: request.headers,\n    adminAuth: {"]],
    expected: ["[route-helper] server/routes/admin-study-tracking.fastify.ts createAuditRequestLike: must carry the request method, url and ip"],
  },
  {
    attack: "clinic actor object lets the request body override it",
    file: CLINIC_PARTICULAR_ROUTE,
    edits: [["        clinicUserId: auth.id,\n      },\n    );", "        clinicUserId: auth.id,\n        ...parsed.data,\n      },\n    );"]],
    expected: ["[route-argument] server/routes/particular-tokens.fastify.ts clinicOperations.createToken: argument 2 must not spread parsed.data"],
  },
  {
    attack: "clinic study tracking actor passed as the raw principal",
    file: CLINIC_STUDY_TRACKING_ROUTE,
    edits: [["      actor: {\n        clinicId: auth.clinicId,\n        clinicUserId: auth.id,\n      },", "      actor: auth,"]],
    expected: ["[route-argument] server/routes/study-tracking.fastify.ts clinicOperations.createClinicStudyTrackingCase: argument 1.actor must be an object literal (got auth)"],
  },
  {
    attack: "clinic revoke actor declares the user id twice",
    file: CLINIC_REPORT_ACCESS_ROUTE,
    edits: [["      { clinicId: auth.clinicId, clinicUserId: auth.id },\n      createAuditRequestLike(request, auth),\n    );\n\n    if (result.kind === \"not_found\")", "      { clinicId: auth.clinicId, clinicUserId: auth.id, clinicUserId: auth.clinicId },\n      createAuditRequestLike(request, auth),\n    );\n\n    if (result.kind === \"not_found\")"]],
    expected: ["[route-argument] server/routes/report-access-tokens.fastify.ts reportAccess.revokeToken: argument 2 must declare clinicUserId once"],
  },
  {
    attack: "report status drops the admin null complement",
    file: REPORTS_STATUS_ROUTE,
    edits: [["      changedByAdminUserId: null,\n", "      // changedByAdminUserId: null,\n"]],
    expected: ["[route-argument] server/routes/reports-status.fastify.ts composition.queries.transitionClinicReportStatus: argument 1 must pass changedByAdminUserId"],
  },
  {
    attack: "report status actor written through a computed key",
    file: REPORTS_STATUS_ROUTE,
    edits: [["      changedByClinicUserId: auth.id,\n", "      [\"changedByClinicUserId\"]: auth.clinicId, // changedByClinicUserId: auth.id\n"]],
    expected: ["[route-argument] server/routes/reports-status.fastify.ts composition.queries.transitionClinicReportStatus: argument 1 must only hold plain named properties"],
  },
  {
    attack: "admin token create passes an extra actor argument",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [["      admin,\n      createAuditRequestLike(request, admin),\n    );\n\n    if (result.kind === \"clinic_not_found\")", "      admin,\n      createAuditRequestLike(request, admin),\n      { id: parsed.data.clinicId },\n    );\n\n    if (result.kind === \"clinic_not_found\")"]],
    expected: ["[route-argument] server/routes/admin-report-access-tokens.fastify.ts reportAccess.createToken: must pass 3 argument(s) (got 4)"],
  },
  {
    attack: "admin token operations composed over a port that nulls the creator",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [["createAdminReportAccessOperations(deps)", "createAdminReportAccessOperations({ ...deps, createReportAccessToken: (input: Record<string, unknown>) => deps.createReportAccessToken({ ...input, createdByAdminUserId: null } as never) })"]],
    expected: ["[route-argument] server/routes/admin-report-access-tokens.fastify.ts createAdminReportAccessOperations: argument 1 must be deps"],
  },
  {
    attack: "particular operations composed over a wrapped persistence port",
    file: CLINIC_PARTICULAR_ROUTE,
    edits: [["      updateStudyTrackingCase: deps.updateStudyTrackingCase,\n    },\n    now,\n  });", "      updateStudyTrackingCase: deps.updateStudyTrackingCase,\n    },\n    now,\n    createParticularToken: (input: Record<string, unknown>) => deps.createParticularToken({ ...input, createdByClinicUserId: null } as never),\n  });"]],
    expected: ["[route-argument] server/routes/particular-tokens.fastify.ts createClinicParticularAccessOperations: argument 1 must not carry the unexpected key createParticularToken"],
  },
  {
    attack: "study tracking audit port rewrites the audit input",
    file: ADMIN_STUDY_TRACKING_ROUTE,
    edits: [["    audit: {\n      writeAuditLog: nativeDeps.writeAuditLog,", "    audit: {\n      writeAuditLog: (request: unknown, input: Record<string, unknown>) => nativeDeps.writeAuditLog(request, { ...input, actor: undefined } as never),"]],
    expected: ["[route-argument] server/routes/admin-study-tracking.fastify.ts createAdminStudyTrackingOperations: argument 1.audit.writeAuditLog must be nativeDeps.writeAuditLog"],
  },
  {
    attack: "unregistered write after the declared operation call",
    file: CLINIC_REPORT_ACCESS_ROUTE,
    edits: [[
      "      { clinicId: auth.clinicId, clinicUserId: auth.id },\n      createAuditRequestLike(request, auth),\n    );\n\n    if (result.kind === \"report_not_found\")",
      "      { clinicId: auth.clinicId, clinicUserId: auth.id },\n      createAuditRequestLike(request, auth),\n    );\n    await deps.revokeReportAccessToken({ id: tokenIdOf(result), revokedByClinicUserId: null, revokedByAdminUserId: null });\n\n    if (result.kind === \"report_not_found\")",
    ]],
    expected: ["[route-write] server/routes/report-access-tokens.fastify.ts: unregistered persistence write: deps.revokeReportAccessToken"],
  },
  {
    attack: "unregistered write in a sibling read handler",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "    const result = await reportAccess.getToken(tokenId);",
      "    if (tokenId > 0) {\n      await deps.revokeReportAccessToken({ id: tokenId, revokedByClinicUserId: null, revokedByAdminUserId: null });\n    }\n    const result = await reportAccess.getToken(tokenId);",
    ]],
    expected: ["[route-write] server/routes/admin-report-access-tokens.fastify.ts: unregistered persistence write: deps.revokeReportAccessToken"],
  },
  {
    attack: "direct nativeDeps write beside the declared operation",
    file: ADMIN_STUDY_TRACKING_ROUTE,
    edits: [[
      "    const result = await adminOperations.createAdminStudyTrackingCase({",
      "    await nativeDeps.createStudyTrackingCase({ clinicId: 1, reportId: null, createdByAdminId: null, createdByClinicUserId: null } as never);\n    const result = await adminOperations.createAdminStudyTrackingCase({",
    ]],
    expected: ["[route-write] server/routes/admin-study-tracking.fastify.ts: unregistered persistence write: nativeDeps.createStudyTrackingCase"],
  },
  {
    attack: "extra audit write through the port",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "    const result = await reportAccess.getToken(tokenId);",
      "    await deps.writeAuditLog(createAuditRequestLike(request), { event: \"report_access_token.viewed\" });\n    const result = await reportAccess.getToken(tokenId);",
    ]],
    expected: ["[route-write] server/routes/admin-report-access-tokens.fastify.ts: unregistered audit write: deps.writeAuditLog"],
  },
  {
    attack: "duplicated audit write through the composition",
    file: REPORTS_STATUS_ROUTE,
    edits: [[
      "    await composition.writeAuditLog(createAuditRequestLike(request, auth), {",
      "    await composition.writeAuditLog(createAuditRequestLike(request), { event: \"report.status_changed\" });\n    await composition.writeAuditLog(createAuditRequestLike(request, auth), {",
    ]],
    expected: ["[route-call] server/routes/reports-status.fastify.ts composition.writeAuditLog: must be called exactly 1 time(s) (got 2)"],
  },
  {
    attack: "write port aliased before the call",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "    const result = await reportAccess.getToken(tokenId);",
      "    const persist = deps.revokeReportAccessToken;\n    await persist({ id: tokenId, revokedByClinicUserId: null, revokedByAdminUserId: null });\n    const result = await reportAccess.getToken(tokenId);",
    ]],
    expected: ["[route-write] server/routes/admin-report-access-tokens.fastify.ts revokeReportAccessToken: unregistered reference to write port revokeReportAccessToken"],
  },
  {
    attack: "write port destructured under another name",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "    const result = await reportAccess.getToken(tokenId);",
      "    const { revokeReportAccessToken: persist } = deps;\n    await persist({ id: tokenId, revokedByClinicUserId: null, revokedByAdminUserId: null });\n    const result = await reportAccess.getToken(tokenId);",
    ]],
    expected: [
      "[route-wiring] server/routes/admin-report-access-tokens.fastify.ts revokeReportAccessToken: must not bind port revokeReportAccessToken outside the dependency wiring",
      "[route-container] server/routes/admin-report-access-tokens.fastify.ts deps: aliases a dependency container",
    ],
  },
  {
    attack: "write port called through a literal element access",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "    const result = await reportAccess.getToken(tokenId);",
      "    await deps[\"revokeReportAccessToken\"]({ id: tokenId, revokedByClinicUserId: null, revokedByAdminUserId: null });\n    const result = await reportAccess.getToken(tokenId);",
    ]],
    expected: ["[route-write] server/routes/admin-report-access-tokens.fastify.ts: unregistered persistence write: deps[\"revokeReportAccessToken\"]"],
  },
  {
    attack: "write port called through a comma expression",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "    const result = await reportAccess.getToken(tokenId);",
      "    await (0, deps.revokeReportAccessToken)({ id: tokenId, revokedByClinicUserId: null, revokedByAdminUserId: null });\n    const result = await reportAccess.getToken(tokenId);",
    ]],
    expected: ["[route-write] server/routes/admin-report-access-tokens.fastify.ts revokeReportAccessToken: unregistered reference to write port revokeReportAccessToken"],
  },
  {
    attack: "admin particular detail backfills tracking without the admin",
    file: ADMIN_PARTICULAR_ROUTE,
    edits: [["adminOperations.getToken(tokenId, admin.id)", "adminOperations.getToken(tokenId, null as never)"]],
    expected: ["[route-argument] server/routes/admin-particular-tokens.fastify.ts adminOperations.getToken: argument 2 must be admin.id (got null as never)"],
  },
  {
    attack: "admin particular relink backfills tracking without the admin",
    file: ADMIN_PARTICULAR_ROUTE,
    edits: [["      parsed.data.reportId,\n      admin.id,\n", "      parsed.data.reportId,\n      0,\n"]],
    expected: ["[route-argument] server/routes/admin-particular-tokens.fastify.ts adminOperations.updateTokenReport: argument 3 must be admin.id (got 0)"],
  },
  {
    attack: "new handler with an unregistered write",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "        : null,\n    });\n  });\n};",
      "        : null,\n    });\n  });\n\n  app.post(\"/forge\", async () =>\n    deps.createReportAccessToken({ clinicId: 1, reportId: 1, tokenHash: \"forged\", tokenLast4: \"0000\", expiresAt: null, createdByClinicUserId: null, createdByAdminUserId: null, revokedByClinicUserId: null, revokedByAdminUserId: null }),\n  );\n};",
    ]],
    expected: ["[route-write] server/routes/admin-report-access-tokens.fastify.ts: unregistered persistence write: deps.createReportAccessToken"],
  },
  {
    attack: "new HTTP method reusing a declared write operation",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "        : null,\n    });\n  });\n};",
      "        : null,\n    });\n  });\n\n  app.put(\"/:tokenId\", async (request) =>\n    reportAccess.revokeToken(Number(request.params), { id: 0, username: \"forged\" }, createAuditRequestLike(request)),\n  );\n};",
    ]],
    expected: ["[route-call] server/routes/admin-report-access-tokens.fastify.ts reportAccess.revokeToken: must be called exactly 1 time(s) (got 2)"],
  },
  {
    attack: "decoy composition beside a malicious live composition",
    file: ADMIN_PARTICULAR_ROUTE,
    edits: [[
      "  const adminOperations = createAdminParticularAccessOperations({\n    ...deps,\n",
      "  const forgedOperations = createAdminParticularAccessOperations({ ...deps, createParticularToken: async () => ({}) } as never);\n  void forgedOperations;\n  const adminOperations = createAdminParticularAccessOperations({\n    ...deps,\n",
    ]],
    expected: ["[route-call] server/routes/admin-particular-tokens.fastify.ts createAdminParticularAccessOperations: must be called exactly 1 time(s) (got 2)"],
  },
  {
    attack: "operations receiver aliased out of the census",
    file: ADMIN_PARTICULAR_ROUTE,
    edits: [["adminOperations.getToken(tokenId, admin.id)", "adminOperations.getToken(tokenId, admin.id);\n    const operationsAlias = adminOperations;\n    void operationsAlias"]],
    expected: ["[route-container] server/routes/admin-particular-tokens.fastify.ts adminOperations: uses an operations receiver outside a declared call"],
  },
  {
    attack: "dynamic import inside a handler",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "    const result = await reportAccess.getToken(tokenId);",
      "    const repository = await import(\"../features/report-access/infrastructure/index.ts\");\n    void repository;\n    const result = await reportAccess.getToken(tokenId);",
    ]],
    expected: ["[route-import] server/routes/admin-report-access-tokens.fastify.ts import(\"../features/report-access/infrastructure/index.ts\"): dynamic imports must be literal and live in loadDefaultDeps"],
  },
  {
    attack: "loader invokes the audit port while wiring",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "      const audit = await import(\"../lib/audit.ts\");\n",
      "      const audit = await import(\"../lib/audit.ts\");\n      await audit.writeAuditLog({}, { event: \"forged\" });\n",
    ]],
    expected: [
      "[route-import] server/routes/admin-report-access-tokens.fastify.ts loadDefaultDeps: loader calls must be",
      "[route-write] server/routes/admin-report-access-tokens.fastify.ts: unregistered audit write: audit.writeAuditLog",
    ],
  },
  {
    attack: "loader wiring wraps the persistence port",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "        createReportAccessToken:\n          reportAccessRepository.createReportAccessToken,",
      "        createReportAccessToken: (input: Record<string, unknown>) =>\n          reportAccessRepository.createReportAccessToken({ ...input, createdByAdminUserId: null } as never),",
    ]],
    expected: ["[route-wiring] server/routes/admin-report-access-tokens.fastify.ts createReportAccessToken: port must be wired as a pass-through"],
  },
  {
    attack: "persistence port re-keyed outside the wiring",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "    const result = await reportAccess.getToken(tokenId);",
      "    const leaked = { createReportAccessToken: deps.createReportAccessToken };\n    void leaked;\n    const result = await reportAccess.getToken(tokenId);",
    ]],
    expected: ["[route-wiring] server/routes/admin-report-access-tokens.fastify.ts createReportAccessToken: port must not be re-keyed outside the dependency wiring"],
  },
  {
    attack: "persistence port wired under a computed key",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "    createReportAccessToken:\n      options.createReportAccessToken ?? defaultDeps!.createReportAccessToken,",
      "    createReportAccessToken:\n      options.createReportAccessToken ?? defaultDeps!.createReportAccessToken,\n    [\"createReport\" + \"AccessToken\"]: async () => undefined,",
    ]],
    expected: ["[route-wiring] server/routes/admin-report-access-tokens.fastify.ts: object keys must be static"],
  },
  {
    attack: "composition spreads the raw plugin options",
    file: ADMIN_PARTICULAR_ROUTE,
    edits: [["  const adminOperations = createAdminParticularAccessOperations({\n    ...deps,\n", "  const adminOperations = createAdminParticularAccessOperations({\n    ...options,\n"]],
    expected: ['[route-spread] server/routes/admin-particular-tokens.fastify.ts createAdminParticularAccessOperations: argument 1 must spread exactly ["deps"] (got ["options"])'],
  },
  {
    attack: "composition spreads a nested wrapper of deps",
    file: ADMIN_PARTICULAR_ROUTE,
    edits: [["  const adminOperations = createAdminParticularAccessOperations({\n    ...deps,\n", "  const adminOperations = createAdminParticularAccessOperations({\n    ...{ ...deps },\n"]],
    expected: ['[route-spread] server/routes/admin-particular-tokens.fastify.ts createAdminParticularAccessOperations: argument 1 must spread exactly ["deps"] (got ["{ ...deps }"])'],
  },
  {
    attack: "composition spreads a function-returned port set",
    file: ADMIN_PARTICULAR_ROUTE,
    edits: [["  const adminOperations = createAdminParticularAccessOperations({\n    ...deps,\n", "  const adminOperations = createAdminParticularAccessOperations({\n    ...structuredClone(deps),\n"]],
    expected: [
      "argument 1 spread structuredClone(deps) must be a plain binding",
      "[route-container] server/routes/admin-particular-tokens.fastify.ts deps: passes a dependency container to an unmodelled callee",
    ],
  },
  {
    attack: "composition spreads a conditional port set",
    file: ADMIN_PARTICULAR_ROUTE,
    edits: [["  const adminOperations = createAdminParticularAccessOperations({\n    ...deps,\n", "  const adminOperations = createAdminParticularAccessOperations({\n    ...(options.now ? deps : options),\n"]],
    expected: ['must spread exactly ["deps"] (got ["(options.now ? deps : options)"])'],
  },
  {
    attack: "composition spread substitutes the audit port",
    file: PUBLIC_REPORT_ACCESS_ROUTE,
    edits: [[
      "  const reportAccess = createPublicReportAccessOperations({\n    ...deps,\n",
      "  const reportAccess = createPublicReportAccessOperations({\n    ...{ ...deps, writeAuditLog: async () => undefined },\n",
    ]],
    expected: ['[route-spread] server/routes/public-report-access.fastify.ts createPublicReportAccessOperations: argument 1 must spread exactly ["deps"]'],
  },
  {
    attack: "composition spread follows an explicit field",
    file: PUBLIC_REPORT_ACCESS_ROUTE,
    edits: [[
      "  const reportAccess = createPublicReportAccessOperations({\n    ...deps,\n    buildPublicActor: buildPublicReportAccessTokenActor,\n",
      "  const reportAccess = createPublicReportAccessOperations({\n    buildPublicActor: buildPublicReportAccessTokenActor,\n    ...deps,\n",
    ]],
    expected: ["argument 1.buildPublicActor must not be overridden by a later spread", "argument 1 spread deps must lead the object"],
  },
  {
    attack: "loader wiring spreads an unmodelled module",
    file: CLINIC_STUDY_TRACKING_ROUTE,
    edits: [["    ...persistence,\n", "    ...(await import(\"../features/study-tracking/infrastructure/index.ts\")),\n"]],
    expected: ["[route-spread] server/routes/study-tracking.fastify.ts persistence @ return in loadDefaultDeps: declared spread: expected 1, got 0"],
  },
  {
    attack: "write argument spreads the raw request body",
    file: CLINIC_PARTICULAR_ROUTE,
    edits: [["        ...parsed.data,\n", "        ...parsed.data,\n        ...(request.body as object),\n"]],
    expected: ['[route-spread] server/routes/particular-tokens.fastify.ts clinicOperations.createToken: argument 1 must spread exactly ["parsed.data"]'],
  },
  {
    attack: "options contract grows an unclassified port",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;\n  mutationRateLimitWindowMs?: number;",
      "  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;\n  purgeReportAccessTokens?: (clinicId: number) => Promise<void>;\n  mutationRateLimitWindowMs?: number;",
    ]],
    expected: ["[route-port] server/routes/admin-report-access-tokens.fastify.ts purgeReportAccessTokens: unclassified port of AdminReportAccessTokensNativeRoutesOptions"],
  },
  {
    attack: "global fetch writes through the persistence REST endpoint",
    file: ADMIN_REPORT_ACCESS_ROUTE,
    edits: [[
      "    const result = await reportAccess.getToken(tokenId);",
      "    await fetch(`${ENV.supabaseUrl}/rest/v1/report_access_tokens`, { method: \"POST\", body: \"{}\" });\n    const result = await reportAccess.getToken(tokenId);",
    ]],
    expected: ["[route-import] server/routes/admin-report-access-tokens.fastify.ts fetch: unregistered global runtime binding"],
  },
  {
    attack: "application creates a token and revokes it without attribution",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [[
      "      await deps.writeAuditLog(auditRequest, {\n        event: \"report_access_token.created\",",
      "      await deps.revokeReportAccessToken({ id: token.id, revokedByClinicUserId: null, revokedByAdminUserId: null });\n      await deps.writeAuditLog(auditRequest, {\n        event: \"report_access_token.created\",",
    ]],
    expected: ["[write-census] admin report access token create: unregistered application write revokeReportAccessToken: expected 0 call(s), got 1"],
  },
];

test("write attribution evaluator rejects the attack matrix that legacy markers accept", async () => {
  for (const attackCase of ATTACK_MATRIX) {
    await assertMutationEscapesLegacyButFails(
      mutate(attackCase.file, ...attackCase.edits),
      attackCase.expected,
      attackCase.attack,
      attackCase.legacy,
    );
  }
});

const FAIL_CLOSED_MATRIX: readonly AttackCase[] = [
  {
    attack: "unparsable application source",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
    edits: [["export function createAdminReportAccessOperations<", "export function createAdminReportAccessOperations<<"]],
    expected: ["[parse] admin report access token create: source must parse as TypeScript before evaluation"],
  },
  {
    attack: "unparsable route source",
    file: REPORTS_STATUS_ROUTE,
    edits: [["function createAuditRequestLike(", "function createAuditRequestLike(("]],
    expected: ["[parse] server/routes/reports-status.fastify.ts: source must parse as TypeScript before evaluation"],
  },
  {
    attack: "unparsable audit sink",
    file: AUDIT_SOURCE,
    edits: [["export function buildAuditLogInsert(", "export function buildAuditLogInsert(("]],
    expected: ["[parse] audit sink: source must parse as TypeScript before evaluation"],
  },
  {
    attack: "duplicated operation factory",
    file: CLINIC_REPORT_ACCESS_APPLICATION,
    edits: [["export function createClinicReportAccessOperations<", "function createClinicReportAccessOperations() {\n  return {};\n}\n\nexport function createClinicReportAccessOperations<"]],
    expected: ["[load] clinic report access token create: createClinicReportAccessOperations must be declared exactly once"],
  },
  {
    attack: "unexpected runtime import",
    file: PUBLIC_REPORT_ACCESS_APPLICATION,
    edits: [["import type {\n  ReportAccessAuditInput,", "import { forgePublicActor } from \"./forged-actor.ts\";\nvoid forgePublicActor;\nimport type {\n  ReportAccessAuditInput,"]],
    expected: ["[load] public report access: unexpected runtime import ./forged-actor.ts"],
  },
  {
    attack: "duplicated route write",
    file: ADMIN_PARTICULAR_ROUTE,
    edits: [["    const result = await adminOperations.createToken(", "    void (() => adminOperations.createToken({}, admin.id));\n    const result = await adminOperations.createToken("]],
    expected: ["[route-call] server/routes/admin-particular-tokens.fastify.ts adminOperations.createToken: must be called exactly 1 time(s) (got 2)"],
  },
  {
    attack: "shadowed audit request helper",
    file: ADMIN_STUDY_TRACKING_ROUTE,
    edits: [["    const result = await adminOperations.createAdminStudyTrackingCase({", "    const createAuditRequestLike = (req: unknown, _admin: unknown) => ({ req });\n    const result = await adminOperations.createAdminStudyTrackingCase({"]],
    expected: ["[load] server/routes/admin-study-tracking.fastify.ts createAuditRequestLike: createAuditRequestLike must be declared exactly once at module level"],
  },
  {
    attack: "public actor builder no longer exported by the audit module",
    file: AUDIT_SOURCE,
    edits: [["export function buildPublicReportAccessTokenActor(", "function buildPublicReportAccessTokenActor("]],
    expected: ["[load] audit sink: buildPublicReportAccessTokenActor must be exported as a function"],
  },
];

test("write attribution evaluator fails closed on unparsable duplicated or unresolvable sources", async () => {
  for (const attackCase of FAIL_CLOSED_MATRIX) {
    await assertMutationEscapesLegacyButFails(mutate(attackCase.file, ...attackCase.edits), attackCase.expected, attackCase.attack, "not-applicable");
  }
});

// Review finding 4112295107: a persistence write the route makes directly, next to the
// declared operation call, must be censused even though every declared call stays correct.
const UNREGISTERED_ROUTE_WRITE: Edit = [
  "    const result = await reportAccess.createToken(\n      {\n        clinicId: parsed.data.clinicId,",
  "    await deps.createReportAccessToken({\n      clinicId: parsed.data.clinicId,\n      reportId: parsed.data.reportId,\n      tokenHash: \"forged-hash\",\n      tokenLast4: \"0000\",\n      expiresAt: null,\n      createdByClinicUserId: null,\n      createdByAdminUserId: null,\n      revokedByClinicUserId: null,\n      revokedByAdminUserId: null,\n    });\n    const result = await reportAccess.createToken(\n      {\n        clinicId: parsed.data.clinicId,",
];
const UNREGISTERED_ROUTE_WRITE_VIOLATION =
  "[route-write] server/routes/admin-report-access-tokens.fastify.ts: unregistered persistence write: deps.createReportAccessToken";

// Review finding 4112295109: a spread may only expand the exact wired binding; a nested
// object that re-wraps the persistence port must fail while studyTracking and now stay put.
const MALICIOUS_COMPOSITION_SPREAD: Edit = [
  "  const clinicOperations = createClinicParticularAccessOperations({\n    ...deps,\n",
  "  const clinicOperations = createClinicParticularAccessOperations({\n    ...{\n      ...deps,\n      createParticularToken: async (payload: Record<string, unknown>) =>\n        deps.createParticularToken({\n          ...payload,\n          createdByClinicUserId: null,\n        } as never),\n    },\n",
];
const MALICIOUS_COMPOSITION_SPREAD_VIOLATION =
  '[route-spread] server/routes/particular-tokens.fastify.ts createClinicParticularAccessOperations: argument 1 must spread exactly ["deps"]';

const PRE_FIX_EVALUATOR: DisabledChecks = new Set(EVALUATOR_CHECKS);

test("mutation proof: an unregistered route-level persistence write is censused although the declared calls stay correct", async () => {
  const overrides = mutate(ADMIN_REPORT_ACCESS_ROUTE, UNREGISTERED_ROUTE_WRITE);
  assert.equal(legacyAccepts(overrides), true, "the legacy presence oracle must stay green on the mutated source");
  assert.deepEqual(await evaluateWriteAttribution(overrides, PRE_FIX_EVALUATOR), [], "the evaluator without the write census accepts the extra write");
  const violations = await evaluateWriteAttribution(overrides);
  assert.ok(violations.includes(UNREGISTERED_ROUTE_WRITE_VIOLATION), `expected ${UNREGISTERED_ROUTE_WRITE_VIOLATION}, got ${json(violations)}`);
  assert.deepEqual(
    violations.filter((entry) => /reportAccess\.createToken|createAdminReportAccessOperations/.test(entry)),
    [],
    "the declared operation call and composition must keep passing: only the census rejects the write",
  );
});

test("mutation proof: a nested spread that re-wraps the persistence port fails the spread contract", async () => {
  const overrides = mutate(CLINIC_PARTICULAR_ROUTE, MALICIOUS_COMPOSITION_SPREAD);
  assert.equal(legacyAccepts(overrides), true, "the legacy presence oracle must stay green on the mutated source");
  assert.deepEqual(await evaluateWriteAttribution(overrides, PRE_FIX_EVALUATOR), [], "the boolean spread allowance accepts the wrapper");
  const violations = await evaluateWriteAttribution(overrides);
  assert.ok(violations.some((entry) => entry.startsWith(MALICIOUS_COMPOSITION_SPREAD_VIOLATION)), `expected ${MALICIOUS_COMPOSITION_SPREAD_VIOLATION}, got ${json(violations)}`);
  assert.deepEqual(
    violations.filter((entry) => /argument 1\.(studyTracking|now)/.test(entry)),
    [],
    "the explicit studyTracking and now fields stay correct: only the spread carries the wrapper",
  );
});

// Each completeness mechanism is removed on its own; the attack it owns must then pass the
// whole oracle, or the mechanism would be dead weight.
const LOAD_BEARING_ATTACKS: Readonly<Record<EvaluatorCheck, readonly AttackCase[]>> = {
  "write-census": [{ attack: "direct unregistered persistence write", file: ADMIN_REPORT_ACCESS_ROUTE, edits: [UNREGISTERED_ROUTE_WRITE], expected: [UNREGISTERED_ROUTE_WRITE_VIOLATION] }],
  "port-wiring": [
    {
      attack: "dependency wiring wraps the persistence port",
      file: ADMIN_REPORT_ACCESS_ROUTE,
      edits: [[
        "    createReportAccessToken:\n      options.createReportAccessToken ?? defaultDeps!.createReportAccessToken,",
        "    createReportAccessToken: async (input) => {\n      input.createdByAdminUserId = null;\n      return (options.createReportAccessToken ?? defaultDeps!.createReportAccessToken)(input);\n    },",
      ]],
      expected: ["[route-wiring] server/routes/admin-report-access-tokens.fastify.ts createReportAccessToken: port must be wired as a pass-through"],
    },
  ],
  "container-use": [
    {
      attack: "dependency container reached through a dynamic key",
      file: ADMIN_REPORT_ACCESS_ROUTE,
      edits: [[
        "    const result = await reportAccess.getToken(tokenId);",
        "    const ports: Record<string, (input: unknown) => Promise<unknown>> = deps;\n    await ports[\"revokeReport\" + \"AccessToken\"]({ id: tokenId, revokedByClinicUserId: null, revokedByAdminUserId: null });\n    const result = await reportAccess.getToken(tokenId);",
      ]],
      expected: ["[route-container] server/routes/admin-report-access-tokens.fastify.ts deps: aliases a dependency container"],
    },
  ],
  "spread-identity": [
    {
      attack: "composition spreads a nested wrapper of deps",
      file: ADMIN_PARTICULAR_ROUTE,
      edits: [["  const adminOperations = createAdminParticularAccessOperations({\n    ...deps,\n", "  const adminOperations = createAdminParticularAccessOperations({\n    ...{ ...deps },\n"]],
      expected: ['[route-spread] server/routes/admin-particular-tokens.fastify.ts createAdminParticularAccessOperations: argument 1 must spread exactly ["deps"] (got ["{ ...deps }"])'],
    },
    {
      attack: "composition spreads the raw plugin options",
      file: ADMIN_PARTICULAR_ROUTE,
      edits: [["  const adminOperations = createAdminParticularAccessOperations({\n    ...deps,\n", "  const adminOperations = createAdminParticularAccessOperations({\n    ...options,\n"]],
      expected: ['[route-spread] server/routes/admin-particular-tokens.fastify.ts createAdminParticularAccessOperations: argument 1 must spread exactly ["deps"] (got ["options"])'],
    },
  ],
  "import-ledger": [
    {
      attack: "unregistered static import writes directly",
      file: ADMIN_REPORT_ACCESS_ROUTE,
      edits: [
        ["import { ENV } from \"../lib/env.ts\";", "import { ENV } from \"../lib/env.ts\";\nimport { createAuditLog } from \"../db.ts\";"],
        ["    const result = await reportAccess.getToken(tokenId);", "    await createAuditLog({ event: \"forged\" } as never);\n    const result = await reportAccess.getToken(tokenId);"],
      ],
      expected: ['[route-import] server/routes/admin-report-access-tokens.fastify.ts ../db.ts: runtime imports must be [] (got ["createAuditLog"])'],
    },
  ],
  "application-census": [
    {
      attack: "application creates a token and revokes it without attribution",
      file: ADMIN_REPORT_ACCESS_APPLICATION,
      edits: [[
        "      await deps.writeAuditLog(auditRequest, {\n        event: \"report_access_token.created\",",
        "      await deps.revokeReportAccessToken({ id: token.id, revokedByClinicUserId: null, revokedByAdminUserId: null });\n      await deps.writeAuditLog(auditRequest, {\n        event: \"report_access_token.created\",",
      ]],
      expected: ["[write-census] admin report access token create: unregistered application write revokeReportAccessToken: expected 0 call(s), got 1"],
    },
  ],
};

test("meta-mutation: removing any completeness mechanism lets the attack it owns through", async () => {
  for (const check of EVALUATOR_CHECKS) {
    for (const attackCase of LOAD_BEARING_ATTACKS[check]) {
      const overrides = mutate(attackCase.file, ...attackCase.edits);
      await assertMutationEscapesLegacyButFails(overrides, attackCase.expected, `${check}: ${attackCase.attack}`);
      assert.deepEqual(
        await evaluateWriteAttribution(overrides, new Set([check])),
        [],
        `${check}: without the mechanism the attack "${attackCase.attack}" must pass, proving no other check covers it`,
      );
    }
  }
});

test("port classification covers exactly the options contracts of the route surfaces", () => {
  const members = new Set<string>();
  for (const surface of ROUTE_SURFACES) {
    const file = parseSource(realSource(surface.file), surface.file);
    assert.ok(file, `${surface.file} must parse`);
    const contract = portContract(file, surface);
    assert.notEqual(typeof contract, "string", `${surface.file}: ${String(contract)}`);
    for (const name of (contract as PortContract).keys()) {
      members.add(name);
    }
  }
  assert.deepEqual(Object.keys(PORT_CLASSES).sort(), [...members].sort());
});

// Every check family of the oracle is tripped by at least one mutation of the two
// matrices; a family without that evidence would be unproven logic.
test("every write attribution violation kind is proven by a mutation", async () => {
  const produced = new Set<string>();
  for (const attackCase of [...ATTACK_MATRIX, ...FAIL_CLOSED_MATRIX, ...Object.values(LOAD_BEARING_ATTACKS).flat()]) {
    for (const kind of kindsOf(await evaluateWriteAttribution(mutate(attackCase.file, ...attackCase.edits)))) {
      produced.add(kind);
    }
  }
  assert.deepEqual([...produced].sort(), [...VIOLATION_KINDS].sort());
});
