#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

const ROOT = process.cwd();
const JSON_OUTPUT = process.argv.includes("--json");

const FOOTER_PATH = "frontend/src/components/layout/Footer.tsx";
const KNOWN_SERVER_ONLY_FRONTEND_FILES = new Set(["frontend/src/middleware.ts"]);

const SURFACE_TARGETS = [
  { path: "frontend/src", label: "frontend/src", public: true, type: "dir" },
  { path: "frontend/public", label: "frontend/public", public: true, type: "dir" },
  {
    path: "frontend/.next/static",
    label: "frontend/.next/static",
    public: true,
    type: "dir",
    optional: true,
  },
  {
    path: "frontend/.next/server/app",
    label: "frontend/.next/server/app",
    public: false,
    type: "dir",
    optional: true,
  },
  {
    path: "frontend/.next/prerender-manifest.json",
    label: "frontend/.next/prerender-manifest.json",
    public: true,
    type: "file",
    optional: true,
  },
  {
    path: "frontend/.next/routes-manifest.json",
    label: "frontend/.next/routes-manifest.json",
    public: true,
    type: "file",
    optional: true,
  },
];

const ENV_FILES = [".env", ".env.local", "frontend/.env.local"];

const TEXT_EXTENSIONS = new Set([
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

const FRONTEND_CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const EXPLICIT_BLOCKED_IDENTIFIERS = [
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

const EXPLICIT_IDENTIFIER_REGEXES = EXPLICIT_BLOCKED_IDENTIFIERS.map((name) => ({
  name,
  regex: new RegExp(`\\b${escapeRegex(name)}\\b`, "i"),
}));

const UPPERCASE_SENSITIVE_IDENTIFIER_REGEX =
  /\b(?!NEXT_PUBLIC_)[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|SERVICE_ROLE|COOKIE_NAME)\b/g;
const NON_PUBLIC_API_KEY_IDENTIFIER_REGEX = /\b(?!NEXT_PUBLIC_)[A-Z][A-Z0-9_]*API_KEY\b/g;
const CONSOLE_REGEX = /\bconsole\.(log|debug|table)\s*\(/g;
const STORAGE_CALL_REGEX =
  /\b(localStorage|sessionStorage)\.(setItem|getItem|removeItem)\s*\(\s*(["'`])([^"'`\n]+)\2/g;
const STORAGE_INDEX_ASSIGNMENT_REGEX =
  /\b(localStorage|sessionStorage)\s*\[\s*(["'`])([^"'`\n]+)\2\s*\]\s*=/g;
const STORAGE_SET_ITEM_LINE_REGEX = /\b(localStorage|sessionStorage)\.setItem\s*\(/;
const DANGEROUSLY_SET_INNER_HTML_REGEX = /\bdangerouslySetInnerHTML\b/g;
const DATA_ATTR_REGEX = /\bdata-([a-zA-Z0-9:_-]+)\s*=/g;
const ATTR_LITERAL_REGEX =
  /\b(aria-label|title|alt)\s*=\s*(?:(["'])(.*?)\2|\{\s*(["'])(.*?)\4\s*\}|\{\s*`([^`]+)`\s*\})/gms;
const ATTR_DYNAMIC_REF_REGEX = /\b(aria-label|title|alt)\s*=\s*\{\s*([A-Za-z_$][A-Za-z0-9_$.]*)\s*\}/g;
const NEXT_LINK_IMPORT_REGEX = /from\s+["']next\/link["']/;
const LINK_TAG_REGEX = /<Link\b/;
const ANCHOR_TAG_REGEX = /<a\b/;
const IFRAME_TAG_REGEX = /<iframe\b/;
const JSON_LD_GUARD_REGEX = /application\/ld\+json/;
const JSON_STRINGIFY_REGEX = /JSON\.stringify\s*\(/;

const SENSITIVE_STORAGE_KEY_REGEX =
  /(token|secret|password|passwd|session|auth|jwt|cookie|email|mail|phone|telefono|cel|dni|document|ssn|profile|personal|pii|access|refresh)/i;
const SENSITIVE_API_RESPONSE_REGEX =
  /JSON\.stringify\s*\([^)]*(response|payload|result|data|body|json)/i;
const SENSITIVE_DATA_ATTRIBUTE_NAME_REGEX =
  /(token|secret|password|session|cookie|api[-_]?key|private|refresh|access[_-]?token|jwt|email|mail|phone|telefono|cel|dni|document|ssn)/i;
const SENSITIVE_ATTRIBUTE_VALUE_REGEX =
  /(bearer\s+[a-z0-9._-]{10,}|token\s*[=:]|secret\s*[=:]|password\s*[=:]|api[_-]?key\s*[=:]|jwt\s*[=:]|cookie\s*[=:]|access[_-]?token|refresh[_-]?token|session[_-]?id)/i;
const SENSITIVE_ATTRIBUTE_REF_NAME_REGEX =
  /(token|secret|password|session|cookie|apiKey|api_key|privateKey|jwt|accessToken|refreshToken|email|phone|dni)/i;
const SENSITIVE_ENV_KEY_REGEX =
  /(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL|DATABASE_URL|POSTGRES|SMTP_PASS|SMTP_USER|GMAIL_API_REFRESH_TOKEN|GMAIL_API_CLIENT_SECRET|SESSION_SECRET|JWT_SECRET|ADMIN_COOKIE_NAME|PARTICULAR_COOKIE_NAME|SERVICE_ROLE|PRIVATE_KEY|ACCESS_TOKEN|REFRESH_TOKEN|PASSWORD|SECRET|TOKEN|API_KEY)/i;

const findings = [];
const notes = [];

const discoveredSurfaces = collectSurfaces();
runAudit();

const publicFailures = findings.filter((item) => item.publicExposure);
const summary = {
  ok: publicFailures.length === 0,
  findingsCount: findings.length,
  publicFindingsCount: publicFailures.length,
  notes,
  findings,
};

if (JSON_OUTPUT) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  printHumanReport(summary);
}

if (!summary.ok) {
  process.exitCode = 1;
}

function runAudit() {
  auditSourceMaps();
  auditFrontendConsole();
  auditStorageUsage();
  auditDangerouslySetInnerHtml();
  auditDataAttributes();
  auditSensitiveAccessibilityAttributes();
  auditNavigationContract();
  auditSensitiveIdentifiers();
  auditEnvValueLeaks();
}

function collectSurfaces() {
  const surfaces = [];

  for (const target of SURFACE_TARGETS) {
    const absolutePath = resolve(ROOT, target.path);
    const exists = existsSync(absolutePath);

    if (!exists) {
      if (!target.optional) {
        addFinding({
          rule: "missing-surface",
          file: target.path,
          message: `Required surface ${target.path} does not exist.`,
          publicExposure: true,
        });
      } else {
        if (target.path === "frontend/.next/static") {
          notes.push(
            "frontend/.next/static is missing. Build frontend first to audit built public assets: pnpm --dir frontend build, then pnpm security:public-surface.",
          );
        } else {
          notes.push(`Optional surface not found: ${target.path}`);
        }
      }
      continue;
    }

    if (target.type === "dir") {
      const files = collectDirectoryFiles(absolutePath).map(toRelativePath);
      surfaces.push({ ...target, files });
      continue;
    }

    surfaces.push({ ...target, files: [toRelativePath(absolutePath)] });
  }

  return surfaces;
}

function auditSourceMaps() {
  const staticSurface = discoveredSurfaces.find(
    (surface) => surface.path === "frontend/.next/static",
  );

  if (!staticSurface) {
    return;
  }

  for (const file of staticSurface.files) {
    if (extname(file).toLowerCase() === ".map") {
      addFinding({
        rule: "public-source-maps",
        file,
        message: "Public source map detected in frontend/.next/static.",
        publicExposure: true,
      });
    }
  }
}

function auditFrontendConsole() {
  const frontendSrcSurface = discoveredSurfaces.find(
    (surface) => surface.path === "frontend/src",
  );

  if (!frontendSrcSurface) {
    return;
  }

  for (const file of frontendSrcSurface.files) {
    if (!FRONTEND_CODE_EXTENSIONS.has(extname(file).toLowerCase())) {
      continue;
    }

    if (isTestLikeFile(file)) {
      continue;
    }

    const content = readText(file);

    if (!content) {
      continue;
    }

    const matches = matchAll(CONSOLE_REGEX, content);
    for (const match of matches) {
      addFinding({
        rule: "console-in-frontend-src",
        file,
        line: getLineFromIndex(content, match.index),
        message: `Forbidden console.${match.groups[1]} found in frontend/src.`,
        publicExposure: true,
      });
    }
  }
}

function auditStorageUsage() {
  const frontendSrcSurface = discoveredSurfaces.find(
    (surface) => surface.path === "frontend/src",
  );

  if (!frontendSrcSurface) {
    return;
  }

  for (const file of frontendSrcSurface.files) {
    if (!FRONTEND_CODE_EXTENSIONS.has(extname(file).toLowerCase())) {
      continue;
    }

    const content = readText(file);
    if (!content) {
      continue;
    }

    for (const match of matchAll(STORAGE_CALL_REGEX, content)) {
      const storageKey = match.groups[3];
      if (SENSITIVE_STORAGE_KEY_REGEX.test(storageKey)) {
        addFinding({
          rule: "sensitive-storage-key",
          file,
          line: getLineFromIndex(content, match.index),
          message: `Sensitive storage key "${storageKey}" used with ${match.groups[1]}.`,
          publicExposure: true,
        });
      }
    }

    for (const match of matchAll(STORAGE_INDEX_ASSIGNMENT_REGEX, content)) {
      const storageKey = match.groups[3];
      if (SENSITIVE_STORAGE_KEY_REGEX.test(storageKey)) {
        addFinding({
          rule: "sensitive-storage-key",
          file,
          line: getLineFromIndex(content, match.index),
          message: `Sensitive storage key "${storageKey}" assigned through ${match.groups[1]} index accessor.`,
          publicExposure: true,
        });
      }
    }

    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!STORAGE_SET_ITEM_LINE_REGEX.test(line)) {
        continue;
      }

      if (SENSITIVE_API_RESPONSE_REGEX.test(line)) {
        addFinding({
          rule: "storage-full-api-response",
          file,
          line: index + 1,
          message:
            "Storage write looks like full API response/payload persistence in public frontend code.",
          publicExposure: true,
        });
      }
    }
  }
}

function auditDangerouslySetInnerHtml() {
  const frontendSrcSurface = discoveredSurfaces.find(
    (surface) => surface.path === "frontend/src",
  );

  if (!frontendSrcSurface) {
    return;
  }

  for (const file of frontendSrcSurface.files) {
    if (!FRONTEND_CODE_EXTENSIONS.has(extname(file).toLowerCase())) {
      continue;
    }

    const content = readText(file);
    if (!content) {
      continue;
    }

    for (const match of matchAll(DANGEROUSLY_SET_INNER_HTML_REGEX, content)) {
      const snippet = getWindow(content, match.index, 220);
      const justified =
        (JSON_LD_GUARD_REGEX.test(snippet) && JSON_STRINGIFY_REGEX.test(snippet)) ||
        /security-reviewed-dangerouslysetinnerhtml/i.test(snippet);

      if (!justified) {
        addFinding({
          rule: "dangerously-set-inner-html",
          file,
          line: getLineFromIndex(content, match.index),
          message:
            "dangerouslySetInnerHTML found without JSON-LD safeguard or explicit security review marker.",
          publicExposure: true,
        });
      }
    }
  }
}

function auditDataAttributes() {
  const frontendSrcSurface = discoveredSurfaces.find(
    (surface) => surface.path === "frontend/src",
  );

  if (!frontendSrcSurface) {
    return;
  }

  for (const file of frontendSrcSurface.files) {
    const content = readText(file);
    if (!content) {
      continue;
    }

    for (const match of matchAll(DATA_ATTR_REGEX, content)) {
      const attributeName = match.groups[1];
      if (SENSITIVE_DATA_ATTRIBUTE_NAME_REGEX.test(attributeName)) {
        addFinding({
          rule: "sensitive-data-attribute-name",
          file,
          line: getLineFromIndex(content, match.index),
          message: `Sensitive data-* attribute detected: data-${attributeName}.`,
          publicExposure: true,
        });
      }
    }
  }
}

function auditSensitiveAccessibilityAttributes() {
  const frontendSrcSurface = discoveredSurfaces.find(
    (surface) => surface.path === "frontend/src",
  );

  if (!frontendSrcSurface) {
    return;
  }

  for (const file of frontendSrcSurface.files) {
    const content = readText(file);
    if (!content) {
      continue;
    }

    for (const match of matchAll(ATTR_LITERAL_REGEX, content)) {
      const attributeName = match.groups[1];
      const attributeValue = match.groups[3] ?? match.groups[5] ?? match.groups[6] ?? "";

      if (SENSITIVE_ATTRIBUTE_VALUE_REGEX.test(attributeValue)) {
        addFinding({
          rule: "sensitive-a11y-attribute-value",
          file,
          line: getLineFromIndex(content, match.index),
          message: `${attributeName} contains a sensitive-looking value pattern.`,
          publicExposure: true,
        });
      }
    }

    for (const match of matchAll(ATTR_DYNAMIC_REF_REGEX, content)) {
      const attributeName = match.groups[1];
      const referenceName = match.groups[2];
      if (SENSITIVE_ATTRIBUTE_REF_NAME_REGEX.test(referenceName)) {
        addFinding({
          rule: "sensitive-a11y-attribute-reference",
          file,
          line: getLineFromIndex(content, match.index),
          message: `${attributeName} references sensitive identifier "${referenceName}".`,
          publicExposure: true,
        });
      }
    }
  }
}

function auditNavigationContract() {
  const frontendSrcSurface = discoveredSurfaces.find(
    (surface) => surface.path === "frontend/src",
  );

  if (!frontendSrcSurface) {
    return;
  }

  const files = frontendSrcSurface.files.filter((file) => {
    const extension = extname(file).toLowerCase();
    return extension === ".ts" || extension === ".tsx" || extension === ".js" || extension === ".jsx";
  });

  const nextLinkImports = [];
  const linkTags = [];
  const anchors = [];
  const iframes = [];

  for (const file of files) {
    const content = readText(file);
    if (!content) {
      continue;
    }

    if (NEXT_LINK_IMPORT_REGEX.test(content)) {
      nextLinkImports.push(file);
    }
    if (LINK_TAG_REGEX.test(content)) {
      linkTags.push(file);
    }
    if (ANCHOR_TAG_REGEX.test(content)) {
      anchors.push(file);
    }
    if (IFRAME_TAG_REGEX.test(content)) {
      iframes.push(file);
    }
  }

  if (nextLinkImports.length > 0) {
    addFinding({
      rule: "next-link-imports-contract",
      file: "frontend/src",
      message: `NEXT_LINK_IMPORTS must stay 0. Found in: ${nextLinkImports.join(", ")}`,
      publicExposure: true,
    });
  }

  if (linkTags.length > 0) {
    addFinding({
      rule: "link-tag-contract",
      file: "frontend/src",
      message: `LINK_TAGS must stay 0. Found in: ${linkTags.join(", ")}`,
      publicExposure: true,
    });
  }

  if (anchors.length > 0) {
    addFinding({
      rule: "anchor-tag-contract",
      file: "frontend/src",
      message: `ANCHOR_HITS must stay 0. Found in: ${anchors.join(", ")}`,
      publicExposure: true,
    });
  }

  if (iframes.length !== 1 || iframes[0] !== FOOTER_PATH) {
    addFinding({
      rule: "iframe-contract",
      file: "frontend/src",
      message: `IFRAME_HITS must be exactly 1 in ${FOOTER_PATH}. Found: ${iframes.join(", ") || "(none)"}`,
      publicExposure: true,
    });
  } else {
    const footerContent = readText(FOOTER_PATH);
    if (!footerContent) {
      addFinding({
        rule: "footer-contract",
        file: FOOTER_PATH,
        message: "Could not read Footer file required by iframe contract.",
        publicExposure: true,
      });
      return;
    }

    const requiredMarkers = [
      '<iframe',
      'aria-hidden="true"',
      "tabIndex={-1}",
      "pointer-events-none",
      "<PublicExternalControl",
    ];

    for (const marker of requiredMarkers) {
      if (!footerContent.includes(marker)) {
        addFinding({
          rule: "footer-map-contract",
          file: FOOTER_PATH,
          message: `Footer map contract marker missing: ${marker}`,
          publicExposure: true,
        });
      }
    }
  }
}

function auditSensitiveIdentifiers() {
  for (const surface of discoveredSurfaces) {
    for (const file of surface.files) {
      const content = readText(file);
      if (!content) {
        continue;
      }

      for (const item of EXPLICIT_IDENTIFIER_REGEXES) {
        if (!item.regex.test(content)) {
          continue;
        }

        if (item.name === "TOKEN" || item.name === "SECRET" || item.name === "PASSWORD") {
          continue;
        }

        addFinding({
          rule: "explicit-sensitive-identifier",
          file,
          message: `Sensitive identifier marker "${item.name}" is present.`,
          publicExposure: surface.public && !isKnownServerOnlyFrontendFile(file),
        });
      }

      const uppercaseMatches = matchAll(UPPERCASE_SENSITIVE_IDENTIFIER_REGEX, content)
        .map((match) => match.groups[0])
        .filter((name) => !name.startsWith("NEXT_PUBLIC_"));

      for (const identifier of unique(uppercaseMatches)) {
        addFinding({
          rule: "uppercase-sensitive-identifier",
          file,
          message: `Sensitive uppercase identifier marker "${identifier}" is present.`,
          publicExposure: surface.public && !isKnownServerOnlyFrontendFile(file),
        });
      }

      const nonPublicApiKeys = matchAll(NON_PUBLIC_API_KEY_IDENTIFIER_REGEX, content)
        .map((match) => match.groups[0])
        .filter((name) => !name.startsWith("NEXT_PUBLIC_"));

      for (const identifier of unique(nonPublicApiKeys)) {
        addFinding({
          rule: "non-public-api-key-identifier",
          file,
          message: `API_KEY identifier without NEXT_PUBLIC prefix found: "${identifier}".`,
          publicExposure: surface.public && !isKnownServerOnlyFrontendFile(file),
        });
      }
    }
  }
}

function auditEnvValueLeaks() {
  const envEntries = readEnvEntries();
  if (envEntries.length === 0) {
    notes.push("No .env, .env.local or frontend/.env.local file found for env-value leak matching.");
    return;
  }

  const publicFiles = [];
  for (const surface of discoveredSurfaces) {
    if (!surface.public) {
      continue;
    }
    publicFiles.push(...surface.files);
  }

  for (const entry of envEntries) {
    if (!isSensitiveEnvKey(entry.key)) {
      continue;
    }

    if (!isSearchableSecretValue(entry.value)) {
      continue;
    }

    for (const file of publicFiles) {
      if (isKnownServerOnlyFrontendFile(file)) {
        continue;
      }

      const content = readText(file);
      if (!content) {
        continue;
      }

      if (content.includes(entry.value)) {
        addFinding({
          rule: "env-sensitive-value-leak",
          file,
          message: `Sensitive env value leaked from ${entry.sourceFile}: variable "${entry.key}" appears in public surface.`,
          publicExposure: true,
        });
      }
    }
  }
}

function readEnvEntries() {
  const entries = [];

  for (const envFile of ENV_FILES) {
    const absolutePath = resolve(ROOT, envFile);
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

function isSensitiveEnvKey(key) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    return false;
  }
  return SENSITIVE_ENV_KEY_REGEX.test(key);
}

function isSearchableSecretValue(value) {
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

function normalizeEnvValue(rawValue) {
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

function collectDirectoryFiles(absoluteRoot) {
  const files = [];

  function walk(currentPath) {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absoluteEntryPath = resolve(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(absoluteEntryPath);
        continue;
      }
      files.push(absoluteEntryPath);
    }
  }

  walk(absoluteRoot);
  return files;
}

function readText(relativePath) {
  const absolutePath = resolve(ROOT, relativePath);
  if (!existsSync(absolutePath)) {
    return null;
  }

  const extension = extname(relativePath).toLowerCase();
  if (extension && !TEXT_EXTENSIONS.has(extension)) {
    return null;
  }

  const info = statSync(absolutePath);
  if (!info.isFile()) {
    return null;
  }

  if (info.size > 6 * 1024 * 1024) {
    notes.push(`Skipped oversized file (>6MB): ${relativePath}`);
    return null;
  }

  const buffer = readFileSync(absolutePath);
  if (buffer.includes(0)) {
    return null;
  }

  return buffer.toString("utf8").replace(/\r\n/g, "\n");
}

function isTestLikeFile(relativePath) {
  return /(^|[\\/])(__tests__|test|tests)([\\/]|$)|\.(test|spec)\.[cm]?[jt]sx?$/i.test(
    relativePath,
  );
}

function toRelativePath(absolutePath) {
  return relative(ROOT, absolutePath).replace(/\\/g, "/");
}

function isKnownServerOnlyFrontendFile(file) {
  return KNOWN_SERVER_ONLY_FRONTEND_FILES.has(file);
}

function addFinding({ rule, file, message, line, publicExposure }) {
  findings.push({
    rule,
    file,
    line: line ?? null,
    publicExposure: publicExposure ?? true,
    message,
  });
}

function getLineFromIndex(content, index) {
  if (index <= 0) {
    return 1;
  }
  return content.slice(0, index).split("\n").length;
}

function getWindow(content, index, radius) {
  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + radius);
  return content.slice(start, end);
}

function unique(values) {
  return [...new Set(values)];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchAll(regex, content) {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const localRegex = new RegExp(regex.source, flags);
  const matches = [];
  let match = localRegex.exec(content);

  while (match) {
    const groups = [match[0], ...match.slice(1)];
    matches.push({ index: match.index, groups });
    if (match[0].length === 0) {
      localRegex.lastIndex += 1;
    }
    match = localRegex.exec(content);
  }

  return matches;
}

function printHumanReport(auditSummary) {
  const statusLine = auditSummary.ok
    ? "PASS security/public-surface: no public devtools exposure findings."
    : "FAIL security/public-surface: public devtools exposure findings detected.";
  process.stdout.write(`${statusLine}\n`);

  if (auditSummary.notes.length > 0) {
    process.stdout.write("notes:\n");
    for (const note of auditSummary.notes) {
      process.stdout.write(`- ${note}\n`);
    }
  }

  if (auditSummary.findings.length === 0) {
    return;
  }

  process.stdout.write("findings:\n");
  for (const finding of auditSummary.findings) {
    const surfaceLabel = finding.publicExposure ? "public" : "server-only";
    const line = finding.line ? `:${finding.line}` : "";
    process.stdout.write(
      `- [${surfaceLabel}] ${finding.rule} ${finding.file}${line} -> ${finding.message}\n`,
    );
  }
}
