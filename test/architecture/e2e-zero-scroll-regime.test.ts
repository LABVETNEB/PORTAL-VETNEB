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
//
// PR #1729 Codex P2 ("Reject named thresholds in direct comparisons"): the
// SAME allowance spelled `root.scrollHeight - root.clientHeight > TOLERANCE`
// escaped, because identifier handling was limited to `+ IDENTIFIER` while the
// raw comparison and the matcher call only recognised numeric literals. Closed
// by extending both to identifiers, proven innocent only via
// `isRegimeReference` — the bare owner symbol, a dotted access ending in it,
// or a name `isProvenSafe` proves bound EXCLUSIVELY to the owner or
// EXCLUSIVELY to another live `window.`/`document.` read (the baseline a
// comparison measures against, e.g. `viewportWidth = window.innerWidth`, not
// a threshold) — never by pattern-matching the name "TOLERANCE" specifically.
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

/**
 * A bare property read off `window.` or `document.` (`window.innerWidth`,
 * `document.body.scrollWidth`) — a LIVE measurement, never a designed slack.
 * Used to recognise a binding whose value is another metric, not a threshold,
 * even when it is one indirection away from the comparison (`const
 * viewportWidth = await page.evaluate(() => window.innerWidth)`), the same
 * way `root.clientHeight` is recognised inline via the member-expression
 * lookahead in the comparison regexes below.
 */
const LIVE_METRIC_READ = /\b(?:window|document)\.[A-Za-z]/;

type Binding = {
  readonly name: string;
  readonly offset: number;
  readonly isDocument: boolean;
  readonly isRegime: boolean;
  readonly isLiveMetric: boolean;
};

/**
 * TypeScript primitive/utility type keywords. `name: Type` in a parameter or
 * object-literal TYPE annotation matches the exact same `identifier:` shape
 * as a real `name: value` binding — `{ documentAllowancePx: number }` in a
 * parameter type reads identically to `{ documentAllowancePx: 2 }` in an
 * object literal. Only the RHS distinguishes them, and a bare occurrence of
 * one of these keywords as a whole right-hand side can never be a real
 * value, so it is excluded from the bindings list entirely rather than
 * recorded as a non-régime binding — recording it would let a TYPE
 * annotation falsely veto a real VALUE binding of the same name elsewhere in
 * the file (`regimeNames` requires every binding of a name to be régime).
 */
const TS_PRIMITIVE_TYPE_KEYWORDS = new Set([
  "number", "string", "boolean", "unknown", "any", "void", "never",
  "object", "bigint", "symbol", "undefined", "null",
]);

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
    if (TS_PRIMITIVE_TYPE_KEYWORDS.has(rhs.trim())) continue;
    bindings.push({
      name: match[1],
      offset: match.index,
      isDocument: documentRead.test(rhs),
      isRegime: new RegExp(`^\\s*${OWNER_SYMBOL}\\s*$`).test(rhs),
      isLiveMetric: LIVE_METRIC_READ.test(rhs),
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

/**
 * Names bound EXCLUSIVELY to another live `window.`/`document.` read — the
 * comparison baseline itself (`viewportWidth`, per PR #1729 §4.B), not a
 * threshold. Same fail-closed shape as `regimeNames`: every binding of the
 * name must be a live read, or it does not count — a name bound once to
 * `window.innerWidth` and once to a literal is NOT provably a baseline.
 */
function liveMetricNames(bindings: readonly Binding[]): Set<string> {
  const byName = new Map<string, Binding[]>();
  for (const binding of bindings) {
    const list = byName.get(binding.name);
    if (list) list.push(binding);
    else byName.set(binding.name, [binding]);
  }

  const names = new Set<string>();
  for (const [name, list] of byName) {
    if (list.every((binding) => binding.isLiveMetric)) names.add(name);
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
 * Whether a token that appears where a threshold is expected actually proves
 * OUT of the allowance category — either as the régime itself, or as another
 * live metric standing in for one:
 *
 *   1. The bare owner symbol, or a dotted access ending in it
 *      (`ns.MAX_DOCUMENT_SCROLL_DELTA_PX`).
 *   2. A bare name `isProvenSafe` can prove is bound EXCLUSIVELY to the owner,
 *      or EXCLUSIVELY to another live `window.`/`document.` read, across the
 *      whole file.
 *
 * Anything else — a literal, an unrelated name, a name bound to more than one
 * of these categories — does not prove out, and the caller treats that as an
 * unbounded allowance rather than assuming it happens to be zero.
 */
function isRegimeReference(token: string, isProvenSafe: (name: string) => boolean): boolean {
  const trimmed = token.trim();
  if (trimmed === OWNER_SYMBOL || trimmed.endsWith(`.${OWNER_SYMBOL}`)) return true;
  return /^[A-Za-z_$][\w$]*$/.test(trimmed) && isProvenSafe(trimmed);
}

/**
 * How many pixels of document scroll a comparison still lets through.
 *
 * `toBeLessThanOrEqual(n)` and a raw `> n` tolerate n. `toBeLessThan(n)` and a
 * raw `>= n` tolerate n-1. A `+ n` slack tolerates n.
 *
 * A NAMED threshold — `+ IDENTIFIER`, `> IDENTIFIER`, or
 * `.toBeLessThanOrEqual(IDENTIFIER)` — tolerates an unprovable amount unless
 * it resolves to the régime owner or to another live metric
 * (`isRegimeReference`), so it is treated as unbounded rather than assumed to
 * be zero. This is what closes the PR #1729 Codex P2 finding:
 * `root.scrollHeight - root.clientHeight > TOLERANCE` used to escape because
 * only `+ IDENTIFIER` was policed and the raw comparison only recognised
 * numeric literals — the SAME allowance, spelled with `>` instead of `+`.
 *
 * What stays deliberately unpoliced: a right-hand side that is a MEMBER
 * EXPRESSION (`root.scrollHeight > root.clientHeight`) or a bare name proven
 * to be another live measurement one indirection away
 * (`bodyWidth <= viewportWidth`, where `viewportWidth` is bound to
 * `window.innerWidth`) is not an allowance at all — it is two live metrics
 * compared directly, which is the zero-margin shape itself, not a slack
 * bolted onto it. Only a bare literal, or a bare identifier proven to be
 * neither the régime nor another live read, is a threshold.
 */
export function toleratedDocumentScrollPx(
  line: string,
  isProvenSafe: (name: string) => boolean = () => false,
): { readonly token: string; readonly px: number } | null {
  const candidates: { token: string; px: number }[] = [];
  let match: RegExpExecArray | null;

  const plusIdentifier = /\+\s*([A-Za-z_$][\w$]*)/g;
  while ((match = plusIdentifier.exec(line))) {
    if (isRegimeReference(match[1], isProvenSafe)) continue;
    candidates.push({ token: match[0].trim(), px: Number.POSITIVE_INFINITY });
  }

  const plusLiteral = /\+\s*(\d+(?:\.\d+)?)\b/g;
  while ((match = plusLiteral.exec(line))) {
    candidates.push({ token: match[0].trim(), px: Number(match[1]) });
  }

  // Matcher call whose argument is a BARE atom — a literal, or a dotted-path
  // identifier with no arithmetic inside it. Only the numeric shape yields a
  // provable magnitude; a bare non-numeric atom needs `isRegimeReference` to
  // prove zero. A COMPOUND argument (`metric + OWNER`, `999 + 2`) is not
  // matched here at all: it is the canonical `+` shape, and `plusIdentifier`/
  // `plusLiteral` below already scan the whole line for it regardless of
  // where the `+` sits — re-classifying the compound argument as a single
  // opaque token here would flag the canonical form itself as unprovable.
  const BARE_ARGUMENT = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
  const matcherCall =
    /\.(toBeLessThanOrEqual|toBeLessThan|toBeGreaterThan|toBeGreaterThanOrEqual)\(\s*([^()]+?)\s*\)/g;
  while ((match = matcherCall.exec(line))) {
    const [, methodName, rawArgument] = match;
    if (/^\d+(?:\.\d+)?$/.test(rawArgument)) {
      const bound = Number(rawArgument);
      const inclusive = methodName === "toBeLessThanOrEqual" || methodName === "toBeGreaterThan";
      candidates.push({ token: match[0].trim(), px: inclusive ? bound : bound - 1 });
      continue;
    }
    if (!BARE_ARGUMENT.test(rawArgument)) continue;
    if (isRegimeReference(rawArgument, isProvenSafe)) continue;
    candidates.push({ token: match[0].trim(), px: Number.POSITIVE_INFINITY });
  }

  const comparisonLiteral = /(<=|>=|<(?!=)|>(?!=))\s*(\d+(?:\.\d+)?)\b/g;
  while ((match = comparisonLiteral.exec(line))) {
    const bound = Number(match[2]);
    const inclusive = match[1] === "<=" || match[1] === ">";
    candidates.push({ token: `${match[1]} ${match[2]}`, px: inclusive ? bound : bound - 1 });
  }

  // Named threshold in a raw comparison (PR #1729 Codex P2). A bare identifier
  // NOT followed by `.` or `(` stands where a threshold value belongs; a name
  // that continues into a member access or a call (`root.clientHeight`,
  // `next.disabled`) is data being compared, not a slack, and is excluded by
  // the lookahead so proof #6 (`root.scrollHeight > root.clientHeight`) stays
  // accepted.
  const comparisonIdentifier = /(<=|>=|<(?!=)|>(?!=))\s*([A-Za-z_$][\w$]*)\b(?!\s*[.(])/g;
  while ((match = comparisonIdentifier.exec(line))) {
    if (isRegimeReference(match[2], isProvenSafe)) continue;
    candidates.push({ token: `${match[1]} ${match[2]}`, px: Number.POSITIVE_INFINITY });
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
    const liveMetrics = liveMetricNames(bindings);
    const isProvenSafe = (name: string): boolean => carriers.has(name) || liveMetrics.has(name);
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

      const allowance = toleratedDocumentScrollPx(line, isProvenSafe);
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

  // 9 · PR #1729 Codex P2, exact reproduction: a named threshold in a RAW
  // comparison (no `+`) used to escape entirely, because identifier handling
  // was limited to the `+ IDENTIFIER` shape.
  expectDetected(
    "a named threshold in a raw comparison (Codex P2)",
    [
      "const root = document.documentElement;",
      "const TOLERANCE = 1;",
      "const reading = { documentScrolls: root.scrollHeight - root.clientHeight > TOLERANCE };",
    ].join("\n"),
    Number.POSITIVE_INFINITY,
    "direct",
  );

  // 10 · the same class of bypass through a Jest/Playwright matcher call
  // instead of a raw operator: `.toBeLessThanOrEqual(ALLOWANCE)` used to pass
  // silently because the matcher pattern also required a numeric literal.
  expectDetected(
    "a named threshold in a matcher call, through a binding",
    [
      "const documentDelta = await page.evaluate(() => {",
      "  const html = document.documentElement;",
      "  return html.scrollHeight - html.clientHeight;",
      "});",
      "const ALLOWANCE = 2;",
      "expect(documentDelta).toBeLessThanOrEqual(ALLOWANCE);",
    ].join("\n"),
    Number.POSITIVE_INFINITY,
    "flow",
  );

  // 11 · the live-metric exemption is fail-closed too: a name bound to a live
  // `window.` read in one place and to a positive literal in another is NOT
  // provably a baseline everywhere it is used, so it does not carry the
  // exemption — mirrors proof 8 for `regimeNames`.
  expectDetected(
    "a live-metric name rebound to a literal elsewhere in the file",
    [
      "const bodyWidth = await page.evaluate(() => document.body.scrollWidth);",
      "const viewportWidth = await page.evaluate(() => window.innerWidth);",
      "expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);",
      "const fallback = { viewportWidth: 5 };",
    ].join("\n"),
    Number.POSITIVE_INFINITY,
    "flow",
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

  // Regression proof for the real corpus finding on
  // admin-users-roles-pager-reachability.spec.ts: the carrier's PARAMETER
  // TYPE ANNOTATION (`documentAllowancePx: number`) matches the exact same
  // `identifier:` shape `documentBindings` uses for a VALUE binding. Before
  // `TS_PRIMITIVE_TYPE_KEYWORDS` excluded it, the type annotation counted as
  // a non-régime binding of the same name, and `regimeNames`'s "every binding
  // must be régime" rule then vetoed the real value binding at the call site
  // — a false negative that would have let ANY positive value smuggle through
  // a typed carrier undetected.
  accepted(
    "a carrier whose parameter also carries a TypeScript type annotation",
    [
      "return page.evaluate(",
      "  ({ documentAllowancePx }: { documentAllowancePx: number }) => {",
      "    const root = document.documentElement;",
      "    return { documentScrolls: root.scrollHeight - root.clientHeight > documentAllowancePx };",
      "  },",
      "  { documentAllowancePx: MAX_DOCUMENT_SCROLL_DELTA_PX },",
      ");",
    ].join("\n"),
  );

  // Regression proof for the real corpus finding across four public specs:
  // a bare identifier bound to ANOTHER live `window.`/`document.` read is the
  // comparison baseline itself, not a threshold (PR #1729 §4.B: must not
  // false-positive on `viewportHeight`-shaped comparisons).
  accepted(
    "a bare identifier proven to be another live viewport read",
    [
      "const bodyWidth = await page.evaluate(() => document.body.scrollWidth);",
      "const viewportWidth = await page.evaluate(() => window.innerWidth);",
      "expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);",
    ].join("\n"),
  );
  accepted(
    "a strictly-zero boolean",
    [
      "const html = document.documentElement;",
      "const reading = { scrolls: html.scrollHeight - html.clientHeight > 0 };",
    ].join("\n"),
  );

  // PR #1729 Codex P2 proof 4: the carrier proven bound to the owner, used
  // in a RAW comparison (not `+`) — the exact shape the bypass exploited.
  accepted(
    "a proven carrier used in a raw comparison",
    [
      "const documentAllowancePx = MAX_DOCUMENT_SCROLL_DELTA_PX;",
      "const root = document.documentElement;",
      "const reading = { documentScrolls: root.scrollHeight - root.clientHeight > documentAllowancePx };",
    ].join("\n"),
  );

  // PR #1729 Codex P2 proof 6: two document metrics compared directly, with
  // no subtraction and no slack, is the zero-margin invariant itself — not an
  // allowance wearing a member-expression disguise.
  accepted(
    "two document metrics compared directly (no allowance at all)",
    [
      "const root = document.documentElement;",
      "const reading = { documentScrolls: root.scrollHeight > root.clientHeight };",
    ].join("\n"),
  );

  // A matcher call whose argument is the bare owner symbol, not summed onto
  // anything, is the canonical form's sibling and must stay accepted.
  accepted(
    "the canonical form as a bare matcher argument",
    "expect(m.htmlScrollHeight - m.htmlClientHeight).toBeLessThanOrEqual(MAX_DOCUMENT_SCROLL_DELTA_PX);",
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

  // PR #1729 Codex P2 proof 7: a NAMED threshold guarding a non-document
  // container must not become a false positive now that named thresholds are
  // policed — it was never document-bound, so it never enters the régime.
  accepted(
    "a named threshold on an internal (non-document) container",
    [
      "const INTERNAL_ALLOWANCE = 2;",
      "const container = document.querySelector('.rows');",
      "const overflow = container.scrollHeight - container.clientHeight;",
      "expect(overflow).toBeLessThanOrEqual(INTERNAL_ALLOWANCE);",
      "const regionScrolls = container.scrollHeight - container.clientHeight > INTERNAL_ALLOWANCE;",
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
