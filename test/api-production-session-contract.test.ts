import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function readRepoFile(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("production browser API contract keeps calls same-origin with credentials", () => {
  const apiClient = readRepoFile("frontend/src/lib/api.ts");

  assert.match(
    apiClient,
    /const\s+SAME_ORIGIN_API_BASE_URL\s*=\s*["']["']/,
    "browser API base must remain same-origin so /api/* can be served by the deployed frontend host",
  );

  assert.match(
    apiClient,
    /if\s*\(\s*isBrowserRuntime\s*\)\s*\{\s*return\s+SAME_ORIGIN_API_BASE_URL;\s*\}/s,
    "browser runtime must return the same-origin API base before using NEXT_PUBLIC_API_URL directly",
  );

  assert.match(
    apiClient,
    /credentials:\s*options\.credentials\s*\?\?\s*["']include["']/,
    "apiFetch must default to credentials include so session cookies are sent",
  );

  for (const requiredPath of [
    "/api/auth/login",
    "/api/auth/me",
    "/api/auth/logout",
    "/api/particular/auth/login",
    "/api/particular/auth/me",
    "/api/contact",
    "/api/admin/clinics",
    "/api/clinic/profile",
    "/api/particular-tokens",
    "/api/admin/particular-tokens",
  ]) {
    assert.ok(
      apiClient.includes(requiredPath),
      `frontend API client must keep critical route ${requiredPath}`,
    );
  }
});

test("next production rewrite contract proxies same-origin /api routes to configured backend", () => {
  const nextConfig = readRepoFile("frontend/next.config.ts");

  assert.match(
    nextConfig,
    /process\.env\.NEXT_PUBLIC_API_URL/,
    "Next rewrites must be driven by NEXT_PUBLIC_API_URL",
  );

  assert.match(
    nextConfig,
    /replace\(\s*\/\\\/\+\$\/\s*,\s*["']["']\s*\)/,
    "NEXT_PUBLIC_API_URL must be normalized by trimming trailing slashes",
  );

  assert.match(
    nextConfig,
    /async\s+rewrites\s*\(\s*\)/,
    "Next config must expose async rewrites()",
  );

  assert.match(
    nextConfig,
    /source:\s*["']\/api\/:path\*["']/,
    "Next config must rewrite same-origin /api/:path* requests",
  );

  assert.match(
    nextConfig,
    /destination:\s*`?\$\{?apiUrl\}?\/api\/:path\*`?/,
    "Next config must forward /api/:path* to the configured backend API URL",
  );

  assert.doesNotMatch(
    nextConfig,
    /destination:\s*["']https:\/\/api\.vetneb\.com\.ar\/api\/:path\*["']/,
    "backend API URL must not be hardcoded; deploy config must provide NEXT_PUBLIC_API_URL",
  );
});

test("backend production CORS and session cookie env contract stays credential-safe", () => {
  const env = readRepoFile("server/lib/env.ts");

  assert.match(
    env,
    /CORS_ORIGIN:\s*z\.preprocess/,
    "backend must expose CORS_ORIGIN env parsing",
  );

  assert.match(
    env,
    /nodeEnv\s*===\s*["']production["']\s*&&\s*configuredCorsOrigins\.length\s*===\s*0/s,
    "production backend must fail fast when CORS_ORIGIN is missing",
  );

  assert.match(
    env,
    /corsOrigins\s*=\s*[\s\S]*nodeEnv\s*===\s*["']production["']\s*\?\s*configuredCorsOrigins/s,
    "production CORS origins must come from configured CORS_ORIGIN",
  );

  assert.match(
    env,
    /cookieSecure:\s*nodeEnv\s*===\s*["']production["']/,
    "production cookies must remain Secure",
  );

  assert.match(
    env,
    /cookieSameSite:\s*\(\s*nodeEnv\s*===\s*["']production["']\s*\?\s*["']none["']\s*:\s*["']lax["']\s*\)/,
    "production cookies must remain SameSite=None for credentialed browser sessions",
  );

  for (const cookieName of [
    "app_session_id",
    "admin_session_id",
    "particular_session_id",
  ]) {
    assert.ok(
      env.includes(cookieName),
      `session cookie name ${cookieName} must remain part of the production contract`,
    );
  }
});

test("critical backend routes keep credentialed CORS preflight coverage", () => {
  const routeFiles = [
    "server/routes/auth.fastify.ts",
    "server/routes/admin-auth.fastify.ts",
    "server/routes/particular-auth.fastify.ts",
    "server/routes/contact.fastify.ts",
    "server/routes/admin-clinics.fastify.ts",
    "server/routes/clinic-public-profile.fastify.ts",
    "server/routes/particular-tokens.fastify.ts",
    "server/routes/admin-particular-tokens.fastify.ts",
    "server/routes/report-access-tokens.fastify.ts",
    "server/routes/admin-report-access-tokens.fastify.ts",
  ];

  for (const file of routeFiles) {
    const source = readRepoFile(file);

    assert.match(
      source,
      /function\s+applyCorsHeaders|const\s+applyCorsHeaders/,
      `${file} must keep explicit CORS header application`,
    );

    assert.match(
      source,
      /access-control-allow-origin/,
      `${file} must emit Access-Control-Allow-Origin`,
    );

    assert.match(
      source,
      /access-control-allow-credentials["']?\s*,\s*["']true["']/,
      `${file} must allow credentialed CORS`,
    );

    assert.match(
      source,
      /app\.options\(/,
      `${file} must keep OPTIONS preflight handlers`,
    );

    assert.match(
      source,
      /enforceTrustedOrigin/,
      `${file} must keep trusted-origin protection for mutating requests`,
    );
  }
});
