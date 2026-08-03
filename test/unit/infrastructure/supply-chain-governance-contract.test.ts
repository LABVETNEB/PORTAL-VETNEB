import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  DEFAULT_SBOM_OUTPUT_PATH,
  SBOM_DEPLOYABLE_MANIFEST_PATHS,
  SBOM_GENERATOR_NAME,
  SBOM_PLATFORM_COMPONENT_NAME,
  SBOM_SPEC_VERSION,
  generateSbom,
  integrityToHash,
  normalizeVersion,
  packageUrl,
  readDeployableIdentity,
  renderSbom,
  splitPackageKey,
} from "../../../scripts/supply-chain/generate-sbom.mjs";

const require = createRequire(import.meta.url);
const { CORE_SCHEMA, load } = require("js-yaml") as {
  CORE_SCHEMA: unknown;
  load: (source: string, options: Record<string, unknown>) => unknown;
};

const DEPENDABOT_PATH = ".github/dependabot.yml";
const BACKEND_CI_PATH = ".github/workflows/backend-ci.yml";

const REQUIRED_MERGE_CONTEXTS = [
  "validate-pr-governance",
  "qga-workflow-security",
  "validate-backend",
  "validate-frontend",
] as const;

const SBOM_JOB_ID = "generate-sbom";
const SBOM_ARTIFACT_NAME = "sbom-cyclonedx";
const SHA_40 = /^[0-9a-f]{40}$/;

type DependabotGroup = {
  "applies-to"?: string;
  "update-types"?: string[];
  patterns?: string[];
};

type DependabotUpdate = {
  "package-ecosystem"?: string;
  directory?: string;
  schedule?: { interval?: string };
  "open-pull-requests-limit"?: number;
  labels?: string[];
  groups?: Record<string, DependabotGroup>;
};

type DependabotConfig = {
  version?: number;
  updates?: DependabotUpdate[];
};

type WorkflowStep = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
};

type WorkflowJob = {
  name?: string;
  needs?: string | string[];
  permissions?: unknown;
  steps?: WorkflowStep[];
};

type Workflow = {
  permissions?: Record<string, string>;
  jobs?: Record<string, WorkflowJob>;
};

const FIXTURE_INTEGRITY = `sha512-${Buffer.alloc(64, 7).toString("base64")}`;

const FIXTURE_LOCKFILE = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      fastify:
        specifier: ^5.10.0
        version: 5.10.0

packages:

  fastify@5.10.0:
    resolution: {integrity: ${FIXTURE_INTEGRITY}}
`;

type FixtureManifests = {
  root?: string;
  frontend?: string;
};

/**
 * Builds an isolated workspace so negative mutations never touch the real
 * manifests in the working tree.
 */
function withFixtureWorkspace<T>(
  manifests: FixtureManifests,
  callback: (rootDir: string) => T,
): T {
  const rootDir = mkdtempSync(join(tmpdir(), "vetneb-sbom-"));

  try {
    writeFileSync(join(rootDir, "pnpm-lock.yaml"), FIXTURE_LOCKFILE, "utf8");
    if (manifests.root !== undefined) {
      writeFileSync(join(rootDir, "package.json"), manifests.root, "utf8");
    }
    if (manifests.frontend !== undefined) {
      mkdirSync(join(rootDir, "frontend"), { recursive: true });
      writeFileSync(join(rootDir, "frontend", "package.json"), manifests.frontend, "utf8");
    }
    return callback(rootDir);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

function manifest(name: unknown, version: unknown): string {
  return JSON.stringify({ name, version });
}

const VALID_ROOT_MANIFEST = manifest("fixture-backend", "2.1.0");
const VALID_FRONTEND_MANIFEST = manifest("fixture-frontend", "1.0.0");

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

function parseYaml<T>(relativePath: string): T {
  return load(read(relativePath), {
    filename: relativePath,
    schema: CORE_SCHEMA,
    maxAliases: 0,
  }) as T;
}

function dependabotConfig(): DependabotConfig {
  return parseYaml<DependabotConfig>(DEPENDABOT_PATH);
}

function backendWorkflow(): Workflow {
  return parseYaml<Workflow>(BACKEND_CI_PATH);
}

function updateEntries(): DependabotUpdate[] {
  const updates = dependabotConfig().updates;
  assert.ok(Array.isArray(updates), "dependabot.yml must declare an updates array");
  return updates;
}

function entryKey(update: DependabotUpdate): string {
  return `${update["package-ecosystem"]}:${update.directory}`;
}

function sbomJob(): WorkflowJob {
  const job = backendWorkflow().jobs?.[SBOM_JOB_ID];
  assert.ok(job, `${BACKEND_CI_PATH} must declare the ${SBOM_JOB_ID} job`);
  return job;
}

function needsOf(job: WorkflowJob): string[] {
  if (typeof job.needs === "string") return [job.needs];
  return Array.isArray(job.needs) ? job.needs : [];
}

test("dependabot config parses as a version 2 document with exactly three ecosystem entries", () => {
  const config = dependabotConfig();

  assert.equal(config.version, 2);
  assert.deepEqual(updateEntries().map(entryKey), [
    "npm:/",
    "npm:/frontend",
    "github-actions:/",
  ]);
});

test("npm root, npm frontend and GitHub Actions stay separate update entries", () => {
  const keys = updateEntries().map(entryKey);

  assert.equal(new Set(keys).size, keys.length, "no ecosystem/directory pair may be duplicated");

  const npmDirectories = updateEntries()
    .filter((update) => update["package-ecosystem"] === "npm")
    .map((update) => update.directory)
    .sort();

  assert.deepEqual(npmDirectories, ["/", "/frontend"]);
  assert.equal(
    updateEntries().filter((update) => update["package-ecosystem"] === "github-actions").length,
    1,
  );
});

test("every dependabot entry preserves weekly schedule, PR limit and labels", () => {
  for (const update of updateEntries()) {
    assert.equal(update.schedule?.interval, "weekly", entryKey(update));
    assert.equal(update["open-pull-requests-limit"], 10, entryKey(update));
    assert.deepEqual(update.labels, ["dependencies"], entryKey(update));
  }
});

test("risk grouping never mixes majors with lower-risk updates", () => {
  for (const update of updateEntries()) {
    const groups = update.groups ?? {};
    assert.ok(Object.keys(groups).length > 0, `${entryKey(update)} must declare a risk group`);

    for (const [groupName, group] of Object.entries(groups)) {
      assert.equal(group["applies-to"], "version-updates", `${groupName} applies-to`);
      assert.deepEqual(group["update-types"], ["minor", "patch"], `${groupName} update-types`);
      assert.ok(
        !(group["update-types"] ?? []).includes("major"),
        `${groupName} must never group major updates`,
      );
    }
  }
});

test("each ecosystem owns a distinct group namespace so groups cannot span ecosystems", () => {
  const groupNames = updateEntries().flatMap((update) => Object.keys(update.groups ?? {}));

  assert.equal(new Set(groupNames).size, groupNames.length);
  assert.deepEqual(groupNames.sort(), [
    "github-actions-low-risk",
    "npm-frontend-low-risk",
    "npm-root-low-risk",
  ]);
});

test("dependabot config never enables automatic merge or external code execution", () => {
  const source = read(DEPENDABOT_PATH).toLowerCase();

  for (const forbidden of [
    "automerge",
    "auto-merge",
    "insecure-external-code-execution",
    "target-branch",
    "registries:",
  ]) {
    assert.ok(!source.includes(forbidden), `dependabot.yml must not declare ${forbidden}`);
  }
});

test("backend CI declares the SBOM job without any dependency edge to the required context", () => {
  const jobs = backendWorkflow().jobs ?? {};

  assert.deepEqual(needsOf(sbomJob()), [], "the SBOM job must not depend on other jobs");

  for (const [jobId, job] of Object.entries(jobs)) {
    assert.ok(
      !needsOf(job).includes(SBOM_JOB_ID),
      `${jobId} must not depend on ${SBOM_JOB_ID}`,
    );
  }

  assert.deepEqual(needsOf(jobs["backend-check"] ?? {}), [
    "detect-backend-impact",
    "validate-backend",
  ]);
});

test("the SBOM job is not one of the required merge contexts", () => {
  const jobs = backendWorkflow().jobs ?? {};
  const sbomCheckName = jobs[SBOM_JOB_ID]?.name ?? SBOM_JOB_ID;

  assert.equal(sbomCheckName, SBOM_JOB_ID);
  assert.ok(!REQUIRED_MERGE_CONTEXTS.includes(sbomCheckName as never));
  assert.equal(jobs["backend-check"]?.name, "validate-backend");
});

test("backend CI keeps minimum permissions and declares no job-level permissions", () => {
  const workflow = backendWorkflow();

  assert.deepEqual(workflow.permissions, { contents: "read" });

  for (const [jobId, job] of Object.entries(workflow.jobs ?? {})) {
    assert.equal(job.permissions, undefined, `${jobId} must not declare job-level permissions`);
  }
});

test("backend CI never masks failures with continue-on-error or shell short-circuits", () => {
  const source = read(BACKEND_CI_PATH);

  assert.ok(!source.includes("continue-on-error"));
  assert.ok(!source.includes("|| true"));
  assert.ok(!source.includes("if: always()\n        run: node scripts/supply-chain"));
});

test("SBOM job pins every action to a 40-character SHA and uses no floating version", () => {
  const steps = sbomJob().steps ?? [];
  const references = steps
    .map((step) => step.uses)
    .filter((reference): reference is string => typeof reference === "string");

  assert.deepEqual(references, [
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    "pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  ]);

  for (const reference of references) {
    assert.match(reference.split("@").pop() ?? "", SHA_40, reference);
  }

  const pnpmSetup = steps.find((step) => step.uses?.startsWith("pnpm/action-setup@"));
  assert.equal(pnpmSetup?.with?.version, "11.13.0");
});

test("SBOM generation runs the repository generator without network installs", () => {
  const commands = (sbomJob().steps ?? [])
    .map((step) => step.run)
    .filter((command): command is string => typeof command === "string");

  assert.deepEqual(commands, [
    "pnpm install --frozen-lockfile",
    `node scripts/supply-chain/generate-sbom.mjs --out ${DEFAULT_SBOM_OUTPUT_PATH}`,
  ]);

  const source = read(BACKEND_CI_PATH);
  for (const forbidden of ["npm install -g", "pnpm dlx", "npx ", "curl ", "| sh", "| bash"]) {
    assert.ok(!source.includes(forbidden), `backend-ci.yml must not use ${forbidden}`);
  }
});

test("SBOM artifact uses a stable name, explicit retention and a single narrow path", () => {
  const upload = (sbomJob().steps ?? []).find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );

  assert.ok(upload, "the SBOM job must upload an artifact");
  assert.equal(upload.with?.name, SBOM_ARTIFACT_NAME);
  assert.equal(upload.with?.path, DEFAULT_SBOM_OUTPUT_PATH);
  assert.equal(upload.with?.["if-no-files-found"], "error");
  assert.equal(upload.with?.["retention-days"], 90);

  const path = String(upload.with?.path);
  for (const forbidden of [".env", "node_modules", "*", "\n"]) {
    assert.ok(!path.includes(forbidden), `artifact path must not include ${forbidden}`);
  }
});

test("generated SBOM output stays untracked", () => {
  const ignore = read(".gitignore");

  assert.ok(ignore.includes("sbom/"));
  assert.ok(DEFAULT_SBOM_OUTPUT_PATH.startsWith("sbom/"));
});

test("splitPackageKey separates scoped and unscoped lockfile keys", () => {
  assert.deepEqual(splitPackageKey("fastify@5.10.0"), { name: "fastify", version: "5.10.0" });
  assert.deepEqual(splitPackageKey("@alloc/quick-lru@5.2.0"), {
    name: "@alloc/quick-lru",
    version: "5.2.0",
  });
  assert.equal(splitPackageKey("@scope-only"), null);
  assert.equal(splitPackageKey("no-version@"), null);
});

test("normalizeVersion drops the pnpm peer-resolution suffix", () => {
  assert.equal(normalizeVersion("0.45.2(pg@8.20.0)(postgres@3.4.9)"), "0.45.2");
  assert.equal(normalizeVersion("2.110.8"), "2.110.8");
});

test("packageUrl encodes scoped npm package URLs", () => {
  assert.equal(packageUrl("fastify", "5.10.0"), "pkg:npm/fastify@5.10.0");
  assert.equal(packageUrl("@alloc/quick-lru", "5.2.0"), "pkg:npm/%40alloc/quick-lru@5.2.0");
});

test("integrityToHash accepts supported digests and rejects everything else", () => {
  const hash = integrityToHash(`sha512-${Buffer.alloc(64, 1).toString("base64")}`);

  assert.equal(hash?.alg, "SHA-512");
  assert.match(String(hash?.content), /^[0-9a-f]{128}$/);

  for (const invalid of [undefined, null, 42, "", "md5-abc", "sha512", "sha512-not base64!"]) {
    assert.equal(integrityToHash(invalid), null, String(invalid));
  }
});

test("generated SBOM is a deterministic CycloneDX document derived from the lockfile", () => {
  const first = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined });
  const second = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined });

  assert.equal(renderSbom(first), renderSbom(second));
  assert.equal(first.bomFormat, "CycloneDX");
  assert.equal(first.specVersion, SBOM_SPEC_VERSION);
  assert.equal(first.version, 1);
  assert.equal(first.metadata.tools.components[0].name, SBOM_GENERATOR_NAME);
  assert.ok(first.components.length > 0);

  const purls = first.components.map((component) => component.purl);
  assert.deepEqual(purls, [...purls].sort((left, right) => left.localeCompare(right)));

  for (const component of first.components) {
    assert.equal(component.type, "library");
    assert.match(component.purl, /^pkg:npm\//);
    assert.ok(["direct", "transitive"].includes(String(component.properties[0]?.value)));
    for (const hash of component.hashes ?? []) {
      assert.match(hash.content, /^[0-9a-f]+$/);
    }
  }
});

test("generated SBOM omits non-reproducible and non-sanitized fields", () => {
  const document = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined });
  const rendered = renderSbom(document);

  assert.equal(Object.hasOwn(document, "serialNumber"), false);
  assert.equal(Object.hasOwn(document.metadata, "timestamp"), false);

  const propertyNames = document.metadata.properties.map((property) => property.name).sort();
  assert.deepEqual(propertyNames, ["vetneb:lockfile", "vetneb:lockfile-version"]);

  for (const forbidden of ["DATABASE_URL", "SUPABASE_DB_URL", "postgresql://", "-----BEGIN"]) {
    assert.ok(!rendered.toLowerCase().includes(forbidden.toLowerCase()), forbidden);
  }

  for (const component of document.components) {
    assert.deepEqual(
      Object.keys(component).sort(),
      component.hashes
        ? ["hashes", "name", "properties", "purl", "type", "version"]
        : ["name", "properties", "purl", "type", "version"],
    );
  }
});

test("the SBOM subject is the monorepo platform and never a single deployable", () => {
  const subject = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined }).metadata
    .component;

  assert.equal(subject.type, "application");
  assert.equal(subject.name, SBOM_PLATFORM_COMPONENT_NAME);
  assert.equal(subject["bom-ref"], SBOM_PLATFORM_COMPONENT_NAME);
  assert.ok(subject.description.length > 0);

  assert.equal(Object.hasOwn(subject, "purl"), false);
  assert.equal(Object.hasOwn(subject, "version"), false);
  assert.notEqual(subject.name, "portal-vetneb-backend");
  assert.notEqual(subject.name, "portal-vetneb-frontend");
});

test("both workspace deployables hang off the subject and derive from their own manifests", () => {
  const subject = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined }).metadata
    .component;

  assert.deepEqual(SBOM_DEPLOYABLE_MANIFEST_PATHS, ["package.json", "frontend/package.json"]);
  assert.equal(subject.components.length, 2);

  for (const manifestPath of SBOM_DEPLOYABLE_MANIFEST_PATHS) {
    const identity = readDeployableIdentity(process.cwd(), manifestPath);
    const child = subject.components.find(
      (candidate) => candidate.properties[0]?.value === manifestPath,
    );

    assert.ok(child, `${manifestPath} must produce a deployable component`);
    assert.equal(child.type, "application");
    assert.equal(child.name, identity.name);
    assert.equal(child.version, identity.version);
    assert.equal(child.purl, identity.purl);
    assert.equal(child["bom-ref"], identity.purl);
    assert.equal(child.properties[0].name, "vetneb:manifest");
  }

  const names = subject.components.map((child) => child.name);
  assert.equal(new Set(names).size, 2, "deployables must be two distinct applications");
});

test("deployable order is deterministic and sorted by bom-ref", () => {
  const subject = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined }).metadata
    .component;
  const references = subject.components.map((child) => child["bom-ref"]);

  assert.deepEqual(references, [...references].sort((left, right) => left.localeCompare(right)));
});

test("deployables do not inflate the lockfile package inventory", () => {
  const document = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined });
  const deployablePurls = new Set(document.metadata.component.components.map((c) => c.purl));

  assert.ok(document.components.length > 500);
  for (const component of document.components) {
    assert.equal(component.type, "library");
    assert.ok(!deployablePurls.has(component.purl), `${component.purl} must not be duplicated`);
  }
});

test("frontend-only packages are not attributed to a backend-only subject", () => {
  const document = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined });
  const names = new Set(document.components.map((component) => component.name));

  assert.ok(names.has("next"), "the workspace inventory includes frontend-only packages");
  assert.ok(names.has("react"));

  const subject = document.metadata.component;
  assert.equal(subject.name, SBOM_PLATFORM_COMPONENT_NAME);
  assert.ok(
    subject.components.some((child) => child.properties[0]?.value === "frontend/package.json"),
    "the frontend application must be present alongside the frontend packages",
  );
});

test("the platform subject is byte-stable across consecutive generations", () => {
  const first = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined });
  const second = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined });

  assert.equal(
    JSON.stringify(first.metadata.component),
    JSON.stringify(second.metadata.component),
  );
  assert.equal(renderSbom(first), renderSbom(second));
});

test("an isolated fixture workspace produces the same two-deployable shape", () => {
  withFixtureWorkspace(
    { root: VALID_ROOT_MANIFEST, frontend: VALID_FRONTEND_MANIFEST },
    (rootDir) => {
      const subject = generateSbom({ rootDir, sourceCommit: undefined }).metadata.component;

      assert.equal(subject.name, SBOM_PLATFORM_COMPONENT_NAME);
      assert.deepEqual(
        subject.components.map((child) => child.purl),
        ["pkg:npm/fixture-backend@2.1.0", "pkg:npm/fixture-frontend@1.0.0"],
      );
    },
  );
});

test("generation fails closed on unusable workspace manifests", () => {
  const cases: Array<[string, FixtureManifests, RegExp]> = [
    [
      "frontend manifest absent",
      { root: VALID_ROOT_MANIFEST },
      /frontend\/package\.json is required to build the SBOM subject/,
    ],
    [
      "frontend manifest invalid JSON",
      { root: VALID_ROOT_MANIFEST, frontend: "{ not json" },
      /frontend\/package\.json is not valid JSON/,
    ],
    [
      "frontend manifest is not an object",
      { root: VALID_ROOT_MANIFEST, frontend: "[]" },
      /frontend\/package\.json must contain a JSON object/,
    ],
    [
      "frontend without name",
      { root: VALID_ROOT_MANIFEST, frontend: JSON.stringify({ version: "1.0.0" }) },
      /frontend\/package\.json must declare a non-empty string name/,
    ],
    [
      "frontend without version",
      { root: VALID_ROOT_MANIFEST, frontend: JSON.stringify({ name: "fixture-frontend" }) },
      /frontend\/package\.json must declare a non-empty string version/,
    ],
    [
      "frontend with blank version",
      { root: VALID_ROOT_MANIFEST, frontend: manifest("fixture-frontend", "   ") },
      /frontend\/package\.json must declare a non-empty string version/,
    ],
    [
      "root without name",
      { root: JSON.stringify({ version: "2.1.0" }), frontend: VALID_FRONTEND_MANIFEST },
      /Error: package\.json must declare a non-empty string name/,
    ],
    [
      "root without version",
      { root: JSON.stringify({ name: "fixture-backend" }), frontend: VALID_FRONTEND_MANIFEST },
      /Error: package\.json must declare a non-empty string version/,
    ],
    [
      "root name is not encodable as an npm package URL",
      { root: manifest("Fixture Backend", "2.1.0"), frontend: VALID_FRONTEND_MANIFEST },
      /Error: package\.json name cannot be encoded as an npm package URL/,
    ],
    [
      "frontend version is not encodable as an npm package URL",
      { root: VALID_ROOT_MANIFEST, frontend: manifest("fixture-frontend", "1.0.0@beta") },
      /frontend\/package\.json version cannot be encoded as an npm package URL/,
    ],
    [
      "both manifests resolve to the same identity",
      { root: VALID_ROOT_MANIFEST, frontend: VALID_ROOT_MANIFEST },
      /must resolve to distinct npm package URLs/,
    ],
  ];

  for (const [label, manifests, expected] of cases) {
    withFixtureWorkspace(manifests, (rootDir) => {
      assert.throws(() => generateSbom({ rootDir, sourceCommit: undefined }), expected, label);
    });
  }
});

test("fail-closed errors never echo manifest content", () => {
  const secretish = manifest("fixture-frontend", "1.0.0@beta");

  withFixtureWorkspace({ root: VALID_ROOT_MANIFEST, frontend: secretish }, (rootDir) => {
    try {
      generateSbom({ rootDir, sourceCommit: undefined });
      assert.fail("generation must fail closed");
    } catch (error) {
      const message = String((error as Error).message);
      assert.ok(!message.includes(secretish));
      assert.ok(!message.includes(rootDir));
      assert.ok(message.startsWith("frontend/package.json "));
    }
  });
});

test("in-memory subject mutations are rejected by the deployable contract", () => {
  const baseline = generateSbom({ rootDir: process.cwd(), sourceCommit: undefined }).metadata
    .component;

  const assertContract = (subject: typeof baseline): void => {
    assert.equal(subject.name, SBOM_PLATFORM_COMPONENT_NAME);
    assert.equal(Object.hasOwn(subject, "purl"), false);
    assert.equal(subject.components.length, 2);

    const manifests = subject.components.map((child) => child.properties[0]?.value);
    assert.deepEqual([...manifests].sort(), ["frontend/package.json", "package.json"]);

    const references = subject.components.map((child) => child["bom-ref"]);
    assert.deepEqual(references, [...references].sort((l, r) => l.localeCompare(r)));
  };

  assertContract(baseline);

  const withoutFrontend = structuredClone(baseline);
  withoutFrontend.components = withoutFrontend.components.filter(
    (child) => child.properties[0]?.value !== "frontend/package.json",
  );
  assert.throws(() => assertContract(withoutFrontend));

  const backendOnlySubject = {
    ...structuredClone(baseline),
    name: "portal-vetneb-backend",
    purl: "pkg:npm/portal-vetneb-backend@2.1.0",
    components: [] as typeof baseline.components,
  };
  assert.throws(() => assertContract(backendOnlySubject));

  const reordered = structuredClone(baseline);
  reordered.components = [...reordered.components].reverse();
  assert.throws(() => assertContract(reordered));
});

test("source commit metadata is recorded only for an exact 40-character SHA", () => {
  const valid = generateSbom({
    rootDir: process.cwd(),
    sourceCommit: "cdff7ad67f3e1314a75311d7482f4edcd4b36e11",
  });
  const invalid = generateSbom({ rootDir: process.cwd(), sourceCommit: "refs/heads/main" });

  assert.ok(
    valid.metadata.properties.some(
      (property) =>
        property.name === "vetneb:source-commit" &&
        property.value === "cdff7ad67f3e1314a75311d7482f4edcd4b36e11",
    ),
  );
  assert.ok(
    !invalid.metadata.properties.some((property) => property.name === "vetneb:source-commit"),
  );
});
