#!/usr/bin/env node

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { basename, dirname, posix, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = resolve(process.cwd());
const EVENT_NAME = process.env.GITHUB_EVENT_NAME ?? "";
const EVENT_PATH = process.env.GITHUB_EVENT_PATH ?? "";
const SUMMARY_PATH = process.env.GITHUB_STEP_SUMMARY ?? "";

export const CATEGORY_ORDER = [
  "backend",
  "frontend",
  "tests",
  "workflows/CI",
  "database/migrations",
  "documentation",
  "dependencies/lockfiles",
  "scripts/tooling",
  "repository configuration",
  "other",
];

const SCOPE_LABEL_TO_CATEGORY = new Map([
  ["backend runtime", "backend"],
  ["frontend runtime", "frontend"],
  ["tests", "tests"],
  ["workflows/ci", "workflows/CI"],
  ["migrations/schema", "database/migrations"],
  ["docs", "documentation"],
  ["dependencies", "dependencies/lockfiles"],
  ["scripts/tooling", "scripts/tooling"],
  ["repository configuration", "repository configuration"],
  ["other", "other"],
]);

const SUPPORTING_CATEGORIES = new Set(["documentation", "tests"]);
const REQUIRED_SECTIONS = ["Summary", "Scope", "Validation", "Rollback"];
const EXTERNAL_SCHEMES = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
  "ftp:",
  "ftps:",
  "data:",
]);

const SENSITIVE_NAME_PATTERNS = [
  /(^|\/)\.env(?:[./_-].*)?$/i,
  /(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i,
  /(^|\/)\.netrc$/i,
  /(^|\/)(credentials?|service-account|firebase-service-account)[^/]*\.json$/i,
  /(^|\/)(secret|secrets)[^/]*\.(json|ya?ml|txt)$/i,
  /(^|\/).*(private|prod|production).*\.(pem|key|p12|pfx)$/i,
  /(^|\/).*(prod|production|dump|backup).*\.(sql|dump|bak|backup)$/i,
];

const SECRET_PATTERNS = [
  ["private key block", /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59,255}\b/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Stripe live secret key", /\bsk_live_[0-9A-Za-z]{24,}\b/],
  ["OpenAI project key", /\bsk-proj-[A-Za-z0-9_-]{20,}\b/],
  [
    "production credential URL",
    /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:@\s/]+:[^@\s]+@[^/\s]+/i,
  ],
  [
    "explicit production secret assignment",
    /\b(?:PROD|PRODUCTION)_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i,
  ],
];

const PLACEHOLDER_RE =
  /(example|placeholder|dummy|fake|sample|changeme|change-me|your[_-]|xxx|xxxxx|<[^>]+>|\.\.\.|localhost|127\.0\.0\.1|example\.com)/i;

function run(command, args, { check = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }

  if (check && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }

  return result;
}

function git(args, options = {}) {
  return run("git", args, options);
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function normalizeLabel(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function shortSha(value) {
  return value ? value.slice(0, 12) : "(missing)";
}

function ensureCommit(sha) {
  return /^[0-9a-f]{40}$/i.test(sha) && git(["cat-file", "-e", `${sha}^{commit}`]).status === 0;
}

function readEvent() {
  if (!EVENT_PATH) {
    return {};
  }

  return JSON.parse(readFileSync(EVENT_PATH, "utf8"));
}

function determineRange(event, addFailure, addDetail) {
  if (EVENT_NAME === "pull_request") {
    const pullRequest = event.pull_request ?? {};
    const baseSha = pullRequest.base?.sha?.trim?.() ?? "";
    const headSha = pullRequest.head?.sha?.trim?.() ?? "";

    if (!baseSha || !headSha) {
      addFailure("scope", "Cannot determine pull_request base/head SHA from the event payload.");
      return [baseSha, headSha];
    }

    if (!ensureCommit(baseSha)) {
      addFailure("scope", `Base SHA ${shortSha(baseSha)} is not available in the checkout.`);
    }

    if (!ensureCommit(headSha)) {
      addFailure("scope", `Head SHA ${shortSha(headSha)} is not available in the checkout.`);
    }

    return [baseSha, headSha];
  }

  if (EVENT_NAME === "workflow_dispatch") {
    const headSha = git(["rev-parse", "HEAD"], { check: true }).stdout.trim();
    const parent = git(["rev-parse", "HEAD^"]);

    if (parent.status !== 0) {
      addFailure("scope", "workflow_dispatch diagnostic range is HEAD^..HEAD, but HEAD has no parent.");
      return ["", headSha];
    }

    addDetail("scope", "workflow_dispatch uses the diagnostic range HEAD^..HEAD on the selected ref.");
    return [parent.stdout.trim(), headSha];
  }

  addFailure("scope", `Unsupported event for PR Governance: ${EVENT_NAME || "(empty)"}.`);
  return ["", ""];
}

function changedFiles(baseSha, headSha) {
  const output = git(
    ["diff", "--name-status", "-z", "--diff-filter=AMRD", baseSha, headSha],
    { check: true },
  ).stdout;
  const tokens = output.split("\0");

  if (tokens.at(-1) === "") {
    tokens.pop();
  }

  const entries = [];

  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];

    if (status.startsWith("R")) {
      const oldPath = normalizePath(tokens[index++]);
      const newPath = normalizePath(tokens[index++]);
      entries.push({
        status,
        path: newPath,
        oldPath,
        display: `${oldPath} -> ${newPath}`,
      });
      continue;
    }

    const path = normalizePath(tokens[index++]);
    entries.push({ status, path, oldPath: null, display: path });
  }

  return entries;
}

export function classifyPath(inputPath) {
  const lower = normalizePath(inputPath).toLowerCase();
  const name = basename(lower);

  if (lower.startsWith(".github/workflows/")) return "workflows/CI";
  if (lower.startsWith("frontend/")) return "frontend";
  if (lower.startsWith("server/")) return "backend";
  if (lower.startsWith("test/") || lower.includes("/test/") || lower.includes("/tests/")) return "tests";
  if (/(^|[._-])(test|spec)\.[cm]?[jt]sx?$/.test(name)) return "tests";
  if (lower.startsWith("drizzle/") || lower.includes("migration") || name === "drizzle.config.ts") {
    return "database/migrations";
  }
  if (lower.startsWith("docs/") || lower.endsWith(".md")) return "documentation";
  if (
    new Set([
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "yarn.lock",
      "npm-shrinkwrap.json",
    ]).has(name)
  ) {
    return "dependencies/lockfiles";
  }
  if (lower.startsWith("scripts/") || lower.startsWith("tools/")) return "scripts/tooling";
  if (
    lower.startsWith(".github/") ||
    lower.startsWith(".vscode/") ||
    new Set([
      ".gitignore",
      ".gitattributes",
      ".npmrc",
      ".pnpmrc",
      "agents.md",
      "tsconfig.json",
    ]).has(name)
  ) {
    return "repository configuration";
  }

  return "other";
}

export function extractSection(body, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(
    new RegExp(`^\\s*##\\s+${escaped}\\b(?<body>.*?)(?=^\\s*##\\s+|$)`, "ims"),
  );
  return match?.groups?.body ?? "";
}

function sectionPresent(body, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*##\\s+${escaped}\\b`, "im").test(body);
}

function parseScopeCheckboxes(scopeText) {
  const selected = [];
  const unknown = [];
  let exceptionChecked = false;
  const checkboxRe = /^\s*-\s*\[([ xX])\]\s+(.+?)\s*$/gm;

  for (const match of scopeText.matchAll(checkboxRe)) {
    if (match[1].toLowerCase() !== "x") continue;

    const rawLabel = normalizeLabel(match[2]);

    if (rawLabel.startsWith("mixed-scope exception")) {
      exceptionChecked = true;
      continue;
    }

    const category = SCOPE_LABEL_TO_CATEGORY.get(rawLabel);
    if (category) selected.push(category);
    else unknown.push(match[2].trim());
  }

  return {
    selected: [...new Set(selected)],
    unknown,
    exceptionChecked,
  };
}

export function derivePrimaryCategories(inputCategories) {
  const categories = [...new Set(inputCategories)];
  const core = categories.filter((category) => !SUPPORTING_CATEGORIES.has(category));

  if (core.length > 0) return core;
  if (categories.includes("tests")) return ["tests"];
  if (categories.includes("documentation")) return ["documentation"];
  return categories;
}

function sameSet(left, right) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function substantiveText(value) {
  return value
    .replace(/<!--.*?-->/gs, " ")
    .replace(/[`*_>#\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function evaluateScopeContract({ body, categories }) {
  const failures = [];
  const details = [];
  const scopeText = extractSection(body, "Scope");
  const { selected, unknown, exceptionChecked } = parseScopeCheckboxes(scopeText);
  const primary = derivePrimaryCategories(categories);

  details.push(`Detected primary categories: ${primary.join(", ") || "(none)"}.`);
  details.push(`Declared scope categories: ${selected.join(", ") || "(none)"}.`);
  details.push(`Mixed-scope exception: ${exceptionChecked}.`);

  if (unknown.length > 0) {
    failures.push(`Unknown checked scope option(s): ${unknown.join(", ")}.`);
  }

  if (selected.length === 0) {
    failures.push("Select at least one recognized scope checkbox in the Scope section.");
  }

  if (primary.length === 0) {
    failures.push("Cannot derive a governed scope from the changed-file categories.");
  }

  if (!exceptionChecked) {
    if (primary.length > 1) {
      failures.push(
        `Multiple primary scopes detected (${primary.join(", ")}); check the mixed-scope exception and add a substantive Mixed-Scope Justification section.`,
      );
    }

    if (selected.length !== 1) {
      failures.push("Exactly one scope checkbox must be selected when no mixed-scope exception is declared.");
    }

    if (primary.length === 1 && selected.length === 1 && selected[0] !== primary[0]) {
      failures.push(`Declared scope ${selected[0]} does not match detected scope ${primary[0]}.`);
    }
  }

  if (exceptionChecked) {
    if (primary.length < 2) {
      failures.push("Mixed-scope exception is only valid when at least two primary scopes are detected.");
    }

    if (selected.length < 2) {
      failures.push("Mixed-scope exception requires selecting every affected primary scope.");
    }

    if (!sameSet(selected, primary)) {
      failures.push(
        `Mixed-scope declaration must match detected primary scopes exactly. Declared: ${selected.join(", ") || "(none)"}; detected: ${primary.join(", ") || "(none)"}.`,
      );
    }

    const justification = substantiveText(extractSection(body, "Mixed-Scope Justification"));
    if (justification.length < 80) {
      failures.push(
        "Mixed-scope exception requires a substantive ## Mixed-Scope Justification section of at least 80 meaningful characters.",
      );
    }
  }

  if (primary.includes("other")) {
    const otherDetail = substantiveText(extractSection(body, "Other Scope Detail"));
    if (otherDetail.length < 40) {
      failures.push(
        "Changes classified as other require a substantive ## Other Scope Detail section of at least 40 meaningful characters.",
      );
    }
  }

  return { failures, details, primary, selected, exceptionChecked };
}

function validateDiffIntegrity(baseSha, headSha, pass, fail, detail) {
  const result = git(["diff", "--check", baseSha, headSha]);
  if (result.status === 0) {
    pass("diff integrity", "git diff --check completed without findings.");
    return;
  }

  const findings = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => line.slice(0, 180));
  fail("diff integrity", `git diff --check failed: ${findings.join("; ") || "unknown finding"}.`);
  detail("diff integrity", "Fix whitespace errors or conflict markers before merge.");
}

function validateSensitiveFiles(entries, pass, fail) {
  const findings = [];

  for (const entry of entries) {
    if (entry.status.startsWith("D")) continue;
    const lower = entry.path.toLowerCase();
    const base = basename(lower);
    const explicitExample = base.startsWith(".env") && /(example|sample|template|stub|mock)/.test(base);
    if (!explicitExample && SENSITIVE_NAME_PATTERNS.some((pattern) => pattern.test(lower))) {
      findings.push(entry.display);
    }
  }

  if (findings.length > 0) {
    fail("sensitive-file policy", `Blocked sensitive file path(s): ${findings.join("; ")}.`);
    return;
  }

  pass("sensitive-file policy", "No high-risk sensitive file paths detected.");
}

function parseAddedLines(baseSha, headSha) {
  const lines = git(
    ["diff", "--unified=0", "--no-ext-diff", "--no-color", baseSha, headSha],
    { check: true },
  ).stdout.split(/\r?\n/);
  const added = [];
  let currentFile = null;
  let newLine = null;

  for (const line of lines) {
    if (line.startsWith("+++ ")) {
      const marker = line.slice(4);
      currentFile = marker === "/dev/null" ? null : marker.replace(/^b\//, "");
      continue;
    }

    if (line.startsWith("@@ ")) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      newLine = match ? Number(match[1]) : null;
      continue;
    }

    if (currentFile === null || newLine === null) continue;

    if (line.startsWith("+") && !line.startsWith("+++ ")) {
      added.push({ path: currentFile, lineNumber: newLine, text: line.slice(1) });
      newLine += 1;
      continue;
    }

    if (!line.startsWith("-") || line.startsWith("--- ")) {
      newLine += 1;
    }
  }

  return added;
}

function validateSecretScan(baseSha, headSha, pass, fail) {
  const findings = [];

  for (const item of parseAddedLines(baseSha, headSha)) {
    if (PLACEHOLDER_RE.test(item.text)) continue;

    for (const [label, pattern] of SECRET_PATTERNS) {
      if (pattern.test(item.text)) {
        findings.push(`${item.path}:${item.lineNumber} (${label})`);
        break;
      }
    }
  }

  if (findings.length > 0) {
    fail(
      "secret scan",
      `High-confidence secret pattern(s) found in added lines: ${findings.slice(0, 30).join("; ")}.`,
    );
    return;
  }

  pass("secret scan", "No high-confidence secret patterns detected in added lines.");
}

function extractLinkTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  if (trimmed.startsWith("<") && trimmed.includes(">")) {
    return trimmed.slice(1, trimmed.indexOf(">"));
  }

  const titleMatch = trimmed.match(/^(.+?)\s+(["']).*\2\s*$/);
  return (titleMatch?.[1] ?? trimmed).trim();
}

function validateMarkdown(entries, pass, fail) {
  const markdownFiles = entries
    .filter((entry) => !entry.status.startsWith("D") && entry.path.toLowerCase().endsWith(".md"))
    .map((entry) => entry.path);

  if (markdownFiles.length === 0) {
    pass("Markdown", "No added or modified Markdown files.");
    return;
  }

  const findings = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const linkRe = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g;

  for (const relativeFile of markdownFiles) {
    const absoluteFile = resolve(ROOT, relativeFile);
    let content;

    try {
      const bytes = readFileSync(absoluteFile);
      if (bytes.includes(0)) {
        findings.push(`${relativeFile}: contains NUL byte`);
        continue;
      }
      content = decoder.decode(bytes);
    } catch (error) {
      findings.push(`${relativeFile}: cannot decode as UTF-8 (${error.name})`);
      continue;
    }

    for (const [index, line] of content.split(/\r?\n/).entries()) {
      if (/^(<<<<<<< .+|=======$|>>>>>>> .+)$/.test(line)) {
        findings.push(`${relativeFile}:${index + 1}: conflict marker`);
      }
    }

    for (const match of content.matchAll(linkRe)) {
      const target = extractLinkTarget(match[1]);
      if (!target || target.startsWith("#") || target.startsWith("//")) continue;

      let parsed;
      try {
        parsed = new URL(target, "https://local.invalid/");
      } catch {
        findings.push(`${relativeFile}: invalid link (${target})`);
        continue;
      }

      if (parsed.origin !== "https://local.invalid" || EXTERNAL_SCHEMES.has(parsed.protocol)) continue;

      const decodedPath = decodeURIComponent(parsed.pathname);
      const normalizedTarget = decodedPath.startsWith("/")
        ? posix.normalize(decodedPath.slice(1))
        : posix.normalize(posix.join(posix.dirname(relativeFile), decodedPath));
      const candidate = resolve(ROOT, normalizedTarget);
      const rootPrefix = ROOT.endsWith(sep) ? ROOT : `${ROOT}${sep}`;

      if (candidate !== ROOT && !candidate.startsWith(rootPrefix)) {
        findings.push(`${relativeFile}: local link leaves repository (${target})`);
      } else if (!existsSync(candidate)) {
        findings.push(`${relativeFile}: broken local link (${target})`);
      }
    }
  }

  if (findings.length > 0) {
    fail("Markdown", `Markdown validation failed: ${findings.slice(0, 30).join("; ")}.`);
    return;
  }

  pass(
    "Markdown",
    `Validated ${markdownFiles.length} Markdown file(s) for UTF-8, NUL bytes, conflict markers, and local links.`,
  );
}

function writeSummary({ baseSha, headSha, entries, categories, results, details, failures }) {
  if (!SUMMARY_PATH) return;

  const escape = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
  const lines = [
    "### PR Governance",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| event | \`${escape(EVENT_NAME || "(unknown)")}\` |`,
    `| base SHA | \`${shortSha(baseSha)}\` |`,
    `| head SHA | \`${shortSha(headSha)}\` |`,
    `| files | \`${entries.length}\` |`,
    "",
    "#### Categories",
    "",
    "| Category | Count |",
    "| --- | ---: |",
    ...CATEGORY_ORDER.map((category) => `| ${category} | ${categories.get(category)?.length ?? 0} |`),
    "",
    "#### Validation Results",
    "",
    "| Check | Result | Detail |",
    "| --- | --- | --- |",
    ...Object.keys(results).map(
      (name) => `| ${name} | \`${results[name]}\` | ${escape((details[name] ?? []).join("; ") || "-")} |`,
    ),
    "",
    "#### Conclusion",
    "",
    failures.length === 0 ? "`PASS`" : "`FAIL`",
    "",
  ];

  appendFileSync(SUMMARY_PATH, lines.join("\n"), "utf8");
}

export function main() {
  const failures = [];
  const results = {
    "diff integrity": "NOT RUN",
    "sensitive-file policy": "NOT RUN",
    "secret scan": "NOT RUN",
    Markdown: "NOT RUN",
    metadata: "NOT RUN",
    scope: "NOT RUN",
  };
  const details = Object.fromEntries(Object.keys(results).map((name) => [name, []]));

  const addFailure = (section, message) => {
    failures.push({ section, message });
    results[section] = "FAIL";
    details[section].push(message);
  };
  const addDetail = (section, message) => details[section].push(message);
  const pass = (section, message) => {
    if (results[section] !== "FAIL") results[section] = "PASS";
    details[section].push(message);
  };

  const event = readEvent();
  const [baseSha, headSha] = determineRange(event, addFailure, addDetail);
  let entries = [];
  const categories = new Map(CATEGORY_ORDER.map((category) => [category, []]));

  if (baseSha && headSha && ensureCommit(baseSha) && ensureCommit(headSha)) {
    try {
      entries = changedFiles(baseSha, headSha);
    } catch (error) {
      addFailure("scope", `Cannot build changed-file manifest: ${error.message}`);
    }

    if (entries.length === 0) {
      addFailure("scope", "The comparison range contains no added, modified, renamed, or deleted files.");
    }

    for (const entry of entries) {
      categories.get(classifyPath(entry.path)).push(entry.display);
    }

    if (entries.length > 0) {
      validateDiffIntegrity(baseSha, headSha, pass, addFailure, addDetail);
      validateSensitiveFiles(entries, pass, addFailure);
      validateSecretScan(baseSha, headSha, pass, addFailure);
      validateMarkdown(entries, pass, addFailure);

      if (EVENT_NAME === "pull_request") {
        const body = event.pull_request?.body ?? "";
        const missing = REQUIRED_SECTIONS.filter((section) => !sectionPresent(body, section));

        if (!body.trim()) {
          addFailure("metadata", "PR body is required and cannot be empty.");
        } else if (missing.length > 0) {
          addFailure("metadata", `PR body is missing required section(s): ${missing.join(", ")}.`);
        } else {
          pass("metadata", "Required PR body sections are present.");
        }

        const scopeContract = evaluateScopeContract({
          body,
          categories: entries.map((entry) => classifyPath(entry.path)),
        });
        scopeContract.details.forEach((message) => addDetail("scope", message));
        scopeContract.failures.forEach((message) => addFailure("scope", message));
        if (scopeContract.failures.length === 0) {
          pass("scope", "Declared scope matches the changed-file scope contract.");
        }
      } else {
        results.metadata = "N/A";
        results.scope = results.scope === "FAIL" ? "FAIL" : "N/A";
        addDetail("metadata", "Skipped for workflow_dispatch.");
        addDetail("scope", "Scope contract skipped for workflow_dispatch diagnostics.");
      }
    }
  }

  writeSummary({ baseSha, headSha, entries, categories, results, details, failures });

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`::error title=PR Governance ${failure.section}::${failure.message}`);
    }
    return 1;
  }

  console.log("PR Governance passed.");
  return 0;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  process.exit(main());
}
