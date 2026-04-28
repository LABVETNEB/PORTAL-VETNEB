import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import multer from "multer";
import type { Multer } from "multer";

import { ENV } from "../lib/env.ts";
import {
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import type { UpsertClinicPublicProfileInput } from "../db-public-professionals.ts";

type ClinicRecord = {
  id: number;
  name?: string | null;
};

type ClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  authProId?: string | null;
  role: unknown;
};

type ActiveSessionRecord = {
  clinicUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type ClinicPublicProfileData = {
  clinic: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  search: Record<string, unknown> | null;
};

type PatchClinicPublicProfileResult = Record<string, unknown> & {
  avatarStoragePath?: string | null;
  displayName?: string | null;
  aboutText?: string | null;
  specialtyText?: string | null;
  servicesText?: string | null;
  email?: string | null;
  phone?: string | null;
  locality?: string | null;
  country?: string | null;
  isPublic?: boolean;
};

type RemoveClinicPublicAvatarResult = {
  previousAvatarStoragePath: string | null;
  profile: Record<string, unknown>;
};

type PublicationPreview = {
  isPublic: boolean;
  hasRequiredPublicFields: boolean;
  hasQualitySupplement: boolean;
  qualityScore: number;
  isSearchEligible: boolean;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
  publicationErrors: string[];
};

type AuthenticatedClinicUser = {
  id: number;
  clinicId: number;
  username: string;
  authProId: string | null;
  role: ReturnType<typeof normalizeClinicUserRole>;
  permissions: ReturnType<typeof getClinicPermissions>;
  canUploadReports: boolean;
  canManageClinicUsers: boolean;
  sessionToken: string;
};

export type ClinicPublicProfileNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getClinicById?: (clinicId: number) => Promise<ClinicRecord | null>;
  getClinicPublicProfileByClinicId?: (
    clinicId: number,
  ) => Promise<ClinicPublicProfileData | null>;
  buildClinicPublicProfileResponse?: (input: {
    clinic: Record<string, unknown>;
    profile: Record<string, unknown> | null;
    avatarUrl: string | null;
  }) => Record<string, unknown>;
  evaluateClinicPublicProfilePublication?: (input: {
    clinic: Record<string, unknown>;
    profile: {
      displayName: string | null;
      avatarStoragePath: string | null;
      aboutText: string | null;
      specialtyText: string | null;
      servicesText: string | null;
      email: string | null;
      phone: string | null;
      locality: string | null;
      country: string | null;
      isPublic: boolean;
    };
  }) => PublicationPreview;
  minPublicProfileQualityScore?: number;
  patchClinicPublicProfile?: (
    clinicId: number,
    input: UpsertClinicPublicProfileInput,
  ) => Promise<PatchClinicPublicProfileResult>;
  removeClinicPublicAvatar?: (
    clinicId: number,
  ) => Promise<RemoveClinicPublicAvatarResult>;
  syncClinicPublicSearch?: (clinicId: number) => Promise<Record<string, unknown> | null>;
  createSignedStorageUrl?: (storagePath: string) => Promise<string>;
  uploadClinicAvatar?: (input: {
    clinicId: number;
    file: Buffer;
    fileName: string;
    mimeType: string;
  }) => Promise<string>;
  deleteStorageObject?: (storagePath: string) => Promise<void>;
  now?: () => number;
};

const REQUEST_START_TIME_KEY = "__clinicPublicProfileRequestStartTimeNs";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const MAX_DISPLAY_NAME = 255;
const MAX_EMAIL = 255;
const MAX_PHONE = 50;
const MAX_LOCALITY = 255;
const MAX_COUNTRY = 255;
const MAX_SPECIALTY = 500;
const MAX_ABOUT = 5000;
const MAX_SERVICES = 5000;

type ClinicPublicProfileFastifyRequest = FastifyRequest & {
  [REQUEST_START_TIME_KEY]?: bigint;
};

type NativeClinicPublicProfileDeps = Required<
  Pick<
    ClinicPublicProfileNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
    | "getClinicById"
    | "getClinicPublicProfileByClinicId"
    | "buildClinicPublicProfileResponse"
    | "evaluateClinicPublicProfilePublication"
    | "minPublicProfileQualityScore"
    | "patchClinicPublicProfile"
    | "removeClinicPublicAvatar"
    | "syncClinicPublicSearch"
    | "createSignedStorageUrl"
    | "uploadClinicAvatar"
    | "deleteStorageObject"
  >
>;

let defaultDepsPromise: Promise<NativeClinicPublicProfileDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeClinicPublicProfileDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const publicProfiles = await import("../db-public-professionals.ts");
      const supabase = await import("../lib/supabase.ts");

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getClinicById: db.getClinicById,
        getClinicPublicProfileByClinicId:
          publicProfiles.getClinicPublicProfileByClinicId,
        buildClinicPublicProfileResponse:
          publicProfiles.buildClinicPublicProfileResponse as unknown as (
            input: {
              clinic: Record<string, unknown>;
              profile: Record<string, unknown> | null;
              avatarUrl: string | null;
            },
          ) => Record<string, unknown>,
        evaluateClinicPublicProfilePublication:
          publicProfiles.evaluateClinicPublicProfilePublication as unknown as (
            input: {
              clinic: Record<string, unknown>;
              profile: {
                displayName: string | null;
                avatarStoragePath: string | null;
                aboutText: string | null;
                specialtyText: string | null;
                servicesText: string | null;
                email: string | null;
                phone: string | null;
                locality: string | null;
                country: string | null;
                isPublic: boolean;
              };
            },
          ) => PublicationPreview,
        minPublicProfileQualityScore:
          publicProfiles.MIN_PUBLIC_PROFILE_QUALITY_SCORE,
        patchClinicPublicProfile: publicProfiles.patchClinicPublicProfile,
        removeClinicPublicAvatar: publicProfiles.removeClinicPublicAvatar,
        syncClinicPublicSearch: publicProfiles.syncClinicPublicSearch,
        createSignedStorageUrl: supabase.createSignedStorageUrl,
        uploadClinicAvatar: supabase.uploadClinicAvatar,
        deleteStorageObject: supabase.deleteStorageObject,
      };
    })();
  }

  return defaultDepsPromise!;
}

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

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin.trim().toLowerCase();
  } catch {
    return null;
  }
}

function getOriginHeader(request: FastifyRequest) {
  return typeof request.headers.origin === "string"
    ? request.headers.origin.trim()
    : "";
}

function getAllowedOriginForCors(
  request: FastifyRequest,
  allowedOrigins: ReadonlySet<string>,
) {
  const rawOrigin = getOriginHeader(request);

  if (!rawOrigin) {
    return null;
  }

  const normalizedOrigin = normalizeOrigin(rawOrigin);

  if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
    return null;
  }

  return rawOrigin;
}

function getRequestOrigin(request: FastifyRequest): string | null {
  const originHeader = getOriginHeader(request);

  if (originHeader) {
    return normalizeOrigin(originHeader);
  }

  const refererHeader =
    typeof request.headers.referer === "string"
      ? request.headers.referer.trim()
      : "";

  if (refererHeader) {
    return normalizeOrigin(refererHeader);
  }

  return null;
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
}

function enforceTrustedOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  const requestOrigin = getRequestOrigin(request);

  if (!requestOrigin) {
    return true;
  }

  if (allowedOrigins.has(requestOrigin)) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "Origen no permitido",
  });

  return false;
}

function parseCookies(cookieHeader: string | undefined) {
  const result: Record<string, string> = {};

  if (!cookieHeader) {
    return result;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.split("=");

    if (!rawName) {
      continue;
    }

    const name = rawName.trim();

    if (!name) {
      continue;
    }

    const rawValue = rawValueParts.join("=").trim();

    try {
      result[name] = decodeURIComponent(rawValue);
    } catch {
      result[name] = rawValue;
    }
  }

  return result;
}

function getSessionToken(request: FastifyRequest) {
  const cookieHeader =
    typeof request.headers.cookie === "string"
      ? request.headers.cookie
      : undefined;

  const cookies = parseCookies(cookieHeader);
  const raw = cookies[ENV.cookieName];

  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

function serializeCookie(input: {
  name: string;
  value: string;
  maxAgeSeconds?: number;
  expires?: string;
}) {
  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${ENV.cookieSameSite}`,
  ];

  if (ENV.cookieSecure) {
    parts.push("Secure");
  }

  if (typeof input.maxAgeSeconds === "number") {
    parts.push(`Max-Age=${input.maxAgeSeconds}`);
  }

  if (input.expires) {
    parts.push(`Expires=${input.expires}`);
  }

  return parts.join("; ");
}

function buildClearSessionCookie() {
  return serializeCookie({
    name: ENV.cookieName,
    value: "",
    maxAgeSeconds: 0,
    expires: "Thu, 01 Jan 1970 00:00:00 GMT",
  });
}

function shouldRefreshSessionLastAccess(
  lastAccess: Date | null | undefined,
  nowMs: number,
) {
  if (!(lastAccess instanceof Date)) {
    return true;
  }

  return nowMs - lastAccess.getTime() >= SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS;
}

function normalizeNullableString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function parseOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "si", "sí"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function buildPatchInput(
  body: Record<string, unknown> | undefined,
): UpsertClinicPublicProfileInput {
  return {
    displayName: normalizeNullableString(body?.displayName, MAX_DISPLAY_NAME),
    aboutText: normalizeNullableString(body?.aboutText, MAX_ABOUT),
    specialtyText: normalizeNullableString(body?.specialtyText, MAX_SPECIALTY),
    servicesText: normalizeNullableString(body?.servicesText, MAX_SERVICES),
    email: normalizeNullableString(body?.email, MAX_EMAIL),
    phone: normalizeNullableString(body?.phone, MAX_PHONE),
    locality: normalizeNullableString(body?.locality, MAX_LOCALITY),
    country: normalizeNullableString(body?.country, MAX_COUNTRY),
    isPublic: parseOptionalBoolean(body?.isPublic),
  };
}

async function authenticateClinicUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeClinicPublicProfileDeps,
  now: () => number,
): Promise<AuthenticatedClinicUser | null> {
  const token = getSessionToken(request);

  if (!token) {
    reply.code(401).send({
      success: false,
      error: "No autenticado",
    });
    return null;
  }

  const tokenHash = deps.hashSessionToken(token);
  const session = await deps.getActiveSessionByToken(tokenHash);

  if (!session) {
    reply.code(401).send({
      success: false,
      error: "Sesión inválida",
    });
    return null;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now()) {
    await deps.deleteActiveSession(tokenHash);

    reply.header("set-cookie", buildClearSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Sesión expirada",
    });
    return null;
  }

  const clinicUser = await deps.getClinicUserById(session.clinicUserId);

  if (!clinicUser) {
    await deps.deleteActiveSession(tokenHash);

    reply.header("set-cookie", buildClearSessionCookie());
    reply.code(401).send({
      success: false,
      error: "Usuario de sesión no encontrado",
    });
    return null;
  }

  if (shouldRefreshSessionLastAccess(session.lastAccess ?? null, now())) {
    await deps.updateSessionLastAccess(tokenHash);
  }

  const role = normalizeClinicUserRole(clinicUser.role, "clinic_staff");
  const permissions = getClinicPermissions(role);

  return {
    id: clinicUser.id,
    clinicId: clinicUser.clinicId,
    username: clinicUser.username,
    authProId: clinicUser.authProId ?? null,
    role,
    permissions,
    canUploadReports: permissions.canUploadReports,
    canManageClinicUsers: permissions.canManageClinicUsers,
    sessionToken: token,
  };
}

function requireClinicManagementPermission(
  auth: AuthenticatedClinicUser,
  reply: FastifyReply,
) {
  if (auth.canManageClinicUsers) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "No autorizado para administrar recursos de la clinica",
  });

  return false;
}

type UploadedMultipartFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

type RawRequestWithFile = FastifyRequest["raw"] & {
  file?: UploadedMultipartFile;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.min(ENV.maxUploadFileSizeMb, 5) * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(new Error("Tipo de avatar no permitido"));
      return;
    }

    cb(null, true);
  },
});

function runAvatarUpload(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<UploadedMultipartFile | undefined> {
  return new Promise((resolve, reject) => {
    upload.single("avatar")(
      request.raw as any,
      reply.raw as any,
      (error: unknown) => {
        if (error) {
          reject(error);
          return;
        }

        resolve((request.raw as RawRequestWithFile).file);
      },
    );
  });
}

function serializeSearch(search: Record<string, unknown> | null) {
  if (!search) {
    return null;
  }

  return {
    clinicId: search.clinicId,
    isPublic: search.isPublic,
    hasRequiredPublicFields: search.hasRequiredPublicFields,
    isSearchEligible: search.isSearchEligible,
    profileQualityScore: search.profileQualityScore,
    updatedAt: search.updatedAt,
    searchText: search.searchText,
  };
}

export const clinicPublicProfileNativeRoutes: FastifyPluginAsync<
  ClinicPublicProfileNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getClinicById &&
    !!options.getClinicPublicProfileByClinicId &&
    !!options.buildClinicPublicProfileResponse &&
    !!options.evaluateClinicPublicProfilePublication &&
    typeof options.minPublicProfileQualityScore === "number" &&
    !!options.patchClinicPublicProfile &&
    !!options.removeClinicPublicAvatar &&
    !!options.syncClinicPublicSearch &&
    !!options.createSignedStorageUrl &&
    !!options.uploadClinicAvatar &&
    !!options.deleteStorageObject;

  const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

  const deps: NativeClinicPublicProfileDeps = {
    deleteActiveSession:
      options.deleteActiveSession ?? defaultDeps!.deleteActiveSession,
    getActiveSessionByToken:
      options.getActiveSessionByToken ?? defaultDeps!.getActiveSessionByToken,
    getClinicUserById:
      options.getClinicUserById ?? defaultDeps!.getClinicUserById,
    updateSessionLastAccess:
      options.updateSessionLastAccess ?? defaultDeps!.updateSessionLastAccess,
    hashSessionToken:
      options.hashSessionToken ?? defaultDeps!.hashSessionToken,
    getClinicById: options.getClinicById ?? defaultDeps!.getClinicById,
    getClinicPublicProfileByClinicId:
      options.getClinicPublicProfileByClinicId ??
      defaultDeps!.getClinicPublicProfileByClinicId,
    buildClinicPublicProfileResponse:
      options.buildClinicPublicProfileResponse ??
      defaultDeps!.buildClinicPublicProfileResponse,
    evaluateClinicPublicProfilePublication:
      options.evaluateClinicPublicProfilePublication ??
      defaultDeps!.evaluateClinicPublicProfilePublication,
    minPublicProfileQualityScore:
      options.minPublicProfileQualityScore ??
      defaultDeps!.minPublicProfileQualityScore,
    patchClinicPublicProfile:
      options.patchClinicPublicProfile ?? defaultDeps!.patchClinicPublicProfile,
    removeClinicPublicAvatar:
      options.removeClinicPublicAvatar ?? defaultDeps!.removeClinicPublicAvatar,
    syncClinicPublicSearch:
      options.syncClinicPublicSearch ?? defaultDeps!.syncClinicPublicSearch,
    createSignedStorageUrl:
      options.createSignedStorageUrl ?? defaultDeps!.createSignedStorageUrl,
    uploadClinicAvatar:
      options.uploadClinicAvatar ?? defaultDeps!.uploadClinicAvatar,
    deleteStorageObject:
      options.deleteStorageObject ?? defaultDeps!.deleteStorageObject,
  };

  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  if (!app.hasContentTypeParser("multipart/form-data")) {
    app.addContentTypeParser(
      "multipart/form-data",
      (_request, _payload, done) => {
        done(null, undefined);
      },
    );
  }

  app.addHook("onRequest", async (request, reply) => {
    (request as ClinicPublicProfileFastifyRequest)[REQUEST_START_TIME_KEY] =
      process.hrtime.bigint();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt =
      (request as ClinicPublicProfileFastifyRequest)[REQUEST_START_TIME_KEY] ??
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

  const optionsHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    applyCorsHeaders(request, reply, allowedOrigins);
    reply.header("access-control-allow-methods", "GET,PATCH,POST,DELETE,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/avatar", optionsHandler);

  app.get("/", async (request, reply) => {
    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const data = await deps.getClinicPublicProfileByClinicId(auth.clinicId);

    if (!data?.clinic) {
      return reply.code(404).send({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    const avatarUrl =
      typeof data.profile?.avatarStoragePath === "string" &&
      data.profile.avatarStoragePath
        ? await deps.createSignedStorageUrl(data.profile.avatarStoragePath)
        : null;

    return reply.code(200).send({
      success: true,
      profile: deps.buildClinicPublicProfileResponse({
        clinic: data.clinic,
        profile: data.profile,
        avatarUrl,
      }),
      search: serializeSearch(data.search),
    });
  });

  app.patch<{
    Body: Record<string, unknown>;
  }>("/", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (!requireClinicManagementPermission(auth, reply)) {
      return reply;
    }

    const clinic = await deps.getClinicById(auth.clinicId);

    if (!clinic) {
      return reply.code(404).send({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    const currentData = await deps.getClinicPublicProfileByClinicId(auth.clinicId);
    const patchInput = buildPatchInput(request.body);
    const currentProfile = currentData?.profile ?? null;

    const publicationPreview = deps.evaluateClinicPublicProfilePublication({
      clinic,
      profile: {
        displayName:
          (patchInput.displayName as string | null | undefined) ??
          ((currentProfile?.displayName as string | null | undefined) ?? null),
        avatarStoragePath:
          (patchInput.avatarStoragePath as string | null | undefined) ??
          ((currentProfile?.avatarStoragePath as string | null | undefined) ??
            null),
        aboutText:
          (patchInput.aboutText as string | null | undefined) ??
          ((currentProfile?.aboutText as string | null | undefined) ?? null),
        specialtyText:
          (patchInput.specialtyText as string | null | undefined) ??
          ((currentProfile?.specialtyText as string | null | undefined) ?? null),
        servicesText:
          (patchInput.servicesText as string | null | undefined) ??
          ((currentProfile?.servicesText as string | null | undefined) ?? null),
        email:
          (patchInput.email as string | null | undefined) ??
          ((currentProfile?.email as string | null | undefined) ?? null),
        phone:
          (patchInput.phone as string | null | undefined) ??
          ((currentProfile?.phone as string | null | undefined) ?? null),
        locality:
          (patchInput.locality as string | null | undefined) ??
          ((currentProfile?.locality as string | null | undefined) ?? null),
        country:
          (patchInput.country as string | null | undefined) ??
          ((currentProfile?.country as string | null | undefined) ?? null),
        isPublic:
          (patchInput.isPublic as boolean | undefined) ??
          ((currentProfile?.isPublic as boolean | undefined) ?? false),
      },
    });

    if (
      publicationPreview.isPublic &&
      publicationPreview.publicationErrors.length > 0
    ) {
      return reply.code(400).send({
        success: false,
        error: publicationPreview.publicationErrors[0],
        publication: {
          hasRequiredPublicFields: publicationPreview.hasRequiredPublicFields,
          hasQualitySupplement: publicationPreview.hasQualitySupplement,
          qualityScore: publicationPreview.qualityScore,
          minimumQualityScore: deps.minPublicProfileQualityScore,
          isSearchEligible: publicationPreview.isSearchEligible,
          missingRequiredFields: publicationPreview.missingRequiredFields,
          missingRecommendedFields:
            publicationPreview.missingRecommendedFields,
          publicationErrors: publicationPreview.publicationErrors,
        },
      });
    }

    const profile = await deps.patchClinicPublicProfile(auth.clinicId, patchInput);
    const search = await deps.syncClinicPublicSearch(auth.clinicId);
    const avatarUrl =
      typeof profile.avatarStoragePath === "string" && profile.avatarStoragePath
        ? await deps.createSignedStorageUrl(profile.avatarStoragePath)
        : null;

    return reply.code(200).send({
      success: true,
      message: "Perfil publico actualizado correctamente",
      profile: deps.buildClinicPublicProfileResponse({
        clinic,
        profile,
        avatarUrl,
      }),
      search,
    });
  });

  app.post("/avatar", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (!requireClinicManagementPermission(auth, reply)) {
      return reply;
    }

    const clinic = await deps.getClinicById(auth.clinicId);

    if (!clinic) {
      return reply.code(404).send({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    let file: UploadedMultipartFile | undefined;

    try {
      file = await runAvatarUpload(request, reply);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al procesar avatar";

      return reply.code(400).send({
        success: false,
        error: message,
      });
    }

    if (!file) {
      return reply.code(400).send({
        success: false,
        error: "Avatar obligatorio",
      });
    }

    const currentData = await deps.getClinicPublicProfileByClinicId(auth.clinicId);
    const previousAvatarStoragePath =
      (currentData?.profile?.avatarStoragePath as string | null | undefined) ??
      null;

    const avatarStoragePath = await deps.uploadClinicAvatar({
      clinicId: auth.clinicId,
      file: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
    });

    const profile = await deps.patchClinicPublicProfile(auth.clinicId, {
      avatarStoragePath,
    });

    const search = await deps.syncClinicPublicSearch(auth.clinicId);

    if (
      previousAvatarStoragePath &&
      previousAvatarStoragePath !== avatarStoragePath
    ) {
      await deps.deleteStorageObject(previousAvatarStoragePath);
    }

    const avatarUrl = await deps.createSignedStorageUrl(avatarStoragePath);

    return reply.code(201).send({
      success: true,
      message: "Avatar actualizado correctamente",
      profile: deps.buildClinicPublicProfileResponse({
        clinic,
        profile,
        avatarUrl,
      }),
      search,
    });
  });

  app.delete("/avatar", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const auth = await authenticateClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    if (!requireClinicManagementPermission(auth, reply)) {
      return reply;
    }

    const clinic = await deps.getClinicById(auth.clinicId);

    if (!clinic) {
      return reply.code(404).send({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    const currentData = await deps.getClinicPublicProfileByClinicId(auth.clinicId);

    if (!currentData?.profile?.avatarStoragePath) {
      return reply.code(404).send({
        success: false,
        error: "La clinica no tiene avatar cargado",
      });
    }

    const publicationPreview = deps.evaluateClinicPublicProfilePublication({
      clinic,
      profile: {
        displayName:
          (currentData.profile.displayName as string | null | undefined) ?? null,
        avatarStoragePath: null,
        aboutText:
          (currentData.profile.aboutText as string | null | undefined) ?? null,
        specialtyText:
          (currentData.profile.specialtyText as string | null | undefined) ??
          null,
        servicesText:
          (currentData.profile.servicesText as string | null | undefined) ?? null,
        email: (currentData.profile.email as string | null | undefined) ?? null,
        phone: (currentData.profile.phone as string | null | undefined) ?? null,
        locality:
          (currentData.profile.locality as string | null | undefined) ?? null,
        country:
          (currentData.profile.country as string | null | undefined) ?? null,
        isPublic:
          (currentData.profile.isPublic as boolean | undefined) ?? false,
      },
    });

    if (
      publicationPreview.isPublic &&
      publicationPreview.publicationErrors.length > 0
    ) {
      return reply.code(400).send({
        success: false,
        error:
          "No se puede eliminar el avatar porque el perfil público dejaría de cumplir la calidad mínima.",
        publication: {
          hasRequiredPublicFields: publicationPreview.hasRequiredPublicFields,
          hasQualitySupplement: publicationPreview.hasQualitySupplement,
          qualityScore: publicationPreview.qualityScore,
          minimumQualityScore: deps.minPublicProfileQualityScore,
          isSearchEligible: publicationPreview.isSearchEligible,
          missingRequiredFields: publicationPreview.missingRequiredFields,
          missingRecommendedFields:
            publicationPreview.missingRecommendedFields,
          publicationErrors: publicationPreview.publicationErrors,
        },
      });
    }

    const result = await deps.removeClinicPublicAvatar(auth.clinicId);
    const search = await deps.syncClinicPublicSearch(auth.clinicId);

    if (result.previousAvatarStoragePath) {
      await deps.deleteStorageObject(result.previousAvatarStoragePath);
    }

    return reply.code(200).send({
      success: true,
      message: "Avatar eliminado correctamente",
      profile: deps.buildClinicPublicProfileResponse({
        clinic,
        profile: result.profile,
        avatarUrl: null,
      }),
      search,
    });
  });
};

