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

function activeAssignmentValues(source: string, expectedKey: string): string[] {
  return source.split("\n").flatMap((line) => {
    const activeLine = line.trimStart();
    if (!activeLine || activeLine.startsWith("#")) return [];

    const separatorIndex = activeLine.indexOf("=");
    if (separatorIndex < 0) return [];

    const key = activeLine.slice(0, separatorIndex).trim();
    if (key !== expectedKey) return [];

    return [activeLine.slice(separatorIndex + 1)];
  });
}

function assertExactlyOneEmptyActiveAssignment(source: string, key: string): void {
  assert.deepEqual(
    activeAssignmentValues(source, key),
    [""],
    `${key} must have exactly one empty active assignment`,
  );
}

test("root env example prioritizes public production communication config", () => {
  const source = read(".env.example");

  for (const marker of [
    "NODE_ENV=production",
    "PORT=10000",
    "CORS_ORIGIN=https://vetneb.com.ar",
    "TRUST_PROXY=<RENDER_PROXY_IP_OR_CIDR>",
    "SMTP_HOST=smtp.resend.com",
    "SMTP_PORT=465",
    "SMTP_SECURE=true",
    "SMTP_USER=resend",
    "SMTP_PASS=<RESEND_API_KEY>",
    "SMTP_FROM=\"VETNEB <notificaciones@correo.vetneb.com.ar>\"",
    "CONTACT_TO=lab.vetneb@gmail.com",
    "Solo desarrollo local (auxiliar)",
  ]) {
    assert.ok(source.includes(marker), `.env.example missing ${marker}`);
  }

  for (const key of [
    "GMAIL_API_CLIENT_ID",
    "GMAIL_API_CLIENT_SECRET",
    "GMAIL_API_REFRESH_TOKEN",
    "GMAIL_API_FROM",
  ]) {
    assertExactlyOneEmptyActiveAssignment(source, key);
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

test("active Gmail assignments reject non-empty values and duplicates", () => {
  assert.doesNotThrow(() =>
    assertExactlyOneEmptyActiveAssignment(
      "# GMAIL_API_CLIENT_ID=commented-legacy-id\n\nGMAIL_API_CLIENT_ID=\n",
      "GMAIL_API_CLIENT_ID",
    ),
  );
  assert.throws(
    () =>
      assertExactlyOneEmptyActiveAssignment(
        "GMAIL_API_CLIENT_ID=legacy-id\n",
        "GMAIL_API_CLIENT_ID",
      ),
    /must have exactly one empty active assignment/,
  );
  assert.throws(
    () =>
      assertExactlyOneEmptyActiveAssignment(
        "GMAIL_API_CLIENT_ID=\nGMAIL_API_CLIENT_ID=\n",
        "GMAIL_API_CLIENT_ID",
      ),
    /must have exactly one empty active assignment/,
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
    "Resend SMTP",
    "GMAIL_API_CLIENT_SECRET=",
    "SMTP_HOST=smtp.resend.com",
    "SMTP_PORT=465",
    "SMTP_SECURE=true",
    "SMTP_USER=resend",
    "SMTP_PASS=<RESEND_API_KEY>",
    "SMTP_FROM=VETNEB <notificaciones@correo.vetneb.com.ar>",
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
    "GMAIL_API_CLIENT_ID=",
    "GMAIL_API_CLIENT_SECRET=",
    "GMAIL_API_REFRESH_TOKEN=",
    "GMAIL_API_FROM=",
    "smtp.resend.com",
    "SMTP_PORT=465",
    "SMTP_SECURE=true",
    "SMTP_USER=resend",
    "SMTP_PASS=<RESEND_API_KEY>",
    "SMTP_FROM=VETNEB <notificaciones@correo.vetneb.com.ar>",
    "NEXT_PUBLIC_API_URL=https://portal-vetneb-backend-staging.onrender.com",
    "CORS_ORIGIN=https://portal-vetneb-frontend-staging.onrender.com",
    "portal-vetneb-frontend-staging.onrender.com",
    "forzar redeploy de backend/frontend",
    "/contacto",
  ]) {
    assert.ok(releaseReadiness.includes(marker), `docs/release-readiness.md missing ${marker}`);
  }

  const quotedRenderSmtpFrom = "SMTP_FROM=\"VETNEB <notificaciones@correo.vetneb.com.ar>\"";
  assert.equal(
    stagingRunbook.includes(quotedRenderSmtpFrom),
    false,
    "docs/staging-smoke-runbook.md must not quote the Render SMTP_FROM value",
  );
  assert.equal(
    releaseReadiness.includes(quotedRenderSmtpFrom),
    false,
    "docs/release-readiness.md must not quote the Render SMTP_FROM value",
  );
});
