import test from "node:test";
import assert from "node:assert/strict";

import {
  TEMPORARY_AUDIT_EXCEPTIONS,
  evaluateFullAudit,
  evaluateProductionAudit,
  main,
  parseAuditReport,
  runDependencyAuditGate,
  runPnpmAudit,
  type AuditException,
  type AuditRunResult,
  type AuditScope,
} from "../../../scripts/supply-chain/dependency-audit-gate.mjs";

const ALLOWED_GHSA = "GHSA-vfj7-8cjw-p6xm";
const ALLOWED_PATH =
  "frontend>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces";
const TEST_EXCEPTION: AuditException = {
  githubAdvisoryId: ALLOWED_GHSA,
  moduleName: "braces",
  vulnerableVersions: "<=3.0.3",
  findings: [{ version: "3.0.3", dev: true, paths: [ALLOWED_PATH] }],
  reason: "Synthetic exception for fail-closed contract tests.",
};

type RawAdvisory = {
  id: number;
  github_advisory_id: string;
  module_name: string;
  severity: string;
  vulnerable_versions: string;
  patched_versions: string;
  findings: { version: string; paths: string[]; dev: boolean; optional: boolean; bundled: boolean }[];
};

// Same shape as `pnpm audit --json` (pnpm 11) for a synthetic advisory.
function bracesAdvisory(overrides: Partial<RawAdvisory> = {}): RawAdvisory {
  return {
    id: 1240992,
    github_advisory_id: ALLOWED_GHSA,
    module_name: "braces",
    severity: "high",
    vulnerable_versions: "<=3.0.3",
    patched_versions: ">=3.0.4",
    findings: [{ version: "3.0.3", paths: [ALLOWED_PATH], dev: true, optional: false, bundled: false }],
    ...overrides,
  };
}

function otherAdvisory(dev = true): RawAdvisory {
  return {
    id: 1,
    github_advisory_id: "GHSA-2222-3333-4444",
    module_name: "left-pad",
    severity: "moderate",
    vulnerable_versions: "<1.3.1",
    patched_versions: ">=1.3.1",
    findings: [{ version: "1.3.0", paths: ["frontend>left-pad"], dev, optional: false, bundled: false }],
  };
}

function report(advisories: RawAdvisory[]): string {
  const vulnerabilities = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } as Record<string, number>;
  for (const advisory of advisories) vulnerabilities[advisory.severity] += 1;
  return JSON.stringify({
    advisories: Object.fromEntries(advisories.map((advisory) => [String(advisory.id), advisory])),
    metadata: { vulnerabilities, dependencies: 1, devDependencies: 1, optionalDependencies: 0, totalDependencies: 2 },
  });
}

function audits(prod: RawAdvisory[], full: RawAdvisory[]): (scope: AuditScope) => AuditRunResult {
  return (scope) => {
    const advisories = scope === "prod" ? prod : full;
    return { status: advisories.length > 0 ? 1 : 0, stdout: report(advisories) };
  };
}

function gate(runAudit: (scope: AuditScope) => AuditRunResult, exceptions: readonly AuditException[] = TEMPORARY_AUDIT_EXCEPTIONS) {
  return runDependencyAuditGate({ runAudit, exceptions });
}

test("1 · an exact injected exception is reported as tolerated", () => {
  assert.deepEqual(gate(audits([], [bracesAdvisory()]), [TEST_EXCEPTION]), { failures: [], tolerated: [ALLOWED_GHSA] });
});

test("2 · an injected exception does not tolerate another advisory", () => {
  const { failures } = gate(audits([], [bracesAdvisory(), otherAdvisory()]), [TEST_EXCEPTION]);
  assert.deepEqual(failures, ["advisory GHSA-2222-3333-4444 (left-pad) has no exception"]);
});

test("3 · a different advisory alone fails and also marks the exception stale", () => {
  const { failures } = gate(audits([], [otherAdvisory()]), [TEST_EXCEPTION]);
  assert.equal(failures.length, 2);
  assert.match(failures[0], /GHSA-2222-3333-4444 \(left-pad\) has no exception/);
  assert.match(failures[1], /GHSA-vfj7-8cjw-p6xm \(braces\) is stale/);
});

test("4 · any production advisory fails, including a formerly excepted GHSA", () => {
  for (const production of [otherAdvisory(false), bracesAdvisory()]) {
    const { failures, tolerated } = gate(audits([production], [production]));
    assert.equal(failures.length, 1);
    assert.match(failures[0], /^production advisory .* is never tolerated$/);
    assert.deepEqual(tolerated, []);
  }
});

test("5 · an injected exception does not cover a different package", () => {
  const { failures } = gate(audits([], [bracesAdvisory({ module_name: "micromatch" })]), [TEST_EXCEPTION]);
  assert.deepEqual(failures, [`advisory ${ALLOWED_GHSA} now targets micromatch, not braces; review the exception`]);
});

test("6 · a version, path, scope or range outside an injected exception fails", () => {
  const finding = bracesAdvisory().findings[0];
  for (const changed of [
    bracesAdvisory({ findings: [{ ...finding, version: "3.0.2" }] }),
    bracesAdvisory({ findings: [{ ...finding, paths: [`${ALLOWED_PATH}`, "other>braces"] }] }),
    bracesAdvisory({ findings: [{ ...finding, dev: false }] }),
    bracesAdvisory({ findings: [finding, { ...finding, version: "2.3.2" }] }),
    bracesAdvisory({ vulnerable_versions: "<=3.0.4" }),
  ]) {
    const { failures } = gate(audits([], [changed]), [TEST_EXCEPTION]);
    assert.equal(failures.length, 1, JSON.stringify(changed));
    assert.match(failures[0], /review the exception$/);
  }
});

test("7 · a clean full audit passes, while an injected stale exception fails", () => {
  assert.deepEqual(gate(audits([], [])), { failures: [], tolerated: [] });
  const { failures } = gate(audits([], []), [TEST_EXCEPTION]);
  assert.deepEqual(failures, [
    `exception ${ALLOWED_GHSA} (braces) is stale: the audit no longer reports it; remove the temporary exception`,
  ]);
});

test("the default gate rejects the formerly excepted GHSA", () => {
  assert.deepEqual(gate(audits([], [bracesAdvisory()])), {
    failures: [`advisory ${ALLOWED_GHSA} (braces) has no exception`],
    tolerated: [],
  });
});

test("8 · malformed audit output fails closed", () => {
  const malformed = [
    "",
    "not json",
    "[]",
    JSON.stringify({ advisories: {} }),
    JSON.stringify({ advisories: {}, metadata: { vulnerabilities: { high: 0 } } }),
    // counters disagree with the listed advisories
    report([bracesAdvisory()]).replace('"high":1', '"high":0'),
    report([bracesAdvisory({ github_advisory_id: "CVE-2026-0001" })]),
    report([bracesAdvisory({ findings: [] })]),
    report([bracesAdvisory({ findings: [{ version: "3.0.3", paths: [], dev: true, optional: false, bundled: false }] })]),
  ];
  for (const stdout of malformed) {
    assert.throws(() => parseAuditReport(stdout), Error, stdout);
    const { failures } = gate((scope) => (scope === "prod" ? { status: 0, stdout: report([]) } : { status: 1, stdout }));
    assert.equal(failures.length, 1, stdout);
  }
});

test("9 · a failed or inconsistent audit command fails closed", () => {
  const broken: AuditRunResult[] = [
    { status: null, stdout: "", error: new Error("spawn pnpm ENOENT") },
    { status: 2, stdout: report([]) },
    { status: 1, stdout: report([]) },
    { status: 0, stdout: report([bracesAdvisory()]) },
  ];
  for (const result of broken) {
    for (const scope of ["prod", "full"] as const) {
      const { failures, tolerated } = gate((current) =>
        current === scope ? result : { status: current === "prod" ? 0 : 1, stdout: report(current === "prod" ? [] : [bracesAdvisory()]) },
      );
      assert.equal(failures.length, 1, `${scope}: ${JSON.stringify(result)}`);
      assert.deepEqual(tolerated, []);
    }
  }
});

test("the default exception list is empty and frozen, with no wildcard or severity rule", () => {
  assert.deepEqual(TEMPORARY_AUDIT_EXCEPTIONS, []);
  assert.ok(Object.isFrozen(TEMPORARY_AUDIT_EXCEPTIONS));

  // The executable gate, read from the loaded functions themselves.
  const code = [parseAuditReport, evaluateProductionAudit, evaluateFullAudit, runPnpmAudit, runDependencyAuditGate, main]
    .map((fn) => fn.toString().replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))
    .join("\n");
  for (const forbidden of ["ignoreGhsas", "ignoreCves", "auditConfig", "continue-on-error", "|| true", '"*"', "GHSA-*", "startsWith("]) {
    assert.equal(code.includes(forbidden), false, `the gate must not use ${forbidden}`);
  }
  assert.equal(evaluateFullAudit.toString().includes("severity"), false, "tolerance never depends on severity");

  // Both audits see every severity: pnpm's default --audit-level (low) would hide `info`.
  const audit = runPnpmAudit.toString();
  assert.ok(audit.includes('const level = ["--audit-level", "info"];'));
  assert.ok(audit.includes('["audit", "--prod", "--json", ...level]'), "the production audit keeps --prod at level info");
  assert.ok(audit.includes('["audit", "--json", ...level]'), "the full audit runs at level info");
  assert.equal((audit.match(/--audit-level/g) ?? []).length, 1, "a single, explicit audit level");
  assert.equal(/"(?:low|moderate|high|critical)"/.test(audit), false, "no raised audit level");
});
