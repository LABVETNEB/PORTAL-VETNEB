import { isSafeRequestId } from "./http/api-request-id.ts";

export const LOG_REDACTED_VALUE = "[REDACTED]";

export type LogLevel = "info" | "warn" | "error";

export type StructuredLogEvent = {
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId?: string;
  context: Record<string, unknown>;
};

const DEFAULT_EVENT_BY_LEVEL: Record<LogLevel, string> = {
  info: "LOG_INFO",
  warn: "LOG_WARN",
  error: "LOG_ERROR",
};

const EVENT_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 60;
const MAX_STRING_LENGTH = 2048;

const SENSITIVE_KEY_EXACT = new Set([
  "pass",
  "dsn",
  "auth",
  "key",
]);

const SENSITIVE_KEY_FRAGMENTS = [
  "authorization",
  "cookie",
  "password",
  "passphrase",
  "secret",
  "servicerole",
  "apikey",
  "token",
  "session",
  "signedurl",
  "storagepath",
  "databaseurl",
  "connectionstring",
  "credential",
  "privatekey",
  "bearer",
];

function normalizeLogKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Las claves sensibles se evalúan sin excepciones amplias por sufijo.
 *
 * Un nombre como `sessionTokenId`, `reportAccessTokenId` o
 * `refreshTokenCount` sigue describiendo material sensible aunque termine en
 * `Id` o `Count`. La clave por sí sola no demuestra que su valor sea un
 * identificador numérico inocuo.
 *
 * `requestId` no requiere una excepción: no contiene fragmentos sensibles y
 * su valor se valida separadamente como UUID v4 antes de promoverse al nivel
 * superior del evento.
 */
export function isSensitiveLogKey(key: string): boolean {
  const normalizedKey = normalizeLogKey(key);

  if (!normalizedKey) {
    return false;
  }

  if (SENSITIVE_KEY_EXACT.has(normalizedKey)) {
    return true;
  }

  return SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
    normalizedKey.includes(fragment),
  );
}

const SIGNED_URL_PATTERN =
  /\bhttps?:\/\/[^\s"']*(?:\/object\/sign\/|[?&](?:token|access_token|refresh_token|signature|X-Amz-Signature)=)[^\s"']*/gi;
const CONNECTION_STRING_PATTERN =
  /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s"']+/gi;
const BEARER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g;
const SUPABASE_SECRET_PATTERN =
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/gi;
const SENSITIVE_QUERY_PARAM_PATTERN =
  /([?&](?:token|access_token|refresh_token|accessToken|refreshToken|reportAccessToken|signature|apikey|api_key)=)([^&#\s"']+)/gi;
const SERIALIZED_COOKIE_PATTERN =
  /(^|[;,\s])([A-Za-z0-9_.-]*(?:session|token|auth|secret|password)[A-Za-z0-9_.-]*)=([^;,\s]+)/gi;

export function redactSensitiveText(value: string): string {
  const redacted = value
    .replace(SIGNED_URL_PATTERN, LOG_REDACTED_VALUE)
    .replace(CONNECTION_STRING_PATTERN, LOG_REDACTED_VALUE)
    .replace(JWT_PATTERN, LOG_REDACTED_VALUE)
    .replace(SUPABASE_SECRET_PATTERN, LOG_REDACTED_VALUE)
    .replace(BEARER_PATTERN, (_match, scheme: string) =>
      `${scheme} ${LOG_REDACTED_VALUE}`,
    )
    .replace(
      SENSITIVE_QUERY_PARAM_PATTERN,
      (_match, prefix: string) => `${prefix}${LOG_REDACTED_VALUE}`,
    )
    .replace(
      SERIALIZED_COOKIE_PATTERN,
      (_match, lead: string, name: string) =>
        `${lead}${name}=${LOG_REDACTED_VALUE}`,
    );

  return redacted.length > MAX_STRING_LENGTH
    ? `${redacted.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]`
    : redacted;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && typeof value === "object" && !Array.isArray(value)
  );
}

function redactValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
      return redactSensitiveText(value);
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "undefined":
      return undefined;
    case "function":
      return "[Function]";
    case "symbol":
      return value.toString();
    default:
      break;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? "[InvalidDate]"
      : value.toISOString();
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  const objectValue = value as object;

  if (seen.has(objectValue)) {
    return "[Circular]";
  }

  if (depth >= MAX_DEPTH) {
    return "[MaxDepth]";
  }

  seen.add(objectValue);

  try {
    if (Array.isArray(value)) {
      const items = value
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => redactValue(item, depth + 1, seen));

      if (value.length > MAX_ARRAY_ITEMS) {
        items.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`);
      }

      return items;
    }

    if (value instanceof Map || value instanceof Set) {
      return `[${value.constructor.name}]`;
    }

    if (!isPlainObject(value)) {
      return redactSensitiveText(String(value));
    }

    const result: Record<string, unknown> = {};
    let keyCount = 0;

    for (const [key, entryValue] of Object.entries(value)) {
      if (keyCount >= MAX_OBJECT_KEYS) {
        result["[truncated]"] = true;
        break;
      }

      if (entryValue === undefined) {
        continue;
      }

      keyCount += 1;

      if (isSensitiveLogKey(key)) {
        result[key] = LOG_REDACTED_VALUE;
        continue;
      }

      const redacted = redactValue(entryValue, depth + 1, seen);

      if (redacted !== undefined) {
        result[key] = redacted;
      }
    }

    return result;
  } finally {
    seen.delete(objectValue);
  }
}

export function redactLogValue(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet<object>());
}

/**
 * Allowlist finita e inmutable de nombres de clases de Error nativas de
 * JavaScript. Una regex sintactica (p. ej. "cualquier identificador") sigue
 * aceptando nombres con forma de PII como "MariaGomez" o "Paciente_307": sólo
 * una lista cerrada de valores conocidos elimina esa clase de fuga.
 */
const SAFE_ERROR_NAMES: ReadonlySet<string> = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "AggregateError",
]);

export type SerializedError = {
  name: string;
  messageSanitized: typeof LOG_REDACTED_VALUE;
};

/**
 * Envelope cerrado: nunca se exporta el mensaje libre de un error. Una regex de
 * credenciales no puede demostrar que un mensaje arbitrario no contiene nombre
 * de paciente, email, contenido clinico, SQL, parametros DB o paths internos,
 * asi que el mensaje se elimina por diseno y solo sobrevive el nombre de la
 * clase de error, validado contra la allowlist finita.
 */
export function serializeError(error: unknown): SerializedError {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      messageSanitized: LOG_REDACTED_VALUE,
    };
  }

  const name = error.name;

  return {
    name:
      typeof name === "string" && SAFE_ERROR_NAMES.has(name) ? name : "Error",
    messageSanitized: LOG_REDACTED_VALUE,
  };
}

function buildLogContext(args: unknown[]): Record<string, unknown> {
  if (args.length === 0) {
    return {};
  }

  if (args.length === 1 && isPlainObject(args[0])) {
    return redactLogValue(args[0]) as Record<string, unknown>;
  }

  return {
    args: redactLogValue(args) as unknown[],
  };
}

export function buildStructuredLogEvent(
  level: LogLevel,
  args: unknown[],
): StructuredLogEvent {
  const [first, ...rest] = args;
  const hasEventName = typeof first === "string" && EVENT_NAME_PATTERN.test(first);

  const event = hasEventName ? first : DEFAULT_EVENT_BY_LEVEL[level];
  const context = buildLogContext(hasEventName ? rest : args);

  const requestId = context.requestId;

  if ("requestId" in context) {
    delete context.requestId;
  }

  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(isSafeRequestId(requestId) ? { requestId } : {}),
    context,
  };
}

function stringifyLogEvent(logEvent: StructuredLogEvent): string {
  try {
    return JSON.stringify(logEvent);
  } catch {
    return JSON.stringify({
      timestamp: logEvent.timestamp,
      level: logEvent.level,
      event: logEvent.event,
      ...(logEvent.requestId ? { requestId: logEvent.requestId } : {}),
      context: { serialization: "failed" },
    });
  }
}

export function logInfo(...args: unknown[]) {
  console.log(stringifyLogEvent(buildStructuredLogEvent("info", args)));
}

export function logWarn(...args: unknown[]) {
  console.warn(stringifyLogEvent(buildStructuredLogEvent("warn", args)));
}

export function logError(...args: unknown[]) {
  console.error(stringifyLogEvent(buildStructuredLogEvent("error", args)));
}
