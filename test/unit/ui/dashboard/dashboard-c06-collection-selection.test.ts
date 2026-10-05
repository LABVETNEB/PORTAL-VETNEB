import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { runModule } from "../admin/source-function-runner.ts";
import { parseTsx } from "./dashboard-source-oracle.ts";

// C06 · useCollectionSelection runs as written against a slot-based React stub:
// useState/useMemo/useCallback keep per-render slots, compare deps with
// Object.is and re-render only when a setter changes the state reference, so
// idempotence and callback identity are observable, not assumed.

const OWNER_PATH = "frontend/src/features/dashboard/presentation/surfaces/useCollectionSelection.ts";

type Id = string | number;
type Selection = {
  selectedIds: readonly Id[];
  selectedCount: number;
  isSelected: (id: Id) => boolean;
  select: (id: Id) => void;
  deselect: (id: Id) => void;
  toggle: (id: Id) => void;
  selectVisiblePage: () => void;
  toggleVisiblePage: () => void;
  clearSelection: () => void;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
};
type UseSelection = (options: { visibleIds: readonly Id[] }) => Selection;

function createReactStub() {
  const slots: unknown[] = [];
  const setters: ((update: unknown) => void)[] = [];
  let cursor = 0;
  let dirty = false;
  const sameDeps = (a: readonly unknown[], b: readonly unknown[]) =>
    a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

  const React = {
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      setters[index] ??= (update: unknown) => {
        const previous = slots[index];
        const next = typeof update === "function" ? (update as (value: unknown) => unknown)(previous) : update;
        if (!Object.is(previous, next)) {
          slots[index] = next;
          dirty = true;
        }
      };
      return [slots[index], setters[index]];
    },
    useMemo(factory: () => unknown, deps: readonly unknown[]) {
      const index = cursor++;
      const slot = slots[index] as { deps: readonly unknown[]; value: unknown } | undefined;
      if (slot && sameDeps(slot.deps, deps)) return slot.value;
      const value = factory();
      slots[index] = { deps, value };
      return value;
    },
    useCallback(callback: unknown, deps: readonly unknown[]) {
      return React.useMemo(() => callback, deps);
    },
  };

  return {
    React,
    render<T>(hook: () => T): T {
      cursor = 0;
      dirty = false;
      return hook();
    },
    takeDirty() {
      const was = dirty;
      dirty = false;
      return was;
    },
  };
}

function loadHook(source = read(OWNER_PATH)) {
  return (stub: ReturnType<typeof createReactStub>) =>
    runModule(parseTsx(source, OWNER_PATH), { react: stub.React }).useCollectionSelection as UseSelection;
}

function mount(visibleIds: readonly Id[], source?: string) {
  const stub = createReactStub();
  const useCollectionSelection = loadHook(source)(stub);
  let props = { visibleIds };
  let renders = 0;
  const render = () => {
    renders += 1;
    return stub.render(() => useCollectionSelection(props));
  };
  let current = render();
  return {
    get current() {
      return current;
    },
    get renders() {
      return renders;
    },
    selected: () => [...current.selectedIds],
    act(action: (selection: Selection) => void) {
      action(current);
      if (stub.takeDirty()) current = render();
    },
    rerender(nextVisibleIds: readonly Id[]) {
      props = { visibleIds: nextVisibleIds };
      current = render();
    },
  };
}

const PAGE_1 = [101, 102, 103] as const;
const PAGE_2 = [104, 105, 106] as const;

test("C06 · starts empty and selects, deselects and toggles single items by ID", () => {
  const view = mount(PAGE_1);
  assert.deepEqual(view.selected(), []);
  assert.equal(view.current.selectedCount, 0);
  assert.equal(view.current.allVisibleSelected, false);
  assert.equal(view.current.someVisibleSelected, false);

  view.act((selection) => selection.select(102));
  assert.deepEqual(view.selected(), [102]);
  assert.equal(view.current.isSelected(102), true);
  assert.equal(view.current.isSelected(101), false);

  view.act((selection) => selection.deselect(102));
  assert.deepEqual(view.selected(), []);

  view.act((selection) => selection.toggle(103));
  assert.deepEqual(view.selected(), [103]);
  view.act((selection) => selection.toggle(103));
  assert.deepEqual(view.selected(), []);
});

test("C06 · keeps several items selected and leaves the others untouched", () => {
  const view = mount(PAGE_1);
  view.act((selection) => selection.toggle(101));
  view.act((selection) => selection.toggle(103));
  assert.deepEqual(view.selected(), [101, 103], "selection order is kept, not sorted");
  assert.equal(view.current.selectedCount, 2);
  view.act((selection) => selection.toggle(101));
  assert.deepEqual(view.selected(), [103], "deselecting one keeps the other");
});

test("C06 · repeated select and deselect are idempotent and do not re-render", () => {
  const view = mount(PAGE_1);
  view.act((selection) => selection.select(101));
  const afterSelect = view.renders;
  view.act((selection) => selection.select(101));
  assert.equal(view.renders, afterSelect, "a duplicate select keeps the same state");
  assert.deepEqual(view.selected(), [101]);

  view.act((selection) => selection.deselect(101));
  const afterDeselect = view.renders;
  view.act((selection) => selection.deselect(101));
  view.act((selection) => selection.deselect(999));
  assert.equal(view.renders, afterDeselect, "a duplicate or unknown deselect keeps the same state");
  view.act((selection) => selection.clearSelection());
  assert.equal(view.renders, afterDeselect, "clearing an empty selection keeps the same state");
});

test("C06 · page selection covers exactly the visible IDs with partial and full flags", () => {
  const view = mount(PAGE_1);
  view.act((selection) => selection.select(102));
  assert.equal(view.current.allVisibleSelected, false);
  assert.equal(view.current.someVisibleSelected, true, "partial page is the indeterminate state");

  view.act((selection) => selection.selectVisiblePage());
  assert.deepEqual(view.selected(), [102, 101, 103]);
  assert.equal(view.current.allVisibleSelected, true);
  assert.equal(view.current.someVisibleSelected, false);
  for (const id of PAGE_2) assert.equal(view.current.isSelected(id), false, `${id} is not on the page`);
});

test("C06 · toggling the page selects the rest from partial and deselects only the visible IDs from full", () => {
  const view = mount(PAGE_2);
  view.act((selection) => selection.select(104));
  view.rerender(PAGE_1);
  view.act((selection) => selection.select(101));
  view.act((selection) => selection.toggleVisiblePage());
  assert.deepEqual(view.selected(), [104, 101, 102, 103]);
  assert.equal(view.current.allVisibleSelected, true);

  view.act((selection) => selection.toggleVisiblePage());
  assert.deepEqual(view.selected(), [104], "the off-page selection survives a page toggle");
  assert.equal(view.current.allVisibleSelected, false);
  assert.equal(view.current.someVisibleSelected, false);
});

test("C06 · clearSelection empties every selection, on and off the page", () => {
  const view = mount(PAGE_1);
  view.act((selection) => selection.selectVisiblePage());
  view.rerender(PAGE_2);
  view.act((selection) => selection.select(105));
  view.act((selection) => selection.clearSelection());
  assert.deepEqual(view.selected(), []);
  assert.equal(view.current.selectedCount, 0);
  view.rerender(PAGE_1);
  assert.equal(view.current.someVisibleSelected, false);
  assert.equal(view.current.allVisibleSelected, false);
});

test("C06 · identity is the ID: reordering or repaging never reassigns a selection", () => {
  const view = mount(PAGE_1);
  view.act((selection) => selection.select(101));
  view.rerender([103, 102, 101]);
  assert.equal(view.current.isSelected(101), true);
  assert.equal(view.current.isSelected(103), false, "the item now in the first position is not selected");

  view.rerender(PAGE_2);
  assert.deepEqual(view.selected(), [101], "a page change keeps the previous selection");
  assert.equal(view.current.someVisibleSelected, false, "page flags read only the new visible IDs");
  assert.equal(view.current.allVisibleSelected, false);

  view.rerender(PAGE_1);
  assert.equal(view.current.isSelected(101), true, "returning to the page shows the same selection");
  assert.equal(view.current.someVisibleSelected, true);

  view.rerender([102, 103]);
  assert.deepEqual(view.selected(), [101], "an ID leaving the dataset stays selected until cleared");
  assert.equal(view.current.someVisibleSelected, false);
});

test("C06 · an empty page is never selected and page operations on it are no-ops", () => {
  const view = mount([]);
  assert.equal(view.current.allVisibleSelected, false);
  assert.equal(view.current.someVisibleSelected, false);
  const before = view.renders;
  view.act((selection) => selection.selectVisiblePage());
  view.act((selection) => selection.toggleVisiblePage());
  assert.equal(view.renders, before);
  assert.deepEqual(view.selected(), []);
});

test("C06 · duplicate visible IDs count once and string IDs are kept verbatim", () => {
  const view = mount(["a", "b", "a"]);
  view.act((selection) => selection.select("a"));
  assert.equal(view.current.someVisibleSelected, true);
  view.act((selection) => selection.select("b"));
  assert.equal(view.current.allVisibleSelected, true, "a repeated visible ID does not need two selections");
  view.act((selection) => selection.toggleVisiblePage());
  assert.deepEqual(view.selected(), []);

  const mixed = mount(["1", 1]);
  mixed.act((selection) => selection.select(1));
  assert.equal(mixed.current.isSelected("1"), false, "IDs are not coerced across types");
});

test("C06 · inputs are not mutated and the exposed list is a copy", () => {
  const visible = Object.freeze([101, 102, 103]);
  const view = mount(visible);
  view.act((selection) => selection.selectVisiblePage());
  view.act((selection) => selection.toggleVisiblePage());
  view.act((selection) => selection.select(102));
  assert.deepEqual([...visible], [101, 102, 103]);

  (view.current.selectedIds as Id[]).push(999);
  assert.equal(view.current.isSelected(999), false);
  assert.equal(view.current.selectedCount, 1);
});

test("C06 · item actions keep their identity; page actions follow the visible IDs", () => {
  const view = mount(PAGE_1);
  const first = view.current;
  view.act((selection) => selection.select(101));
  for (const action of ["select", "deselect", "toggle", "clearSelection"] as const) {
    assert.equal(view.current[action], first[action], `${action} is stable across renders`);
  }
  assert.equal(view.current.selectVisiblePage, first.selectVisiblePage, "same visible IDs, same page action");

  view.rerender(PAGE_2);
  assert.notEqual(view.current.selectVisiblePage, first.selectVisiblePage, "a new page binds a new page action");
  const settled = view.current;
  view.rerender(PAGE_2);
  assert.equal(view.current, settled, "an unchanged render returns the same selection object");
});

type ContractFlags = Record<
  | "toggleAdds"
  | "toggleRemoves"
  | "clearEmpties"
  | "partialIsNotAll"
  | "partialIsIndeterminate"
  | "pageKeepsOffPage"
  | "pageToggleKeepsOffPage",
  boolean
>;

function contractFlags(source: string): ContractFlags {
  const toggle = mount(PAGE_1, source);
  toggle.act((selection) => selection.toggle(101));
  const toggleAdds = toggle.current.isSelected(101);
  toggle.act((selection) => selection.toggle(101));
  const toggleRemoves = !toggle.current.isSelected(101);

  const clear = mount(PAGE_1, source);
  clear.act((selection) => selection.select(101));
  clear.act((selection) => selection.clearSelection());

  const partial = mount(PAGE_1, source);
  partial.act((selection) => selection.select(101));
  partial.act((selection) => selection.select(102));

  const page = mount(PAGE_2, source);
  page.act((selection) => selection.select(104));
  page.rerender(PAGE_1);
  page.act((selection) => selection.selectVisiblePage());
  const pageKeepsOffPage = page.current.isSelected(104) && page.current.allVisibleSelected;
  page.act((selection) => selection.toggleVisiblePage());

  return {
    toggleAdds,
    toggleRemoves,
    clearEmpties: clear.current.selectedCount === 0,
    partialIsNotAll: !partial.current.allVisibleSelected,
    partialIsIndeterminate: partial.current.someVisibleSelected,
    pageKeepsOffPage,
    pageToggleKeepsOffPage: page.current.isSelected(104) && !page.current.isSelected(101),
  };
}

test("C06 · in-memory mutations of the owner each break their contract flag", () => {
  const source = read(OWNER_PATH);
  const intact = contractFlags(source);
  assert.ok(Object.values(intact).every(Boolean), JSON.stringify(intact));

  const mutations: [keyof ContractFlags, string, string][] = [
    ["toggleRemoves", "(current.has(id) ? withoutIds(current, [id]) : withIds(current, [id]))", "withIds(current, [id])"],
    ["toggleAdds", "(current.has(id) ? withoutIds(current, [id]) : withIds(current, [id]))", "withoutIds(current, [id])"],
    ["clearEmpties", "(current.size === 0 ? current : new Set<Id>())", "current"],
    ["partialIsNotAll", "selectedVisible === visible.size", "selectedVisible >= visible.size - 1"],
    ["partialIsIndeterminate", "someVisibleSelected: selectedVisible > 0 && !allVisibleSelected", "someVisibleSelected: false"],
    ["pageKeepsOffPage", "() => setSelection((current) => withIds(current, visibleIds)),", "() => setSelection(() => new Set(visibleIds)),"],
    ["pageToggleKeepsOffPage", "containsAll(current, visibleIds) ? withoutIds(current, visibleIds)", "containsAll(current, visibleIds) ? new Set<Id>()"],
  ];
  for (const [flag, anchor, replacement] of mutations) {
    assert.equal(source.split(anchor).length, 2, `${flag}: the mutation anchor must be unique`);
    const flags = contractFlags(source.replace(anchor, () => replacement));
    assert.equal(flags[flag], false, `${flag}: the mutated owner must break its contract`);
  }
});

// ── C07 · SelectionToolbar on the C06 owner ──────────────────────────────────
// The toolbar module runs as written against a createElement-recording stub and
// is fed by the real hook above, so the swap, the counter and clearing are
// observed on the one owner, not on a fake selection.

const TOOLBAR_PATH = "frontend/src/features/dashboard/presentation/surfaces/SelectionToolbar.tsx";

type ToolbarNode = { tag: string; attrs: Record<string, unknown>; children: (ToolbarNode | string)[] };
type ToolbarComponent = (props: Record<string, unknown>) => unknown;

const TOOLBAR_FRAGMENT = Symbol("Fragment");
const TOOLBAR_REACT = {
  Fragment: TOOLBAR_FRAGMENT,
  createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => ({
    type,
    props: { ...props, children },
  }),
};
const TOOLBAR_IMPORTS = {
  "lucide-react": { X: (props: Record<string, unknown>) => TOOLBAR_REACT.createElement("svg", { ...props, "data-icon": "x" }) },
  "@/components/ui/button": {
    Button: ({ children, ...props }: Record<string, unknown>) => TOOLBAR_REACT.createElement("button", props, children),
  },
};
const DEFAULT_TOOLBAR = TOOLBAR_REACT.createElement("div", { "data-default-toolbar": "true" }, "Todos los eventos");

function loadToolbar(source = read(TOOLBAR_PATH)): ToolbarComponent {
  return runModule(parseTsx(source, TOOLBAR_PATH), TOOLBAR_IMPORTS, { React: TOOLBAR_REACT })
    .SelectionToolbar as ToolbarComponent;
}

function expandToolbar(node: unknown): (ToolbarNode | string)[] {
  if (Array.isArray(node)) return node.flatMap((entry) => expandToolbar(entry));
  if (node === null || node === undefined || node === false || node === "") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  const { type, props } = node as { type: unknown; props: Record<string, unknown> };
  if (type === TOOLBAR_FRAGMENT) return expandToolbar(props.children);
  if (typeof type === "function") return expandToolbar((type as ToolbarComponent)(props));
  const { children, ...attrs } = props;
  return [{ tag: String(type), attrs, children: expandToolbar(children) }];
}

function toolbarText(node: ToolbarNode | string): string {
  return typeof node === "string" ? node : node.children.map(toolbarText).join("");
}

function renderToolbar(SelectionToolbar: ToolbarComponent, selectedCount: number, onClearSelection: () => void) {
  const nodes = expandToolbar(SelectionToolbar({ selectedCount, onClearSelection, children: DEFAULT_TOOLBAR }));
  assert.equal(nodes.length, 1, "the toolbar slot renders exactly one root");
  const root = nodes[0] as ToolbarNode;
  const button = root.children.find((child): child is ToolbarNode => typeof child !== "string" && child.tag === "button");
  return { root, isDefault: root.attrs["data-default-toolbar"] === "true", text: toolbarText(root), button };
}

// The clear control focuses the page selector of its own collection (its `section`).
function clickEvent(log: string[]) {
  return {
    currentTarget: {
      closest: (selector: string) => {
        log.push(`closest ${selector}`);
        return {
          querySelector: (query: string) => {
            log.push(`query ${query}`);
            return { focus: () => log.push("focus") };
          },
        };
      },
    },
  };
}

test("C07 · DefaultToolbar ⇄ SelectionToolbar follows selectedCount on the one C06 owner", () => {
  const SelectionToolbar = loadToolbar();
  const view = mount(PAGE_1);
  const log: string[] = [];
  const onClear = () => {
    log.push("clear");
    view.current.clearSelection();
  };
  const show = () => renderToolbar(SelectionToolbar, view.current.selectedCount, onClear);

  const idle = show();
  assert.equal(idle.isDefault, true, "0 selected → DefaultToolbar, rendered as given");
  assert.equal(idle.text, "Todos los eventos");

  view.act((selection) => selection.select(102));
  const one = show();
  assert.equal(one.isDefault, false, "1 selected → SelectionToolbar takes the slot");
  assert.deepEqual(
    { tag: one.root.tag, role: one.root.attrs.role, label: one.root.attrs["aria-label"], marker: one.root.attrs["data-selection-toolbar"] },
    { tag: "div", role: "group", label: "Selección", marker: "true" },
  );
  assert.equal(one.text.startsWith("1 seleccionado"), true);
  assert.equal(one.text.includes("1 seleccionados"), false);
  assert.deepEqual(
    { type: one.button?.attrs.type, label: one.button?.attrs["aria-label"], text: one.button && toolbarText(one.button) },
    { type: "button", label: "Limpiar selección", text: "Limpiar" },
  );
  const counter = one.root.children[0] as ToolbarNode;
  assert.equal(counter.attrs["aria-live"], "polite", "the count is announced politely");

  view.act((selection) => selection.select(101));
  view.act((selection) => selection.select(103));
  assert.equal(show().text.startsWith("3 seleccionados"), true, "several selected → exact count");

  // Paging keeps the selection by ID, so the toolbar stays while the count is > 0.
  view.rerender(PAGE_2);
  assert.equal(show().text.startsWith("3 seleccionados"), true);
  view.act((selection) => selection.select(104));
  const crossPage = show();
  assert.equal(crossPage.text.startsWith("4 seleccionados"), true);

  view.act(() => (crossPage.button!.attrs.onClick as (event: unknown) => void)(clickEvent(log)));
  assert.equal(view.current.selectedCount, 0, "clearing empties the whole owner, on and off the page");
  assert.deepEqual([...view.current.selectedIds], []);
  view.rerender(PAGE_1);
  assert.equal(view.current.allVisibleSelected || view.current.someVisibleSelected, false);
  assert.equal(show().isDefault, true, "cleared → back to DefaultToolbar");
  assert.deepEqual(log, ["closest section", "clear", 'query [data-collection-selection="page"]:not(:disabled)', "focus"],
    "focus moves to the page selector after the owner is cleared");
});

test("C07 · clearing without a page selector in reach still clears and never throws", () => {
  const SelectionToolbar = loadToolbar();
  let cleared = 0;
  const { button } = renderToolbar(SelectionToolbar, 2, () => (cleared += 1));
  (button!.attrs.onClick as (event: unknown) => void)({ currentTarget: { closest: () => null } });
  assert.equal(cleared, 1);
});

type ToolbarFlags = {
  defaultAtZero: boolean;
  selectionAtOne: boolean;
  countFollowsSelectedCount: boolean;
  clearCallsOwner: boolean;
  focusAfterClear: boolean;
};

function toolbarFlags(source: string): ToolbarFlags {
  const SelectionToolbar = loadToolbar(source);
  const noop = () => {};
  const log: string[] = [];
  const seven = renderToolbar(SelectionToolbar, 7, () => log.push("clear"));
  if (seven.button) (seven.button.attrs.onClick as (event: unknown) => void)(clickEvent(log));
  return {
    defaultAtZero: renderToolbar(SelectionToolbar, 0, noop).isDefault,
    selectionAtOne: !renderToolbar(SelectionToolbar, 1, noop).isDefault,
    countFollowsSelectedCount:
      seven.text.startsWith("7 seleccionados") && renderToolbar(SelectionToolbar, 1, noop).text.startsWith("1 seleccionado"),
    clearCallsOwner: log.includes("clear"),
    focusAfterClear: log.includes("clear") && log.indexOf("focus") > log.indexOf("clear"),
  };
}

test("C07 · in-memory mutations of the toolbar each break their contract flag", () => {
  const source = read(TOOLBAR_PATH);
  const intact = toolbarFlags(source);
  assert.ok(Object.values(intact).every(Boolean), JSON.stringify(intact));

  const swap = "if (selectedCount === 0) return <>{children}</>;";
  const mutations: [keyof ToolbarFlags, string, string][] = [
    ["defaultAtZero", swap, "if (selectedCount !== 0) return <>{children}</>;"],
    ["selectionAtOne", swap, "if (selectedCount !== 0) return <>{children}</>;"],
    ["defaultAtZero", swap, ""],
    ["countFollowsSelectedCount", "`${selectedCount} seleccionados`", "`1 seleccionados`"],
    ["clearCallsOwner", "    onClearSelection();\n", ""],
    ["focusAfterClear", "?.focus();", "?.blur?.();"],
  ];
  for (const [flag, anchor, replacement] of mutations) {
    assert.equal(source.split(anchor).length, 2, `${flag}: the mutation anchor must be unique`);
    const flags = toolbarFlags(source.replace(anchor, () => replacement));
    assert.equal(flags[flag], false, `${flag}: the mutated toolbar must break its contract`);
  }
});
