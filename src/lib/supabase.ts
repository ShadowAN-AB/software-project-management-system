import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as { supabase: SupabaseClient };

function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabase = globalForSupabase.supabase || createAdminClient();

if (process.env.NODE_ENV !== "production") globalForSupabase.supabase = supabase;

export const ATTACHMENTS_BUCKET = "attachments";

export async function removeAttachmentObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
  if (error) console.error("[supabase] failed to remove attachments:", error.message);
}
