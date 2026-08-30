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

test("allows the loopback database URL used pervasively across the test suite", () => {
  assert.equal(
    detectSecretPattern(
      'process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";',
    ),
    null,
  );
  assert.equal(
    detectSecretPattern(
      '"postgresql://postgres:postgres@localhost:5432/portal_vetneb_ci"',
    ),
    null,
  );
});

// Production-shaped DSNs are assembled from fragments, never written as a
// literal, for the same reason the Supabase/JWT/SMTP fixtures above are: this
// file is itself scanned by the governance secret scan, and a literal
// production-shaped credential on one source line would make the contract that
// proves detection works trip the very detector it documents.
function strongPassword(): string {
  return ["Kp9", "mQ2", "vLx7"].join("$");
}

function credentialUrl(
  scheme: string,
  username: string,
  password: string,
  host: string,
  path = "",
): string {
  return [scheme, "://", username, ":", password, "@", host, path].join("");
}

test("still detects a genuinely production-shaped database credential URL", () => {
  const dsn = credentialUrl(
    "postgresql",
    "admin",
    strongPassword(),
    "db.prod.internal.corp:5432",
    "/app",
  );

  assert.equal(detectSecretPattern(`const url = "${dsn}";`), "production credential URL");
});

test("allows a reserved documentation host exactly and as a domain suffix", () => {
  assert.equal(
    detectSecretPattern(
      `"${credentialUrl("postgresql", "user", "placeholder", "example.com", "/db")}"`,
    ),
    null,
  );
  assert.equal(
    detectSecretPattern(
      `"${credentialUrl("postgresql", "runtime-user", "runtime-password", "db.example.com", "/portal")}";`,
    ),
    null,
  );
});

// The credential-URL exemption is decided from the host and the password only,
// by exact hostname or true domain suffix. These cases are the ones a
// substring-based or whole-match placeholder test silently lets through: the
// letters "example" inside an ordinary registrable domain, and placeholder-
// looking usernames sitting next to a genuinely strong password. Each of them
// regressed from "flag" to "allow" under a whole-match placeholder check, so
// they are pinned here permanently.
test("a placeholder-looking substring inside a real hostname does not exempt a credential", () => {
  for (const host of ["db.examplehealth.com", "postgres.example-labs.net"]) {
    assert.equal(
      detectSecretPattern(
        credentialUrl("postgresql", "svc_user", strongPassword(), host, "/prod"),
      ),
      "production credential URL",
      host,
    );
  }
});

test("a placeholder-looking username never exempts a strong password on a real host", () => {
  for (const username of ["dummyuser", "sampleuser", "fakeuser", "exampleadmin"]) {
    assert.equal(
      detectSecretPattern(
        credentialUrl(
          "mongodb+srv",
          username,
          strongPassword(),
          "cluster0.prod.mongodb.net",
          "/main",
        ),
      ),
      "production credential URL",
      username,
    );
  }
});

test("placeholder prose surrounding a real DSN does not suppress the finding", () => {
  const dsn = credentialUrl("postgresql", "admin", strongPassword(), "db.prod.corp", "/app");

  assert.equal(
    detectSecretPattern(`example placeholder fixture: ${dsn}`),
    "production credential URL",
  );
  assert.equal(detectSecretPattern(`${dsn} # sample fixture`), "production credential URL");
});

test("every supported database scheme still flags a production credential", () => {
  const cases: readonly [string, string][] = [
    ["postgresql", "db.prod.corp"],
    ["mysql", "mysql.prod.internal"],
    ["redis", "redis.prod.internal"],
    ["mongodb+srv", "cluster0.prod.mongodb.net"],
  ];

  for (const [scheme, host] of cases) {
    assert.equal(
      detectSecretPattern(credentialUrl(scheme, "svc", strongPassword(), host, "/app")),
      "production credential URL",
      scheme,
    );
  }
});

test("an unparseable credential URL fails closed rather than being exempted", () => {
  // A shape the structured parser cannot decompose must still be reported,
  // so a malformed or hostile DSN cannot slip past the scan by being unusual.
  const malformed = credentialUrl("postgresql", "user", strongPassword(), "[not a host]", "/db");

  assert.equal(detectSecretPattern(malformed), "production credential URL");
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
