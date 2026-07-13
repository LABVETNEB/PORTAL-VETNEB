import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DIRECT_COMMAND_ALLOWLIST,
  IMPACT_RULES,
  POLICY_VERSION,
  QUALITY_GATES,
  README_MARKERS,
  REQUIRED_SOURCE_PATHS,
  TEST_TAXONOMY,
} from "./quality-gate-impact-policy.mjs";

const ROOT_PACKAGE_PATH = "package.json";
const FRONTEND_PACKAGE_PATH = "frontend/package.json";
const TEST_README_PATH = "test/README.md";

function unique(values) {
  return [...new Set(values)];
}

function normalizePath(value) {
  return String(value).replaceAll("\\", "/");
}

function normalizeMarkdown(value) {
  const normalized = String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n*$/g, "\n");
  return normalized;
}

function formatList(values) {
  return values.length > 0 ? values.join(", ") : "(none)";
}

function uniqueById(values) {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

function commandText(command) {
  return command.command;
}

function commandSort(left, right) {
  return commandText(left).localeCompare(commandText(right));
}

function gateById(gates = QUALITY_GATES) {
  return new Map(gates.map((gate) => [gate.id, gate]));
}

function suiteById(taxonomy = TEST_TAXONOMY) {
  return new Map(taxonomy.map((suite) => [suite.id, suite]));
}

function isRootMarkdown(path) {
  return !path.includes("/") && path.toLowerCase().endsWith(".md");
}

export function findImpactRuleForPath(inputPath, rules = IMPACT_RULES) {
  const path = normalizePath(inputPath);

  for (const rule of rules) {
    if (rule.matcher.type === "exact" && path === rule.matcher.path) return rule;
    if (rule.matcher.type === "prefix" && path.startsWith(rule.matcher.path)) return rule;
    if (rule.matcher.type === "root-markdown" && isRootMarkdown(path)) return rule;
  }

  return null;
}

function impactPathsForEntry(entry) {
  const status = String(entry.status ?? "");
  const paths = [];
  const push = (role, value) => {
    if (!value) return;
    const path = normalizePath(value);
    if (!paths.some((candidate) => candidate.path === path)) paths.push({ role, path });
  };

  if (status.startsWith("R")) {
    push("old", entry.oldPath);
    push("new", entry.newPath ?? entry.path);
  } else {
    push("path", entry.path);
  }

  if (paths.length === 0) push("path", entry.path);
  return paths;
}

export function validateImpactPolicy({
  gates = QUALITY_GATES,
  rules = IMPACT_RULES,
  taxonomy = TEST_TAXONOMY,
} = {}) {
  const failures = [];
  const gateIds = gates.map((gate) => gate.id);
  const ruleIds = rules.map((rule) => rule.id);
  const suiteIds = taxonomy.map((suite) => suite.id);
  const gateMap = gateById(gates);
  const suiteMap = suiteById(taxonomy);

  if (new Set(gateIds).size !== gateIds.length) failures.push("Quality gate IDs must be unique.");
  if (new Set(ruleIds).size !== ruleIds.length) failures.push("Quality gate impact rule IDs must be unique.");
  if (new Set(suiteIds).size !== suiteIds.length) failures.push("Quality gate taxonomy suite IDs must be unique.");

  for (const rule of rules) {
    if (!rule.id || !rule.matcher || !Array.isArray(rule.gates) || rule.gates.length === 0) {
      failures.push(`Quality gate impact rule is incomplete: ${rule.id || "(missing id)"}.`);
      continue;
    }
    if (rule.matcher.type === "exact" && !rule.matcher.path) {
      failures.push(`Quality gate impact rule ${rule.id} has an empty exact path.`);
    }
    if (rule.matcher.type === "prefix" && !rule.matcher.path) {
      failures.push(`Quality gate impact rule ${rule.id} has an empty prefix path.`);
    }
    if (!["exact", "prefix", "root-markdown"].includes(rule.matcher.type)) {
      failures.push(`Quality gate impact rule ${rule.id} has an invalid matcher type.`);
    }
    for (const gateId of rule.gates) {
      if (!gateMap.has(gateId)) failures.push(`Quality gate impact rule ${rule.id} references unknown gate: ${gateId}.`);
    }
    for (const suiteId of rule.suiteIds ?? []) {
      if (!suiteMap.has(suiteId)) failures.push(`Quality gate impact rule ${rule.id} references unknown suite: ${suiteId}.`);
    }
  }

  for (const suite of taxonomy) {
    if (!suite.gate || !gateMap.has(suite.gate)) {
      failures.push(`Quality gate taxonomy suite ${suite.id} references unknown gate: ${suite.gate || "(missing)"}.`);
    }
    if (!Array.isArray(suite.commands) || suite.commands.length === 0) {
      failures.push(`Quality gate taxonomy suite ${suite.id} has no commands.`);
    }
  }

  return { passed: failures.length === 0, failures };
}

export function validateRulePrecedence({
  rules = IMPACT_RULES,
  specificPath,
  generalPath,
  expectedSpecificRuleId,
  expectedGeneralRuleId,
}) {
  const specific = findImpactRuleForPath(specificPath, rules);
  const general = findImpactRuleForPath(generalPath, rules);
  const failures = [];

  if (specific?.id !== expectedSpecificRuleId) {
    failures.push(`Expected ${specificPath} to resolve to ${expectedSpecificRuleId}, got ${specific?.id || "(none)"}.`);
  }
  if (general?.id !== expectedGeneralRuleId) {
    failures.push(`Expected ${generalPath} to resolve to ${expectedGeneralRuleId}, got ${general?.id || "(none)"}.`);
  }

  return { passed: failures.length === 0, failures };
}

export function parsePackageScripts(packageJsonText, label) {
  const parsed = JSON.parse(packageJsonText);
  if (!parsed || typeof parsed !== "object" || !parsed.scripts || typeof parsed.scripts !== "object") {
    throw new Error(`Package file ${label} does not contain a scripts object.`);
  }
  return parsed.scripts;
}

export function collectPolicyCommands({
  gates = QUALITY_GATES,
  taxonomy = TEST_TAXONOMY,
} = {}) {
  const commands = [];
  for (const gate of gates) commands.push(...(gate.commands ?? []));
  for (const suite of taxonomy) commands.push(...(suite.commands ?? []));
  return commands;
}

export function validateCommandReferences({
  rootPackageJsonText,
  frontendPackageJsonText,
  commands = collectPolicyCommands(),
  directAllowlist = DIRECT_COMMAND_ALLOWLIST,
}) {
  const failures = [];
  const rootScripts = parsePackageScripts(rootPackageJsonText, ROOT_PACKAGE_PATH);
  const frontendScripts = parsePackageScripts(frontendPackageJsonText, FRONTEND_PACKAGE_PATH);
  const allowedDirect = new Set(directAllowlist.map((entry) => entry.command));

  for (const command of commands) {
    if (command.type === "package-script") {
      if (command.packageScope === "root" && !Object.hasOwn(rootScripts, command.script)) {
        failures.push(`Quality gate taxonomy references missing root script: ${command.script}`);
      } else if (command.packageScope === "frontend" && !Object.hasOwn(frontendScripts, command.script)) {
        failures.push(`Quality gate taxonomy references missing frontend script: ${command.script}`);
      } else if (!["root", "frontend"].includes(command.packageScope)) {
        failures.push(`Quality gate taxonomy references invalid package scope: ${command.packageScope}`);
      }
    } else if (command.type === "direct") {
      if (!allowedDirect.has(command.command)) {
        failures.push(`Quality gate taxonomy references non-package command without allowlist entry: ${command.command}`);
      }
    } else {
      failures.push(`Quality gate taxonomy references unsupported command type: ${command.type || "(missing)"}`);
    }
  }

  return { passed: failures.length === 0, failures };
}

export function renderTestTaxonomyProjection({
  taxonomy = TEST_TAXONOMY,
  gates = QUALITY_GATES,
} = {}) {
  const gatesById = gateById(gates);
  const rows = [...taxonomy]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((suite) => {
      const gate = gatesById.get(suite.gate);
      const commands = [...suite.commands].sort(commandSort).map((command) => `\`${command.command}\``).join("<br>");
      const paths = suite.representativePaths.map((path) => `\`${path}\``).join("<br>");

      return `| \`${suite.id}\` | ${suite.purpose} | \`${suite.gate}\` (${gate?.execution ?? "unknown"}) | \`${suite.packageScope}\` | ${commands} | ${paths} | \`${suite.requirement}\` |`;
    });

  return normalizeMarkdown([
    "_Generated from `scripts/governance/quality-gate-impact-policy.mjs`. Do not edit this block manually._",
    "",
    "| Suite ID | Purpose | Gate | Package scope | Commands | Representative paths | Requirement |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n"));
}

export function renderReadmeTaxonomyBlock(options = {}) {
  return normalizeMarkdown([
    README_MARKERS.start,
    renderTestTaxonomyProjection(options).trimEnd(),
    README_MARKERS.end,
    "",
  ].join("\n"));
}

function markerIndexes(readmeText, marker) {
  const indexes = [];
  let position = readmeText.indexOf(marker);
  while (position !== -1) {
    indexes.push(position);
    position = readmeText.indexOf(marker, position + marker.length);
  }
  return indexes;
}

export function validateReadmeTaxonomyProjection({
  readmeText,
  expectedProjection = renderTestTaxonomyProjection(),
  markers = README_MARKERS,
} = {}) {
  const text = String(readmeText ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const startIndexes = markerIndexes(text, markers.start);
  const endIndexes = markerIndexes(text, markers.end);
  const failures = [];

  if (startIndexes.length === 0) failures.push("test/README.md quality gate taxonomy start marker is missing.");
  if (endIndexes.length === 0) failures.push("test/README.md quality gate taxonomy end marker is missing.");
  if (startIndexes.length > 1) failures.push("test/README.md quality gate taxonomy start marker is duplicated.");
  if (endIndexes.length > 1) failures.push("test/README.md quality gate taxonomy end marker is duplicated.");
  if (failures.length > 0) return { passed: false, failures };

  const start = startIndexes[0];
  const end = endIndexes[0];
  if (start > end) {
    return {
      passed: false,
      failures: ["test/README.md quality gate taxonomy markers are in an invalid order."],
    };
  }

  const inner = text.slice(start + markers.start.length, end).replace(/^[ \t]*\n/, "");
  if (normalizeMarkdown(inner) !== normalizeMarkdown(expectedProjection)) {
    return {
      passed: false,
      failures: ["test/README.md quality gate taxonomy is out of sync with the executable policy."],
    };
  }

  return { passed: true, failures: [] };
}

export function evaluateChangedPathImpact({
  entries,
  rules = IMPACT_RULES,
  gates = QUALITY_GATES,
  taxonomy = TEST_TAXONOMY,
  requiredSourcePaths = REQUIRED_SOURCE_PATHS,
} = {}) {
  const failures = [];
  const gateMap = gateById(gates);
  const suiteMap = suiteById(taxonomy);
  const changedPaths = [];
  const impactedGateIds = new Set();
  const impactedSuiteIds = new Set();
  const impactedImpactIds = new Set();

  for (const entry of entries ?? []) {
    const path = normalizePath(entry.path);
    const oldPath = entry.oldPath ? normalizePath(entry.oldPath) : undefined;
    const newPath = entry.newPath ? normalizePath(entry.newPath) : undefined;
    const impactPaths = impactPathsForEntry({ ...entry, path, oldPath, newPath });
    const routes = [];
    const rulesForPath = [];
    const impactsForPath = new Set();
    const gateIdsForPath = new Set();
    const suiteIdsForPath = new Set();

    for (const impactPath of impactPaths) {
      const rule = findImpactRuleForPath(impactPath.path, rules);
      routes.push({ ...impactPath, rule });

      if (!rule) {
        failures.push(`Quality gate impact policy has no route for changed path: ${impactPath.path}`);
        continue;
      }

      rulesForPath.push(rule);
      for (const impact of rule.impacts ?? []) {
        impactsForPath.add(impact);
        impactedImpactIds.add(impact);
      }
      for (const gateId of rule.gates) gateIdsForPath.add(gateId);
      for (const suiteId of rule.suiteIds ?? []) suiteIdsForPath.add(suiteId);
    }

    if (String(entry.status ?? "").startsWith("D") && requiredSourcePaths.includes(path)) {
      failures.push(`Quality gate impact policy cannot delete required source: ${path}`);
    }

    for (const gateId of gateIdsForPath) {
      impactedGateIds.add(gateId);
    }
    for (const suiteId of suiteIdsForPath) {
      impactedSuiteIds.add(suiteId);
    }

    const routedRules = uniqueById(rulesForPath);
    changedPaths.push({
      ...entry,
      path,
      oldPath,
      newPath,
      rule: routedRules[0] ?? null,
      rules: routedRules,
      routes,
      impacts: [...impactsForPath],
      gates: [...gateIdsForPath].map((id) => gateMap.get(id) ?? { id, execution: "unknown", required: false }),
      suites: [...suiteIdsForPath].map((id) => suiteMap.get(id) ?? { id }),
    });
  }

  return {
    passed: failures.length === 0,
    failures,
    changedPaths,
    impactedImpacts: [...impactedImpactIds],
    impactedGates: [...impactedGateIds].map((id) => gateMap.get(id) ?? { id, execution: "unknown", required: false }),
    impactedSuites: [...impactedSuiteIds].map((id) => suiteMap.get(id) ?? { id }),
  };
}

export function evaluateQualityGateImpact({
  entries,
  rootPackageJsonText,
  frontendPackageJsonText,
  readmeText,
  gates = QUALITY_GATES,
  rules = IMPACT_RULES,
  taxonomy = TEST_TAXONOMY,
} = {}) {
  const failures = [];
  const details = [];

  const policy = validateImpactPolicy({ gates, rules, taxonomy });
  if (!policy.passed) failures.push(...policy.failures);
  else details.push("Impact policy structure is valid.");

  const commands = validateCommandReferences({
    rootPackageJsonText,
    frontendPackageJsonText,
    commands: collectPolicyCommands({ gates, taxonomy }),
  });
  if (!commands.passed) failures.push(...commands.failures);
  else details.push("Package script references are valid.");

  const readme = validateReadmeTaxonomyProjection({ readmeText, expectedProjection: renderTestTaxonomyProjection({ taxonomy, gates }) });
  if (!readme.passed) failures.push(...readme.failures);
  else details.push("test/README.md taxonomy projection is synchronized.");

  const impact = evaluateChangedPathImpact({ entries, rules, gates, taxonomy });
  if (!impact.passed) failures.push(...impact.failures);
  else details.push("All changed paths are classified by impact policy.");

  return {
    passed: failures.length === 0,
    failures,
    details,
    policyVersion: POLICY_VERSION,
    changedPaths: impact.changedPaths,
    impactedImpacts: impact.impactedImpacts,
    impactedGates: impact.impactedGates,
    impactedSuites: impact.impactedSuites,
    scriptsPassed: commands.passed,
    readmePassed: readme.passed,
  };
}

export function validateQualityGateImpact({ entries, rootDir = process.cwd() } = {}) {
  let rootPackageJsonText;
  let frontendPackageJsonText;
  let readmeText;
  const failures = [];

  try {
    rootPackageJsonText = readFileSync(resolve(rootDir, ROOT_PACKAGE_PATH), "utf8");
  } catch (error) {
    failures.push(`Quality gate impact cannot read ${ROOT_PACKAGE_PATH}: ${error.message}`);
  }

  try {
    frontendPackageJsonText = readFileSync(resolve(rootDir, FRONTEND_PACKAGE_PATH), "utf8");
  } catch (error) {
    failures.push(`Quality gate impact cannot read ${FRONTEND_PACKAGE_PATH}: ${error.message}`);
  }

  try {
    readmeText = readFileSync(resolve(rootDir, TEST_README_PATH), "utf8");
  } catch (error) {
    failures.push(`Quality gate impact cannot read ${TEST_README_PATH}: ${error.message}`);
  }

  if (failures.length > 0) {
    return {
      passed: false,
      failures,
      details: [],
      policyVersion: POLICY_VERSION,
      changedPaths: [],
      impactedImpacts: [],
      impactedGates: [],
      impactedSuites: [],
      scriptsPassed: false,
      readmePassed: false,
    };
  }

  return evaluateQualityGateImpact({
    entries,
    rootPackageJsonText,
    frontendPackageJsonText,
    readmeText,
  });
}

export function renderQualityGateImpactSummary(report) {
  if (!report) return "";

  const changedRows = report.changedPaths.map((entry) => {
    const ruleId = entry.rules?.length > 0
      ? entry.rules.map((rule) => rule.id).join(", ")
      : (entry.rule?.id ?? "UNCLASSIFIED");
    const impacts = entry.impacts?.join(", ") || "(none)";
    const gates = entry.gates.map((gate) => `${gate.id} (${gate.execution})`).join(", ") || "(none)";
    return `| \`${entry.display ?? entry.path}\` | \`${entry.status ?? ""}\` | \`${ruleId}\` | ${impacts} | ${gates} |`;
  });

  const gateRows = report.impactedGates.map(
    (gate) => `| \`${gate.id}\` | ${gate.workflow ?? "n/a"} | ${gate.check ?? "n/a"} | \`${gate.execution}\` | \`${gate.required ? "required" : "non-required"}\` |`,
  );

  const suiteRows = report.impactedSuites.map((suite) => {
    const commands = (suite.commands ?? []).map((command) => `\`${command.command}\``).join("<br>") || "(none)";
    return `| \`${suite.id}\` | \`${suite.gate ?? "unknown"}\` | ${commands} |`;
  });

  return normalizeMarkdown([
    "## Quality gate impact",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| policy version | \`${report.policyVersion}\` |`,
    `| result | \`${report.passed ? "PASS" : "FAIL"}\` |`,
    `| changed paths | \`${report.changedPaths.length}\` |`,
    `| script validation | \`${report.scriptsPassed ? "PASS" : "FAIL"}\` |`,
    `| test/README.md taxonomy sync | \`${report.readmePassed ? "PASS" : "FAIL"}\` |`,
    "",
    "### Changed path routing",
    "",
    "| Path | Status | Rule | Impacts | Gates |",
    "| --- | --- | --- | --- | --- |",
    ...(changedRows.length > 0 ? changedRows : ["| n/a | n/a | n/a | n/a | n/a |"]),
    "",
    "### Impacted gates",
    "",
    "| Gate | Workflow | Check | Execution | Required |",
    "| --- | --- | --- | --- | --- |",
    ...(gateRows.length > 0 ? gateRows : ["| n/a | n/a | n/a | n/a | n/a |"]),
    "",
    "### Impacted normative suites",
    "",
    "| Suite | Gate | Commands |",
    "| --- | --- | --- |",
    ...(suiteRows.length > 0 ? suiteRows : ["| n/a | n/a | n/a |"]),
    "",
  ].join("\n"));
}
