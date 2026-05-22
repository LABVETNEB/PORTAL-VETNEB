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

test("root env example prioritizes public staging/production communication config", () => {
  const source = read(".env.example");

  for (const marker of [
    "NODE_ENV=production",
    "CORS_ORIGIN=https://portal-vetneb-frontend-staging.onrender.com",
    "SMTP_HOST=smtp.gmail.com",
    "SMTP_PORT=587",
    "SMTP_SECURE=false",
    "SMTP_USER=",
    "SMTP_PASS=",
    "SMTP_FROM=",
    "CONTACT_TO=",
    "NEXT_PUBLIC_API_URL=https://<backend-staging>.onrender.com",
    "Solo desarrollo local (auxiliar)",
  ]) {
    assert.ok(source.includes(marker), `.env.example missing ${marker}`);
  }
});

test("frontend env example requires explicit public API URL", () => {
  const source = read("frontend/.env.example");

  for (const marker of [
    "Prioridad: staging/production público.",
    "NEXT_PUBLIC_API_URL=https://<backend-staging>.onrender.com",
    "NEXT_PUBLIC_SITE_URL=https://portal-vetneb-frontend-staging.onrender.com",
    "Solo desarrollo local (auxiliar)",
  ]) {
    assert.ok(source.includes(marker), `frontend/.env.example missing ${marker}`);
  }
});

test("public staging docs enforce Render configuration and redeploy", () => {
  const stagingRunbook = read("docs/staging-smoke-runbook.md");
  const releaseReadiness = read("docs/release-readiness.md");

  for (const marker of [
    "portal-vetneb-frontend-staging.onrender.com",
    "Redeploy backend Render.",
    "Redeploy frontend Render.",
    "Render",
    "smtp_disabled",
  ]) {
    assert.ok(stagingRunbook.includes(marker), `docs/staging-smoke-runbook.md missing ${marker}`);
  }

  for (const marker of [
    "Bloqueos obligatorios para staging público de contacto",
    "portal-vetneb-frontend-staging.onrender.com",
    "forzar redeploy de backend/frontend",
    "/contacto",
  ]) {
    assert.ok(releaseReadiness.includes(marker), `docs/release-readiness.md missing ${marker}`);
  }
});
