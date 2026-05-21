import nodemailer, { type Transporter } from "nodemailer";
import { ENV } from "./env.ts";

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey: string | null = null;

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

  cachedTransporter = nodemailer.createTransport({
    host: ENV.smtp.host,
    port: ENV.smtp.port,
    secure: ENV.smtp.secure,
    auth: {
      user: ENV.smtp.user,
      pass: ENV.smtp.pass,
    },
  });
  cachedTransporterKey = transporterKey;

  return cachedTransporter;
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

export async function sendContactMessageEmail(input: {
  name: string;
  email: string;
  clinicName: string | null;
  message: string;
}): Promise<
  | { sent: false; reason: "smtp_disabled" }
  | { sent: true; messageId: string }
> {
  const recipients = normalizeRecipients(
    ENV.contactTo.length > 0 ? ENV.contactTo : [ENV.smtp.from],
  );

  const transporter = getTransporter();

  if (!transporter || recipients.length === 0) {
    console.info("[EMAIL] contact_message skipped: smtp disabled", {
      email: input.email,
      clinicName: input.clinicName,
    });

    return { sent: false, reason: "smtp_disabled" as const };
  }

  const info = await transporter.sendMail({
    from: ENV.smtp.from,
    to: recipients.join(", "),
    replyTo: input.email,
    subject: `[VETNEB] Contacto web: ${input.name}`,
    text: buildContactMessageText(input),
  });

  console.info("[EMAIL] contact_message sent", {
    email: input.email,
    clinicName: input.clinicName,
    messageId: info.messageId,
  });

  return {
    sent: true,
    messageId: info.messageId,
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

  const transporter = getTransporter();

  if (!transporter) {
    console.info("[EMAIL] special_stain_required skipped: smtp disabled", {
      trackingCaseId: input.trackingCaseId,
      recipients,
    });

    return { sent: false, reason: "smtp_disabled" as const };
  }

  const info = await transporter.sendMail({
    from: ENV.smtp.from,
    to: recipients.join(", "),
    subject: `[VETNEB] Estudio #${input.trackingCaseId}: requiere tinción especial`,
    text: buildSpecialStainRequiredText(input),
  });

  console.info("[EMAIL] special_stain_required sent", {
    trackingCaseId: input.trackingCaseId,
    recipients,
    messageId: info.messageId,
  });

  return {
    sent: true,
    messageId: info.messageId,
  };
}
