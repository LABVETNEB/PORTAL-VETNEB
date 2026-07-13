#!/usr/bin/env node

import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { extname, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  APPROVED_EXTERNAL_ACTIONS,
  CONTAINER_IMAGE_POLICY,
  PERMISSION_POLICY,
  POLICY_VERSION,
  WORKFLOW_EXTENSIONS,
  WORKFLOW_PATH_PREFIX,
} from "./workflow-security-policy.mjs";

const SHA_RE = /^[0-9a-f]{40}$/;
const DIGEST_RE = /@sha256:[0-9a-f]{64}$/;
const SCALAR_BLOCK_RE = /^(?:\||>)(?:[-+])?$/;

function normalizePath(value) {
  return String(value).replaceAll("\\", "/");
}

function normalizeText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function workflowLocation(path, line) {
  return `${path}:${line}`;
}

function stripInlineComment(line) {
  let quote = null;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quote === "\"") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") quote = null;
      continue;
    }

    if (quote === "'") {
      if (char === "'") quote = null;
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === "#") return line.slice(0, index).trimEnd();
  }

  return line.trimEnd();
}

function unquote(value) {
  const trimmed = String(value ?? "").trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parsePair(line) {
  const match = line.match(/^(\s*)(?:-\s*)?([A-Za-z0-9_.-]+):(?:\s*(.*))?$/);
  if (!match) return null;
  return {
    indent: match[1].length,
    key: match[2],
    value: (match[3] ?? "").trim(),
  };
}

function approvedRepositories(actions = APPROVED_EXTERNAL_ACTIONS) {
  return new Set(actions.map((action) => action.repository));
}

export function isPinnedExternalActionReference(reference, actions = APPROVED_EXTERNAL_ACTIONS) {
  const value = String(reference ?? "").trim();
  if (value.startsWith("./")) return false;
  const atIndex = value.lastIndexOf("@");
  if (atIndex === -1) return false;

  const repositoryPath = value.slice(0, atIndex);
  const ref = value.slice(atIndex + 1);
  const parts = repositoryPath.split("/");
  const repository = parts.slice(0, 2).join("/");
  const workflowPath = parts.slice(2).join("/");
  const isReusableWorkflow = workflowPath.startsWith(".github/workflows/") && /\.ya?ml$/.test(workflowPath);

  if (!approvedRepositories(actions).has(repository)) return false;
  if (parts.length > 2 && !isReusableWorkflow) return false;
  return SHA_RE.test(ref);
}

function actionRepository(reference) {
  const atIndex = reference.lastIndexOf("@");
  const repositoryPath = atIndex === -1 ? reference : reference.slice(0, atIndex);
  return repositoryPath.split("/").slice(0, 2).join("/");
}

function isLocalActionReference(reference) {
  return reference.startsWith("./") || reference.startsWith("../");
}

function localActionStaysInside(reference) {
  if (!reference.startsWith("./")) return false;
  const normalized = posix.normalize(reference.slice(2));
  return normalized.startsWith(".github/actions/") && normalized !== ".github/actions";
}

function imageTag(image) {
  const withoutDigest = image.split("@", 1)[0];
  const lastSegment = withoutDigest.slice(withoutDigest.lastIndexOf("/") + 1);
  const colon = lastSegment.lastIndexOf(":");
  return colon === -1 ? "" : lastSegment.slice(colon + 1);
}

function imageExceptionFor(imageEntry, policy = CONTAINER_IMAGE_POLICY) {
  return (policy.exceptions ?? []).find(
    (exception) =>
      exception.workflow === imageEntry.workflow &&
      exception.job === imageEntry.job &&
      exception.service === imageEntry.service &&
      exception.image === imageEntry.image,
  ) ?? null;
}

function createReport() {
  return {
    passed: true,
    failures: [],
    details: [],
    policyVersion: POLICY_VERSION,
    workflows: [],
    externalActions: [],
    localActions: [],
    permissions: [],
    containerImages: [],
    exceptionsUsed: [],
  };
}

function addFailure(report, message) {
  report.failures.push(message);
  report.passed = false;
}

function collectWorkflowFiles(rootDir) {
  const workflowRoot = resolve(rootDir, WORKFLOW_PATH_PREFIX);
  let entries;
  try {
    entries = readdirSync(workflowRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() || entry.isSymbolicLink())
    .map((entry) => `${WORKFLOW_PATH_PREFIX}${entry.name}`)
    .filter((path) => WORKFLOW_EXTENSIONS.includes(extname(path)))
    .sort((left, right) => left.localeCompare(right));
}

function startsWatchedInlineObject(value) {
  return value.startsWith("{") || value.startsWith("[");
}

function startsUnsupportedFlowStyle(value) {
  const trimmed = String(value ?? "").trimStart();
  if (!trimmed || trimmed.startsWith("\"") || trimmed.startsWith("'")) return false;
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function startsFlowStyleListItem(line) {
  return /^\s*-\s*[\[{]/.test(line);
}

function addUnsupportedFlowStyleFailure(report, path, lineNumber) {
  addFailure(report, `Workflow security unsupported flow-style YAML: ${workflowLocation(path, lineNumber)}`);
}

export function scanWorkflowSecurity({
  workflowPath,
  text,
  rootDir = process.cwd(),
} = {}) {
  const path = normalizePath(workflowPath);
  const report = createReport();
  const workflow = {
    path,
    permissions: null,
    externalActions: [],
    localActions: [],
    containerImages: [],
    exceptionsUsed: [],
  };
  report.workflows.push(workflow);

  try {
    const stats = lstatSync(resolve(rootDir, path));
    if (stats.isSymbolicLink()) {
      addFailure(report, `Workflow security forbids symlink workflow: ${path}`);
    }
  } catch {
    // Synthetic document tests may validate text without creating a file.
  }

  const lines = normalizeText(text).split("\n");
  let skipBlockIndent = null;
  let topPermissions = null;
  let permissionsIndent = null;
  let jobsIndent = null;
  let currentJob = null;
  let currentJobIndent = null;
  let servicesIndent = null;
  let currentService = null;
  let currentServiceIndent = null;
  let containerIndent = null;
  let stepsIndent = null;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index];

    if (/^[ \t]*\t/.test(rawLine)) {
      addFailure(report, `Workflow security forbids tab indentation: ${workflowLocation(path, lineNumber)}`);
      continue;
    }

    const withoutComment = stripInlineComment(rawLine);
    if (!withoutComment.trim()) continue;

    const indent = withoutComment.match(/^ */)?.[0].length ?? 0;
    if (skipBlockIndent !== null) {
      if (indent > skipBlockIndent) continue;
      skipBlockIndent = null;
    }

    if (currentJob && stepsIndent !== null && indent <= stepsIndent) {
      stepsIndent = null;
    }

    if (currentJob && stepsIndent !== null && indent > stepsIndent && startsFlowStyleListItem(withoutComment)) {
      addUnsupportedFlowStyleFailure(report, path, lineNumber);
      continue;
    }

    const pair = parsePair(withoutComment);
    if (!pair) continue;

    const value = unquote(pair.value);
    if (SCALAR_BLOCK_RE.test(value)) {
      if (["uses", "permissions", "image", "container"].includes(pair.key)) {
        addFailure(report, `Workflow security field is ambiguous: ${workflowLocation(path, lineNumber)}`);
      }
      skipBlockIndent = pair.indent;
    }

    if (pair.indent === 0 && pair.key !== "permissions") {
      if (permissionsIndent !== null) permissionsIndent = null;
    }
    if (permissionsIndent !== null && pair.indent <= permissionsIndent && pair.key !== "permissions") {
      permissionsIndent = null;
    }

    if (pair.indent === 0 && pair.key === "jobs") {
      jobsIndent = pair.indent;
      currentJob = null;
      currentJobIndent = null;
      servicesIndent = null;
      containerIndent = null;
      stepsIndent = null;
      continue;
    }

    if (jobsIndent !== null) {
      if (pair.indent <= jobsIndent) {
        currentJob = null;
        currentJobIndent = null;
        servicesIndent = null;
        currentService = null;
        currentServiceIndent = null;
        containerIndent = null;
        stepsIndent = null;
      } else if (pair.indent === jobsIndent + 2) {
        currentJob = pair.key;
        currentJobIndent = pair.indent;
        servicesIndent = null;
        currentService = null;
        currentServiceIndent = null;
        containerIndent = null;
        stepsIndent = null;
      }
    }

    if (currentJob && servicesIndent !== null && pair.indent <= servicesIndent) {
      servicesIndent = null;
      currentService = null;
      currentServiceIndent = null;
    }
    if (currentJob && currentServiceIndent !== null && pair.indent <= currentServiceIndent) {
      currentService = null;
      currentServiceIndent = null;
    }
    if (currentJob && containerIndent !== null && pair.indent <= containerIndent) {
      containerIndent = null;
    }

    if (
      startsUnsupportedFlowStyle(pair.value) &&
      (
        pair.key === "jobs" ||
        pair.key === "permissions" ||
        (currentJob && pair.indent > currentJobIndent && ["steps", "container", "services"].includes(pair.key)) ||
        (jobsIndent !== null && pair.indent > jobsIndent)
      )
    ) {
      addUnsupportedFlowStyleFailure(report, path, lineNumber);
      continue;
    }

    if (currentJob && pair.key === "steps" && pair.indent > currentJobIndent) {
      stepsIndent = pair.indent;
      continue;
    }

    if (pair.key === "uses") {
      if (!value || startsWatchedInlineObject(value) || value.includes("${{")) {
        addFailure(report, `Workflow action reference must be pinned to a full commit SHA: ${value || "(empty)"} (${workflowLocation(path, lineNumber)})`);
        continue;
      }

      if (isLocalActionReference(value)) {
        const action = { workflow: path, line: lineNumber, reference: value };
        workflow.localActions.push(action);
        report.localActions.push(action);
        if (!localActionStaysInside(value)) {
          addFailure(report, `Workflow local action escapes .github/actions: ${value} (${workflowLocation(path, lineNumber)})`);
        }
        continue;
      }

      const external = { workflow: path, line: lineNumber, reference: value, repository: actionRepository(value) };
      workflow.externalActions.push(external);
      report.externalActions.push(external);

      if (!approvedRepositories().has(external.repository)) {
        addFailure(report, `Workflow action repository is not approved: ${external.repository} (${workflowLocation(path, lineNumber)})`);
      }
      if (!isPinnedExternalActionReference(value)) {
        addFailure(report, `Workflow action reference must be pinned to a full commit SHA: ${value} (${workflowLocation(path, lineNumber)})`);
      }
      continue;
    }

    if (pair.key === "permissions") {
      if (currentJob && currentJobIndent !== null && pair.indent > currentJobIndent) {
        addFailure(report, `Workflow security forbids unauthorized job-level permissions: ${workflowLocation(path, lineNumber)}`);
        continue;
      }

      if (pair.indent !== 0) continue;

      topPermissions = { workflow: path, line: lineNumber, entries: {} };
      workflow.permissions = topPermissions;
      report.permissions.push(topPermissions);
      if (value) {
        topPermissions.scalar = value;
        if (PERMISSION_POLICY.forbiddenScalarValues.includes(value)) {
          addFailure(report, `Workflow security forbids scalar permissions value "${value}": ${workflowLocation(path, lineNumber)}`);
        } else {
          addFailure(report, `Workflow security requires explicit top-level permissions: ${workflowLocation(path, lineNumber)}`);
        }
      } else {
        permissionsIndent = pair.indent;
      }
      continue;
    }

    if (permissionsIndent !== null && pair.indent > permissionsIndent && topPermissions) {
      if (!value || startsWatchedInlineObject(value)) {
        addFailure(report, `Workflow security field is ambiguous: ${workflowLocation(path, lineNumber)}`);
        continue;
      }
      topPermissions.entries[pair.key] = { value, line: lineNumber };
      continue;
    }

    if (currentJob && pair.key === "services" && pair.indent > currentJobIndent) {
      if (value) addFailure(report, `Workflow security field is ambiguous: ${workflowLocation(path, lineNumber)}`);
      servicesIndent = pair.indent;
      currentService = null;
      currentServiceIndent = null;
      continue;
    }

    if (currentJob && servicesIndent !== null && pair.indent === servicesIndent + 2) {
      if (value) addFailure(report, `Workflow security field is ambiguous: ${workflowLocation(path, lineNumber)}`);
      currentService = pair.key;
      currentServiceIndent = pair.indent;
      continue;
    }

    if (currentJob && pair.key === "container" && pair.indent > currentJobIndent) {
      if (value) {
        const imageEntry = { workflow: path, line: lineNumber, job: currentJob, service: null, image: value };
        workflow.containerImages.push(imageEntry);
        report.containerImages.push(imageEntry);
      } else {
        containerIndent = pair.indent;
      }
      continue;
    }

    if (pair.key === "image") {
      if (!value || startsWatchedInlineObject(value)) {
        addFailure(report, `Workflow security field is ambiguous: ${workflowLocation(path, lineNumber)}`);
        continue;
      }

      if (currentJob && currentService && currentServiceIndent !== null && pair.indent > currentServiceIndent) {
        const imageEntry = { workflow: path, line: lineNumber, job: currentJob, service: currentService, image: value };
        workflow.containerImages.push(imageEntry);
        report.containerImages.push(imageEntry);
      } else if (currentJob && containerIndent !== null && pair.indent > containerIndent) {
        const imageEntry = { workflow: path, line: lineNumber, job: currentJob, service: null, image: value };
        workflow.containerImages.push(imageEntry);
        report.containerImages.push(imageEntry);
      }
    }
  }

  validatePermissions(report, workflow);
  validateImages(report, workflow);
  report.details.push(`Validated workflow security policy for ${path}.`);
  return report;
}

function validatePermissions(report, workflow) {
  if (!workflow.permissions) {
    addFailure(report, `Workflow security requires explicit top-level permissions: ${workflow.path}`);
    return;
  }
  if (workflow.permissions.scalar) return;

  const expected = PERMISSION_POLICY.topLevel;
  const entries = workflow.permissions.entries;
  const keys = Object.keys(entries);

  if (keys.length === 0) {
    addFailure(report, `Workflow security requires explicit top-level permissions: ${workflow.path}`);
    return;
  }

  for (const key of keys) {
    const entry = entries[key];
    if (expected[key] !== entry.value) {
      addFailure(report, `Workflow security forbids top-level permission ${key}: ${entry.value}: ${workflowLocation(workflow.path, entry.line)}`);
    }
  }

  for (const [key, value] of Object.entries(expected)) {
    if (entries[key]?.value !== value) {
      addFailure(report, `Workflow security requires top-level permission ${key}: ${value}: ${workflow.path}`);
    }
  }
}

function validateImages(report, workflow) {
  for (const imageEntry of workflow.containerImages) {
    const image = imageEntry.image;
    const tag = imageTag(image);
    if (tag === "latest") {
      addFailure(report, `Workflow container image uses forbidden latest tag: ${image} (${workflowLocation(imageEntry.workflow, imageEntry.line)})`);
      continue;
    }
    if (DIGEST_RE.test(image)) continue;

    const exception = imageExceptionFor(imageEntry);
    if (exception) {
      const used = { ...exception, line: imageEntry.line };
      workflow.exceptionsUsed.push(used);
      report.exceptionsUsed.push(used);
      continue;
    }

    addFailure(report, `Workflow container image is neither digest-pinned nor explicitly excepted: ${image} (${workflowLocation(imageEntry.workflow, imageEntry.line)})`);
  }
}

function mergeReport(target, source) {
  target.failures.push(...source.failures);
  target.details.push(...source.details);
  target.workflows.push(...source.workflows);
  target.externalActions.push(...source.externalActions);
  target.localActions.push(...source.localActions);
  target.permissions.push(...source.permissions);
  target.containerImages.push(...source.containerImages);
  target.exceptionsUsed.push(...source.exceptionsUsed);
  target.passed = target.failures.length === 0;
  return target;
}

export function validateWorkflowSecurityDocument({
  workflowPath,
  text,
  rootDir = process.cwd(),
} = {}) {
  return scanWorkflowSecurity({ workflowPath, text, rootDir });
}

export function validateWorkflowSecurityRepository({
  rootDir = process.cwd(),
} = {}) {
  const report = createReport();
  const workflowFiles = collectWorkflowFiles(rootDir);

  for (const workflowPath of workflowFiles) {
    const absolutePath = resolve(rootDir, workflowPath);
    let text = "";
    try {
      text = readFileSync(absolutePath, "utf8");
    } catch (error) {
      addFailure(report, `Workflow security cannot read workflow: ${workflowPath} (${error.message})`);
      continue;
    }
    mergeReport(report, validateWorkflowSecurityDocument({ workflowPath, text, rootDir }));
  }

  if (workflowFiles.length === 0) {
    addFailure(report, "Workflow security requires at least one tracked workflow.");
  }

  report.details.unshift(`Validated ${workflowFiles.length} workflow file(s).`);
  report.passed = report.failures.length === 0;
  return report;
}

function formatCount(value) {
  return `\`${value}\``;
}

export function renderWorkflowSecuritySummary(report) {
  if (!report) return "";

  const workflowRows = report.workflows.map((workflow) => {
    const permissions = workflow.permissions?.scalar
      ? workflow.permissions.scalar
      : Object.entries(workflow.permissions?.entries ?? {})
        .map(([key, entry]) => `${key}: ${entry.value}`)
        .join(", ") || "(missing)";
    return `| \`${workflow.path}\` | \`${permissions}\` | \`${workflow.externalActions.length}\` | \`${workflow.containerImages.length}\` |`;
  });

  const actionRows = report.externalActions.map(
    (action) => `| \`${action.workflow}:${action.line}\` | \`${action.reference}\` | \`${action.repository}\` |`,
  );

  const imageRows = report.containerImages.map(
    (image) => `| \`${image.workflow}:${image.line}\` | \`${image.job}\` | \`${image.service ?? "container"}\` | \`${image.image}\` |`,
  );

  const exceptionRows = report.exceptionsUsed.map(
    (exception) => `| \`${exception.workflow}\` | \`${exception.job}\` | \`${exception.service}\` | \`${exception.image}\` | ${exception.reviewBy} |`,
  );

  return [
    "## Workflow security",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| policy version | \`${report.policyVersion}\` |`,
    `| result | \`${report.passed ? "PASS" : "FAIL"}\` |`,
    `| workflows | ${formatCount(report.workflows.length)} |`,
    `| external actions | ${formatCount(report.externalActions.length)} |`,
    `| local actions | ${formatCount(report.localActions.length)} |`,
    `| permissions | \`${report.failures.some((failure) => failure.includes("permission")) ? "FAIL" : "PASS"}\` |`,
    `| container policy | \`${report.failures.some((failure) => failure.includes("container image")) ? "FAIL" : "PASS"}\` |`,
    `| exceptions used | ${formatCount(report.exceptionsUsed.length)} |`,
    "",
    "### Workflows",
    "",
    "| Workflow | Permissions | External actions | Container images |",
    "| --- | --- | ---: | ---: |",
    ...(workflowRows.length > 0 ? workflowRows : ["| n/a | n/a | 0 | 0 |"]),
    "",
    "### External actions",
    "",
    "| Location | Reference | Repository |",
    "| --- | --- | --- |",
    ...(actionRows.length > 0 ? actionRows : ["| n/a | n/a | n/a |"]),
    "",
    "### Container images",
    "",
    "| Location | Job | Scope | Image |",
    "| --- | --- | --- | --- |",
    ...(imageRows.length > 0 ? imageRows : ["| n/a | n/a | n/a | n/a |"]),
    "",
    "### Exceptions",
    "",
    "| Workflow | Job | Service | Image | Review by |",
    "| --- | --- | --- | --- | --- |",
    ...(exceptionRows.length > 0 ? exceptionRows : ["| n/a | n/a | n/a | n/a | n/a |"]),
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = validateWorkflowSecurityRepository();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report));
  } else {
    console.log(renderWorkflowSecuritySummary(report));
    for (const failure of report.failures) console.error(failure);
  }
  process.exit(report.passed ? 0 : 1);
}
