import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hashSessionToken } from "@/lib/passwords";

export type SessionUser = {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
};

export async function getSessionUser(supabase?: SupabaseClient | null): Promise<SessionUser | null> {
  const client = supabase ?? getSupabaseAdmin();
  if (!client) return null;
  const store = await cookies();
  const token = store.get("stratos_session")?.value;
  if (!token) return null;

  const { data: session } = await client
    .from("fantasy_sessions")
    .select("id, user_id, expires_at")
    .eq("token_hash", hashSessionToken(token))
    .maybeSingle();
  if (!session || new Date(session.expires_at).getTime() < Date.now()) return null;

  const { data: user } = await client
    .from("fantasy_users")
    .select("id, username, email, display_name, is_active")
    .eq("id", session.user_id)
    .maybeSingle();
  if (!user || !user.is_active) return null;

  void client.from("fantasy_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id).then(() => undefined, () => undefined);
  return { id: user.id, username: user.username, email: user.email, displayName: user.display_name };
}
