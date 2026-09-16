import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { E2E_COHORT_SPECS, E2E_SUITE_CATALOG } from "../../../frontend/e2e/suites/catalog.ts";

// ─────────────────────────────────────────────────────────────────────────────
// E2E-GLOBAL-10 · catalog ↔ visual workflow reconciliation (R-14).
//
// LIMPIEZA E2E recorded a manual list of visual specs inside
// `visual-regression-manual.yml`, maintained in parallel with `catalog.ts`.
// GLOBAL-10A added this guard while the list still existed; the ci-only half
// removed it. Both runners now resolve their specs from one source:
//
//   catalog.ts → E2E_COHORT_SPECS["visual-linux"] → selectSuiteSpecs()
//     ├── production-candidate (e2e:visual-production-candidate)
//     └── dev (node --eval importing the same resolver)
//
// This guard proves that final state and fails closed if a manual list comes
// back anywhere in the workflow, if the dev runner stops calling the resolver,
// or if the suite input stops reaching it. The resolver snippet is not only
// matched: it is extracted from the parsed YAML and executed, so the specs the
// dev runner would hand to Playwright are observed, not inferred. The bash
// around it (NUL-delimited read, empty-selection guard, argv array) is checked
// structurally; its behavior was exercised when this change was made and is
// recorded in docs/implementation/e2e-global-10-r14-ci-catalog-reconciliation.md.
// ─────────────────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const { CORE_SCHEMA, load, mergeTag } = require("js-yaml") as {
  CORE_SCHEMA: { withTags: (tag: unknown) => unknown };
  load: (source: string, options: Record<string, unknown>) => unknown;
  mergeTag: unknown;
};

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..", "..");
const VISUAL_WORKFLOW = ".github/workflows/visual-regression-manual.yml";
const RESOLVER_MODULE = "frontend/e2e/scripts/visual-production-candidate.mjs";
const CANDIDATE_SCRIPT = resolve(REPO_ROOT, RESOLVER_MODULE);
const DEV_RUNNER_STEP = "Run selected visual regression suite";
const CANDIDATE_STEP = "Produce production visual candidate";

const candidate = (await import(pathToFileURL(CANDIDATE_SCRIPT).href)) as {
  VISUAL_SUITES: readonly string[];
  selectSuiteSpecs: (suite: string, visualSpecs?: readonly string[]) => string[];
};

const RESOLVER_INVOCATION = /^node --input-type=module --eval '([^']*)' > "\$\{specs_file\}"$/gm;
const NUL_READ = `mapfile -d '' -t specs < "\${specs_file}"`;
const EMPTY_GUARD = /if \[ "\$\{#specs\[@\]\}" -eq 0 \]; then\n[^\n]*\n\s*exit 1\n\s*fi/;
const PLAYWRIGHT_COMMAND =
  'cmd=(corepack pnpm --dir frontend exec playwright test "${specs[@]}" --project=chromium)';

type Mapping = Record<string, unknown>;

function isMapping(value: unknown): value is Mapping {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mapping(value: unknown, label: string): Mapping {
  assert.ok(isMapping(value), `${label} must be a mapping`);
  return value;
}

function sequence(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `${label} must be a sequence`);
  return value;
}

function readWorkflow(path = VISUAL_WORKFLOW): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8").replace(/\r\n/g, "\n");
}

function parseWorkflow(source: string): Mapping {
  return mapping(
    load(source, {
      schema: CORE_SCHEMA.withTags(mergeTag),
      maxDepth: 100,
      maxTotalMergeKeys: 20,
      maxAliases: 0,
    }),
    "workflow",
  );
}

function findStep(document: Mapping, name: string): Mapping | undefined {
  const jobs = mapping(document.jobs, "jobs");
  for (const [jobName, jobValue] of Object.entries(jobs)) {
    const job = mapping(jobValue, `jobs.${jobName}`);
    const step = sequence(job.steps, `jobs.${jobName}.steps`)
      .map((value, index) => mapping(value, `steps[${index}]`))
      .find((candidateStep) => candidateStep.name === name);
    if (step) return step;
  }
  return undefined;
}

/** Every `*.spec.ts` token anywhere in the workflow: YAML, bash, comments. */
export function workflowSpecLiterals(source: string): string[] {
  return [...source.matchAll(/[^\s"'`()=]*\.spec\.ts\b/g)].map((match) => match[0]);
}

/** The resolver snippets the dev runner evaluates, in order of appearance. */
export function devResolverSnippets(script: string): string[] {
  return [...script.matchAll(RESOLVER_INVOCATION)].map((match) => match[1]);
}

/** Structural contract of the dev runner. Returns failures so mutations are provable. */
export function evaluateDevRunner(source: string): string[] {
  const step = findStep(parseWorkflow(source), DEV_RUNNER_STEP);
  if (!step) return [`missing workflow step: ${DEV_RUNNER_STEP}`];

  const failures: string[] = [];
  const script = String(step.run ?? "");

  if (step.if !== "${{ inputs.runner == 'dev' }}") failures.push("the dev step must run only for runner=dev");
  if (step.shell !== "bash") failures.push("the dev step must run under bash");
  if (!script.startsWith("set -euo pipefail\n")) failures.push("the dev step must start in strict mode");

  if (workflowSpecLiterals(script).length > 0) failures.push("the dev step must not name any spec file");
  if (/\bspecs\+?=\(/.test(script)) failures.push("the dev step must not assign specs from a literal array");
  if (/\bcase\s+"?\$\{?VISUAL_SUITE/.test(script)) failures.push("the dev step must not branch on the suite by hand");

  const snippets = devResolverSnippets(script);
  if (snippets.length !== 1) {
    failures.push(`the dev step must invoke the catalog resolver exactly once, found ${snippets.length}`);
    return failures;
  }
  const snippet = snippets[0];
  if (!snippet.includes(`resolve("${RESOLVER_MODULE}")`)) {
    failures.push(`the resolver snippet must import ${RESOLVER_MODULE}`);
  }
  if ((snippet.match(/\bselectSuiteSpecs\(/g) ?? []).length !== 1 || !/\bselectSuiteSpecs\(suite\)/.test(snippet)) {
    failures.push("the resolver snippet must call selectSuiteSpecs(suite) once, with the catalog default cohort");
  }
  if (!/const suite = process\.env\.VISUAL_SUITE\b/.test(snippet)) {
    failures.push("the resolver snippet must read the suite from VISUAL_SUITE");
  }
  if (!/!VISUAL_SUITES\.includes\(suite\)/.test(snippet)) {
    failures.push("the resolver snippet must reject suites outside VISUAL_SUITES");
  }
  if (!/process\.exitCode = 1/.test(snippet)) failures.push("the resolver snippet must fail with a non-zero exit");

  const resolverAt = script.search(RESOLVER_INVOCATION);
  const readAt = script.indexOf(NUL_READ);
  const guardAt = script.search(EMPTY_GUARD);
  const commandAt = script.indexOf(PLAYWRIGHT_COMMAND);
  if (readAt === -1) failures.push("the dev step must read the resolved specs NUL-delimited");
  if (guardAt === -1) failures.push("the dev step must fail closed on an empty selection");
  if (commandAt === -1) failures.push("the dev step must pass the resolved specs to Playwright as an argv array");
  if (
    readAt !== -1 &&
    guardAt !== -1 &&
    commandAt !== -1 &&
    !(resolverAt < readAt && readAt < guardAt && guardAt < commandAt)
  ) {
    failures.push("the dev step must resolve, read, guard and then run, in that order");
  }
  if (!/^"\$\{cmd\[@\]\}"$/m.test(script)) failures.push("the dev step must execute the command array");

  return failures;
}

export function evaluateCandidateRunner(source: string): string[] {
  const step = findStep(parseWorkflow(source), CANDIDATE_STEP);
  if (!step) return [`missing workflow step: ${CANDIDATE_STEP}`];
  const script = String(step.run ?? "");
  const failures: string[] = [];
  if (!script.includes("e2e:visual-production-candidate")) {
    failures.push("the candidate step must run e2e:visual-production-candidate");
  }
  if (workflowSpecLiterals(script).length > 0 || script.includes(".spec.ts")) {
    failures.push("the candidate step must resolve its specs from the catalog, never from the workflow");
  }
  return failures;
}

export function evaluateSuiteVocabulary(
  source: string,
  suites: readonly string[] = candidate.VISUAL_SUITES,
): string[] {
  const document = parseWorkflow(source);
  const suiteInput = mapping(
    mapping(
      mapping(mapping(document.on, "on").workflow_dispatch, "workflow_dispatch").inputs,
      "inputs",
    ).suite,
    "inputs.suite",
  );
  const failures: string[] = [];
  if (JSON.stringify(suiteInput.options) !== JSON.stringify([...suites])) {
    failures.push(`suite options ${JSON.stringify(suiteInput.options)} != VISUAL_SUITES ${JSON.stringify(suites)}`);
  }
  if (suiteInput.type !== "choice") failures.push("the suite input must stay a choice");
  if (suiteInput.default !== "all") failures.push("the suite input must default to all");
  const env = mapping(mapping(mapping(document.jobs, "jobs")["visual-regression"], "job").env, "job env");
  if (env.VISUAL_SUITE !== "${{ inputs.suite }}") failures.push("VISUAL_SUITE must carry inputs.suite");
  return failures;
}

type ResolverRun = { status: number | null; specs: string[]; stdout: string; stderr: string };

/** Executes a resolver snippet exactly as the dev runner does, from the repository root. */
export function runDevResolver(snippet: string, suite: string): ResolverRun {
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", snippet], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, VISUAL_SUITE: suite },
  });
  const stdout = result.stdout ?? "";
  const specs = stdout === "" ? [] : stdout.split("\0");
  // Every record is NUL-terminated, so a well-formed stream ends in an empty field.
  if (specs.length > 0) assert.equal(specs.pop(), "", "resolver output must be NUL-terminated");
  return { status: result.status, specs, stdout, stderr: result.stderr ?? "" };
}

function currentSnippet(): string {
  const step = findStep(parseWorkflow(readWorkflow()), DEV_RUNNER_STEP);
  assert.ok(step, `missing workflow step: ${DEV_RUNNER_STEP}`);
  const snippets = devResolverSnippets(String(step.run ?? ""));
  assert.equal(snippets.length, 1);
  return snippets[0];
}

test("the visual workflow keeps no spec list: both runners are catalog-driven", () => {
  const source = readWorkflow();

  assert.deepEqual(workflowSpecLiterals(source), [], "the workflow must not name any spec file");
  assert.deepEqual(evaluateDevRunner(source), []);
  assert.deepEqual(evaluateCandidateRunner(source), []);
});

test("the dev runner resolves exactly what the catalog and the candidate resolve", () => {
  const snippet = currentSnippet();
  const cohort = E2E_COHORT_SPECS["visual-linux"];
  assert.ok(cohort.length > 0, "the visual-linux cohort must not be empty");

  const all = runDevResolver(snippet, "all");
  assert.equal(all.status, 0, all.stderr);
  assert.deepEqual(all.specs, [...cohort]);
  assert.deepEqual(all.specs, candidate.selectSuiteSpecs("all"));

  const singles = new Set<string>();
  for (const suite of candidate.VISUAL_SUITES.filter((name) => name !== "all")) {
    const run = runDevResolver(snippet, suite);
    const expected = cohort.filter((spec) => spec.endsWith(`/visual-regression-${suite}.spec.ts`));
    assert.equal(run.status, 0, run.stderr);
    assert.equal(expected.length, 1, `${suite} must map to one cataloged spec`);
    assert.deepEqual(run.specs, expected);
    assert.deepEqual(run.specs, candidate.selectSuiteSpecs(suite));
    singles.add(run.specs[0]);
  }
  // Each single suite reaches a different spec, so VISUAL_SUITE demonstrably
  // steers the selection, and together they are exactly the cohort.
  assert.deepEqual([...singles].sort(), [...cohort].sort());
});

test("the dev resolver and the shared resolver fail closed on invalid or empty selections", () => {
  const snippet = currentSnippet();

  for (const suite of ["", "bogus", "ALL", "all ", "print", "../public", "public.spec.ts"]) {
    const run = runDevResolver(snippet, suite);
    assert.notEqual(run.status, 0, `suite ${JSON.stringify(suite)} must fail`);
    assert.equal(run.stdout, "", `suite ${JSON.stringify(suite)} must resolve nothing`);
    assert.match(run.stderr, /::error::/);
  }

  assert.throws(() => candidate.selectSuiteSpecs("all", []), /visual-linux cohort is empty/);
  assert.throws(() => candidate.selectSuiteSpecs("public", []), /visual-linux cohort is empty/);
});

test("the visual-linux cohort, the workflow choices and the candidate share one vocabulary", () => {
  assert.deepEqual(evaluateSuiteVocabulary(readWorkflow()), []);

  // One suite per cataloged spec, plus `all`.
  assert.equal(candidate.VISUAL_SUITES.length, E2E_COHORT_SPECS["visual-linux"].length + 1);

  // Every visual-linux entry must actually be declared Linux-only, or the
  // workflow's own Linux preflight would reject a spec the catalog calls
  // portable — and the win32 BLOCKED contract would stop matching the catalog.
  for (const spec of E2E_COHORT_SPECS["visual-linux"]) {
    const entry = E2E_SUITE_CATALOG.find((candidateEntry) => candidateEntry.path === spec);
    assert.ok(entry, `${spec} must stay cataloged`);
    assert.equal(entry.platform, "linux", `${spec} must stay Linux-only`);
  }
});

test("the reconciliation fails closed on every shape of regression", () => {
  const source = readWorkflow();
  const snippet = currentSnippet();
  const publicSpec = candidate.selectSuiteSpecs("public")[0];

  function mutate(from: string | RegExp, to: string, label: string): string {
    const mutated = source.replace(from, to);
    assert.notEqual(mutated, source, `fixture precondition: ${label}`);
    return mutated;
  }

  // 1. A literal spec reintroduced into the dev runner.
  const readLine = `          ${NUL_READ}\n`;
  const withLiteral = mutate(readLine, `${readLine}          specs+=("${publicSpec}")\n`, "NUL read line");
  assert.ok(workflowSpecLiterals(withLiteral).includes(publicSpec));
  const literalFailures = evaluateDevRunner(withLiteral);
  assert.ok(literalFailures.some((failure) => failure.includes("must not name any spec file")));
  assert.ok(literalFailures.some((failure) => failure.includes("literal array")));

  // 2. The resolver replaced by the old hardcoded selection.
  const hardcoded = mutate(
    /^ {10}node --input-type=module --eval '[^']*' > "\$\{specs_file\}"\n/m,
    [
      '          case "${VISUAL_SUITE}" in',
      `            all) specs=("${publicSpec}") ;;`,
      '            *) exit 1 ;;',
      "          esac",
      "",
    ].join("\n"),
    "resolver invocation",
  );
  const hardcodedFailures = evaluateDevRunner(hardcoded);
  assert.ok(hardcodedFailures.some((failure) => failure.includes("invoke the catalog resolver exactly once, found 0")));
  assert.ok(hardcodedFailures.some((failure) => failure.includes("branch on the suite by hand")));
  assert.ok(workflowSpecLiterals(hardcoded).length > 0);

  // 3. The suite input no longer reaching the resolver.
  const unsteered = mutate("const suite = process.env.VISUAL_SUITE", 'const suite = "all"', "VISUAL_SUITE read");
  assert.ok(evaluateDevRunner(unsteered).some((failure) => failure.includes("from VISUAL_SUITE")));
  const pinned = runDevResolver(snippet.replace("const suite = process.env.VISUAL_SUITE", 'const suite = "all"'), "public");
  assert.notDeepEqual(pinned.specs, [publicSpec], "a pinned suite must stop following the input");
  const unwired = mutate("      VISUAL_SUITE: ${{ inputs.suite }}\n", "      VISUAL_SUITE: all\n", "job VISUAL_SUITE");
  assert.ok(evaluateSuiteVocabulary(unwired).some((failure) => failure.includes("VISUAL_SUITE must carry")));

  // 4. The resolver bypassed: a hardcoded array, another module, or a replaced cohort.
  const bypassed = mutate("const specs = selectSuiteSpecs(suite);", "const specs = [];", "resolver call");
  assert.ok(evaluateDevRunner(bypassed).some((failure) => failure.includes("selectSuiteSpecs(suite)")));
  const otherCohort = mutate("selectSuiteSpecs(suite);", "selectSuiteSpecs(suite, []);", "resolver call");
  assert.ok(evaluateDevRunner(otherCohort).some((failure) => failure.includes("selectSuiteSpecs(suite)")));
  const otherModule = mutate(RESOLVER_MODULE, "frontend/e2e/scripts/run-cohort.mjs", "resolver module");
  assert.ok(evaluateDevRunner(otherModule).some((failure) => failure.includes(`must import ${RESOLVER_MODULE}`)));
  const unvalidated = mutate("if (!VISUAL_SUITES.includes(suite)) ", "if (false) ", "suite validation");
  assert.ok(evaluateDevRunner(unvalidated).some((failure) => failure.includes("outside VISUAL_SUITES")));

  // 5. The dev runner losing the resolver call, its NUL read, its empty guard or its argv array.
  const noResolver = mutate(/^ {10}node --input-type=module --eval '[^']*' > "\$\{specs_file\}"\n/m, "", "resolver");
  assert.ok(evaluateDevRunner(noResolver).some((failure) => failure.includes("found 0")));
  const newlineRead = mutate(NUL_READ, `mapfile -t specs < "\${specs_file}"`, "NUL read");
  assert.ok(evaluateDevRunner(newlineRead).some((failure) => failure.includes("NUL-delimited")));
  const unguarded = mutate(EMPTY_GUARD, ":", "empty guard");
  assert.ok(evaluateDevRunner(unguarded).some((failure) => failure.includes("empty selection")));
  const flattened = mutate('"${specs[@]}"', "${specs[*]}", "argv array");
  assert.ok(evaluateDevRunner(flattened).some((failure) => failure.includes("argv array")));
  const lenient = mutate("set -euo pipefail\n\n          if [", "set -uo pipefail\n\n          if [", "dev strict mode");
  assert.ok(evaluateDevRunner(lenient).some((failure) => failure.includes("strict mode")));
  const renamed = mutate(`- name: ${DEV_RUNNER_STEP}`, "- name: Run visual suite", "dev step name");
  assert.deepEqual(evaluateDevRunner(renamed), [`missing workflow step: ${DEV_RUNNER_STEP}`]);

  // 6. A spec literal anywhere else in the workflow, even outside both runners.
  const elsewhere = mutate("      CI: true\n", `      CI: true\n      EXTRA_SPEC: ${publicSpec}\n`, "job env");
  assert.deepEqual(workflowSpecLiterals(elsewhere), [publicSpec]);

  // 7. Divergent suite vocabulary.
  const extraOption = mutate("          - stress\n", "          - stress\n          - print\n", "suite options");
  assert.ok(evaluateSuiteVocabulary(extraOption).some((failure) => failure.includes("!= VISUAL_SUITES")));
  assert.ok(
    evaluateSuiteVocabulary(source, [...candidate.VISUAL_SUITES, "print"]).some((failure) =>
      failure.includes("!= VISUAL_SUITES"),
    ),
  );

  // 8. The production candidate given a literal spec.
  const candidateLiteral = mutate(
    '            --suite "${VISUAL_SUITE}" \\\n',
    `            --suite "\${VISUAL_SUITE}" \\\n            --spec ${publicSpec} \\\n`,
    "candidate suite flag",
  );
  assert.ok(evaluateCandidateRunner(candidateLiteral).some((failure) => failure.includes("never from the workflow")));
});
