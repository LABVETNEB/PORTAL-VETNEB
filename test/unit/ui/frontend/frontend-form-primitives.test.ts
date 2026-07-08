import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const SELECT_PATH = "frontend/src/components/ui/select.tsx";
const TEXTAREA_PATH = "frontend/src/components/ui/textarea.tsx";
const LABEL_PATH = "frontend/src/components/ui/label.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("select primitive uses native select semantics and shared tokenized styling", () => {
  const source = read(SELECT_PATH);

  assert.ok(source.includes('import * as React from "react";'));
  assert.ok(source.includes('import { ChevronDown } from "lucide-react";'));
  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
  assert.ok(source.includes("export interface SelectProps"));
  assert.ok(source.includes("extends React.SelectHTMLAttributes<HTMLSelectElement>"));
  assert.ok(source.includes("wrapperClassName?: string;"));
  assert.ok(source.includes("const Select = React.forwardRef<HTMLSelectElement, SelectProps>("));
  assert.ok(source.includes("<select"));
  assert.ok(source.includes("ref={ref}"));
  assert.ok(source.includes("{...props}"));
  assert.ok(source.includes("{children}"));
});

test("select primitive keeps accessible icon treatment and focus contract", () => {
  const source = read(SELECT_PATH);

  assert.ok(source.includes('aria-hidden="true"'));
  assert.ok(source.includes("pointer-events-none absolute right-3 top-1/2 size-4"));
  assert.ok(source.includes("appearance-none rounded-md border border-input bg-card/96"));
  assert.ok(source.includes("hover:border-vetneb-teal/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"));
  assert.ok(source.includes("disabled:cursor-not-allowed disabled:opacity-55"));
  assert.ok(source.includes('Select.displayName = "Select";'));
  assert.ok(source.includes("export { Select };"));
});

test("textarea primitive uses native textarea semantics and shared tokenized styling", () => {
  const source = read(TEXTAREA_PATH);

  assert.ok(source.includes('import * as React from "react";'));
  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
  assert.ok(source.includes("export interface TextareaProps"));
  assert.ok(source.includes("extends React.TextareaHTMLAttributes<HTMLTextAreaElement>"));
  assert.ok(source.includes("const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>("));
  assert.ok(source.includes("<textarea"));
  assert.ok(source.includes("ref={ref}"));
  assert.ok(source.includes("{...props}"));
  assert.ok(source.includes("min-h-24 w-full resize-y rounded-md border border-input bg-card/96"));
  assert.ok(source.includes("placeholder:text-muted-foreground hover:border-vetneb-teal/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"));
  assert.ok(source.includes('Textarea.displayName = "Textarea";'));
  assert.ok(source.includes("export { Textarea };"));
});

test("label primitive uses native label semantics and accessible disabled styling", () => {
  const source = read(LABEL_PATH);

  assert.ok(source.includes('import * as React from "react";'));
  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
  assert.ok(source.includes("export interface LabelProps"));
  assert.ok(source.includes("extends React.LabelHTMLAttributes<HTMLLabelElement>"));
  assert.ok(source.includes("const Label = React.forwardRef<HTMLLabelElement, LabelProps>("));
  assert.ok(source.includes("<label"));
  assert.ok(source.includes("ref={ref}"));
  assert.ok(source.includes("{...props}"));
  assert.ok(source.includes("text-sm font-semibold leading-none text-vetneb-ink"));
  assert.ok(source.includes("peer-disabled:cursor-not-allowed peer-disabled:opacity-70"));
  assert.ok(source.includes('Label.displayName = "Label";'));
  assert.ok(source.includes("export { Label };"));
});
