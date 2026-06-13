import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const scopedSecret = process.env.FANTASY_DATABASE_API_SECRET;
  const key = serviceKey || publishableKey;
  if (!url || !key || (!serviceKey && !scopedSecret)) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: serviceKey ? undefined : { headers: { "x-fantasy-server-secret": scopedSecret! } },
  });
}
