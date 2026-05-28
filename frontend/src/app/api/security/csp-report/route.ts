// frontend/src/app/api/security/csp-report/route.ts
// VETNEB #748 - CSP violation report sink.
// Same-origin endpoint for browser CSP reports under Report-Only mode.
//
// Hard contract:
//   - POST only. Other methods -> 405.
//   - Accepted Content-Types: application/csp-report, application/reports+json,
//     application/json (fallback for tests / manual curl).
//   - Body size limit: 16 KB. Excess -> 413.
//   - Response on accepted body: 204 No Content (always silent in production).
//   - Never echo, log, or persist the raw payload.
//   - Sanitization keeps a whitelist of fields, strips query/hash from URLs,
//     truncates long strings, and replaces script-sample with "[redacted]".
//   - In development only, a sanitized warning may be emitted via console.warn.
//     Production always emits nothing.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_STRING_LEN = 1024;
const MAX_DIRECTIVE_LEN = 128;
const MAX_DISPOSITION_LEN = 32;

const ACCEPTED_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "application/csp-report",
  "application/reports+json",
  "application/json",
]);

type UnknownRecord = Record<string, unknown>;

type SanitizedReport = {
  documentUri: string | null;
  blockedUri: string | null;
  violatedDirective: string | null;
  disposition: string | null;
  sourceFile: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  statusCode: number | null;
  scriptSample: "[redacted]" | null;
};

function extractBaseContentType(value: string | null): string {
  if (!value) return "";
  return value.split(";")[0].trim().toLowerCase();
}

function truncateString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  if (value.length === 0) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function stripUrlSensitiveParts(value: unknown, max: number): string | null {
  const s = truncateString(value, max);
  if (!s) return null;
  // Remove query and fragment to avoid storing tokens/PII present in URLs.
  const cleaned = s.split("?")[0].split("#")[0];
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function sanitizeBody(body: UnknownRecord): SanitizedReport {
  const hasSample =
    typeof body["script-sample"] === "string" ||
    typeof body["sample"] === "string";

  return {
    documentUri: stripUrlSensitiveParts(
      body["documentURL"] ?? body["document-uri"],
      MAX_STRING_LEN,
    ),
    blockedUri: stripUrlSensitiveParts(
      body["blockedURL"] ?? body["blocked-uri"],
      MAX_STRING_LEN,
    ),
    violatedDirective: truncateString(
      body["effectiveDirective"] ??
        body["violated-directive"] ??
        body["effective-directive"],
      MAX_DIRECTIVE_LEN,
    ),
    disposition: truncateString(body["disposition"], MAX_DISPOSITION_LEN),
    sourceFile: stripUrlSensitiveParts(
      body["sourceFile"] ?? body["source-file"],
      MAX_STRING_LEN,
    ),
    lineNumber: readNumber(body["lineNumber"] ?? body["line-number"]),
    columnNumber: readNumber(body["columnNumber"] ?? body["column-number"]),
    statusCode: readNumber(body["statusCode"] ?? body["status-code"]),
    scriptSample: hasSample ? "[redacted]" : null,
  };
}

function pickReportBody(raw: unknown): UnknownRecord | null {
  // Reporting API: [{ type: 'csp-violation', body: {...} }, ...]
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry && typeof entry === "object") {
        const e = entry as UnknownRecord;
        if (
          e["type"] === "csp-violation" &&
          e["body"] &&
          typeof e["body"] === "object"
        ) {
          return e["body"] as UnknownRecord;
        }
      }
    }
    return null;
  }

  // Legacy: { "csp-report": {...} }
  if (raw && typeof raw === "object") {
    const obj = raw as UnknownRecord;
    const legacy = obj["csp-report"];
    if (legacy && typeof legacy === "object") {
      return legacy as UnknownRecord;
    }
    // Some test clients post the body flat.
    return obj;
  }

  return null;
}

export async function POST(req: Request): Promise<Response> {
  const baseType = extractBaseContentType(req.headers.get("content-type"));
  if (!ACCEPTED_CONTENT_TYPES.has(baseType)) {
    return new Response(null, { status: 415 });
  }

  const declaredLengthHeader = req.headers.get("content-length");
  if (declaredLengthHeader !== null) {
    const declared = Number(declaredLengthHeader);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    // Unreadable body: swallow silently (avoid leaking parser internals).
    return new Response(null, { status: 204 });
  }

  if (raw.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Invalid JSON: still 204. Reports are attacker-controlled, do not reveal
    // any details about parser behavior.
    return new Response(null, { status: 204 });
  }

  const body = pickReportBody(parsed);
  if (body) {
    const sanitized = sanitizeBody(body);
    if (process.env.NODE_ENV !== "production") {
      // Sanitized form only. Never log the raw payload.
      // eslint-disable-next-line no-console
      console.warn("[csp-report]", sanitized);
    }
  }

  return new Response(null, { status: 204 });
}

function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}
export async function PUT(): Promise<Response> {
  return methodNotAllowed();
}
export async function PATCH(): Promise<Response> {
  return methodNotAllowed();
}
export async function DELETE(): Promise<Response> {
  return methodNotAllowed();
}
export async function OPTIONS(): Promise<Response> {
  return methodNotAllowed();
}
export async function HEAD(): Promise<Response> {
  return methodNotAllowed();
}
