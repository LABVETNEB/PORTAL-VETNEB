import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

const {
  SENSITIVE_API_CACHE_CONTROL,
  shouldApplySensitiveApiNoStore,
} = await import("../../server/lib/http/sensitive-response-cache.ts");

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

test("sensitive response cache helper clasifica API no publica para no-store", () => {
  assert.equal(SENSITIVE_API_CACHE_CONTROL, "no-store");
  assert.equal(shouldApplySensitiveApiNoStore("/api/admin/auth/me"), true);
  assert.equal(
    shouldApplySensitiveApiNoStore("/api/admin/auth/change-password"),
    true,
  );
  assert.equal(shouldApplySensitiveApiNoStore("/api/auth/change-password"), true);
  assert.equal(
    shouldApplySensitiveApiNoStore("/api/admin/failed-login-alerts?limit=5"),
    true,
  );
  assert.equal(shouldApplySensitiveApiNoStore("/api/reports"), true);
  assert.equal(shouldApplySensitiveApiNoStore("/api/public/pricing"), false);
  assert.equal(
    shouldApplySensitiveApiNoStore("/api/public/professionals/search"),
    false,
  );
  assert.equal(shouldApplySensitiveApiNoStore("/dashboard/admin"), false);
});

test("fastify-app registra onSend y delega no-store sensible al helper backend", () => {
  const source = readSource("server/fastify-app.ts");

  assert.ok(source.includes('app.addHook(\n    "onSend"'));
  assert.ok(source.includes("applySensitiveApiNoStoreHeaders(request, reply)"));
});

const AUTHENTICATED_ROUTES_WITHOUT_OWN_CACHE_HEADER: readonly {
  file: string;
  label: string;
}[] = [
  { file: "server/routes/auth.fastify.ts", label: "clinic auth" },
  { file: "server/routes/admin-auth.fastify.ts", label: "admin auth" },
  { file: "server/routes/admin-reports.fastify.ts", label: "admin reports" },
  { file: "server/routes/admin-sessions.fastify.ts", label: "admin sessions" },
  {
    file: "server/routes/admin-particular-tokens.fastify.ts",
    label: "admin particular tokens",
  },
  {
    file: "server/routes/admin-report-access-tokens.fastify.ts",
    label: "admin report access tokens",
  },
  {
    file: "server/routes/admin-failed-login-alerts.fastify.ts",
    label: "admin failed login alerts",
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    label: "admin study tracking",
  },
  {
    file: "server/routes/particular-auth.fastify.ts",
    label: "particular auth",
  },
  { file: "server/routes/reports.fastify.ts", label: "clinic reports" },
] as const;

for (const { file, label } of AUTHENTICATED_ROUTES_WITHOUT_OWN_CACHE_HEADER) {
  test(`${label} no sobreescribe Cache-Control (delega al hook global)`, () => {
    const source = readSource(file);

    const hasOwnCacheControl =
      /reply\s*\.\s*header\s*\(\s*["']cache-control["']/i.test(source);

    assert.equal(
      hasOwnCacheControl,
      false,
      `${file} no debe setear Cache-Control propio; el hook global de fastify-app.ts lo cubre`,
    );
  });
}

test("public-pricing mantiene Cache-Control publico propio", () => {
  const source = readSource("server/routes/public-pricing.fastify.ts");

  assert.ok(/reply\s*\.\s*header\s*\(\s*["']Cache-Control["']/i.test(source));
  assert.ok(source.includes("public, max-age="));
});

test("no-store sensible no introduce dependencia de frontend o UI", () => {
  const helperSource = readSource("server/lib/http/sensitive-response-cache.ts");
  const fastifyAppSource = readSource("server/fastify-app.ts");
  const combined = `${helperSource}\n${fastifyAppSource}`;

  assert.equal(combined.includes("frontend"), false);
  assert.equal(combined.includes(".tsx"), false);
  assert.equal(combined.includes("components"), false);
});

// Politica fija del contrato: nunca se deriva del source productivo.
const EXPECTED_SENSITIVE_API_CACHE_CONTROL = "no-store";

const EXPECTED_NO_STORE_CLASSIFICATION: readonly (readonly [string, boolean])[] = [
  ["/api/reports", true],
  ["/api/admin/auth/me", true],
  ["/api/auth/change-password", true],
  ["/api/app-version", true],
  ["/api/public/pricing", false],
  ["/api/public/professionals/search", false],
  ["/dashboard/admin", false],
  ["", false],
];

const API_PREFIX = "/api/";
const PUBLIC_API_PREFIX = "/api/public/";

// Toda URL cae en exactamente una clase: startsWith("/api/public/") implica startsWith("/api/").
const EXPECTED_NO_STORE_POLICY: readonly {
  scope: string;
  api: boolean;
  publicApi: boolean;
  expected: boolean;
}[] = [
  { scope: "private /api/* URLs", api: true, publicApi: false, expected: true },
  { scope: "/api/public/* URLs", api: true, publicApi: true, expected: false },
  { scope: "non-/api/ URLs", api: false, publicApi: false, expected: false },
];

const HELPER_FILE = "server/lib/http/sensitive-response-cache.ts";
const FASTIFY_APP_FILE = "server/fastify-app.ts";

function findStringEnd(source: string, open: number): number {
  const quote = source[open];
  let index = open + 1;

  while (index < source.length && source[index] !== quote) {
    index += source[index] === "\\" ? 2 : 1;
  }

  return index < source.length ? index : -1;
}

function stripComments(source: string): string | undefined {
  let output = "";
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"' || char === "'" || char === "`") {
      const close = findStringEnd(source, index);
      if (close === -1) {
        return undefined;
      }
      output += source.slice(index, close + 1);
      index = close + 1;
    } else if (char === "/" && next === "/") {
      const lineEnd = source.indexOf("\n", index);
      index = lineEnd === -1 ? source.length : lineEnd;
    } else if (char === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      if (close === -1) {
        return undefined;
      }
      output += "\n".repeat(source.slice(index, close).split("\n").length - 1);
      index = close + 2;
    } else {
      output += char;
      index += 1;
    }
  }

  return output;
}

function compactCode(code: string): string {
  return code
    .replace(/\s+/g, " ")
    .replace(/\s*([(),;{}])\s*/g, "$1")
    .replace(/"cache-control"/gi, '"cache-control"')
    .trim();
}

function extractTopLevelFunction(
  source: string,
  name: string,
  signature: RegExp,
): { params: string[]; body: string } | undefined {
  if ((source.match(new RegExp(`\\bfunction ${name}\\b`, "g")) ?? []).length !== 1) {
    return undefined;
  }

  const match = signature.exec(source);
  if (!match) {
    return undefined;
  }

  const start = match.index + match[0].length;
  const end = source.indexOf("\n}", start);

  return end === -1 ? undefined : { params: match.slice(1), body: source.slice(start, end) };
}

type PathPredicate =
  | { kind: "startsWith"; prefix: string }
  | { kind: "not"; operand: PathPredicate }
  | { kind: "and" | "or"; left: PathPredicate; right: PathPredicate };

// Gramatica cerrada: <param>.startsWith("<literal>"), !, &&, || y parentesis.
// Cualquier otra forma no es evaluable.
function parsePathPredicate(expression: string, param: string): PathPredicate | undefined {
  const tokens: string[] = [];
  const pattern = /\s*(&&|\|\||!|\(|\)|"[^"\\]*"|[A-Za-z_$][\w$]*\.startsWith)/y;
  let index = 0;

  while (index < expression.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(expression);
    if (!match) {
      return undefined;
    }
    tokens.push(match[1]);
    index = pattern.lastIndex;
  }

  let position = 0;
  const take = (expected?: string): string => {
    const token = tokens[position];
    if (token === undefined || (expected !== undefined && token !== expected)) {
      throw new Error(`unexpected token at ${position}`);
    }
    position += 1;
    return token;
  };

  const parseUnary = (): PathPredicate => {
    const token = take();
    if (token === "!") {
      return { kind: "not", operand: parseUnary() };
    }
    if (token === "(") {
      const inner = parseOr();
      take(")");
      return inner;
    }
    if (token === `${param}.startsWith`) {
      take("(");
      const literal = take();
      if (!literal.startsWith('"')) {
        throw new Error("prefix must be a string literal");
      }
      take(")");
      return { kind: "startsWith", prefix: literal.slice(1, -1) };
    }
    throw new Error(`unsupported token: ${token}`);
  };

  const parseAnd = (): PathPredicate => {
    let left = parseUnary();
    while (tokens[position] === "&&") {
      take();
      left = { kind: "and", left, right: parseUnary() };
    }
    return left;
  };

  const parseOr = (): PathPredicate => {
    let left = parseAnd();
    while (tokens[position] === "||") {
      take();
      left = { kind: "or", left, right: parseAnd() };
    }
    return left;
  };

  try {
    const root = parseOr();
    return position === tokens.length ? root : undefined;
  } catch {
    return undefined;
  }
}

function evaluatePathPredicate(node: PathPredicate, holds: (prefix: string) => boolean): boolean {
  switch (node.kind) {
    case "startsWith":
      return holds(node.prefix);
    case "not":
      return !evaluatePathPredicate(node.operand, holds);
    case "and":
      return evaluatePathPredicate(node.left, holds) && evaluatePathPredicate(node.right, holds);
    case "or":
      return evaluatePathPredicate(node.left, holds) || evaluatePathPredicate(node.right, holds);
  }
}

function collectPathPrefixes(node: PathPredicate): string[] {
  switch (node.kind) {
    case "startsWith":
      return [node.prefix];
    case "not":
      return collectPathPrefixes(node.operand);
    case "and":
    case "or":
      return [...collectPathPrefixes(node.left), ...collectPathPrefixes(node.right)];
  }
}

function parseSensitiveApiClassifier(rawSource: string): PathPredicate | undefined {
  const source = stripComments(rawSource.replace(/\r\n/g, "\n"));
  const classifier =
    source === undefined
      ? undefined
      : extractTopLevelFunction(
          source,
          "shouldApplySensitiveApiNoStore",
          /^export function shouldApplySensitiveApiNoStore\((\w+): string\): boolean \{$/m,
        );
  const returned = classifier && /^return (.+);$/.exec(classifier.body.replace(/\s+/g, " ").trim());

  return classifier && returned ? parsePathPredicate(returned[1], classifier.params[0]) : undefined;
}

function evaluateSensitiveResponseCacheHelper(rawSource: string): string[] {
  const source = stripComments(rawSource.replace(/\r\n/g, "\n"));
  if (source === undefined) {
    return ["helper source is not evaluable"];
  }

  const violations: string[] = [];

  const constants = [...source.matchAll(/^export const SENSITIVE_API_CACHE_CONTROL = (.*);$/gm)];
  const constantValue =
    constants.length === 1 ? /^"([^"\\]*)"$/.exec(constants[0][1].trim())?.[1] : undefined;
  if (constantValue === undefined) {
    violations.push("helper SENSITIVE_API_CACHE_CONTROL declaration is not evaluable");
  } else if (constantValue !== EXPECTED_SENSITIVE_API_CACHE_CONTROL) {
    violations.push(
      `helper SENSITIVE_API_CACHE_CONTROL must be "${EXPECTED_SENSITIVE_API_CACHE_CONTROL}", got ${JSON.stringify(constantValue)}`,
    );
  }

  const predicate = parseSensitiveApiClassifier(source);
  if (!predicate) {
    violations.push("helper shouldApplySensitiveApiNoStore is not evaluable");
  } else {
    // Prueba de politica completa: con solo los dos limites generales como atomos,
    // la tabla de verdad sobre las tres clases de URL cubre toda URL posible.
    const unexpectedPrefixes = [...new Set(collectPathPrefixes(predicate))]
      .filter((prefix) => prefix !== API_PREFIX && prefix !== PUBLIC_API_PREFIX)
      .sort();
    for (const prefix of unexpectedPrefixes) {
      violations.push(
        `helper shouldApplySensitiveApiNoStore uses prefix ${JSON.stringify(prefix)} outside the /api/ minus /api/public/ policy`,
      );
    }
    if (unexpectedPrefixes.length === 0) {
      for (const { scope, api, publicApi, expected } of EXPECTED_NO_STORE_POLICY) {
        const actual = evaluatePathPredicate(predicate, (prefix) =>
          prefix === API_PREFIX ? api : publicApi,
        );
        if (actual !== expected) {
          violations.push(`helper shouldApplySensitiveApiNoStore must be ${expected} for ${scope}, got ${actual}`);
        }
      }
    }

    for (const [url, expected] of EXPECTED_NO_STORE_CLASSIFICATION) {
      const actual = evaluatePathPredicate(predicate, (prefix) => url.startsWith(prefix));
      if (actual !== expected) {
        violations.push(
          `helper shouldApplySensitiveApiNoStore(${JSON.stringify(url)}) must be ${expected}, got ${actual}`,
        );
      }
    }
  }

  const apply = extractTopLevelFunction(
    source,
    "applySensitiveApiNoStoreHeaders",
    /^export function applySensitiveApiNoStoreHeaders\(\s*(\w+): FastifyRequest,\s*(\w+): FastifyReply,?\s*\) \{$/m,
  );
  const branch = apply && /^if \((.*)\) \{(.*)\}$/.exec(apply.body.replace(/\s+/g, " ").trim());
  if (!apply || !branch) {
    violations.push("helper applySensitiveApiNoStoreHeaders is not evaluable");
    return violations;
  }

  const [request, reply] = apply.params;
  const gate = compactCode(`shouldApplySensitiveApiNoStore(${request}.url ?? "")`);
  const preserveExplicit = compactCode(`!${reply}.hasHeader("cache-control")`);
  const clauses = branch[1].split("&&").map(compactCode);

  if (!clauses.includes(gate)) {
    violations.push(
      "helper applySensitiveApiNoStoreHeaders must gate on shouldApplySensitiveApiNoStore(request.url)",
    );
  }
  if (!clauses.includes(preserveExplicit)) {
    violations.push(
      "helper applySensitiveApiNoStoreHeaders must not overwrite an explicit Cache-Control header",
    );
  }
  for (const clause of clauses) {
    if (clause !== gate && clause !== preserveExplicit) {
      violations.push(`helper applySensitiveApiNoStoreHeaders condition has an unexpected clause: ${clause}`);
    }
  }
  if (compactCode(branch[2]) !== compactCode(`${reply}.header("cache-control", SENSITIVE_API_CACHE_CONTROL);`)) {
    violations.push(
      "helper applySensitiveApiNoStoreHeaders must set cache-control to SENSITIVE_API_CACHE_CONTROL",
    );
  }

  return violations;
}

function readBalancedBlock(source: string, open: number): string | undefined {
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' || char === "'" || char === "`") {
      const close = findStringEnd(source, index);
      if (close === -1) {
        return undefined;
      }
      index = close;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, index);
      }
    }
  }

  return undefined;
}

function splitTopLevelStatements(body: string): string[] | undefined {
  const statements: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === '"' || char === "'" || char === "`") {
      const close = findStringEnd(body, index);
      if (close === -1) {
        return undefined;
      }
      index = close;
    } else if ("([{".includes(char)) {
      depth += 1;
    } else if (")]}".includes(char)) {
      depth -= 1;
      if (
        char === "}" &&
        depth === 0 &&
        /^\s*(?:(?:if|else|for|while|do|switch|try|catch|finally)\b|\{)/.test(body.slice(start, index))
      ) {
        statements.push(compactCode(body.slice(start, index + 1)));
        start = index + 1;
      }
    } else if (char === ";" && depth === 0) {
      statements.push(compactCode(body.slice(start, index)));
      start = index + 1;
    }
  }

  statements.push(compactCode(body.slice(start)));
  return depth === 0 ? statements.filter(Boolean) : undefined;
}

function evaluateFastifyNoStoreWiring(rawSource: string): string[] {
  const source = stripComments(rawSource.replace(/\r\n/g, "\n"));
  if (source === undefined) {
    return ["fastify-app source is not evaluable"];
  }

  const violations: string[] = [];

  const imports = [
    ...source.matchAll(/^import \{([^}]*)\} from "\.\/lib\/http\/sensitive-response-cache\.ts";$/gm),
  ];
  if (
    imports.length !== 1 ||
    !imports[0][1].split(",").map((item) => item.trim()).includes("applySensitiveApiNoStoreHeaders")
  ) {
    violations.push(
      "fastify-app must import applySensitiveApiNoStoreHeaders from ./lib/http/sensitive-response-cache.ts",
    );
  }

  const mentions = (source.match(/\bapplySensitiveApiNoStoreHeaders\b/g) ?? []).length;
  if (mentions !== 2) {
    violations.push(
      `fastify-app must reference applySensitiveApiNoStoreHeaders exactly twice (import + onSend call), found ${mentions}`,
    );
  }

  const hooks = [...source.matchAll(/\bapp\.addHook\(\s*"onSend"\s*,/g)];
  if (hooks.length !== 1) {
    violations.push(`fastify-app must register exactly one onSend hook, found ${hooks.length}`);
    return violations;
  }

  const callbackStart = (hooks[0].index ?? 0) + hooks[0][0].length;
  const callback =
    /^\s*(?:async\s*)?\(\s*(\w+)(?:\s*:\s*\w+)?\s*,\s*(\w+)(?:\s*:\s*\w+)?\s*,\s*\w+(?:\s*:\s*\w+)?\s*\)\s*=>\s*\{/.exec(
      source.slice(callbackStart),
    );
  const body = callback
    ? readBalancedBlock(source, callbackStart + callback[0].length - 1)
    : undefined;
  const statements = body === undefined ? undefined : splitTopLevelStatements(body);
  if (!callback || !statements) {
    violations.push("fastify-app onSend callback is not evaluable");
    return violations;
  }

  const callIndex = statements.indexOf(
    compactCode(`applySensitiveApiNoStoreHeaders(${callback[1]}, ${callback[2]})`),
  );
  if (callIndex === -1) {
    violations.push(
      "fastify-app onSend must call applySensitiveApiNoStoreHeaders(request, reply) as a top-level statement before returning",
    );
    return violations;
  }

  // Fail-closed: cualquier sentencia previa puede saltear el helper (salida anticipada)
  // o anularlo (un Cache-Control previo hace que hasHeader lo omita).
  const preceding = statements.slice(0, callIndex);
  if (preceding.some((statement) => /\b(?:return|throw)\b/.test(blankStringLiterals(statement)))) {
    violations.push(
      "fastify-app onSend has an early exit (return/throw) before applySensitiveApiNoStoreHeaders(request, reply)",
    );
  } else if (preceding.length > 0) {
    violations.push(
      "fastify-app onSend must run applySensitiveApiNoStoreHeaders(request, reply) before any other statement",
    );
  }

  return violations;
}

function blankStringLiterals(code: string): string {
  let output = "";
  let index = 0;

  while (index < code.length) {
    const char = code[index];
    const close = char === '"' || char === "'" || char === "`" ? findStringEnd(code, index) : -1;
    if (close === -1) {
      output += char;
      index += 1;
    } else {
      output += `${char}${char}`;
      index = close + 1;
    }
  }

  return output;
}

function replaceOnce(source: string, target: string, replacement: string): string {
  const first = source.indexOf(target);

  assert.notEqual(first, -1, `mutation target must exist in source: ${target}`);
  assert.equal(
    source.indexOf(target, first + target.length),
    -1,
    `mutation target must be unique in source: ${target}`,
  );

  return source.slice(0, first) + replacement + source.slice(first + target.length);
}

function readNormalizedSource(relativePath: string): string {
  return readSource(relativePath).replace(/\r\n/g, "\n");
}

test("evaluator no-store: el source real cumple la politica fija del contrato", () => {
  for (const [url, expected] of EXPECTED_NO_STORE_CLASSIFICATION) {
    assert.equal(shouldApplySensitiveApiNoStore(url), expected, url);
  }

  assert.deepEqual(evaluateSensitiveResponseCacheHelper(readNormalizedSource(HELPER_FILE)), []);
  assert.deepEqual(evaluateFastifyNoStoreWiring(readNormalizedSource(FASTIFY_APP_FILE)), []);
});

test("evaluator no-store: prefijos registrados en fastify-app respetan la politica (complemento)", () => {
  const registered = [
    ...(stripComments(readNormalizedSource(FASTIFY_APP_FILE)) ?? "").matchAll(/\bprefix: "(\/[^"]*)"/g),
  ].map((match) => match[1]);
  const predicate = parseSensitiveApiClassifier(readNormalizedSource(HELPER_FILE));

  assert.ok(predicate, "real classifier must be evaluable");
  assert.ok(registered.includes("/api/logistics/route-plans"), "registered private logistics prefix");
  assert.ok(registered.some((prefix) => prefix.startsWith(PUBLIC_API_PREFIX)), "registered public prefix");

  for (const prefix of registered) {
    const expected = prefix.startsWith(API_PREFIX) && !prefix.startsWith(PUBLIC_API_PREFIX);

    assert.equal(shouldApplySensitiveApiNoStore(prefix), expected, prefix);
    assert.equal(evaluatePathPredicate(predicate, (candidate) => prefix.startsWith(candidate)), expected, prefix);
  }
});

test("evaluator no-store es semantico, no textual", () => {
  const helperSource = readNormalizedSource(HELPER_FILE);
  const fastifySource = readNormalizedSource(FASTIFY_APP_FILE);
  const hookCall = "      applySensitiveApiNoStoreHeaders(request, reply);\n";

  assert.deepEqual(
    evaluateSensitiveResponseCacheHelper(
      replaceOnce(
        helperSource,
        'url.startsWith("/api/") && !url.startsWith("/api/public/")',
        '!(url.startsWith("/api/public/") || !url.startsWith("/api/"))',
      ),
    ),
    [],
  );
  assert.deepEqual(
    evaluateFastifyNoStoreWiring(
      replaceOnce(fastifySource, hookCall, `      // if (request.url.startsWith("/api/")) return payload;\n${hookCall}`),
    ),
    [],
  );
  assert.deepEqual(
    evaluateFastifyNoStoreWiring(
      replaceOnce(fastifySource, hookCall, `      reply.log.debug("return payload");\n${hookCall}`),
    ),
    ["fastify-app onSend must run applySensitiveApiNoStoreHeaders(request, reply) before any other statement"],
  );

  assert.deepEqual(
    evaluateSensitiveResponseCacheHelper(
      replaceOnce(
        helperSource,
        'url.startsWith("/api/") && !url.startsWith("/api/public/")',
        '!url.startsWith("/api/public/") && (url.startsWith("/api/"))',
      ),
    ),
    [],
  );
  assert.deepEqual(
    evaluateSensitiveResponseCacheHelper(
      replaceOnce(
        helperSource,
        'shouldApplySensitiveApiNoStore(request.url ?? "") &&\n    !reply.hasHeader("cache-control")',
        '!reply.hasHeader("Cache-Control") &&\n    shouldApplySensitiveApiNoStore(request.url ?? "")',
      ),
    ),
    [],
  );
});

test("mutaciones del helper no-store ponen el evaluator en rojo", () => {
  const helperSource = readNormalizedSource(HELPER_FILE);
  const mutations = [
    {
      name: "header debilitado a no-cache",
      target: 'export const SENSITIVE_API_CACHE_CONTROL = "no-store";',
      replacement: 'export const SENSITIVE_API_CACHE_CONTROL = "no-cache";',
      expected: ['helper SENSITIVE_API_CACHE_CONTROL must be "no-store", got "no-cache"'],
    },
    {
      name: "rutas privadas reducidas a /api/admin/",
      target: 'url.startsWith("/api/") &&',
      replacement: 'url.startsWith("/api/admin/") &&',
      expected: [
        'helper shouldApplySensitiveApiNoStore uses prefix "/api/admin/" outside the /api/ minus /api/public/ policy',
        'helper shouldApplySensitiveApiNoStore("/api/reports") must be true, got false',
        'helper shouldApplySensitiveApiNoStore("/api/auth/change-password") must be true, got false',
        'helper shouldApplySensitiveApiNoStore("/api/app-version") must be true, got false',
      ],
    },
    {
      name: "exclusion de /api/public/ eliminada",
      target: ' && !url.startsWith("/api/public/")',
      replacement: "",
      expected: [
        "helper shouldApplySensitiveApiNoStore must be false for /api/public/* URLs, got true",
        'helper shouldApplySensitiveApiNoStore("/api/public/pricing") must be false, got true',
        'helper shouldApplySensitiveApiNoStore("/api/public/professionals/search") must be false, got true',
      ],
    },
    {
      name: "clasificador privado salteado en la aplicacion",
      target: 'shouldApplySensitiveApiNoStore(request.url ?? "") &&\n    ',
      replacement: "",
      expected: [
        "helper applySensitiveApiNoStoreHeaders must gate on shouldApplySensitiveApiNoStore(request.url)",
      ],
    },
    {
      name: "Cache-Control explicito sobreescrito",
      target: ' &&\n    !reply.hasHeader("cache-control")',
      replacement: "",
      expected: [
        "helper applySensitiveApiNoStoreHeaders must not overwrite an explicit Cache-Control header",
      ],
    },
    {
      name: "header aplicado sin la constante no-store",
      target: 'reply.header("cache-control", SENSITIVE_API_CACHE_CONTROL);',
      replacement: 'reply.header("cache-control", "private");',
      expected: [
        "helper applySensitiveApiNoStoreHeaders must set cache-control to SENSITIVE_API_CACHE_CONTROL",
      ],
    },
  ] as const;

  for (const mutation of mutations) {
    const mutated = replaceOnce(helperSource, mutation.target, mutation.replacement);

    assert.notEqual(mutated, helperSource, `${mutation.name} must change the source`);
    assert.deepEqual(
      evaluateSensitiveResponseCacheHelper(mutated),
      [...mutation.expected],
      `mutation must be detected: ${mutation.name}`,
    );
  }
});

test("clasificador estrecho que preserva los ejemplos del oracle queda en rojo", () => {
  const helperSource = readNormalizedSource(HELPER_FILE);
  const policy = 'url.startsWith("/api/") && !url.startsWith("/api/public/")';
  const mutations = [
    {
      name: "union de subprefijos conocidos",
      replacement:
        'url.startsWith("/api/reports") ||\n    url.startsWith("/api/admin/") ||\n    url.startsWith("/api/auth/") ||\n    url.startsWith("/api/app-version")',
      expected: [
        'helper shouldApplySensitiveApiNoStore uses prefix "/api/admin/" outside the /api/ minus /api/public/ policy',
        'helper shouldApplySensitiveApiNoStore uses prefix "/api/app-version" outside the /api/ minus /api/public/ policy',
        'helper shouldApplySensitiveApiNoStore uses prefix "/api/auth/" outside the /api/ minus /api/public/ policy',
        'helper shouldApplySensitiveApiNoStore uses prefix "/api/reports" outside the /api/ minus /api/public/ policy',
      ],
    },
    {
      name: "exclusion parcial de una familia privada",
      replacement: `${policy} && !url.startsWith("/api/logistics/")`,
      expected: [
        'helper shouldApplySensitiveApiNoStore uses prefix "/api/logistics/" outside the /api/ minus /api/public/ policy',
      ],
    },
  ] as const;

  for (const mutation of mutations) {
    const mutated = replaceOnce(helperSource, policy, mutation.replacement);
    const predicate = parseSensitiveApiClassifier(mutated);

    assert.ok(predicate, `${mutation.name} must stay parseable`);
    // La matriz de ejemplos sola no alcanzaba: todos siguen coincidiendo.
    for (const [url, expected] of EXPECTED_NO_STORE_CLASSIFICATION) {
      assert.equal(evaluatePathPredicate(predicate, (prefix) => url.startsWith(prefix)), expected, url);
    }
    assert.equal(
      evaluatePathPredicate(predicate, (prefix) => "/api/logistics/route-plans".startsWith(prefix)),
      false,
      `${mutation.name} leaves a registered private route cacheable`,
    );
    assert.deepEqual(
      evaluateSensitiveResponseCacheHelper(mutated),
      [...mutation.expected],
      `mutation must be detected: ${mutation.name}`,
    );
  }

  assert.equal(shouldApplySensitiveApiNoStore("/api/logistics/route-plans"), true);
});

test("mutaciones del cableado onSend de fastify-app ponen el evaluator en rojo", () => {
  const fastifySource = readNormalizedSource(FASTIFY_APP_FILE);
  const hookCall = "      applySensitiveApiNoStoreHeaders(request, reply);\n";
  const hookReturn = "      return addApiErrorRequestIdToJsonPayload(request, reply, payload);\n";
  const mutations = [
    {
      name: "llamada eliminada con el texto conservado en un comentario",
      target: hookCall,
      replacement: "      // applySensitiveApiNoStoreHeaders(request, reply);\n",
      expected: [
        "fastify-app must reference applySensitiveApiNoStoreHeaders exactly twice (import + onSend call), found 1",
        "fastify-app onSend must call applySensitiveApiNoStoreHeaders(request, reply) as a top-level statement before returning",
      ],
    },
    {
      name: "llamada movida despues del return",
      target: `${hookCall}\n${hookReturn}`,
      replacement: `${hookReturn}${hookCall}`,
      expected: [
        "fastify-app onSend has an early exit (return/throw) before applySensitiveApiNoStoreHeaders(request, reply)",
      ],
    },
    {
      name: "return condicional sin llaves antes del helper",
      target: hookCall,
      replacement: `      if (request.url.startsWith("/api/")) return payload;\n\n${hookCall}`,
      expected: [
        "fastify-app onSend has an early exit (return/throw) before applySensitiveApiNoStoreHeaders(request, reply)",
      ],
    },
    {
      name: "return condicional en bloque antes del helper",
      target: hookCall,
      replacement: `      if (request.url.startsWith("/api/")) {\n        return payload;\n      }\n\n${hookCall}`,
      expected: [
        "fastify-app onSend has an early exit (return/throw) before applySensitiveApiNoStoreHeaders(request, reply)",
      ],
    },
    {
      name: "Cache-Control publico fijado antes del helper",
      target: hookCall,
      replacement: `      reply.header("cache-control", "public, max-age=600");\n\n${hookCall}`,
      expected: [
        "fastify-app onSend must run applySensitiveApiNoStoreHeaders(request, reply) before any other statement",
      ],
    },
    {
      name: "helper sombreado por un no-op local",
      target: '  app.addHook(\n    "onSend",',
      replacement:
        '  const applySensitiveApiNoStoreHeaders = (..._args: unknown[]) => undefined;\n\n  app.addHook(\n    "onSend",',
      expected: [
        "fastify-app must reference applySensitiveApiNoStoreHeaders exactly twice (import + onSend call), found 3",
      ],
    },
    {
      name: "segundo onSend sobreescribe cache-control",
      target: '  app.addHook("onResponse", async (request, reply) => {',
      replacement:
        '  app.addHook("onSend", async (_request, reply, payload) => {\n    reply.header("cache-control", "public, max-age=600");\n    return payload;\n  });\n\n  app.addHook("onResponse", async (request, reply) => {',
      expected: ["fastify-app must register exactly one onSend hook, found 2"],
    },
  ] as const;

  for (const mutation of mutations) {
    const mutated = replaceOnce(fastifySource, mutation.target, mutation.replacement);

    assert.notEqual(mutated, fastifySource, `${mutation.name} must change the source`);
    assert.deepEqual(
      evaluateFastifyNoStoreWiring(mutated),
      [...mutation.expected],
      `mutation must be detected: ${mutation.name}`,
    );
    // Los marcadores por substring previos siguen en verde; solo el evaluator detecta la regresion.
    assert.equal(mutated.includes('app.addHook(\n    "onSend"'), true, mutation.name);
    assert.equal(mutated.includes("applySensitiveApiNoStoreHeaders(request, reply)"), true, mutation.name);
  }
});

test("evaluator no-store falla cerrado ante estructura no evaluable (fail-closed)", () => {
  const helperSource = readNormalizedSource(HELPER_FILE);
  const fastifySource = readNormalizedSource(FASTIFY_APP_FILE);

  assert.deepEqual(evaluateSensitiveResponseCacheHelper(""), [
    "helper SENSITIVE_API_CACHE_CONTROL declaration is not evaluable",
    "helper shouldApplySensitiveApiNoStore is not evaluable",
    "helper applySensitiveApiNoStoreHeaders is not evaluable",
  ]);
  assert.deepEqual(evaluateSensitiveResponseCacheHelper(`${helperSource}\n/* sin cierre`), [
    "helper source is not evaluable",
  ]);
  assert.deepEqual(
    evaluateSensitiveResponseCacheHelper(
      replaceOnce(helperSource, '= "no-store";', "= resolveSensitiveCacheControl();"),
    ),
    ["helper SENSITIVE_API_CACHE_CONTROL declaration is not evaluable"],
  );
  assert.deepEqual(
    evaluateSensitiveResponseCacheHelper(
      replaceOnce(
        helperSource,
        'url.startsWith("/api/") && !url.startsWith("/api/public/")',
        "PRIVATE_API_PREFIXES.some((prefix) => url.startsWith(prefix))",
      ),
    ),
    ["helper shouldApplySensitiveApiNoStore is not evaluable"],
  );
  assert.deepEqual(
    evaluateSensitiveResponseCacheHelper(
      `${helperSource}\nexport function shouldApplySensitiveApiNoStore(url: string): boolean {\n  return true;\n}\n`,
    ),
    ["helper shouldApplySensitiveApiNoStore is not evaluable"],
  );

  assert.deepEqual(evaluateFastifyNoStoreWiring(""), [
    "fastify-app must import applySensitiveApiNoStoreHeaders from ./lib/http/sensitive-response-cache.ts",
    "fastify-app must reference applySensitiveApiNoStoreHeaders exactly twice (import + onSend call), found 0",
    "fastify-app must register exactly one onSend hook, found 0",
  ]);
  assert.deepEqual(
    evaluateFastifyNoStoreWiring(
      replaceOnce(
        fastifySource,
        "    async (request: FastifyRequest, reply: FastifyReply, payload) => {\n      applySensitiveApiNoStoreHeaders(request, reply);\n\n      return addApiErrorRequestIdToJsonPayload(request, reply, payload);\n    },",
        "    sensitiveNoStoreOnSend,",
      ),
    ),
    [
      "fastify-app must reference applySensitiveApiNoStoreHeaders exactly twice (import + onSend call), found 1",
      "fastify-app onSend callback is not evaluable",
    ],
  );

  assert.throws(
    () => replaceOnce(helperSource, "reply.removeHeader(", ""),
    /mutation target must exist in source/,
  );
  assert.throws(
    () => replaceOnce(helperSource, "url.startsWith(", ""),
    /mutation target must be unique in source/,
  );
});
