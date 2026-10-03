#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Dependency security audit gate (docs/governance/supply-chain-policy.md §9).
 *
 * `pnpm audit --prod` stays strict: any production advisory fails. The full
 * `pnpm audit` fails on every advisory except a temporary exception declared
 * below with its exact fingerprint. An exception that no longer matches a
 * reported advisory is stale and fails too, so it has to be removed rather
 * than silently outliving its reason. There is no severity threshold, no
 * wildcard and no generic ignore.
 */
export const TEMPORARY_AUDIT_EXCEPTIONS = Object.freeze([
  Object.freeze({
    githubAdvisoryId: "GHSA-vfj7-8cjw-p6xm",
    moduleName: "braces",
    vulnerableVersions: "<=3.0.3",
    findings: Object.freeze([
      Object.freeze({
        version: "3.0.3",
        dev: true,
        paths: Object.freeze([
          "frontend>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces",
        ]),
      }),
    ]),
    reason: "No patched upstream release exists (latest braces is 3.0.3); development-only path.",
  }),
]);

const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const GHSA_RE = /^GHSA(?:-[23456789cfghjmpqrvwx]{4}){3}$/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function normalizeFinding(finding, label) {
  if (
    !isPlainObject(finding) ||
    !isNonEmptyString(finding.version) ||
    typeof finding.dev !== "boolean" ||
    !Array.isArray(finding.paths) ||
    finding.paths.length === 0 ||
    !finding.paths.every(isNonEmptyString)
  ) {
    throw new Error(`${label}: malformed finding`);
  }
  return { version: finding.version, dev: finding.dev, paths: [...finding.paths].sort() };
}

/**
 * Parses `pnpm audit --json` output into normalized advisories. Anything that
 * does not have the expected shape, or whose advisories disagree with the
 * severity counters, is rejected.
 */
export function parseAuditReport(stdout) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new Error("audit output is not valid JSON");
  }
  if (!isPlainObject(report) || !isPlainObject(report.advisories) || !isPlainObject(report.metadata)) {
    throw new Error("audit output lacks advisories or metadata");
  }
  const counters = report.metadata.vulnerabilities;
  if (!isPlainObject(counters) || !SEVERITIES.every((severity) => Number.isInteger(counters[severity]) && counters[severity] >= 0)) {
    throw new Error("audit output lacks severity counters");
  }

  const advisories = Object.entries(report.advisories).map(([key, advisory]) => {
    const label = `advisory ${key}`;
    if (
      !isPlainObject(advisory) ||
      !GHSA_RE.test(advisory.github_advisory_id ?? "") ||
      !isNonEmptyString(advisory.module_name) ||
      !SEVERITIES.includes(advisory.severity) ||
      !isNonEmptyString(advisory.vulnerable_versions) ||
      !Array.isArray(advisory.findings) ||
      advisory.findings.length === 0
    ) {
      throw new Error(`${label}: malformed advisory`);
    }
    return {
      githubAdvisoryId: advisory.github_advisory_id,
      moduleName: advisory.module_name,
      severity: advisory.severity,
      vulnerableVersions: advisory.vulnerable_versions,
      findings: advisory.findings
        .map((finding) => normalizeFinding(finding, label))
        .sort((a, b) => a.version.localeCompare(b.version)),
    };
  });

  for (const severity of SEVERITIES) {
    const listed = advisories.filter((advisory) => advisory.severity === severity).length;
    if (listed !== counters[severity]) {
      throw new Error(`audit output reports ${counters[severity]} ${severity} but lists ${listed}`);
    }
  }

  return advisories;
}

function fingerprint(findings) {
  return JSON.stringify(
    [...findings]
      .map((finding) => ({ version: finding.version, dev: finding.dev, paths: [...finding.paths].sort() }))
      .sort((a, b) => a.version.localeCompare(b.version)),
  );
}

export function evaluateProductionAudit(advisories) {
  return advisories.map(
    (advisory) => `production advisory ${advisory.githubAdvisoryId} (${advisory.moduleName}) is never tolerated`,
  );
}

/**
 * Returns the failures of the full audit. The only tolerated advisory is one
 * that matches an exception exactly; every exception must still match.
 */
export function evaluateFullAudit(advisories, exceptions = TEMPORARY_AUDIT_EXCEPTIONS) {
  const failures = [];
  const matched = new Set();

  for (const advisory of advisories) {
    const exception = exceptions.find((entry) => entry.githubAdvisoryId === advisory.githubAdvisoryId);
    if (!exception) {
      failures.push(`advisory ${advisory.githubAdvisoryId} (${advisory.moduleName}) has no exception`);
      continue;
    }
    if (advisory.moduleName !== exception.moduleName) {
      failures.push(`advisory ${advisory.githubAdvisoryId} now targets ${advisory.moduleName}, not ${exception.moduleName}; review the exception`);
      continue;
    }
    if (advisory.vulnerableVersions !== exception.vulnerableVersions) {
      failures.push(`advisory ${advisory.githubAdvisoryId} range changed to ${advisory.vulnerableVersions}; review the exception`);
      continue;
    }
    if (fingerprint(advisory.findings) !== fingerprint(exception.findings)) {
      failures.push(`advisory ${advisory.githubAdvisoryId} findings changed (version, path or dev scope); review the exception`);
      continue;
    }
    matched.add(exception.githubAdvisoryId);
  }

  for (const exception of exceptions) {
    if (!matched.has(exception.githubAdvisoryId) && !advisories.some((advisory) => advisory.githubAdvisoryId === exception.githubAdvisoryId)) {
      failures.push(`exception ${exception.githubAdvisoryId} (${exception.moduleName}) is stale: the audit no longer reports it; remove the temporary exception`);
    }
  }

  return failures;
}

export function runPnpmAudit(scope) {
  const args = scope === "prod" ? ["audit", "--prod", "--json"] : ["audit", "--json"];
  const result = spawnSync("pnpm", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  return { status: result.status, stdout: result.stdout ?? "", error: result.error };
}

function auditAdvisories(scope, runAudit) {
  const result = runAudit(scope);
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error(`pnpm audit (${scope}) did not complete (status ${result.status})`);
  }
  const advisories = parseAuditReport(result.stdout);
  // pnpm exits 1 exactly when it reports advisories; any disagreement is a broken run.
  if ((result.status === 1) !== (advisories.length > 0)) {
    throw new Error(`pnpm audit (${scope}) exit status ${result.status} disagrees with ${advisories.length} advisories`);
  }
  return advisories;
}

/** Runs both audits; returns the failure list (empty means the gate passed). */
export function runDependencyAuditGate({ runAudit = runPnpmAudit, exceptions = TEMPORARY_AUDIT_EXCEPTIONS } = {}) {
  try {
    const production = evaluateProductionAudit(auditAdvisories("prod", runAudit));
    if (production.length > 0) return { failures: production, tolerated: [] };
    const advisories = auditAdvisories("full", runAudit);
    const failures = evaluateFullAudit(advisories, exceptions);
    return { failures, tolerated: failures.length > 0 ? [] : advisories.map((advisory) => advisory.githubAdvisoryId) };
  } catch (error) {
    return { failures: [error.message], tolerated: [] };
  }
}

export function main() {
  const { failures, tolerated } = runDependencyAuditGate();
  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`Dependency audit gate: ${failure}\n`);
    return 1;
  }
  process.stdout.write("Dependency audit gate: production audit clean.\n");
  for (const id of tolerated) {
    process.stdout.write(`Dependency audit gate: ${id} tolerated by its temporary exception (see supply-chain-policy.md §9.1).\n`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main());
}
