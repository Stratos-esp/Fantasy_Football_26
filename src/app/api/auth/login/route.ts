import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSessionToken, verifyPassword } from "@/lib/passwords";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { identifier?: string; password?: string } | null;
  const identifier = body?.identifier?.trim().toLowerCase();
  const password = body?.password || "";
  if (!identifier || !password) return NextResponse.json({ error: "Completa usuario y contraseña." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "La base de datos aún no está configurada." }, { status: 503 });

  let query = await supabase.from("fantasy_users").select("id, username, display_name, password_hash, is_active").eq("username", identifier).maybeSingle();
  if (!query.data && identifier.includes("@")) query = await supabase.from("fantasy_users").select("id, username, display_name, password_hash, is_active").eq("email", identifier).maybeSingle();
  const user = query.data;
  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });

  const { token, tokenHash } = createSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await supabase.from("fantasy_sessions").insert({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt.toISOString() });
  await supabase.from("fantasy_users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);

  const response = NextResponse.json({ user: { id: user.id, username: user.username, displayName: user.display_name } });
  response.cookies.set("stratos_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
  return response;
}
