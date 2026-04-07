import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { ENV } from "./env";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const supabase = createClient(
  ENV.supabaseUrl,
  ENV.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

function sanitizePathSegment(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "") || "archivo"
  );
}

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const lastDotIndex = normalized.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === normalized.length - 1) {
    return "bin";
  }

  return sanitizePathSegment(normalized.slice(lastDotIndex + 1));
}

function buildStoragePath(clinicId: number, fileName: string) {
  const extension = getFileExtension(fileName);
  const safeBaseName = sanitizePathSegment(fileName.replace(/\.[^.]+$/, ""));
  const safeClinicId = sanitizePathSegment(String(clinicId));
  const date = new Date().toISOString().slice(0, 10);

  return `clinics/${safeClinicId}/reports/${date}/${randomUUID()}-${safeBaseName}.${extension}`;
}

export async function ensureStorageBucketExists() {
  const { data, error } = await supabase.storage.getBucket(
    ENV.supabaseStorageBucket,
  );

  if (!error && data) {
    return data;
  }

  const { data: createdBucket, error: createError } =
    await supabase.storage.createBucket(ENV.supabaseStorageBucket, {
      public: false,
      fileSizeLimit: `${ENV.maxUploadFileSizeMb}MB`,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    });

  if (createError) {
    throw createError;
  }

  return createdBucket;
}

export async function uploadReport(params: {
  file: Buffer;
  clinicId: number;
  fileName: string;
  mimeType?: string;
}) {
  await ensureStorageBucketExists();

  const storagePath = buildStoragePath(params.clinicId, params.fileName);

  const { error } = await supabase.storage
    .from(ENV.supabaseStorageBucket)
    .upload(storagePath, params.file, {
      upsert: false,
      contentType: params.mimeType || "application/octet-stream",
      cacheControl: "3600",
      metadata: {
        originalFileName: params.fileName,
        clinicId: String(params.clinicId),
      },
    });

  if (error) {
    throw error;
  }

  return storagePath;
}

export async function createSignedReportUrl(
  storagePath: string,
  expiresInSeconds = ENV.signedUrlExpiresInSeconds,
) {
  const { data, error } = await supabase.storage
    .from(ENV.supabaseStorageBucket)
    .createSignedUrl(storagePath, expiresInSeconds, {
      download: false,
    });

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function createSignedReportDownloadUrl(
  storagePath: string,
  fileName?: string | null,
  expiresInSeconds = ENV.signedUrlExpiresInSeconds,
) {
  const { data, error } = await supabase.storage
    .from(ENV.supabaseStorageBucket)
    .createSignedUrl(storagePath, expiresInSeconds, {
      download: fileName || true,
    });

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function removeReport(storagePath: string) {
  const { error } = await supabase.storage
    .from(ENV.supabaseStorageBucket)
    .remove([storagePath]);

  if (error) {
    throw error;
  }
}

export { ALLOWED_MIME_TYPES };
