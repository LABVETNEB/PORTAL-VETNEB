import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import {
  effectiveAttribute,
  elementText,
  evaluate,
  jsxElements,
  parseTsx,
  staticAttribute,
  tagName,
  type JsxNode,
} from "../dashboard/dashboard-source-oracle.ts";
import { functionNamed, initializerNamed, runSource } from "./source-function-runner.ts";

// C04 frontend (P2-09, rector §7.8): the Clínicas admin table asks the server
// for a global column order. The client only keeps the requested sort, sends
// it with the existing limit/offset/search and renders aria-sort; rows always
// come from the response as received. Executed against the source as written,
// with an in-memory mutation proof of every regression the contract forbids.

const CARD_PATH = "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";
const API_PATH = "frontend/src/lib/api.ts";

type Sort = { sort: string; direction: string } | null;

function parseTs(source: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function typeAliasText(file: ts.SourceFile, name: string): string {
  const alias = file.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === name,
  );
  if (!alias) throw new Error(`${name}: type alias not found`);
  return alias.getText().replace(/^export\s+/, "");
}

// Compiles probes against the real API types and returns the ones that fail
// to typecheck.
function rejectedProbes(apiSource: string, probes: Readonly<Record<string, string>>): string[] {
  const api = parseTs(apiSource, API_PATH);
  const client = functionNamed(api, "getAdminClinics");
  const paramsType = client.parameters[0]?.type?.getText();
  if (!paramsType) throw new Error("getAdminClinics: params are not typed");

  const prelude = [
    typeAliasText(api, "AdminClinicsSortKey"),
    typeAliasText(api, "AdminClinicsSortDirection"),
    typeAliasText(api, "AdminClinicsSortParams"),
    `type Params = ${paramsType};`,
  ].join("\n");
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2022.d.ts"],
    types: [],
  };
  const files = new Map(
    Object.entries(probes).map(([name, body]) => [`/c04/${name}.ts`, `${prelude}\nexport const probe: Params = ${body};\n`]),
  );
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, ...rest) => {
    const text = files.get(fileName);
    return text === undefined
      ? getSourceFile(fileName, languageVersion, ...rest)
      : ts.createSourceFile(fileName, text, languageVersion, true, ts.ScriptKind.TS);
  };
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (fileName) => files.has(fileName) || fileExists(fileName);
  const program = ts.createProgram([...files.keys()], options, host);

  return Object.keys(probes).filter((name) => {
    const file = program.getSourceFile(`/c04/${name}.ts`);
    return program.getSemanticDiagnostics(file).length + program.getSyntacticDiagnostics(file).length > 0;
  });
}

const ACCEPTED_PROBES = {
  unsorted: "{}",
  legacy: '{ limit: 9, offset: 18, search: "vet" }',
  nameAsc: '{ limit: 9, offset: 0, sort: "name", direction: "asc" }',
  createdAtDesc: '{ sort: "createdAt", direction: "desc" }',
} as const;

const REJECTED_PROBES = {
  unknownKey: '{ sort: "id", direction: "asc" }',
  sensitiveKey: '{ sort: "contactEmail", direction: "asc" }',
  anyString: '{ sort: "name" as string, direction: "asc" }',
  unknownDirection: '{ sort: "name", direction: "up" }',
  sortAlone: '{ sort: "name" }',
  directionAlone: '{ direction: "asc" }',
} as const;

async function sentUrls(apiSource: string, requests: readonly Record<string, unknown>[]): Promise<string[]> {
  const urls: string[] = [];
  const client = runSource<(params?: Record<string, unknown>) => Promise<unknown>>(
    functionNamed(parseTs(apiSource, API_PATH), "getAdminClinics"),
    {
      URLSearchParams,
      String,
      apiFetch: async (path: string) => {
        urls.push(path);
        return {};
      },
    },
  );
  for (const request of requests) await client(request);
  return urls;
}

const CLIENT_CASES: readonly [Record<string, unknown>, string][] = [
  [{}, "/api/admin/clinics"],
  [{ limit: 9, offset: 0 }, "/api/admin/clinics?limit=9&offset=0"],
  [{ limit: 12, offset: 24, search: "vet" }, "/api/admin/clinics?limit=12&offset=24&search=vet"],
  [{ limit: 9, offset: 0, sort: "name", direction: "asc" }, "/api/admin/clinics?limit=9&offset=0&sort=name&direction=asc"],
  [{ limit: 9, offset: 0, sort: "name", direction: "desc" }, "/api/admin/clinics?limit=9&offset=0&sort=name&direction=desc"],
  [
    { limit: 16, offset: 16, search: "vet", sort: "createdAt", direction: "asc" },
    "/api/admin/clinics?limit=16&offset=16&search=vet&sort=createdAt&direction=asc",
  ],
  [{ limit: 9, offset: 9, sort: "createdAt", direction: "desc" }, "/api/admin/clinics?limit=9&offset=9&sort=createdAt&direction=desc"],
];

type Header = { label: string; ariaSort: string | null; element: JsxNode };

function tableHeaders(card: ts.SourceFile): Header[] {
  return jsxElements(card)
    .filter((element) => tagName(element) === "TableHead")
    .map((element) => {
      const button = jsxElements(element).find((child) => tagName(child) === "ClinicsSortHeaderButton");
      const ariaSort = effectiveAttribute(element, "aria-sort");
      return {
        label: elementText(element) || (button ? staticAttribute(button, "label") ?? "" : ""),
        ariaSort: ariaSort.kind === "value" ? ariaSort.expression.getText() : ariaSort.kind === "absent" ? null : ariaSort.kind,
        element,
      };
    });
}

async function c04Violations(cardSource: string, apiSource: string): Promise<string[]> {
  const violations: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (!condition) violations.push(message);
  };
  const attempt = async (label: string, run: () => unknown) => {
    try {
      await run();
    } catch (error) {
      violations.push(`${label}: ${(error as Error).message}`);
    }
  };

  // 1–2. The API client type admits only the allowlist, and only as a pair.
  await attempt("api types", () => {
    const rejected = rejectedProbes(apiSource, { ...ACCEPTED_PROBES, ...REJECTED_PROBES });
    check(
      JSON.stringify(rejected) === JSON.stringify(Object.keys(REJECTED_PROBES)),
      `api types: rejected ${JSON.stringify(rejected)}`,
    );
  });

  // 3–4. Serialization: nothing without a request, both params with one.
  await attempt("api serialization", async () => {
    const urls = await sentUrls(apiSource, CLIENT_CASES.map(([request]) => request));
    CLIENT_CASES.forEach(([, expected], index) => check(urls[index] === expected, `api: ${urls[index]} !== ${expected}`));
  });

  const card = parseTsx(cardSource, CARD_PATH);
  const code = stripComments(cardSource);

  // Toggle semantics: asc first, then alternate; another column restarts asc.
  await attempt("toggle", () => {
    const next = runSource<(current: Sort, key: string) => Sort>(functionNamed(card, "nextClinicsColumnSort"), {});
    const sequence: [Sort, string, Sort][] = [
      [null, "name", { sort: "name", direction: "asc" }],
      [{ sort: "name", direction: "asc" }, "name", { sort: "name", direction: "desc" }],
      [{ sort: "name", direction: "desc" }, "name", { sort: "name", direction: "asc" }],
      [{ sort: "name", direction: "desc" }, "createdAt", { sort: "createdAt", direction: "asc" }],
      [{ sort: "createdAt", direction: "asc" }, "createdAt", { sort: "createdAt", direction: "desc" }],
      [{ sort: "createdAt", direction: "desc" }, "name", { sort: "name", direction: "asc" }],
    ];
    for (const [current, key, expected] of sequence) {
      const actual = next(current, key);
      check(JSON.stringify(actual) === JSON.stringify(expected), `toggle ${JSON.stringify(current)} + ${key} → ${JSON.stringify(actual)}`);
    }
  });

  // 7. aria-sort values.
  const ariaSort = runSource<(current: Sort, key: string) => string>(functionNamed(card, "clinicsAriaSort"), {});
  await attempt("aria-sort mapping", () => {
    for (const [current, key, expected] of [
      [null, "name", "none"],
      [null, "createdAt", "none"],
      [{ sort: "name", direction: "asc" }, "name", "ascending"],
      [{ sort: "name", direction: "desc" }, "name", "descending"],
      [{ sort: "name", direction: "asc" }, "createdAt", "none"],
      [{ sort: "createdAt", direction: "desc" }, "createdAt", "descending"],
      [{ sort: "createdAt", direction: "asc" }, "name", "none"],
    ] as const) {
      check(ariaSort(current, key) === expected, `aria-sort ${JSON.stringify(current)} ${key} → ${ariaSort(current, key)}`);
    }
  });

  // 5–6, 8. Headers: only Clínica (name) and Fechas (createdAt) are sortable,
  // aria-sort lives on the th and the control is a native button.
  await attempt("headers", () => {
    const headers = tableHeaders(card);
    check(
      JSON.stringify(headers.map((header) => header.label)) === JSON.stringify(["Clínica", "Contacto", "Usuario", "Fechas", "Acciones"]),
      `header labels ${JSON.stringify(headers.map((header) => header.label))}`,
    );
    const expected: Record<string, string | null> = { Clínica: "name", Contacto: null, Usuario: null, Fechas: "createdAt", Acciones: null };
    for (const header of headers) {
      const key = expected[header.label];
      const buttons = jsxElements(header.element).filter((child) => tagName(child) === "ClinicsSortHeaderButton");
      if (key === null || key === undefined) {
        check(header.ariaSort === null && buttons.length === 0, `${header.label} must not be sortable`);
        continue;
      }
      check(buttons.length === 1, `${header.label}: one sort button`);
      // aria-sort describes the applied order (the rows on screen), never a
      // requested order whose response has not arrived yet.
      const states = [null, { sort: key, direction: "asc" }, { sort: key, direction: "desc" }, { sort: key === "name" ? "createdAt" : "name", direction: "asc" }];
      for (const [index, state] of states.entries()) {
        const pending = states[(index + 1) % states.length];
        const scope = { clinicsAriaSort: ariaSort, appliedSort: state, requestedSort: pending, columnSort: pending };
        const expectedValue = ariaSort(state, key);
        const actual = header.ariaSort === null ? null : evaluate(effectiveAttributeExpression(header.element, "aria-sort"), scope);
        check(actual === expectedValue, `${header.label}: aria-sort ${JSON.stringify(state)} → ${actual}`);
        if (buttons[0]) {
          const buttonValue = evaluate(effectiveAttributeExpression(buttons[0], "ariaSort"), scope);
          check(buttonValue === expectedValue, `${header.label}: icon state ${JSON.stringify(state)} → ${buttonValue}`);
        }
      }
      if (buttons[0]) {
        const toggled: string[] = [];
        const onToggle = evaluate(effectiveAttributeExpression(buttons[0], "onToggle"), {
          toggleColumnSort: (requested: string) => toggled.push(requested),
        }) as () => void;
        onToggle();
        check(JSON.stringify(toggled) === JSON.stringify([key]), `${header.label} toggles ${JSON.stringify(toggled)}`);
      }
    }

    const button = functionNamed(card, "ClinicsSortHeaderButton");
    const rendered = jsxElements(button);
    const native = rendered.filter((element) => tagName(element) === "button");
    check(native.length === 1, "sort control is one native <button>");
    if (native[0]) {
      check(staticAttribute(native[0], "type") === "button", "sort button is type=button");
      check(effectiveAttribute(native[0], "onClick").kind === "value" && effectiveAttributeExpression(native[0], "onClick").getText() === "onToggle", "button click toggles");
      for (const forbidden of ["role", "tabIndex", "onKeyDown", "aria-sort"]) {
        check(effectiveAttribute(native[0], forbidden).kind === "absent", `button must not own ${forbidden}`);
      }
      check((staticAttribute(native[0], "className") ?? "").includes("focus-visible:ring-2"), "button keeps a visible focus ring");
    }
    const icons = rendered.filter((element) => tagName(element) === "Icon");
    check(icons.length === 1 && staticAttribute(icons[0], "aria-hidden") === "true", "sort icon is aria-hidden");
    const icon = (state: string) => evaluate(initializerNamed(card, "Icon"), { ariaSort: state, ArrowUp: "up", ArrowDown: "down", ArrowUpDown: "both" });
    check(icon("ascending") === "up" && icon("descending") === "down" && icon("none") === "both", "icon follows aria-sort");
  });

  // Mobile has no headers, so it never sends a hidden order.
  await attempt("mobile gating", () => {
    const requested = initializerNamed(card, "requestedSort");
    const sort = { sort: "name", direction: "desc" };
    check(evaluate(requested, { mobileCapacity: { measured: true }, columnSort: sort }) === null, "mobile drops the desktop order");
    check(evaluate(requested, { mobileCapacity: { measured: false }, columnSort: sort }) === sort, "desktop sends the requested order");
    check(evaluate(requested, { mobileCapacity: { measured: false }, columnSort: null }) === null, "no request by default");
    check(code.includes("useState<ClinicsColumnSort>(null)"), "initial state is unsorted");
  });

  // 10. The query keeps limit, offset and search; sort only adds the pair.
  await attempt("query", () => {
    const pageFactory = initializerNamed(card, "pageQuery");
    const factory = initializerNamed(card, "query");
    for (const memo of [pageFactory, factory]) {
      if (!ts.isCallExpression(memo) || memo.expression.getText() !== "useMemo") throw new Error(`${memo.getText().slice(0, 30)} is not memoized`);
    }
    const pageArgs = (pageFactory as ts.CallExpression).arguments;
    const queryArgs = (factory as ts.CallExpression).arguments;
    check(pageArgs[1]?.getText() === "[effectiveLimit, offset, submittedSearch]", "the page window never depends on the order");
    check(queryArgs[1]?.getText() === "[pageQuery, requestedSort]", "query reacts to the page window and the requested sort");
    for (const requestedSort of [null, { sort: "name", direction: "asc" }, { sort: "createdAt", direction: "desc" }]) {
      for (const [effectiveLimit, offset, submittedSearch] of [[9, 0, ""], [12, 24, "vet"], [36, 36, ""]] as const) {
        const pageQuery = (evaluate(pageArgs[0], { effectiveLimit, offset, submittedSearch }) as () => unknown)();
        const query = (evaluate(queryArgs[0], { pageQuery, requestedSort }) as () => unknown)();
        const expected = {
          limit: effectiveLimit,
          offset,
          ...(submittedSearch ? { search: submittedSearch } : {}),
          ...(requestedSort ?? {}),
        };
        check(JSON.stringify(query) === JSON.stringify(expected), `query ${JSON.stringify(query)} !== ${JSON.stringify(expected)}`);
        if (requestedSort === null) check(query === pageQuery, "without an order the legacy query is sent as is");
      }
    }
  });

  // The loader forwards the query unchanged and applies its order only with
  // its own rows, under the existing latest-request guard.
  await attempt("loader", async () => {
    const run = async (superseded: boolean, fails: boolean) => {
      const sent: unknown[] = [];
      const writes: [string, unknown][] = [];
      const latestRequestRef = { current: 0 };
      const query = { limit: 12, offset: 0, sort: "createdAt", direction: "asc" };
      const requestedSort = { sort: "createdAt", direction: "asc" };
      const response = { clinics: [], total: 0 };
      const loadClinics = runSource<() => void>(functionNamed(card, "loadClinics"), {
        query,
        requestedSort,
        latestRequestRef,
        setError: (value: unknown) => writes.push(["setError", value]),
        setSnapshot: (value: unknown) => writes.push(["setSnapshot", value]),
        setAppliedSort: (value: unknown) => writes.push(["setAppliedSort", value]),
        startTransition: (callback: () => void) => callback(),
        getAdminClinics: async (request: unknown) => {
          sent.push(request);
          if (superseded) latestRequestRef.current += 1;
          if (fails) throw new Error("request failed");
          return response;
        },
        formatAdminClinicsError: String,
      });
      loadClinics();
      await new Promise((resolve) => setImmediate(resolve));
      check(sent.length === 1 && sent[0] === query, "loadClinics sends the query as built");
      return { writes: writes.slice(1).map(([name, value]) => [name, value === response ? "response" : value === requestedSort ? "requested" : value]) };
    };
    const applied = await run(false, false);
    check(
      JSON.stringify(applied.writes) === JSON.stringify([["setSnapshot", "response"], ["setAppliedSort", "requested"]]),
      `fresh response applies rows and order together: ${JSON.stringify(applied.writes)}`,
    );
    const stale = await run(true, false);
    check(JSON.stringify(stale.writes) === "[]", `a superseded response writes nothing: ${JSON.stringify(stale.writes)}`);
    const failed = await run(false, true);
    check(failed.writes.every(([name]) => name === "setError"), `a failed request keeps the applied order: ${JSON.stringify(failed.writes)}`);
    check(/\[appliedSort, setAppliedSort\] = useState<ClinicsColumnSort>\(null\)/.test(code), "applied order starts unsorted");
    check((code.match(/setAppliedSort\(/g) ?? []).length === 1, "only the loader applies an order");
  });

  // The sortable Fechas column shows the value the server sorts by.
  await attempt("fechas cell", () => {
    const row = jsxElements(card).find((element) =>
      tagName(element) === "TableRow" && (effectiveAttribute(element, "key").kind === "value") &&
      effectiveAttributeExpression(element, "key").getText().includes("clinic.clinicId"));
    if (!row) throw new Error("desktop clinic row not found");
    const cells = jsxElements(row).filter((element) => tagName(element) === "TableCell");
    check(cells.length === 5, `desktop row has ${cells.length} cells`);
    const fechas = cells[3];
    if (!fechas || !ts.isJsxElement(fechas)) throw new Error("Fechas cell not found");
    const shown = fechas.children.filter(ts.isJsxExpression).map((child) => child.expression).filter((expression): expression is ts.Expression => expression !== undefined);
    const scope = { clinic: { createdAt: "CREATED", updatedAt: "UPDATED" }, formatDateTime: (value: string) => `<${value}>` };
    check(shown.length === 1 && evaluate(shown[0], scope) === "<CREATED>", `Fechas shows ${shown.map((expression) => expression.getText()).join(", ")}`);
    check(evaluate(effectiveAttributeExpression(fechas, "title"), scope) === "Creada: <CREATED> · Actualizada: <UPDATED>",
      "updatedAt stays secondary and labelled in the title");
  });

  // A new order restarts at offset 0 and touches nothing else.
  await attempt("toggle handler", () => {
    const calls: [string, unknown][] = [];
    let state: Sort = { sort: "name", direction: "asc" };
    const toggle = runSource<(key: string) => void>(functionNamed(card, "toggleColumnSort"), {
      setError: (value: unknown) => calls.push(["setError", value]),
      setColumnSort: (update: (current: Sort) => Sort) => {
        state = update(state);
        calls.push(["setColumnSort", state]);
      },
      setOffset: (value: unknown) => calls.push(["setOffset", value]),
      nextClinicsColumnSort: runSource(functionNamed(card, "nextClinicsColumnSort"), {}),
    });
    toggle("name");
    check(
      JSON.stringify(calls) === JSON.stringify([["setError", null], ["setColumnSort", { sort: "name", direction: "desc" }], ["setOffset", 0]]),
      `toggle handler calls ${JSON.stringify(calls)}`,
    );
  });

  // 9. Rows are the server page as received: no client reordering anywhere.
  await attempt("rows", () => {
    const rowsOf = runSource<(snapshot: unknown) => { clinic: { clinicId: number } }[]>(functionNamed(card, "getClinicUserRows"), { Math });
    const ids = [7, 2, 9, 2.5, 1].map((value, index) => value * 10 + index);
    const clinics = ids.map((clinicId) => ({ clinicId, clinicName: `Z${100 - clinicId}`, users: [] }));
    const rows = rowsOf({ clinics });
    check(JSON.stringify(rows.map((row) => row.clinic.clinicId)) === JSON.stringify(ids), "rows keep the server order");
    check(initializerNamed(card, "rows").getText() === "useMemo(() => getClinicUserRows(snapshot), [snapshot])", "rows derive from the snapshot only");
    for (const forbidden of [".sort(", "toSorted(", ".reverse(", "toReversed(", "localeCompare"]) {
      check(!code.includes(forbidden), `client-side reordering: ${forbidden}`);
    }
  });

  return violations;
}

function effectiveAttributeExpression(element: JsxNode, name: string): ts.Expression {
  const value = effectiveAttribute(element, name);
  if (value.kind !== "value") throw new Error(`${name}: not a readable attribute`);
  return value.expression;
}

test("C04 · Clínicas column sort: typed client, server request, aria-sort and no client reordering", async () => {
  assert.deepEqual(await c04Violations(read(CARD_PATH), read(API_PATH)), []);
});

test("C04 · the contract check rejects every forbidden regression (in-memory mutation proof)", async () => {
  const card = read(CARD_PATH);
  const api = read(API_PATH);
  type Edit = readonly [anchor: string, replacement: string];
  const mutants: readonly (readonly [string, "card" | "api", ...Edit[]])[] = [
    ["name → createdAt on Clínica", "card", ['onToggle={() => toggleColumnSort("name")}', 'onToggle={() => toggleColumnSort("createdAt")}']],
    ["first press desc", "card", ['=== "asc" ? "desc" : "asc"', '=== "asc" ? "asc" : "desc"']],
    ["sort dropped from the request", "api", ['    query.set("sort", params.sort);\n', ""]],
    ["direction dropped from the request", "api", ['    query.set("direction", params.direction);\n', ""]],
    ["page-only client sort", "card", ["useMemo(() => getClinicUserRows(snapshot), [snapshot])", "useMemo(() => getClinicUserRows(snapshot).sort((a, b) => a.clinic.clinicName.localeCompare(b.clinic.clinicName)), [snapshot])"]],
    ["aria-sort removed from the th", "card", ['<TableHead aria-sort={clinicsAriaSort(appliedSort, "name")}>', "<TableHead>"]],
    ["aria-sort ahead of the rows (th)", "card", ['<TableHead aria-sort={clinicsAriaSort(appliedSort, "createdAt")}>', '<TableHead aria-sort={clinicsAriaSort(requestedSort, "createdAt")}>']],
    ["aria-sort ahead of the rows (icon)", "card", ['ariaSort={clinicsAriaSort(appliedSort, "name")}', 'ariaSort={clinicsAriaSort(columnSort, "name")}']],
    ["applied order escapes the stale-request guard", "card", ["          if (requestId !== latestRequestRef.current) return;\n          setSnapshot(result);\n          setAppliedSort(sortOfRequest);", "          setAppliedSort(sortOfRequest);\n          if (requestId !== latestRequestRef.current) return;\n          setSnapshot(result);"]],
    ["applied order never set", "card", ["          setAppliedSort(sortOfRequest);\n", ""]],
    ["applied order set on click", "card", ["    setColumnSort((current) => nextClinicsColumnSort(current, key));\n", "    setColumnSort((current) => nextClinicsColumnSort(current, key));\n    setAppliedSort(nextClinicsColumnSort(columnSort, key));\n"]],
    ["Fechas shows updatedAt", "card", ["                      {formatDateTime(clinic.createdAt)}\n                    </TableCell>", "                      {formatDateTime(clinic.updatedAt)}\n                    </TableCell>"]],
    ["toggle stuck on desc", "card", ['current?.sort === key && current.direction === "asc" ? "desc" : "asc"', 'current?.sort === key ? "desc" : "asc"']],
    ["aria-sort mapping inverted", "card", ['return current.direction === "asc" ? "ascending" : "descending";', 'return current.direction === "asc" ? "descending" : "ascending";']],
    ["sort not sent with the query", "card", ["() => (requestedSort ? { ...pageQuery, ...requestedSort } : pageQuery),", "() => pageQuery,"]],
    ["limit transformed by sort", "card", ["() => (requestedSort ? { ...pageQuery, ...requestedSort } : pageQuery),", "() => (requestedSort ? { ...pageQuery, ...requestedSort, limit: 50 } : pageQuery),"]],
    ["page window depends on the order", "card", ["    [effectiveLimit, offset, submittedSearch],\n  );", "    [effectiveLimit, offset, submittedSearch, requestedSort],\n  );"]],
    ["hidden mobile order", "card", ["mobileCapacity.measured ? null : columnSort", "columnSort"]],
    ["new order keeps a stale offset", "card", ["    setColumnSort((current) => nextClinicsColumnSort(current, key));\n    setOffset(0);", "    setColumnSort((current) => nextClinicsColumnSort(current, key));"]],
    ["span role=button control", "card", ['    <button\n      type="button"\n      title={title}', '    <span\n      role="button"\n      title={title}'], ["    </button>\n  );\n}", "    </span>\n  );\n}"]],
    ["arbitrary sort key accepted", "api", ['export type AdminClinicsSortKey = "name" | "createdAt";', "export type AdminClinicsSortKey = string;"]],
    ["sort without direction accepted", "api", ["  | { sort: AdminClinicsSortKey; direction: AdminClinicsSortDirection };", "  | { sort: AdminClinicsSortKey; direction?: AdminClinicsSortDirection };"]],
  ];

  let killed = 0;
  for (const [name, target, ...edits] of mutants) {
    let mutated = target === "card" ? card : api;
    for (const [anchor, replacement] of edits) {
      assert.equal(mutated.split(anchor).length, 2, `unique ${target} anchor for ${name}: ${anchor}`);
      mutated = mutated.replace(anchor, () => replacement);
    }
    let violations: string[];
    try {
      violations = await c04Violations(target === "card" ? mutated : card, target === "api" ? mutated : api);
    } catch (error) {
      violations = [(error as Error).message];
    }
    assert.notDeepEqual(violations, [], `mutant survived: ${name}`);
    killed += 1;
  }
  assert.equal(killed, mutants.length);
});
