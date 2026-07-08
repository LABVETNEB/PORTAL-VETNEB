import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PUBLIC_ACTION_PATH = "frontend/src/components/public/PublicAction.tsx";
const PUBLIC_HERO_PATH = "frontend/src/components/public/PublicHero.tsx";
const RENDER_PRIMITIVES_PATH =
  "frontend/src/components/public/RenderPrimitives.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("public action primitive defines intentional action variants", () => {
  const source = read(PUBLIC_ACTION_PATH);

  assert.ok(source.includes("export type PublicActionVariant"));
  assert.ok(source.includes('"primaryLight"'));
  assert.ok(source.includes('"primaryDark"'));
  assert.ok(source.includes('"secondaryOutline"'));
  assert.ok(source.includes('"textLink"'));
  assert.ok(source.includes('"contactCard"'));
});

test("public action primitive avoids accidental default gradient on light CTAs", () => {
  const source = read(PUBLIC_ACTION_PATH);

  assert.ok(source.includes('import {'));
  assert.ok(source.includes("PublicRouteControl"));
  assert.ok(source.includes("PublicExternalControl"));
  assert.ok(source.includes("if (external) {"));
  assert.ok(source.includes("bg-card/95"));
  assert.ok(source.includes("text-vetneb-navy"));
  assert.ok(source.includes("clinical-primary-gradient"));
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("asChild"), false);
});

test("public hero primitive defines page-intent variants", () => {
  const source = read(PUBLIC_HERO_PATH);

  assert.ok(source.includes("export type PublicHeroVariant"));
  assert.ok(source.includes('"brand"'));
  assert.ok(source.includes('"editorial"'));
  assert.ok(source.includes('"directory"'));
  assert.ok(source.includes('"conversion"'));
  assert.ok(source.includes('"compact"'));
  assert.ok(source.includes('"none"'));
});

test("public hero primitive separates dark conversion heroes from editorial surfaces", () => {
  const source = read(PUBLIC_HERO_PATH);

  assert.ok(source.includes("public-hero-depth py-16 text-white md:py-20"));
  assert.ok(source.includes("public-soft-canvas border-b border-vetneb-line/70"));
  assert.ok(source.includes('const isDark = variant === "brand" || variant === "conversion";'));
  assert.ok(source.includes('<AmbientOrbs variant="dark" />'));
});

test("public action contactCard variant renders non-interactive div container not Link wrapper", () => {
  const source = read(PUBLIC_ACTION_PATH);

  assert.ok(source.includes('"contactCard"'));
  // contactCard container must be a div not a Link wrapping the whole card
  assert.ok(source.includes("group flex items-center justify-between gap-4 rounded-lg"));
  // No absolute inset-0 overlay trick
  assert.equal(source.includes("absolute inset-0"), false);
  // Explicit constrained CTA control inside the contactCard branch
  assert.ok(source.includes("inline-flex shrink-0"));
});

test("public action contactCard keeps accessible icon control contract", () => {
  const source = read(PUBLIC_ACTION_PATH);

  assert.ok(source.includes("<PublicExternalControl"));
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes('className="inline-flex shrink-0 text-vetneb-teal transition group-hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"'));
  assert.ok(source.includes('<span className="sr-only">'));
  assert.ok(source.includes('typeof children === "string" ? children : "Ver"'));
  assert.ok(source.includes('{icon ? <span aria-hidden="true">{icon}</span> : null}'));
});

test("public gradient button keeps disabled focus and decorative icon contract", () => {
  const source = read(RENDER_PRIMITIVES_PATH);

  assert.ok(source.includes("export function PublicGradientButton"));
  assert.ok(source.includes('showArrow ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null'));
  assert.ok(source.includes("disabled:pointer-events-none disabled:opacity-60"));
  assert.ok(source.includes("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"));
  assert.ok(source.includes("<PublicExternalControl"));
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("disabled={disabled}"));
  assert.ok(source.includes("onClick={onClick}"));
  assert.ok(source.includes("<button"));
  assert.ok(source.includes("type={type}"));
});
