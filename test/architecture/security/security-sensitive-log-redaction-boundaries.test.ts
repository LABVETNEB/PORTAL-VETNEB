import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

const SENSITIVE_LOG_REDACTION_BOUNDARIES = {
  requestLogs: {
    middleware: "server/middlewares/request-logger.ts",
    redactionMarker: "[REDACTED]",
  },
  structuredLogger: {
    module: "server/lib/logger.ts",
    redactionEntrypoint: "redactLogValue",
    textRedactionEntrypoint: "redactSensitiveText",
    errorSerializer: "serializeError",
  },
  observabilityMetrics: {
    module: "server/lib/observability-metrics.ts",
    routeDimension: "buildRouteMetricsKey",
  },
  globalErrorHandlers: {
    fastifyApp: "server/fastify-app.ts",
    event: "API_ERROR",
  },
  authSecrets: {
    sessionHash: "hashSessionToken",
    passwordVerifier: "verifyPassword",
  },
  publicReportAccess: {
    route: "server/routes/public-report-access.fastify.ts",
    actorBuilder: "buildPublicReportAccessTokenActor",
  },
  smokeSecrets: {
    passwordEnv: "SMOKE_PASSWORD",
  },
} as const;

const AUTH_ROUTE_FILES = [
  "server/routes/auth.fastify.ts",
  "server/routes/admin-auth.fastify.ts",
  "server/routes/particular-auth.fastify.ts",
] as const;

const TOKEN_ROUTE_FILES = [
  "server/routes/public-report-access.fastify.ts",
  "server/routes/report-access-tokens.fastify.ts",
  "server/routes/admin-report-access-tokens.fastify.ts",
  "server/routes/particular-tokens.fastify.ts",
  "server/routes/admin-particular-tokens.fastify.ts",
  "server/features/report-access/application/public-report-access-operations.ts",
  "server/features/report-access/application/clinic-report-access-operations.ts",
  "server/features/report-access/application/admin-report-access-operations.ts",
] as const;

const AUDIT_FILES = [
  "server/lib/audit.ts",
  "server/lib/audit-log.ts",
  "server/lib/admin-audit.ts",
  "server/lib/clinic-audit.ts",
  "server/lib/particular-audit.ts",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

function assertContains(source: string, marker: string, context: string) {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string) {
  assert.equal(source.includes(marker), false, `${context} must not contain: ${marker}`);
}

const DANGEROUS_LOG_PATTERNS = [
  /console\.(log|error|warn|info)\([^)]*password/i,
  /console\.(log|error|warn|info)\([^)]*tokenHash/i,
  /console\.(log|error|warn|info)\([^)]*sessionToken/i,
  /console\.(log|error|warn|info)\([^)]*rawToken/i,
  /console\.(log|error|warn|info)\([^)]*authorization/i,
  /console\.(log|error|warn|info)\([^)]*cookie/i,
  /console\.(log|error|warn|info)\([^)]*signedUrl/i,
] as const;

function assertNoDirectSecretLogging(source: string, context: string) {
  for (const pattern of DANGEROUS_LOG_PATTERNS) {
    assert.doesNotMatch(source, pattern, `${context} must not log sensitive data with ${pattern}`);
  }
}

const STRUCTURED_LOGGER_KEY_MATRIX = [
  "authorization",
  "cookie",
  "password",
  "secret",
  "servicerole",
  "apikey",
  "token",
  "session",
  "signedurl",
  "storagepath",
  "databaseurl",
  "connectionstring",
] as const;

// Taxonomia completa de claves que isSensitiveLogKey debe redactar, fijada en
// el test (no derivada del source) para que su perdida sea una violacion.
const STRUCTURED_LOGGER_SENSITIVE_KEY_FRAGMENTS = [
  ...STRUCTURED_LOGGER_KEY_MATRIX,
  "passphrase",
  "credential",
  "privatekey",
  "bearer",
] as const;

const STRUCTURED_LOGGER_SENSITIVE_KEY_EXACT = [
  "pass",
  "dsn",
  "auth",
  "key",
  "email",
  "emails",
  "recipient",
  "recipients",
  "recipientemail",
  "recipientemails",
] as const;

const SENSITIVE_KEY_FRAGMENTS_LITERAL = {
  start: "const SENSITIVE_KEY_FRAGMENTS = [",
  end: "];",
  label: "SENSITIVE_KEY_FRAGMENTS",
} as const;

const SENSITIVE_KEY_EXACT_LITERAL = {
  start: "const SENSITIVE_KEY_EXACT = new Set([",
  end: "]);",
  label: "SENSITIVE_KEY_EXACT",
} as const;

const STRUCTURED_LOGGER_TEXT_REDACTION_PATTERNS = [
  "SIGNED_URL_PATTERN",
  "CONNECTION_STRING_PATTERN",
  "JWT_PATTERN",
  "SUPABASE_SECRET_PATTERN",
  "EMAIL_ADDRESS_PATTERN",
  "BEARER_PATTERN",
  "SENSITIVE_QUERY_PARAM_PATTERN",
  "SERIALIZED_COOKIE_PATTERN",
] as const;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sliceBetween(source: string, start: string, end: string): string | null {
  const startIndex = source.indexOf(start);

  if (startIndex === -1 || source.indexOf(start, startIndex + 1) !== -1) {
    return null;
  }

  const endIndex = source.indexOf(end, startIndex + start.length);

  return endIndex === -1 ? null : source.slice(startIndex + start.length, endIndex);
}

type StringLiteralBoundary = { start: string; end: string; label: string };

// Lee los items de un literal real (array o Set) linea por linea. Cualquier
// linea que no sea un item `"clave",` o un comentario lo vuelve no evaluable.
function readStringLiteralItems(
  source: string,
  literal: StringLiteralBoundary,
): Set<string> | null {
  const body = sliceBetween(source, literal.start, literal.end);

  if (body === null) {
    return null;
  }

  const items = new Set<string>();

  for (const line of body.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("//")) {
      continue;
    }

    const match = /^"([a-z0-9]+)",?$/.exec(trimmed);

    if (match === null) {
      return null;
    }

    items.add(match[1]);
  }

  return items.size === 0 ? null : items;
}

// Pure evaluator over the logger source: returns violations instead of
// asserting, so in-memory mutations of the real source are provable.
function evaluateStructuredLoggerRedaction(rawSource: string): string[] {
  const logger = rawSource.replace(/\r\n/g, "\n");
  const violations: string[] = [];
  const requireMarker = (marker: string, context: string) => {
    if (!logger.includes(marker)) violations.push(`${context} must contain: ${marker}`);
  };
  const forbidMarker = (marker: string, context: string) => {
    if (logger.includes(marker)) violations.push(`${context} must not contain: ${marker}`);
  };

  for (const marker of [
    "export function redactLogValue",
    "export function redactSensitiveText",
    "export function serializeError",
    "export function isSensitiveLogKey",
    "isSafeRequestId",
    "[REDACTED]",
  ]) {
    requireMarker(marker, "structured logger redaction boundary");
  }

  for (const fragment of STRUCTURED_LOGGER_KEY_MATRIX) {
    requireMarker(`"${fragment}"`, "structured logger key matrix");
  }

  forbidMarker("error.stack", "structured logger stack export");

  for (const pattern of DANGEROUS_LOG_PATTERNS) {
    if (pattern.test(logger)) {
      violations.push(`structured logger must not log sensitive data with ${pattern}`);
    }
  }

  // El mensaje libre de un error nunca se exporta: una regex de credenciales no
  // puede demostrar que no contiene datos clinicos, SQL o PII.
  forbidMarker("error.message", "structured logger free-form message");
  requireMarker("messageSanitized: LOG_REDACTED_VALUE", "structured logger closed error envelope");
  requireMarker("UnknownError", "structured logger non-Error envelope");

  requireMarker(
    'export const LOG_REDACTED_VALUE = "[REDACTED]";',
    "structured logger redaction value",
  );

  for (const [literal, required] of [
    [SENSITIVE_KEY_FRAGMENTS_LITERAL, STRUCTURED_LOGGER_SENSITIVE_KEY_FRAGMENTS],
    [SENSITIVE_KEY_EXACT_LITERAL, STRUCTURED_LOGGER_SENSITIVE_KEY_EXACT],
  ] as const) {
    const items = readStringLiteralItems(logger, literal);

    if (items === null) {
      violations.push(`structured logger ${literal.label} literal is not evaluable`);
      continue;
    }

    for (const key of required) {
      if (!items.has(key)) {
        violations.push(`structured logger ${literal.label} must contain: "${key}"`);
      }
    }
  }

  const sensitiveKeyPredicate = sliceBetween(
    logger,
    "export function isSensitiveLogKey(key: string): boolean {",
    "\n}\n",
  );

  if (sensitiveKeyPredicate === null) {
    violations.push("structured logger isSensitiveLogKey body is not evaluable");
  } else {
    const compactPredicate = sensitiveKeyPredicate.replace(/\s+/g, "");

    if (!compactPredicate.includes("if(SENSITIVE_KEY_EXACT.has(normalizedKey)){returntrue;}")) {
      violations.push("structured logger isSensitiveLogKey must match SENSITIVE_KEY_EXACT");
    }

    if (
      !compactPredicate.includes(
        "returnSENSITIVE_KEY_FRAGMENTS.some((fragment)=>normalizedKey.includes(fragment),);",
      )
    ) {
      violations.push("structured logger isSensitiveLogKey must match SENSITIVE_KEY_FRAGMENTS");
    }
  }

  const sensitiveKeyBranch = sliceBetween(logger, "if (isSensitiveLogKey(key)) {", "}");

  if (sensitiveKeyBranch === null) {
    violations.push("structured logger sensitive-key branch is not evaluable");
  } else if (
    normalizeWhitespace(sensitiveKeyBranch) !== "result[key] = LOG_REDACTED_VALUE; continue;"
  ) {
    violations.push("structured logger sensitive-key branch must replace the value with LOG_REDACTED_VALUE");
  }

  const stringCase = sliceBetween(logger, 'case "string":', ";");

  if (stringCase === null) {
    violations.push("structured logger string case is not evaluable");
  } else if (normalizeWhitespace(stringCase) !== "return redactSensitiveText(value)") {
    violations.push("structured logger string values must pass through redactSensitiveText");
  }

  const textRedactionBody = sliceBetween(
    logger,
    "export function redactSensitiveText(value: string): string {",
    "\n}\n",
  );

  if (textRedactionBody === null) {
    violations.push("structured logger redactSensitiveText body is not evaluable");
  } else {
    const compactBody = textRedactionBody.replace(/\s+/g, "");

    for (const pattern of STRUCTURED_LOGGER_TEXT_REDACTION_PATTERNS) {
      if (!compactBody.includes(`.replace(${pattern},`)) {
        violations.push(`structured logger redactSensitiveText must apply ${pattern}`);
      }
    }
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

// Retira un item solo dentro del literal real: una aparicion del mismo string
// fuera del literal (p. ej. en un comentario) no puede absorber la mutacion.
function removeLiteralItem(
  source: string,
  literal: StringLiteralBoundary,
  item: string,
): string {
  const body = sliceBetween(source, literal.start, literal.end);

  assert.notEqual(body, null, `mutation literal must be evaluable: ${literal.label}`);

  const mutatedBody = replaceOnce(body as string, `\n  "${item}",`, "");

  return replaceOnce(
    source,
    `${literal.start}${body}${literal.end}`,
    `${literal.start}${mutatedBody}${literal.end}`,
  );
}

test("sensitive log redaction matrix documents protected boundaries", () => {
  assert.deepEqual(SENSITIVE_LOG_REDACTION_BOUNDARIES, {
    requestLogs: {
      middleware: "server/middlewares/request-logger.ts",
      redactionMarker: "[REDACTED]",
    },
    structuredLogger: {
      module: "server/lib/logger.ts",
      redactionEntrypoint: "redactLogValue",
      textRedactionEntrypoint: "redactSensitiveText",
      errorSerializer: "serializeError",
    },
    observabilityMetrics: {
      module: "server/lib/observability-metrics.ts",
      routeDimension: "buildRouteMetricsKey",
    },
    globalErrorHandlers: {
      fastifyApp: "server/fastify-app.ts",
      event: "API_ERROR",
    },
    authSecrets: {
      sessionHash: "hashSessionToken",
      passwordVerifier: "verifyPassword",
    },
    publicReportAccess: {
      route: "server/routes/public-report-access.fastify.ts",
      actorBuilder: "buildPublicReportAccessTokenActor",
    },
    smokeSecrets: {
      passwordEnv: "SMOKE_PASSWORD",
    },
  });
});

test("request logger keeps token and query redaction centralized", () => {
  const requestLogger = readSource("server/middlewares/request-logger.ts");
  const logger = readSource("server/lib/logger.ts");

  assertContains(requestLogger, "[REDACTED]", "request logger redaction marker");
  assertContains(requestLogger, "REDACTED", "request logger redaction constant");
  assertContains(requestLogger, "token", "request logger token awareness");
  assertContains(requestLogger, "url", "request logger url awareness");
  assertContains(requestLogger, "method", "request logger method");
  assertContains(requestLogger, "statusCode", "request logger status code");
  assertContains(logger, "console", "central logger console boundary");
  assertContains(
    requestLogger,
    "logRequestCompletion",
    "request logger structured emitter",
  );
  assertNotContains(requestLogger, "console.", "request logger console boundary");

  // El contexto del access log es cerrado: sin path, url ni pathname reales.
  const contextTypeStart = requestLogger.indexOf(
    "export type RequestCompletionLogContext = {",
  );

  assert.notEqual(contextTypeStart, -1, "request logger context type");

  const contextType = requestLogger.slice(
    contextTypeStart,
    requestLogger.indexOf("};", contextTypeStart),
  );

  assert.deepEqual(
    contextType
      .split("\n")
      .map((line) => line.trim().split(":")[0])
      .filter((name) => /^[a-zA-Z]+$/.test(name))
      .sort(),
    [
      "durationMs",
      "method",
      "rateLimited",
      "routeTemplate",
      "statusClass",
      "statusCode",
    ],
  );

  assertNotContains(
    requestLogger,
    "sanitizeUrlForLogs(input.url",
    "request logger url dimension",
  );
  assertContains(requestLogger, "UNMATCHED_ROUTE", "request logger route fallback");
  assertContains(
    requestLogger,
    "routeTemplate: normalizeRouteTemplate(input.routeTemplate)",
    "request logger route template normalization",
  );

  for (const file of [
    "server/routes/admin-auth.fastify.ts",
    "server/routes/auth.fastify.ts",
    "server/routes/particular-auth.fastify.ts",
    "server/routes/public-report-access.fastify.ts",
    "server/routes/reports.fastify.ts",
    "server/routes/study-tracking.fastify.ts",
  ] as const) {
    const source = readSource(file);

    assertContains(source, "logRequestCompletion({", `${file} structured access log`);
    assertContains(
      source,
      "routeTemplate: request.routeOptions?.url",
      `${file} route template dimension`,
    );
    assertNotContains(source, "url: safeUrl", `${file} url dimension`);
    assertNotContains(source, "sanitizeUrlForLogs", `${file} url log derivation`);
  }

  assertNoDirectSecretLogging(requestLogger, "request logger middleware");
});

test("structured logger centraliza la redaccion y es el unico boundary de console migrado", () => {
  const logger = readSource("server/lib/logger.ts");

  // Marcadores, matriz de claves, ausencia de error.stack/error.message y el
  // envelope cerrado viven en el evaluator puro, junto con la estructura real
  // de redaccion (rama de clave sensible, case string, cadena de patrones).
  assert.deepEqual(evaluateStructuredLoggerRedaction(logger), []);
  assertNoDirectSecretLogging(logger, "structured logger");

  // Las rutas migradas emiten via logInfo/logError, no via console directo.
  for (const file of [
    "server/routes/admin-pricing.fastify.ts",
    "server/routes/public-pricing.fastify.ts",
  ] as const) {
    const source = readSource(file);

    assertContains(source, "logError(", `${file} structured error logging`);
    assertContains(source, "requestId: request.id", `${file} error correlation`);
    assertNotContains(source, "console.", `${file} console boundary`);
    assertNotContains(source, "\n        error,\n", `${file} raw error payload`);

    // El nombre del error pasa por la allowlist central del logger: un `name`
    // manipulado no puede exportar PII, email ni SQL a traves del log.
    assertContains(source, "serializeError", `${file} central error envelope`);
    assertContains(
      source,
      "errorName: serializeError(error).name,",
      `${file} allowlisted error name`,
    );
    assertNotContains(source, "getSafeErrorName", `${file} local error name helper`);
    assertNotContains(source, "error.message", `${file} free-form error message`);
    assertNotContains(source, "messageSanitized", `${file} error message export`);
  }
});

test("structured logger redaction evaluator fails closed on real redaction regressions", () => {
  const logger = readSource("server/lib/logger.ts");

  assert.deepEqual(evaluateStructuredLoggerRedaction(logger), []);

  const mutations = [
    {
      name: "sensitive key value logged in clear",
      target: "        result[key] = LOG_REDACTED_VALUE;\n",
      replacement: "        result[key] = entryValue;\n",
      expected: [
        "structured logger sensitive-key branch must replace the value with LOG_REDACTED_VALUE",
      ],
    },
    {
      name: "string values bypass text sanitization",
      target: 'case "string":\n      return redactSensitiveText(value);',
      replacement: 'case "string":\n      return value;',
      expected: ["structured logger string values must pass through redactSensitiveText"],
    },
    {
      name: "JWT redaction removed from free text",
      target: "    .replace(JWT_PATTERN, LOG_REDACTED_VALUE)\n",
      replacement: "",
      expected: ["structured logger redactSensitiveText must apply JWT_PATTERN"],
    },
    {
      name: "token dropped from the sensitive key fragments",
      target: '  "token",\n  "session",\n',
      replacement: '  "session",\n',
      expected: [
        'structured logger key matrix must contain: "token"',
        'structured logger SENSITIVE_KEY_FRAGMENTS must contain: "token"',
      ],
    },
    {
      name: "serializeError exports the free-form error message",
      target: ': "Error",\n    messageSanitized: LOG_REDACTED_VALUE,',
      replacement: ': "Error",\n    messageSanitized: error.message,',
      expected: ["structured logger free-form message must not contain: error.message"],
    },
  ] as const;

  for (const mutation of mutations) {
    const mutated = replaceOnce(logger, mutation.target, mutation.replacement);

    assert.deepEqual(
      evaluateStructuredLoggerRedaction(mutated),
      [...mutation.expected],
      `mutation must be detected: ${mutation.name}`,
    );
  }

  for (const [literal, keys] of [
    [SENSITIVE_KEY_FRAGMENTS_LITERAL, STRUCTURED_LOGGER_SENSITIVE_KEY_FRAGMENTS],
    [SENSITIVE_KEY_EXACT_LITERAL, STRUCTURED_LOGGER_SENSITIVE_KEY_EXACT],
  ] as const) {
    for (const key of keys) {
      const expected = [`structured logger ${literal.label} must contain: "${key}"`];

      if ((STRUCTURED_LOGGER_KEY_MATRIX as readonly string[]).includes(key)) {
        expected.unshift(`structured logger key matrix must contain: "${key}"`);
      }

      assert.deepEqual(
        evaluateStructuredLoggerRedaction(removeLiteralItem(logger, literal, key)),
        expected,
        `mutation must be detected: "${key}" removed from ${literal.label}`,
      );
    }
  }

  for (const mutation of [
    {
      target: "  if (SENSITIVE_KEY_EXACT.has(normalizedKey)) {\n    return true;\n  }\n",
      expected: "structured logger isSensitiveLogKey must match SENSITIVE_KEY_EXACT",
    },
    {
      target: "  return SENSITIVE_KEY_FRAGMENTS.some((fragment) =>\n    normalizedKey.includes(fragment),\n  );\n",
      expected: "structured logger isSensitiveLogKey must match SENSITIVE_KEY_FRAGMENTS",
    },
  ] as const) {
    assert.deepEqual(
      evaluateStructuredLoggerRedaction(replaceOnce(logger, mutation.target, "")),
      [mutation.expected],
      `mutation must be detected: ${mutation.expected}`,
    );
  }

  assert.deepEqual(
    evaluateStructuredLoggerRedaction(replaceOnce(logger, '\n  "dsn",\n', "\n  ...DYNAMIC_KEYS,\n")),
    ["structured logger SENSITIVE_KEY_EXACT literal is not evaluable"],
  );
  assert.throws(
    () => removeLiteralItem(logger, SENSITIVE_KEY_EXACT_LITERAL, "absentkey"),
    /mutation target must exist in source/,
  );
  assert.throws(() => readSource("server/lib/logger.absent.ts"), /ENOENT/);
  assert.throws(
    () => replaceOnce(logger, "result[key] = rawSecretValue;", ""),
    /mutation target must exist in source/,
  );
  assert.deepEqual(
    evaluateStructuredLoggerRedaction("").filter((violation) => violation.endsWith("is not evaluable")),
    [
      "structured logger SENSITIVE_KEY_FRAGMENTS literal is not evaluable",
      "structured logger SENSITIVE_KEY_EXACT literal is not evaluable",
      "structured logger isSensitiveLogKey body is not evaluable",
      "structured logger sensitive-key branch is not evaluable",
      "structured logger string case is not evaluable",
      "structured logger redactSensitiveText body is not evaluable",
    ],
  );
});

test("las metricas finalizan cada request exactamente una vez", () => {
  const metrics = readSource("server/lib/observability-metrics.ts");
  const fastifyApp = readSource("server/fastify-app.ts");

  for (const marker of [
    "recordRequestAborted",
    "createObservabilityRequestFinalizer",
  ] as const) {
    assertContains(metrics, marker, "metrics finalization boundary");
  }

  assertContains(
    fastifyApp,
    "createObservabilityRequestFinalizer",
    "fastify finalization boundary",
  );
  assertContains(fastifyApp, "onRequestAbort", "fastify abort hook");
  assertContains(
    fastifyApp,
    "finalizer.recordAborted()",
    "fastify abort finalization",
  );
  assertNotContains(
    fastifyApp,
    "metricsRegistry.recordRequestAborted(",
    "fastify direct abort bypassing the finalizer",
  );
  assertContains(
    fastifyApp,
    "state.finalizer.recordCompleted({",
    "fastify once-only completion",
  );
  assertNotContains(
    fastifyApp,
    "metricsRegistry.recordRequestCompleted(",
    "fastify direct completion bypassing the finalizer",
  );

  // Un aborto libera in-flight sin inventar un status code ni una latencia.
  const abortedStart = metrics.indexOf("recordRequestAborted() {");

  assert.notEqual(abortedStart, -1, "metrics aborted recorder");

  const abortedBody = metrics.slice(
    abortedStart,
    metrics.indexOf("},", abortedStart),
  );

  for (const forbidden of [
    "requestsCompletedTotal",
    "responsesByStatusClass",
    "serverErrors5xxTotal",
    "rateLimitedResponsesTotal",
    "pushBoundedSample",
    "resolveRouteBucket",
    "499",
  ]) {
    assertNotContains(abortedBody, forbidden, "metrics aborted recorder scope");
  }
});

test("los handlers globales no registran el objeto Error crudo", () => {
  const fastifyApp = readSource("server/fastify-app.ts");

  assertContains(fastifyApp, 'logError("API_ERROR", {', "fastify error handler event");
  assertContains(
    fastifyApp,
    "errorName: serializeError(error).name",
    "fastify error handler central allowlist",
  );
  assertContains(
    fastifyApp,
    "...(requestId ? { requestId } : {}),",
    "fastify error handler keeps requestId correlation",
  );
  assertContains(
    fastifyApp,
    "routeTemplate: getFastifyRouteTemplate(request)",
    "fastify error handler route template",
  );
  assertNotContains(
    fastifyApp,
    "getFastifyErrorName",
    "fastify local error name helper",
  );
  assertNotContains(fastifyApp, "\n      error,\n", "fastify raw error payload");
  assertNotContains(fastifyApp, "error.stack", "fastify stack export");
  assertNotContains(fastifyApp, "console.", "fastify console boundary");
  assertNotContains(
    fastifyApp,
    "path: getFastifyErrorResponsePath(request),\n      routeTemplate",
    "fastify error log path dimension",
  );
  assertNoDirectSecretLogging(fastifyApp, "fastify app");

  // El path sanitizado sigue siendo parte del body publico, no del log.
  assertContains(
    fastifyApp,
    "path: getFastifyErrorResponsePath(request),",
    "fastify error response path contract",
  );

  // `error.code` se omite del todo del log: una regex sintactica sobre un
  // `code` acepta identificadores con forma de PII (p. ej. "Paciente_307"), y
  // no existe una allowlist cerrada de SQLSTATE/codigos de libreria que
  // justifique mantener el campo. El contrato es ausencia total, no una lista
  // parcial de valores "tecnicos" aceptados.
  assertNotContains(
    fastifyApp,
    "SAFE_ERROR_CODE_PATTERN",
    "fastify must not keep a syntactic error-code pattern",
  );
  assertNotContains(
    fastifyApp,
    "getFastifyErrorSafeCode",
    "fastify must not derive a safeCode from error.code",
  );
  assertNotContains(fastifyApp, "safeCode", "fastify API_ERROR must omit safeCode");
  assertNotContains(
    fastifyApp,
    "SAFE_ERROR_NAME_PATTERN",
    "fastify must not keep a syntactic error-name pattern",
  );

  for (const file of [
    "server/routes/admin-pricing.fastify.ts",
    "server/routes/public-pricing.fastify.ts",
  ] as const) {
    const source = readSource(file);

    assertContains(
      source,
      "routeTemplate: normalizeRouteTemplate(request.routeOptions?.url)",
      `${file} route template dimension`,
    );
    assertContains(
      source,
      "errorName: serializeError(error).name,",
      `${file} allowlisted error name`,
    );
    assertNotContains(source, "path: request.url", `${file} raw url dimension`);
    assertNotContains(source, "sanitizeUrlForLogs", `${file} url log derivation`);
    assertNotContains(source, "safeCode", `${file} must not derive safeCode`);
    assertNotContains(source, "error.name", `${file} direct error.name usage`);
  }
});

test("serializeError usa una allowlist finita de nombres, no una regex sintactica", () => {
  const logger = readSource("server/lib/logger.ts");

  assertNotContains(
    logger,
    "SAFE_ERROR_NAME_PATTERN",
    "logger must not keep the syntactic error-name pattern",
  );
  assertContains(logger, "SAFE_ERROR_NAMES", "logger finite error-name allowlist");

  for (const builtin of [
    "Error",
    "TypeError",
    "RangeError",
    "ReferenceError",
    "SyntaxError",
    "URIError",
    "EvalError",
    "AggregateError",
  ] as const) {
    assertContains(
      logger,
      `"${builtin}"`,
      `logger allowlist must include native error class ${builtin}`,
    );
  }

  // Nombres custom de librerias/frameworks nunca deben sumarse a la allowlist:
  // deben degradar a "Error" via serializeError, no listarse como seguros.
  for (const disallowed of [
    "ZodError",
    "PostgresError",
    "FastifyError",
    "ValidationError",
  ] as const) {
    assertNotContains(
      logger,
      `"${disallowed}"`,
      `logger allowlist must not include library-specific name ${disallowed}`,
    );
  }
});

test("las metricas de observabilidad no admiten labels prohibidas", () => {
  const metrics = readSource("server/lib/observability-metrics.ts");

  assertContains(metrics, "export function buildRouteMetricsKey", "metrics route key boundary");
  assertContains(metrics, "UNMATCHED_ROUTE", "metrics unmatched route fallback");
  assertContains(metrics, "MAX_ROUTE_TEMPLATE_LENGTH", "metrics route length bound");
  assertContains(metrics, "routeKeyLimit", "metrics cardinality bound");
  assertContains(metrics, "latencySampleLimit", "metrics latency buffer bound");

  for (const forbidden of [
    "clinicId",
    "reportId",
    "patientId",
    "tutorId",
    "email",
    "sessionId",
    "cookie",
    "token",
    "tenant",
    "username",
    "process.env",
  ]) {
    assertNotContains(metrics, forbidden, "metrics forbidden dimension");
  }

  assertNoDirectSecretLogging(metrics, "observability metrics");
});

test("auth routes hash session tokens and avoid logging raw credentials", () => {
  for (const file of AUTH_ROUTE_FILES) {
    const source = readSource(file);

    assertContains(source, "hashSessionToken", `${file} session token hashing`);
    assertNoDirectSecretLogging(source, file);

    if (file !== "server/routes/particular-auth.fastify.ts") {
      assertContains(source, "verifyPassword", `${file} password verification`);
      assertContains(source, "metadata", `${file} audit metadata boundary`);
    } else {
      assertContains(source, "getParticularTokenByTokenHash", `${file} token verification`);
      assertContains(source, "updateParticularTokenLastLogin", `${file} login side effect`);
    }
  }
});

test("token routes avoid raw token leakage in audit metadata and logs", () => {
  for (const file of TOKEN_ROUTE_FILES) {
    const source = readSource(file);

    assertNoDirectSecretLogging(source, file);
  }

  for (const file of [
    "server/features/report-access/application/public-report-access-operations.ts",
    "server/features/report-access/application/clinic-report-access-operations.ts",
    "server/features/report-access/application/admin-report-access-operations.ts",
  ] as const) {
    const source = readSource(file);

    assertContains(source, "metadata", `${file} audit metadata boundary`);
  }

  const publicReportAccess = readSource("server/routes/public-report-access.fastify.ts");
  const publicReportAccessApplication = readSource(
    "server/features/report-access/application/public-report-access-operations.ts",
  );

  assertContains(publicReportAccess, "buildPublicReportAccessTokenActor", "public report access actor redaction boundary");
  assertContains(publicReportAccessApplication, "targetReportAccessTokenId", "public report access target id boundary");
  assertContains(publicReportAccessApplication, "record.token.id", "public report access uses token id");
  assertNotContains(publicReportAccessApplication, "record.token.raw", "public report access must not expose raw token");
});

test("audit helpers export structured identifiers without raw secrets", () => {
  for (const file of AUDIT_FILES) {
    const source = readSource(file);

    assertNoDirectSecretLogging(source, file);
    assertNotContains(source, "password", `${file} no password export`);
    assertNotContains(source, "sessionToken", `${file} no session token export`);
    assertNotContains(source, "tokenHash", `${file} no token hash export`);
    assertNotContains(source, "rawToken", `${file} no raw token export`);
  }

  const audit = readSource("server/lib/audit.ts");
  const auditLog = readSource("server/lib/audit-log.ts");

  assertContains(audit, "actorAdminUserId", "audit admin actor id");
  assertContains(audit, "actorClinicUserId", "audit clinic actor id");
  assertContains(audit, "actorReportAccessTokenId", "audit public token actor id");
  assertContains(audit, "targetReportAccessTokenId", "audit target token id");

  assertContains(auditLog, "actorAdminUserId", "audit csv admin actor id");
  assertContains(auditLog, "actorClinicUserId", "audit csv clinic actor id");
  assertContains(auditLog, "actorReportAccessTokenId", "audit csv public token actor id");
  assertContains(auditLog, "targetReportAccessTokenId", "audit csv target token id");
});

test("environment secret names are parsed but not logged directly", () => {
  const envSource = readSource("server/lib/env.ts");

  assertContains(envSource, "SUPABASE_SERVICE_ROLE_KEY", "supabase service role env parsing");
  assertContains(envSource, "SMTP_PASS", "smtp password env parsing");
  assertContains(envSource, "supabaseServiceRoleKey", "supabase service role typed env");
  assertContains(envSource, "pass: rawEnv.SMTP_PASS", "smtp password typed env");

  assertNoDirectSecretLogging(envSource, "env module");
  assertNotContains(envSource, "console.error", "env module direct console.error");
});

test("smtp transport uses ipv4 and tls servername without logging smtp secrets", () => {
  const emailSource = readSource("server/lib/email.ts");

  assertContains(emailSource, "family: 4", "smtp transport ipv4 enforcement");
  assertContains(emailSource, "servername: ENV.smtp.host", "smtp transport tls servername");
  assertNotContains(emailSource, "SMTP_PASS", "smtp module source");
  assertNoDirectSecretLogging(emailSource, "smtp module");
});

test("contact smtp failure logging keeps diagnostics allowlist and avoids secret fields", () => {
  const contactRouteSource = readSource("server/routes/contact.fastify.ts");

  assertContains(
    contactRouteSource,
    "extractSafeContactEmailErrorDiagnostics",
    "contact route smtp diagnostics helper",
  );
  assertContains(
    contactRouteSource,
    'reason: "email_delivery_failed"',
    "contact route public smtp failure reason",
  );
  assertContains(
    contactRouteSource,
    'console.error("[EMAIL] contact_message failed", {',
    "contact route smtp error logging",
  );

  for (const marker of [
    'getKnownErrorProperty(error, "code")',
    'getKnownErrorProperty(error, "command")',
    'getKnownErrorProperty(error, "responseCode")',
    'getKnownErrorProperty(error, "syscall")',
    'getKnownErrorProperty(error, "hostname")',
    'getKnownErrorProperty(error, "port")',
    'getKnownErrorProperty(error, "address")',
  ]) {
    assertContains(contactRouteSource, marker, "contact route smtp diagnostics allowlist");
  }

  for (const forbidden of [
    'getKnownErrorProperty(error, "message")',
    "SMTP_PASS",
    "accessToken",
    "refreshToken",
    "password",
    "auth:",
  ]) {
    assertNotContains(contactRouteSource, forbidden, "contact route smtp diagnostics forbidden fields");
  }
});

test("runtime tests remain explicit for redaction and secret-safe logging", () => {
  const requestLoggerTests = readSource("test/unit/infrastructure/request-logger.test.ts");
  const requestLoggerEdgeTests = readSource("test/unit/infrastructure/request-logger-edge.test.ts");
  const requestLoggerMiddlewareTests = readSource("test/unit/infrastructure/request-logger-middleware.test.ts");
  const loggerAndEmailTests = readSource("test/unit/infrastructure/logger-and-email.test.ts");
  const productionInvariants = readSource("test/architecture/security/security-production-invariants.test.ts");
  const smokeEnvContract = readSource("test/unit/infrastructure/smoke-env-contract.test.ts");

  assertContains(requestLoggerTests, "REDACTED", "request logger unit redaction test");
  assertContains(requestLoggerEdgeTests, "REDACTED", "request logger edge redaction test");
  assertContains(requestLoggerMiddlewareTests, "REDACTED", "request logger middleware redaction test");

  assertContains(loggerAndEmailTests, "logger", "logger test coverage");
  assertContains(productionInvariants, "logs de request sanitizan tokens", "production request log sanitization guardrail");

  assertContains(smokeEnvContract, "SMOKE_PASSWORD", "smoke password env coverage");
  assertContains(smokeEnvContract, "console.log", "smoke console log inspection");
  assertContains(smokeEnvContract, "assert.doesNotMatch(line, /PASSWORD|SMOKE_PASSWORD/)", "smoke password log redaction");
});

test("signed url tests keep storage access delegated without public urls", () => {
  const supabaseSignedUrlTests = readSource("test/unit/infrastructure/supabase-signed-url.test.ts");
  const supabaseStorageBoundariesTests = readSource("test/unit/infrastructure/supabase-storage-boundaries.test.ts");

  assertContains(supabaseSignedUrlTests, "createSignedStorageUrl", "signed storage url test");
  assertContains(supabaseSignedUrlTests, "createSignedReportDownloadUrl", "signed report download url test");
  assertContains(supabaseSignedUrlTests, "signedUrl", "signed url fixture coverage");

  assertContains(supabaseStorageBoundariesTests, "createSignedStorageUrl", "storage boundary signed url guard");
  assertContains(supabaseStorageBoundariesTests, "createSignedReportDownloadUrl", "storage boundary signed download guard");
  assertContains(supabaseStorageBoundariesTests, "getPublicUrl", "storage boundary public url assertion");
  assertContains(supabaseStorageBoundariesTests, "assert.equal(createSignedStorageUrlSource.includes(\"getPublicUrl\"), false)", "preview avoids public url");
  assertContains(supabaseStorageBoundariesTests, "assert.equal(createSignedReportDownloadUrlSource.includes(\"getPublicUrl\"), false)", "download avoids public url");
});

test("sensitive log redaction guardrail source stays ascii only", () => {
  const source = readSource("test/architecture/security/security-sensitive-log-redaction-boundaries.test.ts");
  const mojibakeLead = String.fromCharCode(0x00c3);
  const replacementCharacter = String.fromCharCode(0xfffd);

  assertNotContains(source, mojibakeLead, "guardrail source");
  assertNotContains(source, replacementCharacter, "guardrail source");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `guardrail source must stay ascii-only at index ${index}`,
    );
  }
});

test("request ids solo aceptan UUID v4 antes de llegar a logs", () => {
  const requestIdSource = readSource(
    "server/lib/http/api-request-id.ts",
  );
  const loggerSource = readSource("server/lib/logger.ts");

  assertContains(
    requestIdSource,
    "API_REQUEST_ID_UUID_V4_PATTERN",
    "request id UUID v4 boundary",
  );
  assertContains(
    requestIdSource,
    "value.length === API_REQUEST_ID_MAX_LENGTH",
    "request id exact UUID length",
  );
  assertContains(
    requestIdSource,
    "randomUUID()",
    "server-generated request id",
  );
  assertNotContains(
    requestIdSource,
    "API_REQUEST_ID_ALLOWED_CHARACTERS",
    "request id character-only allowlist",
  );

  assertContains(
    loggerSource,
    "isSafeRequestId(requestId)",
    "logger request id promotion boundary",
  );
});

test("sensitive log keys no permiten bypass por sufijos Id o Count", () => {
  const logger = readSource("server/lib/logger.ts");

  assertNotContains(
    logger,
    'endsWith("tokenid")',
    "logger tokenId suffix bypass",
  );
  assertNotContains(
    logger,
    'endsWith("count")',
    "logger count suffix bypass",
  );
  assertNotContains(
    logger,
    "function isSafeLogKey",
    "logger broad safe-key bypass",
  );
  assertContains(
    logger,
    "SENSITIVE_KEY_FRAGMENTS.some",
    "logger sensitive fragment boundary",
  );
});
