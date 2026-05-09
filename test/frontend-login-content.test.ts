import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";
const LOGIN_PAGE_PATH = "frontend/src/app/login/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend login content calls clinic login and redirects to dashboard", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('"use client"'));
  assert.ok(source.includes('import { loginClinic } from "@/lib/api"'));
  assert.ok(source.includes('import { useRouter, useSearchParams } from "next/navigation"'));
  assert.ok(source.includes("await loginClinic({ username, password })"));
  assert.ok(source.includes('router.replace(getSafeNextPath(searchParams.get("next")))'));
  assert.ok(source.includes("router.refresh()"));
});

test("frontend login content preserves dashboard next path safely", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("function getSafeNextPath(nextPath: string | null): string"));
  assert.ok(source.includes('nextPath?.startsWith("/dashboard")'));
  assert.ok(source.includes("return ROUTES.dashboard"));
});

test("frontend login content removes demo bypass and development placeholder", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.equal(source.includes("Ver dashboard (demo sin auth)"), false);
  assert.equal(source.includes("Iniciar sesión (próximamente)"), false);
  assert.equal(source.includes("Nota de desarrollo"), false);
  assert.equal(source.includes("onSubmit={(e) => e.preventDefault()}"), false);
});

test("frontend login content handles controlled credentials loading and errors", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('const [username, setUsername] = useState("")'));
  assert.ok(source.includes('const [password, setPassword] = useState("")'));
  assert.ok(source.includes("const [errorMessage, setErrorMessage]"));
  assert.ok(source.includes("const [isSubmitting, setIsSubmitting]"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("disabled={isSubmitting}"));
});

test("frontend login page wraps client search params usage in suspense", () => {
  const source = read(LOGIN_PAGE_PATH);

  assert.ok(source.includes('import { Suspense } from "react"'));
  assert.ok(source.includes("<Suspense fallback={null}>"));
  assert.ok(source.includes("<LoginContent />"));
  assert.ok(source.includes("</Suspense>"));
});
