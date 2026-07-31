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

function isSafeLogKey(normalizedKey: string): boolean {
  return (
    normalizedKey === "requestid" ||
    normalizedKey.endsWith("tokenid") ||
    normalizedKey.endsWith("count")
  );
}

export function isSensitiveLogKey(key: string): boolean {
  const normalizedKey = normalizeLogKey(key);

  if (!normalizedKey || isSafeLogKey(normalizedKey)) {
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

export function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      messageSanitized: redactSensitiveText(error.message),
    };
  }

  return redactLogValue(error);
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
