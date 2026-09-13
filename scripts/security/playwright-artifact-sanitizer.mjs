#!/usr/bin/env node
// Fail-closed sanitization boundary for Playwright failure artifacts
// (LIMPIEZA E2E B-4 / E2E-GLOBAL-02 prerequisite).
//
// Raw Playwright output (test-results/, playwright-report/, candidate evidence)
// carries Cookie/Set-Cookie/Authorization values, addCookies() parameters,
// storage state, request/response bodies and typed input values (measured
// against Playwright 1.63.0). CI must never upload it. This tool reads raw trees
// read-only, writes an allowlisted, redacted copy into a NEW staging directory,
// re-validates that copy with an independent pass and deletes it on any
// violation. Workflows upload only the staging directory, and only when this
// process exits 0.
//
// Policy (allowlist, not denylist):
//   - trace.zip: JSONL events are rebuilt from per-event allowlists; DOM
//     snapshots, request/response bodies (resources/), embedded sources (src/),
//     console text and call results are dropped; header values survive only for
//     a benign header allowlist; cookie and query values are always redacted.
//   - playwright-report/index.html: the embedded base64 report zip is decoded,
//     redacted and rebuilt; the static trace viewer bundle is kept.
//   - PNG/JPEG are kept after magic-byte verification; Markdown, CSV and JSON
//     are redacted; every other file type is omitted.
// Unknown members, events, files or unparsable structures are omitted, never
// copied raw.

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

export const REDACTED = "[REDACTED]";
export const MIN_HARVESTED_VALUE_LENGTH = 6;
export const MANIFEST_FILE = "SANITIZATION-MANIFEST.json";

const MAX_MEMBER_BYTES = 256 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const REPORT_TEMPLATE_RE = /<template id="playwrightReportBase64">data:application\/zip;base64,([A-Za-z0-9+/=]*)<\/template>/g;

export const ALWAYS_REDACTED_HEADER_NAMES = Object.freeze([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
]);

export const BENIGN_HEADER_NAMES = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "accept-ranges",
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-allow-origin",
  "access-control-expose-headers",
  "access-control-max-age",
  "cache-control",
  "connection",
  "content-encoding",
  "content-length",
  "content-type",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "date",
  "expires",
  "host",
  "keep-alive",
  "last-modified",
  "location",
  "origin",
  "permissions-policy",
  "pragma",
  "referer",
  "referrer-policy",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-user",
  "server",
  "strict-transport-security",
  "transfer-encoding",
  "upgrade-insecure-requests",
  "user-agent",
  "vary",
  "x-content-type-options",
  "x-frame-options",
  "x-powered-by",
]);

const URL_HEADER_NAMES = new Set(["location", "origin", "referer"]);

// The mandatory names and any credential-looking name win over the benign list.
function isRedactedHeaderName(lowerCaseName) {
  return ALWAYS_REDACTED_HEADER_NAMES.includes(lowerCaseName) || SENSITIVE_NAME_RE.test(lowerCaseName) || !BENIGN_HEADER_NAMES.has(lowerCaseName);
}
const SENSITIVE_NAME_RE = /(auth|cookie|token|session|sess|sid|secret|passw|csrf|xsrf|api[-_]?key|jwt|signature|credential|otp)/i;
const NAMED_KEY_RE = /^(?:(?:Control|Shift|Alt|Meta|ControlOrMeta)\+)*(?:[A-Z][A-Za-z0-9]+|F\d{1,2})$/;
const VALUE_TITLE_RE = /^(Fill|Type|Press sequentially|Insert text) "[\s\S]*"$/;

// Playwright-generated identifiers and file references: never user data, and
// rewriting them would break the trace/report cross-references.
export const STRUCTURAL_KEYS = new Set([
  "_frameref",
  "callId",
  "contentType",
  "contextId",
  "fetchUid",
  "file",
  "fileId",
  "outcome",
  "pageId",
  "pageref",
  "parentId",
  "path",
  "projectName",
  "sha1",
  "startTime",
  "status",
  "stepId",
  "testId",
]);

const SAFE_PARAM_KEYS = new Set([
  "button",
  "clickCount",
  "delay",
  "force",
  "frameSelector",
  "isFunction",
  "isNot",
  "method",
  "name",
  "noWaitAfter",
  "selector",
  "state",
  "strict",
  "timeout",
  "trial",
  "type",
  "waitUntil",
]);
const URL_PARAM_KEYS = new Set(["url", "referer"]);

const TRACE_MEMBER_RE = /^(?:\d+-)?trace\.(?:trace|network|stacks)$|^test\.trace$/;
const SCREENCAST_MEMBER_RE = /^screencast\/[A-Za-z0-9@._-]+\.jpe?g$/;
const ATTACHMENT_MEMBER_RE = /^attachments\/[0-9a-f]{40}$/;
const TEXT_EXTENSIONS = new Set([".csv", ".md"]);
const VIEWER_ASSET_EXTENSIONS = new Set([".css", ".html", ".js", ".svg", ".ttf", ".webmanifest", ".woff", ".woff2"]);

function isMapping(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isInside(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

function toPosix(path) {
  return path.split(sep).join("/");
}

// ---------------------------------------------------------------------------
// ZIP (no dependencies; stored + deflate only; no zip64, no encryption)
// ---------------------------------------------------------------------------

export function readZip(buffer) {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) throw new Error("not a zip archive");
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65_557); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip end of central directory not found");
  const count = buffer.readUInt16LE(eocd + 10);
  if (count === 0xffff) throw new Error("zip64 archives are not supported");
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("corrupt zip central directory");
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const checksum = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    if (flags & 0x1) throw new Error("encrypted zip members are not supported");
    if (method !== 0 && method !== 8) throw new Error("unsupported zip compression method");
    if (size > MAX_MEMBER_BYTES || compressedSize === 0xffffffff) throw new Error("zip member exceeds size limit");
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("corrupt zip local header");
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_MEMBER_BYTES });
    if (data.length !== size || crc32(data) >>> 0 !== checksum) throw new Error("zip member failed integrity check");
    total += data.length;
    if (total > MAX_ARCHIVE_BYTES) throw new Error("zip archive exceeds size limit");
    entries.push({ name, data });
  }
  return entries;
}

export function writeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuffer = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data);
    const checksum = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuffer, compressed);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

// ---------------------------------------------------------------------------
// Harvesting: secret-class values seen in structured fields are later removed
// from every string of the whole artifact set (free-text logs, error messages,
// titles, Markdown). Harvesting is limited to secret classes so ordinary
// words and paths are not over-redacted.
// ---------------------------------------------------------------------------

function isOpaqueToken(value) {
  return typeof value === "string" && value.length >= 16 && /\d/.test(value) && /[A-Za-z]/.test(value) && /^[A-Za-z0-9._~+/=%-]+$/.test(value);
}

function isSecretShaped(value) {
  return typeof value === "string" && ((value.length >= 8 && !/^[A-Za-z]+$/.test(value)) || isOpaqueToken(value));
}

function jsonStringLeaves(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) jsonStringLeaves(item, out);
  else if (isMapping(value)) for (const item of Object.values(value)) jsonStringLeaves(item, out);
  return out;
}

// Playwright serializes evaluate() arguments as {s: string} / {a: [...]} /
// {o: [{k, v}]}; only real string payloads are harvested, never type markers.
function serializedArgStrings(value, out = []) {
  if (Array.isArray(value)) for (const item of value) serializedArgStrings(item, out);
  else if (isMapping(value)) {
    if (typeof value.s === "string") out.push(value.s);
    for (const [key, item] of Object.entries(value)) if (key !== "k" && key !== "s" && typeof item === "object") serializedArgStrings(item, out);
  }
  return out;
}

export function addHarvested(values, candidate) {
  if (typeof candidate !== "string") return;
  const trimmed = candidate.trim();
  if (trimmed.length < MIN_HARVESTED_VALUE_LENGTH || trimmed.includes(REDACTED)) return;
  // Plain URLs are not secrets as a whole: only their sensitive query/fragment
  // values are harvested, so origins and paths stay readable everywhere.
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.username && !parsed.password) {
        harvestUrl(values, trimmed);
        return;
      }
    } catch {
      // Unparsable: harvest verbatim below.
    }
  }
  values.add(trimmed);
  try {
    const encoded = encodeURIComponent(trimmed);
    if (encoded !== trimmed) values.add(encoded);
  } catch {
    // Lone surrogates cannot be URI-encoded; the raw form is already harvested.
  }
  const credential = /^(?:Bearer|Basic|Digest|Token)\s+(\S+)$/i.exec(trimmed);
  if (credential) addHarvested(values, credential[1]);
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      for (const leaf of jsonStringLeaves(JSON.parse(trimmed))) addHarvested(values, leaf);
    } catch {
      // Not JSON; the whole string is already harvested.
    }
  }
}

function harvestCookiePairs(values, headerValue) {
  if (typeof headerValue !== "string") return;
  for (const part of headerValue.split(/[;\n]/)) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (SENSITIVE_NAME_RE.test(name) || isSecretShaped(value)) addHarvested(values, value);
  }
}

function harvestHeaders(values, headers) {
  if (!Array.isArray(headers)) return;
  for (const header of headers) {
    if (!isMapping(header) || typeof header.name !== "string" || typeof header.value !== "string") continue;
    const name = header.name.toLowerCase();
    if (name === "cookie" || name === "set-cookie") harvestCookiePairs(values, header.value);
    else if (ALWAYS_REDACTED_HEADER_NAMES.includes(name) || SENSITIVE_NAME_RE.test(name)) addHarvested(values, header.value);
    else if (!BENIGN_HEADER_NAMES.has(name) && isOpaqueToken(header.value)) addHarvested(values, header.value);
  }
}

function harvestCookies(values, cookies) {
  if (!Array.isArray(cookies)) return;
  for (const cookie of cookies) {
    if (isMapping(cookie) && (SENSITIVE_NAME_RE.test(String(cookie.name)) || isSecretShaped(cookie.value))) addHarvested(values, cookie.value);
  }
}

function harvestNamedValues(values, entries) {
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (isMapping(entry) && (SENSITIVE_NAME_RE.test(String(entry.name)) || isOpaqueToken(entry.value))) addHarvested(values, entry.value);
  }
}

function harvestUrl(values, rawUrl) {
  if (typeof rawUrl !== "string") return;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return;
  }
  harvestNamedValues(values, [...parsed.searchParams].map(([name, value]) => ({ name, value })));
  if (parsed.hash.includes("=")) {
    harvestNamedValues(values, [...new URLSearchParams(parsed.hash.slice(1))].map(([name, value]) => ({ name, value })));
  }
}

function harvestSnapshotNode(values, node) {
  if (!Array.isArray(node)) return;
  const attributes = isMapping(node[1]) ? node[1] : null;
  if (attributes) {
    const type = String(attributes.type ?? "").toLowerCase();
    for (const key of ["value", "__playwright_value_"]) {
      const value = attributes[key];
      if (type === "password" || type === "hidden" || isOpaqueToken(value)) addHarvested(values, value);
    }
  }
  for (const child of node) if (Array.isArray(child)) harvestSnapshotNode(values, child);
}

function harvestValueTitle(values, title) {
  if (typeof title !== "string") return;
  const titled = /^(?:Fill|Type|Press sequentially|Insert text) "([\s\S]*)"$/.exec(title);
  if (titled) addHarvested(values, titled[1]);
}

function decodeBase64Text(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/=\s]+$/.test(value)) return undefined;
  return Buffer.from(value, "base64").toString("utf8");
}

export function harvestEvent(values, event) {
  if (!isMapping(event)) return;
  const params = isMapping(event.params) ? event.params : {};
  switch (event.type) {
    case "context-options": {
      const options = isMapping(event.options) ? event.options : {};
      harvestHeaders(values, Array.isArray(options.extraHTTPHeaders) ? options.extraHTTPHeaders : Object.entries(options.extraHTTPHeaders ?? {}).map(([name, value]) => ({ name, value })));
      for (const leaf of jsonStringLeaves(options.httpCredentials)) addHarvested(values, leaf);
      for (const leaf of jsonStringLeaves(options.storageState)) addHarvested(values, leaf);
      break;
    }
    case "before": {
      for (const cookie of Array.isArray(params.cookies) ? params.cookies : []) if (isMapping(cookie)) addHarvested(values, cookie.value);
      harvestHeaders(values, params.headers);
      addHarvested(values, params.value);
      addHarvested(values, params.text);
      harvestUrl(values, params.url);
      for (const leaf of serializedArgStrings(params.arg)) addHarvested(values, leaf);
      addHarvested(values, params.jsonData);
      addHarvested(values, decodeBase64Text(params.postData));
      for (const key of ["formData", "multipartData", "storageState", "httpCredentials"]) {
        for (const leaf of jsonStringLeaves(params[key])) addHarvested(values, leaf);
      }
      harvestValueTitle(values, event.title);
      break;
    }
    case "after": {
      if (!isMapping(event.result)) break;
      for (const cookie of Array.isArray(event.result.cookies) ? event.result.cookies : []) if (isMapping(cookie)) addHarvested(values, cookie.value);
      for (const origin of Array.isArray(event.result.origins) ? event.result.origins : []) {
        for (const entry of Array.isArray(origin?.localStorage) ? origin.localStorage : []) if (isMapping(entry)) addHarvested(values, entry.value);
      }
      harvestHeaders(values, event.result.response?.headers);
      break;
    }
    case "resource-snapshot": {
      const snapshot = isMapping(event.snapshot) ? event.snapshot : {};
      for (const side of [snapshot.request, snapshot.response]) {
        if (!isMapping(side)) continue;
        harvestCookies(values, side.cookies);
        harvestHeaders(values, side.headers);
      }
      if (isMapping(snapshot.request)) {
        harvestUrl(values, snapshot.request.url);
        harvestNamedValues(values, snapshot.request.queryString);
      }
      break;
    }
    case "frame-snapshot":
      harvestSnapshotNode(values, event.snapshot?.html);
      break;
    default:
      break;
  }
}

export function harvestReportNode(values, node) {
  if (Array.isArray(node)) {
    for (const item of node) harvestReportNode(values, item);
    return;
  }
  if (!isMapping(node)) return;
  harvestValueTitle(values, node.title);
  for (const value of Object.values(node)) if (typeof value === "object") harvestReportNode(values, value);
}

// ---------------------------------------------------------------------------
// Redaction primitives (each rule is idempotent on already-redacted text)
// ---------------------------------------------------------------------------

const HEADER_LINE_RE = /\b(proxy-authorization|authorization|set-cookie|cookie|x-api-key)(["']?\s*[:=]\s*)(?!\s|\[REDACTED\])[^\r\n]+/gi;
const CREDENTIAL_SCHEME_RE = /\b(Bearer|Basic|Digest|Token)(\s+)(?!\[REDACTED\])(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{8,}/g;
const QUERY_RE = /\?(?!\[REDACTED\])[^\s"'<>`#)\]]*=[^\s"'<>`#)\]]*/g;
const FRAGMENT_RE = /#(?!\[REDACTED\])[^\s"'<>`)\]]*=[^\s"'<>`)\]]*/g;
const SENSITIVE_PAIR_RE = /\b([A-Za-z0-9_.-]*(?:session|sess|sid|token|auth|csrf|xsrf|secret|passw|jwt|api[_-]?key)[A-Za-z0-9_.-]*)=(?!\[REDACTED\])([^;\s&"'<>,]+)/gi;
const OPAQUE_TOKEN_RE = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g;

export function createRedactor(harvestedValues) {
  const ordered = [...harvestedValues].sort((left, right) => right.length - left.length);
  return function redactText(text) {
    if (typeof text !== "string" || text.length === 0) return text;
    let result = text
      .replace(HEADER_LINE_RE, `$1$2${REDACTED}`)
      .replace(CREDENTIAL_SCHEME_RE, `$1$2${REDACTED}`)
      .replace(QUERY_RE, `?${REDACTED}`)
      .replace(FRAGMENT_RE, `#${REDACTED}`)
      .replace(SENSITIVE_PAIR_RE, `$1=${REDACTED}`);
    for (const value of ordered) if (result.includes(value)) result = result.split(value).join(REDACTED);
    return result.replace(OPAQUE_TOKEN_RE, REDACTED);
  };
}

export function redactUrl(value, redactText) {
  if (typeof value !== "string") return undefined;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return redactText(value);
  }
  if (parsed.protocol === "data:" || parsed.protocol === "blob:") return `${parsed.protocol}${REDACTED}`;
  const base = parsed.origin === "null" ? value.split(/[?#]/)[0] : `${parsed.origin}${parsed.pathname}`;
  return redactText(base) + (parsed.search ? `?${REDACTED}` : "") + (parsed.hash ? `#${REDACTED}` : "");
}

// Final pass over every kept string: nothing leaves the sanitizer without
// crossing the redactor, except Playwright-generated identifiers.
function redactStrings(node, redactText, key = "") {
  if (typeof node === "string") return STRUCTURAL_KEYS.has(key) ? node : redactText(node);
  if (Array.isArray(node)) return node.map((item) => redactStrings(item, redactText, key));
  if (!isMapping(node)) return node;
  const out = {};
  for (const [childKey, value] of Object.entries(node)) {
    if (value !== undefined) out[childKey] = redactStrings(value, redactText, childKey);
  }
  return out;
}

function pick(source, keys) {
  const out = {};
  if (!isMapping(source)) return out;
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function primitiveOnly(source) {
  if (!isMapping(source)) return undefined;
  return Object.fromEntries(Object.entries(source).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)));
}

function sanitizeStack(stack) {
  if (!Array.isArray(stack)) return undefined;
  return stack.filter(isMapping).map((frame) => primitiveOnly(pick(frame, ["file", "line", "column", "function"])));
}

function sanitizeError(error, redactText) {
  if (typeof error === "string") return redactText(error);
  if (!isMapping(error)) return undefined;
  const out = {};
  for (const key of ["message", "name"]) if (typeof error[key] === "string") out[key] = redactText(error[key]);
  if (typeof error.stack === "string") out.stack = redactText(error.stack);
  else if (Array.isArray(error.stack)) out.stack = sanitizeStack(error.stack);
  if (isMapping(error.error)) out.error = sanitizeError(error.error, redactText);
  return out;
}

function sanitizeHeaders(headers, redactText) {
  if (!Array.isArray(headers)) return [];
  return headers
    .filter((header) => isMapping(header) && typeof header.name === "string")
    .map((header) => {
      const name = header.name.toLowerCase();
      if (isRedactedHeaderName(name) || typeof header.value !== "string") return { name: header.name, value: REDACTED };
      return { name: header.name, value: URL_HEADER_NAMES.has(name) ? redactUrl(header.value, redactText) : redactText(header.value) };
    });
}

function sanitizeNamedValues(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(isMapping).map((entry) => ({ name: typeof entry.name === "string" ? entry.name : REDACTED, value: REDACTED }));
}

function redactTitle(title, redactedParamValues, redactText) {
  if (typeof title !== "string") return undefined;
  const valueTitle = VALUE_TITLE_RE.exec(title);
  if (valueTitle) return `${valueTitle[1]} "${REDACTED}"`;
  let result = title;
  for (const value of redactedParamValues) {
    if (typeof value === "string" && value.length > 0) result = result.split(`"${value}"`).join(`"${REDACTED}"`);
  }
  return redactText(result);
}

function sanitizeParams(params, redactText) {
  const out = {};
  const redactedValues = [];
  if (!isMapping(params)) return { params: out, redactedValues };
  for (const [key, value] of Object.entries(params)) {
    if (URL_PARAM_KEYS.has(key) && typeof value === "string") {
      out[key] = redactUrl(value, redactText);
    } else if (key === "key" && typeof value === "string" && NAMED_KEY_RE.test(value)) {
      out[key] = value;
    } else if (key === "position" && isMapping(value)) {
      out[key] = { x: finiteNumber(value.x), y: finiteNumber(value.y) };
    } else if (key === "modifiers" && Array.isArray(value)) {
      out[key] = value.filter((modifier) => typeof modifier === "string" && NAMED_KEY_RE.test(modifier));
    } else if (SAFE_PARAM_KEYS.has(key) && ["number", "boolean"].includes(typeof value)) {
      out[key] = value;
    } else if (SAFE_PARAM_KEYS.has(key) && typeof value === "string") {
      out[key] = redactText(value);
    } else {
      out[key] = isSerializedValue(value) ? redactedSerializedValue() : REDACTED;
      redactedValues.push(...jsonStringLeaves(value));
    }
  }
  return { params: out, redactedValues };
}

// evaluate()/expect() parameters are protocol-serialized values that the trace
// viewer parses; they are replaced by a valid serialized string, not removed.
function isSerializedValue(value) {
  return isMapping(value) && "value" in value && Array.isArray(value.handles);
}

function redactedSerializedValue() {
  return { value: { s: REDACTED }, handles: [] };
}

function isRedactedParam(value) {
  return (
    value === REDACTED ||
    (isMapping(value) &&
      Object.keys(value).length === 2 &&
      Array.isArray(value.handles) &&
      value.handles.length === 0 &&
      isMapping(value.value) &&
      Object.keys(value.value).length === 1 &&
      value.value.s === REDACTED)
  );
}

// ---------------------------------------------------------------------------
// Trace JSONL events (allowlist per event type)
// ---------------------------------------------------------------------------

export const KEPT_EVENT_TYPES = Object.freeze([
  "after",
  "before",
  "console",
  "context-options",
  "error",
  "event",
  "input",
  "log",
  "resource-snapshot",
  "screencast-frame",
]);

const CONTEXT_OPTION_KEYS = [
  "acceptDownloads",
  "bypassCSP",
  "colorScheme",
  "contrast",
  "deviceScaleFactor",
  "forcedColors",
  "hasTouch",
  "ignoreHTTPSErrors",
  "isMobile",
  "javaScriptEnabled",
  "locale",
  "noDefaultViewport",
  "offline",
  "reducedMotion",
  "screen",
  "serviceWorkers",
  "timezoneId",
  "userAgent",
  "viewport",
];

function sanitizeAnnotations(annotations) {
  if (!Array.isArray(annotations)) return undefined;
  return annotations.filter(isMapping).map((annotation) => primitiveOnly(pick(annotation, ["type", "description"])));
}

function sanitizeAttachmentRefs(attachments) {
  if (!Array.isArray(attachments)) return undefined;
  return attachments.filter(isMapping).map((attachment) => ({
    name: typeof attachment.name === "string" ? attachment.name : undefined,
    contentType: typeof attachment.contentType === "string" ? attachment.contentType : undefined,
    file: typeof attachment.file === "string" && ATTACHMENT_MEMBER_RE.test(attachment.file) ? attachment.file : undefined,
    sha1: typeof attachment.sha1 === "string" && /^[0-9a-f]{40}$/.test(attachment.sha1) ? attachment.sha1 : undefined,
  }));
}

function sanitizeResourceSnapshot(snapshot, redactText) {
  if (!isMapping(snapshot)) return undefined;
  const out = primitiveOnly(pick(snapshot, ["pageref", "_frameref", "_monotonicTime", "startedDateTime", "time", "_apiRequest", "_wasAborted", "_wasFulfilled", "_wasContinued"]));
  if (isMapping(snapshot.timings)) {
    out.timings = Object.fromEntries(Object.entries(snapshot.timings).filter(([, value]) => typeof value === "number"));
  }
  if (isMapping(snapshot.request)) {
    const request = snapshot.request;
    out.request = {
      method: typeof request.method === "string" ? request.method : undefined,
      url: redactUrl(request.url, redactText),
      httpVersion: typeof request.httpVersion === "string" ? request.httpVersion : undefined,
      cookies: sanitizeNamedValues(request.cookies),
      headers: sanitizeHeaders(request.headers, redactText),
      queryString: sanitizeNamedValues(request.queryString),
      headersSize: finiteNumber(request.headersSize),
      bodySize: finiteNumber(request.bodySize),
      postData: isMapping(request.postData) && typeof request.postData.mimeType === "string" ? { mimeType: request.postData.mimeType } : undefined,
    };
  }
  if (isMapping(snapshot.response)) {
    const response = snapshot.response;
    out.response = {
      status: finiteNumber(response.status),
      statusText: typeof response.statusText === "string" ? response.statusText : undefined,
      httpVersion: typeof response.httpVersion === "string" ? response.httpVersion : undefined,
      cookies: sanitizeNamedValues(response.cookies),
      headers: sanitizeHeaders(response.headers, redactText),
      content: isMapping(response.content)
        ? { size: finiteNumber(response.content.size), mimeType: typeof response.content.mimeType === "string" ? response.content.mimeType : undefined }
        : undefined,
      redirectURL: typeof response.redirectURL === "string" && response.redirectURL ? redactUrl(response.redirectURL, redactText) : undefined,
      headersSize: finiteNumber(response.headersSize),
      bodySize: finiteNumber(response.bodySize),
      _transferSize: finiteNumber(response._transferSize),
      _failureText: typeof response._failureText === "string" ? response._failureText : undefined,
    };
  }
  return out;
}

function sanitizeEventShape(event, redactText) {
  switch (event.type) {
    case "context-options":
      return {
        ...primitiveOnly(pick(event, ["version", "type", "origin", "browserName", "playwrightVersion", "platform", "wallTime", "monotonicTime", "sdkLanguage", "testIdAttributeName", "testTimeout", "contextId", "title"])),
        annotations: sanitizeAnnotations(event.annotations),
        options: pick(event.options, CONTEXT_OPTION_KEYS),
      };
    case "before": {
      const { params, redactedValues } = sanitizeParams(event.params, redactText);
      return {
        ...primitiveOnly(pick(event, ["type", "callId", "stepId", "parentId", "startTime", "class", "method", "pageId", "group"])),
        title: redactTitle(event.title, redactedValues, redactText),
        apiName: redactTitle(event.apiName, redactedValues, redactText),
        subtitle: redactTitle(event.subtitle, redactedValues, redactText),
        params,
        stack: sanitizeStack(event.stack),
      };
    }
    case "after":
      return {
        ...primitiveOnly(pick(event, ["type", "callId", "endTime"])),
        error: sanitizeError(event.error, redactText),
        annotations: sanitizeAnnotations(event.annotations),
        attachments: sanitizeAttachmentRefs(event.attachments),
      };
    case "input":
      return { ...primitiveOnly(pick(event, ["type", "callId"])), point: primitiveOnly(event.point), box: primitiveOnly(event.box) };
    case "log":
      return primitiveOnly(pick(event, ["type", "callId", "time", "message"]));
    case "event": {
      const params = isMapping(event.params) ? event.params : {};
      return {
        ...primitiveOnly(pick(event, ["type", "time", "class", "method", "pageId"])),
        params: {
          pageId: typeof params.pageId === "string" ? params.pageId : undefined,
          error: event.method === "pageError" ? sanitizeError(params.error, redactText) : undefined,
        },
      };
    }
    case "console":
      // The viewer requires a text field; the console payload itself is dropped.
      return {
        ...primitiveOnly(pick(event, ["type", "messageType", "time", "pageId"])),
        text: REDACTED,
        location: isMapping(event.location)
          ? { url: redactUrl(event.location.url, redactText), lineNumber: finiteNumber(event.location.lineNumber), columnNumber: finiteNumber(event.location.columnNumber) }
          : undefined,
      };
    case "screencast-frame":
      return primitiveOnly(pick(event, ["type", "pageId", "file", "sha1", "width", "height", "timestamp", "frameSwapWallTime"]));
    case "resource-snapshot":
      return { type: event.type, snapshot: sanitizeResourceSnapshot(event.snapshot, redactText) };
    case "error":
      return { ...primitiveOnly(pick(event, ["type", "message"])), stack: sanitizeStack(event.stack) };
    default:
      return null;
  }
}

export function sanitizeEvent(event, redactText) {
  if (!isMapping(event) || !KEPT_EVENT_TYPES.includes(event.type)) return null;
  const shaped = sanitizeEventShape(event, redactText);
  return shaped ? redactStrings(shaped, redactText) : null;
}

function parseJsonl(text) {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(data) {
  return data.length >= 8 && data.subarray(0, 8).equals(PNG_MAGIC);
}

function isJpeg(data) {
  return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
}

function decodeUtf8(data) {
  return new TextDecoder("utf-8", { fatal: true }).decode(data);
}

function markdownAttachmentMembers(entries) {
  const members = new Set();
  for (const entry of entries) {
    if (entry.name !== "test.trace") continue;
    for (const event of parseJsonl(entry.data.toString("utf8"))) {
      for (const attachment of Array.isArray(event?.attachments) ? event.attachments : []) {
        if (!isMapping(attachment) || attachment.contentType !== "text/markdown") continue;
        if (typeof attachment.file === "string") members.add(attachment.file);
        if (typeof attachment.sha1 === "string") members.add(`attachments/${attachment.sha1}`);
      }
    }
  }
  return members;
}

function isJsonlTraceMember(name) {
  return TRACE_MEMBER_RE.test(name) && !name.endsWith(".stacks");
}

export function harvestTraceZip(values, buffer) {
  for (const entry of readZip(buffer)) {
    if (!isJsonlTraceMember(entry.name)) continue;
    for (const event of parseJsonl(entry.data.toString("utf8"))) harvestEvent(values, event);
  }
}

export function sanitizeTraceZip(buffer, redactText) {
  const entries = readZip(buffer);
  const markdownMembers = markdownAttachmentMembers(entries);
  const kept = [];
  const omitted = [];
  for (const entry of entries) {
    const { name, data } = entry;
    if (isJsonlTraceMember(name)) {
      const lines = [];
      for (const event of parseJsonl(data.toString("utf8"))) {
        const sanitized = sanitizeEvent(event, redactText);
        if (sanitized) lines.push(JSON.stringify(sanitized));
      }
      kept.push({ name, data: Buffer.from(lines.length > 0 ? `${lines.join("\n")}\n` : "") });
    } else if (TRACE_MEMBER_RE.test(name)) {
      const stacks = JSON.parse(data.toString("utf8"));
      if (!isMapping(stacks) || !Array.isArray(stacks.files) || !Array.isArray(stacks.stacks)) throw new Error("unexpected stacks shape");
      const files = stacks.files.map((file) => (typeof file === "string" ? file : ""));
      const frames = stacks.stacks.filter((stack) => Array.isArray(stack) && Array.isArray(stack[1])).map(([id, list]) => [
        finiteNumber(id) ?? 0,
        list.filter(Array.isArray).map((frame) => frame.map((part) => (typeof part === "number" ? part : typeof part === "string" ? redactText(part) : null))),
      ]);
      kept.push({ name, data: Buffer.from(JSON.stringify({ files, stacks: frames })) });
    } else if (SCREENCAST_MEMBER_RE.test(name) && isJpeg(data)) {
      kept.push(entry);
    } else if (ATTACHMENT_MEMBER_RE.test(name) && (isPng(data) || isJpeg(data))) {
      kept.push(entry);
    } else if (ATTACHMENT_MEMBER_RE.test(name) && markdownMembers.has(name)) {
      kept.push({ name, data: Buffer.from(redactText(decodeUtf8(data))) });
    } else {
      const group = /^(resources|src|attachments|screencast)\//.exec(name);
      omitted.push({ member: group ? `${group[1]}/*` : "(other)", reason: "not-allowlisted" });
    }
  }
  return { zip: writeZip(kept), keptMembers: kept.map((entry) => entry.name), omitted };
}

export function extractReportPayload(html) {
  const matches = [...html.matchAll(REPORT_TEMPLATE_RE)];
  if (matches.length !== 1) return null;
  return { match: matches[0], zip: Buffer.from(matches[0][1], "base64") };
}

export function harvestReportHtml(values, html) {
  const payload = extractReportPayload(html);
  if (!payload) return;
  for (const entry of readZip(payload.zip)) {
    if (entry.name.endsWith(".json")) harvestReportNode(values, JSON.parse(entry.data.toString("utf8")));
  }
}

const REPORT_DROPPED_KEYS = new Set(["body", "stderr", "stdout"]);

function sanitizeReportNode(node, redactText) {
  if (Array.isArray(node)) return node.map((item) => sanitizeReportNode(item, redactText));
  if (!isMapping(node)) return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (REPORT_DROPPED_KEYS.has(key)) continue;
    if ((key === "title" || key === "subtitle") && typeof value === "string") out[key] = redactTitle(value, [], redactText);
    else out[key] = sanitizeReportNode(value, redactText);
  }
  return out;
}

export function sanitizeReportHtml(html, redactText) {
  const payload = extractReportPayload(html);
  if (!payload) throw new Error("report index.html does not embed exactly one report payload");
  const entries = readZip(payload.zip).map((entry) => {
    if (!/^[A-Za-z0-9._-]+\.json$/.test(entry.name)) throw new Error("unexpected report payload member");
    const sanitized = redactStrings(sanitizeReportNode(JSON.parse(entry.data.toString("utf8")), redactText), redactText);
    return { name: entry.name, data: Buffer.from(JSON.stringify(sanitized)) };
  });
  const encoded = writeZip(entries).toString("base64");
  const start = payload.match.index;
  const end = start + payload.match[0].length;
  return `${html.slice(0, start)}<template id="playwrightReportBase64">data:application/zip;base64,${encoded}</template>${html.slice(end)}`;
}

function redactJsonDocument(node, redactText, key = "") {
  if (typeof node === "string") return SENSITIVE_NAME_RE.test(key) ? REDACTED : STRUCTURAL_KEYS.has(key) ? node : redactText(node);
  if (Array.isArray(node)) return node.map((item) => redactJsonDocument(item, redactText, key));
  if (!isMapping(node)) return node;
  return Object.fromEntries(Object.entries(node).map(([childKey, value]) => [childKey, redactJsonDocument(value, redactText, childKey)]));
}

// ---------------------------------------------------------------------------
// Tree walking
// ---------------------------------------------------------------------------

function listFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const name of readdirSync(directory).sort()) {
      const absolute = join(directory, name);
      const stats = lstatSync(absolute);
      if (stats.isSymbolicLink()) files.push({ absolute, symlink: true });
      else if (stats.isDirectory()) pending.push(absolute);
      else if (stats.isFile()) files.push({ absolute, symlink: false });
    }
  }
  return files.sort((left, right) => left.absolute.localeCompare(right.absolute));
}

function reportRootsIn(files) {
  const roots = new Set();
  for (const file of files) {
    if (file.symlink || basename(file.absolute) !== "index.html") continue;
    try {
      if (extractReportPayload(readFileSync(file.absolute, "utf8"))) roots.add(dirname(file.absolute));
    } catch {
      // Unreadable index.html is omitted later.
    }
  }
  return roots;
}

function isViewerAsset(absolute, reportRoots) {
  return [...reportRoots].some((reportRoot) => isInside(absolute, join(reportRoot, "trace")));
}

export function harvestInputs(inputRoots) {
  const values = new Set();
  for (const inputRoot of inputRoots) {
    if (!existsSync(inputRoot)) continue;
    for (const file of listFiles(inputRoot)) {
      if (file.symlink) continue;
      try {
        if (extname(file.absolute).toLowerCase() === ".zip") harvestTraceZip(values, readFileSync(file.absolute));
        else if (basename(file.absolute) === "index.html") harvestReportHtml(values, readFileSync(file.absolute, "utf8"));
      } catch {
        // Structures that cannot be harvested cannot be sanitized either: the
        // sanitize pass omits them.
      }
    }
  }
  return values;
}

function sanitizeFile(file, context) {
  const { absolute } = file;
  const extension = extname(absolute).toLowerCase();
  if (file.symlink) return { omitted: "symlink" };
  if (isViewerAsset(absolute, context.reportRoots)) {
    return VIEWER_ASSET_EXTENSIONS.has(extension) ? { data: readFileSync(absolute) } : { omitted: "not-allowlisted" };
  }
  if (extension === ".zip") {
    const result = sanitizeTraceZip(readFileSync(absolute), context.redactText);
    return { data: result.zip, members: result.keptMembers, omittedMembers: result.omitted };
  }
  if (basename(absolute) === "index.html" && context.reportRoots.has(dirname(absolute))) {
    return { data: Buffer.from(sanitizeReportHtml(readFileSync(absolute, "utf8"), context.redactText)) };
  }
  if (extension === ".png" || extension === ".jpg" || extension === ".jpeg") {
    const data = readFileSync(absolute);
    return (extension === ".png" ? isPng(data) : isJpeg(data)) ? { data } : { omitted: "bad-magic" };
  }
  if (TEXT_EXTENSIONS.has(extension)) return { data: Buffer.from(context.redactText(decodeUtf8(readFileSync(absolute)))) };
  if (extension === ".json") {
    const parsed = JSON.parse(decodeUtf8(readFileSync(absolute)));
    return { data: Buffer.from(`${JSON.stringify(redactJsonDocument(parsed, context.redactText), null, 2)}\n`) };
  }
  return { omitted: "not-allowlisted" };
}

export function sanitizeArtifacts({ inputs, output, validate = validateSanitizedTree }) {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error("at least one --input is required");
  if (typeof output !== "string" || output.length === 0) throw new Error("--output is required");
  const outputRoot = resolve(output);
  const inputRoots = inputs.map((input) => resolve(input));
  const names = new Set();
  for (const inputRoot of inputRoots) {
    if (isInside(outputRoot, inputRoot) || isInside(inputRoot, outputRoot)) throw new Error("--output must not overlap any --input");
    const name = basename(inputRoot);
    if (names.has(name)) throw new Error("duplicate --input directory name");
    names.add(name);
  }
  if (existsSync(outputRoot) && readdirSync(outputRoot).length > 0) throw new Error("--output must be absent or empty");

  const harvested = harvestInputs(inputRoots);
  const redactText = createRedactor(harvested);
  const manifest = { tool: "playwright-artifact-sanitizer", policy: "allowlist", inputs: [], kept: [], omitted: [] };
  mkdirSync(outputRoot, { recursive: true });

  try {
    for (const inputRoot of inputRoots) {
      const inputName = basename(inputRoot);
      if (!existsSync(inputRoot)) {
        manifest.inputs.push({ name: inputName, present: false });
        continue;
      }
      manifest.inputs.push({ name: inputName, present: true });
      const files = listFiles(inputRoot);
      const context = { redactText, reportRoots: reportRootsIn(files) };
      for (const file of files) {
        const relativeFile = relative(inputRoot, file.absolute);
        const reportedPath = redactText(toPosix(join(inputName, relativeFile)));
        let result;
        try {
          result = sanitizeFile(file, context);
        } catch {
          result = { omitted: "unparsable" };
        }
        if (result.omitted) {
          manifest.omitted.push({ path: reportedPath, reason: result.omitted });
          continue;
        }
        const target = join(outputRoot, inputName, relativeFile);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, result.data);
        manifest.kept.push({ path: reportedPath, members: result.members, omittedMembers: result.omittedMembers });
      }
    }
    writeFileSync(join(outputRoot, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  } catch (error) {
    rmSync(outputRoot, { recursive: true, force: true });
    throw error;
  }

  const violations = validate({ root: outputRoot, harvestedValues: harvested });
  if (violations.length > 0) rmSync(outputRoot, { recursive: true, force: true });
  return { manifest, violations, harvestedCount: harvested.size };
}

// ---------------------------------------------------------------------------
// Independent validation of the staging tree
// ---------------------------------------------------------------------------

const FORBIDDEN_TEXT_PATTERNS = [
  { rule: "sensitive-header-value", pattern: /\b(?:proxy-authorization|authorization|set-cookie|cookie|x-api-key)["']?\s*[:=]\s*(?!\[REDACTED\])\S/i },
  { rule: "credential-scheme-value", pattern: /\b(?:Bearer|Basic|Digest|Token)\s+(?!\[REDACTED\])(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{8,}/ },
  { rule: "query-string-value", pattern: /\?(?!\[REDACTED\])[^\s"'<>`#)\]]*=/ },
  { rule: "sensitive-pair-value", pattern: /\b[A-Za-z0-9_.-]*(?:session|sess|sid|token|auth|csrf|xsrf|secret|passw|jwt|api[_-]?key)[A-Za-z0-9_.-]*=(?!\[REDACTED\])[^;\s&"'<>,]/i },
];
const ALLOWED_OUTPUT_EXTENSIONS = new Set([".json", ".jpeg", ".jpg", ".png", ".zip", ...TEXT_EXTENSIONS, ...VIEWER_ASSET_EXTENSIONS]);
export const FORBIDDEN_PARAM_KEYS = Object.freeze(["arg", "cookies", "expression", "expectedText", "expectedValue", "formData", "headers", "httpCredentials", "jsonData", "multipartData", "postData", "storageState", "text", "value"]);

function checkText(text, context, violations) {
  for (const value of context.harvestedValues) {
    if (text.includes(value)) {
      violations.push({ path: context.path, rule: "harvested-secret-value" });
      return;
    }
  }
  for (const { rule, pattern } of FORBIDDEN_TEXT_PATTERNS) {
    if (pattern.test(text)) {
      violations.push({ path: context.path, rule });
      return;
    }
  }
}

function checkStrings(node, context, violations, key = "") {
  if (typeof node === "string") {
    if (!STRUCTURAL_KEYS.has(key)) checkText(node, context, violations);
  } else if (Array.isArray(node)) {
    for (const item of node) checkStrings(item, context, violations, key);
  } else if (isMapping(node)) {
    for (const [childKey, value] of Object.entries(node)) checkStrings(value, context, violations, childKey);
  }
}

function checkEvent(event, context, violations) {
  if (!isMapping(event) || !KEPT_EVENT_TYPES.includes(event.type)) {
    violations.push({ path: context.path, rule: "event-type-not-allowlisted" });
    return;
  }
  if (event.type === "before" && isMapping(event.params)) {
    for (const key of FORBIDDEN_PARAM_KEYS) {
      if (event.params[key] !== undefined && !isRedactedParam(event.params[key])) violations.push({ path: context.path, rule: `param-${key}-not-redacted` });
    }
  }
  if (event.type === "console" && (event.text !== REDACTED || event.args !== undefined)) violations.push({ path: context.path, rule: "console-text-kept" });
  if (event.type === "event" && isMapping(event.params) && Object.keys(event.params).some((key) => key !== "pageId" && key !== "error")) {
    violations.push({ path: context.path, rule: "event-params-not-allowlisted" });
  }
  if (event.type === "after" && event.result !== undefined) violations.push({ path: context.path, rule: "call-result-kept" });
  if (event.type === "context-options" && isMapping(event.options)) {
    for (const key of Object.keys(event.options)) {
      if (!CONTEXT_OPTION_KEYS.includes(key)) violations.push({ path: context.path, rule: "context-option-not-allowlisted" });
    }
  }
  if (event.type === "resource-snapshot") {
    const snapshot = isMapping(event.snapshot) ? event.snapshot : {};
    for (const side of [snapshot.request, snapshot.response]) {
      if (!isMapping(side)) continue;
      for (const header of Array.isArray(side.headers) ? side.headers : []) {
        if (isMapping(header) && isRedactedHeaderName(String(header.name).toLowerCase()) && header.value !== REDACTED) {
          violations.push({ path: context.path, rule: "non-benign-header-value" });
        }
      }
      for (const entry of [...(Array.isArray(side.cookies) ? side.cookies : []), ...(Array.isArray(side.queryString) ? side.queryString : [])]) {
        if (entry?.value !== REDACTED) violations.push({ path: context.path, rule: "cookie-or-query-value-not-redacted" });
      }
      if (isMapping(side.postData) && Object.keys(side.postData).some((key) => key !== "mimeType")) violations.push({ path: context.path, rule: "request-body-kept" });
      if (isMapping(side.content) && Object.keys(side.content).some((key) => key !== "size" && key !== "mimeType")) violations.push({ path: context.path, rule: "response-body-kept" });
    }
  }
  checkStrings(event, context, violations);
}

export function validateTraceZip(buffer, context) {
  const violations = [];
  let entries;
  try {
    entries = readZip(buffer);
  } catch {
    return [{ path: context.path, rule: "invalid-zip" }];
  }
  for (const entry of entries) {
    const memberContext = { ...context, path: `${context.path}::${entry.name}` };
    try {
      if (isJsonlTraceMember(entry.name)) {
        for (const event of parseJsonl(entry.data.toString("utf8"))) checkEvent(event, memberContext, violations);
      } else if (TRACE_MEMBER_RE.test(entry.name)) {
        const stacks = JSON.parse(entry.data.toString("utf8"));
        checkStrings(stacks.stacks, memberContext, violations);
      } else if (SCREENCAST_MEMBER_RE.test(entry.name)) {
        if (!isJpeg(entry.data)) violations.push({ path: memberContext.path, rule: "screencast-not-jpeg" });
      } else if (ATTACHMENT_MEMBER_RE.test(entry.name)) {
        if (!isPng(entry.data) && !isJpeg(entry.data)) checkText(decodeUtf8(entry.data), memberContext, violations);
      } else {
        violations.push({ path: memberContext.path, rule: "member-not-allowlisted" });
      }
    } catch {
      violations.push({ path: memberContext.path, rule: "unparsable-member" });
    }
  }
  return violations;
}

export function validateSanitizedTree({ root, harvestedValues }) {
  if (!existsSync(root)) return [{ path: ".", rule: "output-missing" }];
  const violations = [];
  const values = [...harvestedValues];
  const files = listFiles(root);
  const reportRoots = reportRootsIn(files);
  for (const file of files) {
    const path = toPosix(relative(root, file.absolute));
    const context = { path, harvestedValues: values };
    const extension = extname(file.absolute).toLowerCase();
    if (file.symlink) {
      violations.push({ path, rule: "symlink" });
      continue;
    }
    if (!ALLOWED_OUTPUT_EXTENSIONS.has(extension)) {
      violations.push({ path, rule: "extension-not-allowlisted" });
      continue;
    }
    const data = readFileSync(file.absolute);
    try {
      if (isViewerAsset(file.absolute, reportRoots)) {
        if (!VIEWER_ASSET_EXTENSIONS.has(extension)) violations.push({ path, rule: "viewer-asset-extension" });
      } else if (extension === ".zip") {
        violations.push(...validateTraceZip(data, context));
      } else if (extension === ".png") {
        if (!isPng(data)) violations.push({ path, rule: "bad-magic" });
      } else if (extension === ".jpg" || extension === ".jpeg") {
        if (!isJpeg(data)) violations.push({ path, rule: "bad-magic" });
      } else if (extension === ".json") {
        checkStrings(JSON.parse(decodeUtf8(data)), context, violations);
      } else if (TEXT_EXTENSIONS.has(extension)) {
        checkText(decodeUtf8(data), context, violations);
      } else if (basename(file.absolute) === "index.html" && reportRoots.has(dirname(file.absolute))) {
        for (const entry of readZip(extractReportPayload(data.toString("utf8")).zip)) {
          checkStrings(JSON.parse(entry.data.toString("utf8")), { ...context, path: `${path}::${entry.name}` }, violations);
        }
      } else {
        violations.push({ path, rule: "file-outside-report-viewer" });
      }
    } catch {
      violations.push({ path, rule: "unparsable-file" });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArguments(argv) {
  const inputs = [];
  let output = "";
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if ((flag !== "--input" && flag !== "--output") || typeof value !== "string" || value.length === 0 || value.startsWith("--")) {
      throw new Error("usage: --output <staging-dir> --input <raw-dir> [--input <raw-dir> ...]");
    }
    if (flag === "--input") inputs.push(value);
    else output = value;
  }
  return { inputs, output };
}

export function runCli(argv) {
  let result;
  try {
    result = sanitizeArtifacts(parseArguments(argv));
  } catch (error) {
    console.error(`playwright-artifact-sanitizer: FAILED (${error instanceof Error ? error.message : "unknown error"}); nothing may be uploaded.`);
    return 1;
  }
  if (result.violations.length > 0) {
    console.error(`playwright-artifact-sanitizer: FAILED validation with ${result.violations.length} violation(s); staging directory deleted.`);
    for (const violation of result.violations.slice(0, 50)) console.error(`  ${violation.rule}: ${violation.path}`);
    return 1;
  }
  console.log(`playwright-artifact-sanitizer: PASSED kept=${result.manifest.kept.length} omitted=${result.manifest.omitted.length} harvested-values=${result.harvestedCount}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runCli(process.argv.slice(2));
}
