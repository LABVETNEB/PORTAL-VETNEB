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
    buildTextMimeMessage({
      from: ENV.gmailApi.from,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
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
    `Recepción de muestra: ${formatDateTime(input.receptionAt)}`,
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
}) {
  return [
    "Hola,",
    "",
    `VETNEB generó un token de acceso particular para consultar el seguimiento o informe de ${input.petName}.`,
    "",
    `Tutor/a: ${input.tutorLastName}`,
    `Paciente: ${input.petName}`,
    `Token de acceso: ${input.token}`,
    "",
    "Ingresá al portal VETNEB para usarlo. Conservá este token y no lo compartas.",
    "",
    "Equipo VETNEB",
  ].join("\n");
}

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

  const delivery = await sendConfiguredEmailMessage({
    to: recipients,
    subject: "[VETNEB] Token de acceso particular",
    text: buildParticularTokenText(input),
  });

  if (!delivery) {
    console.info("[EMAIL] particular_token skipped: smtp disabled", {
      recipients,
    });

    return { sent: false, reason: "smtp_disabled" as const };
  }

  console.info("[EMAIL] particular_token sent", {
    recipients,
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
      recipients,
    });

    return { sent: false, reason: "smtp_disabled" as const };
  }

  const logPayload: Record<string, unknown> = {
    trackingCaseId: input.trackingCaseId,
    recipients,
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
