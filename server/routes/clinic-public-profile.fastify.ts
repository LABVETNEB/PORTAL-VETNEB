import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import multer from "multer";

import { ENV } from "../lib/env.ts";
import {
  enforceTrustedOrigin,
  getAllowedOrigins,
  getAllowedOriginForCors,
} from "../lib/cors-headers.ts";
import {
  getClinicPermissions,
  normalizeClinicUserRole,
} from "../lib/permissions.ts";
import { logRequestCompletion } from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";
import {
  CLINIC_PUBLIC_AVATAR_UNSUPPORTED_MIME_ERROR,
  MAX_CLINIC_PUBLIC_AVATAR_FILE_SIZE_BYTES,
  isClinicPublicAvatarMimeType,
  type ClinicPublicAvatarFile,
  type ClinicPublicProfilePatchInput,
} from "../features/clinics/domain/index.ts";
import {
  getClinicPublicProfileQuery,
  type ClinicPublicProfileData,
  type ClinicPublicProfileQueryServiceOverrides,
  type ClinicPublicProfileResponseBuilder,
} from "../features/clinics/clinic-public-profile-query-service.ts";
import {
  deleteClinicPublicAvatarCommand,
  patchClinicPublicProfileCommand,
  uploadClinicPublicAvatarCommand,
  type ClinicPublicProfileCommandServiceOverrides,
  type ClinicPublicProfilePublication,
} from "../features/clinics/clinic-public-profile-command-service.ts";

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

type PatchClinicPublicProfileResult = Record<string, unknown> & {
  avatarStoragePath?: string | null;
  displayName?: string | null;
  aboutText?: string | null;
  specialtyText?: string | null;
  servicesText?: string | null;
  email?: string | null;
  phone?: string | null;
  publicAddress?: string | null;
  mapLink?: string | null;
  locality?: string | null;
  country?: string | null;
  isPublic?: boolean;
};

type RemoveClinicPublicAvatarResult = {
  previousAvatarStoragePath: string | null;
  profile: Record<string, unknown>;
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
  buildClinicPublicProfileResponse?:
    ClinicPublicProfileResponseBuilder;
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
      publicAddress: string | null;
      mapLink: string | null;
      locality: string | null;
      country: string | null;
      isPublic: boolean;
    };
  }) => ClinicPublicProfilePublication;
  minPublicProfileQualityScore?: number;
  patchClinicPublicProfile?: (
    clinicId: number,
    input: ClinicPublicProfilePatchInput,
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

const REQUEST_TIMER_KEY = "__clinicPublicProfileRequestTimer";

type ClinicPublicProfileFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
};

type NativeClinicPublicProfileAuthDeps = Required<
  Pick<
    ClinicPublicProfileNativeRoutesOptions,
    | "deleteActiveSession"
    | "getActiveSessionByToken"
    | "getClinicUserById"
    | "updateSessionLastAccess"
    | "hashSessionToken"
    | "getClinicById"
  >
>;

let defaultDepsPromise:
  | Promise<NativeClinicPublicProfileAuthDeps>
  | undefined;

async function loadDefaultDeps(): Promise<NativeClinicPublicProfileAuthDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getClinicById: db.getClinicById,
      };
    })();
  }

  return defaultDepsPromise!;
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

async function authenticateClinicUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeClinicPublicProfileAuthDeps,
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

type UploadedMultipartFile = ClinicPublicAvatarFile;

type RawRequestWithFile = FastifyRequest["raw"] & {
  file?: UploadedMultipartFile;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:
      MAX_CLINIC_PUBLIC_AVATAR_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (
      !isClinicPublicAvatarMimeType(file.mimetype)
    ) {
      cb(
        new Error(
          CLINIC_PUBLIC_AVATAR_UNSUPPORTED_MIME_ERROR,
        ),
      );
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

function buildPublicationPayload(
  publication: ClinicPublicProfilePublication,
  minimumQualityScore: number,
) {
  return {
    hasRequiredPublicFields:
      publication.hasRequiredPublicFields,
    hasQualitySupplement:
      publication.hasQualitySupplement,
    qualityScore: publication.qualityScore,
    minimumQualityScore,
    isSearchEligible: publication.isSearchEligible,
    missingRequiredFields:
      publication.missingRequiredFields,
    missingRecommendedFields:
      publication.missingRecommendedFields,
    publicationErrors: publication.publicationErrors,
  };
}

export const clinicPublicProfileNativeRoutes: FastifyPluginAsync<
  ClinicPublicProfileNativeRoutesOptions
> = async (app, options) => {
  const hasAllInjectedAuthDeps =
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getClinicById;

  const defaultDeps = hasAllInjectedAuthDeps
    ? undefined
    : await loadDefaultDeps();

  const deps: NativeClinicPublicProfileAuthDeps = {
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
  };

  const queryOverrides: ClinicPublicProfileQueryServiceOverrides = {
    getClinicPublicProfileByClinicId:
      options.getClinicPublicProfileByClinicId,
    buildClinicPublicProfileResponse:
      options.buildClinicPublicProfileResponse,
    createSignedStorageUrl:
      options.createSignedStorageUrl,
  };

  const commandOverrides: ClinicPublicProfileCommandServiceOverrides = {
    getClinicPublicProfileByClinicId:
      options.getClinicPublicProfileByClinicId,
    buildClinicPublicProfileResponse:
      options.buildClinicPublicProfileResponse,
    evaluateClinicPublicProfilePublication:
      options.evaluateClinicPublicProfilePublication,
    minPublicProfileQualityScore:
      options.minPublicProfileQualityScore,
    patchClinicPublicProfile:
      options.patchClinicPublicProfile,
    removeClinicPublicAvatar:
      options.removeClinicPublicAvatar,
    syncClinicPublicSearch:
      options.syncClinicPublicSearch,
    createSignedStorageUrl:
      options.createSignedStorageUrl,
    uploadClinicAvatar:
      options.uploadClinicAvatar,
    deleteStorageObject:
      options.deleteStorageObject,
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
    (request as ClinicPublicProfileFastifyRequest)[REQUEST_TIMER_KEY] =
      createRuntimeTimer();

    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  app.addHook("onResponse", async (request, reply) => {
    const timer =
      (request as ClinicPublicProfileFastifyRequest)[REQUEST_TIMER_KEY] ??
      createRuntimeTimer();

    const durationMs = timer.elapsedMs();

    logRequestCompletion({
      method: request.method,
      routeTemplate: request.routeOptions?.url,
      statusCode: reply.statusCode,
      durationMs,
      requestId: request.id,
    });
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

    const result = await getClinicPublicProfileQuery(
      auth.clinicId,
      queryOverrides,
    );

    if (!result.ok) {
      return reply.code(404).send({
        success: false,
        error: "Clinica no encontrada",
      });
    }

    return reply.code(200).send({
      success: true,
      profile: result.profile,
      search: result.search,
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

    const result =
      await patchClinicPublicProfileCommand(
        {
          clinicId: auth.clinicId,
          clinic,
          body: request.body,
        },
        commandOverrides,
      );

    if (!result.ok && result.reason === "validation") {
      return reply.code(400).send({
        success: false,
        error: result.error,
      });
    }

    if (!result.ok && result.reason === "publication") {
      return reply.code(400).send({
        success: false,
        error: result.publication.publicationErrors[0],
        publication: buildPublicationPayload(
          result.publication,
          result.minimumQualityScore,
        ),
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Perfil publico actualizado correctamente",
      profile: result.profile,
      search: result.search,
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
      let message = "Error al procesar avatar";

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        message = "La imagen no debe superar 512 KB.";
      } else if (
        error instanceof Error &&
        error.message ===
          CLINIC_PUBLIC_AVATAR_UNSUPPORTED_MIME_ERROR
      ) {
        message =
          CLINIC_PUBLIC_AVATAR_UNSUPPORTED_MIME_ERROR;
      }

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

    const result =
      await uploadClinicPublicAvatarCommand(
        {
          clinicId: auth.clinicId,
          clinic,
          file,
        },
        commandOverrides,
      );

    if (!result.ok) {
      return reply.code(400).send({
        success: false,
        error: result.error,
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Avatar actualizado correctamente",
      profile: result.profile,
      search: result.search,
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

    const result =
      await deleteClinicPublicAvatarCommand(
        {
          clinicId: auth.clinicId,
          clinic,
        },
        commandOverrides,
      );

    if (
      !result.ok &&
      result.reason === "avatar_not_found"
    ) {
      return reply.code(404).send({
        success: false,
        error: "La clinica no tiene avatar cargado",
      });
    }

    if (
      !result.ok &&
      result.reason === "publication"
    ) {
      return reply.code(400).send({
        success: false,
        error:
          "No se puede eliminar el avatar porque el perfil público dejaría de cumplir la calidad mínima.",
        publication: buildPublicationPayload(
          result.publication,
          result.minimumQualityScore,
        ),
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Avatar eliminado correctamente",
      profile: result.profile,
      search: result.search,
    });
  });
};
