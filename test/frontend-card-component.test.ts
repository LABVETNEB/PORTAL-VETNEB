import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CARD_PATH = "frontend/src/components/ui/card.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("card component uses React forward refs and shared class merge utility", () => {
  const source = read(CARD_PATH);

  assert.ok(source.includes('import * as React from "react";'));
  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
  assert.ok(source.includes("const Card = React.forwardRef<"));
  assert.ok(source.includes("HTMLDivElement,"));
  assert.ok(source.includes("React.HTMLAttributes<HTMLDivElement>"));
  assert.ok(source.includes("ref={ref}"));
  assert.ok(source.includes("{...props}"));
});

test("card component defines base card container classes", () => {
  const source = read(CARD_PATH);

  assert.ok(source.includes('"rounded-lg border bg-card text-card-foreground shadow-sm"'));
  assert.ok(source.includes("className={cn("));
  assert.ok(source.includes("className,"));
  assert.ok(source.includes('Card.displayName = "Card";'));
});

test("card component defines header title and description primitives", () => {
  const source = read(CARD_PATH);

  assert.ok(source.includes("const CardHeader = React.forwardRef<"));
  assert.ok(source.includes('"flex flex-col space-y-1.5 p-6"'));
  assert.ok(source.includes('CardHeader.displayName = "CardHeader";'));
  assert.ok(source.includes("const CardTitle = React.forwardRef<"));
  assert.ok(source.includes('"text-2xl font-semibold leading-none tracking-tight"'));
  assert.ok(source.includes('CardTitle.displayName = "CardTitle";'));
  assert.ok(source.includes("const CardDescription = React.forwardRef<"));
  assert.ok(source.includes('"text-sm text-muted-foreground"'));
  assert.ok(source.includes('CardDescription.displayName = "CardDescription";'));
});

test("card component defines content and footer primitives", () => {
  const source = read(CARD_PATH);

  assert.ok(source.includes("const CardContent = React.forwardRef<"));
  assert.ok(source.includes('"p-6 pt-0"'));
  assert.ok(source.includes('CardContent.displayName = "CardContent";'));
  assert.ok(source.includes("const CardFooter = React.forwardRef<"));
  assert.ok(source.includes('"flex items-center p-6 pt-0"'));
  assert.ok(source.includes('CardFooter.displayName = "CardFooter";'));
});

test("card component keeps stable named exports", () => {
  const source = read(CARD_PATH);

  assert.ok(
    source.includes(
      "export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };",
    ),
  );
});
