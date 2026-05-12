import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const TABLE_PATH = "frontend/src/components/ui/table.tsx";
const SKELETON_PATH = "frontend/src/components/ui/skeleton.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
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
  assert.ok(source.includes('<div className="relative w-full overflow-auto rounded-lg border border-vetneb-line/70 bg-card/80">'));
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
  assert.ok(source.includes("[&_tr]:border-b [&_tr]:bg-vetneb-surface-muted/70"));
  assert.ok(source.includes('TableHeader.displayName = "TableHeader";'));

  assert.ok(source.includes("const TableBody = React.forwardRef<"));
  assert.ok(source.includes('className={cn("[&_tr:last-child]:border-0", className)}'));
  assert.ok(source.includes('TableBody.displayName = "TableBody";'));

  assert.ok(source.includes("const TableFooter = React.forwardRef<"));
  assert.ok(source.includes('"border-t bg-muted/50 font-medium [&>tr]:last:border-b-0"'));
  assert.ok(source.includes('TableFooter.displayName = "TableFooter";'));
});

test("table primitive keeps row head cell and caption components", () => {
  const source = read(TABLE_PATH);

  assert.ok(source.includes("const TableRow = React.forwardRef<"));
  assert.ok(source.includes("HTMLTableRowElement"));
  assert.ok(source.includes('"border-b border-vetneb-line/60 transition-colors hover:bg-accent/45 data-[state=selected]:bg-accent"'));
  assert.ok(source.includes('TableRow.displayName = "TableRow";'));

  assert.ok(source.includes("const TableHead = React.forwardRef<"));
  assert.ok(source.includes("React.ThHTMLAttributes<HTMLTableCellElement>"));
  assert.ok(source.includes('"h-12 px-4 text-left align-middle text-xs font-semibold uppercase text-muted-foreground [&:has([role=checkbox])]:pr-0"'));
  assert.ok(source.includes('TableHead.displayName = "TableHead";'));

  assert.ok(source.includes("const TableCell = React.forwardRef<"));
  assert.ok(source.includes("React.TdHTMLAttributes<HTMLTableCellElement>"));
  assert.ok(source.includes('"p-4 align-middle text-foreground/88 [&:has([role=checkbox])]:pr-0"'));
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

test("skeleton primitive keeps utility merge props and animation classes", () => {
  const source = read(SKELETON_PATH);

  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
  assert.ok(source.includes("function Skeleton({"));
  assert.ok(source.includes("className,"));
  assert.ok(source.includes("...props"));
  assert.ok(source.includes("React.HTMLAttributes<HTMLDivElement>"));
  assert.ok(source.includes("<div"));
  assert.ok(source.includes("animate-pulse rounded-md bg-gradient-to-r from-vetneb-surface-muted via-card to-vetneb-surface-muted"));
  assert.ok(source.includes("{...props}"));
  assert.ok(source.includes("export { Skeleton };"));
});
