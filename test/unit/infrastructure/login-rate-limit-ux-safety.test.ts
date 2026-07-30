import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { listSourceFiles } from "../../helpers/tracked-source-files.ts";

const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";
const NEXT_ENV_PATH = "frontend/next-env.d.ts";
const FRONTEND_SRC_PATH = "frontend/src";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function listFrontendSourceFiles(relativeDir: string): string[] {
  return listSourceFiles(resolve(process.cwd(), relativeDir), {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  }).map((file) => `${relativeDir}/${file}`);
}

// Strings forbidden from appearing in login UI source and client-side error messages.
// Tests may contain them as regression sentinels; frontend/src must not expose them as visible copy.
const FORBIDDEN_LOGIN_UX_STRINGS = [
  "Too Many Requests",
  "Rate limit",
  "rate limit",
  "rate-limit",
  "Demasiados intentos",
] as const;

const FORBIDDEN_VISIBLE_FRONTEND_STRINGS = [
  '"429"',
  "Too Many Requests",
  "Rate limit",
  "rate limit",
  "rate-limit",
  "Demasiados intentos de inicio de sesión",
  "Demasiados intentos",
] as const;

test("login rate limit client message uses safe non-technical wording", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(
    source.includes("Acceso temporalmente restringido"),
    "LOGIN_RATE_LIMIT_CLIENT_ERROR_MESSAGE must use safe non-technical wording",
  );

  const msgStart = source.indexOf("LOGIN_RATE_LIMIT_CLIENT_ERROR_MESSAGE =");
  const msgEnd = source.indexOf(";", msgStart);
  const msgSection = source.slice(msgStart, msgEnd);

  for (const forbidden of FORBIDDEN_LOGIN_UX_STRINGS) {
    assert.equal(
      msgSection.includes(forbidden),
      false,
      `LOGIN_RATE_LIMIT_CLIENT_ERROR_MESSAGE must not contain: ${forbidden}`,
    );
  }

  assert.equal(
    msgSection.includes("Demasiados intentos"),
    false,
    "LOGIN_RATE_LIMIT_CLIENT_ERROR_MESSAGE must not contain Demasiados intentos",
  );
});

test("buildRateLimitErrorMessage accepts only retryAfterSeconds and never passes backend message to user", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(
    source.includes("function buildRateLimitErrorMessage(\n  retryAfterSeconds: number | null,"),
    "buildRateLimitErrorMessage must accept only retryAfterSeconds",
  );
  assert.equal(
    source.includes("function buildRateLimitErrorMessage(\n  backendMessage"),
    false,
    "buildRateLimitErrorMessage must not accept backendMessage parameter",
  );

  assert.ok(
    source.includes("buildRateLimitErrorMessage(retryAfterSeconds)"),
    "buildRateLimitErrorMessage call site must pass only retryAfterSeconds",
  );
  assert.equal(
    source.includes("buildRateLimitErrorMessage(backendMessage,"),
    false,
    "buildRateLimitErrorMessage call site must not pass backendMessage",
  );

  assert.equal(
    source.includes("backendMessage ?? LOGIN_RATE_LIMIT_CLIENT_ERROR_MESSAGE"),
    false,
    "buildRateLimitErrorMessage must not fall back to backendMessage as base",
  );
});

test("LoginContent does not hardcode any forbidden rate limit or technical strings", () => {
  const source = read(LOGIN_CONTENT_PATH);

  for (const forbidden of FORBIDDEN_LOGIN_UX_STRINGS) {
    assert.equal(
      source.includes(forbidden),
      false,
      `LoginContent.tsx must not contain: ${forbidden}`,
    );
  }

  assert.equal(
    source.includes("429"),
    false,
    "LoginContent.tsx must not contain the HTTP status 429 as a literal string",
  );

  assert.equal(
    source.includes("Demasiados intentos"),
    false,
    "LoginContent.tsx must not contain Demasiados intentos",
  );
});

test("frontend source does not expose forbidden visible rate limit string literals", () => {
  const findings: string[] = [];

  for (const filePath of listFrontendSourceFiles(FRONTEND_SRC_PATH)) {
    const source = read(filePath);

    for (const forbidden of FORBIDDEN_VISIBLE_FRONTEND_STRINGS) {
      if (source.includes(forbidden)) {
        findings.push(`${filePath}: contains ${forbidden}`);
      }
    }
  }

  assert.deepEqual(
    findings,
    [],
    "frontend/src must not expose forbidden visible rate-limit strings",
  );
});

test("frontend next-env.d.ts references production build path not dev path", () => {
  const source = read(NEXT_ENV_PATH);

  assert.ok(
    source.includes('.next/types/routes.d.ts'),
    "next-env.d.ts must reference .next/types/routes.d.ts (production build path, not dev path)",
  );
  assert.equal(
    source.includes('.next/dev/types/routes.d.ts'),
    false,
    "next-env.d.ts must not reference .next/dev/types/routes.d.ts — dev path causes dirty working tree after pnpm --dir frontend build",
  );
});
