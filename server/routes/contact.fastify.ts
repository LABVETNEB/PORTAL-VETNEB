import { getSafeEmailTransportErrorMetadata } from "../lib/email.ts";
import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { z } from "zod";

import {
  buildContactRateLimitKey,
  CONTACT_RATE_LIMIT_ERROR_MESSAGE,
  CONTACT_RATE_LIMIT_MAX_ATTEMPTS,
  CONTACT_RATE_LIMIT_WINDOW_MS,
} from "../lib/contact-rate-limit.ts";
import { ENV } from "../lib/env.ts";
import {
  enforceTrustedOrigin,
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import {
  createMemoryRateLimitStore,
  getOrCreateRateLimitEntry,
  incrementRateLimitEntry,
  type RateLimitStore,
} from "../lib/rate-limit-store.ts";

type ContactEmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: "smtp_disabled" };

type ContactMessageInput = {
  name: string;
  email: string;
  clinicName: string | null;
  message: string;
};

type SafeContactEmailErrorDiagnostics = {
  errorName: string;
  errorCode?: string;
  errorCommand?: string;
  errorResponseCode?: number;
  errorSyscall?: string;
  errorHostname?: string;
  errorPort?: number;
  errorAddress?: string;
};

export type ContactNativeRoutesOptions = {
  sendContactMessageEmail?: (
    input: ContactMessageInput,
  ) => Promise<ContactEmailResult>;
  contactRateLimitWindowMs?: number;
  contactRateLimitMaxAttempts?: number;
  contactRateLimitStore?: RateLimitStore;
  now?: () => number;
};

type ContactNativeRouteDeps = Required<
  Pick<ContactNativeRoutesOptions, "sendContactMessageEmail">
>;

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  clinicName: z.string().trim().max(180).optional().nullable(),
  message: z.string().trim().min(10).max(4000),
});

let defaultDepsPromise:
  | Promise<ContactNativeRouteDeps>
  | undefined;

async function loadDefaultDeps(): Promise<ContactNativeRouteDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const email = await import("../lib/email.ts");

      return {
        sendContactMessageEmail: email.sendContactMessageEmail,
      };
    })();
  }

  return defaultDepsPromise;
}

async function resolveDeps(
  options: ContactNativeRoutesOptions,
): Promise<ContactNativeRouteDeps> {
  const defaultDeps = options.sendContactMessageEmail
    ? undefined
    : await loadDefaultDeps();

  return {
    sendContactMessageEmail:
      options.sendContactMessageEmail ?? defaultDeps!.sendContactMessageEmail,
  };
}

function applyCorsHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  const allowedOrigin = getAllowedOriginForCors(request, allowedOrigins);

  if (!allowedOrigin) {
    return;
  }

  reply.header("vary", "Origin");
  reply.header("access-control-allow-origin", allowedOrigin);
  reply.header("access-control-allow-credentials", "true");
  reply.header(
    "access-control-expose-headers",
    "RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After",
  );
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  return trimmed ? trimmed : null;
}

function setRateLimitHeaders(
  reply: FastifyReply,
  input: {
    max: number;
    windowMs: number;
    count: number;
    resetAt: number;
    now: number;
  },
) {
  const retryAfterSeconds = Math.max(
    Math.ceil((input.resetAt - input.now) / 1000),
    0,
  );

  reply.header(
    "RateLimit-Policy",
    `${input.max};w=${Math.ceil(input.windowMs / 1000)}`,
  );
  reply.header("RateLimit-Limit", String(input.max));
  reply.header(
    "RateLimit-Remaining",
    String(Math.max(input.max - input.count, 0)),
  );
  reply.header("RateLimit-Reset", String(retryAfterSeconds));

  return retryAfterSeconds;
}

function getKnownErrorProperty(error: unknown, propertyName: string): unknown {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  return (error as Record<string, unknown>)[propertyName];
}

function toSafeNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractSafeContactEmailErrorDiagnostics(
  error: unknown,
): SafeContactEmailErrorDiagnostics {
  const diagnostics: SafeContactEmailErrorDiagnostics = {
    errorName:
      toSafeNonEmptyString(error instanceof Error ? error.name : undefined) ??
      "unknown_error",
  };

  const errorCode = toSafeNonEmptyString(getKnownErrorProperty(error, "code"));
  const errorCommand = toSafeNonEmptyString(
    getKnownErrorProperty(error, "command"),
  );
  const errorResponseCode = toSafeNumber(
    getKnownErrorProperty(error, "responseCode"),
  );
  const errorSyscall = toSafeNonEmptyString(
    getKnownErrorProperty(error, "syscall"),
  );
  const errorHostname = toSafeNonEmptyString(
    getKnownErrorProperty(error, "hostname"),
  );
  const errorPort = toSafeNumber(getKnownErrorProperty(error, "port"));
  const errorAddress = toSafeNonEmptyString(
    getKnownErrorProperty(error, "address"),
  );

  if (errorCode) {
    diagnostics.errorCode = errorCode;
  }

  if (errorCommand) {
    diagnostics.errorCommand = errorCommand;
  }

  if (typeof errorResponseCode === "number") {
    diagnostics.errorResponseCode = errorResponseCode;
  }

  if (errorSyscall) {
    diagnostics.errorSyscall = errorSyscall;
  }

  if (errorHostname) {
    diagnostics.errorHostname = errorHostname;
  }

  if (typeof errorPort === "number") {
    diagnostics.errorPort = errorPort;
  }

  if (errorAddress) {
    diagnostics.errorAddress = errorAddress;
  }

  return diagnostics;
}

export const contactNativeRoutes: FastifyPluginAsync<
  ContactNativeRoutesOptions
> = async (app, options) => {
  const allowedOrigins = new Set(getAllowedOrigins());
  const now = options.now ?? (() => Date.now());
  const contactRateLimitWindowMs =
    options.contactRateLimitWindowMs ?? CONTACT_RATE_LIMIT_WINDOW_MS;
  const contactRateLimitMaxAttempts =
    options.contactRateLimitMaxAttempts ?? CONTACT_RATE_LIMIT_MAX_ATTEMPTS;
  const contactRateLimitStore =
    options.contactRateLimitStore ?? createMemoryRateLimitStore();

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  const optionsHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const requestOrigin = getRequestOrigin(request);

    if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
      return reply.code(403).send({
        success: false,
        error: "Origen no permitido",
      });
    }

    applyCorsHeaders(request, reply, allowedOrigins);
    reply.header("access-control-allow-methods", "POST,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);

  app.post("/", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const currentTime = now();
    const rateLimitKey = buildContactRateLimitKey(request.ip);
    const rateLimitEntry = await getOrCreateRateLimitEntry(
      contactRateLimitStore,
      rateLimitKey,
      contactRateLimitWindowMs,
      currentTime,
    );

    if (rateLimitEntry.count >= contactRateLimitMaxAttempts) {
      const retryAfterSeconds = setRateLimitHeaders(reply, {
        max: contactRateLimitMaxAttempts,
        windowMs: contactRateLimitWindowMs,
        count: rateLimitEntry.count,
        resetAt: rateLimitEntry.resetAt,
        now: currentTime,
      });

      reply.header("Retry-After", String(Math.max(retryAfterSeconds, 1)));

      return reply.code(429).send({
        success: false,
        error: CONTACT_RATE_LIMIT_ERROR_MESSAGE,
      });
    }

    const updatedRateLimitEntry = await incrementRateLimitEntry(
      contactRateLimitStore,
      rateLimitKey,
      rateLimitEntry,
      currentTime,
    );

    rateLimitEntry.count = updatedRateLimitEntry.count;
    rateLimitEntry.resetAt = updatedRateLimitEntry.resetAt;

    setRateLimitHeaders(reply, {
      max: contactRateLimitMaxAttempts,
      windowMs: contactRateLimitWindowMs,
      count: rateLimitEntry.count,
      resetAt: rateLimitEntry.resetAt,
      now: currentTime,
    });

    const parsed = contactSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: "Solicitud de contacto inválida",
        details: parsed.error.issues.map((issue) => issue.message),
      });
    }

    const normalizedClinicName = normalizeOptionalText(parsed.data.clinicName);
    const deps = await resolveDeps(options);

    let result: ContactEmailResult;

    try {
      result = await deps.sendContactMessageEmail({
        name: parsed.data.name,
        email: parsed.data.email,
        clinicName: normalizedClinicName,
        message: parsed.data.message,
      });
    } catch (error) {
      console.error("[EMAIL] contact_message failed", {
        hasClinicName: Boolean(normalizedClinicName),
        ...getSafeEmailTransportErrorMetadata(error),
      });

      return reply.code(502).send({
        success: false,
        reason: "email_delivery_failed",
        error:
          "No se pudo enviar el mensaje en este momento. Intente nuevamente más tarde.",
      });
    }

    return reply.code(result.sent ? 200 : 202).send({
      success: true,
      sent: result.sent,
      reason: result.sent ? undefined : result.reason,
      message: result.sent
        ? "Mensaje enviado correctamente"
        : "Mensaje recibido, pero el envío automático de correo no está configurado. Contacte a VETNEB por los canales oficiales si requiere respuesta inmediata.",
    });
  });
};
