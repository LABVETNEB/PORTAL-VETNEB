import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env.ts";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

function detectDocumentMime(bytes: Uint8Array): AllowedMimeType | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && [0x52, 0x49, 0x46, 0x46].every((value, index) => bytes[index] === value) && [0x57, 0x45, 0x42, 0x50].every((value, index) => bytes[index + 8] === value)) return "image/webp";
  return null;
}

export const supabase = createClient(
  ENV.supabaseUrl,
  ENV.supabaseServiceRoleKey,
);

type SupabaseStorageClient = typeof supabase.storage;

export type StorageBucketPort = Pick<
  ReturnType<SupabaseStorageClient["from"]>,
  "upload" | "createSignedUrl" | "remove"
>;

export type StoragePort = Pick<SupabaseStorageClient, "getBucket" | "createBucket"> & {
  from(bucketId: string): StorageBucketPort;
};

type DocumentReadStorage = { from(bucketId: string): Pick<ReturnType<SupabaseStorageClient["from"]>, "download"> };

export async function inspectStoredReportMime(
  storagePath: string,
  storage: DocumentReadStorage = supabase.storage,
) {
  const { data, error } = await storage.from(ENV.supabaseStorageBucket).download(storagePath);
  if (error || !data || data.size > ENV.maxUploadFileSizeMb * 1024 * 1024) return null;
  return detectDocumentMime(new Uint8Array(await data.slice(0, 16).arrayBuffer()));
}

function sanitizeFileName(fileName: string, fallback: string): string {
  const sanitized = fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/\.+/g, ".")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");

  return sanitized || fallback;
}

// WBR-14 (VET-14): the random component of a private storage path must come
// from a CSPRNG, not from non-cryptographic pseudo-randomness, consistent
// with the rest of the repo (server/lib/auth-security.ts already uses
// crypto.randomBytes for session tokens). This does not change the path
// shape (segments/hierarchy/prefix), only how the random segment is
// generated.
function buildReportStoragePath(clinicId: number, fileName: string): string {
  const safeName = sanitizeFileName(fileName, "report");
  const timestamp = Date.now();
  const random = crypto.randomBytes(6).toString("hex");

  return `clinics/${clinicId}/${timestamp}-${random}-${safeName}`;
}

function buildClinicAvatarStoragePath(clinicId: number, fileName: string): string {
  const safeName = sanitizeFileName(fileName, "avatar");
  const timestamp = Date.now();
  const random = crypto.randomBytes(6).toString("hex");

  return `clinic-avatars/${clinicId}/${timestamp}-${random}-${safeName}`;
}

/**
 * Asegura que el bucket exista.
 * Se usa al iniciar el servidor.
 */
export async function ensureStorageBucketExists(
  storage: StoragePort = supabase.storage,
) {
  const { data: existingBucket, error: getBucketError } =
    await storage.getBucket(ENV.supabaseStorageBucket);

  if (!getBucketError && existingBucket) {
    return existingBucket;
  }

  const { data: createdBucket, error: createBucketError } =
    await storage.createBucket(ENV.supabaseStorageBucket, {
      public: false,
    });

  if (createBucketError) {
    throw createBucketError;
  }

  return createdBucket;
}

/**
 * Healthcheck de storage.
 * No crea ni modifica nada.
 */
export async function checkStorageHealth(
  storage: StoragePort = supabase.storage,
) {
  const { data, error } = await storage.getBucket(
    ENV.supabaseStorageBucket,
  );

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sube un archivo de informe al bucket y devuelve el storagePath persistible.
 */
export async function uploadReport(
  params: {
    file: Buffer;
    fileName: string;
    clinicId: number;
    mimeType: string;
  },
  storage: StoragePort = supabase.storage,
): Promise<string> {
  const { file, fileName, clinicId, mimeType } = params;

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    throw new Error(`Tipo de archivo no permitido: ${mimeType}`);
  }

  const storagePath = buildReportStoragePath(clinicId, fileName);

  const { error } = await storage
    .from(ENV.supabaseStorageBucket)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return storagePath;
}

/**
 * Genera una signed URL para visualizaciÃ³n / preview.
 */
export async function createSignedStorageUrl(
  storagePath: string,
  storage: StoragePort = supabase.storage,
): Promise<string> {
  const { data, error } = await storage
    .from(ENV.supabaseStorageBucket)
    .createSignedUrl(storagePath, ENV.signedUrlExpiresInSeconds);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("No se pudo generar la URL firmada del archivo");
  }

  return data.signedUrl;
}

export async function createSignedReportUrl(
  storagePath: string,
  storage: StoragePort = supabase.storage,
): Promise<string> {
  return createSignedStorageUrl(storagePath, storage);
}

/**
 * Genera una signed URL para descarga forzada.
 */
export async function createSignedReportDownloadUrl(
  storagePath: string,
  downloadFileName?: string,
  storage: StoragePort = supabase.storage,
): Promise<string> {
  const { data, error } = await storage
    .from(ENV.supabaseStorageBucket)
    .createSignedUrl(storagePath, ENV.signedUrlExpiresInSeconds, {
      download: downloadFileName || true,
    });

  if (error || !data?.signedUrl) {
    throw error ?? new Error("No se pudo generar la URL firmada de descarga");
  }

  return data.signedUrl;
}
export async function uploadClinicAvatar(
  params: {
    file: Buffer;
    fileName: string;
    clinicId: number;
    mimeType: string;
  },
  storage: StoragePort = supabase.storage,
): Promise<string> {
  const { file, fileName, clinicId, mimeType } = params;

  if (!ALLOWED_AVATAR_MIME_TYPES.includes(mimeType as (typeof ALLOWED_AVATAR_MIME_TYPES)[number])) {
    throw new Error(`Tipo de avatar no permitido: ${mimeType}`);
  }

  const storagePath = buildClinicAvatarStoragePath(clinicId, fileName);

  const { error } = await storage
    .from(ENV.supabaseStorageBucket)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return storagePath;
}

export async function deleteStorageObject(
  storagePath: string,
  storage: StoragePort = supabase.storage,
): Promise<void> {
  const { error } = await storage
    .from(ENV.supabaseStorageBucket)
    .remove([storagePath]);

  if (error) {
    throw error;
  }
}

export type StorageListingBucketPort = Pick<
  ReturnType<SupabaseStorageClient["from"]>,
  "listV2"
>;

export type StorageListingPort = {
  from(bucketId: string): StorageListingBucketPort;
};

export class StorageListingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageListingError";
  }
}

const STORAGE_LISTING_CALL_TIMEOUT_MS = 15_000;

/**
 * Listado de solo lectura (listV2, cursor). No hay inventario atomico: ante
 * cualquier respuesta que no permita continuar con certeza, falla cerrado.
 * Nunca incluye el mensaje del proveedor en el error propagado.
 */
export function createStorageObjectListing(
  storage: StorageListingPort = supabase.storage,
  bucketId: string = ENV.supabaseStorageBucket,
) {
  return {
    async listPage(input: {
      prefix: string;
      cursor: string | null;
      limit: number;
    }) {
      const { data, error } = await storage.from(bucketId).listV2(
        {
          prefix: input.prefix,
          limit: input.limit,
          with_delimiter: false,
          sortBy: { column: "name", order: "asc" },
          noncurrentVersions: "exclude",
          deleteMarkers: "exclude",
          ...(input.cursor === null ? {} : { cursor: input.cursor }),
        },
        { signal: AbortSignal.timeout(STORAGE_LISTING_CALL_TIMEOUT_MS) },
      );

      if (error || !data) {
        throw new StorageListingError("storage_listing_failed");
      }

      if (!Array.isArray(data.objects) || typeof data.hasNext !== "boolean") {
        throw new StorageListingError("storage_listing_invalid_shape");
      }

      const nextCursor =
        typeof data.nextCursor === "string" && data.nextCursor.length > 0
          ? data.nextCursor
          : null;

      if (data.hasNext && nextCursor === null) {
        throw new StorageListingError("storage_listing_missing_cursor");
      }

      const objects: Array<{ key: string; createdAt: string | null }> = [];

      for (const entry of data.objects) {
        if (entry.is_delete_marker === true) {
          continue;
        }

        if (typeof entry.key !== "string" || !entry.key.startsWith(input.prefix)) {
          throw new StorageListingError("storage_listing_invalid_entry");
        }

        objects.push({
          key: entry.key,
          createdAt: typeof entry.created_at === "string" ? entry.created_at : null,
        });
      }

      return { objects, nextCursor: data.hasNext ? nextCursor : null };
    },
  };
}
