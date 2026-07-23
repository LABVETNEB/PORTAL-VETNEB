// Clinics · domain · validación del perfil público
//
// Reglas puras extraídas de la ruta Fastify en M28. No realizan I/O ni conocen
// HTTP, persistencia, storage, auth o configuración de runtime.

export type ClinicPublicProfilePatchInput = {
  displayName?: string | null;
  avatarStoragePath?: string | null;
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

export type ClinicPublicProfileValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ClinicPublicAvatarFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

export const MAX_CLINIC_PUBLIC_AVATAR_FILE_SIZE_BYTES = 512 * 1024;
export const CLINIC_PUBLIC_AVATAR_UNSUPPORTED_MIME_ERROR =
  "La imagen debe ser JPG, PNG o WebP.";

const MAX_DISPLAY_NAME = 255;
const MAX_EMAIL = 255;
const MAX_PHONE = 50;
const MAX_PUBLIC_ADDRESS = 160;
const MAX_MAP_LINK = 2048;
const MAX_LOCALITY = 255;
const MAX_COUNTRY = 255;
const MAX_SPECIALTY = 5 * 100;
const MAX_ABOUT = 5000;
const MAX_SERVICES = 5000;
const MIN_AVATAR_DIMENSION = 160;
const MAX_AVATAR_DIMENSION = 1024;
const MIN_AVATAR_ASPECT_RATIO = 0.85;
const MAX_AVATAR_ASPECT_RATIO = 1.15;

const AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const AVATAR_FILE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);
const MAP_LINK_ALLOWED_HOSTS = new Set([
  "maps.google.com",
  "maps.app.goo.gl",
  "openstreetmap.org",
  "www.openstreetmap.org",
]);

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
    return {
      value,
      error: "El enlace a mapa debe ser una URL válida con https://.",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      value,
      error: "El enlace a mapa debe usar https://.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const isGoogleMapsPath =
    (host === "google.com" || host === "www.google.com") &&
    pathname.startsWith("/maps");
  const isShortGoogleMaps =
    host === "goo.gl" && pathname.startsWith("/maps");
  const isAllowedHost = MAP_LINK_ALLOWED_HOSTS.has(host);

  if (
    !isGoogleMapsPath &&
    !isShortGoogleMaps &&
    !isAllowedHost
  ) {
    return {
      value,
      error:
        "El enlace a mapa debe usar dominios de mapas permitidos (Google Maps u OpenStreetMap).",
    };
  }

  return { value: parsed.toString() };
}

export function parseClinicPublicProfilePatch(
  body: Record<string, unknown> | undefined,
): ClinicPublicProfileValidationResult<ClinicPublicProfilePatchInput> {
  const patchInput: ClinicPublicProfilePatchInput = {
    displayName: normalizeNullableString(
      body?.displayName,
      MAX_DISPLAY_NAME,
    ),
    aboutText: normalizeNullableString(body?.aboutText, MAX_ABOUT),
    specialtyText: normalizeNullableString(
      body?.specialtyText,
      MAX_SPECIALTY,
    ),
    servicesText: normalizeNullableString(
      body?.servicesText,
      MAX_SERVICES,
    ),
    email: normalizeNullableString(body?.email, MAX_EMAIL),
    phone: normalizeNullableString(body?.phone, MAX_PHONE),
    publicAddress: normalizeNullableString(
      body?.publicAddress,
      MAX_PUBLIC_ADDRESS,
    ),
    mapLink: normalizeNullableString(body?.mapLink, MAX_MAP_LINK),
    locality: normalizeNullableString(body?.locality, MAX_LOCALITY),
    country: normalizeNullableString(body?.country, MAX_COUNTRY),
    isPublic: parseOptionalBoolean(body?.isPublic),
  };

  if (
    typeof patchInput.publicAddress === "string" &&
    hasPotentialHtml(patchInput.publicAddress)
  ) {
    return {
      ok: false,
      error: "La dirección pública no puede contener HTML.",
    };
  }

  if (
    typeof patchInput.mapLink === "string" ||
    patchInput.mapLink === null
  ) {
    const normalizedMapLink = getNormalizedMapLink(
      patchInput.mapLink,
    );

    if (normalizedMapLink.error) {
      return {
        ok: false,
        error: normalizedMapLink.error,
      };
    }

    patchInput.mapLink = normalizedMapLink.value;
  }

  return {
    ok: true,
    data: patchInput,
  };
}

export function isClinicPublicAvatarMimeType(value: string) {
  return AVATAR_MIME_TYPES.has(value);
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
  if (
    buffer.length < 4 ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8
  ) {
    return null;
  }

  let offset = 2;

  while (offset < buffer.length) {
    while (
      offset < buffer.length &&
      buffer[offset] === 0xff
    ) {
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

    if (
      segmentLength < 2 ||
      offset + segmentLength > buffer.length
    ) {
      return null;
    }

    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca,
      0xcb, 0xcd, 0xce, 0xcf,
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
      height:
        1 +
        (((b1 & 0xc0) >> 6) |
          (b2 << 2) |
          ((b3 & 0x0f) << 10)),
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

    if (
      !hasFrameHeader ||
      frameStart + 10 >= buffer.length
    ) {
      return null;
    }

    return {
      width: buffer.readUInt16LE(frameStart + 6) & 0x3fff,
      height:
        buffer.readUInt16LE(frameStart + 8) & 0x3fff,
    };
  }

  return null;
}

function getImageDimensions(file: ClinicPublicAvatarFile) {
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

export function validateClinicPublicAvatar(
  file: ClinicPublicAvatarFile,
): { error: string | null } {
  if (!isClinicPublicAvatarMimeType(file.mimetype)) {
    return {
      error: CLINIC_PUBLIC_AVATAR_UNSUPPORTED_MIME_ERROR,
    };
  }

  const extension = getFileExtension(file.originalname);

  if (!AVATAR_FILE_EXTENSIONS.has(extension)) {
    return {
      error: CLINIC_PUBLIC_AVATAR_UNSUPPORTED_MIME_ERROR,
    };
  }

  if (
    file.buffer.length >
    MAX_CLINIC_PUBLIC_AVATAR_FILE_SIZE_BYTES
  ) {
    return {
      error: "La imagen no debe superar 512 KB.",
    };
  }

  const dimensions = getImageDimensions(file);

  if (!dimensions) {
    return {
      error:
        "No se pudieron validar las dimensiones de la imagen.",
    };
  }

  if (
    dimensions.width < MIN_AVATAR_DIMENSION ||
    dimensions.height < MIN_AVATAR_DIMENSION
  ) {
    return {
      error: "La imagen debe tener al menos 160 x 160 px.",
    };
  }

  if (
    dimensions.width > MAX_AVATAR_DIMENSION ||
    dimensions.height > MAX_AVATAR_DIMENSION
  ) {
    return {
      error: "La imagen no debe superar 1024 x 1024 px.",
    };
  }

  const ratio = dimensions.width / dimensions.height;

  if (
    ratio < MIN_AVATAR_ASPECT_RATIO ||
    ratio > MAX_AVATAR_ASPECT_RATIO
  ) {
    return {
      error:
        "Se recomienda una imagen cuadrada para evitar recortes.",
    };
  }

  return { error: null };
}
