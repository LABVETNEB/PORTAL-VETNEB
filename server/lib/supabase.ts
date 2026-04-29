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

export const supabase = createClient(
  ENV.supabaseUrl,
  ENV.supabaseServiceRoleKey,
);

function sanitizeFileName(fileName: string, fallback: string): string {
  const sanitized = fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/\.+/g, ".")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");

  return sanitized || fallback;
}

function buildReportStoragePath(clinicId: number, fileName: string): string {
  const safeName = sanitizeFileName(fileName, "report");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);

  return `clinics/${clinicId}/${timestamp}-${random}-${safeName}`;
}

function buildClinicAvatarStoragePath(clinicId: number, fileName: string): string {
  const safeName = sanitizeFileName(fileName, "avatar");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);

  return `clinic-avatars/${clinicId}/${timestamp}-${random}-${safeName}`;
}

/**
 * Asegura que el bucket exista.
 * Se usa al iniciar el servidor.
 */
export async function ensureStorageBucketExists() {
  const { data: existingBucket, error: getBucketError } =
    await supabase.storage.getBucket(ENV.supabaseStorageBucket);

  if (!getBucketError && existingBucket) {
    return existingBucket;
  }

  const { data: createdBucket, error: createBucketError } =
    await supabase.storage.createBucket(ENV.supabaseStorageBucket, {
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
export async function checkStorageHealth() {
  const { data, error } = await supabase.storage.getBucket(
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
export async function uploadReport(params: {
  file: Buffer;
  fileName: string;
  clinicId: number;
  mimeType: string;
}): Promise<string> {
  const { file, fileName, clinicId, mimeType } = params;

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    throw new Error(`Tipo de archivo no permitido: ${mimeType}`);
  }

  const storagePath = buildReportStoragePath(clinicId, fileName);

  const { error } = await supabase.storage
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
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ENV.supabaseStorageBucket)
    .createSignedUrl(storagePath, ENV.signedUrlExpiresInSeconds);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("No se pudo generar la URL firmada del archivo");
  }

  return data.signedUrl;
}

export async function createSignedReportUrl(
  storagePath: string,
): Promise<string> {
  return createSignedStorageUrl(storagePath);
}

/**
 * Genera una signed URL para descarga forzada.
 */
export async function createSignedReportDownloadUrl(
  storagePath: string,
  downloadFileName?: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ENV.supabaseStorageBucket)
    .createSignedUrl(storagePath, ENV.signedUrlExpiresInSeconds, {
      download: downloadFileName || true,
    });

  if (error || !data?.signedUrl) {
    throw error ?? new Error("No se pudo generar la URL firmada de descarga");
  }

  return data.signedUrl;
}
export async function uploadClinicAvatar(params: {
  file: Buffer;
  fileName: string;
  clinicId: number;
  mimeType: string;
}): Promise<string> {
  const { file, fileName, clinicId, mimeType } = params;

  if (!ALLOWED_AVATAR_MIME_TYPES.includes(mimeType as (typeof ALLOWED_AVATAR_MIME_TYPES)[number])) {
    throw new Error(`Tipo de avatar no permitido: ${mimeType}`);
  }

  const storagePath = buildClinicAvatarStoragePath(clinicId, fileName);

  const { error } = await supabase.storage
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

export async function deleteStorageObject(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(ENV.supabaseStorageBucket)
    .remove([storagePath]);

  if (error) {
    throw error;
  }
}
