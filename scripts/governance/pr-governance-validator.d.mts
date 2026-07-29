export interface ScopeContractInput {
  body: string;
  categories: string[];
}

export interface ScopeContractResult {
  failures: string[];
  details: string[];
  primary: string[];
  selected: string[];
  exceptionChecked: boolean;
}

export interface GovernanceChangedFileEntry {
  status: string;
  path: string;
  display?: string;
  oldPath?: string;
  newPath?: string;
}

export interface ArchitectureDecisionContractInput {
  body: string;
  entries: GovernanceChangedFileEntry[];
  rootDir: string;
  trustedDependabot?: boolean;
}

export interface ArchitectureDecisionContractResult {
  failures: string[];
  details: string[];
  status: "PASS" | "FAIL" | "N/A";
}

export interface DependabotAutomationContractInput {
  event: unknown;
  entries: GovernanceChangedFileEntry[];
}

export interface DependabotAutomationContractResult {
  failures: string[];
  details: string[];
  primary: string[];
}

export const CATEGORY_ORDER: string[];

export function classifyPath(inputPath: string): string;

export function extractSection(body: string, sectionName: string): string;

export function derivePrimaryCategories(inputCategories: string[]): string[];

export function detectSecretPattern(lineText: string): string | null;

export function requiresArchitectureDecision(
  entries: GovernanceChangedFileEntry[],
): boolean;

export function evaluateArchitectureDecisionContract(
  input: ArchitectureDecisionContractInput,
): ArchitectureDecisionContractResult;

export function evaluateScopeContract(input: ScopeContractInput): ScopeContractResult;

export function isTrustedDependabotPullRequest(event: unknown): boolean;

export function evaluateDependabotAutomationContract(
  input: DependabotAutomationContractInput,
): DependabotAutomationContractResult;

export function main(): number;
