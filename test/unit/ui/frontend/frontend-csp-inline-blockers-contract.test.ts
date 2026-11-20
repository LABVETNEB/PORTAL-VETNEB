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
//   dangerouslySetInnerHTML  → 10 uses, ALL JSON-LD sinks via serializeJsonLd ✓
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
import { join, relative, resolve } from "node:path";
import {
  THEME_INIT_SCRIPT_SRC,
  THEME_INIT_SCRIPT_VERSION,
} from "../../../../frontend/src/lib/theme.ts";
import { serializeJsonLd } from "../../../../frontend/src/lib/json-ld.ts";
import { listSourceFiles, readSourceFile } from "../../../helpers/tracked-source-files.ts";

const FRONTEND_SRC = resolve(process.cwd(), "frontend/src");
const TS_EXTENSIONS = new Set([".ts", ".tsx"]);

function walkDir(dir: string): string[] {
  return listSourceFiles(dir, { extensions: [...TS_EXTENSIONS] }).map((file) =>
    join(dir, file),
  );
}

type Violation = { file: string; line: number; snippet: string };

function scanLines(files: string[], pattern: RegExp): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    const content = readSourceFile(relative(process.cwd(), file));
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
  // Exception: same-origin external src scripts are covered by script-src 'self'
  // and are NOT enforcement blockers. Allowlisted exact srcs only: the one
  // identifier whose value the next test pins to the versioned theme-init.js.
  const ALLOWED_EXTERNAL_SCRIPT_SRCS = [/src\s*=\s*\{THEME_INIT_SCRIPT_SRC\}/];
  const violations: Violation[] = [];
  for (const file of runtimeFiles) {
    if (!file.endsWith(".tsx")) continue;
    const content = readSourceFile(relative(process.cwd(), file));
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      if (/<script\b/.test(line)) {
        // Inspect up to 4 lines starting at the <script tag for the type attribute.
        const window = lines.slice(idx, idx + 4).join(" ");
        if (ALLOWED_EXTERNAL_SCRIPT_SRCS.some((src) => src.test(window))) {
          return;
        }
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

test("the allowlisted external script src is the same-origin, content-versioned theme-init.js", () => {
  // The allowlist above names an identifier, not a URL, so the identifier is
  // pinned here: one definition, a same-origin path, and a file name that
  // carries the hash of the served bytes. Editing the script without renaming
  // it would leave browsers running the old one from an immutable cache entry.
  const definitions = scanLines(runtimeFiles, /\bTHEME_INIT_SCRIPT_SRC\s*=(?!=)/);
  assert.deepEqual(
    definitions.map((definition) => definition.file.replace(/\\/g, "/")),
    ["frontend/src/lib/theme.ts"],
    "THEME_INIT_SCRIPT_SRC must have exactly one definition",
  );

  // The hash of the served bytes is pinned next to the cache rule, in
  // frontend-next-config-private-cache-headers.test.ts.
  assert.equal(THEME_INIT_SCRIPT_SRC, `/theme-init.${THEME_INIT_SCRIPT_VERSION}.js`);

  const layout = readSourceFile("frontend/src/app/layout.tsx");
  assert.match(
    layout,
    /import \{[^}]*\bTHEME_INIT_SCRIPT_SRC\b[^}]*\} from "@\/lib\/theme";/,
    "the root layout must take the script src from lib/theme",
  );
  assert.equal(
    /<script\b[^>]*\bsrc\s*=\s*["']/.test(layout),
    false,
    "the root layout must not load a script from an unversioned literal src",
  );
  assert.match(
    layout,
    /<script src=\{THEME_INIT_SCRIPT_SRC\} \/>/,
    "the script must stay parser-blocking: no async, defer or type attribute",
  );
});

// ── 5. dangerouslySetInnerHTML guard (complements security:public-surface) ──

// Un sink JSON-LD es seguro sólo si el `__html` es exactamente la llamada a
// `serializeJsonLd(...)`: `JSON.stringify` crudo no escapa `</script>`.
function isSafeJsonLdSink(content: string, pos: number): boolean {
  const before = content.slice(Math.max(0, pos - 150), pos);
  const sink = content.slice(pos, pos + 250);
  return (
    /type="application\/ld\+json"/.test(before + sink.slice(0, 40)) &&
    /^dangerouslySetInnerHTML=\{\{\s*__html:\s*serializeJsonLd\(/.test(sink)
  );
}

function findUnsafeInnerHtmlSinks(files: Array<{ file: string; content: string }>): Violation[] {
  const violations: Violation[] = [];
  for (const { file, content } of files) {
    let searchFrom = 0;
    let pos: number;
    while ((pos = content.indexOf("dangerouslySetInnerHTML", searchFrom)) !== -1) {
      if (!isSafeJsonLdSink(content, pos)) {
        violations.push({
          file,
          line: content.slice(0, pos).split("\n").length,
          snippet: content
            .slice(Math.max(0, pos - 150), pos + 250)
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 120),
        });
      }
      searchFrom = pos + 1;
    }
  }
  return violations;
}

test("all dangerouslySetInnerHTML uses in frontend/src are JSON-LD sinks serialized with serializeJsonLd", () => {
  // dangerouslySetInnerHTML injects raw HTML. Los únicos usos admitidos son bloques
  // JSON-LD cuyo contenido pasa por serializeJsonLd (escapa <, >, &, U+2028/2029).
  const violations = findUnsafeInnerHtmlSinks(
    runtimeFiles.map((file) => {
      const path = relative(process.cwd(), file);
      return { file: path, content: readSourceFile(path) };
    }),
  );
  assert.deepEqual(
    violations,
    [],
    `dangerouslySetInnerHTML without safe JSON-LD serialization found — XSS/CSP BLOCKER:\n${JSON.stringify(violations, null, 2)}`,
  );
});

test("serializeJsonLd has a single definition in lib/json-ld.ts and every consumer imports it from @/lib/json-ld", () => {
  const definitions: string[] = [];
  const badImports: string[] = [];
  let consumers = 0;
  for (const file of runtimeFiles) {
    const path = relative(process.cwd(), file).replaceAll("\\", "/");
    const content = readSourceFile(path);
    if (/(?:function|const|let|var)\s+serializeJsonLd\b/.test(content)) definitions.push(path);
    if (/\bserializeJsonLd\s*\(/.test(content) && !/export function serializeJsonLd/.test(content)) {
      consumers += 1;
      const imported = /import\s*\{[^}]*\bserializeJsonLd\b[^}]*\}\s*from\s*"@\/lib\/json-ld"/.test(content);
      if (!imported) badImports.push(path);
    }
  }
  assert.deepEqual(definitions, ["frontend/src/lib/json-ld.ts"]);
  assert.deepEqual(badImports, []);
  assert.equal(consumers, 10);
});

test("the JSON-LD sink guard rejects raw JSON.stringify and other synthetic unsafe sinks", () => {
  const sink = (html: string) =>
    `<script\n type="application/ld+json"\n dangerouslySetInnerHTML={{ __html: ${html} }}\n/>`;
  const run = (html: string) =>
    findUnsafeInnerHtmlSinks([{ file: "synthetic.tsx", content: sink(html) }]).length;

  assert.equal(run("serializeJsonLd(data)"), 0);
  assert.equal(run("JSON.stringify(data)"), 1);
  assert.equal(run("JSON.stringify(data).replace(/</g, '')"), 1);
  assert.equal(run("userHtml"), 1);
  assert.equal(run("`${serializeJsonLd(data)}`"), 1);
  assert.equal(
    findUnsafeInnerHtmlSinks([
      { file: "synthetic.tsx", content: "<div dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />" },
    ]).length,
    1,
    "serializeJsonLd outside a type=application/ld+json script is not an admitted sink",
  );
});

// ── 6. serializeJsonLd: contrato de comportamiento (SEC-17) ─────────────────

test("serializeJsonLd escapes <, >, &, U+2028 and U+2029 and never closes the script element", () => {
  const hostile = {
    a: "</script><script>alert(1)</script>",
    b: "<!-- x --> & <b>bold</b> > <",
    c: "line\u2028sep\u2029para",
  };
  const out = serializeJsonLd(hostile);

  assert.equal(/[<>&\u2028\u2029]/.test(out), false);
  assert.equal(out.toLowerCase().includes("</script"), false);
  assert.ok(out.includes("\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e"));
  assert.ok(out.includes("\\u0026"));
  assert.ok(out.includes("\\u2028") && out.includes("\\u2029"));
  assert.deepEqual(JSON.parse(out), hostile);
});

test("serializeJsonLd keeps valid, semantically identical JSON and does not mutate or double-encode", () => {
  const input = {
    quote: 'he said "hi" \ back\slash',
    unicode: "áéíóñ ü ✓ 😀",
    nested: { list: [1, "<x>", { deep: ["&", null, true, 1.5] }], empty: {} },
    arr: [],
  };
  const snapshot = structuredClone(input);
  const out = serializeJsonLd(input);

  assert.deepEqual(input, snapshot);
  assert.deepEqual(JSON.parse(out), snapshot);
  assert.equal(out.includes("\\\\u003c"), false, "no double-escaped backslash before the u003c sequence");
  assert.equal(serializeJsonLd(input), out);
  assert.equal(serializeJsonLd({ plain: "texto" }), JSON.stringify({ plain: "texto" }));
  assert.equal(JSON.parse(serializeJsonLd("</script>")), "</script>");
});

test("every JSON-LD sink file serializes with serializeJsonLd and never with raw JSON.stringify", () => {
  const sinkFiles = runtimeFiles
    .map((file) => relative(process.cwd(), file).replaceAll("\\", "/"))
    .filter((path) => readSourceFile(path).includes("dangerouslySetInnerHTML"));

  assert.equal(sinkFiles.length, 10);
  for (const path of sinkFiles) {
    const source = readSourceFile(path);
    assert.match(source, /__html:\s*serializeJsonLd\(/, `${path} must serialize JSON-LD with serializeJsonLd`);
    assert.equal(source.includes("JSON.stringify"), false, `${path} must not use raw JSON.stringify`);
    assert.equal((source.match(/dangerouslySetInnerHTML/g) ?? []).length, 1, `${path} must have exactly one sink`);
  }
});
