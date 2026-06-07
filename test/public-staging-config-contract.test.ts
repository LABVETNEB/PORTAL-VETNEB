import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("root env example prioritizes public production communication config", () => {
  const source = read(".env.example");

  for (const marker of [
    "NODE_ENV=production",
    "PORT=10000",
    "CORS_ORIGIN=https://vetneb.com.ar",
    "TRUST_PROXY=1",
    "GMAIL_API_CLIENT_ID=<google-oauth-client-id>",
    "GMAIL_API_CLIENT_SECRET=<google-oauth-client-secret>",
    "GMAIL_API_REFRESH_TOKEN=<google-oauth-refresh-token>",
    "GMAIL_API_FROM=lab.vetneb@gmail.com",
    "SMTP_HOST=smtp.gmail.com",
    "SMTP_PORT=587",
    "SMTP_SECURE=false",
    "SMTP_USER=lab.vetneb@gmail.com",
    "SMTP_PASS=<GMAIL_APP_PASSWORD_WITHOUT_SPACES>",
    "SMTP_FROM=lab.vetneb@gmail.com",
    "CONTACT_TO=lab.vetneb@gmail.com",
    "Solo desarrollo local (auxiliar)",
  ]) {
    assert.ok(source.includes(marker), `.env.example missing ${marker}`);
  }

  // TRUST_PROXY=true rompe startup; ninguna línea activa debe usar ese valor.
  const activeTrustProxyTrue = source
    .split("\n")
    .some((line) => !line.trimStart().startsWith("#") && line.includes("TRUST_PROXY=true"));
  assert.ok(
    !activeTrustProxyTrue,
    ".env.example must not set TRUST_PROXY=true as an active (uncommented) line",
  );
});

test("frontend env example requires explicit public API URL", () => {
  const source = read("frontend/.env.example");

  for (const marker of [
    "NEXT_PUBLIC_API_URL=https://api.vetneb.com.ar",
    "NEXT_PUBLIC_SITE_URL=https://vetneb.com.ar",
    "Solo desarrollo local (auxiliar)",
  ]) {
    assert.ok(source.includes(marker), `frontend/.env.example missing ${marker}`);
  }

  for (const forbiddenMarker of [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "GMAIL_API_CLIENT_ID",
    "GMAIL_API_CLIENT_SECRET",
    "GMAIL_API_REFRESH_TOKEN",
    "GMAIL_API_FROM",
    "CONTACT_TO",
    "DATABASE_URL",
    "SUPABASE_DB_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    assert.equal(
      source.includes(forbiddenMarker),
      false,
      `frontend/.env.example must not include ${forbiddenMarker}`,
    );
  }
});

test("public staging docs enforce Render configuration and redeploy", () => {
  const stagingRunbook = read("docs/staging-smoke-runbook.md");
  const releaseReadiness = read("docs/release-readiness.md");

  for (const marker of [
    "portal-vetneb-backend-staging",
    "portal-vetneb-frontend-staging.onrender.com",
    "GMAIL_API_CLIENT_SECRET=<google-oauth-client-secret>",
    "Gmail API por HTTPS/443",
    "SMTP_PASS=<GMAIL_APP_PASSWORD_WITHOUT_SPACES>",
    "NEXT_PUBLIC_API_URL=https://portal-vetneb-backend-staging.onrender.com",
    "CORS_ORIGIN=https://portal-vetneb-frontend-staging.onrender.com",
    "Redeploy backend Render.",
    "Redeploy frontend Render.",
    "Render",
    "smtp_disabled",
  ]) {
    assert.ok(stagingRunbook.includes(marker), `docs/staging-smoke-runbook.md missing ${marker}`);
  }

  for (const marker of [
    "Bloqueos obligatorios para staging público de contacto",
    "portal-vetneb-backend-staging",
    "portal-vetneb-frontend-staging",
    "GMAIL_API_REFRESH_TOKEN",
    "HTTPS/443",
    "SMTP_PASS=<GMAIL_APP_PASSWORD_WITHOUT_SPACES>",
    "NEXT_PUBLIC_API_URL=https://portal-vetneb-backend-staging.onrender.com",
    "CORS_ORIGIN=https://portal-vetneb-frontend-staging.onrender.com",
    "portal-vetneb-frontend-staging.onrender.com",
    "forzar redeploy de backend/frontend",
    "/contacto",
  ]) {
    assert.ok(releaseReadiness.includes(marker), `docs/release-readiness.md missing ${marker}`);
  }
});
