// Pure, side-effect-free engine + input adapters for the env-value-leak
// sub-check of `security:public-surface` (VET-11 / WBR-05).
//
// This module exists so the leak-matching engine can be exercised directly
// by tests (positive/negative fixtures) without importing the CLI script
// (`audit-public-devtools-surface.mjs`), which runs its full audit as a
// top-level-await side effect and is not safe to `import` from a test.
//
// Design split (VET-11 root cause: the check silently no-ops in CI because
// `.env` files never exist there):
//   - ENGINE: `scanEnvValueLeaksInFile` — matches a set of {key, value}
//     candidates against a file's text, independent of where they came from.
//   - ADAPTERS: `readEnvEntries` (.env files, local-only), plus
//     `readAllowlistedProcessEnvEntries` (an explicit, closed allowlist of
//     env var NAMES — never `Object.keys(process.env)` wholesale), plus
//     `readCanaryEntry` (a synthetic, non-secret value that is ALWAYS
//     present, so the engine always has at least one real candidate to
//     evaluate, in CI or anywhere else, regardless of whether real secrets
//     are available as files or env vars).
//   - `readEnvValueSources` composes all three adapters.
//   - `validateEnvValueSourcesEvaluated` turns "nothing to evaluate" from a
//     silent PASS into an explicit, reportable failure reason.

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";

export const ENV_FILES = [".env", ".env.local", "frontend/.env.local"];

export const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".css",
  ".txt",
  ".svg",
  ".xml",
  ".map",
  ".md",
  ".yml",
  ".yaml",
  ".webmanifest",
]);

// Same shape as the identifier-marker allowlist the CLI script already
// declares; reused here (not duplicated with different names) so the
// env-value adapter recognizes exactly the names the project already treats
// as sensitive-shaped, not an invented list.
export const EXPLICIT_BLOCKED_IDENTIFIERS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "DATABASE_URL",
  "POSTGRES",
  "SMTP_PASS",
  "SMTP_USER",
  "GMAIL_API_REFRESH_TOKEN",
  "GMAIL_API_CLIENT_SECRET",
  "SESSION_SECRET",
  "JWT_SECRET",
  "ADMIN_COOKIE_NAME",
  "PARTICULAR_COOKIE_NAME",
  "SERVICE_ROLE",
  "PRIVATE_KEY",
  "ACCESS_TOKEN",
  "REFRESH_TOKEN",
  "PASSWORD",
  "SECRET",
  "TOKEN",
];

export const SENSITIVE_ENV_KEY_REGEX =
  /(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL|DATABASE_URL|POSTGRES|SMTP_PASS|SMTP_USER|GMAIL_API_REFRESH_TOKEN|GMAIL_API_CLIENT_SECRET|SESSION_SECRET|JWT_SECRET|ADMIN_COOKIE_NAME|PARTICULAR_COOKIE_NAME|SERVICE_ROLE|PRIVATE_KEY|ACCESS_TOKEN|REFRESH_TOKEN|PASSWORD|SECRET|TOKEN|API_KEY)/i;

const DEFAULT_STREAM_CHUNK_SIZE = 64 * 1024;

function getPositiveInteger(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export const STREAM_CHUNK_SIZE = getPositiveInteger(
  process.env.PUBLIC_SURFACE_STREAM_CHUNK_SIZE,
  DEFAULT_STREAM_CHUNK_SIZE,
);

// A single explicit env var name that, if set, overrides the default
// synthetic canary value. Never read via a wholesale `process.env` scan.
export const CANARY_ENV_VALUE_VAR = "PUBLIC_SURFACE_CANARY_VALUE";

// Deliberately synthetic and distinctive — never a real credential. Long
// enough to pass `isSearchableSecretValue`, and its key is chosen to match
// `SENSITIVE_ENV_KEY_REGEX` (contains "SECRET") so it exercises the exact
// same filtering path a real secret would, rather than bypassing it.
export const DEFAULT_CANARY_SECRET_VALUE = "vetneb_public_surface_canary_7f93c2a5d1";
export const CANARY_KEY = "PUBLIC_SURFACE_CANARY_SECRET";

export async function streamTextWindows(
  relativePath,
  carryoverLength,
  onWindow,
  { root = process.cwd(), chunkSize = STREAM_CHUNK_SIZE } = {},
) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    return false;
  }

  const extension = extname(relativePath).toLowerCase();
  if (extension && !TEXT_EXTENSIONS.has(extension)) {
    return false;
  }

  const info = statSync(absolutePath);
  if (!info.isFile()) {
    return false;
  }

  const effectiveCarryoverLength = Math.max(0, carryoverLength);
  const decoder = new StringDecoder("utf8");
  let carryover = "";
  let isBinary = false;

  const stream = createReadStream(absolutePath, {
    highWaterMark: chunkSize,
  });

  for await (const chunk of stream) {
    if (chunk.includes(0)) {
      isBinary = true;
      break;
    }

    const chunkText = decoder.write(chunk).replace(/\r\n/g, "\n");
    if (chunkText.length === 0 && carryover.length === 0) {
      continue;
    }

    const window = carryover + chunkText;
    if (window.length > 0) {
      onWindow(window);
    }

    carryover = effectiveCarryoverLength > 0 ? window.slice(-effectiveCarryoverLength) : "";
  }

  if (isBinary) {
    return false;
  }

  const tail = decoder.end().replace(/\r\n/g, "\n");
  if (tail.length > 0) {
    const window = carryover + tail;
    if (window.length > 0) {
      onWindow(window);
    }
  }

  return true;
}

export function normalizeEnvValue(rawValue) {
  const unquoted = rawValue.trim();
  if (
    (unquoted.startsWith('"') && unquoted.endsWith('"')) ||
    (unquoted.startsWith("'") && unquoted.endsWith("'"))
  ) {
    return unquoted.slice(1, -1);
  }

  const hashIndex = unquoted.indexOf(" #");
  if (hashIndex > -1) {
    return unquoted.slice(0, hashIndex).trim();
  }

  return unquoted;
}

export function readEnvEntries({ root = process.cwd() } = {}) {
  const entries = [];

  for (const envFile of ENV_FILES) {
    const absolutePath = resolve(root, envFile);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const content = readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
      if (!match) {
        continue;
      }

      const key = match[1];
      const rawValue = match[2];
      const value = normalizeEnvValue(rawValue);
      entries.push({ key, value, sourceFile: envFile });
    }
  }

  return entries;
}

export function isSensitiveEnvKey(key) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    return false;
  }
  return SENSITIVE_ENV_KEY_REGEX.test(key);
}

export function isSearchableSecretValue(value) {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length < 8) {
    return false;
  }

  const lower = trimmed.toLowerCase();

  if (
    lower === "changeme" ||
    lower === "change-me" ||
    lower === "example" ||
    lower === "test" ||
    lower === "dummy"
  ) {
    return false;
  }

  if (lower.includes("localhost") || lower.includes("127.0.0.1")) {
    return false;
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return false;
  }

  return true;
}

export async function scanEnvValueLeaksInFile(relativePath, envEntries, options = {}) {
  if (envEntries.length === 0) {
    return [];
  }

  const entriesByValue = new Map();
  for (const entry of envEntries) {
    if (!entriesByValue.has(entry.value)) {
      entriesByValue.set(entry.value, []);
    }
    entriesByValue.get(entry.value).push(entry);
  }

  const pendingValues = new Set(entriesByValue.keys());
  const leakedEntries = [];

  let carryoverLength = 0;
  for (const value of pendingValues) {
    carryoverLength = Math.max(carryoverLength, Math.max(0, value.length - 1));
  }

  const scanned = await streamTextWindows(
    relativePath,
    carryoverLength,
    (window) => {
      if (pendingValues.size === 0) {
        return;
      }

      for (const value of [...pendingValues]) {
        if (!window.includes(value)) {
          continue;
        }

        leakedEntries.push(...(entriesByValue.get(value) ?? []));
        pendingValues.delete(value);
      }
    },
    options,
  );

  if (!scanned) {
    return [];
  }

  return leakedEntries;
}

export function readCanaryEntry({ env = process.env } = {}) {
  const injected = env[CANARY_ENV_VALUE_VAR];
  const value =
    typeof injected === "string" && injected.trim().length >= 8
      ? injected.trim()
      : DEFAULT_CANARY_SECRET_VALUE;

  return { key: CANARY_KEY, value, sourceFile: "synthetic-canary" };
}

export function readAllowlistedProcessEnvEntries({ env = process.env } = {}) {
  const entries = [];

  for (const name of EXPLICIT_BLOCKED_IDENTIFIERS) {
    const value = env[name];
    if (typeof value === "string" && value.trim().length > 0) {
      entries.push({ key: name, value: value.trim(), sourceFile: "process.env" });
    }
  }

  return entries;
}

export function readEnvValueSources({ root = process.cwd(), env = process.env } = {}) {
  return [
    ...readEnvEntries({ root }),
    ...readAllowlistedProcessEnvEntries({ env }),
    readCanaryEntry({ env }),
  ];
}

export function selectSensitiveEntries(entries) {
  return entries.filter(
    (entry) => isSensitiveEnvKey(entry.key) && isSearchableSecretValue(entry.value),
  );
}

// Closes VET-11's exact defect: reaching "nothing to evaluate" must never be
// representable as a silent PASS. Because `readEnvValueSources` always
// appends the synthetic canary, `entries.length === 0` can only happen if
// that adapter itself was removed; `sensitiveEntries.length === 0` can only
// happen if the filtering logic was weakened to exclude the canary. Both are
// treated as a reportable failure, not a note.
export function validateEnvValueSourcesEvaluated(entries, sensitiveEntries) {
  if (entries.length === 0) {
    return "env-value leak matching produced zero candidate sources: no .env files, no allowlisted process.env vars, and the synthetic canary adapter is missing.";
  }
  if (sensitiveEntries.length === 0) {
    return "env-value leak matching filtered out every candidate source, including the synthetic canary, before evaluating a single value.";
  }
  return null;
}
