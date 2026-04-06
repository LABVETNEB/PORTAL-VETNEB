import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

export const supabase = createClient(
  ENV.supabaseUrl,
  ENV.supabaseServiceRoleKey,
);

export async function uploadReport(file: Buffer, fileName: string) {
  const path = `reports/${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from(ENV.supabaseStorageBucket)
    .upload(path, file, {
      upsert: false,
      contentType: "application/pdf",
    });

  if (error) {
    throw error;
  }

  return path;
}