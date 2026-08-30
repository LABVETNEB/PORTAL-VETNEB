import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";
import test from "node:test";

import {
  CANARY_ENV_VALUE_VAR,
  DEFAULT_CANARY_SECRET_VALUE,
} from "../../../../scripts/security/env-value-leak-detector.mjs";

const FRONTEND_SRC_ROOT = "frontend/src";
const FOOTER_PATH = "frontend/src/components/layout/Footer.tsx";
const NEXT_STATIC_ROOT = "frontend/.next/static";
const NEXT_MAIN_CHUNK_PATH = "frontend/.next/static/chunks/main-app.js";
const OVERSIZED_FILE_BYTES = 6 * 1024 * 1024 + 512;
const STREAM_CHUNK_SIZE_FOR_TEST = 64;
const AUDITOR_SCRIPT = resolve(process.cwd(), "scripts/security/audit-public-devtools-surface.mjs");

// VET-11 / WBR-05: the env-value-leak sub-check must be exercised end to end
// through the real script, not just its pure functions in isolation.

type AuditResult = {
  ok: boolean;
  findings: Array<{ message: string; file: string; rule: string; publicExposure: boolean }>;
  notes?: string[];
};

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

function runAuditor(cwd: string, extraEnv: Record<string, string> = {}): AuditResult {
  try {
    const stdout = execFileSync(process.execPath, [AUDITOR_SCRIPT, "--json"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
    });

    return JSON.parse(stdout) as AuditResult;
  } catch (error) {
    const stdout =
      typeof error === "object" && error !== null && "stdout" in error
        ? String((error as { stdout?: unknown }).stdout ?? "")
        : "";

    if (stdout.trim().length > 0) {
      return JSON.parse(stdout) as AuditResult;
    }

    throw error;
  }
}

function withTempWorkspace(run: (workspaceRoot: string) => void): void {
  const workspaceRoot = mkdtempSync(resolve(tmpdir(), "public-surface-audit-"));

  try {
    run(workspaceRoot);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

function createMinimalPublicWorkspace(workspaceRoot: string): void {
  mkdirSync(resolve(workspaceRoot, "frontend/src/components/layout"), { recursive: true });
  mkdirSync(resolve(workspaceRoot, "frontend/public"), { recursive: true });
  mkdirSync(resolve(workspaceRoot, "frontend/.next/static/chunks"), { recursive: true });

  writeFileSync(
    resolve(workspaceRoot, FOOTER_PATH),
    [
      "export default function Footer() {",
      "  return (",
      "    <footer>",
      '      <iframe aria-hidden="true" tabIndex={-1} className="pointer-events-none" />',
      "      <PublicExternalControl />",
      "    </footer>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeOversizedMainChunk(workspaceRoot: string, content: string): void {
  assert.ok(Buffer.byteLength(content, "utf8") > OVERSIZED_FILE_BYTES);
  writeFileSync(resolve(workspaceRoot, NEXT_MAIN_CHUNK_PATH), content, "utf8");
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
  const result = runAuditor(process.cwd());

  const publicFindings = result.findings.filter((item) => item.publicExposure);
  assert.equal(
    result.ok,
    true,
    `Auditor reported public findings: ${JSON.stringify(publicFindings, null, 2)}`,
  );

  if (existsSync(resolve(process.cwd(), NEXT_MAIN_CHUNK_PATH))) {
    const hasMainChunkSkip = (result.notes ?? []).some(
      (note) =>
        note.includes("Skipped oversized file") &&
        note.includes("frontend/.next/static/chunks/main-app.js"),
    );
    assert.equal(
      hasMainChunkSkip,
      false,
      "Oversized frontend/.next/static/chunks/main-app.js must be scanned, not skipped.",
    );
  }
});

test("oversized public bundle is scanned without skip notes", () => {
  withTempWorkspace((workspaceRoot) => {
    createMinimalPublicWorkspace(workspaceRoot);

    const oversizedContent = "a".repeat(OVERSIZED_FILE_BYTES + 2048);
    writeOversizedMainChunk(workspaceRoot, oversizedContent);

    const result = runAuditor(workspaceRoot, {
      PUBLIC_SURFACE_STREAM_CHUNK_SIZE: String(STREAM_CHUNK_SIZE_FOR_TEST),
    });
    const hasSkipNote = (result.notes ?? []).some((note) => note.includes("Skipped oversized file"));

    assert.equal(hasSkipNote, false, `Unexpected oversized skip notes: ${JSON.stringify(result.notes)}`);
  });
});

test("sensitive marker inside oversized public bundle is detected", () => {
  withTempWorkspace((workspaceRoot) => {
    createMinimalPublicWorkspace(workspaceRoot);

    const marker = "SUPABASE_SERVICE_ROLE_KEY";
    const oversizedContent = `${"a".repeat(OVERSIZED_FILE_BYTES + 1024)} ${marker} `;
    writeOversizedMainChunk(workspaceRoot, oversizedContent);

    const result = runAuditor(workspaceRoot, {
      PUBLIC_SURFACE_STREAM_CHUNK_SIZE: String(STREAM_CHUNK_SIZE_FOR_TEST),
    });

    const hit = result.findings.find(
      (finding) =>
        finding.file === NEXT_MAIN_CHUNK_PATH &&
        finding.rule === "explicit-sensitive-identifier" &&
        finding.message.includes(`"${marker}"`),
    );
    assert.ok(hit, `Expected sensitive marker finding for oversized bundle: ${JSON.stringify(result)}`);
  });
});

test("sensitive marker split across chunks in oversized public bundle is detected", () => {
  withTempWorkspace((workspaceRoot) => {
    createMinimalPublicWorkspace(workspaceRoot);

    const marker = "SUPABASE_SERVICE_ROLE_KEY";
    const markerSplitOffset = STREAM_CHUNK_SIZE_FOR_TEST - 4;
    const prefix = `${"a".repeat(markerSplitOffset - 1)} `;
    const suffixLength = OVERSIZED_FILE_BYTES + 2048 - (prefix.length + marker.length + 1);
    const oversizedContent = `${prefix}${marker} ${"a".repeat(Math.max(0, suffixLength))}`;
    writeOversizedMainChunk(workspaceRoot, oversizedContent);

    const result = runAuditor(workspaceRoot, {
      PUBLIC_SURFACE_STREAM_CHUNK_SIZE: String(STREAM_CHUNK_SIZE_FOR_TEST),
    });

    const hit = result.findings.find(
      (finding) =>
        finding.file === NEXT_MAIN_CHUNK_PATH &&
        finding.rule === "explicit-sensitive-identifier" &&
        finding.message.includes(`"${marker}"`),
    );
    assert.ok(
      hit,
      `Expected split-chunk marker to be detected in oversized bundle: ${JSON.stringify(result)}`,
    );
  });
});

test("env-value-leak check is effectively evaluated even with no .env files present (canary absent -> PASS)", () => {
  withTempWorkspace((workspaceRoot) => {
    createMinimalPublicWorkspace(workspaceRoot);

    const result = runAuditor(workspaceRoot);

    assert.equal(result.ok, true, `Expected PASS, got: ${JSON.stringify(result)}`);

    const evaluatedNote = (result.notes ?? []).find(
      (note) => note.startsWith("Evaluated") && note.includes("sensitive env-value candidate"),
    );
    assert.ok(
      evaluatedNote,
      `Expected an "Evaluated N sensitive env-value candidate(s)" note, got: ${JSON.stringify(result.notes)}`,
    );

    const notEvaluatedFinding = result.findings.find(
      (finding) => finding.rule === "env-value-leak-check-not-evaluated",
    );
    assert.equal(notEvaluatedFinding, undefined);
  });
});

test("env-value-leak check fails when the synthetic canary appears in the public bundle (canary present -> FAIL)", () => {
  withTempWorkspace((workspaceRoot) => {
    createMinimalPublicWorkspace(workspaceRoot);

    writeFileSync(
      resolve(workspaceRoot, "frontend/public/leaked.js"),
      `var leaked = "${DEFAULT_CANARY_SECRET_VALUE}";`,
      "utf8",
    );

    const result = runAuditor(workspaceRoot, {
      [CANARY_ENV_VALUE_VAR]: DEFAULT_CANARY_SECRET_VALUE,
    });

    assert.equal(result.ok, false, `Expected FAIL, got: ${JSON.stringify(result)}`);

    const leakFinding = result.findings.find(
      (finding) => finding.rule === "env-sensitive-value-leak" && finding.file === "frontend/public/leaked.js",
    );
    assert.ok(leakFinding, `Expected env-sensitive-value-leak finding, got: ${JSON.stringify(result.findings)}`);
    assert.equal(JSON.stringify(result).includes(DEFAULT_CANARY_SECRET_VALUE), false);
  });
});
