import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import test from "node:test";
import ts from "typescript";

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

  const files: string[] = [];
  const walk = (absoluteDir: string): void => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolute = resolve(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        files.push(relative(REPO_ROOT, absolute).split(sep).join("/"));
      }
    }
  };

  walk(rootDir);
  return files;
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
  return readFileSync(resolve(REPO_ROOT, resolved), "utf8");
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
] as const;
type ViolationKind = (typeof VIOLATION_KINDS)[number];

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
  readonly run: (source: string, recorder: Recorder, violations: string[]) => Promise<void>;
};

const APPLICATION_SCENARIOS: readonly ApplicationScenario[] = [
  {
    label: "admin report access token create",
    file: ADMIN_REPORT_ACCESS_APPLICATION,
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
    async run(source, recorder, violations) {
      const factory = loadModule(source, this.file, particularAccessImports(recorder), "createAdminParticularAccessOperations");
      const operations = operationsFrom(factory, {
        ...particularAccessPorts(recorder, "admin"),
        listParticularTokens: async () => [particularTokenRecord("admin")],
        getParticularTokenById: async (id: unknown) => (id === PARTICULAR_TOKEN_ID ? particularTokenRecord("admin") : null),
        updateParticularTokenReport: async (id: unknown) => (id === PARTICULAR_TOKEN_ID ? particularTokenRecord("admin") : null),
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

// ── Route call sites ───────────────────────────────────────────────────────

type ArgumentShape =
  | string
  | {
      readonly fields: Readonly<Record<string, ArgumentShape>>;
      readonly allowLeadingSpread?: true;
      readonly exact?: true;
    };

type RouteCallSite = {
  readonly callee: string;
  readonly args: readonly (ArgumentShape | null)[];
  readonly count?: number;
};

type RouteSurface = {
  readonly file: string;
  readonly principals: Readonly<Record<string, string>>;
  readonly calls: readonly RouteCallSite[];
  readonly compositions?: readonly RouteCallSite[];
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
  allowLeadingSpread: true,
  exact: true,
};
const AUDIT_PORT_COMPOSITION: ArgumentShape = { fields: { writeAuditLog: "nativeDeps.writeAuditLog" }, exact: true };

function clinicPrincipals(authorization: string, deps: string): Readonly<Record<string, string>> {
  return {
    auth: `${authorization}(clinicAuth)`,
    clinicAuth: `await authenticateFastifyClinicUser(request, reply, ${deps}, now)`,
  };
}

const ROUTE_SURFACES: readonly RouteSurface[] = [
  {
    file: ADMIN_REPORT_ACCESS_ROUTE,
    principals: ADMIN_PRINCIPALS,
    auditRequestLike: "admin",
    calls: [
      { callee: "reportAccess.createToken", args: [null, "admin", "createAuditRequestLike(request, admin)"] },
      { callee: "reportAccess.revokeToken", args: ["tokenId", "admin", "createAuditRequestLike(request, admin)"] },
    ],
    compositions: [{ callee: "createAdminReportAccessOperations", args: ["deps"] }],
  },
  {
    file: CLINIC_REPORT_ACCESS_ROUTE,
    principals: clinicPrincipals("getReportAccessTokenAuthorization", "deps"),
    auditRequestLike: "clinic",
    authorization: "getReportAccessTokenAuthorization",
    calls: [
      { callee: "reportAccess.createToken", args: [null, CLINIC_ACTOR_ARGUMENT, "createAuditRequestLike(request, auth)"] },
      { callee: "reportAccess.revokeToken", args: ["tokenId", CLINIC_ACTOR_ARGUMENT, "createAuditRequestLike(request, auth)"] },
    ],
    compositions: [{ callee: "createClinicReportAccessOperations", args: ["deps"] }],
  },
  {
    file: ADMIN_PARTICULAR_ROUTE,
    principals: ADMIN_PRINCIPALS,
    calls: [{ callee: "adminOperations.createToken", args: [null, "admin.id"] }],
    compositions: [{ callee: "createAdminParticularAccessOperations", args: [PARTICULAR_COMPOSITION] }],
  },
  {
    file: CLINIC_PARTICULAR_ROUTE,
    principals: clinicPrincipals("getParticularTokensAuthorization", "deps"),
    authorization: "getParticularTokensAuthorization",
    calls: [{ callee: "clinicOperations.createToken", args: [null, CLINIC_ACTOR_ARGUMENT] }],
    compositions: [{ callee: "createClinicParticularAccessOperations", args: [PARTICULAR_COMPOSITION] }],
  },
  {
    file: ADMIN_STUDY_TRACKING_ROUTE,
    principals: ADMIN_PRINCIPALS,
    auditRequestLike: "admin",
    calls: [
      {
        callee: "adminOperations.createAdminStudyTrackingCase",
        args: [{ fields: { actor: { fields: { adminId: "admin.id" } }, auditRequest: "createAuditRequestLike(request, admin)" } }],
      },
      {
        callee: "adminOperations.updateAdminStudyTrackingCase",
        args: [{ fields: { auditRequest: "createAuditRequestLike(request, admin)" } }],
      },
    ],
    compositions: [
      {
        callee: "createAdminStudyTrackingOperations",
        args: [
          {
            fields: {
              commandRepository: {
                fields: {
                  createStudyTrackingCase: "nativeDeps.createStudyTrackingCase",
                  updateStudyTrackingCase: "nativeDeps.updateStudyTrackingCase",
                  createStudyTrackingNotification: "nativeDeps.createStudyTrackingNotification",
                },
              },
              audit: AUDIT_PORT_COMPOSITION,
            },
          },
        ],
      },
    ],
  },
  {
    file: CLINIC_STUDY_TRACKING_ROUTE,
    principals: clinicPrincipals("getStudyTrackingAuthorization", "nativeDeps"),
    auditRequestLike: "clinic",
    authorization: "getStudyTrackingAuthorization",
    calls: [
      {
        callee: "clinicOperations.createClinicStudyTrackingCase",
        args: [{ fields: { actor: CLINIC_ACTOR_ARGUMENT, auditRequest: "createAuditRequestLike(request, auth)" } }],
      },
    ],
    compositions: [
      {
        callee: "createClinicStudyTrackingOperations",
        args: [{ fields: { commandRepository: "nativeDeps", audit: AUDIT_PORT_COMPOSITION } }],
      },
    ],
  },
  {
    file: REPORTS_STATUS_ROUTE,
    principals: clinicPrincipals("getReportsStatusAuthorization", "composition.auth"),
    auditRequestLike: "clinic",
    authorization: "getReportsStatusAuthorization",
    calls: [
      {
        callee: "composition.queries.transitionClinicReportStatus",
        args: [{ fields: { clinicId: "auth.clinicId", changedByClinicUserId: "auth.id", changedByAdminUserId: "null" } }],
      },
      { callee: "composition.writeAuditLog", args: ["createAuditRequestLike(request, auth)", { fields: {} }] },
    ],
  },
  {
    file: PARTICULAR_AUDIT_ROUTE,
    principals: PARTICULAR_PRINCIPALS,
    particularAuthenticator: true,
    calls: [{ callee: "deps.listParticularAuditLog", args: [null, "particular.tokenId"], count: 2 }],
  },
  {
    file: PARTICULAR_STUDY_TRACKING_ROUTE,
    principals: PARTICULAR_PRINCIPALS,
    particularAuthenticator: true,
    calls: [
      { callee: "operations.getParticularStudyTrackingForToken", args: ["particular.tokenId"] },
      {
        callee: "operations.listParticularStudyTrackingNotifications",
        args: [{ fields: { particularTokenId: "particular.tokenId" } }],
      },
      {
        callee: "operations.acknowledgeParticularStudyTrackingNotification",
        args: [{ fields: { particularTokenId: "particular.tokenId" } }],
      },
      { callee: "operations.acknowledgeAllParticularStudyTrackingNotifications", args: ["particular.tokenId"] },
    ],
  },
  {
    file: PUBLIC_REPORT_ACCESS_ROUTE,
    principals: {},
    calls: [],
    compositions: [
      {
        callee: "createPublicReportAccessOperations",
        args: [{ fields: { buildPublicActor: "buildPublicReportAccessTokenActor" }, allowLeadingSpread: true, exact: true }],
      },
    ],
    imports: { buildPublicReportAccessTokenActor: "../lib/audit.ts" },
  },
];

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

function checkArgument(
  expression: ts.Expression,
  shape: ArgumentShape,
  where: string,
  file: ts.SourceFile,
  label: string,
  violations: string[],
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
  expression.properties.forEach((property, index) => {
    if (ts.isSpreadAssignment(property)) {
      lastSpread = index;
      if (!shape.allowLeadingSpread) {
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
  for (const [name, fieldShape] of Object.entries(shape.fields)) {
    const value = fields.get(name);
    if (value === undefined) {
      violations.push(violation("route-argument", label, `${where} must pass ${name}`));
      continue;
    }
    if ((positions.get(name) ?? -1) < lastSpread) {
      violations.push(violation("route-argument", label, `${where}.${name} must not be overridden by a later spread`));
    }
    checkArgument(value, fieldShape, `${where}.${name}`, file, label, violations);
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
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current) || ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current)) {
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

function checkCallSites(file: ts.SourceFile, surface: RouteSurface, sites: readonly RouteCallSite[], withPrincipal: boolean, violations: string[]): void {
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
          checkArgument(call.arguments[index], shape, `argument ${index + 1}`, file, label, violations);
        }
      });
      if (withPrincipal) {
        // A write outside any handler is judged against the whole module, where the
        // principal is never bound exactly once, so it fails closed.
        checkPrincipals(enclosingFunction(call) ?? file, surface, file, label, violations);
      }
    }
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

async function evaluateRouteSurface(surface: RouteSurface, source: string): Promise<string[]> {
  const file = parseSource(source, surface.file);
  if (file === undefined) {
    return [violation("parse", surface.file, "source must parse as TypeScript before evaluation")];
  }
  const violations: string[] = [];
  checkCallSites(file, surface, surface.calls, true, violations);
  checkCallSites(file, surface, surface.compositions ?? [], false, violations);
  checkImports(file, surface, violations);
  await checkRouteHelpers(file, surface, violations);
  return violations;
}

// ── Evaluator ──────────────────────────────────────────────────────────────

async function evaluateApplicationScenario(scenario: ApplicationScenario, source: string): Promise<string[]> {
  const violations: string[] = [];
  const recorder = createRecorder();
  try {
    await scenario.run(source, recorder, violations);
  } catch (error) {
    violations.push(asViolation(scenario.label, error));
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

async function evaluateFile(file: string, source: string): Promise<string[]> {
  const violations: string[] = [];
  for (const scenario of APPLICATION_SCENARIOS.filter((candidate) => candidate.file === file)) {
    violations.push(...(await evaluateApplicationScenario(scenario, source)));
  }
  for (const surface of ROUTE_SURFACES.filter((candidate) => candidate.file === file)) {
    violations.push(...(await evaluateRouteSurface(surface, source)));
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
// the real tree, so a mutation proof is always judged by the complete oracle.
async function evaluateWriteAttribution(overrides: Readonly<Record<string, string>> = {}): Promise<string[]> {
  const violations: string[] = [];
  for (const file of EVALUATED_FILES) {
    if (Object.hasOwn(overrides, file)) {
      violations.push(...(await evaluateFile(file, overrides[file])));
    } else {
      let verdict = REAL_VIOLATIONS.get(file);
      if (verdict === undefined) {
        verdict = evaluateFile(file, realSource(file));
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

// Every check family of the oracle is tripped by at least one mutation of the two
// matrices; a family without that evidence would be unproven logic.
test("every write attribution violation kind is proven by a mutation", async () => {
  const produced = new Set<string>();
  for (const attackCase of [...ATTACK_MATRIX, ...FAIL_CLOSED_MATRIX]) {
    for (const kind of kindsOf(await evaluateWriteAttribution(mutate(attackCase.file, ...attackCase.edits)))) {
      produced.add(kind);
    }
  }
  assert.deepEqual([...produced].sort(), [...VIOLATION_KINDS].sort());
});
