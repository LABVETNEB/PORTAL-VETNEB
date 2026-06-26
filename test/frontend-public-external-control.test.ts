import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PUBLIC_ROUTE_CONTROL_PATH = "frontend/src/components/public/PublicRouteControl.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function publicExternalControlSource(): string {
  const source = read(PUBLIC_ROUTE_CONTROL_PATH);
  const start = source.indexOf("export function PublicExternalControl(");
  assert.notEqual(start, -1, "Missing PublicExternalControl export");
  return source.slice(start);
}

test("PublicExternalControl renders a semantic anchor instead of button + window.open", () => {
  const source = publicExternalControlSource();

  assert.ok(source.includes("<a"));
  assert.ok(source.includes("href={href}"));
  assert.ok(source.includes("target={target}"));
  assert.ok(source.includes('rel={target === "_blank" ? "noopener noreferrer" : undefined}'));
  assert.equal(source.includes("window.open"), false);
  assert.equal(source.includes("window.location.assign"), false);
  assert.equal(source.includes("<button"), false);
});

test("PublicExternalControl keeps disabled semantics without executing navigation", () => {
  const source = publicExternalControlSource();

  assert.ok(source.includes("disabled?: boolean"));
  assert.ok(source.includes("event.preventDefault();"));
  assert.ok(source.includes('aria-disabled={disabled ? "true" : undefined}'));
  assert.ok(source.includes("disabled && \"pointer-events-none opacity-60\""));
});
