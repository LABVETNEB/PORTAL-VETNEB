// test/frontend-csp-inline-blockers-contract.test.ts
// VETNEB #756 — Pre-enforcement CSP audit: inline/eval blocker contract.
//
// This test is NOT an enforcement gate — CSP remains Report-Only.
// It is a reproducible audit that documents the current baseline and will
// catch regressions before a future enforcement PR.
//
// Audit scope: frontend/src/**/*.ts and *.tsx (runtime source only).
// Excluded: test/, docs/, node_modules, .next/.
//
// Baseline (as of #756):
//   eval()                   → 0 occurrences ✓
//   new Function()           → 0 occurrences ✓
//   inline event handlers    → 0 occurrences ✓
//   bare <script> (non-LD)   → 0 occurrences ✓ (all 7 are type="application/ld+json")
//   dangerouslySetInnerHTML  → 7 uses, ALL JSON-LD guarded ✓
//
// If any test fails, the failing pattern is a BLOCKER for CSP enforcement:
// it would require 'unsafe-inline'/'unsafe-eval', a nonce, or elimination
// before Content-Security-Policy (enforcing) can be activated.
//
// Run standalone:
//   node --experimental-strip-types --experimental-specifier-resolution=node \
//        --test test/frontend-csp-inline-blockers-contract.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const FRONTEND_SRC = resolve(process.cwd(), "frontend/src");
const TS_EXTENSIONS = new Set([".ts", ".tsx"]);

function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full));
    } else if (entry.isFile() && TS_EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

type Violation = { file: string; line: number; snippet: string };

function scanLines(files: string[], pattern: RegExp): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    content.split("\n").forEach((line, idx) => {
      if (pattern.test(line)) {
        violations.push({
          file: relative(process.cwd(), file),
          line: idx + 1,
          snippet: line.trim().slice(0, 120),
        });
      }
    });
  }
  return violations;
}

const runtimeFiles = walkDir(FRONTEND_SRC);

// ── 1. eval() ──────────────────────────────────────────────────────────────

test("no eval() calls in frontend/src runtime source", () => {
  // eval() requires 'unsafe-eval' in script-src — a hard blocker for enforcement.
  const found = scanLines(runtimeFiles, /\beval\s*\(/);
  assert.deepEqual(
    found,
    [],
    `eval() found — BLOCKER for CSP enforcement (requires 'unsafe-eval'):\n${JSON.stringify(found, null, 2)}`,
  );
});

// ── 2. new Function() ──────────────────────────────────────────────────────

test("no new Function() calls in frontend/src runtime source", () => {
  // new Function() is treated as eval() under CSP — requires 'unsafe-eval'.
  const found = scanLines(runtimeFiles, /\bnew\s+Function\s*\(/);
  assert.deepEqual(
    found,
    [],
    `new Function() found — BLOCKER for CSP enforcement (requires 'unsafe-eval'):\n${JSON.stringify(found, null, 2)}`,
  );
});

// ── 3. Inline event handler string attributes ───────────────────────────────

test("no inline event handler attributes in frontend/src (onerror=, onclick=, onload= as string literals)", () => {
  // Raw string event handler attributes (onclick="...", onerror="...") inject
  // executable code that requires 'unsafe-inline'. These are distinct from
  // React synthetic event props (onClick={...}) which are NOT inline handlers.
  const found = scanLines(
    runtimeFiles,
    /\b(?:onerror|onclick|onload|onfocus|onblur|onsubmit|onmouseover)\s*=\s*["']/,
  );
  assert.deepEqual(
    found,
    [],
    `Inline event handler string attribute found — BLOCKER for CSP enforcement (requires 'unsafe-inline'):\n${JSON.stringify(found, null, 2)}`,
  );
});

// ── 4. Bare executable <script> tags ───────────────────────────────────────

test("all <script> JSX elements in frontend/src declare type=\"application/ld+json\" (no bare executable scripts)", () => {
  // A <script> tag without type="application/ld+json" is an inline executable script.
  // Under CSP enforcement it requires 'unsafe-inline' or a per-request nonce.
  // All current <script> tags are JSON-LD structured data (safe, serialized via
  // JSON.stringify). This test guards that no bare executable script is introduced.
  const violations: Violation[] = [];
  for (const file of runtimeFiles) {
    if (!file.endsWith(".tsx")) continue;
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      if (/<script\b/.test(line)) {
        // Inspect up to 4 lines starting at the <script tag for the type attribute.
        const window = lines.slice(idx, idx + 4).join(" ");
        if (!/type\s*=\s*["']application\/ld\+json["']/.test(window)) {
          violations.push({
            file: relative(process.cwd(), file),
            line: idx + 1,
            snippet: line.trim().slice(0, 120),
          });
        }
      }
    });
  }
  assert.deepEqual(
    violations,
    [],
    `Bare executable <script> (no type="application/ld+json") found — BLOCKER for CSP enforcement without a nonce:\n${JSON.stringify(violations, null, 2)}`,
  );
});

// ── 5. dangerouslySetInnerHTML guard (complements security:public-surface) ──

test("all dangerouslySetInnerHTML uses in frontend/src are JSON-LD guarded (application/ld+json + JSON.stringify)", () => {
  // dangerouslySetInnerHTML injects raw HTML — under enforcing CSP it would require
  // 'unsafe-inline' or a nonce on the parent script/style context.
  // All current uses are JSON-LD structured data blocks serialized via JSON.stringify.
  // security:public-surface applies the same guard at the script level.
  const violations: Violation[] = [];
  for (const file of runtimeFiles) {
    const content = readFileSync(file, "utf8");
    let searchFrom = 0;
    let pos: number;
    while ((pos = content.indexOf("dangerouslySetInnerHTML", searchFrom)) !== -1) {
      const lineNum = content.slice(0, pos).split("\n").length;
      const snippet = content.slice(Math.max(0, pos - 150), pos + 250);
      const isJsonLd =
        /application\/ld\+json/.test(snippet) &&
        /JSON\.stringify\s*\(/.test(snippet);
      if (!isJsonLd) {
        violations.push({
          file: relative(process.cwd(), file),
          line: lineNum,
          snippet: snippet.replace(/\s+/g, " ").trim().slice(0, 120),
        });
      }
      searchFrom = pos + 1;
    }
  }
  assert.deepEqual(
    violations,
    [],
    `dangerouslySetInnerHTML without JSON-LD guard found — BLOCKER for CSP enforcement (requires nonce or elimination):\n${JSON.stringify(violations, null, 2)}`,
  );
});
