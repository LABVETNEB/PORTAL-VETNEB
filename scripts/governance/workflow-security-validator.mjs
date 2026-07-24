#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, posix, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { CORE_SCHEMA, load, mergeTag } from "js-yaml";

import {
  APPROVED_EXTERNAL_ACTIONS,
  CONTAINER_IMAGE_POLICY,
  PERMISSION_POLICY,
  POLICY_VERSION,
  WORKFLOW_EXTENSIONS,
  WORKFLOW_PATH_PREFIX,
} from "./workflow-security-policy.mjs";

const WORKFLOW_DIRECTORY = ".github/workflows";
const SHA_40 = /^[0-9a-f]{40}$/;
const HEX_40 = /^[0-9a-fA-F]{40}$/;
const SHA_256_DIGEST = /@sha256:[0-9a-f]{64}$/;
const MAX_YAML_DEPTH = 100;
const MAX_TOTAL_MERGE_KEYS = 20;
const WORKFLOW_SCHEMA = CORE_SCHEMA.withTags(mergeTag);

function normalizePath(value) {
  return String(value).replaceAll("\\", "/");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function semanticSegment(key) {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

function childPath(parent, key) {
  return `${parent}${semanticSegment(key)}`;
}

function arrayPath(parent, index) {
  return `${parent}[${index}]`;
}

function sortedEntries(object) {
  return Object.entries(object).sort(([left], [right]) => left.localeCompare(right));
}

function createBaseReport() {
  return {
    passed: false,
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

function addFailure(report, workflow, path, cause) {
  report.failures.push({ workflow, path, cause });
}

function listWorkflowFiles(rootDir) {
  const workflowRoot = resolve(rootDir, WORKFLOW_DIRECTORY);
  if (!existsSync(workflowRoot)) return [];

  const found = [];
  const visit = (absoluteDirectory) => {
    for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const absolutePath = resolve(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!WORKFLOW_EXTENSIONS.includes(extname(entry.name).toLowerCase())) continue;
      const relative = normalizePath(absolutePath.slice(resolve(rootDir).length + sep.length));
      found.push(relative);
    }
  };

  visit(workflowRoot);
  return found.sort();
}

function parseWorkflowDocument({ rootDir, workflow, report }) {
  const sourcePath = resolve(rootDir, workflow);
  let source;

  try {
    source = readFileSync(sourcePath, "utf8");
  } catch (error) {
    addFailure(report, workflow, "$", `Cannot read workflow file: ${error.message}`);
    return null;
  }

  try {
    const document = load(source, {
      filename: workflow,
      schema: WORKFLOW_SCHEMA,
      maxDepth: MAX_YAML_DEPTH,
      maxTotalMergeKeys: MAX_TOTAL_MERGE_KEYS,
      maxAliases: 0,
    });

    if (typeof document === "undefined" || document === null) {
      addFailure(report, workflow, "$", "Workflow YAML document must not be empty.");
      return null;
    }
    if (!isPlainObject(document)) {
      addFailure(report, workflow, "$", "Workflow YAML root must be a mapping object.");
      return null;
    }

    return document;
  } catch (error) {
    const reason = error?.reason ?? error?.message ?? "unknown YAML parser error";
    const cause = reason.includes("expected a single document")
      ? "Multiple YAML documents are not allowed in a workflow file."
      : reason.includes("expected a document, but the input is empty")
        ? "Workflow YAML document must not be empty."
        : reason.includes("aliases exceeded maxAliases")
          ? "YAML aliases are not allowed."
          : `YAML parse error: ${reason}`;
    addFailure(report, workflow, "$", cause);
    return null;
  }
}

function validateTopLevelPermissions({ document, workflow, report }) {
  if (!hasOwn(document, "permissions")) {
    addFailure(report, workflow, "permissions", "Top-level permissions must be exactly contents: read.");
    return;
  }

  const permissions = document.permissions;
  report.permissions.push({ workflow, path: "permissions", scope: "top-level", permissions });

  if (!isPlainObject(permissions)) {
    const value = String(permissions);
    if (PERMISSION_POLICY.forbiddenScalarValues.includes(value)) {
      addFailure(report, workflow, "permissions", `Top-level permissions cannot be ${value}.`);
      return;
    }
    addFailure(report, workflow, "permissions", "Top-level permissions must be a mapping exactly equivalent to contents: read.");
    return;
  }

  const expectedEntries = sortedEntries(PERMISSION_POLICY.topLevel);
  const actualKeys = Object.keys(permissions).sort();
  const expectedKeys = expectedEntries.map(([key]) => key).sort();

  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      addFailure(report, workflow, childPath("permissions", key), `Top-level permissions key is not allowed: ${key}.`);
    }
  }

  for (const [key, expectedValue] of expectedEntries) {
    if (!hasOwn(permissions, key)) {
      addFailure(report, workflow, childPath("permissions", key), `Top-level permissions must include ${key}: ${expectedValue}.`);
    } else if (permissions[key] !== expectedValue) {
      addFailure(
        report,
        workflow,
        childPath("permissions", key),
        `Top-level permissions ${key} must be exactly ${expectedValue}.`,
      );
    }
  }
}

function findJobPermissionException({ workflow, job }) {
  return PERMISSION_POLICY.jobLevelExceptions.find(
    (exception) => exception?.workflow === workflow && exception?.job === job,
  );
}

function validateJobPermissions({ workflow, jobName, job, jobPath, report }) {
  if (!hasOwn(job, "permissions")) return;

  const permissionPath = childPath(jobPath, "permissions");
  report.permissions.push({ workflow, path: permissionPath, scope: "job", job: jobName, permissions: job.permissions });

  const exception = findJobPermissionException({ workflow, job: jobName });
  if (exception) {
    report.exceptionsUsed.push({
      type: "job-level-permissions",
      workflow,
      path: permissionPath,
      exception,
    });
    return;
  }

  addFailure(report, workflow, permissionPath, "Job-level permissions are not allowed by PERMISSION_POLICY.jobLevelExceptions.");
}

function isLocalUsesReference(reference) {
  return (
    reference.startsWith("./") ||
    reference.startsWith("../") ||
    reference.startsWith(".github/") ||
    reference.startsWith("/")
  );
}

function validateLocalUses({ workflow, path, reference, report }) {
  const withoutDotSlash = reference.startsWith("./") ? reference.slice(2) : reference;
  const normalized = posix.normalize(normalizePath(withoutDotSlash));
  const hasTraversal = normalized.split("/").includes("..") || normalizePath(withoutDotSlash).split("/").includes("..");

  report.localActions.push({ workflow, path, reference, normalizedPath: normalized });

  if (reference.includes("@")) {
    addFailure(report, workflow, path, "Local action references must not include @ refs.");
  }
  if (reference.startsWith("/") || hasTraversal) {
    addFailure(report, workflow, path, "Local action reference must not use absolute paths or path traversal.");
    return;
  }
  if (normalized !== ".github/actions" && !normalized.startsWith(".github/actions/")) {
    addFailure(report, workflow, path, "Local action reference must stay inside .github/actions.");
  }
}

function validateExternalUses({ workflow, path, reference, report }) {
  const atIndex = reference.lastIndexOf("@");
  const target = atIndex === -1 ? reference : reference.slice(0, atIndex);
  const ref = atIndex === -1 ? "" : reference.slice(atIndex + 1);
  const segments = target.split("/");
  const repository = segments.length >= 2 ? `${segments[0]}/${segments[1]}` : target;

  report.externalActions.push({ workflow, path, reference, repository, ref });

  if (atIndex === -1) {
    addFailure(report, workflow, path, "External action reference must include an @ ref.");
    return;
  }

  if (reference.includes("${{")) {
    addFailure(report, workflow, path, "External action reference must not contain dynamic expressions.");
  }

  const approvedRepositories = new Set(APPROVED_EXTERNAL_ACTIONS.map((action) => action.repository));
  if (!approvedRepositories.has(repository)) {
    addFailure(report, workflow, path, `External action repository is not approved: ${repository}.`);
  }

  if (!SHA_40.test(ref)) {
    if (HEX_40.test(ref)) {
      addFailure(report, workflow, path, "External action ref must be a lowercase 40-character SHA.");
    } else if (/^[0-9a-fA-F]+$/.test(ref) && ref.length < 40) {
      addFailure(report, workflow, path, "External action ref must not be a short SHA.");
    } else {
      addFailure(report, workflow, path, "External action ref must be exactly a lowercase 40-character SHA, not a tag, branch or expression.");
    }
  }
}

function validateUsesReference({ workflow, path, value, report }) {
  if (typeof value !== "string" || value.trim() === "") {
    addFailure(report, workflow, path, "uses value must be a non-empty string.");
    return;
  }

  if (value !== value.trim()) {
    addFailure(report, workflow, path, "uses value must not have leading or trailing whitespace.");
  }

  if (isLocalUsesReference(value)) {
    validateLocalUses({ workflow, path, reference: value, report });
    return;
  }

  validateExternalUses({ workflow, path, reference: value, report });
}

function findContainerImageException({ workflow, job, service, image }) {
  return CONTAINER_IMAGE_POLICY.exceptions.find(
    (exception) =>
      exception.workflow === workflow &&
      exception.job === job &&
      exception.service === service &&
      exception.image === image,
  );
}

function validateContainerImage({ workflow, path, job, service = null, image, kind, report }) {
  const record = { workflow, path, job, service, image, kind, allowedBy: null };
  report.containerImages.push(record);

  if (typeof image !== "string" || image.trim() === "") {
    addFailure(report, workflow, path, "Container image must be a non-empty string.");
    return;
  }

  const exception = findContainerImageException({ workflow, job, service, image });
  if (exception) {
    record.allowedBy = "exception";
    report.exceptionsUsed.push({
      type: "container-image",
      workflow,
      path,
      exception,
    });
    return;
  }

  if (image.includes("${{")) {
    addFailure(report, workflow, path, "Container image must not contain dynamic expressions.");
    return;
  }

  if (SHA_256_DIGEST.test(image)) {
    record.allowedBy = "sha256-digest";
    return;
  }

  if (/(^|:)latest(?:$|@)/.test(image)) {
    addFailure(report, workflow, path, "Container image latest tag is not allowed unless declared as an exact exception.");
    return;
  }

  addFailure(report, workflow, path, "Container image must be pinned by sha256 digest or match an exact declared exception.");
}

function validateJobContainer({ workflow, jobName, job, jobPath, report }) {
  if (!hasOwn(job, "container")) return;

  const containerPath = childPath(jobPath, "container");
  const container = job.container;

  if (typeof container === "string") {
    validateContainerImage({
      workflow,
      path: containerPath,
      job: jobName,
      image: container,
      kind: "job-container",
      report,
    });
    return;
  }

  if (!isPlainObject(container)) {
    addFailure(report, workflow, containerPath, "Job container must be a string image or mapping with image.");
    return;
  }

  if (!hasOwn(container, "image")) {
    addFailure(report, workflow, childPath(containerPath, "image"), "Job container mapping must include image.");
    return;
  }

  validateContainerImage({
    workflow,
    path: childPath(containerPath, "image"),
    job: jobName,
    image: container.image,
    kind: "job-container",
    report,
  });
}

function validateJobServices({ workflow, jobName, job, jobPath, report }) {
  if (!hasOwn(job, "services")) return;

  const servicesPath = childPath(jobPath, "services");
  if (!isPlainObject(job.services)) {
    addFailure(report, workflow, servicesPath, "Job services must be a mapping.");
    return;
  }

  for (const [serviceName, service] of sortedEntries(job.services)) {
    const servicePath = childPath(servicesPath, serviceName);
    if (!isPlainObject(service)) {
      addFailure(report, workflow, servicePath, "Workflow service must be a mapping with image.");
      continue;
    }
    if (!hasOwn(service, "image")) {
      addFailure(report, workflow, childPath(servicePath, "image"), "Workflow service must include image.");
      continue;
    }
    validateContainerImage({
      workflow,
      path: childPath(servicePath, "image"),
      job: jobName,
      service: serviceName,
      image: service.image,
      kind: "service",
      report,
    });
  }
}

function validateJobSteps({ workflow, jobName, job, jobPath, report }) {
  if (!hasOwn(job, "steps")) return;

  const stepsPath = childPath(jobPath, "steps");
  if (!Array.isArray(job.steps)) {
    addFailure(report, workflow, stepsPath, "Job steps must be an array.");
    return;
  }

  job.steps.forEach((step, index) => {
    const stepPath = arrayPath(stepsPath, index);
    if (!isPlainObject(step)) {
      addFailure(report, workflow, stepPath, "Workflow step must be a mapping.");
      return;
    }
    if (!hasOwn(step, "uses")) return;
    validateUsesReference({
      workflow,
      path: childPath(stepPath, "uses"),
      value: step.uses,
      report,
    });
  });
}

function validateJobs({ document, workflow, report }) {
  if (!hasOwn(document, "jobs")) {
    addFailure(report, workflow, "jobs", "Workflow must declare a jobs mapping.");
    return;
  }

  if (!isPlainObject(document.jobs)) {
    addFailure(report, workflow, "jobs", "Workflow jobs must be a mapping.");
    return;
  }

  for (const [jobName, job] of sortedEntries(document.jobs)) {
    const jobPath = childPath("jobs", jobName);
    if (!isPlainObject(job)) {
      addFailure(report, workflow, jobPath, "Workflow job must be a mapping.");
      continue;
    }

    validateJobPermissions({ workflow, jobName, job, jobPath, report });

    if (hasOwn(job, "uses")) {
      validateUsesReference({
        workflow,
        path: childPath(jobPath, "uses"),
        value: job.uses,
        report,
      });
    }

    validateJobSteps({ workflow, jobName, job, jobPath, report });
    validateJobContainer({ workflow, jobName, job, jobPath, report });
    validateJobServices({ workflow, jobName, job, jobPath, report });

    if (!hasOwn(job, "uses") && !hasOwn(job, "steps")) {
      addFailure(report, workflow, jobPath, "Workflow job must declare steps[] or reusable workflow uses.");
    }
    if (hasOwn(job, "uses") && hasOwn(job, "steps")) {
      addFailure(report, workflow, jobPath, "Workflow job must not declare both steps[] and reusable workflow uses.");
    }
  }
}

function validateWorkflowDocument({ document, workflow, report }) {
  validateTopLevelPermissions({ document, workflow, report });
  validateJobs({ document, workflow, report });
}

export function evaluateWorkflowSecurity({ rootDir = process.cwd(), workflowPaths } = {}) {
  const report = createBaseReport();
  const workflows = (workflowPaths ?? listWorkflowFiles(rootDir)).map(normalizePath).sort();

  if (workflows.length === 0) {
    addFailure(report, WORKFLOW_PATH_PREFIX, "$", "No workflow .yml or .yaml files were found.");
  }

  for (const workflow of workflows) {
    if (!workflow.startsWith(WORKFLOW_PATH_PREFIX)) {
      addFailure(report, workflow, "$", `Workflow path must be under ${WORKFLOW_PATH_PREFIX}.`);
      continue;
    }
    report.workflows.push({ workflow });

    const document = parseWorkflowDocument({ rootDir, workflow, report });
    if (!document) continue;
    validateWorkflowDocument({ document, workflow, report });
  }

  report.details.push(`Parsed ${workflows.length} workflow file(s) with js-yaml 5.2.2.`);
  report.details.push(
    `Applied maxDepth=${MAX_YAML_DEPTH}, maxTotalMergeKeys=${MAX_TOTAL_MERGE_KEYS} and maxAliases=0.`,
  );
  report.details.push("YAML aliases are rejected by the js-yaml maxAliases=0 loader limit.");
  report.passed = report.failures.length === 0;
  return report;
}

export function renderWorkflowSecuritySummary(report) {
  const lines = [
    `Workflow security validator ${report.passed ? "PASS" : "FAIL"}.`,
    `Policy version: ${report.policyVersion}.`,
    `Workflows: ${report.workflows.length}.`,
    `External actions: ${report.externalActions.length}.`,
    `Local actions: ${report.localActions.length}.`,
    `Container images: ${report.containerImages.length}.`,
    `Exceptions used: ${report.exceptionsUsed.length}.`,
  ];

  if (report.failures.length > 0) {
    lines.push("Failures:");
    for (const failure of report.failures) {
      lines.push(`- ${failure.workflow} ${failure.path}: ${failure.cause}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function main(argv = process.argv.slice(2)) {
  const json = argv.includes("--json");
  const unknown = argv.filter((arg) => arg !== "--json");

  if (unknown.length > 0) {
    const report = createBaseReport();
    addFailure(report, "cli", "argv", `Unknown argument(s): ${unknown.join(", ")}.`);
    report.passed = false;
    const output = json ? `${JSON.stringify(report, null, 2)}\n` : renderWorkflowSecuritySummary(report);
    process.stderr.write(output);
    return 1;
  }

  const report = evaluateWorkflowSecurity();
  const output = json ? `${JSON.stringify(report, null, 2)}\n` : renderWorkflowSecuritySummary(report);
  if (report.passed) process.stdout.write(output);
  else process.stderr.write(output);
  return report.passed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main());
}
