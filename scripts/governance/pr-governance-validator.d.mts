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

export const CATEGORY_ORDER: string[];

export function classifyPath(inputPath: string): string;

export function extractSection(body: string, sectionName: string): string;

export function derivePrimaryCategories(inputCategories: string[]): string[];

export function evaluateScopeContract(input: ScopeContractInput): ScopeContractResult;

export function main(): number;
