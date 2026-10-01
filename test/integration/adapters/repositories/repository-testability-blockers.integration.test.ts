import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile } from "../../../helpers/tracked-source-files.ts";

type BlockedRepository = {
  readonly path: string;
  readonly factoryName?: string;
  readonly databaseAlias?: string;
};

const BLOCKED_REPOSITORIES: readonly BlockedRepository[] = [
  { path: "server/features/clinics/infrastructure/admin-clinics-repository.ts" },
  { path: "server/features/particular-access/infrastructure/particular-access-repository.ts" },
  { path: "server/features/public-professionals/infrastructure/public-professionals-repository.ts" },
  { path: "server/features/report-access/infrastructure/report-access-repository.ts" },
  {
    path: "server/features/reports/infrastructure/report-query-repository.ts",
    factoryName: "createReportQueryRepository",
    databaseAlias: "ReportQueryDatabase",
  },
  {
    path: "server/features/reports/infrastructure/report-command-repository.ts",
    factoryName: "createReportCommandRepository",
    databaseAlias: "ReportCommandDatabase",
  },
  { path: "server/features/study-tracking/infrastructure/study-tracking-repository.ts" },
  { path: "server/features/users-roles/infrastructure/admin-users-roles-repository.ts" },
];

function sourceFile(path: string, source: string) {
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
}

function descendants(node: ts.Node): ts.Node[] {
  const nodes: ts.Node[] = [];
  const visit = (current: ts.Node) => {
    nodes.push(current);
    current.forEachChild(visit);
  };
  visit(node);
  return nodes;
}

function hasDatabaseSingletonImport(file: ts.SourceFile) {
  return file.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.endsWith("/db.ts") &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) => element.name.text === "db",
      ),
  );
}

function hasDirectDatabaseUse(file: ts.SourceFile) {
  return descendants(file).some(
    (node) =>
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "db",
  );
}

function databaseAliasIsConcrete(file: ts.SourceFile, alias: string) {
  return descendants(file).some(
    (node) =>
      ts.isTypeAliasDeclaration(node) &&
      node.name.text === alias &&
      ts.isTypeQueryNode(node.type) &&
      ts.isIdentifier(node.type.exprName) &&
      node.type.exprName.text === "db",
  );
}

function factoryAcceptsOnlyConcreteDatabase(
  file: ts.SourceFile,
  factoryName: string,
  databaseAlias: string,
) {
  return descendants(file).some((node) => {
    if (
      !ts.isFunctionDeclaration(node) ||
      node.name?.text !== factoryName ||
      node.parameters.length !== 1
    ) {
      return false;
    }

    const parameterType = node.parameters[0]?.type;
    if (!parameterType || !ts.isTypeLiteralNode(parameterType)) {
      return false;
    }

    return parameterType.members.some(
      (member) =>
        ts.isPropertySignature(member) &&
        ts.isIdentifier(member.name) &&
        member.name.text === "database" &&
        member.questionToken !== undefined &&
        member.type !== undefined &&
        ts.isTypeReferenceNode(member.type) &&
        ts.isIdentifier(member.type.typeName) &&
        member.type.typeName.text === databaseAlias,
    );
  });
}

function assertRepositoryRemainsBlocked(
  repository: BlockedRepository,
  source: string,
) {
  const file = sourceFile(repository.path, source);

  assert.ok(
    hasDatabaseSingletonImport(file),
    `${repository.path} must keep its concrete db dependency until TEST-GLOBAL-10A supplies a minimal port`,
  );

  if (repository.factoryName && repository.databaseAlias) {
    assert.ok(
      databaseAliasIsConcrete(file, repository.databaseAlias),
      `${repository.path} must remain blocked only while ${repository.databaseAlias} is typeof db`,
    );
    assert.ok(
      factoryAcceptsOnlyConcreteDatabase(
        file,
        repository.factoryName,
        repository.databaseAlias,
      ),
      `${repository.path} must be reclassified as integrated when ${repository.factoryName} accepts a minimal port`,
    );
    return;
  }

  assert.ok(
    hasDirectDatabaseUse(file),
    `${repository.path} must be reclassified as integrated when it stops using the db singleton directly`,
  );
}

test("TEST-GLOBAL-09 freezes per-module repository blockers until 10A provides minimal ports", () => {
  for (const repository of BLOCKED_REPOSITORIES) {
    assertRepositoryRemainsBlocked(repository, readSourceFile(repository.path));
  }
});

test("TEST-GLOBAL-09 repository blocker guard fails for each removed concrete-db constraint", () => {
  for (const repository of BLOCKED_REPOSITORIES) {
    const source = readSourceFile(repository.path);
    const mutation = repository.databaseAlias
      ? source.replace(`type ${repository.databaseAlias} = typeof db;`, `type ${repository.databaseAlias} = {};`)
      : source.replace("import { db", "import { databasePort");

    assert.notEqual(mutation, source, `${repository.path} mutation must change its source`);
    assert.throws(
      () => assertRepositoryRemainsBlocked(repository, mutation),
      /must keep its concrete db dependency|must remain blocked only while/,
    );
  }
});
