import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { runModule } from "../admin/source-function-runner.ts";
import { parseTsx } from "./dashboard-source-oracle.ts";

const DASHBOARD_PAGER_PATH =
  "frontend/src/components/dashboard/DashboardPager.tsx";
const COMPACT_PAGER_PATH =
  "frontend/src/components/dashboard/CompactPager.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";
const LOGISTICS_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";
const LOGISTICS_RECENT_PATH =
  "frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx";
const INFORMES_PATH =
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const ZERO_SCROLL_CSS_PATH =
  "frontend/src/styles/dashboard/zero-scroll.css";
const DIRECT_DASHBOARD_PAGERS = [
  INFORMES_PATH,
  "frontend/src/app/dashboard/logistica/visitas/page.tsx",
  "frontend/src/app/dashboard/logistica/rutas/page.tsx",
  "frontend/src/app/dashboard/logistica/metricas/page.tsx",
] as const;
const ADAPTIVE_RENDERINGS = [
  "frontend/src/app/dashboard/admin/AdminAuditCard.tsx",
  "frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx",
  "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx",
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
  "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
  "frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx",
  "frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx",
  "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx",
  "frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx",
  "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
  "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx",
  "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx",
  INFORMES_PATH,
  LOGISTICS_RECENT_PATH,
  "frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx",
] as const;

test("A05 derives the measured rows canvas from available layout, not row content", () => {
  for (const path of ADAPTIVE_RENDERINGS) {
    const source = read(path);
    assert.ok(source.includes("min-h-0"), path);
    assert.ok(
      source.includes("flex-1") ||
        (path.endsWith("LogisticsBoundedCanvas.tsx") && source.includes("h-full")),
      `${path} must derive its block size from an allocated parent region`,
    );
  }
});

test("A05 declares a dashboard-scoped pager reservation without changing its token", () => {
  const source = read(DASHBOARD_PAGER_PATH);
  const css = read(ZERO_SCROLL_CSS_PATH);

  assert.ok(
    source.includes('"--dash-adaptive-pager-reserved-block-size":') &&
      source.includes('"var(--dash-pagination-h, 2.5rem)"'),
  );
  assert.ok(
    source.includes('blockSize: "var(--dash-adaptive-pager-reserved-block-size)"') &&
      source.includes('maxBlockSize: "var(--dash-adaptive-pager-reserved-block-size)"'),
  );
  assert.ok(
    !source.includes("transition: height") &&
      !source.includes("transition: grid-template-rows"),
    "reserved block sizes must never animate",
  );
  assert.match(
    css,
    /\.dashboard-pager\s*\{[\s\S]*?height:\s*var\(--dash-pagination-h,[\s\S]*?min-height:\s*var\(--dash-pagination-h,[\s\S]*?max-height:\s*var\(--dash-pagination-h,/,
  );

  for (const path of DIRECT_DASHBOARD_PAGERS) {
    const directPager = read(path);
    assert.ok(
      directPager.includes('data-dashboard-adaptive-reserved-region="pager"'),
      `${path} must declare its fixed dashboard-pager region`,
    );
  }
});

test("A05 retains the legacy action-bar constant while CMP-06 keeps logistics actions in-card", () => {
  const bar = read(STICKY_ACTION_BAR_PATH);
  const page = read(LOGISTICS_PAGE_PATH);

  assert.ok(bar.includes("STICKY_ACTION_RESERVED_BLOCK_SIZE"));
  assert.ok(
    bar.includes("calc(5.5625rem + env(safe-area-inset-bottom, 0px))"),
  );
  assert.ok(page.includes("headerActions={"));
  assert.equal(page.includes("<StickyActionBar"), false);
  assert.ok(!bar.includes("ResizeObserver") && !bar.includes("useLayoutEffect"));
});

test("A05 pilots attach the reservation root and content-independent canvas", () => {
  for (const path of [LOGISTICS_RECENT_PATH, INFORMES_PATH]) {
    const source = read(path);
    assert.ok(source.includes('data-dashboard-adaptive-reservation="true"'), path);
    assert.ok(source.includes('data-dashboard-adaptive-rows-canvas="true"'), path);
    assert.ok(!source.includes("limit = 2") && !source.includes("limit = 3"), path);
  }
});

test("A05 covers every physical rendering of the canonical adaptive consumers", () => {
  for (const path of ADAPTIVE_RENDERINGS) {
    assert.ok(
      read(path).includes('data-dashboard-adaptive-rows-canvas="true"'),
      `${path} must expose its measured rows canvas to the A05 contract`,
    );
  }
});

test("A05 preserves the capacity API and introduces no fixed limit or viewport patch", () => {
  // The three legacy hooks were retired once their consumer count reached 0;
  // their API surface collapsed into one owner plus the pure engine it calls.
  for (const [path, exportedSymbol] of [
    ["frontend/src/hooks/useDashboardCanvasCapacity.ts", "useDashboardCanvasCapacity"],
    ["frontend/src/lib/dashboard/capacity/computeCapacity.ts", "computeCapacity"],
  ] as const) {
    assert.ok(read(path).includes(`export function ${exportedSymbol}(`), path);
  }

  const contract = [
    read(DASHBOARD_PAGER_PATH),
    ...ADAPTIVE_RENDERINGS.map(read),
  ].join("\n");
  assert.doesNotMatch(contract, /(?:360|375|390|412|430|1024|1280|1366)px/);
  assert.doesNotMatch(contract, /limit\s*[:=]\s*(?:2|3|12|16)\b/);
  assert.doesNotMatch(contract, /overflow-y\s*:\s*auto/);
});

type PagerNode = {
  tag: string;
  attrs: Record<string, unknown>;
  children: (PagerNode | string)[];
};
type PagerComponent = (props: Record<string, unknown>) => unknown;

// Runs the pager modules as written against a createElement-recording React
// stub, so C02 is exercised as code. Function elements are expanded, which is
// what makes the legacy adapters observable as the DOM they produce.
function loadPagers(): Record<string, unknown> {
  const React = {
    createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => ({
      type,
      props: { ...props, children },
    }),
  };
  const icon = (name: string) => (props: Record<string, unknown>) =>
    React.createElement("svg", { ...props, "data-icon": name });
  const pager = runModule(
    parseTsx(read(DASHBOARD_PAGER_PATH), DASHBOARD_PAGER_PATH),
    {
      "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
      "lucide-react": { ChevronLeft: icon("chevron-left"), ChevronRight: icon("chevron-right") },
    },
    { React },
  );
  const compact = runModule(
    parseTsx(read(COMPACT_PAGER_PATH), COMPACT_PAGER_PATH),
    { "@/components/dashboard/DashboardPager": pager },
    { React },
  );
  return { ...pager, CompactPager: compact.CompactPager };
}

const PAGERS = loadPagers();
const CollectionPager = PAGERS.CollectionPager as PagerComponent;

function expand(node: unknown, handlers: ReadonlyMap<unknown, string>): (PagerNode | string)[] {
  if (Array.isArray(node)) {
    const out: (PagerNode | string)[] = [];
    for (const child of node.flatMap((entry) => expand(entry, handlers))) {
      const last = out.at(-1);
      if (typeof child === "string" && typeof last === "string") out[out.length - 1] = last + child;
      else out.push(child);
    }
    return out;
  }
  if (node === null || node === undefined || node === false || node === "") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  const element = node as { type: unknown; props: Record<string, unknown> };
  if (typeof element.type === "function") {
    return expand((element.type as PagerComponent)(element.props), handlers);
  }
  const attrs: Record<string, unknown> = {};
  for (const key of Object.keys(element.props).sort()) {
    const value = element.props[key];
    if (key === "children" || value === undefined || value === null) continue;
    if (key === "className") attrs[key] = String(value).split(/\s+/).filter(Boolean).sort();
    else if (typeof value === "function") attrs[key] = handlers.get(value) ?? "unknown-handler";
    else attrs[key] = value;
  }
  return [{ tag: String(element.type), attrs, children: expand(element.props.children ?? [], handlers) }];
}

const onPrev = () => {};
const onNext = () => {};
const HANDLERS = new Map<unknown, string>([[onPrev, "onPrev"], [onNext, "onNext"]]);

// Crosses the VM realm so structural equality compares values, not prototypes.
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function render(component: PagerComponent, props: Record<string, unknown>): PagerNode {
  const [root] = expand(component(props), HANDLERS);
  assert.ok(root && typeof root !== "string", "the pager renders one element root");
  return plain(root);
}

function findAll(node: PagerNode, match: (node: PagerNode) => boolean): PagerNode[] {
  const nested = node.children
    .filter((child): child is PagerNode => typeof child !== "string")
    .flatMap((child) => findAll(child, match));
  return match(node) ? [node, ...nested] : nested;
}

function text(node: PagerNode): string {
  return node.children.map((child) => (typeof child === "string" ? child : text(child))).join("");
}

function buttons(root: PagerNode): PagerNode[] {
  return findAll(root, (node) => node.tag === "button");
}

function disabledStates(root: PagerNode): unknown[] {
  return buttons(root).map((button) => button.attrs.disabled);
}

function pageState(root: PagerNode): string {
  const states = findAll(root, (node) => node.attrs["data-dashboard-pager-state"] === "true");
  assert.equal(states.length, 1);
  return text(states[0]);
}

test("C02 · centered CollectionPager is a landmark with the touch reservation, prev/next callbacks and edge states", () => {
  const first = render(CollectionPager, {
    variant: "centered",
    "aria-label": "Paginación de prueba",
    page: 0,
    pageCount: 3,
    onPrev,
    onNext,
    rangeLabel: "1–4 de 12",
    className: "shrink-0",
  });
  assert.equal(first.tag, "nav");
  assert.equal(first.attrs["aria-label"], "Paginación de prueba");
  assert.equal(first.attrs["data-collection-pager"], "centered");
  assert.equal(first.attrs["data-dashboard-pager"], "true");
  assert.equal(first.attrs["data-dashboard-adaptive-reserved-region"], "pager");
  assert.deepEqual(first.attrs.className, ["dashboard-pager", "min-h-10", "shrink-0"]);
  assert.deepEqual(first.attrs.style, plain(PAGERS.DASHBOARD_TOUCH_PAGER_RESERVATION));

  const live = findAll(first, (node) => node.attrs["aria-live"] === "polite");
  assert.equal(live.length, 1);
  assert.deepEqual(live[0].attrs.className, ["sr-only"]);
  assert.equal(text(live[0]), "1–4 de 12");

  const [prev, next] = buttons(first);
  assert.deepEqual(
    [prev.attrs["aria-label"], text(prev), prev.attrs.onClick, prev.attrs.disabled],
    ["Página anterior", "Anterior", "onPrev", true],
  );
  assert.deepEqual(
    [next.attrs["aria-label"], text(next), next.attrs.onClick, next.attrs.disabled],
    ["Página siguiente", "Siguiente", "onNext", false],
  );
  assert.ok((prev.attrs.className as string[]).includes("dashboard-pagination-btn"));
  assert.ok((prev.attrs.className as string[]).includes("focus-visible:ring-2"));
  assert.equal(pageState(first), "Pág. 1 / 3");
  for (const marker of ["data-dashboard-pager-prev", "data-dashboard-pager-next"]) {
    const [wrapper] = findAll(first, (node) => node.attrs[marker] === "true");
    assert.equal(wrapper.tag, "span", `${marker} marks the centered wrapper`);
    assert.equal(buttons(wrapper).length, 1);
  }

  const last = render(CollectionPager, { variant: "centered", "aria-label": "P", page: 2, pageCount: 3, onPrev, onNext });
  assert.deepEqual(disabledStates(last), [false, true]);
  assert.equal(findAll(last, (node) => node.attrs["aria-live"] !== undefined).length, 0, "no total, no announcement");
  assert.deepEqual(disabledStates(render(CollectionPager, { variant: "centered", "aria-label": "P", page: 0, pageCount: 1 })), [true, true]);
  assert.deepEqual(disabledStates(render(CollectionPager, { variant: "centered", "aria-label": "P", page: 1, pageCount: 3, disabled: true })), [true, true]);
  assert.deepEqual(
    disabledStates(render(CollectionPager, { variant: "centered", "aria-label": "P", page: 0, pageCount: 1, hasPrev: true, hasNext: true, onPrev, onNext })),
    [false, false],
    "explicit hasPrev/hasNext win over the derived state",
  );

  const slotted = render(CollectionPager, {
    variant: "centered",
    "aria-label": "P",
    prevControl: "PREV",
    stateControl: "STATE",
    nextControl: "NEXT",
  });
  assert.equal(buttons(slotted).length, 0);
  assert.equal(text(slotted), "PREVSTATENEXT");
});

test("C02 · compact CollectionPager announces the visible range and total inside the standard reservation, painting Anterior/Siguiente only", () => {
  const middle = render(CollectionPager, {
    variant: "compact",
    page: 1,
    pageCount: 3,
    rangeStart: 4,
    rangeEnd: 6,
    total: 9,
    hasPrev: true,
    hasNext: true,
    onPrev,
    onNext,
    itemLabel: "grupos",
  });
  assert.equal(middle.tag, "div");
  assert.equal(middle.attrs["data-collection-pager"], "compact");
  assert.equal(middle.attrs["data-dashboard-compact-pager"], "true");
  assert.equal(middle.attrs["data-dashboard-pager"], "compact");
  assert.equal(middle.attrs["data-dashboard-adaptive-reserved-region"], "pager");
  assert.equal(middle.attrs["aria-label"], undefined, "the compact bar is not a landmark");
  assert.deepEqual(middle.attrs.style, plain(PAGERS.DASHBOARD_PAGER_RESERVATION));

  const [live] = findAll(middle, (node) => node.attrs["aria-live"] === "polite");
  assert.equal(live.attrs["aria-atomic"], "true");
  assert.equal(text(live), "4–6 de 9 grupos");
  // Admin desktop/tablet space pass: the range is announced, never painted,
  // and no page state is rendered.
  assert.deepEqual(live.attrs.className, ["sr-only"], "the range is announced to assistive tech only");
  assert.equal(findAll(middle, (node) => node.attrs["data-dashboard-pager-state"] === "true").length, 0, "no painted page state");

  const [prev, next] = buttons(middle);
  assert.deepEqual(
    [prev.attrs["data-dashboard-pager-prev"], prev.attrs["aria-label"], prev.attrs.onClick, prev.attrs.disabled],
    ["true", "Página anterior", "onPrev", false],
  );
  assert.deepEqual(
    [next.attrs["data-dashboard-pager-next"], next.attrs["aria-label"], next.attrs.onClick, next.attrs.disabled],
    ["true", "Página siguiente", "onNext", false],
  );
  assert.deepEqual([text(prev), text(next)], ["Anterior", "Siguiente"], "the controls carry visible text");

  const empty = render(CollectionPager, {
    variant: "compact", page: 0, pageCount: 1, rangeStart: 0, rangeEnd: 0, total: 0, hasPrev: false, hasNext: false,
  });
  assert.equal(text(findAll(empty, (node) => node.attrs["aria-live"] === "polite")[0]), "Sin elementos");
  assert.deepEqual(disabledStates(empty), [true, true]);
  assert.deepEqual(
    disabledStates(render(CollectionPager, {
      variant: "compact", page: 1, pageCount: 3, rangeStart: 4, rangeEnd: 6, total: 9, hasPrev: true, hasNext: true, disabled: true,
    })),
    [true, true],
  );
});

test("C02 · a built-in control is enabled only when it has a callback to navigate with", () => {
  const compact = { variant: "compact", page: 1, pageCount: 3, rangeStart: 4, rangeEnd: 6, total: 9, hasPrev: true, hasNext: true };
  assert.deepEqual(disabledStates(render(CollectionPager, { ...compact, onNext })), [true, false], "compact: no onPrev");
  assert.deepEqual(disabledStates(render(CollectionPager, { ...compact, onPrev })), [false, true], "compact: no onNext");
  assert.deepEqual(disabledStates(render(CollectionPager, { ...compact, onPrev, onNext })), [false, false]);

  const centered = { variant: "centered", "aria-label": "P", page: 1, pageCount: 3 };
  assert.deepEqual(disabledStates(render(CollectionPager, centered)), [true, true], "centered: no callbacks");
  assert.deepEqual(disabledStates(render(CollectionPager, { ...centered, onNext })), [true, false], "centered: no onPrev");
  assert.deepEqual(disabledStates(render(CollectionPager, { ...centered, onPrev })), [false, true], "centered: no onNext");
  assert.deepEqual(disabledStates(render(CollectionPager, { ...centered, onPrev, onNext })), [false, false]);

  // A slot replaces its built-in control: the consumer's markup is rendered as
  // given and the remaining built-in control still follows its own callback.
  const slotted = render(CollectionPager, {
    ...centered,
    prevControl: { type: "button", props: { id: "url-prev", children: [] } },
    onNext,
  });
  const [custom, builtIn] = buttons(slotted);
  assert.deepEqual(custom.attrs, { id: "url-prev" }, "the slot control is not altered");
  assert.deepEqual([builtIn.attrs["aria-label"], builtIn.attrs.disabled], ["Página siguiente", false]);
});

test("C02 · the centered variant keeps the zero-based page contract; the compact one paints no page state", () => {
  const compact = { variant: "compact", rangeStart: 1, rangeEnd: 1, total: 1, hasPrev: false, hasNext: false } as const;
  for (const [page, pageCount] of [[0, 3], [2, 3], [5, 3], [0, 0]] as const) {
    const node = render(CollectionPager, { ...compact, page, pageCount });
    assert.equal(findAll(node, (child) => child.attrs["data-dashboard-pager-state"] === "true").length, 0);
  }
  for (const variant of ["centered"] as const) {
    const base = { variant, "aria-label": "P" };
    const state = (page: number, pageCount: number) => pageState(render(CollectionPager, { ...base, page, pageCount }));
    assert.equal(state(0, 3), "Pág. 1 / 3", `${variant}: page 0 is the first page`);
    assert.equal(state(2, 3), "Pág. 3 / 3", `${variant}: page count - 1 is the last page`);
    // usePagedRows never yields these; the shared rule keeps the label in range.
    assert.equal(state(5, 3), "Pág. 3 / 3", `${variant}: clamped above`);
    assert.equal(state(0, 0), "Pág. 1 / 1", `${variant}: at least one page`);
  }
});

// Frozen from the pre-C02 DashboardPager/CompactPager (068f62c3). The adapters
// must reproduce them exactly; `data-collection-pager` is the only addition.
const LEGACY_CONTROL_BASE = [
  "bg-card/95", "border", "border-input", "disabled:cursor-not-allowed", "disabled:opacity-50",
  "focus-visible:outline-none", "focus-visible:ring-2", "focus-visible:ring-offset-2", "focus-visible:ring-ring/85",
  "h-8", "hover:bg-accent/70", "hover:border-vetneb-teal/45", "inline-flex", "items-center", "justify-center",
  "rounded-md", "text-foreground",
];
const LEGACY_CENTERED_CONTROL = [
  ...LEGACY_CONTROL_BASE, "dashboard-pagination-btn", "font-semibold", "px-3", "shadow-sm", "text-xs", "transition-colors",
].sort();
// The compact control became a text button with the admin desktop/tablet
// space pass (Anterior/Siguiente only, no icon-only controls).
const LEGACY_COMPACT_CONTROL = [...LEGACY_CONTROL_BASE, "dashboard-btn-interactive", "font-semibold", "px-2.5", "text-xs"].sort();

function reservation(size: string) {
  return {
    "--dash-adaptive-pager-reserved-block-size": size,
    blockSize: "var(--dash-adaptive-pager-reserved-block-size)",
    minBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
    maxBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  };
}

function legacyCenteredControl(step: "prev" | "next", disabled: boolean): PagerNode {
  return {
    tag: "button",
    attrs: {
      "aria-label": step === "prev" ? "Página anterior" : "Página siguiente",
      className: LEGACY_CENTERED_CONTROL,
      disabled,
      onClick: step === "prev" ? "onPrev" : "onNext",
      type: "button",
    },
    children: [step === "prev" ? "Anterior" : "Siguiente"],
  };
}

function legacyCompactControl(step: "prev" | "next", disabled: boolean): PagerNode {
  return {
    tag: "button",
    attrs: {
      "aria-label": step === "prev" ? "Página anterior" : "Página siguiente",
      className: LEGACY_COMPACT_CONTROL,
      [`data-dashboard-pager-${step}`]: "true",
      disabled,
      onClick: step === "prev" ? "onPrev" : "onNext",
      type: "button",
    },
    children: [step === "prev" ? "Anterior" : "Siguiente"],
  };
}

function withoutCollectionMarker(node: PagerNode, variant: "centered" | "compact"): PagerNode {
  const { "data-collection-pager": marker, ...attrs } = node.attrs;
  assert.equal(marker, variant, "the canonical owner marks every pager root");
  return { ...node, attrs };
}

test("C02 · DashboardPager adapter reproduces the legacy centered DOM through CollectionPager", () => {
  const DashboardPager = PAGERS.DashboardPager as PagerComponent;
  const props = {
    "aria-label": "Paginación de visitas recientes",
    page: 1,
    pageCount: 4,
    hasPrev: true,
    hasNext: true,
    onPrev,
    onNext,
    rangeLabel: "5–8 de 14",
    className: "shrink-0 border-t border-vetneb-line/60",
  };
  const adapted = render(DashboardPager, props);
  assert.deepEqual(adapted, render(CollectionPager, { ...props, variant: "centered" }));
  assert.deepEqual(withoutCollectionMarker(adapted, "centered"), {
    tag: "nav",
    attrs: {
      "aria-label": "Paginación de visitas recientes",
      className: ["border-t", "border-vetneb-line/60", "dashboard-pager", "min-h-10", "shrink-0"],
      "data-dashboard-adaptive-reserved-region": "pager",
      "data-dashboard-pager": "true",
      style: reservation("max(var(--dash-pagination-h, 2.5rem), 2.5rem)"),
    },
    children: [
      { tag: "span", attrs: { "aria-live": "polite", className: ["sr-only"] }, children: ["5–8 de 14"] },
      {
        tag: "span",
        attrs: { className: ["inline-flex"], "data-dashboard-pager-prev": "true" },
        children: [legacyCenteredControl("prev", false)],
      },
      {
        tag: "span",
        attrs: { className: ["text-muted-foreground", "text-xs"], "data-dashboard-pager-state": "true" },
        children: [{ tag: "span", attrs: { className: ["dashboard-pagination-context"] }, children: ["Pág. 2 / 4"] }],
      },
      {
        tag: "span",
        attrs: { className: ["inline-flex"], "data-dashboard-pager-next": "true" },
        children: [legacyCenteredControl("next", false)],
      },
    ],
  });
});

test("C02 · CompactPager adapter reproduces the legacy compact DOM through CollectionPager", () => {
  const CompactPager = PAGERS.CompactPager as PagerComponent;
  const props = {
    page: 0,
    pageCount: 3,
    rangeStart: 1,
    rangeEnd: 4,
    total: 12,
    hasPrev: false,
    hasNext: true,
    onPrev,
    onNext,
    itemLabel: "estudios",
  };
  const adapted = render(CompactPager, props);
  assert.deepEqual(adapted, render(CollectionPager, { ...props, variant: "compact" }));
  assert.deepEqual(withoutCollectionMarker(adapted, "compact"), {
    tag: "div",
    attrs: {
      className: ["dashboard-compact-pager", "overflow-hidden", "pt-0"],
      "data-dashboard-adaptive-reserved-region": "pager",
      "data-dashboard-compact-pager": "true",
      "data-dashboard-pager": "compact",
      style: reservation("var(--dash-pagination-h, 2.5rem)"),
    },
    children: [
      { tag: "span", attrs: { "aria-atomic": "true", "aria-live": "polite", className: ["sr-only"] }, children: ["1–4 de 12 estudios"] },
      {
        tag: "div",
        attrs: { className: ["flex", "gap-2", "items-center"] },
        children: [
          legacyCompactControl("prev", true),
          legacyCompactControl("next", false),
        ],
      },
    ],
  });
});
