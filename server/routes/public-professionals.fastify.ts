import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ENV } from "../lib/env.ts";
import {
  PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE,
  PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS,
  PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_ERROR_MESSAGE,
  PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_WINDOW_MS,
} from "../lib/public-professionals-rate-limit.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";

type PublicProfessionalRow = {
  clinicId: number;
  displayName: string;
  avatarStoragePath: string | null;
  aboutText: string | null;
  specialtyText: string | null;
  servicesText: string | null;
  email: string | null;
  phone: string | null;
  locality: string | null;
  country: string | null;
  updatedAt: Date;
  profileQualityScore?: number;
  rank?: number;
  similarity?: number;
  score?: number;
};

type SearchPublicProfessionalsInput = {
  query?: string;
  locality?: string;
  country?: string;
  limit: number;
  offset: number;
};

type SearchPublicProfessionalsResult = {
  rows: PublicProfessionalRow[];
  total: number;
  limit: number;
  offset: number;
};

type SearchPublicProfessionalsFn = (
  input: SearchPublicProfessionalsInput,
) => Promise<SearchPublicProfessionalsResult>;

type GetPublicProfessionalByClinicIdFn = (
  clinicId: number,
) => Promise<PublicProfessionalRow | null | undefined>;

type CreateSignedStorageUrlFn = (
  path: string,
) => Promise<string | null>;

export type PublicProfessionalsNativeRoutesOptions = {
  searchPublicProfessionals?: SearchPublicProfessionalsFn;
  getPublicProfessionalByClinicId?: GetPublicProfessionalByClinicIdFn;
  createSignedStorageUrl?: CreateSignedStorageUrlFn;
  searchRateLimitWindowMs?: number;
  searchRateLimitMaxAttempts?: number;
  detailRateLimitWindowMs?: number;
  detailRateLimitMaxAttempts?: number;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__publicProfessionalsRequestStartTimeNs";

type PublicProfessionalsFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
};

function getAllowedOrigins(): string[] {
  const configuredOrigins = ENV.corsOrigins.map((origin) =>
    origin.trim().toLowerCase(),
  );

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (ENV.isDevelopment) {
    return [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ];
  }

  return [];
}

function normalizeOrigin(origin: string) {
  return origin.trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parsePositiveInt(value: unknown, fallback: number, max?: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return typeof max === "number" ? Math.min(parsed, max) : parsed;
}

function parseOffset(value: unknown, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function parseClinicId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function serializeProfessional(
  row: PublicProfessionalRow,
  createSignedStorageUrl: CreateSignedStorageUrlFn,
) {
  const avatarUrl = row.avatarStoragePath
    ? await createSignedStorageUrl(row.avatarStoragePath)
    : null;

  return {
    clinicId: row.clinicId,
    displayName: row.displayName,
    avatarUrl,
    specialtyText: row.specialtyText,
    servicesText: row.servicesText,
    email: row.email,
    phone: row.phone,
    locality: row.locality,
    country: row.country,
    aboutText: row.aboutText,
    updatedAt: row.updatedAt,
    relevance: {
      rank: row.rank ?? 0,
      similarity: row.similarity ?? 0,
      score: row.score ?? 0,
    },
    profileQualityScore: row.profileQualityScore ?? null,
  };
}

function applyCorsHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  const rawOrigin = request.headers.origin;

  if (typeof rawOrigin !== "string" || !rawOrigin.trim()) {
    return true;
  }

  const origin = rawOrigin.trim();

  if (!allowedOrigins.has(normalizeOrigin(origin))) {
    reply.code(500).send({
      success: false,
      error: "Error interno del servidor",
      path: request.url,
    });
    return false;
  }

  reply.header("vary", "Origin");
  reply.header("access-control-allow-origin", origin);
  reply.header("access-control-allow-credentials", "true");
  reply.header(
    "access-control-expose-headers",
    "RateLimit-Policy, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset",
  );

  return true;
}

function setRateLimitHeaders(
  reply: FastifyReply,
  input: {
    max: number;
    windowMs: number;
    remaining: number;
    resetAt: number;
    now: number;
  },
) {
  reply.header(
    "RateLimit-Policy",
    `${input.max};w=${Math.ceil(input.windowMs / 1000)}`,
  );
  reply.header("RateLimit-Limit", String(input.max));
  reply.header("RateLimit-Remaining", String(Math.max(input.remaining, 0)));
  reply.header(
    "RateLimit-Reset",
    String(Math.max(Math.ceil((input.resetAt - input.now) / 1000), 0)),
  );
}

function createFixedWindowRateLimit(config: {
  windowMs: number;
  max: number;
  errorMessage: string;
  now?: () => number;
}) {
  const entries = new Map<string, { count: number; resetAt: number }>();
  const now = config.now ?? (() => Date.now());

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.ip || "unknown";
    const currentTime = now();
    const currentEntry = entries.get(key);

    let entry = currentEntry;

    if (!entry || entry.resetAt <= currentTime) {
      entry = {
        count: 0,
        resetAt: currentTime + config.windowMs,
      };
      entries.set(key, entry);
    }

    entry.count += 1;

    setRateLimitHeaders(reply, {
      max: config.max,
      windowMs: config.windowMs,
      remaining: config.max - entry.count,
      resetAt: entry.resetAt,
      now: currentTime,
    });

    if (entry.count > config.max) {
      return reply.code(429).send({
        success: false,
        error: config.errorMessage,
      });
    }

    return undefined;
  };
}

async function loadDefaultSearchPublicProfessionals(): Promise<SearchPublicProfessionalsFn> {
  const module = await import("../db-public-professionals.ts");
  return module.searchPublicProfessionals;
}

async function loadDefaultGetPublicProfessionalByClinicId(): Promise<GetPublicProfessionalByClinicIdFn> {
  const module = await import("../db-public-professionals.ts");
  return module.getPublicProfessionalByClinicId;
}

async function loadDefaultCreateSignedStorageUrl(): Promise<CreateSignedStorageUrlFn> {
  const module = await import("../lib/supabase.ts");
  return module.createSignedStorageUrl;
}

export const publicProfessionalsNativeRoutes: FastifyPluginAsync<
  PublicProfessionalsNativeRoutesOptions
> = async (app, options) => {
  const searchPublicProfessionals =
    options.searchPublicProfessionals ??
    (await loadDefaultSearchPublicProfessionals());

  const getPublicProfessionalByClinicId =
    options.getPublicProfessionalByClinicId ??
    (await loadDefaultGetPublicProfessionalByClinicId());

  const createSignedStorageUrl =
    options.createSignedStorageUrl ??
    (await loadDefaultCreateSignedStorageUrl());

  const allowedOrigins = new Set(getAllowedOrigins());

  const searchRateLimit = createFixedWindowRateLimit({
    windowMs:
      options.searchRateLimitWindowMs ??
      PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS,
    max:
      options.searchRateLimitMaxAttempts ??
      PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS,
    errorMessage: PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE,
    now: options.now,
  });

  const detailRateLimit = createFixedWindowRateLimit({
    windowMs:
      options.detailRateLimitWindowMs ??
      PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_WINDOW_MS,
    max:
      options.detailRateLimitMaxAttempts ??
      PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_MAX_ATTEMPTS,
    errorMessage: PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_ERROR_MESSAGE,
    now: options.now,
  });

  app.addHook("onRequest", async (request, reply) => {
    (request as PublicProfessionalsFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    const corsAccepted = applyCorsHeaders(request, reply, allowedOrigins);

    if (!corsAccepted) {
      return reply;
    }

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as PublicProfessionalsFastifyRequest)[REQUEST_START_TIME_KEY] ??
      process.hrtime.bigint();

    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const safeUrl = sanitizeUrlForLogs(request.url);

    console.log(
      buildRequestLogLine({
        timestamp: new Date().toISOString(),
        method: request.method,
        url: safeUrl,
        statusCode: reply.statusCode,
        durationMs,
      }),
    );
  });

  app.get<{
    Querystring: {
      q?: string | number;
      query?: string | number;
      locality?: string | number;
      country?: string | number;
      limit?: string | number;
      offset?: string | number;
    };
  }>(
    "/search",
    {
      preHandler: searchRateLimit,
    },
    async (request, reply) => {
      const query = normalizeText(request.query.q ?? request.query.query);
      const locality = normalizeText(request.query.locality);
      const country = normalizeText(request.query.country);
      const limit = parsePositiveInt(request.query.limit, 20, 50);
      const offset = parseOffset(request.query.offset, 0);

      const result = await searchPublicProfessionals({
        query,
        locality,
        country,
        limit,
        offset,
      });

      const professionals = await Promise.all(
        result.rows.map((row) =>
          serializeProfessional(row, createSignedStorageUrl),
        ),
      );

      return reply.code(200).send({
        success: true,
        count: professionals.length,
        total: result.total,
        professionals,
        filters: {
          query: query ?? null,
          locality: locality ?? null,
          country: country ?? null,
        },
        pagination: {
          limit: result.limit,
          offset: result.offset,
        },
      });
    },
  );

  app.get<{
    Params: {
      clinicId: string;
    };
  }>(
    "/:clinicId",
    {
      preHandler: detailRateLimit,
    },
    async (request, reply) => {
      const clinicId = parseClinicId(request.params.clinicId);

      if (!clinicId) {
        return reply.code(400).send({
          success: false,
          error: "ID de clinica invalido",
        });
      }

      const professional = await getPublicProfessionalByClinicId(clinicId);

      if (!professional) {
        return reply.code(404).send({
          success: false,
          error: "Perfil publico no encontrado",
        });
      }

      return reply.code(200).send({
        success: true,
        professional: await serializeProfessional(
          professional,
          createSignedStorageUrl,
        ),
      });
    },
  );
};
