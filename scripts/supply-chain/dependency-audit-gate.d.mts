export interface AuditFinding {
  version: string;
  dev: boolean;
  paths: readonly string[];
}

export interface AuditAdvisory {
  githubAdvisoryId: string;
  moduleName: string;
  severity: "info" | "low" | "moderate" | "high" | "critical";
  vulnerableVersions: string;
  findings: readonly AuditFinding[];
}

export interface AuditException {
  githubAdvisoryId: string;
  moduleName: string;
  vulnerableVersions: string;
  findings: readonly AuditFinding[];
  reason: string;
}

export interface AuditRunResult {
  status: number | null;
  stdout: string;
  error?: Error;
}

export type AuditScope = "prod" | "full";

export const TEMPORARY_AUDIT_EXCEPTIONS: readonly AuditException[];

export function parseAuditReport(stdout: string): AuditAdvisory[];

export function evaluateProductionAudit(advisories: readonly AuditAdvisory[]): string[];

export function evaluateFullAudit(
  advisories: readonly AuditAdvisory[],
  exceptions?: readonly AuditException[],
): string[];

export function runPnpmAudit(scope: AuditScope): AuditRunResult;

export function runDependencyAuditGate(options?: {
  runAudit?: (scope: AuditScope) => AuditRunResult;
  exceptions?: readonly AuditException[];
}): { failures: string[]; tolerated: string[] };

export function main(): number;
