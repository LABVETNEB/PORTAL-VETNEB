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

export interface SbomToolComponent {
  type: string;
  name: string;
  version: string;
}

/** A workspace deployable: one application derived from one package manifest. */
export interface SbomDeployableComponent {
  type: "application";
  "bom-ref": string;
  name: string;
  version: string;
  purl: string;
  properties: readonly SbomProperty[];
}

/**
 * Aggregate monorepo subject. It owns the deployables and deliberately carries
 * no version or purl, because the platform itself is not a published package.
 */
export interface SbomPlatformComponent {
  type: "application";
  "bom-ref": string;
  name: string;
  description: string;
  components: readonly SbomDeployableComponent[];
}

export interface SbomDocument {
  bomFormat: string;
  specVersion: string;
  version: number;
  metadata: {
    tools: { components: readonly SbomToolComponent[] };
    component: SbomPlatformComponent;
    properties: readonly SbomProperty[];
  };
  components: readonly SbomComponent[];
}

export interface SbomDeployableIdentity {
  name: string;
  version: string;
  purl: string;
  manifestPath: string;
}

export interface GenerateSbomOptions {
  rootDir?: string;
  sourceCommit?: string;
}

export const SBOM_GENERATOR_NAME: string;
export const SBOM_GENERATOR_VERSION: string;
export const SBOM_SPEC_VERSION: string;
export const DEFAULT_SBOM_OUTPUT_PATH: string;
export const SBOM_PLATFORM_COMPONENT_NAME: string;
export const SBOM_DEPLOYABLE_MANIFEST_PATHS: readonly string[];

export function readDeployableIdentity(
  rootDir: string,
  manifestPath: string,
): SbomDeployableIdentity;
export function splitPackageKey(key: string): { name: string; version: string } | null;
export function normalizeVersion(version: string): string;
export function packageUrl(name: string, version: string): string;
export function integrityToHash(integrity: unknown): SbomHash | null;
export function generateSbom(options?: GenerateSbomOptions): SbomDocument;
export function renderSbom(document: SbomDocument): string;
export function main(argv?: readonly string[]): number;
