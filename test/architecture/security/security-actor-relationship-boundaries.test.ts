import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

const ACTOR_RELATIONSHIP_BOUNDARIES = {
  admin: {
    sessionProperty: "adminAuth",
    canTargetAnyClinicWithExplicitClinicId: true,
    mustNotUseClinicSessionScope: true,
  },
  clinic: {
    sessionProperty: "auth",
    mustForceAuthenticatedClinicId: true,
    canTargetAnyClinicWithExplicitClinicId: false,
  },
  particular: {
    sessionProperty: "particularAuth",
    mustForceAuthenticatedParticularTokenId: true,
    canTargetClinicOrReportFromClientInput: false,
  },
} as const;

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

function assertContains(source: string, marker: string, context: string) {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string) {
  assert.equal(source.includes(marker), false, `${context} must not contain: ${marker}`);
}

function assertMatches(source: string, pattern: RegExp, context: string) {
  assert.match(source, pattern, `${context} must match ${pattern}`);
}

const PARTICULAR_STUDY_TRACKING_ROUTE = "server/routes/particular-study-tracking.fastify.ts";
const PARTICULAR_ACTOR_SCOPE = "particular.tokenId";
const PARTICULAR_AUTHENTICATION_SIGNATURE = "async function authenticateParticularUser(";

type ParticularScopedOperation = {
  label: string;
  handlerSignature: string;
  operation: string;
  scope: "positional" | "particularTokenId";
};

const PARTICULAR_SCOPED_OPERATIONS: readonly ParticularScopedOperation[] = [
  {
    label: "GET /me",
    handlerSignature: '"/me", async (request, reply) =>',
    operation: "getParticularStudyTrackingForToken",
    scope: "positional",
  },
  {
    label: "GET /notifications",
    handlerSignature: '"/notifications", async (request, reply) =>',
    operation: "listParticularStudyTrackingNotifications",
    scope: "particularTokenId",
  },
  {
    label: "PATCH /notifications/:notificationId/read",
    handlerSignature: '"/notifications/:notificationId/read", async (request, reply) =>',
    operation: "acknowledgeParticularStudyTrackingNotification",
    scope: "particularTokenId",
  },
  {
    label: "PATCH /notifications/read-all",
    handlerSignature: '"/notifications/read-all", async (request, reply) =>',
    operation: "acknowledgeAllParticularStudyTrackingNotifications",
    scope: "positional",
  },
];

// Whitespace-free: the actor is bound from the session-backed authenticator and rejected when absent.
const PARTICULAR_AUTHENTICATION_STATEMENT =
  /constparticular=awaitauthenticateParticularUser\(request,reply,deps,now,?\);if\(!particular\)(?:\{returnreply;?\}|returnreply;)/g;

// Session cookie -> session row -> particular token -> actor tokenId, each exactly once and in this order.
const PARTICULAR_ACTOR_DERIVATION = [
  { step: "session cookie read", statement: /consttoken=getParticularSessionToken\(request\);/g },
  { step: "session hash", statement: /consttokenHash=deps\.hashSessionToken\(token\);/g },
  { step: "session lookup", statement: /constsession=awaitdeps\.getParticularSessionByToken\(tokenHash\);/g },
  {
    step: "token lookup",
    statement: /constparticularToken=awaitdeps\.getParticularTokenById\(session\.particularTokenId,?\);/g,
  },
  { step: "actor tokenId", statement: /return\{tokenId:particularToken\.id,/g },
] as const;

const PARTICULAR_SCOPE_PORT_CALL =
  /\.\s*(?:getParticularStudyTrackingCase|listStudyTrackingNotifications|markStudyTrackingNotificationReadScoped|markAllStudyTrackingNotificationsReadScoped)\s*\(/g;
const CLIENT_CONTROLLED_REQUEST_INPUT = /\brequest\s*\.\s*(?:query|params|body|headers)\b/;
const PROTECTED_CALL_PREFIX = /^(?:const[A-Za-z_$][\w$]*=)?await$/;
const EMPTY_PREFIX = /^$/;
const STRING_LITERAL = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g;

function normalizeSource(source: string): string {
  return source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function compactWithOffsets(text: string): { compact: string; offsets: number[] } {
  let compact = "";
  const offsets: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (!/\s/.test(text[index])) {
      compact += text[index];
      offsets.push(index);
    }
  }
  return { compact, offsets };
}

function blankStringLiterals(text: string): string {
  return text.replace(STRING_LITERAL, (literal) =>
    `${literal[0]}${" ".repeat(literal.length - 2)}${literal[literal.length - 1]}`,
  );
}

const TERMINAL_STATEMENT = /^(return|throw)(?![\w$])/;

// Only plain blocks are accepted as ancestors; any other header (if, else, loop, try, function) is not
// provably reachable and fails closed. A return/throw started in the target's block or in an enclosing
// block ends that flow; one inside a child block (if, loop, closure) only ends the child.
function findUnreachableContext(body: string, target: number, allowedPrefix: RegExp): string | undefined {
  if (target < 0) {
    return "unresolved offset";
  }

  const skeleton = blankStringLiterals(body);
  const headers: string[] = [];
  const terminals: Array<string | undefined> = [undefined];
  let statementStart = 0;

  const markTerminal = (statement: string) => {
    const terminal = TERMINAL_STATEMENT.exec(statement.trim())?.[1];
    if (terminal !== undefined) {
      terminals[terminals.length - 1] ??= terminal;
    }
  };

  for (let index = 0; index < target; index += 1) {
    const char = skeleton[index];
    if (char === "{") {
      const header = skeleton.slice(statementStart, index);
      markTerminal(header);
      headers.push(header.replace(/\s+/g, ""));
      terminals.push(undefined);
      statementStart = index + 1;
    } else if (char === "}") {
      if (headers.pop() === undefined) {
        return "unbalanced block";
      }
      terminals.pop();
      statementStart = index + 1;
    } else if (char === ";") {
      markTerminal(skeleton.slice(statementStart, index));
      statementStart = index + 1;
    }
  }

  const prefix = skeleton.slice(statementStart, target).replace(/\s+/g, "");
  if (!allowedPrefix.test(prefix)) {
    return `statement prefix ${prefix}`;
  }

  const deadHeader = headers.find((header) => header !== "");
  if (deadHeader !== undefined) {
    return `enclosing ${deadHeader}`;
  }

  const terminal = terminals.find((statement) => statement !== undefined);
  return terminal === undefined ? undefined : `preceding ${terminal}`;
}

function findBlockRange(source: string, signature: string): { open: number; close: number } | undefined {
  const start = source.indexOf(signature);
  if (start === -1 || source.indexOf(signature, start + signature.length) !== -1) {
    return undefined;
  }

  const open = source.indexOf("{", start + signature.length);
  if (open === -1) {
    return undefined;
  }

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return { open, close: index };
      }
    }
  }

  return undefined;
}

function extractBlockBody(source: string, signature: string): string | undefined {
  const range = findBlockRange(source, signature);
  return range === undefined ? undefined : source.slice(range.open + 1, range.close);
}

function extractCallArguments(body: string, openParen: number): string | undefined {
  let depth = 0;
  for (let index = openParen; index < body.length; index += 1) {
    const char = body[index];
    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) {
        return char === ")" ? body.slice(openParen + 1, index) : undefined;
      }
    }
  }
  return undefined;
}

function splitTopLevel(compact: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of compact) {
    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
    }
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.filter((part, index) => part !== "" || index < parts.length - 1);
}

function stripOuterParens(expression: string): string {
  let current = expression;
  while (current.startsWith("(") && extractCallArguments(current, 0) === current.slice(1, -1)) {
    current = current.slice(1, -1);
  }
  return current;
}

function resolveScopeArgument(
  args: string,
  kind: ParticularScopedOperation["scope"],
): { value: string } | { error: string } {
  const entries = splitTopLevel(args.replace(/\s+/g, ""));

  if (kind === "positional") {
    if (entries.length !== 1) {
      return { error: `protected call must receive exactly one positional scope argument, found ${entries.length}` };
    }
    return { value: stripOuterParens(entries[0] ?? "") };
  }

  const objectLiteral = entries[0] ?? "";
  if (entries.length !== 1 || !objectLiteral.startsWith("{") || !objectLiteral.endsWith("}")) {
    return { error: "protected call must receive a single scope object literal" };
  }

  const properties = splitTopLevel(objectLiteral.slice(1, -1));
  const scopeValues: string[] = [];
  for (const property of properties) {
    if (property.startsWith("...")) {
      return { error: `scope object must not spread properties, found ${property}` };
    }
    const match = /^([A-Za-z_$][\w$]*)(?::([\s\S]+))?$/.exec(property);
    if (!match) {
      return { error: `scope object has a non-evaluable property ${property}` };
    }
    if (match[1] === "particularTokenId") {
      scopeValues.push(stripOuterParens(match[2] ?? match[1]));
    }
  }

  if (scopeValues.length !== 1) {
    return { error: `scope object must set particularTokenId exactly once, found ${scopeValues.length}` };
  }
  return { value: scopeValues[0] ?? "" };
}

function evaluateParticularActorDerivation(code: string): string[] {
  const context = "particular actor derivation";
  const body = extractBlockBody(code, PARTICULAR_AUTHENTICATION_SIGNATURE);
  if (body === undefined) {
    return [`${context} authenticateParticularUser is not evaluable`];
  }

  const violations: string[] = [];
  const { compact, offsets } = compactWithOffsets(body);
  const positions: number[] = [];

  for (const { step, statement } of PARTICULAR_ACTOR_DERIVATION) {
    const matches = [...compact.matchAll(statement)];
    if (matches.length !== 1) {
      violations.push(`${context} ${step} must appear exactly once, found ${matches.length}`);
      continue;
    }
    const offset = offsets[matches[0]?.index ?? -1] ?? -1;
    const unreachable = findUnreachableContext(body, offset, EMPTY_PREFIX);
    if (unreachable !== undefined) {
      violations.push(`${context} ${step} must be reachable, found ${unreachable}`);
    }
    positions.push(offset);
  }

  if (
    positions.length === PARTICULAR_ACTOR_DERIVATION.length &&
    positions.some((position, index) => index > 0 && position <= (positions[index - 1] ?? -1))
  ) {
    violations.push(`${context} steps must run session cookie -> session -> token -> actor`);
  }

  for (const binding of ["session", "particularToken"]) {
    const assignments = countMatches(body, new RegExp(`\\b${binding}\\s*=(?!=)`, "g"));
    if (assignments !== 1) {
      violations.push(`${context} must bind ${binding} once, found ${assignments} assignments`);
    }
  }

  const tokenIdFields = countMatches(compact, /\btokenId:/g);
  if (tokenIdFields !== 1) {
    violations.push(`${context} must assign actor tokenId once, found ${tokenIdFields}`);
  }

  if (CLIENT_CONTROLLED_REQUEST_INPUT.test(body)) {
    violations.push(`${context} must not read client-controlled request input`);
  }

  return violations;
}

function evaluateParticularScopedHandler(code: string, spec: ParticularScopedOperation): string[] {
  const context = `particular study tracking ${spec.label}`;
  const body = extractBlockBody(code, spec.handlerSignature);
  if (body === undefined) {
    return [`${context} handler is not evaluable`];
  }

  const violations: string[] = [];

  const moduleReferences = countMatches(code, new RegExp(`\\b${spec.operation}\\b`, "g"));
  if (moduleReferences !== 1) {
    violations.push(`${context} ${spec.operation} must be referenced exactly once in the route module, found ${moduleReferences}`);
  }

  const operationsReferences = countMatches(body, /\boperations\b/g);
  if (operationsReferences !== 2) {
    violations.push(`${context} must use operations only through its runtime and protected call, found ${operationsReferences} references`);
  }

  const { compact, offsets } = compactWithOffsets(body);
  const authentications = [...compact.matchAll(PARTICULAR_AUTHENTICATION_STATEMENT)];
  let authenticationEnd = -1;
  if (authentications.length !== 1) {
    violations.push(`${context} must authenticate the particular actor exactly once before scoping, found ${authentications.length}`);
  } else {
    const match = authentications[0];
    const start = match?.index ?? -1;
    const unreachable = findUnreachableContext(body, offsets[start] ?? -1, EMPTY_PREFIX);
    if (unreachable !== undefined) {
      violations.push(`${context} particular actor authentication must be reachable, found ${unreachable}`);
    }
    authenticationEnd = offsets[start + (match?.[0].length ?? 0) - 1] ?? -1;
  }

  const actorAssignments = countMatches(body, /\bparticular\s*(?:\.\s*tokenId\s*)?=(?!=)/g);
  if (actorAssignments !== 1) {
    violations.push(`${context} particular actor must be bound once from authenticateParticularUser, found ${actorAssignments} assignments`);
  }

  // Allowlist, not a write blacklist: binding, null guard and the protected scope read. Any other
  // reference (Object.assign, Reflect.set, aliasing, compound writes) can taint particular.tokenId.
  if (authentications.length === 1) {
    const actorReferences = countMatches(blankStringLiterals(body), /\bparticular\b/g);
    if (actorReferences !== 3) {
      violations.push(`${context} authenticated particular actor must be referenced only by its guard and protected scope, found ${actorReferences} references`);
    }
  }

  const calls = [...body.matchAll(new RegExp(`\\boperations\\s*\\.\\s*${spec.operation}\\s*\\(`, "g"))];
  if (calls.length !== 1) {
    violations.push(`${context} protected ${spec.operation} call must appear exactly once, found ${calls.length}`);
    return violations;
  }

  const call = calls[0];
  const callStart = call?.index ?? -1;
  const unreachable = findUnreachableContext(body, callStart, PROTECTED_CALL_PREFIX);
  if (unreachable !== undefined) {
    violations.push(`${context} protected ${spec.operation} call must be reachable, found ${unreachable}`);
  }
  if (authenticationEnd !== -1 && callStart < authenticationEnd) {
    violations.push(`${context} must authenticate the particular actor before the protected call`);
  }

  const args = extractCallArguments(body, callStart + (call?.[0].length ?? 0) - 1);
  if (args === undefined) {
    violations.push(`${context} protected ${spec.operation} arguments are not evaluable`);
    return violations;
  }

  const scope = resolveScopeArgument(args, spec.scope);
  if ("error" in scope) {
    violations.push(`${context} ${scope.error}`);
  } else if (scope.value !== PARTICULAR_ACTOR_SCOPE) {
    violations.push(`${context} scope must derive from ${PARTICULAR_ACTOR_SCOPE}, found ${scope.value}`);
    if (/\brequest\b/.test(scope.value)) {
      violations.push(`${context} scope must not read client-controlled request input`);
    }
  }

  return violations;
}

function evaluateParticularStudyTrackingActorScope(rawSource: string): string[] {
  const code = stripComments(normalizeSource(rawSource));
  const violations = evaluateParticularActorDerivation(code);

  const runtimeResolutions = countMatches(code, /\bresolveRuntime\s*\(/g);
  if (runtimeResolutions !== PARTICULAR_SCOPED_OPERATIONS.length) {
    violations.push(
      `particular study tracking runtime must be resolved only by the ${PARTICULAR_SCOPED_OPERATIONS.length} scoped handlers, found ${runtimeResolutions}`,
    );
  }

  const portBypasses = countMatches(code, PARTICULAR_SCOPE_PORT_CALL);
  if (portBypasses !== 0) {
    violations.push(`particular study tracking must reach scoped persistence only through operations, found ${portBypasses} direct port calls`);
  }

  for (const spec of PARTICULAR_SCOPED_OPERATIONS) {
    violations.push(...evaluateParticularScopedHandler(code, spec));
  }

  return violations;
}

function replaceOnce(source: string, target: string, replacement: string): string {
  const first = source.indexOf(target);

  assert.notEqual(first, -1, `mutation target must exist in source: ${target}`);
  assert.equal(
    source.indexOf(target, first + target.length),
    -1,
    `mutation target must be unique in source: ${target}`,
  );

  return source.slice(0, first) + replacement + source.slice(first + target.length);
}

function replaceOnceInHandler(source: string, handlerSignature: string, target: string, replacement: string): string {
  const range = findBlockRange(source, handlerSignature);
  assert.ok(range, `mutation handler must exist exactly once: ${handlerSignature}`);

  const body = source.slice(range.open + 1, range.close);
  return source.slice(0, range.open + 1) + replaceOnce(body, target, replacement) + source.slice(range.close);
}

function readParticularStudyTrackingSource(): string {
  return normalizeSource(readSource(PARTICULAR_STUDY_TRACKING_ROUTE));
}

test("actor relationship matrix documents admin clinic and particular boundaries", () => {
  assert.deepEqual(ACTOR_RELATIONSHIP_BOUNDARIES, {
    admin: {
      sessionProperty: "adminAuth",
      canTargetAnyClinicWithExplicitClinicId: true,
      mustNotUseClinicSessionScope: true,
    },
    clinic: {
      sessionProperty: "auth",
      mustForceAuthenticatedClinicId: true,
      canTargetAnyClinicWithExplicitClinicId: false,
    },
    particular: {
      sessionProperty: "particularAuth",
      mustForceAuthenticatedParticularTokenId: true,
      canTargetClinicOrReportFromClientInput: false,
    },
  });
});

test("admin routes keep explicit clinic relationships before linking reports tokens or tracking", () => {
  const adminParticularTokens = readSource("server/routes/admin-particular-tokens.fastify.ts");
  const adminParticularTokensApplication = readSource(
    "server/features/particular-access/application/admin-particular-access-operations.ts",
  );
  const adminReportAccessTokens = readSource("server/routes/admin-report-access-tokens.fastify.ts");
  const adminReportAccessApplication = readSource(
    "server/features/report-access/application/admin-report-access-operations.ts",
  );
  const adminStudyTracking = readSource("server/routes/admin-study-tracking.fastify.ts");
  const adminStudyTrackingApplication = readSource(
    "server/features/study-tracking/application/admin-study-tracking-operations.ts",
  );

  assertContains(adminParticularTokens, "clinicId?: unknown", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "getClinicById(data.clinicId)", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "belongsToClinic(report.clinicId, data.clinicId)", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "belongsToClinic(report.clinicId, token.clinicId)", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "clinicId: data.clinicId", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "createdByAdminId: adminId", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "createdByClinicUserId: null", "admin particular tokens");

  assertContains(adminReportAccessTokens, "clinicId?: unknown", "admin report access tokens");
  assertContains(adminReportAccessApplication, "getClinicById(data.clinicId)", "admin report access tokens");
  assertContains(adminReportAccessApplication, "getReportById(data.reportId)", "admin report access tokens");
  assertContains(adminReportAccessApplication, "belongsToClinic(report.clinicId, data.clinicId)", "admin report access tokens");

  assertContains(adminStudyTracking, "clinicId?: unknown", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "getClinicById(", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "report.clinicId !== input.data.clinicId", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "particularToken.clinicId !== input.data.clinicId", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "clinicId: input.data.clinicId", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "createdByAdminId: input.actor.adminId", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "createdByClinicUserId: null", "admin study tracking");

  assertNotContains(adminParticularTokens, "clinicId: auth.clinicId", "admin particular tokens");
  assertNotContains(adminReportAccessTokens, "clinicId: auth.clinicId", "admin report access tokens");
  assertNotContains(adminStudyTracking, "clinicId: auth.clinicId", "admin study tracking");
});

test("clinic routes force authenticated clinic relationships and reject cross clinic links", () => {
  const studyTracking = readSource("server/routes/study-tracking.fastify.ts");
  const studyTrackingApplication = readSource(
    "server/features/study-tracking/application/clinic-study-tracking-operations.ts",
  );
  const particularTokens = readSource("server/routes/particular-tokens.fastify.ts");
  const particularTokensApplication = readSource(
    "server/features/particular-access/application/clinic-particular-access-operations.ts",
  );
  const reportAccessTokens = readSource("server/routes/report-access-tokens.fastify.ts");
  const reportAccessApplication = readSource(
    "server/features/report-access/application/clinic-report-access-operations.ts",
  );
  const clinicAudit = readSource("server/routes/clinic-audit.fastify.ts");

  assertContains(studyTracking, "clinicId: auth.clinicId", "clinic study tracking");
  assertContains(studyTrackingApplication, "getClinicScopedReportById", "clinic study tracking");
  assertContains(studyTrackingApplication, "particularToken.clinicId !== input.actor.clinicId", "clinic study tracking");
  assertMatches(
    studyTrackingApplication,
    /getClinicScopedStudyTrackingCase\(\s*input\.trackingCaseId,\s*input\.clinicId/s,
    "clinic study tracking detail",
  );

  assertMatches(
    particularTokens,
    /clinicOperations\.(?:createToken|getToken|listTokens|updateTokenReport)\([\s\S]*auth\.clinicId/s,
    "clinic particular tokens",
  );
  assertContains(particularTokens, "getClinicScopedReportById", "clinic particular tokens");
  assertMatches(
    particularTokensApplication,
    /getClinicScopedParticularToken\(\s*tokenId,\s*clinicId/s,
    "clinic particular token detail",
  );

  assertContains(reportAccessTokens, "clinicId: auth.clinicId", "clinic report access tokens");
  assertContains(reportAccessApplication, "getClinicScopedReportById", "clinic report access tokens");
  assertMatches(
    reportAccessApplication,
    /getClinicScopedReportAccessToken\(tokenId, clinicId\)/s,
    "clinic report access token detail",
  );

  assertMatches(
    clinicAudit,
    /request\.query \?\? \{\},\s*auth\.clinicId/s,
    "clinic audit filters",
  );
});

test("particular routes force authenticated particular token relationships", () => {
  const particularAudit = readSource("server/routes/particular-audit.fastify.ts");
  const particularStudyTracking = readSource("server/routes/particular-study-tracking.fastify.ts");
  const particularAuth = readSource("server/routes/particular-auth.fastify.ts");

  assertMatches(
    particularAudit,
    /listParticularAuditLog\([\s\S]*particular\.tokenId/s,
    "particular audit list",
  );
  assertMatches(
    particularAudit,
    /buildParticularAuditListFilters\([\s\S]*request\.query/s,
    "particular audit filter builder",
  );
  assertContains(particularAudit, "particularTokenId: particular.tokenId", "particular audit response scope");

  assertMatches(
    particularStudyTracking,
    /getParticularStudyTrackingForToken\(\s*particular\.tokenId/s,
    "particular study tracking detail",
  );
  assertContains(
    particularStudyTracking,
    "particularTokenId: particular.tokenId",
    "particular study tracking notifications",
  );
  assert.deepEqual(evaluateParticularStudyTrackingActorScope(particularStudyTracking), []);

  assertContains(particularAuth, "getClinicScopedReportById", "particular auth report access");
  assertContains(particularAuth, "/report/preview-url", "particular auth preview route");
  assertContains(particularAuth, "/report/download-url", "particular auth download route");
  assertNotContains(particularAuth, "reportId?: unknown", "particular auth must not accept reportId input");
  assertNotContains(particularStudyTracking, "reportId?: unknown", "particular study tracking must not accept reportId input");
});

const ME = "particular study tracking GET /me";
const LIST = "particular study tracking GET /notifications";
const ACK = "particular study tracking PATCH /notifications/:notificationId/read";
const READ_ALL = "particular study tracking PATCH /notifications/read-all";
const ACTOR_REFERENCES = "authenticated particular actor must be referenced only by its guard and protected scope, found";
const [ME_HANDLER, LIST_HANDLER, , READ_ALL_HANDLER] = PARTICULAR_SCOPED_OPERATIONS.map(
  (spec) => spec.handlerSignature,
);

const ME_SCOPE = "getParticularStudyTrackingForToken(\n      particular.tokenId,\n    );";
const LIST_SCOPE = "listParticularStudyTrackingNotifications({\n        particularTokenId: particular.tokenId,";
const ACK_SCOPE = "        notificationId,\n        particularTokenId: particular.tokenId,";
const READ_ALL_SCOPE = "acknowledgeAllParticularStudyTrackingNotifications(\n        particular.tokenId,\n      );";
const READ_ALL_STATEMENT = [
  "    const result =",
  "      await operations.acknowledgeAllParticularStudyTrackingNotifications(",
  "        particular.tokenId,",
  "      );",
  "",
].join("\n");
const LIST_QUERY_PARSING = "    const unreadOnly = parseBooleanQuery(";
const HANDLER_AUTHENTICATION = [
  "    const particular = await authenticateParticularUser(",
  "      request,",
  "      reply,",
  "      deps,",
  "      now,",
  "    );",
  "",
  "    if (!particular) {",
  "      return reply;",
  "    }",
  "",
].join("\n");
const REQUEST_ACTOR = "    const particular = { tokenId: Number(request.query.particularTokenId) };\n";

// The pre-existing particular assertions of this file, evaluated on a mutated source.
function legacyParticularStudyTrackingAssertionsPass(source: string): boolean {
  return (
    /getParticularStudyTrackingForToken\(\s*particular\.tokenId/s.test(source) &&
    source.includes("particularTokenId: particular.tokenId") &&
    !source.includes("reportId?: unknown")
  );
}

type ActorScopeMutation = {
  name: string;
  apply: (source: string) => string;
  expected: readonly string[];
  legacyGreen: boolean;
};

function assertActorScopeMutations(mutations: readonly ActorScopeMutation[]) {
  const source = readParticularStudyTrackingSource();

  for (const mutation of mutations) {
    const mutated = mutation.apply(source);

    assert.notEqual(mutated, source, `${mutation.name} must change the source`);
    assert.deepEqual(
      evaluateParticularStudyTrackingActorScope(mutated),
      [...mutation.expected],
      `mutation must be detected: ${mutation.name}`,
    );
    assert.equal(legacyParticularStudyTrackingAssertionsPass(mutated), mutation.legacyGreen, mutation.name);
  }
}

test("particular actor scope evaluator accepts the real source and equivalent refactors", () => {
  const source = readParticularStudyTrackingSource();
  const equivalents: ReadonlyArray<[string, string]> = [
    ["single-line positional scope", replaceOnce(source, ME_SCOPE, "getParticularStudyTrackingForToken(particular.tokenId);")],
    [
      "redundant parentheses around the actor scope",
      replaceOnce(
        source,
        READ_ALL_SCOPE,
        "acknowledgeAllParticularStudyTrackingNotifications(\n        (particular.tokenId),\n      );",
      ),
    ],
    [
      "reordered single-line scope object",
      replaceOnce(
        source,
        "listParticularStudyTrackingNotifications({\n        particularTokenId: particular.tokenId,\n        unreadOnly,\n        limit,\n        offset,\n      });",
        "listParticularStudyTrackingNotifications({ unreadOnly, limit, offset, particularTokenId: particular.tokenId });",
      ),
    ],
    [
      "explanatory comment inside the scope object",
      replaceOnce(
        source,
        ACK_SCOPE,
        "        notificationId,\n        // Scope always comes from the authenticated particular.\n        particularTokenId: particular.tokenId,",
      ),
    ],
    [
      "compact authentication and early return",
      replaceOnceInHandler(
        source,
        LIST_HANDLER,
        HANDLER_AUTHENTICATION,
        "    const particular = await authenticateParticularUser(request, reply, deps, now);\n    if (!particular) return reply;\n",
      ),
    ],
    ["protected call inside a plain block", replaceOnce(source, READ_ALL_STATEMENT, `    {\n${READ_ALL_STATEMENT}    }\n`)],
    [
      "additional conditional early return before the protected call",
      replaceOnce(
        source,
        READ_ALL_STATEMENT,
        `    if (!allowedOrigins.size) {\n      return reply.code(503).send({ success: false });\n    }\n\n${READ_ALL_STATEMENT}`,
      ),
    ],
    [
      "single-line conditional throw before the protected call",
      replaceOnce(source, READ_ALL_STATEMENT, `    if (!allowedOrigins.size) throw new Error("synthetic origin gap");\n${READ_ALL_STATEMENT}`),
    ],
    ["CRLF line endings", source.replace(/\n/g, "\r\n")],
  ];

  assert.deepEqual(evaluateParticularStudyTrackingActorScope(source), []);
  assert.equal(legacyParticularStudyTrackingAssertionsPass(source), true);
  for (const [name, equivalent] of equivalents) {
    assert.notEqual(equivalent, source, name);
    assert.deepEqual(evaluateParticularStudyTrackingActorScope(equivalent), [], name);
  }
});

test("client-controlled particular scope turns the evaluator red while legacy markers stay green", () => {
  assertActorScopeMutations([
    {
      name: "notifications list scoped by query string",
      apply: (source) =>
        replaceOnce(
          source,
          LIST_SCOPE,
          "listParticularStudyTrackingNotifications({\n        particularTokenId: Number(request.query.particularTokenId),",
        ),
      expected: [
        `${LIST} ${ACTOR_REFERENCES} 2 references`,
        `${LIST} scope must derive from particular.tokenId, found Number(request.query.particularTokenId)`,
        `${LIST} scope must not read client-controlled request input`,
      ],
      legacyGreen: true,
    },
    {
      name: "notification acknowledgement scoped by request body",
      apply: (source) =>
        replaceOnce(source, ACK_SCOPE, "        notificationId,\n        particularTokenId: request.body.particularTokenId,"),
      expected: [
        `${ACK} ${ACTOR_REFERENCES} 2 references`,
        `${ACK} scope must derive from particular.tokenId, found request.body.particularTokenId`,
        `${ACK} scope must not read client-controlled request input`,
      ],
      legacyGreen: true,
    },
    {
      name: "read-all acknowledgement scoped by request header",
      apply: (source) =>
        replaceOnce(
          source,
          READ_ALL_SCOPE,
          'acknowledgeAllParticularStudyTrackingNotifications(\n        Number(request.headers["x-particular-token-id"]),\n      );',
        ),
      expected: [
        `${READ_ALL} ${ACTOR_REFERENCES} 2 references`,
        `${READ_ALL} scope must derive from particular.tokenId, found Number(request.headers["x-particular-token-id"])`,
        `${READ_ALL} scope must not read client-controlled request input`,
      ],
      legacyGreen: true,
    },
    {
      name: "tracking detail scoped by query string",
      apply: (source) =>
        replaceOnce(
          source,
          ME_SCOPE,
          "getParticularStudyTrackingForToken(\n      Number(request.query.particularTokenId),\n    );",
        ),
      expected: [
        `${ME} ${ACTOR_REFERENCES} 2 references`,
        `${ME} scope must derive from particular.tokenId, found Number(request.query.particularTokenId)`,
        `${ME} scope must not read client-controlled request input`,
      ],
      legacyGreen: false,
    },
    {
      name: "authenticated actor overwritten from query string",
      apply: (source) =>
        replaceOnce(
          source,
          LIST_QUERY_PARSING,
          `    particular.tokenId = Number(request.query.particularTokenId);\n${LIST_QUERY_PARSING}`,
        ),
      expected: [
        `${LIST} particular actor must be bound once from authenticateParticularUser, found 2 assignments`,
        `${LIST} ${ACTOR_REFERENCES} 4 references`,
      ],
      legacyGreen: true,
    },
    ...[
      [
        "authenticated actor mutated via Object.assign",
        '    Object.assign(particular, {\n      tokenId: Number(request.headers["x-particular-token-id"] ?? particular.tokenId),\n    });\n',
        5,
      ],
      ["authenticated actor mutated via Reflect.set", '    Reflect.set(particular, "tokenId", Number(request.query.particularTokenId));\n', 4],
      [
        "authenticated actor mutated via Object.defineProperty",
        '    Object.defineProperty(particular, "tokenId", { value: Number(request.query.particularTokenId) });\n',
        4,
      ],
      ["authenticated actor mutated through an alias", "    const actor = particular;\n    actor.tokenId = Number(request.query.particularTokenId);\n", 4],
      ["authenticated actor mutated by compound assignment", "    particular.tokenId += Number(request.query.offset ?? 0);\n", 4],
    ].map(([name, injected, references]): ActorScopeMutation => ({
      name: String(name),
      apply: (source) => replaceOnce(source, LIST_QUERY_PARSING, `${injected}${LIST_QUERY_PARSING}`),
      expected: [`${LIST} ${ACTOR_REFERENCES} ${references} references`],
      legacyGreen: true,
    })),
    {
      name: "actor built from query string instead of the session",
      apply: (source) => replaceOnceInHandler(source, READ_ALL_HANDLER, HANDLER_AUTHENTICATION, REQUEST_ACTOR),
      expected: [`${READ_ALL} must authenticate the particular actor exactly once before scoping, found 0`],
      legacyGreen: true,
    },
    {
      name: "actor tokenId taken from request header",
      apply: (source) =>
        replaceOnce(
          source,
          "    tokenId: particularToken.id,",
          '    tokenId: Number(request.headers["x-particular-token-id"]) || particularToken.id,',
        ),
      expected: [
        "particular actor derivation actor tokenId must appear exactly once, found 0",
        "particular actor derivation must not read client-controlled request input",
      ],
      legacyGreen: true,
    },
    {
      name: "particular token looked up from query string",
      apply: (source) =>
        replaceOnce(
          source,
          "    session.particularTokenId,\n  );",
          "    Number(request.query.particularTokenId) || session.particularTokenId,\n  );",
        ),
      expected: [
        "particular actor derivation token lookup must appear exactly once, found 0",
        "particular actor derivation must not read client-controlled request input",
      ],
      legacyGreen: true,
    },
  ]);
});

test("decorative actor scope, ambiguous calls and comment-only boundaries turn the evaluator red", () => {
  assertActorScopeMutations([
    {
      name: "actor scope kept as decorative operand",
      apply: (source) =>
        replaceOnce(
          source,
          ME_SCOPE,
          "getParticularStudyTrackingForToken(\n      particular.tokenId && Number(request.query.particularTokenId),\n    );",
        ),
      expected: [
        `${ME} scope must derive from particular.tokenId, found particular.tokenId&&Number(request.query.particularTokenId)`,
        `${ME} scope must not read client-controlled request input`,
      ],
      legacyGreen: true,
    },
    {
      name: "actor scope overridden by a request spread",
      apply: (source) => replaceOnce(source, LIST_SCOPE, `${LIST_SCOPE}\n        ...request.query,`),
      expected: [`${LIST} scope object must not spread properties, found ...request.query`],
      legacyGreen: true,
    },
    {
      name: "actor scope overridden by a duplicate key",
      apply: (source) =>
        replaceOnce(source, ACK_SCOPE, `${ACK_SCOPE}\n        particularTokenId: Number(request.body.particularTokenId),`),
      expected: [`${ACK} scope object must set particularTokenId exactly once, found 2`],
      legacyGreen: true,
    },
    {
      name: "request value prepended as extra positional scope",
      apply: (source) =>
        replaceOnce(
          source,
          READ_ALL_SCOPE,
          "acknowledgeAllParticularStudyTrackingNotifications(\n        Number(request.query.particularTokenId),\n        particular.tokenId,\n      );",
        ),
      expected: [`${READ_ALL} protected call must receive exactly one positional scope argument, found 2`],
      legacyGreen: true,
    },
    {
      name: "actor scope kept only as a comment",
      apply: (source) =>
        replaceOnce(
          source,
          LIST_SCOPE,
          "listParticularStudyTrackingNotifications({\n        // particularTokenId: particular.tokenId,\n        particularTokenId: Number(request.query.particularTokenId),",
        ),
      expected: [
        `${LIST} ${ACTOR_REFERENCES} 2 references`,
        `${LIST} scope must derive from particular.tokenId, found Number(request.query.particularTokenId)`,
        `${LIST} scope must not read client-controlled request input`,
      ],
      legacyGreen: true,
    },
    {
      name: "authentication kept only as a comment",
      apply: (source) =>
        replaceOnceInHandler(
          source,
          READ_ALL_HANDLER,
          HANDLER_AUTHENTICATION,
          HANDLER_AUTHENTICATION.split("\n").map((line) => (line ? `    // ${line.trim()}` : line)).join("\n") + REQUEST_ACTOR,
        ),
      expected: [`${READ_ALL} must authenticate the particular actor exactly once before scoping, found 0`],
      legacyGreen: true,
    },
    {
      name: "authentication guard inverted",
      apply: (source) => replaceOnceInHandler(source, ME_HANDLER, "    if (!particular) {", "    if (particular) {"),
      expected: [`${ME} must authenticate the particular actor exactly once before scoping, found 0`],
      legacyGreen: true,
    },
    {
      name: "protected call duplicated inside its handler",
      apply: (source) => replaceOnce(source, READ_ALL_STATEMENT, `${READ_ALL_STATEMENT}${READ_ALL_STATEMENT}`),
      expected: [
        `${READ_ALL} acknowledgeAllParticularStudyTrackingNotifications must be referenced exactly once in the route module, found 2`,
        `${READ_ALL} must use operations only through its runtime and protected call, found 3 references`,
        `${READ_ALL} ${ACTOR_REFERENCES} 4 references`,
        `${READ_ALL} protected acknowledgeAllParticularStudyTrackingNotifications call must appear exactly once, found 2`,
      ],
      legacyGreen: true,
    },
    {
      name: "protected call duplicated into another handler",
      apply: (source) =>
        replaceOnce(
          source,
          LIST_QUERY_PARSING,
          `    await operations.getParticularStudyTrackingForToken(particular.tokenId);\n${LIST_QUERY_PARSING}`,
        ),
      expected: [
        `${ME} getParticularStudyTrackingForToken must be referenced exactly once in the route module, found 2`,
        `${LIST} must use operations only through its runtime and protected call, found 3 references`,
        `${LIST} ${ACTOR_REFERENCES} 4 references`,
      ],
      legacyGreen: true,
    },
    {
      name: "unauthenticated shadow route reusing the protected operation",
      apply: (source) =>
        replaceOnce(
          source,
          '  app.patch("/notifications/read-all",',
          [
            '  app.get("/tracking-by-token", async (request) => {',
            "    const { operations } = await resolveRuntime();",
            "    return operations.getParticularStudyTrackingForToken(Number(request.query.particularTokenId));",
            "  });",
            "",
            '  app.patch("/notifications/read-all",',
          ].join("\n"),
        ),
      expected: [
        "particular study tracking runtime must be resolved only by the 4 scoped handlers, found 5",
        `${ME} getParticularStudyTrackingForToken must be referenced exactly once in the route module, found 2`,
      ],
      legacyGreen: true,
    },
    {
      name: "protected operation replaced by a direct persistence port call",
      apply: (source) =>
        replaceOnce(
          source,
          READ_ALL_STATEMENT,
          [
            "    const result = await deps.markAllStudyTrackingNotificationsReadScoped({",
            "      particularTokenId: Number(request.query.particularTokenId),",
            "    });",
            "",
          ].join("\n"),
        ),
      expected: [
        "particular study tracking must reach scoped persistence only through operations, found 1 direct port calls",
        `${READ_ALL} acknowledgeAllParticularStudyTrackingNotifications must be referenced exactly once in the route module, found 0`,
        `${READ_ALL} must use operations only through its runtime and protected call, found 1 references`,
        `${READ_ALL} ${ACTOR_REFERENCES} 2 references`,
        `${READ_ALL} protected acknowledgeAllParticularStudyTrackingNotifications call must appear exactly once, found 0`,
      ],
      legacyGreen: true,
    },
  ]);
});

test("particular actor scope in unreachable control flow turns the evaluator red", () => {
  const unreachableCall = `${READ_ALL} protected acknowledgeAllParticularStudyTrackingNotifications call must be reachable, found`;
  const wrap = (open: string, close: string) => (source: string) =>
    replaceOnce(source, READ_ALL_STATEMENT, `${open}\n${READ_ALL_STATEMENT}${close}\n`);

  assertActorScopeMutations([
    { name: "if (false) block", apply: wrap("    if (false) {", "    }"), expected: [`${unreachableCall} enclosing if(false)`], legacyGreen: true },
    {
      name: "while (false) block",
      apply: wrap("    while (false) {", "    }"),
      expected: [`${unreachableCall} enclosing while(false)`],
      legacyGreen: true,
    },
    {
      name: "else branch of an always-true condition",
      apply: wrap("    if (true) {\n    } else {", "    }"),
      expected: [`${unreachableCall} enclosing else`],
      legacyGreen: true,
    },
    {
      name: "never-invoked closure",
      apply: wrap("    const skipped = async () => {", "    };"),
      expected: [`${unreachableCall} enclosing constskipped=async()=>`],
      legacyGreen: true,
    },
    {
      name: "try block is not provably reachable",
      apply: wrap("    try {", "    } finally {\n    }"),
      expected: [`${unreachableCall} enclosing try`],
      legacyGreen: true,
    },
    {
      name: "short-circuited protected call",
      apply: (source) =>
        replaceOnce(source, READ_ALL_STATEMENT, READ_ALL_STATEMENT.replace("const result =", "const result = false &&")),
      expected: [`${unreachableCall} statement prefix constresult=false&&await`],
      legacyGreen: true,
    },
    {
      name: "unconditional return before the protected call",
      apply: (source) => replaceOnce(source, READ_ALL_STATEMENT, `    return reply;\n\n${READ_ALL_STATEMENT}`),
      expected: [`${unreachableCall} preceding return`],
      legacyGreen: true,
    },
    {
      name: "unconditional throw before the protected call",
      apply: (source) =>
        replaceOnce(source, READ_ALL_STATEMENT, `    throw new Error("synthetic unreachable");\n\n${READ_ALL_STATEMENT}`),
      expected: [`${unreachableCall} preceding throw`],
      legacyGreen: true,
    },
    {
      name: "unconditional return with a response body before the protected call",
      apply: (source) =>
        replaceOnce(
          source,
          READ_ALL_STATEMENT,
          `    return reply.code(200).send({ success: true, updatedCount: 0 });\n\n${READ_ALL_STATEMENT}`,
        ),
      expected: [`${unreachableCall} preceding return`],
      legacyGreen: true,
    },
    {
      name: "unconditional return in an enclosing plain block",
      apply: (source) => replaceOnce(source, READ_ALL_STATEMENT, `    return reply;\n    {\n${READ_ALL_STATEMENT}    }\n`),
      expected: [`${unreachableCall} preceding return`],
      legacyGreen: true,
    },
    {
      name: "unconditional return right after the real conditional guard",
      apply: (source) =>
        replaceOnceInHandler(source, ME_HANDLER, HANDLER_AUTHENTICATION, `${HANDLER_AUTHENTICATION}    return reply;\n`),
      expected: [`${ME} protected getParticularStudyTrackingForToken call must be reachable, found preceding return`],
      legacyGreen: true,
    },
    {
      name: "unconditional throw before authentication",
      apply: (source) =>
        replaceOnceInHandler(
          source,
          LIST_HANDLER,
          HANDLER_AUTHENTICATION,
          `    throw new Error("synthetic unreachable");\n${HANDLER_AUTHENTICATION}`,
        ),
      expected: [
        `${LIST} particular actor authentication must be reachable, found preceding throw`,
        `${LIST} protected listParticularStudyTrackingNotifications call must be reachable, found preceding throw`,
      ],
      legacyGreen: true,
    },
    {
      name: "authentication inside if (false)",
      apply: (source) =>
        replaceOnceInHandler(source, ME_HANDLER, HANDLER_AUTHENTICATION, `    if (false) {\n${HANDLER_AUTHENTICATION}    }\n`),
      expected: [`${ME} particular actor authentication must be reachable, found enclosing if(false)`],
      legacyGreen: true,
    },
  ]);
});

test("particular actor scope evaluator fails closed on unevaluable structure", () => {
  const source = readParticularStudyTrackingSource();

  assert.deepEqual(evaluateParticularStudyTrackingActorScope(""), [
    "particular actor derivation authenticateParticularUser is not evaluable",
    "particular study tracking runtime must be resolved only by the 4 scoped handlers, found 0",
    `${ME} handler is not evaluable`,
    `${LIST} handler is not evaluable`,
    `${ACK} handler is not evaluable`,
    `${READ_ALL} handler is not evaluable`,
  ]);
  assert.deepEqual(
    evaluateParticularStudyTrackingActorScope(
      `${source}\nexport const shadowMe = (app) => app.get("/me", async (request, reply) => { return reply; });\n`,
    ),
    [`${ME} handler is not evaluable`],
  );
  assert.deepEqual(
    evaluateParticularStudyTrackingActorScope(
      `${source}\nasync function authenticateParticularUser(request) { return { tokenId: 1 }; }\n`,
    ),
    ["particular actor derivation authenticateParticularUser is not evaluable"],
  );
  assert.deepEqual(
    evaluateParticularStudyTrackingActorScope(source.slice(0, source.indexOf('  app.patch("/notifications/read-all",'))),
    [
      "particular study tracking runtime must be resolved only by the 4 scoped handlers, found 3",
      `${READ_ALL} handler is not evaluable`,
    ],
  );

  assert.throws(() => replaceOnce(source, "particular.tenantId", ""), /mutation target must exist in source/);
  assert.throws(() => replaceOnce(source, "particular.tokenId", "request.query.particularTokenId"), /mutation target must be unique in source/);
  assert.throws(
    () => replaceOnceInHandler(source, '"/unknown", async (request, reply) =>', "particular.tokenId", ""),
    /mutation handler must exist exactly once/,
  );
});
