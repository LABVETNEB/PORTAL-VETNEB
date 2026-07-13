export interface PackageScriptCommand {
  id: string;
  type: "package-script";
  packageScope: "root" | "frontend";
  script: string;
  command: string;
}

export interface DirectCommand {
  id: string;
  type: "direct";
  command: string;
  reason: string;
}

export type QualityGateCommand = PackageScriptCommand | DirectCommand;

export interface QualityGate {
  id: string;
  name: string;
  workflow: string | null;
  check: string | null;
  execution: string;
  required: boolean;
  owner: string;
  commands: QualityGateCommand[];
  responsibility: string;
}

export interface ImpactRule {
  id: string;
  matcher:
    | { type: "exact"; path: string }
    | { type: "prefix"; path: string }
    | { type: "root-markdown" };
  impacts: string[];
  gates: string[];
  suiteIds: string[];
  description: string;
}

export interface TestTaxonomySuite {
  id: string;
  purpose: string;
  representativePaths: string[];
  gate: string;
  commands: PackageScriptCommand[];
  packageScope: "root" | "frontend";
  requirement: "mandatory" | "conditional";
}

export const POLICY_VERSION: string;
export const README_MARKERS: Readonly<{ start: string; end: string }>;
export const QUALITY_GATES: readonly QualityGate[];
export const IMPACT_RULES: readonly ImpactRule[];
export const TEST_TAXONOMY: readonly TestTaxonomySuite[];
export const REQUIRED_SOURCE_PATHS: readonly string[];
export const DIRECT_COMMAND_ALLOWLIST: readonly { command: string; reason: string }[];
