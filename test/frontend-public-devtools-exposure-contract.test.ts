import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import test from "node:test";

const FRONTEND_SRC_ROOT = "frontend/src";
const FOOTER_PATH = "frontend/src/components/layout/Footer.tsx";
const NEXT_STATIC_ROOT = "frontend/.next/static";

const FRONTEND_CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const CONSOLE_REGEX = /\bconsole\.(log|debug|table)\s*\(/;
const STORAGE_CALL_REGEX =
  /\b(localStorage|sessionStorage)\.(setItem|getItem|removeItem)\s*\(\s*(["'`])([^"'`\n]+)\2/g;
const SENSITIVE_STORAGE_KEY_REGEX =
  /(token|secret|password|passwd|session|auth|jwt|cookie|email|mail|phone|telefono|cel|dni|document|ssn|profile|personal|pii|access|refresh)/i;
const EXPLICIT_SENSITIVE_IDENTIFIER_REGEX =
  /\b(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL|DATABASE_URL|SMTP_PASS|SMTP_USER|GMAIL_API_REFRESH_TOKEN|GMAIL_API_CLIENT_SECRET|SESSION_SECRET|JWT_SECRET|ADMIN_COOKIE_NAME|PARTICULAR_COOKIE_NAME|SERVICE_ROLE|PRIVATE_KEY|ACCESS_TOKEN|REFRESH_TOKEN)\b/i;
const NON_PUBLIC_API_KEY_IDENTIFIER_REGEX = /\b(?!NEXT_PUBLIC_)[A-Z][A-Z0-9_]*API_KEY\b/;
const NEXT_LINK_IMPORT_REGEX = /from\s+["']next\/link["']/;
const LINK_TAG_REGEX = /<Link\b/;
const ANCHOR_TAG_REGEX = /<a\b/;
const IFRAME_TAG_REGEX = /<iframe\b/;

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

function collectFiles(relativeRoot: string): string[] {
  const absoluteRoot = resolve(process.cwd(), relativeRoot);
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  const files: string[] = [];
  const workspacePrefix = resolve(process.cwd(), "").replace(/\\/g, "/") + "/";

  function walk(currentPath: string): void {
    for (const entry of readdirSync(currentPath)) {
      const fullPath = `${currentPath}/${entry}`;
      const info = statSync(fullPath);
      if (info.isDirectory()) {
        walk(fullPath);
        continue;
      }
      files.push(fullPath.replace(/\\/g, "/").replace(workspacePrefix, ""));
    }
  }

  walk(absoluteRoot.replace(/\\/g, "/"));
  return files;
}

function isFrontendCodeFile(file: string): boolean {
  return FRONTEND_CODE_EXTENSIONS.has(extname(file).toLowerCase());
}

test("no public source maps are expected in production static assets", () => {
  if (!existsSync(resolve(process.cwd(), NEXT_STATIC_ROOT))) {
    assert.ok(true);
    return;
  }

  const sourceMaps = collectFiles(NEXT_STATIC_ROOT).filter((file) => file.endsWith(".map"));
  assert.deepEqual(sourceMaps, [], `Public source maps detected: ${sourceMaps.join(", ")}`);
});

test("frontend src keeps console.log/debug/table out of public bundle surface", () => {
  const violations = collectFiles(FRONTEND_SRC_ROOT)
    .filter(isFrontendCodeFile)
    .filter((file) => !/(^|[\\/])(__tests__|test|tests)([\\/]|$)|\.(test|spec)\.[cm]?[jt]sx?$/i.test(file))
    .filter((file) => CONSOLE_REGEX.test(read(file)));

  assert.deepEqual(violations, [], `Forbidden console calls detected: ${violations.join(", ")}`);
});

test("frontend src avoids sensitive localStorage/sessionStorage key names", () => {
  const violations: string[] = [];
  const files = collectFiles(FRONTEND_SRC_ROOT).filter(isFrontendCodeFile);

  for (const file of files) {
    const content = read(file);
    let match = STORAGE_CALL_REGEX.exec(content);
    while (match) {
      const key = match[3];
      if (SENSITIVE_STORAGE_KEY_REGEX.test(key)) {
        violations.push(`${file}::${key}`);
      }
      match = STORAGE_CALL_REGEX.exec(content);
    }
  }

  assert.deepEqual(violations, [], `Sensitive storage keys detected: ${violations.join(", ")}`);
});

test("frontend public components avoid explicit secret markers and non-public API_KEY names", () => {
  const files = collectFiles(FRONTEND_SRC_ROOT).filter(isFrontendCodeFile);
  const violations: string[] = [];

  for (const file of files) {
    const content = read(file);
    if (EXPLICIT_SENSITIVE_IDENTIFIER_REGEX.test(content)) {
      violations.push(`${file}::explicit-sensitive-identifier`);
    }
    if (NON_PUBLIC_API_KEY_IDENTIFIER_REGEX.test(content)) {
      violations.push(`${file}::non-public-api-key-identifier`);
    }
  }

  assert.deepEqual(violations, [], `Sensitive markers detected in frontend src: ${violations.join(", ")}`);
});

test("public navigation hardening contract remains intact (no next/link, no <a>, one iframe in footer)", () => {
  const files = collectFiles(FRONTEND_SRC_ROOT).filter(isFrontendCodeFile);
  const nextLinkImports = files.filter((file) => NEXT_LINK_IMPORT_REGEX.test(read(file)));
  const linkTags = files.filter((file) => LINK_TAG_REGEX.test(read(file)));
  const anchors = files.filter((file) => ANCHOR_TAG_REGEX.test(read(file)));
  const iframes = files.filter((file) => IFRAME_TAG_REGEX.test(read(file)));

  assert.deepEqual(nextLinkImports, [], `NEXT_LINK_IMPORTS must be 0: ${nextLinkImports.join(", ")}`);
  assert.deepEqual(linkTags, [], `LINK_TAGS must be 0: ${linkTags.join(", ")}`);
  assert.deepEqual(anchors, [], `ANCHOR_HITS must be 0: ${anchors.join(", ")}`);
  assert.deepEqual(iframes, [FOOTER_PATH], `IFRAME_HITS must be 1 at footer only: ${iframes.join(", ")}`);

  const footer = read(FOOTER_PATH);
  assert.ok(footer.includes("<iframe"));
  assert.ok(footer.includes('aria-hidden="true"'));
  assert.ok(footer.includes("tabIndex={-1}"));
  assert.ok(footer.includes("pointer-events-none"));
  assert.ok(footer.includes("<PublicExternalControl"));
  assert.equal(/<a\b/.test(footer), false);
  assert.equal(/<Link\b/.test(footer), false);
});

test("public devtools auditor script passes with no exposure findings", () => {
  const stdout = execFileSync(
    process.execPath,
    ["scripts/security/audit-public-devtools-surface.mjs", "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const result = JSON.parse(stdout) as {
    ok: boolean;
    findings: Array<{ message: string; file: string; rule: string; publicExposure: boolean }>;
    notes?: string[];
  };

  const publicFindings = result.findings.filter((item) => item.publicExposure);
  assert.equal(
    result.ok,
    true,
    `Auditor reported public findings: ${JSON.stringify(publicFindings, null, 2)}`,
  );
});
