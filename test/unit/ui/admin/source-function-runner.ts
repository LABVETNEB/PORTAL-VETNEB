import vm from "node:vm";
import ts from "typescript";
import { descendants, unwrap } from "../dashboard/dashboard-source-oracle.ts";

// TEST-GLOBAL-08 — runs frontend source exactly as written. The TEST-GLOBAL-07
// oracle (dashboard-source-oracle.ts, reused unchanged) evaluates side-effect-
// free expressions; the 08 contracts live in handlers, loaders, hooks and
// formatters with local state, so the specs execute the function (or the whole
// module) itself. The code is transpiled from the parsed source and run in a
// fresh VM context that holds only the bindings the test passes plus the
// JavaScript builtins: a name the test did not bind throws ReferenceError when
// reached instead of resolving to a Node global, and an import the test did not
// provide throws. Shared by the admin, frontend and public specs of U(08):
// test/helpers/** is outside the 08 ficha paths (C.11) and admin is the first
// 08 delivery. Each spec keeps its own in-memory mutation proof.

export type SourceFunction = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;

function isFunction(node: ts.Node | undefined): node is SourceFunction {
  return (
    node !== undefined &&
    (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))
  );
}

// `function name() {}`, `const name = () => {}` or `const name = useCallback(() => {}, deps)`;
// anything else, or more than one match, fails.
export function functionNamed(file: ts.SourceFile, name: string): SourceFunction {
  const declared = descendants(file, ts.isFunctionDeclaration).filter(
    (declaration) => declaration.name?.text === name && declaration.body !== undefined,
  );
  const assigned = descendants(file, ts.isVariableDeclaration)
    .filter((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name)
    .map((declaration) => {
      const initializer = declaration.initializer ? unwrap(declaration.initializer) : undefined;
      const wrapped =
        initializer &&
        ts.isCallExpression(initializer) &&
        initializer.expression.getText() === "useCallback"
          ? unwrap(initializer.arguments[0])
          : initializer;

      return isFunction(wrapped) ? wrapped : undefined;
    });
  const matches = [...declared, ...assigned];
  const [match] = matches;

  if (matches.length !== 1 || !match) {
    throw new Error(`${name}: expected one function, found ${matches.length}`);
  }

  return match;
}

function transpile(text: string, fileName: string, module: ts.ModuleKind): string {
  const { outputText, diagnostics } = ts.transpileModule(text, {
    fileName: "source-function.tsx",
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, module },
  });

  if (diagnostics && diagnostics.length > 0) {
    throw new Error(`${fileName}: source does not transpile`);
  }

  return outputText;
}

export function initializerNamed(file: ts.SourceFile, name: string): ts.Expression {
  const matches = descendants(file, ts.isVariableDeclaration).filter(
    (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name,
  );
  const initializer = matches.length === 1 ? matches[0].initializer : undefined;

  if (!initializer) {
    throw new Error(`${name}: expected one initialized declaration, found ${matches.length}`);
  }

  return unwrap(initializer);
}

// `const [name, setName] = useState(initial)` → `initial`.
export function stateInitial(file: ts.SourceFile, name: string): ts.Expression {
  const matches = descendants(file, ts.isVariableDeclaration).filter((declaration) => {
    const [first] = ts.isArrayBindingPattern(declaration.name) ? declaration.name.elements : [];
    return first !== undefined && ts.isBindingElement(first) && first.name.getText() === name;
  });
  const call = matches.length === 1 && matches[0].initializer ? unwrap(matches[0].initializer) : undefined;

  if (!call || !ts.isCallExpression(call) || call.expression.getText() !== "useState" || call.arguments.length !== 1) {
    throw new Error(`${name}: expected one useState(initial) declaration, found ${matches.length}`);
  }

  return call.arguments[0];
}

export function runSource<T = unknown>(
  node: SourceFunction,
  bindings: Readonly<Record<string, unknown>>,
): T {
  const file = node.getSourceFile();
  const exported = (ts.getModifiers(node) ?? []).filter(
    (modifier) =>
      modifier.kind === ts.SyntaxKind.ExportKeyword ||
      modifier.kind === ts.SyntaxKind.DefaultKeyword,
  );
  const start = exported.length > 0 ? exported[exported.length - 1].end : node.getStart(file);
  const code = transpile(`(${file.text.slice(start, node.end)});`, file.fileName, ts.ModuleKind.ESNext);

  return vm.runInNewContext(code, { ...bindings }) as T;
}

export type LatestRequestScenario = {
  readonly fetcher: string;
  readonly setters: readonly string[];
  readonly bindings: Readonly<Record<string, unknown>>;
  readonly response: unknown;
  readonly superseded: boolean;
  readonly fails: boolean;
};

// Runs a loader guarded by `latestRequestRef` and returns the state setters it
// calls once its request has started. `superseded` issues a newer request
// while this one is in flight, which is what the stale-response guard is for.
export async function writesAfterRequest(
  node: SourceFunction,
  scenario: LatestRequestScenario,
): Promise<string[]> {
  const writes: string[] = [];
  const latestRequestRef = { current: 0 };
  let started = false;
  const setters = Object.fromEntries(
    scenario.setters.map((name) => [
      name,
      () => {
        if (started) writes.push(name);
      },
    ]),
  );
  const loader = runSource<() => unknown>(node, {
    ...scenario.bindings,
    ...setters,
    Error,
    latestRequestRef,
    [scenario.fetcher]: async () => {
      started = true;
      if (scenario.superseded) latestRequestRef.current += 1;
      if (scenario.fails) throw new Error("request failed");
      return scenario.response;
    },
  });

  await loader();
  await new Promise((resolve) => setImmediate(resolve));

  if (!started) throw new Error(`${scenario.fetcher} was never requested`);
  return writes;
}

// Runs a handler whose `window.confirm` answers `confirmed` and returns, in
// order, the recorded calls it made with their arguments.
export async function callsUnderConfirm(
  node: SourceFunction,
  confirmed: boolean,
  recorded: readonly string[],
  bindings: Readonly<Record<string, unknown>>,
  args: readonly unknown[],
): Promise<unknown[][]> {
  const calls: unknown[][] = [];
  const recorders = Object.fromEntries(
    recorded.map((name) => [
      name,
      async (...values: unknown[]) => {
        calls.push([name, ...values]);
        return bindings[name] === undefined ? undefined : (bindings[name] as (...v: unknown[]) => unknown)(...values);
      },
    ]),
  );
  const handler = runSource<(...values: unknown[]) => unknown>(node, {
    ...bindings,
    ...recorders,
    Error,
    window: { confirm: () => confirmed },
  });

  await handler(...args);
  return calls;
}

// Executes the whole module and returns its exports. Every import must be
// provided by specifier: an unknown one throws instead of loading the real
// dependency graph. Type-only imports are erased by the transpiler; JSX
// compiles to `React.createElement`, so rendering needs a `React` global.
export function runModule(
  file: ts.SourceFile,
  imports: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  globals: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  const code = transpile(file.text, file.fileName, ts.ModuleKind.CommonJS);
  const module = { exports: {} as Record<string, unknown> };
  const require = (specifier: string) => {
    if (!Object.hasOwn(imports, specifier)) {
      throw new Error(`${file.fileName}: import ${specifier} not provided`);
    }
    return imports[specifier];
  };

  vm.runInNewContext(code, { ...globals, module, exports: module.exports, require });
  return module.exports;
}
