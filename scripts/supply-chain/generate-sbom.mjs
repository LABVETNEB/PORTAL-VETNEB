#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CORE_SCHEMA, load } from "js-yaml";

export const SBOM_GENERATOR_NAME = "vetneb-sbom-generator";
export const SBOM_GENERATOR_VERSION = "1.0.0";
export const SBOM_SPEC_VERSION = "1.6";
export const DEFAULT_SBOM_OUTPUT_PATH = "sbom/portal-vetneb.cdx.json";
export const SBOM_PLATFORM_COMPONENT_NAME = "portal-vetneb";
export const SBOM_DEPLOYABLE_MANIFEST_PATHS = ["package.json", "frontend/package.json"];

const LOCKFILE_PATH = "pnpm-lock.yaml";
const MAX_YAML_DEPTH = 100;
const INTEGRITY_RE = /^(sha512|sha256|sha1)-([A-Za-z0-9+/]+={0,2})$/;
const NPM_NAME_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const NPM_VERSION_RE = /^[^\s/@]+$/;

const HASH_ALGORITHMS = new Map([
  ["sha512", "SHA-512"],
  ["sha256", "SHA-256"],
  ["sha1", "SHA-1"],
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readText(rootDir, relativePath) {
  return readFileSync(resolve(rootDir, relativePath), "utf8");
}

/**
 * Splits a pnpm lockfile package key into its package name and version.
 * Scoped names keep their leading `@`, so the separator is the last `@`
 * that is not the first character.
 */
export function splitPackageKey(key) {
  const separatorIndex = key.lastIndexOf("@");
  if (separatorIndex <= 0) return null;

  const name = key.slice(0, separatorIndex);
  const version = key.slice(separatorIndex + 1);
  if (name === "" || version === "") return null;

  return { name, version };
}

/**
 * Removes the pnpm peer-resolution suffix, e.g. `0.45.2(pg@8.20.0)` -> `0.45.2`.
 */
export function normalizeVersion(version) {
  const parenthesisIndex = String(version).indexOf("(");
  return parenthesisIndex === -1 ? String(version) : String(version).slice(0, parenthesisIndex);
}

export function packageUrl(name, version) {
  const encodedVersion = encodeURIComponent(version);
  if (!name.startsWith("@")) return `pkg:npm/${encodeURIComponent(name)}@${encodedVersion}`;

  const [scope, unscopedName] = name.slice(1).split("/", 2);
  return `pkg:npm/%40${encodeURIComponent(scope)}/${encodeURIComponent(unscopedName)}@${encodedVersion}`;
}

/**
 * Converts a Subresource Integrity value into a CycloneDX hash entry.
 * Returns null when the integrity value is absent or not a supported digest.
 */
export function integrityToHash(integrity) {
  if (typeof integrity !== "string") return null;

  const match = INTEGRITY_RE.exec(integrity.trim());
  if (!match) return null;

  const algorithm = HASH_ALGORITHMS.get(match[1]);
  if (!algorithm) return null;

  return { alg: algorithm, content: Buffer.from(match[2], "base64").toString("hex") };
}

function collectDirectDependencyKeys(lockfile) {
  const direct = new Set();
  if (!isPlainObject(lockfile.importers)) return direct;

  for (const importer of Object.values(lockfile.importers)) {
    if (!isPlainObject(importer)) continue;
    for (const group of ["dependencies", "devDependencies", "optionalDependencies"]) {
      if (!isPlainObject(importer[group])) continue;
      for (const [name, entry] of Object.entries(importer[group])) {
        if (!isPlainObject(entry) || typeof entry.version !== "string") continue;
        direct.add(`${name}@${normalizeVersion(entry.version)}`);
      }
    }
  }

  return direct;
}

function buildComponents(lockfile) {
  if (!isPlainObject(lockfile.packages)) return [];

  const direct = collectDirectDependencyKeys(lockfile);
  const components = [];

  for (const [key, entry] of Object.entries(lockfile.packages)) {
    const parsed = splitPackageKey(key);
    if (!parsed) continue;

    const { name, version } = parsed;
    const component = {
      type: "library",
      name,
      version,
      purl: packageUrl(name, version),
      properties: [
        {
          name: "vetneb:relationship",
          value: direct.has(`${name}@${version}`) ? "direct" : "transitive",
        },
      ],
    };

    const hash = isPlainObject(entry) && isPlainObject(entry.resolution)
      ? integrityToHash(entry.resolution.integrity)
      : null;
    if (hash) component.hashes = [hash];

    components.push(component);
  }

  return components.sort((left, right) => left.purl.localeCompare(right.purl));
}

function buildMetadataProperties({ lockfile, sourceCommit }) {
  const properties = [
    { name: "vetneb:lockfile", value: LOCKFILE_PATH },
    { name: "vetneb:lockfile-version", value: String(lockfile.lockfileVersion ?? "unknown") },
  ];

  if (typeof sourceCommit === "string" && /^[0-9a-f]{40}$/.test(sourceCommit)) {
    properties.push({ name: "vetneb:source-commit", value: sourceCommit });
  }

  return properties;
}

/**
 * Reads one workspace manifest and derives the identity of its deployable.
 * Fails closed: an unreadable, non-JSON, unnamed, unversioned or non-encodable
 * manifest aborts generation instead of degrading to a placeholder identity.
 * Error messages carry the manifest path and the reason only, never content.
 */
export function readDeployableIdentity(rootDir, manifestPath) {
  let source;
  try {
    source = readText(rootDir, manifestPath);
  } catch {
    throw new Error(`${manifestPath} is required to build the SBOM subject and could not be read.`);
  }

  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch {
    throw new Error(`${manifestPath} is not valid JSON.`);
  }

  if (!isPlainObject(manifest)) {
    throw new Error(`${manifestPath} must contain a JSON object.`);
  }

  const { name, version } = manifest;

  if (typeof name !== "string" || name.trim() === "") {
    throw new Error(`${manifestPath} must declare a non-empty string name.`);
  }
  if (typeof version !== "string" || version.trim() === "") {
    throw new Error(`${manifestPath} must declare a non-empty string version.`);
  }
  if (!NPM_NAME_RE.test(name)) {
    throw new Error(`${manifestPath} name cannot be encoded as an npm package URL.`);
  }
  if (!NPM_VERSION_RE.test(version)) {
    throw new Error(`${manifestPath} version cannot be encoded as an npm package URL.`);
  }

  const purl = packageUrl(name, version);
  if (!purl.startsWith(`pkg:npm/`) || !purl.endsWith(`@${encodeURIComponent(version)}`)) {
    throw new Error(`${manifestPath} does not produce a valid npm package URL.`);
  }

  return { name, version, purl, manifestPath };
}

function deployableComponent(identity) {
  return {
    type: "application",
    "bom-ref": identity.purl,
    name: identity.name,
    version: identity.version,
    purl: identity.purl,
    properties: [{ name: "vetneb:manifest", value: identity.manifestPath }],
  };
}

/**
 * Builds the aggregate monorepo subject. The BOM covers the whole workspace, so
 * the subject is the platform and both deployables hang off it as child
 * applications; neither one may claim the combined lockfile inventory.
 */
function buildPlatformSubject(rootDir) {
  const identities = SBOM_DEPLOYABLE_MANIFEST_PATHS.map((manifestPath) =>
    readDeployableIdentity(rootDir, manifestPath),
  );

  const references = new Set(identities.map((identity) => identity.purl));
  if (references.size !== identities.length) {
    throw new Error("Workspace deployables must resolve to distinct npm package URLs.");
  }

  return {
    type: "application",
    "bom-ref": SBOM_PLATFORM_COMPONENT_NAME,
    name: SBOM_PLATFORM_COMPONENT_NAME,
    description:
      "Aggregate subject for the VETNEB monorepo. The package inventory is the combined pnpm workspace lockfile and belongs to no single deployable.",
    components: identities
      .map(deployableComponent)
      .sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"])),
  };
}

/**
 * Builds a deterministic CycloneDX document from the committed pnpm lockfile.
 * The document intentionally omits `serialNumber` and `metadata.timestamp`
 * so that the same commit always produces byte-identical output.
 */
export function generateSbom({ rootDir = process.cwd(), sourceCommit = process.env.GITHUB_SHA } = {}) {
  const lockfileSource = readText(rootDir, LOCKFILE_PATH);
  const lockfile = load(lockfileSource, {
    filename: LOCKFILE_PATH,
    schema: CORE_SCHEMA,
    maxDepth: MAX_YAML_DEPTH,
    maxAliases: 0,
  });

  if (!isPlainObject(lockfile)) {
    throw new Error(`${LOCKFILE_PATH} must parse into a mapping object.`);
  }

  const component = buildPlatformSubject(rootDir);

  return {
    bomFormat: "CycloneDX",
    specVersion: SBOM_SPEC_VERSION,
    version: 1,
    metadata: {
      tools: {
        components: [
          {
            type: "application",
            name: SBOM_GENERATOR_NAME,
            version: SBOM_GENERATOR_VERSION,
          },
        ],
      },
      component,
      properties: buildMetadataProperties({ lockfile, sourceCommit }),
    },
    components: buildComponents(lockfile),
  };
}

export function renderSbom(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function parseArguments(argv) {
  const options = { out: DEFAULT_SBOM_OUTPUT_PATH, stdout: false, unknown: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--stdout") {
      options.stdout = true;
      continue;
    }
    if (argument === "--out") {
      const value = argv[index + 1];
      if (typeof value !== "string" || value.startsWith("--")) {
        options.unknown.push("--out requires a path value");
        continue;
      }
      options.out = value;
      index += 1;
      continue;
    }
    options.unknown.push(argument);
  }

  return options;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);

  if (options.unknown.length > 0) {
    process.stderr.write(`Unsupported argument(s): ${options.unknown.join(", ")}.\n`);
    return 1;
  }

  let payload;
  try {
    payload = renderSbom(generateSbom());
  } catch (error) {
    process.stderr.write(`SBOM generation failed: ${error.message}\n`);
    return 1;
  }

  if (options.stdout) {
    process.stdout.write(payload);
    return 0;
  }

  const outputPath = resolve(process.cwd(), options.out);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, payload, "utf8");
  process.stdout.write(`CycloneDX ${SBOM_SPEC_VERSION} SBOM written to ${options.out}.\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main());
}
