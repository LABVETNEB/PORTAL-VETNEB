import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import * as queryModel from "../../../../frontend/src/lib/global-search-query.ts";
import { parseGlobalSearchLanguage } from "../../../../server/features/global-search/domain/global-search-query.ts";
import {
  EMPTY_GLOBAL_SEARCH_ADVANCED_TEXT,
  GLOBAL_SEARCH_QUERY_MAX_LENGTH,
  composeAdvancedFreeText,
  collapseGlobalSearchText,
  foldTypedGlobalSearchFilters,
  hasGlobalSearchFilterOperators,
  parseGlobalSearchQuery,
  quoteGlobalSearchWordIfOperator,
  readAdvancedFreeText,
  resolveGlobalSearchQuery,
  type GlobalSearchSemantics,
} from "../../../../frontend/src/lib/global-search-query.ts";
import type { GlobalSearchFilters } from "../../../../frontend/src/lib/global-search.ts";

const LIB_URL = pathToFileURL(resolve(import.meta.dirname, "../../../../frontend/src/lib/global-search.ts")).href;
const SIBLINGS = new Set(["./routes", "./study-types", "./global-search-query"]);

// The frontend imports its siblings without an extension (the Next.js idiom the
// type-stripping loader cannot resolve); the fallback is limited to that exact
// parent and those specifiers, as in frontend-global-search-client.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (context.parentURL !== LIB_URL || !SIBLINGS.has(specifier)) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

const { EMPTY_GLOBAL_SEARCH_FILTERS, clearGlobalSearchFilter, describeGlobalSearchFilterChips } = (await import(
  LIB_URL
)) as typeof import("../../../../frontend/src/lib/global-search.ts");

// GLOBAL-SEARCH-DRIVE-A · the client's canonical query model against the server's parser.
// The server is the authority; the client is permissive. Synthetic text only.

function serverSemantics(text: string): GlobalSearchSemantics | null {
  const parsed = parseGlobalSearchLanguage(text);
  if (!parsed.ok) return null;
  return {
    clauses: parsed.clauses.map((clause) =>
      clause.map((term) => ({ text: term.text, numericId: term.numericId, titleOnly: term.titleOnly })),
    ),
    typeKinds: parsed.typeKinds ? [...parsed.typeKinds] : null,
    filters: {
      status: parsed.filters.status,
      studyType: parsed.filters.studyType,
      after: parsed.filters.after,
      before: parsed.filters.before,
      clinicId: parsed.filters.clinicId,
    },
  };
}

function clientSemantics(text: string): GlobalSearchSemantics | null {
  return parseGlobalSearchQuery(text, { surface: "admin" }).semantics;
}

function filters(partial: Partial<GlobalSearchFilters> = {}): GlobalSearchFilters {
  return { ...EMPTY_GLOBAL_SEARCH_FILTERS, ...partial };
}

const corpus: readonly string[] = [
  // words, phrases, OR, title (phase 2)
  "luna",
  "luna perez",
  "812",
  "#812",
  "luna #812",
  '"luna perez"',
  '"812"',
  "luna OR rex",
  "luna perez OR rex",
  "OR luna",
  "luna OR",
  "luna OR OR rex",
  "a OR b OR c OR d",
  "a OR b OR c OR d OR e",
  "title:luna",
  'title:"luna perez"',
  "title:812",
  "title:",
  'title:"',
  '"luna',
  "luna perez rex",
  "1 2 3 4 5 6 7 8",
  "1 2 3 4 5 6 7 8 9",
  "-luna",
  "10:30",
  "luna 10:30",
  "a:b",
  // type
  "type:informe",
  "TYPE:Informe",
  "type:informes type:tokens",
  "type:token luna",
  "luna type:seguimiento",
  "type:clinica type:usuario",
  "type:",
  "type:zzz",
  'type:"informe"',
  '"type:informe"',
  // filters (A1, A5)
  "status:ready",
  "estado:READY",
  "status:delivered luna",
  "luna status:uploaded",
  "status:xyz",
  "status:ready status:ready",
  "status:ready estado:ready",
  "status:ready status:delivered",
  "study:histopatologia",
  "estudio:Citología",
  "study:a",
  "study:cito1",
  "after:2026-01-01",
  "before:2026-12-31",
  "after:2026-01-01 before:2026-12-31 luna",
  "after:2026-02-30",
  "after:2026-1-1",
  "after:2026-01-01 after:2026-01-02",
  "after:2026-01-01 after:2026-01-01",
  "after:",
  "clinic:12",
  "clinica:12 luna",
  "clinic:0",
  "clinic:abc",
  "clinic:1234567890",
  "clinic:12 clinic:13",
  // combinations
  "type:informe status:ready after:2026-01-01 before:2026-12-31 study:citologia clinic:3",
  "luna OR rex status:ready",
  '"luna perez" title:rex type:informe status:ready',
  // errors the server answers
  "foo:bar",
  "luna foo:bar",
  '"foo:bar"',
  "",
  "OR",
  "status:ready foo:",
];

test("parity: the client reads every corpus text exactly as the server does, errors included", () => {
  for (const text of corpus) {
    const server = serverSemantics(text);
    const client = clientSemantics(text);
    assert.deepEqual(client, server, `semantics of «${text}»`);
  }
});

test("parity: a deterministic random corpus of 6000 texts never disagrees with the server", () => {
  const vocabulary = [
    "luna",
    "perez",
    "#812",
    "812",
    "OR",
    "OR",
    '"luna perez"',
    '"a b c"',
    "title:luna",
    'title:"rex perez"',
    "type:informe",
    "type:tokens",
    "type:clinica",
    "type:",
    "type:zzz",
    "status:ready",
    "estado:DELIVERED",
    "status:xyz",
    "study:histopatologia",
    "estudio:Citología",
    "after:2026-01-01",
    "after:2026-03-01",
    "before:2026-12-31",
    "after:2026-02-30",
    "clinic:12",
    "clinica:7",
    "clinic:0",
    "foo:bar",
    "10:30",
    "-term",
    "x",
  ];
  let seed = 20261111;
  const next = (max: number) => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed % max;
  };
  let valid = 0;
  for (let sample = 0; sample < 6000; sample += 1) {
    const length = 1 + next(8);
    const text = Array.from({ length }, () => vocabulary[next(vocabulary.length)]).join(" ");
    const server = serverSemantics(text);
    const client = clientSemantics(text);
    assert.deepEqual(client, server, `semantics of «${text}»`);
    if (server !== null) valid += 1;

    // The canonical text the client composes means the same to the server, and an
    // invalid text never becomes valid (nor the other way round).
    const composed = resolveGlobalSearchQuery("admin", text, EMPTY_GLOBAL_SEARCH_FILTERS).text;
    const recomposed = serverSemantics(composed);
    assert.equal(recomposed === null, server === null, `validity survives composing «${text}» → «${composed}»`);
    if (server !== null) assert.deepEqual(recomposed, server, `meaning survives composing «${text}» → «${composed}»`);
  }
  assert.ok(valid > 500 && valid < 5800, `the corpus exercises both outcomes (${valid} valid of 6000)`);
});

test("composing is deterministic, idempotent and keeps the filters in a fixed order", () => {
  const first = resolveGlobalSearchQuery("admin", "luna estado:READY after:2026-01-01 clinic:12 study:Citología", EMPTY_GLOBAL_SEARCH_FILTERS);
  assert.equal(first.text, "luna status:ready study:citologia after:2026-01-01 clinic:12");
  assert.equal(first.words, "luna");
  const again = resolveGlobalSearchQuery("admin", first.text, EMPTY_GLOBAL_SEARCH_FILTERS);
  assert.equal(again.text, first.text, "composing the canonical text changes nothing");
  assert.deepEqual(again.filters, first.filters);

  // The same words and filters, whatever the order they were typed or applied in.
  const applied = resolveGlobalSearchQuery("admin", "luna", filters({ status: "ready", studyType: "citologia", from: "2026-01-01", clinicId: "12" }));
  assert.equal(applied.text, first.text);
});

test("typed operators replace only their own field over the applied filters (A2)", () => {
  const applied = filters({ status: "ready", studyType: "citologia", from: "2026-01-01", kinds: ["report"] });
  const resolved = resolveGlobalSearchQuery("clinic", "rex status:delivered", applied);
  assert.equal(resolved.filters.status, "delivered", "the typed operator wins its field");
  assert.equal(resolved.filters.studyType, "citologia", "the others stay");
  assert.equal(resolved.filters.from, "2026-01-01");
  assert.deepEqual(resolved.filters.kinds, ["report"]);
  assert.equal(resolved.text, "rex status:delivered study:citologia after:2026-01-01");

  // Folding makes the typed operator a chip and leaves the words.
  const folded = foldTypedGlobalSearchFilters("clinic", "rex status:delivered", applied);
  assert.equal(folded.query, "rex");
  assert.equal(folded.filters.status, "delivered");
  assert.equal(folded.filters.studyType, "citologia");
});

test("changing the words keeps the filters; removing a chip keeps words and the other filters", () => {
  const applied = filters({ status: "ready", from: "2026-01-01" });
  assert.equal(resolveGlobalSearchQuery("clinic", "luna", applied).text, "luna status:ready after:2026-01-01");
  assert.equal(resolveGlobalSearchQuery("clinic", "rex", applied).text, "rex status:ready after:2026-01-01");

  const chips = describeGlobalSearchFilterChips("clinic", resolveGlobalSearchQuery("clinic", "rex status:delivered", applied).filters);
  assert.deepEqual(chips.map((chip) => chip.key), ["status", "from"]);
  const folded = foldTypedGlobalSearchFilters("clinic", "rex status:delivered", applied);
  const withoutStatus = clearGlobalSearchFilter(folded.filters, "status");
  assert.equal(resolveGlobalSearchQuery("clinic", folded.query, withoutStatus).text, "rex after:2026-01-01");

  // «Borrar filtros» keeps the words (and the category).
  const cleared = { ...EMPTY_GLOBAL_SEARCH_FILTERS, kinds: folded.filters.kinds };
  assert.equal(resolveGlobalSearchQuery("clinic", folded.query, cleared).text, "rex");
});

test("a typed operator that is invalid or contradicts a typed one stays in the words for the server to answer", () => {
  const invalid = foldTypedGlobalSearchFilters("admin", "luna status:xyz after:2026-02-30", EMPTY_GLOBAL_SEARCH_FILTERS);
  assert.equal(invalid.query, "luna status:xyz after:2026-02-30");
  assert.equal(invalid.filters.status, "");
  assert.equal(invalid.filters.from, "");

  const contradictory = resolveGlobalSearchQuery("admin", "status:ready status:delivered", EMPTY_GLOBAL_SEARCH_FILTERS);
  assert.equal(serverSemantics(contradictory.text), null, "the composed text is still rejected by the server");
  assert.equal(parseGlobalSearchLanguage(contradictory.text).ok, false);
});

test("filter-only searches are searches: no words, no semantics lost", () => {
  assert.equal(hasGlobalSearchFilterOperators("clinic", "", filters({ status: "ready" })), true);
  assert.equal(hasGlobalSearchFilterOperators("clinic", "status:ready", EMPTY_GLOBAL_SEARCH_FILTERS), true);
  assert.equal(hasGlobalSearchFilterOperators("clinic", "luna", EMPTY_GLOBAL_SEARCH_FILTERS), false);
  assert.equal(hasGlobalSearchFilterOperators("clinic", "", filters({ kinds: ["report"] })), false, "a category alone is not a search");
  const resolved = resolveGlobalSearchQuery("clinic", "", filters({ from: "2026-01-01", to: "2026-12-31" }));
  assert.equal(resolved.text, "after:2026-01-01 before:2026-12-31");
  assert.notEqual(serverSemantics(resolved.text), null);
});

test("the tenant is never composed: a clinic filter exists on the admin surface only", () => {
  assert.equal(resolveGlobalSearchQuery("clinic", "luna", filters({ clinicId: "12" })).text, "luna");
  assert.equal(resolveGlobalSearchQuery("admin", "luna", filters({ clinicId: "12" })).text, "luna clinic:12");
  assert.equal(resolveGlobalSearchQuery("admin", "luna", filters({ clinicId: "1 or 1=1" })).text, "luna");
  // Typed on the clinic surface it is not lifted: it stays a literal for the server's own answer.
  const typed = foldTypedGlobalSearchFilters("clinic", "luna clinic:12", EMPTY_GLOBAL_SEARCH_FILTERS);
  assert.equal(typed.filters.clinicId, "");
  assert.equal(typed.query, "luna clinic:12");
});

test("never more than 200 characters: trailing words are dropped whole, never a filter or half a phrase", () => {
  const full = filters({ status: "delivered", studyType: "histopatologia", from: "2026-01-01", to: "2026-12-31", clinicId: "123456789" });
  const operators = "status:delivered study:histopatologia after:2026-01-01 before:2026-12-31 clinic:123456789";
  const words = Array.from({ length: 40 }, (_, index) => `palabra${index}`).join(" ");
  const resolved = resolveGlobalSearchQuery("admin", words, full);
  assert.ok(resolved.text.length <= GLOBAL_SEARCH_QUERY_MAX_LENGTH);
  assert.equal(resolved.truncated, true);
  assert.ok(resolved.text.endsWith(` ${operators}`), "every filter survives");
  assert.ok(resolved.words.length > 0 && words.startsWith(resolved.words), "the words keep their beginning");
  assert.equal(resolved.words.split(" ").every((word) => /^palabra\d+$/.test(word)), true, "no word is cut");

  const phrases = resolveGlobalSearchQuery("admin", `"${"frase larga ".repeat(14).trim()}" otra`, full);
  assert.ok(phrases.text.length <= GLOBAL_SEARCH_QUERY_MAX_LENGTH);
  assert.equal((phrases.words.match(/"/g) ?? []).length % 2, 0, "a quoted phrase is dropped whole, never left open");
  assert.equal(parseGlobalSearchLanguage(phrases.text).ok, true);

  assert.equal(resolveGlobalSearchQuery("admin", "luna", full).truncated, false);
  assert.equal(collapseGlobalSearchText("  luna \n  perez "), "luna perez");
});

test("advanced form: three text fields compose text of the same model, and read it back", () => {
  const text = composeAdvancedFreeText({ contains: "luna perez", exact: "rex perez", title: "luna" });
  assert.equal(text, 'luna perez "rex perez" title:luna');
  assert.deepEqual(parseGlobalSearchQuery(text).semantics?.clauses, [
    [
      { text: "luna", numericId: null, titleOnly: false },
      { text: "perez", numericId: null, titleOnly: false },
      { text: "rex perez", numericId: null, titleOnly: false },
      { text: "luna", numericId: null, titleOnly: true },
    ],
  ]);
  assert.deepEqual(readAdvancedFreeText(text), { contains: "luna perez", exact: "rex perez", title: "luna" });
  assert.equal(composeAdvancedFreeText({ contains: "", exact: "", title: "luna perez" }), 'title:"luna perez"');
  assert.deepEqual(readAdvancedFreeText('title:"luna perez"'), { contains: "", exact: "", title: "luna perez" });
  assert.equal(composeAdvancedFreeText(EMPTY_GLOBAL_SEARCH_ADVANCED_TEXT), "");
  assert.deepEqual(readAdvancedFreeText(""), EMPTY_GLOBAL_SEARCH_ADVANCED_TEXT);
});

test("advanced form: a word that looks like an operator is quoted, so it stays a word", () => {
  assert.equal(quoteGlobalSearchWordIfOperator("status:ready"), '"status:ready"');
  assert.equal(quoteGlobalSearchWordIfOperator("OR"), '"OR"');
  assert.equal(quoteGlobalSearchWordIfOperator("luna"), "luna");
  assert.equal(quoteGlobalSearchWordIfOperator("10:30"), "10:30");
  const text = composeAdvancedFreeText({ contains: "status:ready OR luna", exact: 'a "b" c', title: "" });
  assert.equal(text, '"status:ready" "OR" luna "a b c"');
  const semantics = serverSemantics(text);
  assert.notEqual(semantics, null, "the server reads it as words");
  assert.equal(semantics?.filters.status, null, "no filter was smuggled in by a word");
  assert.deepEqual(semantics?.clauses.map((clause) => clause.length), [4], "one clause: no OR alternative either");
});

test("advanced form: a query it cannot express is never overwritten", () => {
  for (const words of [
    "luna OR rex",
    '"uno" "dos"',
    "title:a title:b",
    "type:informe luna",
    "foo:bar",
    "status:xyz",
  ]) {
    assert.equal(readAdvancedFreeText(words), null, words);
  }
  // Lifted filters are not words: a query made only of them is expressible (empty fields).
  const folded = foldTypedGlobalSearchFilters("clinic", "status:ready", EMPTY_GLOBAL_SEARCH_FILTERS);
  assert.deepEqual(readAdvancedFreeText(folded.query), EMPTY_GLOBAL_SEARCH_ADVANCED_TEXT);
});

test("the model has no I/O: nothing it exports reaches the browser, the network or storage", () => {
  const body = Object.values(queryModel)
    .filter((value) => typeof value === "function")
    .map(String)
    .join("\n");
  for (const forbidden of ["fetch(", "window", "document", "localStorage", "sessionStorage", "router", "console.", "require("]) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
});
