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
import {
  buildRequestLogLine,
  sanitizeUrlForLogs,
} from "../middlewares/request-logger.ts";
import {
  createRuntimeTimer,
  type RuntimeTimer,
} from "../lib/runtime-timing.ts";
import { shouldRefreshSessionLastAccess } from "../lib/session-last-access.ts";
import type { UpsertClinicPublicProfileInput } from "../features/public-professionals/infrastructure/index.ts";

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
      publicAddress: string | null;
      mapLink: string | null;
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

const REQUEST_TIMER_KEY = "__clinicPublicProfileRequestTimer";
const MAX_DISPLAY_NAME = 255;
const MAX_EMAIL = 255;
const MAX_PHONE = 50;
const MAX_PUBLIC_ADDRESS = 160;
const MAX_MAP_LINK = 2048;
const MAX_LOCALITY = 255;
const MAX_COUNTRY = 255;
const MAX_SPECIALTY = 500;
const MAX_ABOUT = 5000;
const MAX_SERVICES = 5000;
const MAX_AVATAR_FILE_SIZE_BYTES = 512 * 1024;
const MIN_AVATAR_DIMENSION = 160;
const MAX_AVATAR_DIMENSION = 1024;
const MIN_AVATAR_ASPECT_RATIO = 0.85;
const MAX_AVATAR_ASPECT_RATIO = 1.15;
const AVATAR_UNSUPPORTED_MIME_ERROR = "La imagen debe ser JPG, PNG o WebP.";
const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_FILE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAP_LINK_ALLOWED_HOSTS = new Set([
  "maps.google.com",
  "maps.app.goo.gl",
  "openstreetmap.org",
  "www.openstreetmap.org",
]);

type ClinicPublicProfileFastifyRequest = FastifyRequest & {
  [REQUEST_TIMER_KEY]?: RuntimeTimer;
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
      const publicProfiles = await import("../features/public-professionals/infrastructure/index.ts");
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
                publicAddress: string | null;
                mapLink: string | null;
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

function hasPotentialHtml(value: string) {
  return /[<>]/.test(value);
}

function getNormalizedMapLink(
  value: string | null | undefined,
): { value: string | null | undefined; error?: string } {
  if (typeof value !== "string") {
    return { value };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null };
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return { value, error: "El enlace a mapa debe ser una URL válida con https://." };
  }

  if (parsed.protocol !== "https:") {
    return { value, error: "El enlace a mapa debe usar https://." };
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const isGoogleMapsPath =
    (host === "google.com" || host === "www.google.com") &&
    pathname.startsWith("/maps");
  const isShortGoogleMaps = host === "goo.gl" && pathname.startsWith("/maps");
  const isAllowedHost = MAP_LINK_ALLOWED_HOSTS.has(host);

  if (!isGoogleMapsPath && !isShortGoogleMaps && !isAllowedHost) {
    return {
      value,
      error:
        "El enlace a mapa debe usar dominios de mapas permitidos (Google Maps u OpenStreetMap).",
    };
  }

  return { value: parsed.toString() };
}

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const match = normalized.match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function parsePngDimensions(buffer: Buffer) {
  if (buffer.length < 24) {
    return null;
  }

  const signature = buffer.subarray(0, 8);
  const isPng =
    signature[0] === 0x89 &&
    signature[1] === 0x50 &&
    signature[2] === 0x4e &&
    signature[3] === 0x47 &&
    signature[4] === 0x0d &&
    signature[5] === 0x0a &&
    signature[6] === 0x1a &&
    signature[7] === 0x0a;

  if (!isPng) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset < buffer.length) {
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= buffer.length) {
      return null;
    }

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) {
      return null;
    }

    if (offset + 1 >= buffer.length) {
      return null;
    }

    const segmentLength = buffer.readUInt16BE(offset);

    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return null;
    }

    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
      0xcf,
    ].includes(marker);

    if (isStartOfFrame) {
      if (offset + 7 >= buffer.length) {
        return null;
      }

      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function parseWebpDimensions(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === "VP8L") {
    if (buffer.length < 25 || buffer[20] !== 0x2f) {
      return null;
    }

    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];

    return {
      width: 1 + (b0 | ((b1 & 0x3f) << 8)),
      height: 1 + (((b1 & 0xc0) >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)),
    };
  }

  if (chunkType === "VP8 ") {
    if (buffer.length < 30) {
      return null;
    }

    const frameStart = 20;
    const hasFrameHeader =
      buffer[frameStart + 3] === 0x9d &&
      buffer[frameStart + 4] === 0x01 &&
      buffer[frameStart + 5] === 0x2a;

    if (!hasFrameHeader || frameStart + 10 >= buffer.length) {
      return null;
    }

    return {
      width: buffer.readUInt16LE(frameStart + 6) & 0x3fff,
      height: buffer.readUInt16LE(frameStart + 8) & 0x3fff,
    };
  }

  return null;
}

function getImageDimensions(file: UploadedMultipartFile) {
  if (file.mimetype === "image/png") {
    return parsePngDimensions(file.buffer);
  }

  if (file.mimetype === "image/jpeg") {
    return parseJpegDimensions(file.buffer);
  }

  if (file.mimetype === "image/webp") {
    return parseWebpDimensions(file.buffer);
  }

  return null;
}

function validateAvatarFile(file: UploadedMultipartFile) {
  if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
    return { error: "La imagen debe ser JPG, PNG o WebP." };
  }

  const extension = getFileExtension(file.originalname);

  if (!AVATAR_FILE_EXTENSIONS.has(extension)) {
    return { error: "La imagen debe ser JPG, PNG o WebP." };
  }

  if (file.buffer.length > MAX_AVATAR_FILE_SIZE_BYTES) {
    return { error: "La imagen no debe superar 512 KB." };
  }

  const dimensions = getImageDimensions(file);

  if (!dimensions) {
    return { error: "No se pudieron validar las dimensiones de la imagen." };
  }

  if (
    dimensions.width < MIN_AVATAR_DIMENSION ||
    dimensions.height < MIN_AVATAR_DIMENSION
  ) {
    return { error: "La imagen debe tener al menos 160 x 160 px." };
  }

  if (
    dimensions.width > MAX_AVATAR_DIMENSION ||
    dimensions.height > MAX_AVATAR_DIMENSION
  ) {
    return { error: "La imagen no debe superar 1024 x 1024 px." };
  }

  const ratio = dimensions.width / dimensions.height;

  if (ratio < MIN_AVATAR_ASPECT_RATIO || ratio > MAX_AVATAR_ASPECT_RATIO) {
    return { error: "Se recomienda una imagen cuadrada para evitar recortes." };
  }

  return { error: null };
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
    publicAddress: normalizeNullableString(body?.publicAddress, MAX_PUBLIC_ADDRESS),
    mapLink: normalizeNullableString(body?.mapLink, MAX_MAP_LINK),
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
    fileSize: MAX_AVATAR_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
      cb(new Error(AVATAR_UNSUPPORTED_MIME_ERROR));
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
    const publicAddressValue = patchInput.publicAddress;
    const mapLinkValue = patchInput.mapLink;

    if (
      typeof publicAddressValue === "string" &&
      hasPotentialHtml(publicAddressValue)
    ) {
      return reply.code(400).send({
        success: false,
        error: "La dirección pública no puede contener HTML.",
      });
    }

    if (typeof mapLinkValue === "string" || mapLinkValue === null) {
      const normalizedMapLink = getNormalizedMapLink(mapLinkValue);

      if (normalizedMapLink.error) {
        return reply.code(400).send({
          success: false,
          error: normalizedMapLink.error,
        });
      }

      patchInput.mapLink = normalizedMapLink.value;
    }

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
        publicAddress:
          (patchInput.publicAddress as string | null | undefined) ??
          ((currentProfile?.publicAddress as string | null | undefined) ?? null),
        mapLink:
          (patchInput.mapLink as string | null | undefined) ??
          ((currentProfile?.mapLink as string | null | undefined) ?? null),
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
      let message = "Error al procesar avatar";

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        message = "La imagen no debe superar 512 KB.";
      } else if (
        error instanceof Error &&
        error.message === AVATAR_UNSUPPORTED_MIME_ERROR
      ) {
        message = AVATAR_UNSUPPORTED_MIME_ERROR;
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

    const avatarValidation = validateAvatarFile(file);

    if (avatarValidation.error) {
      return reply.code(400).send({
        success: false,
        error: avatarValidation.error,
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
        publicAddress:
          (currentData.profile.publicAddress as string | null | undefined) ?? null,
        mapLink:
          (currentData.profile.mapLink as string | null | undefined) ?? null,
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
