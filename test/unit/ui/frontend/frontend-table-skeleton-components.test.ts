import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { runModule } from "../admin/source-function-runner.ts";
import { parseTsx } from "../dashboard/dashboard-source-oracle.ts";

const TABLE_PATH = "frontend/src/components/ui/table.tsx";
const SKELETON_PATH = "frontend/src/components/ui/skeleton.tsx";

type RenderedElement = { type: unknown; props: Record<string, unknown> };
type ForwardRefStub = {
  render: (props: Record<string, unknown>, ref: unknown) => RenderedElement;
};
type Primitive = (props: Record<string, unknown>) => RenderedElement;

// Runs table.tsx as written against a React stub that records createElement,
// so the C01 primitives are exercised as code, not matched as text.
function loadTablePrimitives(): Record<string, unknown> {
  const react = {
    forwardRef: (render: ForwardRefStub["render"]): ForwardRefStub => ({ render }),
    createElement: (
      type: unknown,
      props: Record<string, unknown> | null,
      ...children: unknown[]
    ): RenderedElement => ({ type, props: { ...props, children } }),
  };
  return runModule(parseTsx(read(TABLE_PATH), TABLE_PATH), {
    react,
    "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
  });
}

function ownKeys(element: RenderedElement): string[] {
  return Object.keys(element.props).filter((key) => key !== "children").sort();
}

test("table primitives import React and class merging utility", () => {
  const source = read(TABLE_PATH);

  assert.ok(source.includes('import * as React from "react";'));
  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
});

test("table primitive keeps scroll wrapper table ref props and base classes", () => {
  const source = read(TABLE_PATH);

  assert.ok(source.includes("const Table = React.forwardRef<"));
  assert.ok(source.includes("HTMLTableElement"));
  assert.ok(source.includes("React.HTMLAttributes<HTMLTableElement>"));
  assert.ok(source.includes('<div className="relative w-full overflow-auto rounded-lg border border-vetneb-line/75 bg-card/92 shadow-[0_10px_30px_rgba(15,45,62,0.06)]">'));
  assert.ok(source.includes("<table"));
  assert.ok(source.includes("ref={ref}"));
  assert.ok(source.includes('className={cn("w-full caption-bottom text-sm", className)}'));
  assert.ok(source.includes("{...props}"));
  assert.ok(source.includes('Table.displayName = "Table";'));
});

test("table primitive keeps section components and display names", () => {
  const source = read(TABLE_PATH);

  assert.ok(source.includes("const TableHeader = React.forwardRef<"));
  assert.ok(source.includes("HTMLTableSectionElement"));
  assert.ok(source.includes("[&_tr]:border-b [&_tr]:border-vetneb-line/65 [&_tr]:bg-vetneb-surface-muted/65"));
  assert.ok(source.includes('TableHeader.displayName = "TableHeader";'));

  assert.ok(source.includes("const TableBody = React.forwardRef<"));
  assert.ok(source.includes('className={cn("[&_tr:last-child]:border-0", className)}'));
  assert.ok(source.includes('TableBody.displayName = "TableBody";'));

  assert.ok(source.includes("const TableFooter = React.forwardRef<"));
  assert.ok(source.includes('"border-t border-vetneb-line/65 bg-muted/45 font-medium [&>tr]:last:border-b-0"'));
  assert.ok(source.includes('TableFooter.displayName = "TableFooter";'));
});

test("table primitive keeps row head cell and caption components", () => {
  const source = read(TABLE_PATH);

  assert.ok(source.includes("const TableRow = React.forwardRef<"));
  assert.ok(source.includes("HTMLTableRowElement"));
  assert.ok(source.includes('"border-b border-vetneb-line/60 transition-colors hover:bg-vetneb-surface-muted/45 data-[state=selected]:bg-vetneb-teal/10"'));
  assert.ok(source.includes('TableRow.displayName = "TableRow";'));

  assert.ok(source.includes("const TableHead = React.forwardRef<"));
  assert.ok(source.includes("React.ThHTMLAttributes<HTMLTableCellElement>"));
  assert.ok(source.includes('"h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [&:has([role=checkbox])]:pr-0"'));
  assert.ok(source.includes('TableHead.displayName = "TableHead";'));

  assert.ok(source.includes("const TableCell = React.forwardRef<"));
  assert.ok(source.includes("React.TdHTMLAttributes<HTMLTableCellElement>"));
  assert.ok(source.includes('"p-3.5 align-middle text-foreground/88 [&:has([role=checkbox])]:pr-0"'));
  assert.ok(source.includes('TableCell.displayName = "TableCell";'));

  assert.ok(source.includes("const TableCaption = React.forwardRef<"));
  assert.ok(source.includes("HTMLTableCaptionElement"));
  assert.ok(source.includes('"mt-4 text-sm text-muted-foreground"'));
  assert.ok(source.includes('TableCaption.displayName = "TableCaption";'));
});

test("table primitive exports stable component surface", () => {
  const source = read(TABLE_PATH);

  assert.ok(source.includes("export {"));
  assert.ok(source.includes("Table,"));
  assert.ok(source.includes("TableHeader,"));
  assert.ok(source.includes("TableBody,"));
  assert.ok(source.includes("TableFooter,"));
  assert.ok(source.includes("TableHead,"));
  assert.ok(source.includes("TableRow,"));
  assert.ok(source.includes("TableCell,"));
  assert.ok(source.includes("TableCaption,"));
});

test("C01 · ContentList and ContentListItem keep the consumer's semantics and add only a structural marker", () => {
  const primitives = loadTablePrimitives();
  const ContentList = primitives.ContentList as Primitive;
  const ContentListItem = primitives.ContentListItem as Primitive;

  const lists: readonly [string, unknown][] = [
    ["tbody", primitives.TableBody],
    ["ul", "ul"],
    ["ol", "ol"],
    ["div", "div"],
  ];
  for (const [as, expected] of lists) {
    const element = ContentList({ as, className: "consumer", id: "list", "data-content-list": "false" });
    assert.equal(element.type, expected, `ContentList as=${as}`);
    assert.equal(element.props["data-content-list"], "true");
    assert.equal(element.props.className, "consumer");
    // No role, sort, selection, handler or tab stop is added on the consumer's behalf.
    assert.deepEqual(ownKeys(element), ["className", "data-content-list", "id"]);
  }

  const items: readonly [string, unknown][] = [
    ["tr", primitives.TableRow],
    ["li", "li"],
    ["article", "article"],
    ["div", "div"],
  ];
  for (const [as, expected] of items) {
    const element = ContentListItem({ as, className: "row" });
    assert.equal(element.type, expected, `ContentListItem as=${as}`);
    assert.equal(element.props["data-content-list-item"], "true");
    assert.deepEqual(ownKeys(element), ["className", "data-content-list-item"]);
  }
});

test("C01 · CollectionWorkspace and CollectionHeader forward refs, merge classes and pin their markers", () => {
  const primitives = loadTablePrimitives();
  const ref = () => undefined;

  const workspace = (primitives.CollectionWorkspace as ForwardRefStub).render(
    {
      className: "min-h-0 flex-1",
      "data-dashboard-adaptive-rows-canvas": "true",
      "data-collection-workspace": "false",
    },
    ref,
  );
  assert.equal(workspace.type, "div");
  assert.equal(workspace.props.ref, ref);
  assert.equal(workspace.props.className, "dashboard-collection-workspace min-h-0 flex-1");
  assert.equal(workspace.props["data-collection-workspace"], "true");
  // Capacity attributes belong to the consumer and pass through untouched.
  assert.equal(workspace.props["data-dashboard-adaptive-rows-canvas"], "true");

  const header = (primitives.CollectionHeader as ForwardRefStub).render({ className: "dense" }, ref);
  assert.equal(header.type, primitives.TableHeader);
  assert.equal(header.props.ref, ref);
  assert.equal(header.props.className, "dashboard-collection-header dense");
  assert.equal(header.props["data-collection-header"], "true");
  assert.deepEqual(ownKeys(header), ["className", "data-collection-header", "ref"]);
});

test("skeleton primitive keeps utility merge props and clinical loading class", () => {
  const source = read(SKELETON_PATH);

  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
  assert.ok(source.includes("function Skeleton({"));
  assert.ok(source.includes("className,"));
  assert.ok(source.includes("...props"));
  assert.ok(source.includes("React.HTMLAttributes<HTMLDivElement>"));
  assert.ok(source.includes("<div"));
  assert.ok(source.includes("clinical-skeleton rounded-md"));
  assert.ok(source.includes("{...props}"));
  assert.ok(source.includes("export { Skeleton };"));
});
