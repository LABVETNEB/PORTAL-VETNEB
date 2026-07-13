import type { ImpactRule, QualityGate, QualityGateCommand, TestTaxonomySuite } from "./quality-gate-impact-policy.mjs";

export interface ChangedFileEntry {
  status: string;
  path: string;
  oldPath?: string;
  newPath?: string;
  display: string;
}

export interface ChangedPathRoute {
  role: "path" | "old" | "new";
  path: string;
  rule: ImpactRule | null;
}

export interface ChangedPathImpact {
  status: string;
  path: string;
  oldPath?: string;
  newPath?: string;
  display: string;
  rule: ImpactRule | null;
  rules: ImpactRule[];
  routes: ChangedPathRoute[];
  impacts: string[];
  gates: QualityGate[];
  suites: Array<TestTaxonomySuite | { id: string }>;
}

export interface QualityGateImpactReport {
  passed: boolean;
  failures: string[];
  details: string[];
  policyVersion: string;
  changedPaths: ChangedPathImpact[];
  impactedImpacts: string[];
  impactedGates: QualityGate[];
  impactedSuites: Array<TestTaxonomySuite | { id: string }>;
  scriptsPassed: boolean;
  readmePassed: boolean;
}

export function findImpactRuleForPath(inputPath: string, rules?: readonly ImpactRule[]): ImpactRule | null;

export function validateImpactPolicy(input?: {
  gates?: readonly QualityGate[];
  rules?: readonly ImpactRule[];
  taxonomy?: readonly TestTaxonomySuite[];
}): { passed: boolean; failures: string[] };

export function validateRulePrecedence(input: {
  rules?: readonly ImpactRule[];
  specificPath: string;
  generalPath: string;
  expectedSpecificRuleId: string;
  expectedGeneralRuleId: string;
}): { passed: boolean; failures: string[] };

export function parsePackageScripts(packageJsonText: string, label: string): Record<string, string>;

export function collectPolicyCommands(input?: {
  gates?: readonly QualityGate[];
  taxonomy?: readonly TestTaxonomySuite[];
}): QualityGateCommand[];

export function validateCommandReferences(input: {
  rootPackageJsonText: string;
  frontendPackageJsonText: string;
  commands?: readonly QualityGateCommand[];
  directAllowlist?: readonly { command: string; reason: string }[];
}): { passed: boolean; failures: string[] };

export function renderTestTaxonomyProjection(input?: {
  taxonomy?: readonly TestTaxonomySuite[];
  gates?: readonly QualityGate[];
}): string;

export function renderReadmeTaxonomyBlock(input?: {
  taxonomy?: readonly TestTaxonomySuite[];
  gates?: readonly QualityGate[];
}): string;

export function validateReadmeTaxonomyProjection(input?: {
  readmeText: string;
  expectedProjection?: string;
  markers?: Readonly<{ start: string; end: string }>;
}): { passed: boolean; failures: string[] };

export function evaluateChangedPathImpact(input?: {
  entries: readonly ChangedFileEntry[];
  rules?: readonly ImpactRule[];
  gates?: readonly QualityGate[];
  taxonomy?: readonly TestTaxonomySuite[];
  requiredSourcePaths?: readonly string[];
}): {
  passed: boolean;
  failures: string[];
  changedPaths: ChangedPathImpact[];
  impactedImpacts: string[];
  impactedGates: QualityGate[];
  impactedSuites: Array<TestTaxonomySuite | { id: string }>;
};

export function evaluateQualityGateImpact(input?: {
  entries: readonly ChangedFileEntry[];
  rootPackageJsonText: string;
  frontendPackageJsonText: string;
  readmeText: string;
  gates?: readonly QualityGate[];
  rules?: readonly ImpactRule[];
  taxonomy?: readonly TestTaxonomySuite[];
}): QualityGateImpactReport;

export function validateQualityGateImpact(input?: {
  entries: readonly ChangedFileEntry[];
  rootDir?: string;
}): QualityGateImpactReport;

export function renderQualityGateImpactSummary(report: QualityGateImpactReport | null): string;
