import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../frontend/e2e/helpers/zero-scroll-contract.ts";

// ─────────────────────────────────────────────────────────────────────────────
// E2E-GLOBAL-10 · zero-scroll régime guard (LIMPIEZA E2E P2-2 / R-12).
//
// The audit found ONE invariant asserted at two thresholds: A08 froze the
// document scroll delta at exactly 0 px while the shell contracts allowed 1-2
// px, so a 1-2 px regression passed in one place and failed in the other.
//
// Convergence alone does not stay converged. The first version of this guard
// only recognised the `clientHeight + TOLERANCE` shape, and the corpus turned
// out to express the SAME allowance in three more ways — a delta compared
// against a literal, a delta booleanised with `> 1`, and a metric compared
// against a viewport plus a slack. A guard that polices one spelling is a guard
// that invites the other three.
//
// So this guard polices the SEMANTIC CATEGORY: "a positive allowance over a
// document-chain scroll metric". It answers one question per site — how many
// pixels of document scroll would still pass here? — and fails when the answer
// is one pixel or more.
//
// What stays out is excluded STRUCTURALLY, not by a file blocklist:
//   * BOX GEOMETRY never matches, because a rect field (`top`, `height`, …) is
//     not a scroll/client metric.
//   * INTERNAL CONTAINERS never match, because a metric read off anything that
//     is not the document chain is not a document read. `main.dashboard-main`
//     included: the owner module documents why it keeps its own allowance.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..");
const E2E_ROOT = resolve(REPO_ROOT, "frontend/e2e");
const OWNER_MODULE = "frontend/e2e/helpers/zero-scroll-contract.ts";
const OWNER_SYMBOL = "MAX_DOCUMENT_SCROLL_DELTA_PX";

// The walk is filesystem-based, not `git ls-files`, so an unstaged new spec is
// covered the moment it is written.
const EXCLUDED_DIRECTORIES = new Set(["node_modules", "test-results", "playwright-report"]);
const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];

/** The four metrics whose difference IS document scroll. */
const SCROLL_METRIC = "(?:scroll|client)(?:Height|Width)";

/**
 * Names that ARE a document reading without needing a local binding, because
 * the spec destructured the measurement on the browser side and only the name
 * survives on the Node side. `main.dashboard-main` is deliberately absent.
 */
const DESTRUCTURED_DOCUMENT_METRIC =
  `(?:\\bhtml\\.${SCROLL_METRIC}|\\bbody\\.${SCROLL_METRIC}` +
  `|\\bdocClient[HW]\\b|\\bhtmlClient(?:Height|Width)\\b|\\bbodyClient(?:Height|Width)\\b` +
  `|\\bhtmlScroll(?:Height|Width)\\b|\\bbodyScroll(?:Height|Width)\\b` +
  `|\\bdocumentScroll[XY]\\b)`;

type ViolationKind = "direct" | "flow";
type Violation = {
  readonly file: string;
  readonly line: number;
  readonly kind: ViolationKind;
  readonly toleratedPx: number;
  readonly source: string;
};

function sourceFiles(): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (item.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(item.name)) visit(join(directory, item.name));
        continue;
      }
      if (!item.isFile()) continue;
      if (!SOURCE_EXTENSIONS.some((extension) => item.name.endsWith(extension))) continue;
      files.push(join(directory, item.name));
    }
  }

  visit(E2E_ROOT);
  return files.sort((a, b) => a.localeCompare(b));
}

/** Characters after which a `/` opens a regex literal rather than dividing. */
const REGEX_PRECEDERS = new Set(["", ...`(,=:[!&|?{};+-*%<>~^`.split("")]);

/**
 * Blanks comments and string bodies while preserving every newline, so line
 * numbers stay exact and prose about "1-2 px" never reads as code. Template
 * placeholders keep their expressions; only the literal text is blanked.
 */
export function blankNonCode(source: string): string {
  const out = source.split("");
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to && k < out.length; k += 1) if (out[k] !== "\n") out[k] = " ";
  };

  let index = 0;
  let previous = "";
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      let end = index;
      while (end < source.length && source[end] !== "\n") end += 1;
      blank(index, end);
      index = end;
      continue;
    }
    if (char === "/" && next === "*") {
      let end = index + 2;
      while (end < source.length && !(source[end] === "*" && source[end + 1] === "/")) end += 1;
      blank(index, Math.min(end + 2, source.length));
      index = end + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      let end = index + 1;
      while (end < source.length && source[end] !== char) {
        if (source[end] === "\\") end += 1;
        end += 1;
      }
      blank(index + 1, end);
      index = end + 1;
      previous = char;
      continue;
    }
    if (char === "`") {
      let end = index + 1;
      while (end < source.length && source[end] !== "`") {
        if (source[end] === "\\") {
          end += 2;
          continue;
        }
        if (source[end] === "$" && source[end + 1] === "{") {
          let depth = 1;
          end += 2;
          while (end < source.length && depth > 0) {
            if (source[end] === "{") depth += 1;
            else if (source[end] === "}") depth -= 1;
            end += 1;
          }
          continue;
        }
        if (source[end] !== "\n") out[end] = " ";
        end += 1;
      }
      index = end + 1;
      previous = "`";
      continue;
    }
    if (char === "/" && REGEX_PRECEDERS.has(previous)) {
      let end = index + 1;
      let inClass = false;
      let closed = false;
      while (end < source.length && source[end] !== "\n") {
        const inner = source[end];
        if (inner === "\\") {
          end += 2;
          continue;
        }
        if (inner === "[") inClass = true;
        else if (inner === "]") inClass = false;
        else if (inner === "/" && !inClass) {
          closed = true;
          break;
        }
        end += 1;
      }
      if (closed) {
        blank(index + 1, end);
        index = end + 1;
        previous = "/";
        continue;
      }
    }

    if (!/\s/.test(char)) previous = char;
    index += 1;
  }

  return out.join("");
}

/** Local names bound directly to `document.documentElement` or `document.body`. */
function documentRootAliases(code: string): Set<string> {
  const aliases = new Set<string>();
  const pattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*document\.(?:documentElement|body)\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code))) aliases.add(match[1]);
  return aliases;
}

function documentReadPattern(aliases: ReadonlySet<string>): RegExp {
  const roots = [
    "document\\.(?:documentElement|body)",
    ...[...aliases].map((alias) => `\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  ];
  return new RegExp(`(?:(?:${roots.join("|")})\\.${SCROLL_METRIC})|${DESTRUCTURED_DOCUMENT_METRIC}`);
}

const BINDER_KEYWORDS = new Set([
  "if", "for", "while", "switch", "case", "return", "default", "else", "await",
  "typeof", "new", "const", "let", "var", "function", "catch", "do", "in", "of",
]);

/** The right-hand side of a binding: up to the next separator at depth zero. */
function readRightHandSide(code: string, from: number): string {
  let depth = 0;
  let index = from;
  const cap = Math.min(code.length, from + 600);
  while (index < cap) {
    const char = code[index];
    if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) {
      if (depth === 0) break;
      depth -= 1;
    } else if ((char === "," || char === ";") && depth === 0) break;
    index += 1;
  }
  return code.slice(from, index);
}

type Binding = {
  readonly name: string;
  readonly offset: number;
  readonly isDocument: boolean;
  readonly isRegime: boolean;
};

/**
 * Every `name =` / `name:` binding with the offset where it was introduced and
 * whether its value reads the document chain.
 *
 * The offset matters: `dashboard-clinic-controller-workspace-parity.spec.ts`
 * binds `metric` twice in the same file — once to `main.dashboard-main`, once
 * to `document.documentElement`. A file-global name set would charge the
 * internal-container assertion with the document reading of a different
 * function. Resolution is therefore "nearest binding that precedes the use".
 */
function documentBindings(code: string, documentRead: RegExp): Binding[] {
  const bindings: Binding[] = [];
  const pattern = /([A-Za-z_$][\w$]*)\s*(?::|=(?![=>]))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code))) {
    if (BINDER_KEYWORDS.has(match[1])) continue;
    const rhs = readRightHandSide(code, pattern.lastIndex);
    bindings.push({
      name: match[1],
      offset: match.index,
      isDocument: documentRead.test(rhs),
      isRegime: new RegExp(`^\\s*${OWNER_SYMBOL}\\s*$`).test(rhs),
    });
  }
  return bindings;
}

/**
 * Names that CARRY the régime rather than restate it.
 *
 * A page function cannot close over a module import, so a spec that measures
 * the document inside `page.evaluate` has to hand the constant across as an
 * argument — and the argument is bound AFTER the body that uses it, which is
 * why this is a whole-file rule and not a nearest-binding one.
 *
 * It stays fail-closed on both ends: the name must be bound to the bare owner
 * symbol (not to something derived from it), and if the same name is bound to
 * anything else anywhere in the file it stops counting as the régime.
 */
function regimeNames(bindings: readonly Binding[]): Set<string> {
  const byName = new Map<string, Binding[]>();
  for (const binding of bindings) {
    const list = byName.get(binding.name);
    if (list) list.push(binding);
    else byName.set(binding.name, [binding]);
  }

  const names = new Set<string>();
  for (const [name, list] of byName) {
    if (list.every((binding) => binding.isRegime)) names.add(name);
  }
  return names;
}

function resolvesToDocument(bindings: readonly Binding[], name: string, useOffset: number): boolean {
  let nearest: Binding | null = null;
  for (const binding of bindings) {
    if (binding.name !== name) continue;
    if (binding.offset >= useOffset) break;
    nearest = binding;
  }
  return nearest?.isDocument ?? false;
}

/**
 * How many pixels of document scroll a comparison still lets through.
 *
 * `toBeLessThanOrEqual(n)` and a raw `> n` tolerate n. `toBeLessThan(n)` and a
 * raw `>= n` tolerate n-1. A `+ n` slack tolerates n. A `+ IDENTIFIER` that is
 * not the régime owner tolerates an unprovable amount, so it is treated as
 * unbounded rather than assumed to be zero.
 */
export function toleratedDocumentScrollPx(
  line: string,
  carriesRegime: (name: string) => boolean = () => false,
): { readonly token: string; readonly px: number } | null {
  const candidates: { token: string; px: number }[] = [];
  let match: RegExpExecArray | null;

  const plusIdentifier = /\+\s*([A-Za-z_$][\w$]*)/g;
  while ((match = plusIdentifier.exec(line))) {
    if (match[1] === OWNER_SYMBOL || carriesRegime(match[1])) continue;
    candidates.push({ token: match[0].trim(), px: Number.POSITIVE_INFINITY });
  }

  const plusLiteral = /\+\s*(\d+(?:\.\d+)?)\b/g;
  while ((match = plusLiteral.exec(line))) {
    candidates.push({ token: match[0].trim(), px: Number(match[1]) });
  }

  const matcher = /\.(toBeLessThanOrEqual|toBeLessThan|toBeGreaterThan|toBeGreaterThanOrEqual)\(\s*(\d+(?:\.\d+)?)\s*\)/g;
  while ((match = matcher.exec(line))) {
    const bound = Number(match[2]);
    const inclusive = match[1] === "toBeLessThanOrEqual" || match[1] === "toBeGreaterThan";
    candidates.push({ token: match[0].trim(), px: inclusive ? bound : bound - 1 });
  }

  const comparison = /(<=|>=|<(?!=)|>(?!=))\s*(\d+(?:\.\d+)?)\b/g;
  while ((match = comparison.exec(line))) {
    const bound = Number(match[2]);
    const inclusive = match[1] === "<=" || match[1] === ">";
    candidates.push({ token: `${match[1]} ${match[2]}`, px: inclusive ? bound : bound - 1 });
  }

  const offending = candidates.filter((candidate) => candidate.px >= 1);
  if (offending.length === 0) return null;
  return offending.reduce((worst, candidate) => (candidate.px > worst.px ? candidate : worst));
}

/** Returns the violations instead of asserting, so mutations are provable. */
export function findDocumentAllowanceViolations(
  sources: ReadonlyMap<string, string>,
): Violation[] {
  const violations: Violation[] = [];

  for (const [file, rawSource] of sources) {
    const code = blankNonCode(rawSource.replace(/\r\n/g, "\n"));
    const documentRead = documentReadPattern(documentRootAliases(code));
    const bindings = documentBindings(code, documentRead);
    const carriers = regimeNames(bindings);
    const carriesRegime = (name: string): boolean => carriers.has(name);
    const documentNames = [...new Set(bindings.filter((b) => b.isDocument).map((b) => b.name))];
    const referencesDocumentName =
      documentNames.length > 0
        ? new RegExp(`(?:^|[^\\w$.])(?:[A-Za-z_$][\\w$]*\\.)?(${documentNames.join("|")})\\b`)
        : null;

    let offset = 0;
    code.split("\n").forEach((line, index) => {
      const lineOffset = offset;
      offset += line.length + 1;

      const direct = documentRead.test(line);
      let kind: ViolationKind | null = direct ? "direct" : null;

      if (!direct && referencesDocumentName && /expect\s*\(/.test(line)) {
        const referenced = line.match(referencesDocumentName);
        if (referenced && resolvesToDocument(bindings, referenced[1], lineOffset)) kind = "flow";
      }
      if (!kind) return;

      const allowance = toleratedDocumentScrollPx(line, carriesRegime);
      if (!allowance) return;

      violations.push({
        file,
        line: index + 1,
        kind,
        toleratedPx: allowance.px,
        source: line.trim(),
      });
    });
  }

  return violations;
}

function readSources(): Map<string, string> {
  const sources = new Map<string, string>();
  for (const file of sourceFiles()) {
    sources.set(
      relative(REPO_ROOT, file).split(sep).join("/"),
      readFileSync(file, "utf8").replace(/\r\n/g, "\n"),
    );
  }
  return sources;
}

test("the document zero-scroll régime is exactly zero and has one owner", () => {
  assert.equal(
    MAX_DOCUMENT_SCROLL_DELTA_PX,
    0,
    "AGENTS.md §10 states SCROLL_VERTICAL/HORIZONTAL_DEL_DOCUMENTO = 0; the régime " +
      "must freeze zero, and a positive delta is a runtime defect to report rather " +
      "than a threshold to re-tune",
  );

  const owner = readFileSync(resolve(REPO_ROOT, OWNER_MODULE), "utf8");
  assert.match(
    owner,
    new RegExp(`export const ${OWNER_SYMBOL} = 0;`),
    "the régime owner must declare the threshold literally, not derive it",
  );
});

test("no E2E source asserts a document scroll metric against a non-régime allowance", () => {
  const violations = findDocumentAllowanceViolations(readSources());

  assert.deepEqual(
    violations,
    [],
    `document zero-scroll assertions must use ${OWNER_SYMBOL} (E2E-GLOBAL-10 / R-12):\n` +
      violations
        .map((v) => `  ${v.file}:${v.line} [${v.kind}] tolerates ${v.toleratedPx}px: ${v.source}`)
        .join("\n"),
  );
});

test("every converged source imports the régime owner instead of restating zero", () => {
  const sources = readSources();
  const consumers = [...sources.entries()].filter(([, source]) => source.includes(OWNER_SYMBOL));

  assert.ok(consumers.length > 0, "the régime must have consumers");

  for (const [file, source] of consumers) {
    if (file === OWNER_MODULE) continue;
    assert.match(
      source,
      /import \{[^}]*MAX_DOCUMENT_SCROLL_DELTA_PX[^}]*\} from "[^"]*zero-scroll-contract";/,
      `${file} uses the régime symbol but does not import it from the owner`,
    );
    assert.equal(
      /const\s+MAX_DOCUMENT_SCROLL_DELTA_PX\s*=/.test(source),
      false,
      `${file} must not shadow the régime owner with a local declaration`,
    );
  }
});

test("the guard fails closed on every shape of positive document allowance", () => {
  const file = "frontend/e2e/platform/app-shell/regression.spec.ts";
  const expectDetected = (label: string, source: string, px: number, kind: ViolationKind) => {
    const violations = findDocumentAllowanceViolations(new Map([[file, source]]));
    assert.equal(violations.length, 1, `${label}: expected exactly one violation`);
    assert.equal(violations[0].kind, kind, `${label}: kind`);
    assert.equal(violations[0].toleratedPx, px, `${label}: tolerated px`);
    assert.match(violations[0].file, /regression\.spec\.ts$/);
  };

  // 1 · the original shape: a named slack added to a document client metric.
  expectDetected(
    "+ TOLERANCE",
    "expect(m.htmlScrollHeight).toBeLessThanOrEqual(m.htmlClientHeight + TOLERANCE);",
    Number.POSITIVE_INFINITY,
    "direct",
  );

  // 2 · a literal slack, which reads as "almost zero" and is not zero.
  expectDetected(
    "+ 5",
    "expect(m.bodyScrollHeight).toBeLessThanOrEqual(viewportHeight + 5);",
    5,
    "direct",
  );

  // 3 · a delta computed elsewhere and compared against 1.
  expectDetected(
    "<= 1 through a binding",
    [
      "const geometry = await page.evaluate(() => {",
      "  const html = document.documentElement;",
      "  return { horizontal: html.scrollWidth - html.clientWidth };",
      "});",
      "expect(geometry.horizontal).toBeLessThanOrEqual(1);",
    ].join("\n"),
    1,
    "flow",
  );

  // 4 · the same, at 2 px, through `Math.max` over both document elements.
  expectDetected(
    "<= 2 through a binding",
    [
      "const overflow = await page.evaluate(() => Math.max(",
      "  document.documentElement.scrollHeight - document.documentElement.clientHeight,",
      "  document.body.scrollHeight - document.body.clientHeight,",
      "));",
      "expect(overflow).toBeLessThanOrEqual(2);",
    ].join("\n"),
    2,
    "flow",
  );

  // 5 · booleanised: `> 1` asserted false still tolerates one pixel.
  expectDetected(
    "> 1 booleanised",
    [
      "const root = document.documentElement;",
      "const reading = { documentScrolls: root.scrollHeight - root.clientHeight > 1 };",
    ].join("\n"),
    1,
    "direct",
  );

  // 6 · strict `<` tolerates n-1, so `< 2` is a one-pixel allowance.
  expectDetected(
    "< 2",
    "expect(m.htmlScrollWidth - m.htmlClientWidth).toBeLessThan(2);",
    1,
    "direct",
  );

  // 7 · a page-function parameter is only the régime when it is bound to the
  // owner. Bound to a literal, it is an allowance wearing a régime-ish name.
  expectDetected(
    "a carrier name bound to a literal",
    [
      "return page.evaluate(({ documentAllowancePx }) => ({",
      "  scrolls: document.documentElement.scrollHeight > document.documentElement.clientHeight + documentAllowancePx,",
      "}), { documentAllowancePx: 2 });",
    ].join("\n"),
    Number.POSITIVE_INFINITY,
    "direct",
  );

  // 8 · and a carrier rebound anywhere in the file stops carrying.
  expectDetected(
    "a carrier rebound elsewhere in the file",
    [
      "const first = { documentAllowancePx: MAX_DOCUMENT_SCROLL_DELTA_PX };",
      "const second = { documentAllowancePx: 2 };",
      "expect(m.htmlScrollHeight).toBeLessThanOrEqual(m.htmlClientHeight + documentAllowancePx);",
    ].join("\n"),
    Number.POSITIVE_INFINITY,
    "direct",
  );
});

test("the guard accepts the canonical form and does not police what the régime disowns", () => {
  const file = "frontend/e2e/platform/app-shell/regression.spec.ts";
  const accepted = (label: string, source: string) =>
    assert.deepEqual(
      findDocumentAllowanceViolations(new Map([[file, source]])),
      [],
      `${label} must not be reported`,
    );

  accepted(
    "the canonical added form",
    "expect(m.htmlScrollHeight).toBeLessThanOrEqual(m.htmlClientHeight + MAX_DOCUMENT_SCROLL_DELTA_PX);",
  );
  accepted(
    "the canonical compared form",
    [
      "const root = document.documentElement;",
      "const reading = { documentScrolls: root.scrollHeight - root.clientHeight > MAX_DOCUMENT_SCROLL_DELTA_PX };",
    ].join("\n"),
  );
  // A page function cannot close over a module import, so the constant crosses
  // as an argument. The carrier is accepted because it is bound to the owner
  // and to nothing else — see the two rejection proofs above.
  accepted(
    "the régime carried into page.evaluate",
    [
      "return page.evaluate(({ documentAllowancePx }) => ({",
      "  scrolls: document.documentElement.scrollHeight > document.documentElement.clientHeight + documentAllowancePx,",
      "}), { documentAllowancePx: MAX_DOCUMENT_SCROLL_DELTA_PX });",
    ].join("\n"),
  );
  accepted(
    "a strictly-zero boolean",
    [
      "const html = document.documentElement;",
      "const reading = { scrolls: html.scrollHeight - html.clientHeight > 0 };",
    ].join("\n"),
  );

  // INTERNAL CONTAINERS keep their own allowance: the metric is not read off
  // the document chain, so it is not a document reading.
  accepted(
    "an internal scroller at 2 px",
    [
      "const container = document.querySelector('.rows');",
      "const overflow = container.scrollHeight - container.clientHeight;",
      "expect(overflow).toBeLessThanOrEqual(2);",
    ].join("\n"),
  );
  accepted(
    "main.dashboard-main at 2 px",
    [
      "const main = document.querySelector('main.dashboard-main');",
      "const metric = { scrollHeight: main.scrollHeight, clientHeight: main.clientHeight };",
      "expect(metric.scrollHeight).toBeLessThanOrEqual(metric.clientHeight + TOLERANCE);",
    ].join("\n"),
  );

  // BOX GEOMETRY keeps its sub-pixel allowance: a rect field is not a scroll
  // metric, so no rect comparison can enter the régime.
  accepted(
    "a rect edge at 0.5 px",
    [
      "const box = row.getBoundingClientRect();",
      "expect(box.bottom).toBeLessThanOrEqual(canvasBox.bottom + 0.5);",
    ].join("\n"),
  );

  // PROSE is not code: the owner module explains the 1-2 px history in
  // comments, and a comment must never read as a violation.
  accepted(
    "a comment describing the old allowance",
    [
      "// the shell contracts kept a 1-2 px allowance: html.scrollHeight <= html.clientHeight + 2",
      "expect(m.htmlScrollHeight).toBeLessThanOrEqual(m.htmlClientHeight + MAX_DOCUMENT_SCROLL_DELTA_PX);",
    ].join("\n"),
  );
});

test("the nearest preceding binding decides, so one name cannot taint another scope", () => {
  // The real shape in dashboard-clinic-controller-workspace-parity.spec.ts:
  // `metric` is bound to main.dashboard-main first and to the document later.
  // The internal assertion must stay legal and the document one must not.
  const source = [
    "async function expectMainNotScrollContainer(page) {",
    "  const metric = await page.evaluate(() => {",
    "    const main = document.querySelector('main.dashboard-main');",
    "    return { scrollHeight: main.scrollHeight, clientHeight: main.clientHeight };",
    "  });",
    "  expect(metric.scrollHeight).toBeLessThanOrEqual(metric.clientHeight + TOLERANCE);",
    "}",
    "async function expectNoHorizontalOverflow(page) {",
    "  const metric = await page.evaluate(() => ({",
    "    htmlScrollWidth: document.documentElement.scrollWidth,",
    "  }));",
    "  expect(metric.htmlScrollWidth).toBeLessThanOrEqual(999 + 2);",
    "}",
  ].join("\n");

  const violations = findDocumentAllowanceViolations(
    new Map([["frontend/e2e/clinic/shell/parity.spec.ts", source]]),
  );

  assert.equal(violations.length, 1, "only the document-bound use is a violation");
  assert.equal(violations[0].line, 12);
  assert.equal(violations[0].toleratedPx, 2);
});
