export interface ZipEntry {
  name: string;
  data: Buffer;
}

export interface SanitizationViolation {
  path: string;
  rule: string;
}

export interface SanitizationManifest {
  tool: string;
  policy: string;
  inputs: { name: string; present: boolean }[];
  kept: { path: string; members?: string[]; omittedMembers?: { member: string; reason: string }[] }[];
  omitted: { path: string; reason: string }[];
}

export interface ValidateOptions {
  root: string;
  harvestedValues: Iterable<string>;
}

export interface SanitizeOptions {
  inputs: string[];
  output: string;
  validate?: (options: ValidateOptions) => SanitizationViolation[];
}

export interface SanitizeResult {
  manifest: SanitizationManifest;
  violations: SanitizationViolation[];
  harvestedCount: number;
}

export const REDACTED: string;
export const MIN_HARVESTED_VALUE_LENGTH: number;
export const MANIFEST_FILE: string;
export const ALWAYS_REDACTED_HEADER_NAMES: readonly string[];
export const BENIGN_HEADER_NAMES: ReadonlySet<string>;
export const STRUCTURAL_KEYS: ReadonlySet<string>;
export const KEPT_EVENT_TYPES: readonly string[];
export const FORBIDDEN_PARAM_KEYS: readonly string[];

export function readZip(buffer: Buffer): ZipEntry[];
export function writeZip(entries: readonly ZipEntry[]): Buffer;
export function addHarvested(values: Set<string>, candidate: unknown): void;
export function harvestEvent(values: Set<string>, event: unknown): void;
export function harvestReportNode(values: Set<string>, node: unknown): void;
export function createRedactor(harvestedValues: Iterable<string>): (text: string) => string;
export function redactUrl(value: unknown, redactText: (text: string) => string): string | undefined;
export function sanitizeEvent(event: unknown, redactText: (text: string) => string): Record<string, unknown> | null;
export function harvestTraceZip(values: Set<string>, buffer: Buffer): void;
export function sanitizeTraceZip(
  buffer: Buffer,
  redactText: (text: string) => string,
): { zip: Buffer; keptMembers: string[]; omitted: { member: string; reason: string }[] };
export function extractReportPayload(html: string): { match: RegExpMatchArray; zip: Buffer } | null;
export function harvestReportHtml(values: Set<string>, html: string): void;
export function sanitizeReportHtml(html: string, redactText: (text: string) => string): string;
export function harvestInputs(inputRoots: readonly string[]): Set<string>;
export function sanitizeArtifacts(options: SanitizeOptions): SanitizeResult;
export function validateTraceZip(buffer: Buffer, context: { path: string; harvestedValues: readonly string[] }): SanitizationViolation[];
export function validateSanitizedTree(options: ValidateOptions): SanitizationViolation[];
export function parseArguments(argv: readonly string[]): { inputs: string[]; output: string };
export function runCli(argv: readonly string[]): number;
