import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const INPUT_PATH = "frontend/src/components/ui/input.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("input component uses React forward refs and shared class merge utility", () => {
  const source = read(INPUT_PATH);

  assert.ok(source.includes('import * as React from "react";'));
  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
  assert.ok(source.includes("export interface InputProps"));
  assert.ok(source.includes("extends React.InputHTMLAttributes<HTMLInputElement>"));
  assert.ok(source.includes("const Input = React.forwardRef<HTMLInputElement, InputProps>("));
});

test("input component preserves type prop ref and spread props", () => {
  const source = read(INPUT_PATH);

  assert.ok(source.includes("({ className, type, ...props }, ref)"));
  assert.ok(source.includes("<input"));
  assert.ok(source.includes("type={type}"));
  assert.ok(source.includes("ref={ref}"));
  assert.ok(source.includes("{...props}"));
});

test("input component keeps stable base classes for forms", () => {
  const source = read(INPUT_PATH);

  assert.ok(source.includes("flex h-10 w-full rounded-md border border-input bg-card/96 px-3 py-2 text-sm"));
  assert.ok(source.includes("placeholder:text-muted-foreground"));
  assert.ok(source.includes("hover:border-vetneb-teal/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"));
  assert.ok(source.includes("disabled:cursor-not-allowed disabled:opacity-55"));
  assert.ok(source.includes("className,"));
});

test("input component keeps display name and stable export", () => {
  const source = read(INPUT_PATH);

  assert.ok(source.includes('Input.displayName = "Input";'));
  assert.ok(source.includes("export { Input };"));
});
