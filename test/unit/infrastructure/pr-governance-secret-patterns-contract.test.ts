import test from "node:test";
import assert from "node:assert/strict";

import {
  detectSecretPattern,
} from "../../../scripts/governance/pr-governance-validator.mjs";

function encodedJson(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function legacyJwt(role: string): string {
  return [
    encodedJson({ alg: "HS256", typ: "JWT" }),
    encodedJson({ role }),
    ["fixture", "signature", "A7"].join("_"),
  ].join(".");
}

function supabaseKey(kind: "secret" | "publishable"): string {
  return [
    "sb",
    kind,
    ["A7m", "kP9", "xQ4", "vN8", "rT2", "zL6", "cD5"].join(""),
    ["B8", "qR", "3n", "W7"].join(""),
  ].join("_");
}

function renderCredential(): string {
  return ["R8m", "q2N", "v7T", "k4P", "z9C", "d6X", "a3L", "w5H"].join("");
}

function mailCredential(): string {
  return ["M7v", "p2Q", "x9R", "d4K", "w8N", "c5T"].join("");
}

function alphabeticMailCredential(): string {
  return ["alpha", "bravo", "charlie", "delta"].join("");
}

function smtpCredentialUrl(): string {
  return [
    "smtps",
    "://",
    "mailer",
    ":",
    mailCredential(),
    "@",
    "mail.internal.invalid",
  ].join("");
}

test("detects a production-shaped Supabase secret key", () => {
  assert.equal(
    detectSecretPattern(`const value = "${supabaseKey("secret")}";`),
    "Supabase secret key",
  );
});

test("detects a legacy Supabase JWT by service_role payload", () => {
  assert.equal(
    detectSecretPattern(`const value = "${legacyJwt("service_role")}";`),
    "Supabase service_role JWT",
  );
  assert.equal(
    detectSecretPattern(
      `const sampleConfig = "${legacyJwt("service_role")}";`,
    ),
    "Supabase service_role JWT",
  );
});

test("detects a JWT assigned to SUPABASE_SERVICE_ROLE_KEY", () => {
  assert.equal(
    detectSecretPattern(
      `SUPABASE_SERVICE_ROLE_KEY=${legacyJwt("fixture_role")}`,
    ),
    "Supabase service_role JWT",
  );
});

test("allows a legacy Supabase anon JWT", () => {
  assert.equal(
    detectSecretPattern(`const value = "${legacyJwt("anon")}";`),
    null,
  );
});

test("allows a Supabase publishable key", () => {
  assert.equal(
    detectSecretPattern(`const value = "${supabaseKey("publishable")}";`),
    null,
  );
});

test("detects a literal Render API credential assignment", () => {
  assert.equal(
    detectSecretPattern(`RENDER_API_KEY="${renderCredential()}"`),
    "Render API credential",
  );
});

test("allows a Render environment-variable reference", () => {
  assert.equal(
    detectSecretPattern("const apiKey = process.env.RENDER_API_KEY;"),
    null,
  );
});

test("detects an SMTPS credential URL", () => {
  assert.equal(
    detectSecretPattern(`const transport = "${smtpCredentialUrl()}";`),
    "SMTP credential URL",
  );
});

test("detects a literal SMTP password assignment", () => {
  assert.equal(
    detectSecretPattern(`SMTP_PASSWORD=${mailCredential()}`),
    "SMTP credential",
  );
});

test("detects diverse alphabetic SMTP credential assignments", () => {
  const value = alphabeticMailCredential();

  assert.equal(
    detectSecretPattern(`SMTP_PASS=${value}`),
    "SMTP credential",
  );
  assert.equal(
    detectSecretPattern(`MAIL_PASSWORD="${value}"`),
    "SMTP credential",
  );
});

test("placeholder text in a trailing comment does not hide an SMTP credential", () => {
  const value = mailCredential();

  assert.equal(
    detectSecretPattern(`SMTP_PASSWORD=${value} # sample account`),
    "SMTP credential",
  );
});

test("placeholder text in an identifier does not hide a Render credential", () => {
  const value = renderCredential();

  assert.equal(
    detectSecretPattern(
      `const exampleConfig = { RENDER_API_KEY: "${value}" };`,
    ),
    "Render API credential",
  );
});

test("placeholder text outside a Supabase key does not hide it", () => {
  const value = supabaseKey("secret");

  assert.equal(
    detectSecretPattern(`const sampleConfig = "${value}";`),
    "Supabase secret key",
  );
});

test("placeholder text after an SMTP URL does not hide it", () => {
  const credentialUrl = smtpCredentialUrl();

  assert.equal(
    detectSecretPattern(`${credentialUrl} # sample account`),
    "SMTP credential URL",
  );
});

test("allows an SMTP environment-variable reference", () => {
  assert.equal(
    detectSecretPattern("const password = process.env.SMTP_PASSWORD;"),
    null,
  );
});

test("allows placeholder credential assignments", () => {
  assert.equal(
    detectSecretPattern("SMTP_PASSWORD=your_password_here"),
    null,
  );
  assert.equal(
    detectSecretPattern("RENDER_API_TOKEN=<render-token>"),
    null,
  );
  assert.equal(
    detectSecretPattern("SMTP_PASS=placeholder"),
    null,
  );
  assert.equal(
    detectSecretPattern("SMTP_TOKEN=<smtp-token>"),
    null,
  );
  assert.equal(
    detectSecretPattern("EMAIL_PASSWORD=sample_password_value"),
    null,
  );
});

test("allows low-diversity SMTP literals", () => {
  const repeatedValue = Array(16).fill("q").join("");

  assert.equal(
    detectSecretPattern(`SMTP_PASSWORD=${repeatedValue}`),
    null,
  );
});

test("Render credentials still require two character classes", () => {
  const alphabeticValue = ["render", "credential", "alphabetic", "only"].join("");

  assert.equal(
    detectSecretPattern(`RENDER_API_KEY=${alphabeticValue}`),
    null,
  );
  assert.equal(
    detectSecretPattern(`RENDER_API_KEY=${renderCredential()}`),
    "Render API credential",
  );
});

test("a malformed JWT does not crash secret detection", () => {
  const malformedJwt = ["header", "not_base64url_json", "signature"].join(".");

  assert.doesNotThrow(() => detectSecretPattern(malformedJwt));
  assert.equal(detectSecretPattern(malformedJwt), null);
});

test("secret detection returns only a sanitized category", () => {
  const sensitiveValue = renderCredential();
  const result = detectSecretPattern(`RENDER_API_TOKEN=${sensitiveValue}`);

  assert.equal(result, "Render API credential");
  assert.equal(String(result).includes(sensitiveValue), false);
});
