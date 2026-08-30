export interface EnvValueEntry {
  key: string;
  value: string;
  sourceFile: string;
}

export interface RootOptions {
  root?: string;
}

export interface EnvOptions {
  env?: Record<string, string | undefined>;
}

export interface StreamOptions extends RootOptions {
  chunkSize?: number;
}

export const ENV_FILES: readonly string[];
export const TEXT_EXTENSIONS: ReadonlySet<string>;
export const EXPLICIT_BLOCKED_IDENTIFIERS: readonly string[];
export const SENSITIVE_ENV_KEY_REGEX: RegExp;
export const STREAM_CHUNK_SIZE: number;
export const CANARY_ENV_VALUE_VAR: string;
export const DEFAULT_CANARY_SECRET_VALUE: string;
export const CANARY_KEY: string;

export function streamTextWindows(
  relativePath: string,
  carryoverLength: number,
  onWindow: (window: string) => void,
  options?: StreamOptions,
): Promise<boolean>;

export function normalizeEnvValue(rawValue: string): string;

export function readEnvEntries(options?: RootOptions): EnvValueEntry[];

export function isSensitiveEnvKey(key: string): boolean;

export function isSearchableSecretValue(value: string): boolean;

export function scanEnvValueLeaksInFile(
  relativePath: string,
  envEntries: readonly EnvValueEntry[],
  options?: StreamOptions,
): Promise<EnvValueEntry[]>;

export function readCanaryEntry(options?: EnvOptions): EnvValueEntry;

export function readAllowlistedProcessEnvEntries(options?: EnvOptions): EnvValueEntry[];

export function readEnvValueSources(
  options?: RootOptions & EnvOptions,
): EnvValueEntry[];

export function selectSensitiveEntries(
  entries: readonly EnvValueEntry[],
): EnvValueEntry[];

export function validateEnvValueSourcesEvaluated(
  entries: readonly EnvValueEntry[],
  sensitiveEntries: readonly EnvValueEntry[],
): string | null;
