#!/usr/bin/env node

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { basename, posix, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  renderQualityGateImpactSummary,
  validateQualityGateImpact,
} from "./quality-gate-impact-validator.mjs";

const ROOT = resolve(process.cwd());
const EVENT_NAME = process.env.GITHUB_EVENT_NAME ?? "";
const EVENT_PATH = process.env.GITHUB_EVENT_PATH ?? "";
const SUMMARY_PATH = process.env.GITHUB_STEP_SUMMARY ?? "";
const WORKFLOW_SECURITY_VALIDATOR_PATH = "scripts/governance/workflow-security-validator.mjs";
const WORKFLOW_SECURITY_DIRECTORY = ".github/workflows";

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

const REQUIRED_SECTIONS = ["Summary", "Scope", "Validation", "Rollback"];
const SUPPORTING_CATEGORIES = new Set(["documentation", "tests"]);
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

const SENSITIVE_PATH_PATTERNS = [
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

function runGit(args, check = false) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) throw result.error;
  if (check && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
  }
  return result;
}

function ensureCommit(sha) {
  return /^[0-9a-f]{40}$/i.test(sha) && runGit(["cat-file", "-e", `${sha}^{commit}`]).status === 0;
}

function shortSha(sha) {
  return sha ? sha.slice(0, 12) : "(missing)";
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function normalizeLabel(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractSection(body, sectionName) {
  const heading = new RegExp(`^\\s*##\\s+${escapeRegExp(sectionName)}\\s*$`, "im");
  const headingMatch = heading.exec(body);
  if (!headingMatch) return "";

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const remainder = body.slice(sectionStart);
  const nextHeading = /^\s*##\s+/m.exec(remainder);
  return nextHeading ? remainder.slice(0, nextHeading.index) : remainder;
}

function sectionPresent(body, sectionName) {
  return new RegExp(`^\\s*##\\s+${escapeRegExp(sectionName)}\\s*$`, "im").test(body);
}

export function classifyPath(inputPath) {
  const lower = normalizePath(inputPath).toLowerCase();
  const name = basename(lower);

  if (lower.startsWith(".github/workflows/")) return "workflows/CI";
  if (
    [
      "scripts/governance/pr-governance-validator.mjs",
      "scripts/governance/quality-gate-impact-policy.mjs",
      "scripts/governance/quality-gate-impact-policy.d.mts",
      "scripts/governance/workflow-security-policy.mjs",
      "scripts/governance/workflow-security-policy.d.mts",
      "scripts/governance/workflow-security-validator.mjs",
      "scripts/governance/workflow-security-validator.d.mts",
    ].includes(lower)
  ) {
    return "workflows/CI";
  }
  if (lower.startsWith("frontend/")) return "frontend";
  if (lower.startsWith("server/")) return "backend";
  if (lower.startsWith("test/") || lower.includes("/test/") || lower.includes("/tests/")) return "tests";
  if (/(^|[._-])(test|spec)\.[cm]?[jt]sx?$/.test(name)) return "tests";
  if (lower.startsWith("drizzle/") || lower.includes("migration") || name === "drizzle.config.ts") {
    return "database/migrations";
  }
  if (lower.startsWith("docs/") || lower.endsWith(".md")) return "documentation";
  if (
    [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "yarn.lock",
      "npm-shrinkwrap.json",
    ].includes(name)
  ) {
    return "dependencies/lockfiles";
  }
  if (lower.startsWith("scripts/") || lower.startsWith("tools/")) return "scripts/tooling";
  if (
    lower.startsWith(".github/") ||
    lower.startsWith(".vscode/") ||
    [".gitignore", ".gitattributes", ".npmrc", ".pnpmrc", ".cursorignore", "agents.md", "tsconfig.json"].includes(name)
  ) {
    return "repository configuration";
  }
  return "other";
}

export function derivePrimaryCategories(inputCategories) {
  const categories = [...new Set(inputCategories)];
  const core = categories.filter((category) => !SUPPORTING_CATEGORIES.has(category));
  if (core.length > 0) return core;
  if (categories.includes("tests")) return ["tests"];
  if (categories.includes("documentation")) return ["documentation"];
  return categories;
}

function parseScopeCheckboxes(scopeText) {
  const selected = [];
  const unknown = [];
  let exceptionChecked = false;

  for (const match of scopeText.matchAll(/^\s*-\s*\[([ xX])\]\s+(.+?)\s*$/gm)) {
    if (match[1].toLowerCase() !== "x") continue;
    const label = normalizeLabel(match[2]);

    if (label.startsWith("mixed-scope exception")) {
      exceptionChecked = true;
      continue;
    }

    const category = SCOPE_LABEL_TO_CATEGORY.get(label);
    if (category) selected.push(category);
    else unknown.push(match[2].trim());
  }

  return { selected: [...new Set(selected)], unknown, exceptionChecked };
}

function meaningfulText(value) {
  return value
    .replace(/<!--.*?-->/gs, " ")
    .replace(/[`*_>#\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameSet(left, right) {
  return left.length === right.length && left.every((value) => new Set(right).has(value));
}

export function evaluateScopeContract({ body, categories }) {
  const failures = [];
  const primary = derivePrimaryCategories(categories);
  const { selected, unknown, exceptionChecked } = parseScopeCheckboxes(extractSection(body, "Scope"));
  const details = [
    `Detected primary categories: ${primary.join(", ") || "(none)"}.`,
    `Declared scope categories: ${selected.join(", ") || "(none)"}.`,
    `Mixed-scope exception: ${exceptionChecked}.`,
  ];

  if (unknown.length > 0) failures.push(`Unknown checked scope option(s): ${unknown.join(", ")}.`);
  if (selected.length === 0) failures.push("Select at least one recognized scope checkbox in the Scope section.");
  if (primary.length === 0) failures.push("Cannot derive a governed scope from the changed-file categories.");

  if (!exceptionChecked) {
    if (primary.length > 1) {
      failures.push(
        `Multiple primary scopes detected (${primary.join(", ")}); check the mixed-scope exception and add a substantive Mixed-Scope Justification section.`,
      );
    }
    if (selected.length !== 1) {
      failures.push("Exactly one scope checkbox must be selected when no mixed-scope exception is declared.");
    }
    if (primary.length === 1 && selected.length === 1 && primary[0] !== selected[0]) {
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
    if (meaningfulText(extractSection(body, "Mixed-Scope Justification")).length < 80) {
      failures.push(
        "Mixed-scope exception requires a substantive ## Mixed-Scope Justification section of at least 80 meaningful characters.",
      );
    }
  }

  if (
    primary.includes("other") &&
    meaningfulText(extractSection(body, "Other Scope Detail")).length < 40
  ) {
    failures.push(
      "Changes classified as other require a substantive ## Other Scope Detail section of at least 40 meaningful characters.",
    );
  }

  return { failures, details, primary, selected, exceptionChecked };
}

function readEvent() {
  return EVENT_PATH ? JSON.parse(readFileSync(EVENT_PATH, "utf8")) : {};
}

function determineRange(event, fail, detail) {
  if (EVENT_NAME === "pull_request") {
    const baseSha = event.pull_request?.base?.sha?.trim?.() ?? "";
    const headSha = event.pull_request?.head?.sha?.trim?.() ?? "";
    if (!baseSha || !headSha) fail("scope", "Cannot determine pull_request base/head SHA.");
    if (baseSha && !ensureCommit(baseSha)) fail("scope", `Base SHA ${shortSha(baseSha)} is unavailable.`);
    if (headSha && !ensureCommit(headSha)) fail("scope", `Head SHA ${shortSha(headSha)} is unavailable.`);
    return [baseSha, headSha];
  }

  if (EVENT_NAME === "workflow_dispatch") {
    const headSha = runGit(["rev-parse", "HEAD"], true).stdout.trim();
    const parent = runGit(["rev-parse", "HEAD^"]);
    if (parent.status !== 0) {
      fail("scope", "workflow_dispatch diagnostic range requires a parent commit.");
      return ["", headSha];
    }
    detail("scope", "workflow_dispatch uses HEAD^..HEAD and skips PR metadata/scope declarations.");
    return [parent.stdout.trim(), headSha];
  }

  fail("scope", `Unsupported event: ${EVENT_NAME || "(empty)"}.`);
  return ["", ""];
}

function changedFiles(baseSha, headSha) {
  const tokens = runGit(
    ["diff", "--name-status", "-z", "--diff-filter=AMRD", baseSha, headSha],
    true,
  ).stdout.split("\0");
  if (tokens.at(-1) === "") tokens.pop();

  const entries = [];
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];
    if (status.startsWith("R")) {
      const oldPath = normalizePath(tokens[index++]);
      const newPath = normalizePath(tokens[index++]);
      entries.push({ status, path: newPath, oldPath, newPath, display: `${oldPath} -> ${newPath}` });
    } else {
      const path = normalizePath(tokens[index++]);
      entries.push({ status, path, display: path });
    }
  }
  return entries;
}

function validateDiff(baseSha, headSha, pass, fail) {
  const result = runGit(["diff", "--check", baseSha, headSha]);
  if (result.status === 0) {
    pass("diff integrity", "git diff --check completed without findings.");
  } else {
    fail(
      "diff integrity",
      `git diff --check failed: ${`${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(Boolean).slice(0, 20).join("; ")}.`,
    );
  }
}

function validateSensitivePaths(entries, pass, fail) {
  const findings = entries
    .filter((entry) => !entry.status.startsWith("D"))
    .filter((entry) => {
      const lower = entry.path.toLowerCase();
      const base = basename(lower);
      const envExample = base.startsWith(".env") && /(example|sample|template|stub|mock)/.test(base);
      return !envExample && SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(lower));
    })
    .map((entry) => entry.display);

  if (findings.length > 0) fail("sensitive-file policy", `Blocked sensitive path(s): ${findings.join("; ")}.`);
  else pass("sensitive-file policy", "No high-risk sensitive paths detected.");
}

function addedLines(baseSha, headSha) {
  const diff = runGit(
    ["diff", "--unified=0", "--no-ext-diff", "--no-color", baseSha, headSha],
    true,
  ).stdout.split(/\r?\n/);
  const lines = [];
  let currentFile = null;
  let newLine = null;

  for (const line of diff) {
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
      lines.push({ path: currentFile, lineNumber: newLine, text: line.slice(1) });
      newLine += 1;
    } else if (!line.startsWith("-")) {
      newLine += 1;
    }
  }
  return lines;
}

function validateSecrets(baseSha, headSha, pass, fail) {
  const findings = [];
  for (const line of addedLines(baseSha, headSha)) {
    if (PLACEHOLDER_RE.test(line.text)) continue;
    const matched = SECRET_PATTERNS.find(([, pattern]) => pattern.test(line.text));
    if (matched) findings.push(`${line.path}:${line.lineNumber} (${matched[0]})`);
  }

  if (findings.length > 0) {
    fail("secret scan", `High-confidence secret pattern(s): ${findings.slice(0, 30).join("; ")}.`);
  } else {
    pass("secret scan", "No high-confidence secret patterns detected in added lines.");
  }
}

function extractLinkTarget(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<") && trimmed.includes(">")) return trimmed.slice(1, trimmed.indexOf(">"));
  return (trimmed.match(/^(.+?)\s+(["']).*\2\s*$/)?.[1] ?? trimmed).trim();
}

function validateMarkdown(entries, pass, fail) {
  const files = entries
    .filter((entry) => !entry.status.startsWith("D") && entry.path.toLowerCase().endsWith(".md"))
    .map((entry) => entry.path);
  if (files.length === 0) {
    pass("Markdown", "No added or modified Markdown files.");
    return;
  }

  const findings = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const linkRe = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g;

  for (const relativeFile of files) {
    let content;
    try {
      const bytes = readFileSync(resolve(ROOT, relativeFile));
      if (bytes.includes(0)) {
        findings.push(`${relativeFile}: contains NUL byte`);
        continue;
      }
      content = decoder.decode(bytes);
    } catch (error) {
      findings.push(`${relativeFile}: invalid UTF-8 or unreadable (${error.name})`);
      continue;
    }

    content.split(/\r?\n/).forEach((line, index) => {
      if (/^(<<<<<<< .+|=======$|>>>>>>> .+)$/.test(line)) {
        findings.push(`${relativeFile}:${index + 1}: conflict marker`);
      }
    });

    for (const match of content.matchAll(linkRe)) {
      const target = extractLinkTarget(match[1]);
      if (!target || target.startsWith("#") || target.startsWith("//")) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;

      const withoutFragment = target.split("#", 1)[0].split("?", 1)[0];
      if (!withoutFragment) continue;
      const decoded = decodeURIComponent(withoutFragment);
      const repoPath = decoded.startsWith("/")
        ? posix.normalize(decoded.slice(1))
        : posix.normalize(posix.join(posix.dirname(relativeFile), decoded));
      const candidate = resolve(ROOT, repoPath);
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
  } else {
    pass("Markdown", `Validated ${files.length} Markdown file(s).`);
  }
}

function runWorkflowSecurityControl() {
  const validatorPath = resolve(ROOT, WORKFLOW_SECURITY_VALIDATOR_PATH);
  const workflowsPath = resolve(ROOT, WORKFLOW_SECURITY_DIRECTORY);

  if (!existsSync(validatorPath)) {
    if (existsSync(workflowsPath)) {
      return {
        passed: false,
        failures: [`Workflow security validator is missing: ${WORKFLOW_SECURITY_VALIDATOR_PATH}`],
        details: [],
        policyVersion: "unknown",
        workflows: [],
        externalActions: [],
        localActions: [],
        permissions: [],
        containerImages: [],
        exceptionsUsed: [],
      };
    }

    return {
      passed: true,
      failures: [],
      details: ["Workflow security fixture has no tracked workflows."],
      policyVersion: "fixture",
      workflows: [],
      externalActions: [],
      localActions: [],
      permissions: [],
      containerImages: [],
      exceptionsUsed: [],
    };
  }

  const result = spawnSync("node", [WORKFLOW_SECURITY_VALIDATOR_PATH, "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) throw result.error;

  let report;
  try {
    report = JSON.parse(result.stdout || "{}");
  } catch (error) {
    return {
      passed: false,
      failures: [`Workflow security validation returned invalid JSON: ${error.message}`],
      details: [],
      policyVersion: "unknown",
      workflows: [],
      externalActions: [],
      localActions: [],
      permissions: [],
      containerImages: [],
      exceptionsUsed: [],
    };
  }

  if (result.status !== 0 && report.failures?.length === 0) {
    report.failures = [`Workflow security validation failed: ${(result.stderr || result.stdout || "unknown error").trim()}`];
    report.passed = false;
  }

  return report;
}

function renderWorkflowSecuritySummary(report) {
  if (!report) return "";

  const workflowRows = (report.workflows ?? []).map((workflow) => {
    const permissions = workflow.permissions?.scalar
      ? workflow.permissions.scalar
      : Object.entries(workflow.permissions?.entries ?? {})
        .map(([key, entry]) => `${key}: ${entry.value}`)
        .join(", ") || "(missing)";
    return `| \`${workflow.path}\` | \`${permissions}\` | \`${workflow.externalActions?.length ?? 0}\` | \`${workflow.containerImages?.length ?? 0}\` |`;
  });

  return [
    "## Workflow security",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| policy version | \`${report.policyVersion ?? "unknown"}\` |`,
    `| result | \`${report.passed ? "PASS" : "FAIL"}\` |`,
    `| workflows | \`${report.workflows?.length ?? 0}\` |`,
    `| external actions | \`${report.externalActions?.length ?? 0}\` |`,
    `| local actions | \`${report.localActions?.length ?? 0}\` |`,
    `| permissions | \`${(report.failures ?? []).some((failure) => failure.includes("permission")) ? "FAIL" : "PASS"}\` |`,
    `| container policy | \`${(report.failures ?? []).some((failure) => failure.includes("container image")) ? "FAIL" : "PASS"}\` |`,
    `| exceptions used | \`${report.exceptionsUsed?.length ?? 0}\` |`,
    "",
    "### Workflows",
    "",
    "| Workflow | Permissions | External actions | Container images |",
    "| --- | --- | ---: | ---: |",
    ...(workflowRows.length > 0 ? workflowRows : ["| n/a | n/a | 0 | 0 |"]),
    "",
  ].join("\n");
}

function writeSummary({ baseSha, headSha, entries, categories, results, details, failures, qualityImpact, workflowSecurity }) {
  if (!SUMMARY_PATH) return;
  const escape = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
  const rows = Object.keys(results).map(
    (name) => `| ${name} | \`${results[name]}\` | ${escape(details[name].join("; ") || "-")} |`,
  );
  const categoryRows = CATEGORY_ORDER.map(
    (category) => `| ${category} | ${categories.get(category)?.length ?? 0} |`,
  );

  appendFileSync(
    SUMMARY_PATH,
    [
      "### PR Governance",
      "",
      "| Field | Value |",
      "| --- | --- |",
      `| event | \`${EVENT_NAME || "(unknown)"}\` |`,
      `| base SHA | \`${shortSha(baseSha)}\` |`,
      `| head SHA | \`${shortSha(headSha)}\` |`,
      `| files | \`${entries.length}\` |`,
      "",
      "#### Categories",
      "",
      "| Category | Count |",
      "| --- | ---: |",
      ...categoryRows,
      "",
      "#### Validation Results",
      "",
      "| Check | Result | Detail |",
      "| --- | --- | --- |",
      ...rows,
      "",
      "#### Conclusion",
      "",
      failures.length === 0 ? "`PASS`" : "`FAIL`",
      "",
      renderQualityGateImpactSummary(qualityImpact).trimEnd(),
      "",
      renderWorkflowSecuritySummary(workflowSecurity).trimEnd(),
      "",
    ].join("\n"),
    "utf8",
  );
}

export function main() {
  const failures = [];
  const results = {
    "diff integrity": "NOT RUN",
    "sensitive-file policy": "NOT RUN",
    "secret scan": "NOT RUN",
    Markdown: "NOT RUN",
    "quality gate impact": "NOT RUN",
    "workflow security": "NOT RUN",
    metadata: "NOT RUN",
    scope: "NOT RUN",
  };
  const details = Object.fromEntries(Object.keys(results).map((name) => [name, []]));
  const fail = (section, message) => {
    failures.push({ section, message });
    results[section] = "FAIL";
    details[section].push(message);
  };
  const pass = (section, message) => {
    if (results[section] !== "FAIL") results[section] = "PASS";
    details[section].push(message);
  };
  const detail = (section, message) => details[section].push(message);

  const event = readEvent();
  const [baseSha, headSha] = determineRange(event, fail, detail);
  let entries = [];
  let qualityImpact = null;
  let workflowSecurity = null;
  const categories = new Map(CATEGORY_ORDER.map((category) => [category, []]));

  if (baseSha && headSha && ensureCommit(baseSha) && ensureCommit(headSha)) {
    try {
      entries = changedFiles(baseSha, headSha);
    } catch (error) {
      fail("scope", `Cannot build changed-file manifest: ${error.message}`);
    }

    if (entries.length === 0) fail("scope", "The comparison range contains no changed files.");
    entries.forEach((entry) => categories.get(classifyPath(entry.path)).push(entry.display));

    try {
      workflowSecurity = runWorkflowSecurityControl();
      (workflowSecurity.details ?? []).forEach((message) => detail("workflow security", message));
      (workflowSecurity.failures ?? []).forEach((message) => fail("workflow security", message));
      if ((workflowSecurity.failures ?? []).length === 0) {
        pass("workflow security", "Workflow security validation passed.");
      }
    } catch (error) {
      fail("workflow security", `Workflow security validation crashed: ${error.message}`);
    }

    if (entries.length > 0) {
      validateDiff(baseSha, headSha, pass, fail);
      validateSensitivePaths(entries, pass, fail);
      validateSecrets(baseSha, headSha, pass, fail);
      validateMarkdown(entries, pass, fail);

      try {
        qualityImpact = validateQualityGateImpact({ entries, rootDir: ROOT });
        qualityImpact.details.forEach((message) => detail("quality gate impact", message));
        qualityImpact.failures.forEach((message) => fail("quality gate impact", message));
        if (qualityImpact.failures.length === 0) {
          pass("quality gate impact", "Quality gate impact routing and taxonomy validation passed.");
        }
      } catch (error) {
        fail("quality gate impact", `Quality gate impact validation crashed: ${error.message}`);
      }

      if (EVENT_NAME === "pull_request") {
        const body = event.pull_request?.body ?? "";
        const missing = REQUIRED_SECTIONS.filter((section) => !sectionPresent(body, section));
        if (!body.trim()) fail("metadata", "PR body is required and cannot be empty.");
        else if (missing.length > 0) fail("metadata", `Missing required section(s): ${missing.join(", ")}.`);
        else pass("metadata", "Required PR body sections are present.");

        const scope = evaluateScopeContract({
          body,
          categories: entries.map((entry) => classifyPath(entry.path)),
        });
        scope.details.forEach((message) => detail("scope", message));
        scope.failures.forEach((message) => fail("scope", message));
        if (scope.failures.length === 0) pass("scope", "Declared scope matches changed files.");
      } else {
        results.metadata = "N/A";
        if (results.scope !== "FAIL") results.scope = "N/A";
        detail("metadata", "Skipped for workflow_dispatch.");
      }
    }
  }

  writeSummary({ baseSha, headSha, entries, categories, results, details, failures, qualityImpact, workflowSecurity });

  if (failures.length > 0) {
    failures.forEach(({ section, message }) =>
      console.error(`::error title=PR Governance ${section}::${message}`),
    );
    return 1;
  }

  if (results["quality gate impact"] === "PASS") {
    console.log("Quality gate impact PASS.");
  }
  if (results["workflow security"] === "PASS") {
    console.log("Workflow security PASS.");
  }
  console.log("PR Governance passed.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main());
}
