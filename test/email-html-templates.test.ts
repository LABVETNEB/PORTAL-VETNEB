import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const {
  sendParticularTokenEmail,
  sendContactMessageEmail,
} = await import("../server/lib/email.ts");

// ─── helpers ─────────────────────────────────────────────────────────────────

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

type EnvSnapshot = {
  isProduction: boolean;
  contactTo: string[];
  corsOrigins: string[];
  smtp: typeof ENV.smtp;
  gmailApi: typeof ENV.gmailApi;
};

function snapshotEnv(): EnvSnapshot {
  return {
    isProduction: ENV.isProduction,
    contactTo: [...ENV.contactTo],
    corsOrigins: [...ENV.corsOrigins],
    smtp: { ...ENV.smtp },
    gmailApi: { ...ENV.gmailApi },
  };
}

function restoreEnv(snap: EnvSnapshot): void {
  (ENV as any).isProduction = snap.isProduction;
  (ENV as any).contactTo = snap.contactTo;
  (ENV as any).corsOrigins = snap.corsOrigins;
  for (const k of Object.keys(snap.smtp) as (keyof typeof ENV.smtp)[]) {
    (ENV.smtp as any)[k] = snap.smtp[k];
  }
  for (const k of Object.keys(snap.gmailApi) as (keyof typeof ENV.gmailApi)[]) {
    (ENV.gmailApi as any)[k] = snap.gmailApi[k];
  }
}

function enableSmtp(): void {
  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp.test.example";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "u";
  (ENV.smtp as any).pass = "p";
  (ENV.smtp as any).from = "noreply@vetneb.com";
  (ENV.gmailApi as any).enabled = false;
  (ENV.gmailApi as any).clientId = "";
  (ENV.gmailApi as any).clientSecret = "";
  (ENV.gmailApi as any).refreshToken = "";
  (ENV.gmailApi as any).from = "";
}

function enableGmailApi(): void {
  (ENV.gmailApi as any).enabled = true;
  (ENV.gmailApi as any).clientId = "cid";
  (ENV.gmailApi as any).clientSecret = "csec";
  (ENV.gmailApi as any).refreshToken = "rtoken";
  (ENV.gmailApi as any).from = "lab.vetneb@gmail.com";
  (ENV.smtp as any).enabled = false;
}

// ─── escapeHtml ──────────────────────────────────────────────────────────────

// We test escapeHtml indirectly through the HTML builders embedded in sendXxx.
// A direct unit test is possible via the private helper being exercised through
// the public send functions — we verify escaped output in the html payload.

test("HTML builders escapan caracteres peligrosos en datos dinamicos", async () => {
  const snap = snapshotEnv();
  const originalCreateTransport = nodemailer.createTransport;
  const sendMailCalls: Array<Record<string, unknown>> = [];

  (ENV as any).isProduction = false;
  (ENV as any).contactTo = ["ops@vetneb.com"];
  enableSmtp();

  (nodemailer as any).createTransport = () => ({
    sendMail: async (p: Record<string, unknown>) => {
      sendMailCalls.push(p);
      return { messageId: "escape-test" };
    },
  });

  const xssName = `<script>alert('xss')</script>`;
  const xssClinic = `"><img src=x onerror=alert(1)>`;
  const xssMessage = `Hello & "world" <b>bold</b>`;

  try {
    await sendContactMessageEmail({
      name: xssName,
      email: "safe@example.com",
      clinicName: xssClinic,
      message: xssMessage,
    });
  } finally {
    (nodemailer as any).createTransport = originalCreateTransport;
    restoreEnv(snap);
  }

  assert.equal(sendMailCalls.length, 1);
  const html = String(sendMailCalls[0].html);

  // No raw executable tags in the output
  assert.equal(html.includes("<script"), false, "raw <script must be absent");
  assert.equal(html.includes("</script"), false, "raw </script must be absent");
  assert.equal(html.includes("<img"), false, "raw <img must be absent");
  // onerror= in escaped text content is fine; what must be absent is onerror= inside
  // an actual HTML open tag (e.g. <img onerror=...>). Since <img is already absent this
  // is satisfied — but we also assert directly via regex.
  assert.equal(
    /<[a-zA-Z][^>]*\bonerror\s*=/i.test(html),
    false,
    "onerror must not appear inside a real HTML tag",
  );

  // escaped equivalents must appear
  assert.ok(html.includes("&lt;script&gt;"), "< > must be entity-escaped");
  assert.ok(html.includes("&amp;"), "& must be entity-escaped");
  assert.ok(html.includes("&quot;") || html.includes("&#x27;"), "quotes must be escaped");
});

// ─── Gmail API: text/plain only when no html ─────────────────────────────────

test("Gmail API genera text/plain cuando la funcion no aporta html (sendSpecialStainRequiredEmail)", async () => {
  // sendSpecialStainRequiredEmail is NOT wired to an HTML builder — it still
  // sends text/plain only. This test confirms the no-html fallback path.
  const { sendSpecialStainRequiredEmail } = await import("../server/lib/email.ts");
  const snap = snapshotEnv();
  const originalFetch = globalThis.fetch;
  let rawMessage = "";

  (ENV as any).isProduction = true;
  (ENV as any).contactTo = [];
  enableGmailApi();

  (globalThis as any).fetch = async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "tok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const body = JSON.parse(String(init?.body)) as { raw: string };
    rawMessage = body.raw;
    return new Response(JSON.stringify({ id: "msg-plain" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sendSpecialStainRequiredEmail({
      to: ["vet@example.com"],
      clinicName: "Clinica Test",
      trackingCaseId: 1,
      receptionAt: new Date("2026-01-01T10:00:00Z"),
      estimatedDeliveryAt: new Date("2026-01-05T10:00:00Z"),
      currentStage: "analysis",
    });
  } finally {
    (globalThis as any).fetch = originalFetch;
    restoreEnv(snap);
  }

  assert.ok(rawMessage.length > 0);
  const mime = decodeBase64Url(rawMessage);
  const firstBlank = mime.indexOf("\r\n\r\n");
  const outerHeaders = mime.slice(0, firstBlank);

  assert.ok(outerHeaders.includes("Content-Type: text/plain; charset=UTF-8"),
    "no-html path must produce text/plain");
  assert.equal(outerHeaders.includes("multipart/alternative"), false,
    "no-html path must NOT produce multipart");
});

// ─── Gmail API: multipart/alternative when html present ──────────────────────

test("Gmail API genera multipart/alternative cuando la funcion aporta html", async () => {
  const snap = snapshotEnv();
  const originalFetch = globalThis.fetch;
  let rawMessage = "";

  (ENV as any).isProduction = true;
  (ENV as any).contactTo = ["ops@vetneb.com"];
  enableGmailApi();

  (globalThis as any).fetch = async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "tok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const body = JSON.parse(String(init?.body)) as { raw: string };
    rawMessage = body.raw;
    return new Response(JSON.stringify({ id: "msg-multipart" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await sendContactMessageEmail({
      name: "Ana Torres",
      email: "ana@example.com",
      clinicName: "Clinica Norte",
      message: "Consulta de prueba.",
    });
  } finally {
    (globalThis as any).fetch = originalFetch;
    restoreEnv(snap);
  }

  assert.ok(rawMessage.length > 0);
  const mime = decodeBase64Url(rawMessage);
  const firstBlank = mime.indexOf("\r\n\r\n");
  const outerHeaders = mime.slice(0, firstBlank);
  const outerBody = mime.slice(firstBlank + 4);

  assert.ok(outerHeaders.includes("Content-Type: multipart/alternative;"),
    "must be multipart/alternative");
  assert.ok(outerBody.includes("Content-Type: text/plain; charset=UTF-8"),
    "must contain text/plain part");
  assert.ok(outerBody.includes("Content-Type: text/html; charset=UTF-8"),
    "must contain text/html part");
  assert.ok(outerBody.includes("<!DOCTYPE html>"), "html part must contain doctype");
  assert.ok(outerBody.includes("Ana Torres"), "html part must contain name");
});

// ─── SMTP: html recibido cuando hay template HTML ────────────────────────────

test("SMTP recibe html en sendParticularTokenEmail", async () => {
  const snap = snapshotEnv();
  const originalCreateTransport = nodemailer.createTransport;
  const sendMailCalls: Array<Record<string, unknown>> = [];

  // Unique host busts transporter cache from any prior SMTP test
  (ENV.gmailApi as any).enabled = false;
  (ENV.gmailApi as any).clientId = "";
  (ENV.gmailApi as any).clientSecret = "";
  (ENV.gmailApi as any).refreshToken = "";
  (ENV.gmailApi as any).from = "";
  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp-html-particular.test";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "smtp-user-html";
  (ENV.smtp as any).pass = "smtp-pass-html";
  (ENV.smtp as any).from = "lab.vetneb@example.com";

  (nodemailer as any).createTransport = () => ({
    sendMail: async (p: Record<string, unknown>) => {
      sendMailCalls.push(p);
      return { messageId: "smtp-token" };
    },
  });

  let result: Awaited<ReturnType<typeof sendParticularTokenEmail>> | null = null;

  try {
    result = await sendParticularTokenEmail({
      to: "tutor@example.com",
      token: "ABC-DEF-XYZ",
      tutorLastName: "Perez",
      petName: "Max",
    });
  } finally {
    (nodemailer as any).createTransport = originalCreateTransport;
    restoreEnv(snap);
  }

  assert.equal(result?.sent, true, "result.sent must be true");
  assert.equal(sendMailCalls.length, 1);
  const p = sendMailCalls[0];
  assert.equal(typeof p.text, "string", "text must be present");
  assert.equal(typeof p.html, "string", "html must be present for token email");
  assert.ok(String(p.html).includes("<!DOCTYPE html>"));
  assert.ok(String(p.html).includes("ABC-DEF-XYZ"), "token must appear in html");
  assert.ok(String(p.html).includes("Perez"));
  assert.ok(String(p.html).includes("Max"));
});

// ─── sendContactMessageEmail: usa text + html ────────────────────────────────

test("sendContactMessageEmail usa text y html via SMTP", async () => {
  const snap = snapshotEnv();
  const originalCreateTransport = nodemailer.createTransport;
  const sendMailCalls: Array<Record<string, unknown>> = [];

  // Unique host busts transporter cache from any prior SMTP test
  (ENV as any).isProduction = true;
  (ENV as any).contactTo = ["ops@vetneb.com"];
  (ENV.gmailApi as any).enabled = false;
  (ENV.gmailApi as any).clientId = "";
  (ENV.gmailApi as any).clientSecret = "";
  (ENV.gmailApi as any).refreshToken = "";
  (ENV.gmailApi as any).from = "";
  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp-html-contact.test";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "smtp-user-html";
  (ENV.smtp as any).pass = "smtp-pass-html";
  (ENV.smtp as any).from = "lab.vetneb@example.com";

  (nodemailer as any).createTransport = () => ({
    sendMail: async (p: Record<string, unknown>) => {
      sendMailCalls.push(p);
      return { messageId: "smtp-contact" };
    },
  });

  let result: Awaited<ReturnType<typeof sendContactMessageEmail>> | null = null;

  try {
    result = await sendContactMessageEmail({
      name: "Laura Garcia",
      email: "laura@example.com",
      clinicName: "Clinica Sur",
      message: "Quiero registrar mi clinica.",
    });
  } finally {
    (nodemailer as any).createTransport = originalCreateTransport;
    restoreEnv(snap);
  }

  assert.equal(result?.sent, true, "result.sent must be true");
  assert.equal(sendMailCalls.length, 1);
  const p = sendMailCalls[0];
  assert.equal(typeof p.text, "string");
  assert.ok(String(p.text).includes("Laura Garcia"));
  assert.equal(typeof p.html, "string");
  assert.ok(String(p.html).includes("<!DOCTYPE html>"));
  assert.ok(String(p.html).includes("Clinica Sur"));
  assert.ok(String(p.html).includes("laura@example.com"));
});

// ─── Portal CTA: HTML token particular con portalUrl ─────────────────────────

test("sendParticularTokenEmail HTML contiene boton CTA y no expone token en href", async () => {
  const snap = snapshotEnv();
  const originalCreateTransport = nodemailer.createTransport;
  const sendMailCalls: Array<Record<string, unknown>> = [];

  (ENV.gmailApi as any).enabled = false;
  (ENV.gmailApi as any).clientId = "";
  (ENV.gmailApi as any).clientSecret = "";
  (ENV.gmailApi as any).refreshToken = "";
  (ENV.gmailApi as any).from = "";
  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp-cta-particular.test";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "u";
  (ENV.smtp as any).pass = "p";
  (ENV.smtp as any).from = "noreply@vetneb.com";
  (ENV as any).corsOrigins = ["https://portal.vetneb.com"];

  (nodemailer as any).createTransport = () => ({
    sendMail: async (p: Record<string, unknown>) => {
      sendMailCalls.push(p);
      return { messageId: "cta-test" };
    },
  });

  try {
    await sendParticularTokenEmail({
      to: "tutor@example.com",
      token: "TOKEN-CTA-TEST",
      tutorLastName: "Gomez",
      petName: "Luna",
    });
  } finally {
    (nodemailer as any).createTransport = originalCreateTransport;
    restoreEnv(snap);
  }

  assert.equal(sendMailCalls.length, 1);
  const html = String(sendMailCalls[0].html);

  // Botón CTA presente con href al portal
  assert.ok(html.includes("Abrir Portal VETNEB"), "debe contener texto del boton CTA");
  assert.ok(
    html.includes("href=\"https://portal.vetneb.com/particulares\""),
    "href debe apuntar a /particulares",
  );

  // Token visible en bloque pero NO en href
  assert.ok(html.includes("TOKEN-CTA-TEST"), "token debe aparecer en el html");
  const tokenInHref = [...html.matchAll(/href="([^"]*)"/g)].some(
    (m) => m[1].includes("TOKEN-CTA-TEST"),
  );
  assert.equal(tokenInHref, false, "token no debe aparecer dentro de un href");

  // Seguridad: sin JavaScript en el email
  assert.equal(html.includes("<script"), false, "no debe contener <script");
  assert.equal(html.includes("onclick"), false, "no debe contener onclick");
  assert.equal(html.includes("javascript:"), false, "no debe contener javascript:");

  // Texto honesto de copy-paste
  assert.ok(html.includes("no se copia autom"), "debe incluir aviso de copia manual");
});

test("sendParticularTokenEmail HTML sin corsOrigins https no incluye boton CTA", async () => {
  const snap = snapshotEnv();
  const originalCreateTransport = nodemailer.createTransport;
  const sendMailCalls: Array<Record<string, unknown>> = [];

  (ENV.gmailApi as any).enabled = false;
  (ENV.gmailApi as any).clientId = "";
  (ENV.gmailApi as any).clientSecret = "";
  (ENV.gmailApi as any).refreshToken = "";
  (ENV.gmailApi as any).from = "";
  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp-no-cta-particular.test";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "u";
  (ENV.smtp as any).pass = "p";
  (ENV.smtp as any).from = "noreply@vetneb.com";
  (ENV as any).corsOrigins = ["http://localhost:3000"];

  (nodemailer as any).createTransport = () => ({
    sendMail: async (p: Record<string, unknown>) => {
      sendMailCalls.push(p);
      return { messageId: "no-cta-test" };
    },
  });

  try {
    await sendParticularTokenEmail({
      to: "tutor@example.com",
      token: "TOKEN-NO-CTA",
      tutorLastName: "Lopez",
      petName: "Rex",
    });
  } finally {
    (nodemailer as any).createTransport = originalCreateTransport;
    restoreEnv(snap);
  }

  assert.equal(sendMailCalls.length, 1);
  const html = String(sendMailCalls[0].html);

  assert.ok(html.includes("TOKEN-NO-CTA"), "token debe aparecer en html");
  assert.equal(
    html.includes("Abrir Portal VETNEB"),
    false,
    "no debe mostrar boton CTA sin https origin",
  );
  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("onclick"), false);
});

test("sendParticularTokenEmail text/plain con portalUrl incluye URL del portal y token", async () => {
  const snap = snapshotEnv();
  const originalCreateTransport = nodemailer.createTransport;
  const sendMailCalls: Array<Record<string, unknown>> = [];

  (ENV.gmailApi as any).enabled = false;
  (ENV.gmailApi as any).clientId = "";
  (ENV.gmailApi as any).clientSecret = "";
  (ENV.gmailApi as any).refreshToken = "";
  (ENV.gmailApi as any).from = "";
  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp-text-cta.test";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "u";
  (ENV.smtp as any).pass = "p";
  (ENV.smtp as any).from = "noreply@vetneb.com";
  (ENV as any).corsOrigins = ["https://portal.vetneb.com"];

  (nodemailer as any).createTransport = () => ({
    sendMail: async (p: Record<string, unknown>) => {
      sendMailCalls.push(p);
      return { messageId: "text-cta-test" };
    },
  });

  try {
    await sendParticularTokenEmail({
      to: "tutor@example.com",
      token: "TOKEN-TEXT-CTA",
      tutorLastName: "Ramirez",
      petName: "Paco",
    });
  } finally {
    (nodemailer as any).createTransport = originalCreateTransport;
    restoreEnv(snap);
  }

  assert.equal(sendMailCalls.length, 1);
  const text = String(sendMailCalls[0].text);

  assert.ok(text.includes("TOKEN-TEXT-CTA"), "token debe aparecer en text/plain");
  assert.ok(
    text.includes("https://portal.vetneb.com/particulares"),
    "text/plain debe incluir URL del portal",
  );
  assert.ok(text.includes("Copiá este token"), "debe incluir instruccion de copia");
  assert.equal(text.includes("?token="), false, "token no debe estar en query string");
});

test("seguridad: token no aparece en ningun href del HTML particular", async () => {
  const snap = snapshotEnv();
  const originalCreateTransport = nodemailer.createTransport;
  const sendMailCalls: Array<Record<string, unknown>> = [];

  (ENV.gmailApi as any).enabled = false;
  (ENV.gmailApi as any).clientId = "";
  (ENV.gmailApi as any).clientSecret = "";
  (ENV.gmailApi as any).refreshToken = "";
  (ENV.gmailApi as any).from = "";
  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp-sec-token.test";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "u";
  (ENV.smtp as any).pass = "p";
  (ENV.smtp as any).from = "noreply@vetneb.com";
  (ENV as any).corsOrigins = ["https://portal.vetneb.com"];

  (nodemailer as any).createTransport = () => ({
    sendMail: async (p: Record<string, unknown>) => {
      sendMailCalls.push(p);
      return { messageId: "sec-test" };
    },
  });

  const token = "SUPER-SECRET-TOKEN-XYZ";

  try {
    await sendParticularTokenEmail({
      to: "tutor@example.com",
      token,
      tutorLastName: "Villa",
      petName: "Coco",
    });
  } finally {
    (nodemailer as any).createTransport = originalCreateTransport;
    restoreEnv(snap);
  }

  assert.equal(sendMailCalls.length, 1);
  const html = String(sendMailCalls[0].html);

  assert.ok(html.includes(token), "token debe estar visible en html");

  const hrefMatches = [...html.matchAll(/href="([^"]*)"/g)];
  for (const match of hrefMatches) {
    assert.equal(
      match[1].includes(token),
      false,
      `token no debe aparecer en href: ${match[1]}`,
    );
  }

  assert.equal(html.includes("?token="), false, "token no debe estar en query string");
  assert.equal(
    html.includes(`/particulares/${token}`),
    false,
    "token no debe estar en path de href",
  );
});

// ─── Guardrail: ausencia de JS y clipboard en email HTML particular ───────────

test("guardrail: email html particular no contiene navigator.clipboard ni scripts de lado cliente", async () => {
  const snap = snapshotEnv();
  const originalCreateTransport = nodemailer.createTransport;
  const sendMailCalls: Array<Record<string, unknown>> = [];

  (ENV.gmailApi as any).enabled = false;
  (ENV.gmailApi as any).clientId = "";
  (ENV.gmailApi as any).clientSecret = "";
  (ENV.gmailApi as any).refreshToken = "";
  (ENV.gmailApi as any).from = "";
  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp-guardrail-clipboard.test";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "u";
  (ENV.smtp as any).pass = "p";
  (ENV.smtp as any).from = "noreply@vetneb.com";
  (ENV as any).corsOrigins = ["https://portal.vetneb.com"];

  (nodemailer as any).createTransport = () => ({
    sendMail: async (p: Record<string, unknown>) => {
      sendMailCalls.push(p);
      return { messageId: "guardrail-clipboard" };
    },
  });

  try {
    await sendParticularTokenEmail({
      to: "tutor@example.com",
      token: "GUARDRAIL-TOKEN-001",
      tutorLastName: "Perez",
      petName: "Milo",
    });
  } finally {
    (nodemailer as any).createTransport = originalCreateTransport;
    restoreEnv(snap);
  }

  assert.equal(sendMailCalls.length, 1);
  const html = String(sendMailCalls[0].html);

  assert.equal(html.includes("navigator.clipboard"), false, "email html no debe contener navigator.clipboard");
  assert.equal(html.includes("<script"), false, "email html no debe contener <script");
  assert.equal(html.includes("onclick"), false, "email html no debe contener onclick");
  assert.equal(html.includes("javascript:"), false, "email html no debe contener javascript:");
  assert.equal(html.includes("?token="), false, "token no debe aparecer en query string del html");
});
