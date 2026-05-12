import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const BUTTON_PATH = "frontend/src/components/ui/button.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("button component uses shared variant utilities and Slot support", () => {
  const source = read(BUTTON_PATH);

  assert.ok(source.includes('import * as React from "react";'));
  assert.ok(source.includes('import { Slot } from "@radix-ui/react-slot";'));
  assert.ok(source.includes('import { cva, type VariantProps } from "class-variance-authority";'));
  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
  assert.ok(source.includes("const buttonVariants = cva("));
  assert.ok(source.includes("asChild?: boolean;"));
});

test("button component defines expected visual variants", () => {
  const source = read(BUTTON_PATH);

  assert.ok(source.includes("variant: {"));
  assert.ok(source.includes("bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--vetneb-navy)/0.18)] hover:bg-primary/90"));
  assert.ok(source.includes("destructive:"));
  assert.ok(source.includes("outline:"));
  assert.ok(source.includes("secondary:"));
  assert.ok(source.includes('ghost: "text-foreground/78 hover:bg-accent hover:text-accent-foreground"'));
  assert.ok(source.includes('link: "text-primary underline-offset-4 hover:underline"'));
});

test("button component defines expected sizes and defaults", () => {
  const source = read(BUTTON_PATH);

  assert.ok(source.includes("size: {"));
  assert.ok(source.includes('default: "h-10 px-4 py-2"'));
  assert.ok(source.includes('sm: "h-9 rounded-md px-3"'));
  assert.ok(source.includes('lg: "h-11 rounded-md px-8"'));
  assert.ok(source.includes('icon: "h-10 w-10"'));
  assert.ok(source.includes("defaultVariants: {"));
  assert.ok(source.includes('variant: "default"'));
  assert.ok(source.includes('size: "default"'));
});

test("button component forwards refs and switches element with asChild", () => {
  const source = read(BUTTON_PATH);

  assert.ok(source.includes("const Button = React.forwardRef<HTMLButtonElement, ButtonProps>("));
  assert.ok(source.includes("({ className, variant, size, asChild = false, ...props }, ref)"));
  assert.ok(source.includes('const Comp = asChild ? Slot : "button";'));
  assert.ok(source.includes("className={cn(buttonVariants({ variant, size, className }))}"));
  assert.ok(source.includes("ref={ref}"));
  assert.ok(source.includes("{...props}"));
});

test("button component keeps display name and exports stable API", () => {
  const source = read(BUTTON_PATH);

  assert.ok(source.includes('Button.displayName = "Button";'));
  assert.ok(source.includes("export { Button, buttonVariants };"));
});
