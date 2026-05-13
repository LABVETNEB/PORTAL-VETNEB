import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const BADGE_PATH = "frontend/src/components/ui/badge.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("badge component uses shared variant utilities and class merge utility", () => {
  const source = read(BADGE_PATH);

  assert.ok(source.includes('import * as React from "react";'));
  assert.ok(source.includes('import { cva, type VariantProps } from "class-variance-authority";'));
  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
  assert.ok(source.includes("const badgeVariants = cva("));
  assert.ok(source.includes("VariantProps<typeof badgeVariants>"));
});

test("badge component defines stable base classes", () => {
  const source = read(BADGE_PATH);

  assert.ok(source.includes("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold"));
  assert.ok(source.includes("tracking-[0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring/85 focus:ring-offset-2"));
});

test("badge component defines expected variants and default", () => {
  const source = read(BADGE_PATH);

  assert.ok(source.includes("variant: {"));
  assert.ok(source.includes("default:"));
  assert.ok(source.includes("border-vetneb-teal/30 bg-vetneb-teal/12 text-vetneb-teal hover:bg-vetneb-teal/20"));
  assert.ok(source.includes("secondary:"));
  assert.ok(source.includes("border-vetneb-cyan/30 bg-vetneb-cyan/12 text-vetneb-navy hover:bg-vetneb-cyan/20"));
  assert.ok(source.includes("destructive:"));
  assert.ok(source.includes("border-destructive/30 bg-destructive/12 text-destructive hover:bg-destructive/20"));
  assert.ok(source.includes('outline: "border-vetneb-line/90 bg-card/80 text-foreground"'));
  assert.ok(source.includes("defaultVariants: {"));
  assert.ok(source.includes('variant: "default"'));
});

test("badge component keeps props typing and renders div with merged classes", () => {
  const source = read(BADGE_PATH);

  assert.ok(source.includes("export interface BadgeProps"));
  assert.ok(source.includes("extends React.HTMLAttributes<HTMLDivElement>"));
  assert.ok(source.includes("function Badge({ className, variant, ...props }: BadgeProps)"));
  assert.ok(source.includes("<div className={cn(badgeVariants({ variant }), className)} {...props} />"));
});

test("badge component keeps stable named exports", () => {
  const source = read(BADGE_PATH);

  assert.ok(source.includes("export { Badge, badgeVariants };"));
});
