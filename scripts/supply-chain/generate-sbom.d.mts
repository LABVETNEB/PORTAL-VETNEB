export interface SbomHash {
  alg: string;
  content: string;
}

export interface SbomProperty {
  name: string;
  value: string;
}

export interface SbomComponent {
  type: string;
  name: string;
  version: string;
  purl: string;
  properties: readonly SbomProperty[];
  hashes?: readonly SbomHash[];
}

export interface SbomDocument {
  bomFormat: string;
  specVersion: string;
  version: number;
  metadata: {
    tools: { components: readonly SbomComponent[] | readonly Record<string, unknown>[] };
    component: { type: string; name: string; version: string; purl: string };
    properties: readonly SbomProperty[];
  };
  components: readonly SbomComponent[];
}

export interface GenerateSbomOptions {
  rootDir?: string;
  sourceCommit?: string;
}

export const SBOM_GENERATOR_NAME: string;
export const SBOM_GENERATOR_VERSION: string;
export const SBOM_SPEC_VERSION: string;
export const DEFAULT_SBOM_OUTPUT_PATH: string;

export function splitPackageKey(key: string): { name: string; version: string } | null;
export function normalizeVersion(version: string): string;
export function packageUrl(name: string, version: string): string;
export function integrityToHash(integrity: unknown): SbomHash | null;
export function generateSbom(options?: GenerateSbomOptions): SbomDocument;
export function renderSbom(document: SbomDocument): string;
export function main(argv?: readonly string[]): number;
