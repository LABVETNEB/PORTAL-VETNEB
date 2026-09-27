import ts from "typescript";
import {
  type CensusCorpus,
  countLines,
  filesUnder,
  resolveRelativeSpecifier,
  sourceFilesUnder,
  specFiles,
} from "./corpus.ts";

/**
 * Per-spec classification (TEST-GLOBAL-01B, versioned equivalent of the
 * unversioned `classify.mjs` of Anexo A.4).
 *
 * Every signal is derived from the text of the tracked file: no runtime
 * import of production code, no execution of the suite, no disk writes, no
 * network. The classifier is heuristic by construction (A.4) — its output is
 * a pool of candidates, never confirmed debt — but it is now deterministic
 * and recomputable from any git revision.
 */

export const FILESYSTEM_IMPORT = /from\s+["']node:fs/;
export const ASSERTION_FORM = /assert\.([A-Za-z]+)\(/g;
export const SUBSTRING_OK = /assert\.ok\([A-Za-z0-9_.]*\.includes\(/g;
export const SUBSTRING_EQUAL = /assert\.equal\([A-Za-z0-9_.]*\.includes\(/g;
export const TOP_LEVEL_TEST = /^\s*test\(/;

const PRODUCTION_ROOTS = [
  "server",
  "frontend",
  "shared",
  "drizzle",
  "scripts",
] as const;

/**
 * The canonical source reader (TEST-GLOBAL-05A). A spec that reads source
 * through it still reads the filesystem: migrating off `node:fs` changes how
 * the tree is read, never whether it is read.
 */
export const CANONICAL_SOURCE_READER_MODULE = "test/helpers/tracked-source-files.ts";
export const CANONICAL_SOURCE_READER = "readSourceFile";

const STATIC_IMPORT = /(?:^|\n)\s*import\s[^;]*?from\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\(\s*[`"']([^`"']+)[`"']/g;
const ASSERTION_WRAPPER =
  /function\s+(assert[A-Z][A-Za-z0-9_]*|expect[A-Z][A-Za-z0-9_]*)\s*\(/;

export type SpecBucket =
  | "FILESYSTEM_ONLY"
  | "RUNTIME_ONLY"
  | "FILESYSTEM_AND_RUNTIME"
  | "DYNAMIC_IMPORT_ONLY"
  | "NEITHER";

export type BehaviouralLayer =
  | "STATIC_SOURCE_CONTRACT"
  | "RUNTIME_BEHAVIOURAL"
  | "HTTP_INTEGRATION"
  | "PROCESS_INVOKING"
  | "PURE_LOGIC";

export type SpecClassification = {
  readonly path: string;
  /** Top two path segments, e.g. `test/unit/ui`; the §6.2 grouping key. */
  readonly folder: string;
  readonly lines: number;
  readonly tests: number;
  readonly assertions: number;
  readonly assertionsByForm: Readonly<Record<string, number>>;
  readonly substringAssertions: number;
  readonly substringRatio: number;
  readonly hasAssertionWrapper: boolean;
  /** Imports `node:fs`: the physical signal of §7.1. */
  readonly readsFilesystemDirectly: boolean;
  /** Calls the canonical source reader, which reads and normalizes CRLF. */
  readonly readsCanonicalSource: boolean;
  /** Reads the tree by either route. */
  readonly readsFilesystem: boolean;
  /** Reads through `node:fs` without normalizing CRLF by hand (§13.1). */
  readonly readsFilesystemWithoutCrlfNormalization: boolean;
  readonly executesRuntime: boolean;
  readonly usesDynamicImport: boolean;
  readonly usesHttpInjection: boolean;
  readonly usesChildProcess: boolean;
  readonly bucket: SpecBucket;
  readonly behaviouralLayer: BehaviouralLayer;
  readonly productionImports: readonly string[];
  readonly definesOwnReader: boolean;
  readonly ownReaderForms: readonly string[];
  readonly normalizesCrlf: boolean;
  readonly hasMutationHarness: boolean;
  readonly failClosedTestNames: readonly string[];
  readonly mutatesProcessEnv: boolean;
  readonly restoresProcessEnv: boolean;
  readonly determinismSignals: readonly string[];
  readonly httpStatusAssertions: Readonly<Record<string, number>>;
};

export type CensusClassification = {
  readonly specs: readonly SpecClassification[];
  readonly byBucket: Readonly<Record<SpecBucket, number>>;
  readonly byFolder: readonly {
    readonly folder: string;
    readonly files: number;
    readonly lines: number;
    readonly tests: number;
    readonly filesystemFiles: number;
  }[];
  readonly totals: {
    readonly specs: number;
    readonly tests: number;
    readonly assertions: number;
    readonly substringAssertions: number;
    readonly lines: number;
  };
};

function collectProductionImports(path: string, source: string): string[] {
  const resolved = new Set<string>();

  for (const pattern of [STATIC_IMPORT]) {
    for (const match of source.matchAll(pattern)) {
      const target = resolveRelativeSpecifier(path, match[1] ?? "");

      if (
        target !== null &&
        PRODUCTION_ROOTS.some((root) => target.startsWith(`${root}/`))
      ) {
        resolved.add(target);
      }
    }
  }

  return [...resolved].sort();
}

function isCanonicalReaderModule(path: string, specifier: string): boolean {
  const target = resolveRelativeSpecifier(path, specifier);

  return (
    target !== null &&
    target.replace(/\.ts$/, "") ===
      CANONICAL_SOURCE_READER_MODULE.replace(/\.ts$/, "")
  );
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) {
    return [name.text];
  }

  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
  );
}

/** Names a scope-creating node declares for its own body. */
function namesDeclaredBy(scope: ts.Node): string[] {
  const names: string[] = [];

  if (ts.isFunctionLike(scope)) {
    for (const parameter of scope.parameters) {
      names.push(...bindingNames(parameter.name));
    }
  }

  if (
    (ts.isFunctionExpression(scope) || ts.isClassExpression(scope)) &&
    scope.name
  ) {
    names.push(scope.name.text);
  }

  if (ts.isCatchClause(scope) && scope.variableDeclaration) {
    names.push(...bindingNames(scope.variableDeclaration.name));
  }

  if (
    (ts.isForStatement(scope) ||
      ts.isForInStatement(scope) ||
      ts.isForOfStatement(scope)) &&
    scope.initializer &&
    ts.isVariableDeclarationList(scope.initializer)
  ) {
    for (const declaration of scope.initializer.declarations) {
      names.push(...bindingNames(declaration.name));
    }
  }

  if (
    ts.isBlock(scope) ||
    ts.isModuleBlock(scope) ||
    ts.isCaseClause(scope) ||
    ts.isDefaultClause(scope)
  ) {
    for (const statement of scope.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          names.push(...bindingNames(declaration.name));
        }
      } else if (
        (ts.isFunctionDeclaration(statement) ||
          ts.isClassDeclaration(statement) ||
          ts.isEnumDeclaration(statement)) &&
        statement.name
      ) {
        names.push(statement.name.text);
      }
    }
  }

  return names;
}

/** An identifier that reads a value binding: not a key, label or declared name. */
function isValueReference(node: ts.Identifier): boolean {
  const parent = node.parent as ts.Node & {
    name?: ts.Node;
    propertyName?: ts.Node;
    label?: ts.Node;
  };

  if (ts.isShorthandPropertyAssignment(parent)) {
    return true;
  }

  return (
    parent.name !== node &&
    parent.propertyName !== node &&
    parent.label !== node &&
    !ts.isExportSpecifier(parent)
  );
}

function isShadowed(node: ts.Identifier): boolean {
  for (
    let scope: ts.Node = node.parent;
    !ts.isSourceFile(scope);
    scope = scope.parent
  ) {
    if (namesDeclaredBy(scope).includes(node.text)) {
      return true;
    }
  }

  return false;
}

function readsThroughNamespace(node: ts.Identifier): boolean {
  const parent = node.parent;

  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
    return parent.name.text === CANONICAL_SOURCE_READER;
  }

  return (
    ts.isElementAccessExpression(parent) &&
    parent.expression === node &&
    ts.isStringLiteralLike(parent.argumentExpression) &&
    parent.argumentExpression.text === CANONICAL_SOURCE_READER
  );
}

/**
 * Whether the spec imports the canonical reader from its real module (named,
 * aliased, default+named or namespace form) and executes that binding: a call,
 * a callback reference or a template interpolation. Decided on the TypeScript
 * syntax tree, never on raw text: strings, template text, comments, regex
 * literals, type positions, keys, a shadowed name, a type-only import, a
 * same-named export of another module or an unused import do not count.
 */
export function importsCanonicalSourceReader(
  path: string,
  source: string,
): boolean {
  if (!source.includes(CANONICAL_SOURCE_READER)) {
    return false;
  }

  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const locals = new Set<string>();
  const namespaces = new Set<string>();

  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause ||
      statement.importClause.isTypeOnly ||
      !isCanonicalReaderModule(path, statement.moduleSpecifier.text)
    ) {
      continue;
    }

    const bindings = statement.importClause.namedBindings;

    if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
    } else if (bindings) {
      for (const element of bindings.elements) {
        if (
          !element.isTypeOnly &&
          (element.propertyName ?? element.name).text === CANONICAL_SOURCE_READER
        ) {
          locals.add(element.name.text);
        }
      }
    }
  }

  if (locals.size === 0 && namespaces.size === 0) {
    return false;
  }

  let used = false;

  const visit = (node: ts.Node): void => {
    if (used || ts.isImportDeclaration(node) || ts.isTypeNode(node)) {
      return;
    }

    if (
      ts.isIdentifier(node) &&
      (locals.has(node.text) ||
        (namespaces.has(node.text) && readsThroughNamespace(node))) &&
      isValueReference(node) &&
      !isShadowed(node)
    ) {
      used = true;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return used;
}

function hasProductionDynamicImport(path: string, source: string): boolean {
  for (const match of source.matchAll(DYNAMIC_IMPORT)) {
    const target = resolveRelativeSpecifier(path, match[1] ?? "");

    if (
      target !== null &&
      PRODUCTION_ROOTS.some((root) => target.startsWith(`${root}/`))
    ) {
      return true;
    }
  }

  return false;
}

function countAssertionForms(source: string): {
  total: number;
  byForm: Record<string, number>;
} {
  const byForm: Record<string, number> = {};
  let total = 0;

  for (const match of source.matchAll(ASSERTION_FORM)) {
    const form = match[1] ?? "";

    byForm[form] = (byForm[form] ?? 0) + 1;
    total += 1;
  }

  return { total, byForm };
}

function countHttpStatusAssertions(source: string): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const match of source.matchAll(
    /\b(?:status|statusCode)\s*,\s*(\d{3})\b/g,
  )) {
    const status = match[1] ?? "";

    counts[status] = (counts[status] ?? 0) + 1;
  }

  return counts;
}

function collectOwnReaderForms(source: string): string[] {
  const forms: string[] = [];

  for (const [form, pattern] of [
    ["read", /function\s+read\s*\(/],
    ["readSource", /function\s+readSource\s*\(/],
    ["walk", /function\s+walk\s*\(/],
    ["collectFiles", /function\s+collectFiles\s*\(/],
    ["listFiles", /function\s+listFiles\s*\(/],
    ["collectSourceFiles", /function\s+collectSourceFiles\s*\(/],
  ] as const) {
    if (pattern.test(source)) {
      forms.push(form);
    }
  }

  return forms;
}

function collectFailClosedTestNames(source: string): string[] {
  const names: string[] = [];

  for (const match of source.matchAll(/^\s*test\(\s*["'`]([^"'`]+)["'`]/gm)) {
    const name = (match[1] ?? "").toLowerCase();

    if (
      /fail[-\s]?closed|mutaci|mutation|no puede|nunca|never|rechaza|refuses|rompe|breaks/.test(
        name,
      )
    ) {
      names.push(match[1] ?? "");
    }
  }

  return names;
}

function collectDeterminismSignals(source: string): string[] {
  const signals: string[] = [];

  for (const [signal, pattern] of [
    ["clock", /Date\.now\(\)|new Date\(\)/],
    ["timers", /setTimeout|setInterval|mock\.timers/],
    ["random", /Math\.random|randomUUID|randomBytes/],
    ["hooks", /\b(?:before|beforeEach|after|afterEach)\(/],
    ["child_process", /node:child_process/],
    ["process_env_write", /process\.env\.[A-Za-z0-9_]+\s*=/],
  ] as const) {
    if (pattern.test(source)) {
      signals.push(signal);
    }
  }

  return signals;
}

function resolveBehaviouralLayer(
  readsFilesystem: boolean,
  executesRuntime: boolean,
  usesDynamicImport: boolean,
  usesHttpInjection: boolean,
  usesChildProcess: boolean,
): BehaviouralLayer {
  if (usesHttpInjection) {
    return "HTTP_INTEGRATION";
  }

  if (executesRuntime || usesDynamicImport) {
    return "RUNTIME_BEHAVIOURAL";
  }

  if (usesChildProcess) {
    return "PROCESS_INVOKING";
  }

  return readsFilesystem ? "STATIC_SOURCE_CONTRACT" : "PURE_LOGIC";
}

function resolveBucket(
  readsFilesystem: boolean,
  executesRuntime: boolean,
  usesDynamicImport: boolean,
): SpecBucket {
  if (readsFilesystem && executesRuntime) {
    return "FILESYSTEM_AND_RUNTIME";
  }

  if (readsFilesystem) {
    return "FILESYSTEM_ONLY";
  }

  if (executesRuntime) {
    return "RUNTIME_ONLY";
  }

  return usesDynamicImport ? "DYNAMIC_IMPORT_ONLY" : "NEITHER";
}

/** Two-segment grouping key of §6.2, e.g. `test/unit/ui` or `test/security`. */
export function censusFolder(path: string): string {
  const segments = path.split("/");

  return segments.slice(0, Math.min(3, segments.length - 1)).join("/");
}

/** Classifies a single spec of the corpus. */
export function classifySpec(
  corpus: CensusCorpus,
  path: string,
): SpecClassification {
  if (!path.endsWith(".test.ts")) {
    throw new Error(`not an executable spec: ${path}`);
  }

  const source = corpus.read(path);
  const { total: assertions, byForm } = countAssertionForms(source);
  const substringAssertions =
    [...source.matchAll(SUBSTRING_OK)].length +
    [...source.matchAll(SUBSTRING_EQUAL)].length;
  const productionImports = collectProductionImports(path, source);
  const readsFilesystemDirectly = FILESYSTEM_IMPORT.test(source);
  const readsCanonicalSource = importsCanonicalSourceReader(path, source);
  const readsFilesystem = readsFilesystemDirectly || readsCanonicalSource;
  const normalizesCrlf = /\\r\\n/.test(source);
  const executesRuntime = productionImports.length > 0;
  const usesDynamicImport = hasProductionDynamicImport(path, source);
  const usesHttpInjection = /\.inject\(/.test(source);
  const usesChildProcess = /node:child_process/.test(source);
  const ownReaderForms = collectOwnReaderForms(source);
  const mutatesProcessEnv = /process\.env\.[A-Za-z0-9_]+\s*=/.test(source);
  const tests = source
    .split("\n")
    .filter((line) => TOP_LEVEL_TEST.test(line)).length;

  return {
    path,
    folder: censusFolder(path),
    lines: countLines(source),
    tests,
    assertions,
    assertionsByForm: byForm,
    substringAssertions,
    substringRatio: assertions === 0 ? 0 : substringAssertions / assertions,
    hasAssertionWrapper: ASSERTION_WRAPPER.test(source),
    readsFilesystemDirectly,
    readsCanonicalSource,
    readsFilesystem,
    readsFilesystemWithoutCrlfNormalization:
      readsFilesystemDirectly && !normalizesCrlf,
    executesRuntime,
    usesDynamicImport,
    usesHttpInjection,
    usesChildProcess,
    bucket: resolveBucket(readsFilesystem, executesRuntime, usesDynamicImport),
    behaviouralLayer: resolveBehaviouralLayer(
      readsFilesystem,
      executesRuntime,
      usesDynamicImport,
      usesHttpInjection,
      usesChildProcess,
    ),
    productionImports,
    definesOwnReader: ownReaderForms.length > 0,
    ownReaderForms,
    normalizesCrlf,
    hasMutationHarness: /(?:source|contents|text|raw|original)[A-Za-z]*\.replace\(/.test(
      source,
    ),
    failClosedTestNames: collectFailClosedTestNames(source),
    mutatesProcessEnv,
    restoresProcessEnv:
      mutatesProcessEnv && /delete\s+process\.env\.|finally\s*\{/.test(source),
    determinismSignals: collectDeterminismSignals(source),
    httpStatusAssertions: countHttpStatusAssertions(source),
  };
}

/** Classifies every spec of the corpus, sorted by path. */
export function classifyCorpus(corpus: CensusCorpus): CensusClassification {
  const specs = specFiles(corpus).map((path) => classifySpec(corpus, path));
  const byBucket: Record<SpecBucket, number> = {
    FILESYSTEM_ONLY: 0,
    RUNTIME_ONLY: 0,
    FILESYSTEM_AND_RUNTIME: 0,
    DYNAMIC_IMPORT_ONLY: 0,
    NEITHER: 0,
  };
  const folders = new Map<
    string,
    { files: number; lines: number; tests: number; filesystemFiles: number }
  >();

  for (const spec of specs) {
    byBucket[spec.bucket] += 1;

    const folder = folders.get(spec.folder) ?? {
      files: 0,
      lines: 0,
      tests: 0,
      filesystemFiles: 0,
    };

    folder.files += 1;
    folder.lines += spec.lines;
    folder.tests += spec.tests;
    folder.filesystemFiles += spec.readsFilesystem ? 1 : 0;
    folders.set(spec.folder, folder);
  }

  return {
    specs,
    byBucket,
    byFolder: [...folders.entries()]
      .map(([folder, counts]) => ({ folder, ...counts }))
      .sort((left, right) => left.folder.localeCompare(right.folder)),
    totals: {
      specs: specs.length,
      tests: specs.reduce((sum, spec) => sum + spec.tests, 0),
      assertions: specs.reduce((sum, spec) => sum + spec.assertions, 0),
      substringAssertions: specs.reduce(
        (sum, spec) => sum + spec.substringAssertions,
        0,
      ),
      lines: specs.reduce((sum, spec) => sum + spec.lines, 0),
    },
  };
}

/** Inventory of §6.1/§6.3: volumes of the test tree and of production. */
export function inventory(corpus: CensusCorpus): {
  readonly testFiles: number;
  readonly specs: number;
  readonly supportFiles: number;
  readonly testLines: number;
  readonly rootSpecs: readonly string[];
  readonly production: readonly {
    readonly root: string;
    readonly files: number;
    readonly lines: number;
  }[];
} {
  const testTree = filesUnder(corpus, "test");
  const specs = specFiles(corpus);
  const production = ["server", "frontend/src", "shared", "drizzle", "scripts"]
    .map((root) => {
      const files = sourceFilesUnder(corpus, root);

      return {
        root,
        files: files.length,
        lines: files.reduce(
          (sum, file) => sum + countLines(corpus.read(file)),
          0,
        ),
      };
    })
    .sort((left, right) => left.root.localeCompare(right.root));

  return {
    testFiles: testTree.length,
    specs: specs.length,
    supportFiles: testTree.length - specs.length,
    testLines: testTree.reduce(
      (sum, file) => sum + countLines(corpus.read(file)),
      0,
    ),
    rootSpecs: specs.filter((file) => file.split("/").length === 2),
    production,
  };
}
