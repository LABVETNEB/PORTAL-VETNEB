import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { runModule } from "../admin/source-function-runner.ts";
import {
  assertPlainProps,
  effectiveAttribute,
  elementText,
  type JsxNode,
  parseTsx,
  renderedUnder,
  type SourceFunction,
  staticAttribute,
  unwrap,
} from "./dashboard-source-oracle.ts";

const LOADING_STATE_PATH = "frontend/src/components/dashboard/LoadingState.tsx";
const EMPTY_STATE_PATH = "frontend/src/components/dashboard/EmptyState.tsx";
const ERROR_STATE_PATH = "frontend/src/components/dashboard/ErrorState.tsx";
// C03: EmptyState.tsx hosts CollectionState, the single owner of the three states;
// ErrorState.tsx and LoadingState.tsx are thin adapters over it.
const COLLECTION_STATE_PATH = EMPTY_STATE_PATH;

function ownerRenderer(source: string, name: string): SourceFunction {
  const matches = parseTsx(source, COLLECTION_STATE_PATH).statements.filter(
    (statement): statement is SourceFunction =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name && statement.body !== undefined,
  );
  assert.equal(matches.length, 1, `${name}: expected one declaration in the CollectionState owner`);
  return matches[0];
}

// TEST-GLOBAL-07 (G06-D17): the root announces role="alert" on every render and
// "Reintentar", wired to `onRetry`, renders exactly when a callback is given.
// `.includes("onRetry ? (")` also matches the inverted `!onRetry ? (`
// (C.15.1 M-D12).
function retryRendering(source: string) {
  const component = ownerRenderer(source, "renderErrorState");
  const wiresRetry = (element: JsxNode) => {
    const onClick = effectiveAttribute(element, "onClick");
    return onClick.kind === "value" && unwrap(onClick.expression).getText() === "onRetry";
  };

  assertPlainProps(component, ["onRetry"]);

  const withCallback = renderedUnder(component, new Map([["onRetry", true]]));
  const withoutCallback = renderedUnder(component, new Map([["onRetry", false]]));
  return {
    alertRoot: [withCallback, withoutCallback].every((rendered) =>
      rendered.some((r) => r.must && staticAttribute(r.element, "role") === "alert"),
    ),
    retryWithCallback: withCallback.some(
      (r) => r.must && wiresRetry(r.element) && elementText(r.element) === "Reintentar",
    ),
    retryWithoutCallback: withoutCallback.some(
      (r) => wiresRetry(r.element) || elementText(r.element).includes("Reintentar"),
    ),
  };
}

// ── LoadingState ────────────────────────────────────────────────────────────

test("loading state has role=status and aria-live=polite for accessible announcement", () => {
  const source = read(COLLECTION_STATE_PATH);

  assert.ok(source.includes('role="status"'));
  assert.ok(source.includes('aria-live="polite"'));
});

test("loading state has sr-only accessible loading text", () => {
  const source = read(COLLECTION_STATE_PATH);

  assert.ok(source.includes('className="sr-only"'));
  assert.ok(source.includes("Cargando..."));
});

test("loading state maintains all five variants and skeleton usage", () => {
  const adapter = read(LOADING_STATE_PATH);
  const source = read(COLLECTION_STATE_PATH);

  assert.ok(adapter.includes("variant?: CollectionStateSkeleton;"));
  assert.ok(source.includes('export type CollectionStateSkeleton = "table" | "cards" | "detail" | "timeline" | "list";'));
  assert.ok(source.includes('if (skeleton === "table")'));
  assert.ok(source.includes('if (skeleton === "detail")'));
  assert.ok(source.includes('if (skeleton === "timeline")'));
  assert.ok(source.includes('if (skeleton === "list")'));
  assert.ok(source.includes('import { Skeleton } from "@/components/ui/skeleton";'));
  assert.ok(source.includes('aria-busy="true"'));
  assert.ok(source.includes("getRows(rows)"));
});

test("loading state supports optional label and compact props without breaking existing api", () => {
  const adapter = read(LOADING_STATE_PATH);
  const source = read(COLLECTION_STATE_PATH);

  assert.ok(adapter.includes('Omit<CollectionStateLoadingProps, "skeleton">'));
  assert.ok(source.includes("label?: string;"));
  assert.ok(source.includes("compact?: boolean;"));
  assert.ok(source.includes('skeleton = "cards"'));
  assert.ok(source.includes("rows?: number;"));
  assert.ok(source.includes("className?: string;"));
});

test("loading state does not render a fullscreen spinner", () => {
  const source = read(LOADING_STATE_PATH) + read(COLLECTION_STATE_PATH);

  assert.equal(
    source.includes("fixed inset-0"),
    false,
    "loading state must not use fullscreen overlay",
  );
  assert.equal(
    source.includes("animate-spin"),
    false,
    "loading state must not use spinner animation",
  );
});

// ── EmptyState ──────────────────────────────────────────────────────────────

test("empty state retains full existing api surface", () => {
  const source = read(EMPTY_STATE_PATH);

  assert.match(source, /import \{[^}]*\bInbox,[^}]*\btype LucideIcon,[^}]*\} from "lucide-react";/);
  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("description?: string;"));
  assert.ok(source.includes("action?: ReactNode;"));
  assert.ok(source.includes("icon?: LucideIcon;"));
  assert.ok(source.includes("icon: Icon = Inbox"));
  assert.ok(source.includes("{title}"));
  assert.ok(source.includes("{description}"));
  assert.ok(source.includes("{action}"));
  assert.ok(source.includes('aria-hidden="true"'));
});

test("empty state supports optional eyebrow prop for contextual labeling", () => {
  const source = read(EMPTY_STATE_PATH);

  assert.ok(source.includes("eyebrow?: string;"));
  assert.ok(source.includes("{eyebrow}"));
});

test("empty state supports optional secondaryAction prop for dual call-to-action", () => {
  const source = read(EMPTY_STATE_PATH);

  assert.ok(source.includes("secondaryAction?: ReactNode;"));
  assert.ok(source.includes("{secondaryAction}"));
});

test("empty state supports size prop for compact usage inside tables (PR-3)", () => {
  const source = read(EMPTY_STATE_PATH);

  assert.ok(source.includes('size?: "sm" | "md";'));
  assert.ok(source.includes('size = "md"'));
  assert.ok(source.includes("isSm"));
});

test("empty state icon wrapper and icon element are both aria-hidden", () => {
  const source = read(EMPTY_STATE_PATH);

  const hiddenCount = (source.match(/aria-hidden="true"/g) ?? []).length;

  assert.ok(
    hiddenCount >= 2,
    `empty state must have aria-hidden on both icon container and icon element, found ${hiddenCount}`,
  );
});

// ── ErrorState ──────────────────────────────────────────────────────────────

test("error state retains full existing api and role=alert", () => {
  const adapter = read(ERROR_STATE_PATH);
  const source = read(COLLECTION_STATE_PATH);

  assert.ok(adapter.includes('"use client";'));
  assert.ok(adapter.includes("export type ErrorStateProps = CollectionStateErrorProps;"));
  assert.ok(source.includes("message: string;"));
  assert.ok(source.includes("onRetry?: () => void;"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("{message}"));
  assert.ok(source.includes("onRetry ? ("));
  assert.ok(source.includes("onClick={onRetry}"));
  assert.ok(source.includes("Reintentar"));
  assert.equal(source.includes("Error desconocido"), false);
  assert.deepEqual(retryRendering(source), {
    alertRoot: true,
    retryWithCallback: true,
    retryWithoutCallback: false,
  });

  const inverted = source.replace("{onRetry ? (", () => "{!onRetry ? (");
  assert.notEqual(inverted, source);
  assert.deepEqual(retryRendering(inverted), {
    alertRoot: true,
    retryWithCallback: false,
    retryWithoutCallback: true,
  });
});

test("error state retry button has type=button attribute", () => {
  const source = read(COLLECTION_STATE_PATH);

  assert.ok(source.includes('type="button"'));
});

test("error state supports optional tone prop for warning and critical severity", () => {
  const source = read(COLLECTION_STATE_PATH);

  assert.ok(source.includes('tone?: "warning" | "critical";'));
  assert.ok(source.includes('tone = "critical"'));
  assert.ok(source.includes("isWarning"));
});

test("error state supports optional supportText prop for contextual guidance", () => {
  const source = read(COLLECTION_STATE_PATH);

  assert.ok(source.includes("supportText?: string;"));
  assert.ok(source.includes("{supportText}"));
});

test("error state retry button has explicit focus-visible ring", () => {
  const source = read(COLLECTION_STATE_PATH);

  assert.ok(source.includes("focus-visible:ring-2"));
});

test("error state does not expose stack traces or internal error details", () => {
  const source = read(ERROR_STATE_PATH) + read(COLLECTION_STATE_PATH);

  assert.equal(source.includes(".stack"), false, "error state must not expose .stack");
  assert.equal(source.includes("Error desconocido"), false);
});

// ── Scope contracts ─────────────────────────────────────────────────────────

test("state components do not import api auth or backend modules", () => {
  const paths = [LOADING_STATE_PATH, EMPTY_STATE_PATH, ERROR_STATE_PATH];

  for (const path of paths) {
    const source = read(path);

    assert.equal(
      source.includes('from "@/lib/api"'),
      false,
      `${path} must not import api module`,
    );
    assert.equal(
      source.includes('from "@/lib/auth"'),
      false,
      `${path} must not import auth module`,
    );
    assert.equal(
      source.includes("cookies("),
      false,
      `${path} must not use cookies()`,
    );
    assert.equal(
      source.includes('"/api'),
      false,
      `${path} must not embed /api literals`,
    );
  }
});

test("state components do not use next/link or anchor tags for navigation", () => {
  const paths = [LOADING_STATE_PATH, EMPTY_STATE_PATH, ERROR_STATE_PATH];

  for (const path of paths) {
    const source = read(path);

    assert.equal(
      source.includes('from "next/link"'),
      false,
      `${path} must not import next/link`,
    );
  }
});

test("loading state empty state and error state do not touch package deps or tsconfig", () => {
  const paths = [LOADING_STATE_PATH, EMPTY_STATE_PATH, ERROR_STATE_PATH];

  for (const path of paths) {
    const source = read(path);

    assert.equal(source.includes("package.json"), false);
    assert.equal(source.includes("tsconfig"), false);
    assert.equal(source.includes("next-env"), false);
  }
});

// ── C03 · CollectionState runtime ───────────────────────────────────────────

type StateNode = {
  tag: string;
  attrs: Record<string, unknown>;
  children: (StateNode | string)[];
};
type StateComponent = (props: Record<string, unknown>) => unknown;
type StateSources = { owner: string; error: string; loading: string };

const STATE_FRAGMENT = Symbol("Fragment");
const STATE_REACT = {
  Fragment: STATE_FRAGMENT,
  createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => ({
    type,
    props: { ...props, children },
  }),
};
const stateIcon = (name: string) => (props: Record<string, unknown>) =>
  STATE_REACT.createElement("svg", { ...props, "data-icon": name });
const STATE_IMPORTS = {
  "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
  "lucide-react": {
    Inbox: stateIcon("inbox"),
    AlertCircle: stateIcon("alert-circle"),
    AlertTriangle: stateIcon("alert-triangle"),
    RefreshCw: stateIcon("refresh"),
  },
  "@/components/ui/button": {
    Button: ({ children, ...props }: Record<string, unknown>) =>
      STATE_REACT.createElement("button", props, children),
  },
  "@/components/ui/skeleton": {
    Skeleton: (props: Record<string, unknown>) =>
      STATE_REACT.createElement("div", { ...props, "data-skeleton": "true" }),
  },
};

function currentStateSources(): StateSources {
  return {
    owner: read(COLLECTION_STATE_PATH),
    error: read(ERROR_STATE_PATH),
    loading: read(LOADING_STATE_PATH),
  };
}

// Runs the owner and both adapter modules as written against a
// createElement-recording React stub. Function elements are expanded, so an
// adapter is only observable through the DOM the owner produces for it.
function loadStates(sources: StateSources) {
  const owner = runModule(parseTsx(sources.owner, COLLECTION_STATE_PATH), STATE_IMPORTS, { React: STATE_REACT });
  const viaOwner = { ...STATE_IMPORTS, "@/components/dashboard/EmptyState": owner };
  return {
    CollectionState: owner.CollectionState as StateComponent,
    EmptyState: owner.EmptyState as StateComponent,
    ErrorState: runModule(parseTsx(sources.error, ERROR_STATE_PATH), viaOwner, { React: STATE_REACT })
      .ErrorState as StateComponent,
    LoadingState: runModule(parseTsx(sources.loading, LOADING_STATE_PATH), viaOwner, { React: STATE_REACT })
      .LoadingState as StateComponent,
  };
}

const onRetry = () => {};
const CustomIcon = stateIcon("custom");
const STATE_HANDLERS = new Map<unknown, string>([[onRetry, "onRetry"]]);

function expandState(node: unknown): (StateNode | string)[] {
  if (Array.isArray(node)) {
    const out: (StateNode | string)[] = [];
    for (const child of node.flatMap((entry) => expandState(entry))) {
      const last = out.at(-1);
      if (typeof child === "string" && typeof last === "string") out[out.length - 1] = last + child;
      else out.push(child);
    }
    return out;
  }
  if (node === null || node === undefined || node === false || node === "") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  const element = node as { type: unknown; props: Record<string, unknown> };
  if (element.type === STATE_FRAGMENT) return expandState(element.props.children ?? []);
  if (typeof element.type === "function") {
    return expandState((element.type as StateComponent)(element.props));
  }
  const attrs: Record<string, unknown> = {};
  for (const key of Object.keys(element.props).sort()) {
    const value = element.props[key];
    if (key === "children" || key === "key" || value === undefined || value === null) continue;
    if (key === "className") attrs[key] = String(value).split(/\s+/).filter(Boolean).sort();
    else if (typeof value === "function") attrs[key] = STATE_HANDLERS.get(value) ?? "unknown-handler";
    else attrs[key] = value;
  }
  return [{ tag: String(element.type), attrs, children: expandState(element.props.children ?? []) }];
}

// Crosses the VM realm so structural equality compares values, not prototypes.
function renderState(component: StateComponent, props: Record<string, unknown>): StateNode {
  const [root, ...rest] = expandState(component(props));
  assert.ok(root && typeof root !== "string" && rest.length === 0, "a state renders one element root");
  return JSON.parse(JSON.stringify(root)) as StateNode;
}

function findState(node: StateNode, match: (node: StateNode) => boolean): StateNode[] {
  const nested = node.children
    .filter((child): child is StateNode => typeof child !== "string")
    .flatMap((child) => findState(child, match));
  return match(node) ? [node, ...nested] : nested;
}

function stateText(node: StateNode): string {
  return node.children.map((child) => (typeof child === "string" ? child : stateText(child))).join("");
}

function classes(node: StateNode): string[] {
  return (node.attrs.className as string[] | undefined) ?? [];
}

function elementChildren(node: StateNode): StateNode[] {
  return node.children.filter((child): child is StateNode => typeof child !== "string");
}

const STATES = loadStates(currentStateSources());
const CollectionState = STATES.CollectionState;

test("C03 · empty variant keeps the EmptyState contract without live-region semantics", () => {
  const md = renderState(CollectionState, { variant: "empty", title: "Sin clínicas", description: "No hay clínicas." });
  assert.equal(md.tag, "div");
  assert.equal(md.attrs["data-collection-state"], "empty");
  for (const attribute of ["role", "aria-live", "aria-busy"]) {
    assert.equal(md.attrs[attribute], undefined, `empty must not announce: ${attribute}`);
  }
  assert.ok(["border-dashed", "min-h-[11rem]", "px-6", "py-8"].every((name) => classes(md).includes(name)));
  const [wrapper] = elementChildren(md);
  assert.equal(wrapper.attrs["aria-hidden"], "true");
  assert.ok(classes(wrapper).includes("h-11"));
  const [defaultIcon] = elementChildren(wrapper);
  assert.deepEqual([defaultIcon.attrs["data-icon"], defaultIcon.attrs["aria-hidden"]], ["inbox", "true"]);
  assert.deepEqual(classes(defaultIcon), ["h-5", "w-5"]);
  const [heading] = findState(md, (node) => node.tag === "h2");
  assert.equal(stateText(heading), "Sin clínicas");
  assert.ok(classes(heading).includes("text-base"));
  assert.equal(findState(md, (node) => node.tag === "p" && stateText(node) === "No hay clínicas.").length, 1);
  assert.equal(elementChildren(md).length, 3, "icon, heading and description only");

  const sm = renderState(CollectionState, {
    variant: "empty",
    title: "T",
    description: "",
    icon: CustomIcon,
    eyebrow: "Clínicas",
    action: "ACTION",
    secondaryAction: "SECONDARY",
    size: "sm",
    className: "w-full",
  });
  assert.ok(["min-h-[8rem]", "px-4", "py-5", "w-full"].every((name) => classes(sm).includes(name)));
  const [smWrapper, eyebrow, smHeading, action, secondary] = elementChildren(sm);
  assert.ok(classes(smWrapper).includes("h-9"));
  assert.equal(elementChildren(smWrapper)[0].attrs["data-icon"], "custom");
  assert.deepEqual([eyebrow.tag, stateText(eyebrow)], ["p", "Clínicas"]);
  assert.deepEqual([smHeading.tag, stateText(smHeading)], ["h2", "T"]);
  assert.ok(classes(smHeading).includes("text-sm"));
  assert.deepEqual([stateText(action), classes(action)], ["ACTION", ["flex", "justify-center", "mt-4"]]);
  assert.deepEqual([stateText(secondary), classes(secondary)], ["SECONDARY", ["flex", "justify-center", "mt-2"]]);
  assert.equal(elementChildren(sm).length, 5, "an empty description is not rendered");
});

test("C03 · error variant keeps role=alert, titles, tone and the optional retry action", () => {
  const plain = renderState(CollectionState, { variant: "error", message: "No se pudieron cargar los informes." });
  assert.deepEqual([plain.attrs.role, plain.attrs["data-collection-state"]], ["alert", "error"]);
  assert.equal(plain.attrs["aria-live"], undefined, "role=alert is the only announcement");
  assert.equal(stateText(findState(plain, (node) => node.tag === "h2")[0]), "No se pudo completar la acción");
  assert.equal(findState(plain, (node) => node.tag === "button").length, 0, "no retry without a callback");
  assert.ok(classes(plain).includes("border-destructive/25"));
  assert.equal(findState(plain, (node) => node.attrs["data-icon"] === "alert-circle").length, 1);

  const untitled = renderState(CollectionState, { variant: "error", title: "", message: "M" });
  assert.equal(findState(untitled, (node) => node.tag === "h2").length, 0, "an empty title hides the heading");

  const warning = renderState(CollectionState, {
    variant: "error",
    title: "Atención",
    message: "M",
    supportText: "Soporte",
    tone: "warning",
    onRetry,
  });
  assert.ok(classes(warning).includes("border-amber-500/25"));
  assert.equal(findState(warning, (node) => node.attrs["data-icon"] === "alert-triangle").length, 1);
  assert.equal(stateText(findState(warning, (node) => node.tag === "h2")[0]), "Atención");
  const [support] = findState(warning, (node) => node.tag === "p" && stateText(node) === "Soporte");
  assert.ok(classes(support).includes("text-xs"));
  const buttons = findState(warning, (node) => node.tag === "button");
  assert.equal(buttons.length, 1);
  assert.deepEqual(
    [buttons[0].attrs.type, buttons[0].attrs.onClick, stateText(buttons[0])],
    ["button", "onRetry", "Reintentar"],
  );
  assert.ok(classes(buttons[0]).includes("focus-visible:ring-2"));
  assert.equal(findState(buttons[0], (node) => node.attrs["data-icon"] === "refresh")[0].attrs["aria-hidden"], "true");

  let calls = 0;
  const retry = () => {
    calls += 1;
  };
  const tree = CollectionState({ variant: "error", message: "M", onRetry: retry }) as {
    props: { children: unknown[] };
  };
  const button = tree.props.children.find(
    (child) => (child as { props?: { onClick?: unknown } } | null)?.props?.onClick === retry,
  ) as { props: { onClick: () => void } };
  button.props.onClick();
  assert.equal(calls, 1, "the retry control invokes the consumer callback unchanged");
});

test("C03 · loading variant keeps status semantics, the five skeletons, the rows clamp, compact and label", () => {
  const cards = renderState(CollectionState, { variant: "loading" });
  assert.deepEqual(
    [cards.attrs.role, cards.attrs["aria-live"], cards.attrs["aria-busy"], cards.attrs["data-collection-state"]],
    ["status", "polite", "true", "loading"],
  );
  const [label, ...cardItems] = elementChildren(cards);
  assert.deepEqual([label.tag, classes(label), stateText(label)], ["span", ["sr-only"], "Cargando..."]);
  assert.equal(cardItems.length, 3, "default rows");
  assert.ok(["grid", "gap-4", "lg:grid-cols-3"].every((name) => classes(cards).includes(name)));
  assert.ok(cardItems.every((item) => classes(item).includes("min-h-32")));

  const shape = (skeleton: string, compact: boolean) => {
    const root = renderState(CollectionState, { variant: "loading", skeleton, rows: 2, compact });
    const [, ...body] = elementChildren(root);
    return { root, body, skeletons: findState(root, (node) => node.attrs["data-skeleton"] === "true").length };
  };
  const table = shape("table", false);
  assert.equal(table.body.length, 2, "table head grid plus rows block");
  assert.equal(elementChildren(table.body[1]).length, 2);
  assert.equal(table.skeletons, 4 + 2 * 4);
  assert.ok(classes(table.root).includes("p-4") && classes(shape("table", true).root).includes("p-3"));
  const detail = shape("detail", false);
  assert.equal(detail.skeletons, 3 + 2);
  assert.ok(classes(detail.root).includes("p-5") && classes(shape("detail", true).root).includes("p-4"));
  const timeline = shape("timeline", false);
  assert.equal(timeline.body.length, 2);
  assert.ok(classes(timeline.root).includes("space-y-4") && classes(shape("timeline", true).root).includes("p-4"));
  const list = shape("list", false);
  assert.equal(list.body.length, 2);
  assert.ok(classes(list.root).includes("space-y-3") && classes(list.body[0]).includes("p-3"));
  const compactList = shape("list", true);
  assert.ok(classes(compactList.root).includes("space-y-2") && classes(compactList.body[0]).includes("p-2.5"));
  assert.ok(classes(shape("cards", true).root).includes("gap-3"));
  assert.ok(shape("cards", true).body.every((item) => classes(item).includes("min-h-24")));

  for (const [rows, expected] of [
    [0, 1], [1, 1], [2.7, 2], [5, 5], [-3, 1], [Number.NaN, 1], [Number.POSITIVE_INFINITY, 1],
  ] as const) {
    const root = renderState(CollectionState, { variant: "loading", skeleton: "list", rows });
    assert.equal(elementChildren(root).length - 1, expected, `rows=${rows}`);
  }
  for (const [labelProp, expected] of [["Cargando clínicas", "Cargando clínicas"], ["", ""]] as const) {
    const root = renderState(CollectionState, { variant: "loading", skeleton: "table", label: labelProp });
    assert.equal(stateText(elementChildren(root)[0]), expected);
  }
  for (const skeleton of ["table", "cards", "detail", "timeline", "list"]) {
    const root = renderState(CollectionState, { variant: "loading", skeleton });
    assert.equal(findState(root, (node) => node.attrs.role === "alert").length, 0, `${skeleton}: loading never alerts`);
    assert.equal(findState(root, (node) => classes(node).includes("animate-spin")).length, 0, `${skeleton}: no spinner`);
    assert.equal(findState(root, (node) => node.attrs.role === "status").length, 1, `${skeleton}: one status root`);
  }
});

// The legacy names render exactly what CollectionState renders for the
// equivalent canonical props, using the prop shapes their consumers pass.
function adapterParity(states: ReturnType<typeof loadStates>) {
  const same = (legacy: StateComponent, props: Record<string, unknown>, canonical: Record<string, unknown>) =>
    JSON.stringify(renderState(legacy, props)) === JSON.stringify(renderState(states.CollectionState, canonical));
  const empty = { title: "Sin clínicas", description: "No hay clínicas para mostrar.", size: "sm", className: "border-0 bg-transparent" };
  const error = { title: "No se pudieron cargar los informes", message: "No se pudieron cargar los informes. Intente nuevamente." };
  const loading = { compact: true, rows: 3, className: "border-0 bg-transparent shadow-none rounded-none" };
  return {
    empty:
      same(states.EmptyState, empty, { variant: "empty", ...empty }) &&
      same(states.EmptyState, { title: "T", icon: CustomIcon }, { variant: "empty", title: "T", icon: CustomIcon }),
    error:
      same(states.ErrorState, error, { variant: "error", ...error }) &&
      same(states.ErrorState, { message: "M", onRetry, tone: "warning" }, { variant: "error", message: "M", onRetry, tone: "warning" }),
    loading:
      same(states.LoadingState, { variant: "table", ...loading }, { variant: "loading", skeleton: "table", ...loading }) &&
      same(states.LoadingState, {}, { variant: "loading" }) &&
      ["cards", "detail", "timeline", "list"].every((skeleton) =>
        same(states.LoadingState, { variant: skeleton, rows: 2 }, { variant: "loading", skeleton, rows: 2 }),
      ),
  };
}

test("C03 · EmptyState, ErrorState and LoadingState are thin adapters with DOM parity", () => {
  assert.deepEqual(adapterParity(STATES), { empty: true, error: true, loading: true });
  const markers = [
    renderState(STATES.EmptyState, { title: "T" }),
    renderState(STATES.ErrorState, { message: "M" }),
    renderState(STATES.LoadingState, { variant: "table" }),
  ].map((root) => root.attrs["data-collection-state"]);
  assert.deepEqual(markers, ["empty", "error", "loading"], "every legacy name renders through the owner");
});

function c03Contract(sources: StateSources) {
  const states = loadStates(sources);
  const error = renderState(states.CollectionState, { variant: "error", message: "M", onRetry });
  const loading = renderState(states.CollectionState, { variant: "loading", skeleton: "table", label: "L" });
  return {
    alert: error.attrs.role === "alert",
    retryWired: findState(error, (node) => node.tag === "button" && node.attrs.onClick === "onRetry").length === 1,
    status: loading.attrs.role === "status" && loading.attrs["aria-live"] === "polite",
    busy: loading.attrs["aria-busy"] === "true",
    label: stateText(elementChildren(loading)[0]) === "L",
    adaptersDelegate: Object.values(adapterParity(states)).every(Boolean),
  };
}

test("C03 · in-memory mutations of the owner and adapters are caught by the runtime contract", () => {
  const sources = currentStateSources();
  const baseline = c03Contract(sources);
  assert.ok(Object.values(baseline).every(Boolean), JSON.stringify(baseline));

  const mutations: readonly (readonly [keyof StateSources, string, string, keyof typeof baseline])[] = [
    ["owner", 'role="alert"', "", "alert"],
    ["owner", "onClick={onRetry}", "onClick={undefined}", "retryWired"],
    ["owner", 'aria-live="polite"', "", "status"],
    ["owner", 'aria-busy="true"', "", "busy"],
    ["owner", '{label ?? "Cargando..."}', '{"Cargando..."}', "label"],
    ["error", 'return <CollectionState {...props} variant="error" />;', 'return <div role="alert">{props.message}</div>;', "adaptersDelegate"],
    ["loading", " skeleton={variant}", "", "adaptersDelegate"],
  ];
  for (const [file, anchor, replacement, flag] of mutations) {
    assert.equal(sources[file].split(anchor).length, 2, `${file}: anchor must be unique: ${anchor}`);
    const mutated = { ...sources, [file]: sources[file].replace(anchor, () => replacement) };
    assert.deepEqual(c03Contract(mutated), { ...baseline, [flag]: false }, `${file}: ${anchor}`);
  }
});
