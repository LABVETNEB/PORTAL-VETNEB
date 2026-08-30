import nodemailer, { type Transporter } from "nodemailer";
import { ENV } from "./env.ts";

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey: string | null = null;

type VetnebSmtpTransportOptions =
  Parameters<typeof nodemailer.createTransport>[0] & {
    family: 4;
    tls: {
      servername: string;
    };
  };

type EmailTransportMessage = {
  to: string[];
  replyTo?: string | null;
  subject: string;
  text: string;
  html?: string;
};

type EmailTransportResult = {
  transport: "gmail_api" | "smtp";
  messageId: string;
};

type SafeEmailTransportErrorInput = {
  code: string;
  command: string;
  responseCode?: number;
  hostname: string;
  providerError?: string;
  providerStatus?: string;
  providerReason?: string;
  providerMessage?: string;
};

const GMAIL_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_MESSAGES_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

class SafeEmailTransportError extends Error {
  code: string;
  command: string;
  responseCode?: number;
  hostname: string;
  providerError?: string;
  providerStatus?: string;
  providerReason?: string;
  providerMessage?: string;

  constructor(message: string, input: SafeEmailTransportErrorInput) {
    super(message);
    this.name = "EmailTransportError";
    this.code = input.code;
    this.command = input.command;
    this.hostname = input.hostname;

    if (typeof input.responseCode === "number") {
      this.responseCode = input.responseCode;
    }

    if (typeof input.providerError === "string") {
      this.providerError = input.providerError;
    }

    if (typeof input.providerStatus === "string") {
      this.providerStatus = input.providerStatus;
    }

    if (typeof input.providerReason === "string") {
      this.providerReason = input.providerReason;
    }

    if (typeof input.providerMessage === "string") {
      this.providerMessage = input.providerMessage;
    }
  }
}

const MAX_SAFE_LOG_STRING_LENGTH = 200;

const SENSITIVE_REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/ya29\.[A-Za-z0-9_\-]{4,}/g, "[REDACTED:access_token]"],
  [/1\/\/[A-Za-z0-9_\-]{4,}/g, "[REDACTED:refresh_token]"],
  [/Bearer\s+\S+/gi, "Bearer [REDACTED]"],
  [/"refresh_token"\s*:\s*"[^"]*"/g, '"refresh_token":"[REDACTED]"'],
  [/"access_token"\s*:\s*"[^"]*"/g, '"access_token":"[REDACTED]"'],
  [/"client_secret"\s*:\s*"[^"]*"/g, '"client_secret":"[REDACTED]"'],
  [/\btoken=[^\s&"]+/gi, "token=[REDACTED]"],
  [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[REDACTED:email]"],
];

function sanitizeLogString(value: string): string {
  let result = value;

  for (const [pattern, replacement] of SENSITIVE_REDACTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  if (result.length > MAX_SAFE_LOG_STRING_LENGTH) {
    result = `${result.slice(0, MAX_SAFE_LOG_STRING_LENGTH)}...[truncated]`;
  }

  return result;
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeRecipients(values: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();

  for (const rawValue of values) {
    if (typeof rawValue !== "string") {
      continue;
    }

    for (const item of rawValue
      .split(/[;,]/g)
      .map((part) => part.trim())
      .filter(Boolean)) {
      const normalized = item.toLowerCase();

      if (isLikelyEmail(normalized)) {
        unique.add(normalized);
      }
    }
  }

  return Array.from(unique);
}

function getTransporter(): Transporter | null {
  if (!ENV.smtp.enabled) {
    return null;
  }

  const transporterKey = JSON.stringify([
    ENV.smtp.host,
    ENV.smtp.port,
    ENV.smtp.secure,
    ENV.smtp.user,
  ]);

  if (cachedTransporter && cachedTransporterKey === transporterKey) {
    return cachedTransporter;
  }

  const transporterOptions = {
    host: ENV.smtp.host,
    port: ENV.smtp.port,
    secure: ENV.smtp.secure,
    auth: {
      user: ENV.smtp.user,
      pass: ENV.smtp.pass,
    },
    family: 4,
    tls: {
      servername: ENV.smtp.host,
    },
  } as VetnebSmtpTransportOptions;

  cachedTransporter = nodemailer.createTransport(transporterOptions);
  cachedTransporterKey = transporterKey;

  return cachedTransporter;
}

function sanitizeHeaderValue(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildTextMimeMessage(input: {
  from: string;
  to: string[];
  replyTo?: string | null;
  subject: string;
  text: string;
}) {
  const headers = [
    `From: ${sanitizeHeaderValue(input.from)}`,
    `To: ${input.to.map(sanitizeHeaderValue).join(", ")}`,
    `Subject: ${sanitizeHeaderValue(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ];

  const replyTo = input.replyTo ? sanitizeHeaderValue(input.replyTo) : "";

  if (replyTo) {
    headers.splice(2, 0, `Reply-To: ${replyTo}`);
  }

  return `${headers.join("\r\n")}\r\n\r\n${input.text}`;
}

function buildMultipartMimeMessage(input: {
  from: string;
  to: string[];
  replyTo?: string | null;
  subject: string;
  text: string;
  html: string;
}): string {
  const boundary = `----=_Part_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${sanitizeHeaderValue(input.from)}`,
    `To: ${input.to.map(sanitizeHeaderValue).join(", ")}`,
    `Subject: ${sanitizeHeaderValue(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const replyTo = input.replyTo ? sanitizeHeaderValue(input.replyTo) : "";

  if (replyTo) {
    headers.splice(2, 0, `Reply-To: ${replyTo}`);
  }

  const textPart = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
  ].join("\r\n");

  const htmlPart = [
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
  ].join("\r\n");

  return `${headers.join("\r\n")}\r\n\r\n${textPart}\r\n\r\n${htmlPart}\r\n\r\n--${boundary}--`;
}

function buildMimeMessage(input: {
  from: string;
  to: string[];
  replyTo?: string | null;
  subject: string;
  text: string;
  html?: string;
}): string {
  if (input.html) {
    return buildMultipartMimeMessage({ ...input, html: input.html });
  }

  return buildTextMimeMessage(input);
}

function buildGmailApiError(
  message: string,
  input: {
    code: string;
    command: string;
    url: string;
    responseCode?: number;
    providerError?: string;
    providerStatus?: string;
    providerReason?: string;
    providerMessage?: string;
  },
) {
  return new SafeEmailTransportError(message, {
    code: input.code,
    command: input.command,
    responseCode: input.responseCode,
    hostname: new URL(input.url).hostname,
    providerError: input.providerError,
    providerStatus: input.providerStatus,
    providerReason: input.providerReason,
    providerMessage: input.providerMessage,
  });
}

async function fetchGmailApi(
  url: string,
  init: RequestInit,
  input: {
    code: string;
    command: string;
    message: string;
  },
) {
  try {
    return await fetch(url, init);
  } catch {
    throw buildGmailApiError(input.message, {
      code: input.code,
      command: input.command,
      url,
    });
  }
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => null);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
}

async function getGmailApiAccessToken() {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: ENV.gmailApi.clientId,
    client_secret: ENV.gmailApi.clientSecret,
    refresh_token: ENV.gmailApi.refreshToken,
  });

  const response = await fetchGmailApi(
    GMAIL_OAUTH_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
    {
      code: "GMAIL_API_TOKEN_FAILED",
      command: "TOKEN",
      message: "Gmail API token request failed",
    },
  );

  if (!response.ok) {
    const errorBody = await readJsonObject(response);

    throw buildGmailApiError("Gmail API token request failed", {
      code: "GMAIL_API_TOKEN_FAILED",
      command: "TOKEN",
      url: GMAIL_OAUTH_TOKEN_URL,
      responseCode: response.status,
      providerError: typeof errorBody.error === "string" ? errorBody.error : undefined,
      providerReason: typeof errorBody.error_description === "string" ? errorBody.error_description : undefined,
    });
  }

  const payload = await readJsonObject(response);
  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token.trim() : "";

  if (!accessToken) {
    throw buildGmailApiError("Gmail API token response invalid", {
      code: "GMAIL_API_TOKEN_INVALID",
      command: "TOKEN",
      url: GMAIL_OAUTH_TOKEN_URL,
      responseCode: response.status,
    });
  }

  return accessToken;
}

async function sendGmailApiMessage(
  input: EmailTransportMessage,
): Promise<EmailTransportResult> {
  const accessToken = await getGmailApiAccessToken();
  const raw = base64UrlEncode(
    buildMimeMessage({
      from: ENV.gmailApi.from,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  );

  const response = await fetchGmailApi(
    GMAIL_MESSAGES_SEND_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
    {
      code: "GMAIL_API_SEND_FAILED",
      command: "SEND",
      message: "Gmail API send request failed",
    },
  );

  if (!response.ok) {
    const errorBody = await readJsonObject(response);
    const providerErrorObj =
      errorBody.error !== null &&
      typeof errorBody.error === "object" &&
      !Array.isArray(errorBody.error)
        ? (errorBody.error as Record<string, unknown>)
        : null;

    throw buildGmailApiError("Gmail API send request failed", {
      code: "GMAIL_API_SEND_FAILED",
      command: "SEND",
      url: GMAIL_MESSAGES_SEND_URL,
      responseCode: response.status,
      providerError: providerErrorObj && typeof providerErrorObj.status === "string"
        ? providerErrorObj.status
        : undefined,
      providerMessage: providerErrorObj && typeof providerErrorObj.message === "string"
        ? providerErrorObj.message
        : undefined,
    });
  }

  const payload = await readJsonObject(response);
  const messageId = typeof payload.id === "string" && payload.id.trim()
    ? payload.id.trim()
    : "gmail-api-message-sent";

  return {
    transport: "gmail_api",
    messageId,
  };
}

async function sendConfiguredEmailMessage(
  input: EmailTransportMessage,
): Promise<EmailTransportResult | null> {
  if (ENV.gmailApi.enabled) {
    return sendGmailApiMessage(input);
  }

  const transporter = getTransporter();

  if (!transporter) {
    return null;
  }

  const info = await transporter.sendMail({
    from: ENV.smtp.from,
    to: input.to.join(", "),
    replyTo: input.replyTo ?? undefined,
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
  });

  return {
    transport: "smtp",
    messageId: info.messageId,
  };
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Cordoba",
  }).format(value);
}

function buildSpecialStainRequiredText(input: {
  clinicName: string;
  trackingCaseId: number;
  receptionAt: Date;
  estimatedDeliveryAt: Date;
  currentStage: string;
  paymentUrl?: string | null;
  adminContactEmail?: string | null;
  adminContactPhone?: string | null;
  notes?: string | null;
}) {
  const lines = [
    `Hola,`,
    ``,
    `Te informamos que el estudio #${input.trackingCaseId} de la clínica ${input.clinicName} requiere tinción especial.`,
    ``,
    `Estado actual: ${input.currentStage}`,
    `Entrega en laboratorio: ${formatDateTime(input.receptionAt)}`,
    `Fecha estimada de entrega: ${formatDateTime(input.estimatedDeliveryAt)}`,
  ];

  if (input.notes) {
    lines.push(`Observaciones: ${input.notes}`);
  }

  if (input.paymentUrl) {
    lines.push(`Link de pago: ${input.paymentUrl}`);
  }

  if (input.adminContactEmail) {
    lines.push(`Email de contacto administrativo: ${input.adminContactEmail}`);
  }

  if (input.adminContactPhone) {
    lines.push(`Teléfono de contacto administrativo: ${input.adminContactPhone}`);
  }

  lines.push(
    ``,
    `Ingresá al portal para revisar el seguimiento y continuar la gestión.`,
    ``,
    `Equipo VETNEB`,
  );

  return lines.join("\n");
}

function buildContactMessageText(input: {
  name: string;
  email: string;
  clinicName: string | null;
  message: string;
}) {
  return [
    "Nuevo mensaje desde el formulario de contacto de Portal VETNEB",
    "",
    `Nombre: ${input.name}`,
    `Email: ${input.email}`,
    `Clínica: ${input.clinicName ?? "No informada"}`,
    "",
    "Mensaje:",
    input.message,
    "",
    "Equipo VETNEB",
  ].join("\n");
}

function buildParticularTokenText(input: {
  token: string;
  tutorLastName: string;
  petName: string;
  portalUrl?: string | null;
}) {
  const lines = [
    "Hola,",
    "",
    `VETNEB generó un token de acceso particular para consultar el seguimiento o informe de ${input.petName}.`,
    "",
    `Tutor/a: ${input.tutorLastName}`,
    `Paciente: ${input.petName}`,
    `Token de acceso: ${input.token}`,
    "",
  ];

  if (input.portalUrl) {
    lines.push(`Abrí el portal VETNEB: ${input.portalUrl}`);
    lines.push("");
  }

  lines.push(
    "Copiá este token y pegalo en el portal para acceder.",
    "Por seguridad, el token no se copia automáticamente. Copialo manualmente.",
    "",
    "Conservá este token y no lo compartas.",
    "",
    "Equipo VETNEB",
  );

  return lines.join("\n");
}

// ─── HTML helpers ────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function buildVetnebEmailHtml(input: { title: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;">
        <!-- Header -->
        <tr>
          <td style="background-color:#103C61;border-radius:8px 8px 0 0;padding:28px 32px;">
            <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.04em;">VETNEB</span>
            <span style="font-size:13px;color:#a8c8e8;margin-left:10px;vertical-align:middle;">Portal Veterinario</span>
          </td>
        </tr>
        <!-- Card body -->
        <tr>
          <td style="background-color:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            ${input.body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#64748b;">VETNEB &mdash; Servicio de Anatomía Patológica Veterinaria</p>
            <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;">Este es un mensaje automático. Por favor no responda directamente a este correo.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function resolveParticularPortalUrl(
  publicSiteUrl: string | undefined,
  corsOrigins: string[],
): string | null {
  // URL pública canónica explícita (PUBLIC_SITE_URL) tiene prioridad. Se normaliza
  // el trailing slash de forma defensiva para no duplicar la barra del path.
  if (publicSiteUrl) {
    return `${publicSiteUrl.replace(/\/+$/, "")}/particulares`;
  }

  // Fallback de compatibilidad: primer origen https del allowlist CORS.
  const httpsOrigin = corsOrigins.find((o) => /^https:\/\//.test(o));
  return httpsOrigin ? `${httpsOrigin}/particulares` : null;
}

function buildParticularTokenHtml(input: {
  token: string;
  tutorLastName: string;
  petName: string;
  portalUrl?: string | null;
}): string {
  const safePortalUrl = input.portalUrl ?? null;

  const ctaSection = safePortalUrl
    ? `
<p style="margin:0 0 8px;font-size:13px;color:#64748b;">1.&nbsp;Copiá el token de abajo.&nbsp;&nbsp;2.&nbsp;Presioná <strong>Abrir Portal VETNEB</strong>.&nbsp;&nbsp;3.&nbsp;Pegá el token en el portal.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;">
  <tr>
    <td align="center" style="border-radius:6px;background-color:#1D827D;">
      <a href="${escapeHtml(safePortalUrl)}"
         target="_blank"
         rel="noopener noreferrer"
         style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;background-color:#1D827D;">
        Abrir Portal VETNEB
      </a>
    </td>
  </tr>
</table>`
    : `<p style="margin:0 0 8px;font-size:13px;color:#64748b;">Copiá este token y pegalo en el portal.</p>`;

  const body = `
<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#103C61;">Token de acceso particular</h1>
<p style="margin:0 0 24px;font-size:14px;color:#64748b;">Portal VETNEB generó un token de acceso para consultar el seguimiento o informe.</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
      <span style="font-size:13px;color:#64748b;display:inline-block;width:140px;">Tutor/a</span>
      <span style="font-size:14px;font-weight:600;color:#1e293b;">${escapeHtml(input.tutorLastName)}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 0;">
      <span style="font-size:13px;color:#64748b;display:inline-block;width:140px;">Paciente</span>
      <span style="font-size:14px;font-weight:600;color:#1e293b;">${escapeHtml(input.petName)}</span>
    </td>
  </tr>
</table>

<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.06em;">Token de acceso</p>
<div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #1D827D;border-radius:4px;padding:16px 20px;margin-bottom:24px;">
  <code style="font-family:'Courier New',Courier,monospace;font-size:15px;color:#103C61;word-break:break-all;display:block;-webkit-user-select:text;user-select:text;">${escapeHtml(input.token)}</code>
</div>
${ctaSection}
<p style="margin:0 0 8px;font-size:13px;color:#64748b;">Por seguridad, el token no se copia automáticamente desde el email. Copialo manualmente y pegalo en el portal.</p>
<p style="margin:0;font-size:13px;color:#64748b;"><strong>Conservá este token y no lo compartas.</strong></p>`;

  return buildVetnebEmailHtml({ title: "Token de acceso particular – VETNEB", body });
}

function buildContactMessageHtml(input: {
  name: string;
  email: string;
  clinicName: string | null;
  message: string;
}): string {
  const body = `
<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#103C61;">Nuevo mensaje de contacto</h1>
<p style="margin:0 0 24px;font-size:14px;color:#64748b;">Recibiste un mensaje desde el formulario de contacto del Portal VETNEB.</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:4px;">
  <tr style="background-color:#f8fafc;">
    <td style="padding:10px 16px;font-size:13px;color:#64748b;font-weight:600;width:120px;border-bottom:1px solid #e2e8f0;">Nombre</td>
    <td style="padding:10px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${escapeHtml(input.name)}</td>
  </tr>
  <tr>
    <td style="padding:10px 16px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Email</td>
    <td style="padding:10px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${escapeHtml(input.email)}</td>
  </tr>
  <tr style="background-color:#f8fafc;">
    <td style="padding:10px 16px;font-size:13px;color:#64748b;font-weight:600;">Clínica</td>
    <td style="padding:10px 16px;font-size:14px;color:#1e293b;">${escapeHtml(input.clinicName ?? "No informada")}</td>
  </tr>
</table>

<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.06em;">Mensaje</p>
<div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:16px 20px;margin-bottom:8px;">
  <p style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap;">${escapeHtml(input.message)}</p>
</div>`;

  return buildVetnebEmailHtml({ title: "Nuevo contacto web – VETNEB", body });
}

// ─────────────────────────────────────────────────────────────────────────────

function resolveContactRecipients(): string[] {
  const explicitRecipients = normalizeRecipients(ENV.contactTo);

  if (explicitRecipients.length > 0) {
    return explicitRecipients;
  }

  if (!ENV.isProduction) {
    const fallbackFrom = ENV.gmailApi.enabled
      ? ENV.gmailApi.from
      : ENV.smtp.from;

    return normalizeRecipients([fallbackFrom]);
  }

  return [];
}

export function getSafeEmailTransportErrorMetadata(
  error: unknown,
): Record<string, unknown> {
  if (error instanceof SafeEmailTransportError) {
    const metadata: Record<string, unknown> = {
      errorName: error.name,
      code: error.code,
      command: error.command,
      hostname: error.hostname,
    };

    if (typeof error.responseCode === "number") {
      metadata.responseCode = error.responseCode;
    }

    if (typeof error.providerError === "string") {
      metadata.providerError = sanitizeLogString(error.providerError);
    }

    if (typeof error.providerStatus === "string") {
      metadata.providerStatus = sanitizeLogString(error.providerStatus);
    }

    if (typeof error.providerReason === "string") {
      metadata.providerReason = sanitizeLogString(error.providerReason);
    }

    if (typeof error.providerMessage === "string") {
      metadata.providerMessage = sanitizeLogString(error.providerMessage);
    }

    return metadata;
  }


  const metadata: Record<string, unknown> = {
    errorName:
      error instanceof Error && error.name.trim()
        ? error.name
        : "unknown_error",
  };

  if (!error || typeof error !== "object") {
    return metadata;
  }

  const record = error as Record<string, unknown>;

  const code =
    typeof record.code === "string" && record.code.trim()
      ? record.code.trim()
      : undefined;
  const command =
    typeof record.command === "string" && record.command.trim()
      ? record.command.trim()
      : undefined;
  const responseCode =
    typeof record.responseCode === "number" &&
    Number.isFinite(record.responseCode)
      ? record.responseCode
      : undefined;
  const syscall =
    typeof record.syscall === "string" && record.syscall.trim()
      ? record.syscall.trim()
      : undefined;
  const hostname =
    typeof record.hostname === "string" && record.hostname.trim()
      ? sanitizeLogString(record.hostname.trim())
      : undefined;
  const port =
    typeof record.port === "number" && Number.isFinite(record.port)
      ? record.port
      : undefined;
  const address =
    typeof record.address === "string" && record.address.trim()
      ? sanitizeLogString(record.address.trim())
      : undefined;

  if (code !== undefined) metadata.code = code;
  if (command !== undefined) metadata.command = command;
  if (responseCode !== undefined) metadata.responseCode = responseCode;
  if (syscall !== undefined) metadata.errorSyscall = syscall;
  if (hostname !== undefined) metadata.hostname = hostname;
  if (port !== undefined) metadata.errorPort = port;
  if (address !== undefined) metadata.errorAddress = address;

  return metadata;
}

export async function sendContactMessageEmail(input: {
  name: string;
  email: string;
  clinicName: string | null;
  message: string;
}): Promise<
  | { sent: false; reason: "smtp_disabled" }
  | { sent: true; messageId: string }
> {
  const recipients = resolveContactRecipients();

  if (recipients.length === 0) {
    console.info("[EMAIL] contact_message skipped: smtp disabled", {
      hasReplyTo: Boolean(input.email),
      hasClinicName: Boolean(input.clinicName),
    });

    return { sent: false, reason: "smtp_disabled" as const };
  }

  const delivery = await sendConfiguredEmailMessage({
    to: recipients,
    replyTo: input.email,
    subject: `[VETNEB] Contacto web: ${input.name}`,
    text: buildContactMessageText(input),
    html: buildContactMessageHtml(input),
  });

  if (!delivery) {
    console.info("[EMAIL] contact_message skipped: smtp disabled", {
      hasReplyTo: Boolean(input.email),
      hasClinicName: Boolean(input.clinicName),
    });

    return { sent: false, reason: "smtp_disabled" as const };
  }

  console.info("[EMAIL] contact_message sent", {
    hasReplyTo: Boolean(input.email),
    hasClinicName: Boolean(input.clinicName),
    recipientCount: recipients.length,
    messageId: delivery.messageId,
    transport: delivery.transport,
  });

  return {
    sent: true,
    messageId: delivery.messageId,
  };
}

export async function sendParticularTokenEmail(input: {
  to: string;
  token: string;
  tutorLastName: string;
  petName: string;
}): Promise<
  | { sent: false; reason: "no_recipients" | "smtp_disabled" }
  | { sent: true; messageId: string }
> {
  const recipients = normalizeRecipients([input.to]);

  if (recipients.length === 0) {
    console.info("[EMAIL] particular_token skipped: no recipients");

    return { sent: false, reason: "no_recipients" as const };
  }

  const portalUrl = resolveParticularPortalUrl(ENV.publicSiteUrl, ENV.corsOrigins);

  const delivery = await sendConfiguredEmailMessage({
    to: recipients,
    subject: "[VETNEB] Token de acceso particular",
    text: buildParticularTokenText({ ...input, portalUrl }),
    html: buildParticularTokenHtml({ ...input, portalUrl }),
  });

  if (!delivery) {
    console.info("[EMAIL] particular_token skipped: smtp disabled", {
      recipientCount: recipients.length,
    });

    return { sent: false, reason: "smtp_disabled" as const };
  }

  console.info("[EMAIL] particular_token sent", {
    recipientCount: recipients.length,
    messageId: delivery.messageId,
    transport: delivery.transport,
  });

  return {
    sent: true,
    messageId: delivery.messageId,
  };
}

export async function sendSpecialStainRequiredEmail(input: {
  to: Array<string | null | undefined>;
  clinicName: string;
  trackingCaseId: number;
  receptionAt: Date;
  estimatedDeliveryAt: Date;
  currentStage: string;
  paymentUrl?: string | null;
  adminContactEmail?: string | null;
  adminContactPhone?: string | null;
  notes?: string | null;
}) {
  const recipients = normalizeRecipients(input.to);

  if (recipients.length === 0) {
    console.info("[EMAIL] special_stain_required skipped: no recipients", {
      trackingCaseId: input.trackingCaseId,
    });

    return { sent: false, reason: "no_recipients" as const };
  }

  const delivery = await sendConfiguredEmailMessage({
    to: recipients,
    subject: `[VETNEB] Estudio #${input.trackingCaseId}: requiere tinción especial`,
    text: buildSpecialStainRequiredText(input),
  });

  if (!delivery) {
    console.info("[EMAIL] special_stain_required skipped: smtp disabled", {
      trackingCaseId: input.trackingCaseId,
      recipientCount: recipients.length,
    });

    return { sent: false, reason: "smtp_disabled" as const };
  }

  const logPayload: Record<string, unknown> = {
    trackingCaseId: input.trackingCaseId,
    recipientCount: recipients.length,
    messageId: delivery.messageId,
  };

  if (delivery.transport === "gmail_api") {
    logPayload.transport = delivery.transport;
  }

  console.info("[EMAIL] special_stain_required sent", logPayload);

  return {
    sent: true,
    messageId: delivery.messageId,
  };
}
