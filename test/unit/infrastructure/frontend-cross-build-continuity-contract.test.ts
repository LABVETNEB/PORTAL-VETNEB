import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import ts from "typescript";
import { listSourceFiles, readSourceFile } from "../../helpers/tracked-source-files.ts";

// A1-7 — a tab keeps running the build that rendered it after another build is
// deployed. Two things it asks the server for then no longer exist there: a
// chunk it had not downloaded yet, and the id of a Server Action. This contract
// holds the source shape that keeps both from failing in front of the user;
// frontend/e2e/platform/app-shell/dashboard-page-request-recovery.spec.ts holds
// what the browser shows. It does not make an earlier build's assets available.

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const FRONTEND_SRC = "frontend/src";
const PARTICULARES = "frontend/src/components/public/ParticularesContent.tsx";
const RECOVERY = "frontend/src/components/dashboard/PageRequestRecovery.tsx";
const INFORMES_LIST = "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const AUDIT_CARD = "frontend/src/app/dashboard/admin/AdminAuditCard.tsx";

// Deferred chunks that are still requested after the document has loaded. The
// one left is requested when the Clínicas module mounts, a module switch that
// also navigates; a new entry is a new chunk a deploy can take away.
const DEFERRED_CHUNK_LEDGER = ["frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx"];
const SERVER_ACTION_CALLERS = [AUDIT_CARD, INFORMES_LIST];

function parse(path: string, source: string): ts.SourceFile {
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function eachNode(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => eachNode(child, visit));
}

function importsOf(file: ts.SourceFile): { specifier: string; names: string[] }[] {
  return file.statements.filter(ts.isImportDeclaration).map((statement) => {
    const bindings = statement.importClause?.namedBindings;

    return {
      specifier: (statement.moduleSpecifier as ts.StringLiteral).text,
      names: [
        ...(statement.importClause?.name ? [statement.importClause.name.text] : []),
        ...(bindings && ts.isNamedImports(bindings) ? bindings.elements.map((element) => element.name.text) : []),
      ],
    };
  });
}

// Every way a client module can ask for a chunk after it has loaded.
function deferredChunkRequests(path: string, source: string): string[] {
  const file = parse(path, source);
  const found = importsOf(file)
    .filter(({ specifier }) => specifier === "next/dynamic")
    .map(() => "imports next/dynamic");

  eachNode(file, (node) => {
    if (!ts.isCallExpression(node)) return;

    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      found.push("calls import()");
    } else if (/^(?:React\.)?lazy$/.test(node.expression.getText(file))) {
      found.push("calls lazy()");
    }
  });

  return found;
}

function frontendSources(): string[] {
  return listSourceFiles(resolve(REPO_ROOT, FRONTEND_SRC), { extensions: [".ts", ".tsx"] }).map(
    (file) => `${FRONTEND_SRC}/${file}`,
  );
}

function serverActionNames(file: ts.SourceFile): Set<string> {
  return new Set(
    importsOf(file)
      .filter(({ specifier }) => specifier.endsWith(".actions"))
      .flatMap(({ names }) => names),
  );
}

// A Server Action called from the client rejects when the server no longer
// knows its id. Each call has to sit in a `try` whose `catch` records the
// failure for the user; a `finally` alone lets the rejection go unhandled.
function serverActionCallViolations(path: string, source: string): string[] {
  const file = parse(path, source);
  const actions = serverActionNames(file);
  const violations: string[] = [];

  eachNode(file, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || !actions.has(node.expression.text)) {
      return;
    }

    let guard: ts.TryStatement | undefined;

    for (let parent: ts.Node | undefined = node.parent; parent && !guard; parent = parent.parent) {
      // A function boundary ends the reach of an outer try.
      if (ts.isFunctionLike(parent) && !guardedHere(parent, node)) break;
      if (ts.isTryStatement(parent) && node.pos >= parent.tryBlock.pos && node.end <= parent.tryBlock.end) {
        guard = parent;
      }
    }

    const handler = guard?.catchClause?.block.getText(file) ?? "";

    if (!guard?.catchClause) {
      violations.push(`${node.expression.text}() is called outside a try/catch`);
    } else if (!/setPageRequestFailure\(\s*classifyPageRequestFailure\(/.test(handler)) {
      violations.push(`${node.expression.text}() is caught without recording the failure`);
    } else if (/\bthrow\b/.test(handler)) {
      violations.push(`${node.expression.text}() is caught and thrown again`);
    }
  });

  return violations;
}

function guardedHere(scope: ts.Node, call: ts.Node): boolean {
  let guarded = false;

  eachNode(scope, (node) => {
    if (ts.isTryStatement(node) && call.pos >= node.tryBlock.pos && call.end <= node.tryBlock.end) {
      guarded = true;
    }
  });

  return guarded;
}

// Loading another document is the recovery, and it discards what the tab holds
// that is not in the URL: it may only ever run from the user's own click.
function documentLoadViolations(path: string, source: string): string[] {
  const file = parse(path, source);
  const violations: string[] = [];

  eachNode(file, (node) => {
    if (!ts.isCallExpression(node)) return;

    const callee = node.expression.getText(file).replace(/\s+/g, "");

    if (!/(?:^|\.)location\.(?:reload|assign|replace)$|^router\.refresh$/.test(callee)) return;

    let fromClick = false;

    for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxAttribute(parent)) {
        fromClick = parent.name.getText(file) === "onClick";
        break;
      }
    }

    if (!fromClick) violations.push(`${callee}() runs outside an onClick handler`);
  });

  return violations;
}

function replaceOnce(source: string, from: string, to: string): string {
  assert.equal(source.split(from).length, 2, `the mutation target must appear exactly once: ${from}`);

  return source.replace(from, () => to);
}

// -- F1 - the session-only bell of the particular portal ----------------------

test("the particular portal asks for no chunk after its document has loaded", () => {
  const source = readSourceFile(PARTICULARES);

  assert.deepEqual(deferredChunkRequests(PARTICULARES, source), []);
  assert.ok(
    importsOf(parse(PARTICULARES, source)).some(
      ({ specifier, names }) =>
        specifier === "@/components/dashboard/DashboardNotificationsBell" &&
        names.includes("DashboardNotificationsBell"),
    ),
    "the bell is part of the chunks the document already loads",
  );
});

test("deferred chunks of the frontend are exactly the known ledger", () => {
  const deferred = frontendSources().filter((path) => deferredChunkRequests(path, readSourceFile(path)).length > 0);

  assert.deepEqual(
    deferred.filter((path) => !path.endsWith("PublicScrollReveal.tsx")),
    DEFERRED_CHUNK_LEDGER,
    "a new deferred chunk is a new request a deploy can break: load it with the document or extend this ledger knowingly",
  );
  // Motion library of the public pages: asked for on idle right after load,
  // and its absence leaves the content visible.
  assert.ok(deferred.some((path) => path.endsWith("PublicScrollReveal.tsx")));
});

test("mutation: every way of deferring the bell again is detected", () => {
  const source = readSourceFile(PARTICULARES);
  const staticImport =
    'import { DashboardNotificationsBell } from "@/components/dashboard/DashboardNotificationsBell";\n';

  const viaNextDynamic = replaceOnce(
    source,
    staticImport,
    'import dynamic from "next/dynamic";\nconst DashboardNotificationsBell = dynamic(() =>\n  import("@/components/dashboard/DashboardNotificationsBell").then((mod) => mod.DashboardNotificationsBell),\n);\n',
  );
  assert.deepEqual(deferredChunkRequests(PARTICULARES, viaNextDynamic), ["imports next/dynamic", "calls import()"]);

  const viaLazy = replaceOnce(
    source,
    staticImport,
    'import { lazy } from "react";\nconst DashboardNotificationsBell = lazy(() => import("@/components/dashboard/DashboardNotificationsBell"));\n',
  );
  assert.deepEqual(deferredChunkRequests(PARTICULARES, viaLazy), ["calls lazy()", "calls import()"]);
});

// -- F2 - Server Actions called from the client -------------------------------

test("the client callers of a Server Action are exactly the two paged lists", () => {
  const callers = frontendSources().filter((path) => {
    const source = readSourceFile(path);

    return /^["']use client["'];/.test(source.trimStart()) && serverActionNames(parse(path, source)).size > 0;
  });

  assert.deepEqual(callers, SERVER_ACTION_CALLERS, "a new caller needs the same failure handling: add it here");
});

test("every client call of a Server Action records its rejection for the user", () => {
  for (const path of SERVER_ACTION_CALLERS) {
    assert.deepEqual(serverActionCallViolations(path, readSourceFile(path)), [], path);
  }
});

test("mutation: an unhandled or swallowed rejection is detected", () => {
  const informes = readSourceFile(INFORMES_LIST);
  const informesHandler = informes.slice(informes.indexOf("      } catch (error) {"), informes.indexOf("      } finally {"));

  assert.match(
    serverActionCallViolations(INFORMES_LIST, replaceOnce(informes, informesHandler, ""))[0] ?? "",
    /^getInformesPage\(\) is called outside a try\/catch$/,
    "try/finally without catch: the shape of main@a5df82bb",
  );
  assert.match(
    serverActionCallViolations(
      INFORMES_LIST,
      replaceOnce(informes, "        setPageRequestFailure(classifyPageRequestFailure(error));\n", ""),
    )[0] ?? "",
    /caught without recording the failure/,
  );

  const audit = readSourceFile(AUDIT_CARD);

  assert.match(
    serverActionCallViolations(
      AUDIT_CARD,
      replaceOnce(audit, "          setPageRequestFailure(classifyPageRequestFailure(error));\n", "          throw error;\n"),
    )[0] ?? "",
    /caught without recording the failure/,
  );
  assert.match(
    serverActionCallViolations(
      AUDIT_CARD,
      replaceOnce(
        audit,
        "          setPageRequestFailure(classifyPageRequestFailure(error));\n",
        "          setPageRequestFailure(classifyPageRequestFailure(error));\n          throw error;\n",
      ),
    )[0] ?? "",
    /caught and thrown again/,
  );
});

test("an unrecognized action is told apart, because calling it again cannot work", () => {
  const source = readSourceFile(RECOVERY);

  assert.ok(source.includes('import { unstable_isUnrecognizedActionError } from "next/navigation";'));
  assert.ok(source.includes('return unstable_isUnrecognizedActionError(error) ? "outdated" : "failed";'));
  // The retry is only offered for the failure a retry can fix.
  assert.ok(source.includes('{failure === "failed" ? ('));
});

// -- Recovery never runs by itself --------------------------------------------

const RECOVERY_SURFACES = [
  RECOVERY,
  INFORMES_LIST,
  AUDIT_CARD,
  "frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx",
];

test("a document load on these surfaces only runs from the user's click", () => {
  for (const path of RECOVERY_SURFACES) {
    assert.deepEqual(documentLoadViolations(path, readSourceFile(path)), [], path);
  }

  assert.equal(readSourceFile(RECOVERY).split("window.location.reload()").length, 2, "one reload, in the recovery control");
});

test("mutation: an automatic reload is detected wherever it is written", () => {
  const informes = readSourceFile(INFORMES_LIST);

  assert.deepEqual(
    documentLoadViolations(
      INFORMES_LIST,
      replaceOnce(
        informes,
        "        setPageRequestFailure(classifyPageRequestFailure(error));\n",
        "        setPageRequestFailure(classifyPageRequestFailure(error));\n        window.location.reload();\n",
      ),
    ),
    ["window.location.reload() runs outside an onClick handler"],
  );

  const recovery = readSourceFile(RECOVERY);

  assert.deepEqual(
    documentLoadViolations(
      RECOVERY,
      replaceOnce(recovery, "  return (\n", '  if (failure === "outdated") window.location.reload();\n\n  return (\n'),
    ),
    ["window.location.reload() runs outside an onClick handler"],
  );
  assert.deepEqual(
    documentLoadViolations(
      AUDIT_CARD,
      replaceOnce(readSourceFile(AUDIT_CARD), "  function retryPageRequest() {\n", "  function retryPageRequest() {\n    router.refresh();\n"),
    ),
    ["router.refresh() runs outside an onClick handler"],
  );
});
