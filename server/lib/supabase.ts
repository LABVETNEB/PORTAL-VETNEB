import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

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

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
}

export async function uploadReport(params: {
  file: Buffer;
  clinicId: number;
  fileName: string;
  mimeType?: string;
}) {
  const safeName = sanitizeFileName(params.fileName);
  const storagePath = `clinics/${params.clinicId}/reports/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(ENV.supabaseStorageBucket)
    .upload(storagePath, params.file, {
      upsert: false,
      contentType: params.mimeType || "application/octet-stream",
    });

  if (error) {
    throw error;
  }

  return storagePath;
}

export function getPublicReportUrl(storagePath: string) {
  const { data } = supabase.storage
    .from(ENV.supabaseStorageBucket)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}
